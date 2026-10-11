-- Multi-org: SECURITY DEFINER RPC obcházejí RLS, takže musí samy hlídat organizaci.
-- Do teď mohl admin/trenér jedné organizace zasahovat do dat jiné organizace
-- (schválit/smazat cizího trenéra, číst auth metadata, měnit NFC stav cizího dítěte,
-- zapsat docházku dítěti jiné organizace). Žebříčky dětí míchaly všechny organizace.
-- Chování pro Team VYS (jediná organizace v produkci) se nemění.

-- Volající sdílí organizaci (member) nebo je super admin.
create or replace function public.teamvys_actor_in_org(p_org_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select
    coalesce((select ap.super_admin from public.app_profiles ap where ap.id = auth.uid()::text), false)
    or (
      p_org_id is not null
      and exists (
        select 1 from public.organization_members m
        where m.profile_id = auth.uid()::text
          and m.org_id = p_org_id
      )
    );
$$;

-- Schválení trenéra: jen admin stejné organizace (nebo super admin).
create or replace function public.teamvys_approve_coach(p_coach_id text)
returns table(coach_id text, status text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid;
begin
  if public.teamvys_app_role() <> 'admin' then
    raise exception 'Only admin can approve coaches.' using errcode = '42501';
  end if;

  select cp.org_id into v_org from public.coach_profiles cp where cp.id = p_coach_id;
  if found and not public.teamvys_actor_in_org(v_org) then
    raise exception 'Coach belongs to a different organization.' using errcode = '42501';
  end if;

  return query
  update public.coach_profiles coach
  set approval_status = 'approved',
      approved_at = now(),
      approved_by = auth.uid()::text,
      rejected_at = null,
      rejected_by = null,
      rejection_reason = null
  where coach.id = p_coach_id
  returning coach.id, coach.approval_status;
end;
$function$;

-- Zamítnutí trenéra: jen admin stejné organizace (nebo super admin).
create or replace function public.teamvys_reject_coach(p_coach_id text, p_reason text default null::text)
returns table(coach_id text, status text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid;
begin
  if public.teamvys_app_role() <> 'admin' then
    raise exception 'Only admin can reject coaches.' using errcode = '42501';
  end if;

  select cp.org_id into v_org from public.coach_profiles cp where cp.id = p_coach_id;
  if found and not public.teamvys_actor_in_org(v_org) then
    raise exception 'Coach belongs to a different organization.' using errcode = '42501';
  end if;

  return query
  update public.coach_profiles coach
  set approval_status = 'rejected',
      rejected_at = now(),
      rejected_by = auth.uid()::text,
      rejection_reason = nullif(trim(coalesce(p_reason, '')), ''),
      approved_at = null,
      approved_by = null
  where coach.id = p_coach_id
  returning coach.id, coach.approval_status;
end;
$function$;

-- Smazání trenéra: jen admin stejné organizace (nebo super admin).
create or replace function public.teamvys_delete_coach(p_coach_id text)
returns table(coach_id text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text;
  v_org uuid;
begin
  if public.teamvys_app_role() <> 'admin' then
    raise exception 'Only admin can delete coaches.' using errcode = '42501';
  end if;

  select role into v_role from public.app_profiles where id = p_coach_id;
  if v_role is distinct from 'coach' then
    raise exception 'Profile is not a coach.' using errcode = '42501';
  end if;

  select coalesce(
    (select cp.org_id from public.coach_profiles cp where cp.id = p_coach_id),
    (select ap.org_id from public.app_profiles ap where ap.id = p_coach_id)
  ) into v_org;
  if not public.teamvys_actor_in_org(v_org) then
    raise exception 'Coach belongs to a different organization.' using errcode = '42501';
  end if;

  update public.products
  set coach_ids = array_remove(coach_ids, p_coach_id)
  where coach_ids @> array[p_coach_id];

  delete from public.coach_profiles where id = p_coach_id;
  delete from public.app_profiles where id = p_coach_id;

  begin
    delete from auth.users where id = p_coach_id::uuid;
  exception when others then
    null; -- auth user may not exist (seeded/demo coaches)
  end;

  return query select p_coach_id;
end;
$function$;

-- Auth metadata trenérů: jen trenéři z organizace volajícího admina.
create or replace function public.teamvys_get_coach_auth_meta(p_coach_ids text[])
returns table(id text, full_name text, phone text, email text)
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
begin
  if public.teamvys_app_role() <> 'admin' then
    raise exception 'Only admin can read auth metadata.' using errcode = '42501';
  end if;
  return query
  select
    u.id::text,
    coalesce(
      nullif(trim(u.raw_user_meta_data->>'name'), ''),
      nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
      u.email::text
    ) as full_name,
    coalesce(
      nullif(trim(u.raw_user_meta_data->>'phone'), ''),
      nullif(trim(u.phone::text), '')
    ) as phone,
    u.email::text
  from auth.users u
  where u.id = any(p_coach_ids::uuid[])
    and exists (
      select 1 from public.coach_profiles cp
      where cp.id = u.id::text
        and public.teamvys_actor_in_org(cp.org_id)
    );
end;
$function$;

-- Pozvánka admina nese organizaci zvoucího (dřív se org_id nevyplňovalo).
create or replace function public.teamvys_invite_admin(p_email text, p_note text default null::text)
returns table(email text, active boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  normalized_email text := lower(trim(coalesce(p_email, '')));
  v_org uuid;
begin
  if public.teamvys_app_role() <> 'admin' then
    raise exception 'Only admin can invite another admin.' using errcode = '42501';
  end if;

  if normalized_email = '' or normalized_email not like '%@%' then
    raise exception 'Admin email is required.' using errcode = '22023';
  end if;

  select ap.org_id into v_org from public.app_profiles ap where ap.id = auth.uid()::text;

  insert into public.admin_account_invites (email, invited_by, note, active, org_id)
  values (normalized_email, auth.uid()::text, coalesce(p_note, ''), true, v_org)
  on conflict (email) do update set
    invited_by = excluded.invited_by,
    invited_at = now(),
    note = excluded.note,
    active = true,
    org_id = coalesce(excluded.org_id, public.admin_account_invites.org_id);

  return query
  select invite.email, invite.active
  from public.admin_account_invites invite
  where invite.email = normalized_email;
end;
$function$;

-- Žebříček klubíčka: jen děti ze stejné organizace jako volající dítě.
-- Anonymní/demo volání (bez účtu účastníka) zachovává původní chování.
create or replace function public.teamvys_klubicka_leaderboard(p_limit integer default 20)
returns table(id text, first_name text, last_name text, attendance_done integer, equipped_mascot_id text)
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    p.id,
    p.first_name,
    p.last_name,
    coalesce(p.attendance_done, 0) as attendance_done,
    coalesce(p.equipped_mascot_id, 'beige-sit') as equipped_mascot_id
  from public.participants p
  where coalesce(p.first_name, '') <> ''
    and p.first_name not like '%@%'
    and coalesce(
      p.org_id = (select me.org_id from public.participants me where me.id = auth.uid()::text),
      true
    )
  order by coalesce(p.attendance_done, 0) desc, p.first_name asc
  limit greatest(coalesce(p_limit, 20), 1);
$function$;

-- Pořadí dítěte: počítá se jen v rámci jeho organizace.
create or replace function public.teamvys_klubicka_my_rank()
returns table(id text, first_name text, last_name text, attendance_done integer, rank integer, equipped_mascot_id text)
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    me.id,
    me.first_name,
    me.last_name,
    coalesce(me.attendance_done, 0) as attendance_done,
    (
      select count(*)
      from public.participants p
      where coalesce(p.first_name, '') <> ''
        and p.first_name not like '%@%'
        and p.org_id = me.org_id
        and coalesce(p.attendance_done, 0) > coalesce(me.attendance_done, 0)
    )::int + 1 as rank,
    coalesce(me.equipped_mascot_id, 'beige-sit') as equipped_mascot_id
  from public.participants me
  where me.id = auth.uid()::text;
$function$;

-- Ruční docházka: dítě se hledá jen v organizacích, kde je volající členem
-- (anonymní a bootstrap volání beze změny — stejná logika jako teamvys_org_match).
create or replace function public.teamvys_record_manual_attendance(p_participant_name text, p_location text, p_session_id text default null::text)
returns table(status text, participant_id text, attendance_done integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    and (
      auth.uid() is null
      or not exists (
        select 1 from public.organization_members m
        where m.profile_id = auth.uid()::text
      )
      or exists (
        select 1 from public.organization_members m
        where m.profile_id = auth.uid()::text
          and m.org_id = p.org_id
      )
    )
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
$function$;

-- Stav NFC kartičky smí měnit jen staff stejné organizace jako účastník.
create or replace function public.teamvys_set_nfc_card_status(p_participant_id text, p_status text)
returns table(participant_id text, nfc_card_status text, nfc_card_issued_at timestamp with time zone, nfc_card_returned_at timestamp with time zone)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid;
begin
  if not public.teamvys_is_staff() then
    raise exception 'Jen trenér nebo admin může měnit stav NFC kartičky.';
  end if;

  if p_status not in ('none','issued','returned','lost') then
    raise exception 'Neplatný stav NFC kartičky: %', p_status;
  end if;

  select p.org_id into v_org from public.participants p where p.id = p_participant_id;
  if not found then
    raise exception 'Účastník % nenalezen.', p_participant_id;
  end if;
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

  return query
  select p.id, p.nfc_card_status, p.nfc_card_issued_at, p.nfc_card_returned_at
  from public.participants p
  where p.id = p_participant_id;
end;
$function$;
