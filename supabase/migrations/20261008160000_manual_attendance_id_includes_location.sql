-- Bez p_session_id vznikalo id 'children-manual-<datum>', takže dvě různé
-- lokality ve stejný den skončily v JEDNOM řádku child_attendance_records.
-- Kalendář trenéra pak u takového řádku ukázal cizí lokalitu (Brandýs
-- u trenéra z Vyškova). Lokalita teď jde do id, aby byl řádek na lokalitu.
-- Slug se v klientovi (hooks/use-coach-operations.ts → locationSlug) počítá
-- stejně, tzn. BEZ odstranění diakritiky — obě strany musí dát totožné id.
create or replace function public.teamvys_record_manual_attendance(
  p_participant_name text,
  p_location text,
  p_session_id text default null
)
returns table(status text, participant_id text, attendance_done integer)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  participant_record public.participants%rowtype;
  today_text text := to_char(now() at time zone 'Europe/Prague', 'DD. MM. YYYY');
  today_key text := to_char(now() at time zone 'Europe/Prague', 'YYYY-MM-DD');
  normalized_name text := lower(btrim(regexp_replace(coalesce(p_participant_name, ''), '\s+', ' ', 'g')));
  location_slug text;
  attendance_id text;
  attendee jsonb;
  current_attendees jsonb;
begin
  if normalized_name = '' then
    status := 'unknown';
    return next;
    return;
  end if;

  select * into participant_record
  from public.participants p
  where lower(btrim(regexp_replace(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''), '\s+', ' ', 'g'))) = normalized_name
  order by (case when p.active_course = p_location then 0 else 1 end), p.created_at asc
  limit 1
  for update;

  if not found then
    status := 'unknown';
    return next;
    return;
  end if;

  -- Fallback id musí nést lokalitu, jinak se dvě lokality ve stejný den slijí.
  location_slug := lower(regexp_replace(coalesce(p_location, 'bez-lokality'), '[^a-zA-Z0-9]+', '-', 'g'));
  location_slug := btrim(location_slug, '-');
  if location_slug = '' then location_slug := 'bez-lokality'; end if;
  attendance_id := 'children-' || coalesce(nullif(btrim(coalesce(p_session_id, '')), ''), 'manual-' || location_slug) || '-' || today_key;

  if exists (
    select 1
    from public.child_attendance_records record,
         jsonb_array_elements(record.attendees) item
    where record.date_text = today_text
      and record.location = p_location
      and item ->> 'name' = p_participant_name
  ) then
    status := 'already-registered';
    participant_id := participant_record.id;
    attendance_done := participant_record.attendance_done;
    return next;
    return;
  end if;

  update public.participants
  set attendance_done = public.participants.attendance_done + 1,
      active_course = coalesce(public.participants.active_course, p_location)
  where id = participant_record.id
  returning public.participants.attendance_done into attendance_done;

  attendee := jsonb_build_object(
    'name', p_participant_name,
    'time', to_char(now() at time zone 'Europe/Prague', 'HH24:MI'),
    'method', 'Ručně'
  );

  select coalesce(jsonb_agg(item), '[]'::jsonb)
  into current_attendees
  from public.child_attendance_records record,
       jsonb_array_elements(record.attendees) item
  where record.id = attendance_id
    and item ->> 'name' <> p_participant_name;

  insert into public.child_attendance_records (id, session_id, date_text, location, attendees, org_id)
  values (attendance_id, nullif(btrim(coalesce(p_session_id, '')), ''), today_text, p_location, jsonb_build_array(attendee), participant_record.org_id)
  on conflict (id) do update set
    session_id = excluded.session_id,
    date_text = excluded.date_text,
    location = excluded.location,
    attendees = coalesce(current_attendees, '[]'::jsonb) || attendee,
    org_id = coalesce(public.child_attendance_records.org_id, excluded.org_id);

  status := 'registered';
  participant_id := participant_record.id;
  return next;
end;
$$;
