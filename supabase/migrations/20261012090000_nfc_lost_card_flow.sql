-- Ztracená NFC kartička:
--   1. Stav kartičky smí měnit i koordinátor (dřív jen trenér/admin).
--      Při označení 'lost' se rodiči založí notifikace s výzvou k platbě.
--   2. teamvys_scan_digital_pass dostává p_dry_run: při true jen najde,
--      komu permanentka patří (status 'preview'), nic neodečítá ani nezapisuje.
--      Vstup se odečte až druhým voláním bez dry-run (tlačítko POTVRDIT).

create or replace function public.teamvys_set_nfc_card_status(p_participant_id text, p_status text)
returns table(participant_id text, nfc_card_status text, nfc_card_issued_at timestamp with time zone, nfc_card_returned_at timestamp with time zone)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid;
  v_participant public.participants%rowtype;
  v_fee numeric;
  v_deposit_enabled boolean;
begin
  if not (public.teamvys_is_staff() or public.teamvys_app_role() = 'coordinator') then
    raise exception 'Jen trenér, koordinátor nebo admin může měnit stav NFC kartičky.';
  end if;

  if p_status not in ('none','issued','returned','lost') then
    raise exception 'Neplatný stav NFC kartičky: %', p_status;
  end if;

  select * into v_participant from public.participants p where p.id = p_participant_id;
  if not found then
    raise exception 'Účastník % nenalezen.', p_participant_id;
  end if;
  v_org := v_participant.org_id;
  if not public.teamvys_actor_in_org(v_org) then
    raise exception 'Účastník patří jiné organizaci.';
  end if;

  update public.participants
  set nfc_card_status = p_status,
      nfc_card_issued_at = case
        when p_status = 'issued' then now()
        when p_status = 'none' then null
        else public.participants.nfc_card_issued_at
      end,
      nfc_card_returned_at = case
        when p_status = 'returned' then now()
        when p_status in ('none','issued') then null
        else public.participants.nfc_card_returned_at
      end,
      nfc_fee_paid_at = case when p_status in ('none','issued') then null else public.participants.nfc_fee_paid_at end,
      nfc_fee_payment_intent_id = case when p_status in ('none','issued') then null else public.participants.nfc_fee_payment_intent_id end
  where id = p_participant_id;

  if p_status = 'lost' then
    select coalesce(o.nfc_deposit_fee, 100), coalesce(o.nfc_deposit_enabled, false)
    into v_fee, v_deposit_enabled
    from public.organizations o
    where o.id = v_org;

    if v_deposit_enabled and v_fee > 0 then
      insert into public.parent_notifications (id, participant_name, location, method, text, created_at_text, participant_id, parent_profile_id, org_id)
      values (
        'nfc-lost-' || p_participant_id || '-' || to_char(now() at time zone 'Europe/Prague', 'YYYY-MM-DD'),
        btrim(coalesce(v_participant.first_name, '') || ' ' || coalesce(v_participant.last_name, '')),
        coalesce(v_participant.active_course, ''),
        'NFC kartička',
        'Kartička byla označena jako ztracená. Novou kartičku získáš po zaplacení poplatku ' || trim(to_char(v_fee, 'FM999999')) || ' Kč v sekci Děti.',
        to_char(now() at time zone 'Europe/Prague', 'DD. MM. YYYY HH24:MI'),
        p_participant_id,
        v_participant.parent_profile_id,
        v_org
      )
      on conflict (id) do nothing;
    end if;
  end if;

  return query
  select p.id, p.nfc_card_status, p.nfc_card_issued_at, p.nfc_card_returned_at
  from public.participants p
  where p.id = p_participant_id;
end;
$function$;

-- Nová signatura s p_dry_run — starou verzi musíme dropnout,
-- jinak by PostgREST řešil nejednoznačný overload.
drop function if exists public.teamvys_scan_digital_pass(text, text, text, text, text);

create or replace function public.teamvys_scan_digital_pass(
  p_chip_id text,
  p_location text,
  p_holder_name text default null,
  p_session_id text default null,
  p_method text default 'NFC',
  p_dry_run boolean default false
)
returns table (
  status text,
  pass_id text,
  participant_id text,
  holder_name text,
  title text,
  location text,
  nfc_chip_id text,
  total_entries integer,
  used_entries integer,
  last_scan_at text,
  last_scan_place text,
  remaining_entries integer
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  normalized_chip text := upper(regexp_replace(coalesce(p_chip_id, ''), '\s+', '', 'g'));
  pass_record public.digital_passes%rowtype;
  scan_text text := to_char(now() at time zone 'Europe/Prague', 'FMDay DD. FMMonth YYYY HH24:MI');
  today_text text := to_char(now() at time zone 'Europe/Prague', 'DD. MM. YYYY');
  today_key text := to_char(now() at time zone 'Europe/Prague', 'YYYY-MM-DD');
  attendance_id text;
  attendee jsonb;
  current_attendees jsonb;
begin
  if normalized_chip = '' then
    status := 'unknown-chip';
    return next;
    return;
  end if;

  -- A pass is valid at its own location OR at any of the participant's
  -- extra_courses (další škola ve stejném městě). Same shared entry pool.
  if p_dry_run then
    select * into pass_record
    from public.digital_passes pass
    where pass.used_entries < pass.total_entries
      and (
        pass.location = p_location
        or exists (
          select 1 from public.participants pt
          where pt.id = pass.participant_id
            and p_location = any(coalesce(pt.extra_courses, '{}'::text[]))
        )
      )
      and (
        upper(regexp_replace(pass.nfc_chip_id, '\s+', '', 'g')) = normalized_chip
        or (p_holder_name is not null and pass.holder_name = p_holder_name)
      )
    order by
      (case when upper(regexp_replace(pass.nfc_chip_id, '\s+', '', 'g')) = normalized_chip then 0 else 1 end),
      (case when pass.location = p_location then 0 else 1 end),
      pass.created_at asc
    limit 1;
  else
    select * into pass_record
    from public.digital_passes pass
    where pass.used_entries < pass.total_entries
      and (
        pass.location = p_location
        or exists (
          select 1 from public.participants pt
          where pt.id = pass.participant_id
            and p_location = any(coalesce(pt.extra_courses, '{}'::text[]))
        )
      )
      and (
        upper(regexp_replace(pass.nfc_chip_id, '\s+', '', 'g')) = normalized_chip
        or (p_holder_name is not null and pass.holder_name = p_holder_name)
      )
    order by
      (case when upper(regexp_replace(pass.nfc_chip_id, '\s+', '', 'g')) = normalized_chip then 0 else 1 end),
      (case when pass.location = p_location then 0 else 1 end),
      pass.created_at asc
    limit 1
    for update;
  end if;

  if pass_record.id is null then
    if exists (
      select 1 from public.digital_passes pass
      where pass.used_entries < pass.total_entries
        and pass.location <> p_location
        and not exists (
          select 1 from public.participants pt
          where pt.id = pass.participant_id
            and p_location = any(coalesce(pt.extra_courses, '{}'::text[]))
        )
        and (
          upper(regexp_replace(pass.nfc_chip_id, '\s+', '', 'g')) = normalized_chip
          or (p_holder_name is not null and pass.holder_name = p_holder_name)
        )
    ) then
      status := 'wrong-location';
    elsif exists (
      select 1 from public.digital_passes pass
      where (
          pass.location = p_location
          or exists (
            select 1 from public.participants pt
            where pt.id = pass.participant_id
              and p_location = any(coalesce(pt.extra_courses, '{}'::text[]))
          )
        )
        and (
          upper(regexp_replace(pass.nfc_chip_id, '\s+', '', 'g')) = normalized_chip
          or (p_holder_name is not null and pass.holder_name = p_holder_name)
        )
    ) then
      status := 'all-passes-used';
    else
      status := 'no-active-pass';
    end if;
    return next;
    return;
  end if;

  if exists (
    select 1
    from public.child_attendance_records record,
         jsonb_array_elements(record.attendees) item
    where record.date_text = today_text
      and record.location = p_location
      and item ->> 'name' = pass_record.holder_name
  ) then
    status := 'already-registered';
    pass_id := pass_record.id;
    participant_id := pass_record.participant_id;
    holder_name := pass_record.holder_name;
    title := pass_record.title;
    location := pass_record.location;
    nfc_chip_id := pass_record.nfc_chip_id;
    total_entries := pass_record.total_entries;
    used_entries := pass_record.used_entries;
    last_scan_at := pass_record.last_scan_at;
    last_scan_place := pass_record.last_scan_place;
    remaining_entries := pass_record.total_entries - pass_record.used_entries;
    return next;
    return;
  end if;

  -- Dry run: jen náhled, komu permanentka patří. Nic se neodečítá ani neváže.
  if p_dry_run then
    status := 'preview';
    pass_id := pass_record.id;
    participant_id := pass_record.participant_id;
    holder_name := pass_record.holder_name;
    title := pass_record.title;
    location := pass_record.location;
    nfc_chip_id := pass_record.nfc_chip_id;
    total_entries := pass_record.total_entries;
    used_entries := pass_record.used_entries;
    last_scan_at := pass_record.last_scan_at;
    last_scan_place := pass_record.last_scan_place;
    remaining_entries := pass_record.total_entries - pass_record.used_entries;
    return next;
    return;
  end if;

  attendance_id := 'children-' || coalesce(p_session_id, 'nfc') || '-' || today_key;

  update public.digital_passes
  set used_entries = least(pass_record.used_entries + 1, pass_record.total_entries),
      last_scan_at = scan_text,
      last_scan_place = p_location,
      nfc_chip_id = normalized_chip
  where id = pass_record.id
  returning * into pass_record;

  update public.participants
  set attendance_done = attendance_done + 1,
      attendance_total = greatest(attendance_total, pass_record.total_entries),
      active_course = coalesce(active_course, pass_record.location)
  where id = pass_record.participant_id;

  attendee := jsonb_build_object('name', pass_record.holder_name, 'time', to_char(now() at time zone 'Europe/Prague', 'HH24:MI'), 'method', p_method);

  select coalesce(jsonb_agg(item), '[]'::jsonb)
  into current_attendees
  from public.child_attendance_records record,
       jsonb_array_elements(record.attendees) item
  where record.id = attendance_id
    and item ->> 'name' <> pass_record.holder_name;

  insert into public.child_attendance_records (id, session_id, date_text, location, attendees, org_id)
  values (attendance_id, p_session_id, today_text, p_location, jsonb_build_array(attendee), pass_record.org_id)
  on conflict (id) do update set
    session_id = excluded.session_id,
    date_text = excluded.date_text,
    location = excluded.location,
    attendees = coalesce(current_attendees, '[]'::jsonb) || attendee,
    org_id = coalesce(public.child_attendance_records.org_id, excluded.org_id);

  update public.coach_wards
  set entries_left = greatest(pass_record.total_entries - pass_record.used_entries, 0),
      last_attendance = today_text
  where name = pass_record.holder_name
    and p_location = any(locations);

  status := 'updated';
  pass_id := pass_record.id;
  participant_id := pass_record.participant_id;
  holder_name := pass_record.holder_name;
  title := pass_record.title;
  location := pass_record.location;
  nfc_chip_id := pass_record.nfc_chip_id;
  total_entries := pass_record.total_entries;
  used_entries := pass_record.used_entries;
  last_scan_at := pass_record.last_scan_at;
  last_scan_place := pass_record.last_scan_place;
  remaining_entries := pass_record.total_entries - pass_record.used_entries;
  return next;
end;
$function$;
