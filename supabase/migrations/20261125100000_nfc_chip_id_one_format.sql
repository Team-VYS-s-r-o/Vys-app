-- Jedna kartička = jedno ID, ať ji čte kterýkoli telefon.
-- Web (Web NFC v Chrome na Androidu) hlásí UID čipu s dvojtečkami
-- („04:88:EA:02:B6:21:90"), nativní appka bez nich („0488EA02B62190"). Sken
-- porovnával ID jako text, takže kartu spárovanou na jednom zařízení druhé
-- nepoznalo, ptalo se znovu na držitele a přepsalo ID na svůj formát — a tak
-- pořád dokola. Dvakrát se tím stejná karta dostala ke dvěma dětem.

create or replace function public.teamvys_normalize_chip(p_chip text)
returns text
language sql
immutable
as $norm$
  select case
    when upper(btrim(coalesce(p_chip, ''))) ~ '^[0-9A-F]{2}([:\- ]?[0-9A-F]{2})+$'
      then regexp_replace(upper(p_chip), '[^0-9A-F]', '', 'g')
    else upper(regexp_replace(coalesce(p_chip, ''), '\s+', '', 'g'))
  end
$norm$;

-- Karta spárovaná omylem s druhým dítětem (pozdější přiřazení na zařízení, které
-- ji nepoznalo): zůstává původnímu držiteli, druhé dítě si svou kartu spáruje znovu.
update public.digital_passes set nfc_chip_id = 'NFC-MANUALDE-COURSEVY'
where id = 'pass-stripe-pi-pi_3UXOV9LJMXM5yOAX1H59kG3N' and nfc_chip_id = '04:42:77:7A:A2:21:90';
update public.digital_passes set nfc_chip_id = 'NFC-MANUALNI-COURSEVY'
where id = 'pass-stripe-pi-pi_3UAuZtLJMXM5yOAX1qOSgs86' and nfc_chip_id = '04:4C:30:72:B6:21:91';

update public.digital_passes
set nfc_chip_id = public.teamvys_normalize_chip(nfc_chip_id)
where nfc_chip_id !~ '^(NFC|QR)-'
  and nfc_chip_id is distinct from public.teamvys_normalize_chip(nfc_chip_id);

CREATE OR REPLACE FUNCTION public.teamvys_scan_digital_pass(p_chip_id text, p_location text, p_holder_name text DEFAULT NULL::text, p_session_id text DEFAULT NULL::text, p_method text DEFAULT 'NFC'::text, p_dry_run boolean DEFAULT false)
 RETURNS TABLE(status text, pass_id text, participant_id text, holder_name text, title text, location text, nfc_chip_id text, total_entries integer, used_entries integer, last_scan_at text, last_scan_place text, remaining_entries integer, bonus_entry_awarded boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  normalized_chip text := public.teamvys_normalize_chip(p_chip_id);
  pass_record public.digital_passes%rowtype;
  scan_text text := to_char(now() at time zone 'Europe/Prague', 'FMDay DD. FMMonth YYYY HH24:MI');
  today_text text := to_char(now() at time zone 'Europe/Prague', 'DD. MM. YYYY');
  today_key text := to_char(now() at time zone 'Europe/Prague', 'YYYY-MM-DD');
  attendance_id text;
  attendee jsonb;
  current_attendees jsonb;
  v_flags jsonb;
  v_membership boolean;
begin
  bonus_entry_awarded := false;
  if normalized_chip = '' then
    status := 'unknown-chip';
    return next;
    return;
  end if;

  -- Aktivní = členství v platnosti NEBO permanentka s nevyčerpanými vstupy.
  select * into pass_record
  from public.digital_passes pass
  where (
      (coalesce(pass.pass_kind, 'course') = 'membership' and coalesce(pass.expires_at, '') >= today_key)
      or (coalesce(pass.pass_kind, 'course') <> 'membership' and pass.used_entries < pass.total_entries)
    )
    and (
      pass.location = p_location
      or exists (
        select 1 from public.participants pt
        where pt.id = pass.participant_id
          and p_location = any(coalesce(pt.extra_courses, '{}'::text[]))
      )
    )
    and (
      public.teamvys_normalize_chip(pass.nfc_chip_id) = normalized_chip
      or (p_holder_name is not null and pass.holder_name = p_holder_name)
    )
  order by
    (case when public.teamvys_normalize_chip(pass.nfc_chip_id) = normalized_chip then 0 else 1 end),
    (case when pass.location = p_location then 0 else 1 end),
    pass.created_at asc
  limit 1
  for update;

  if pass_record.id is null then
    if exists (
      select 1 from public.digital_passes pass
      where (
          (coalesce(pass.pass_kind, 'course') = 'membership' and coalesce(pass.expires_at, '') >= today_key)
          or (coalesce(pass.pass_kind, 'course') <> 'membership' and pass.used_entries < pass.total_entries)
        )
        and pass.location <> p_location
        and not exists (
          select 1 from public.participants pt
          where pt.id = pass.participant_id
            and p_location = any(coalesce(pt.extra_courses, '{}'::text[]))
        )
        and (
          public.teamvys_normalize_chip(pass.nfc_chip_id) = normalized_chip
          or (p_holder_name is not null and pass.holder_name = p_holder_name)
        )
    ) then
      status := 'wrong-location';
    elsif exists (
      select 1 from public.digital_passes pass
      where coalesce(pass.pass_kind, 'course') = 'membership'
        and (
          pass.location = p_location
          or exists (
            select 1 from public.participants pt
            where pt.id = pass.participant_id
              and p_location = any(coalesce(pt.extra_courses, '{}'::text[]))
          )
        )
        and (
          public.teamvys_normalize_chip(pass.nfc_chip_id) = normalized_chip
          or (p_holder_name is not null and pass.holder_name = p_holder_name)
        )
    ) then
      status := 'membership-expired';
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
          public.teamvys_normalize_chip(pass.nfc_chip_id) = normalized_chip
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

  v_membership := coalesce(pass_record.pass_kind, 'course') = 'membership';

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
    remaining_entries := case when v_membership then -1 else pass_record.total_entries - pass_record.used_entries end;
    return next;
    return;
  end if;

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
    remaining_entries := case when v_membership then -1 else pass_record.total_entries - pass_record.used_entries end;
    return next;
    return;
  end if;

  attendance_id := 'children-' || coalesce(p_session_id, 'nfc') || '-' || today_key;

  -- Členství: used_entries jen počítá návštěvy (statistika), nic se nevyčerpává.
  update public.digital_passes
  set used_entries = case when v_membership then pass_record.used_entries + 1 else least(pass_record.used_entries + 1, pass_record.total_entries) end,
      last_scan_at = scan_text,
      last_scan_place = p_location,
      nfc_chip_id = normalized_chip
  where id = pass_record.id
  returning * into pass_record;

  -- Bonusový vstup: jen permanentka na vstupy, právě dočerpaná, vše přes NFC.
  if not v_membership
     and pass_record.used_entries >= pass_record.total_entries
     and pass_record.manual_entries = 0
     and not pass_record.bonus_entry_granted then
    select o.feature_flags into v_flags from public.organizations o where o.id = pass_record.org_id;
    if coalesce((v_flags->>'attendance_nfc_bonus_entry')::boolean, false) then
      update public.digital_passes
      set total_entries = pass_record.total_entries + 1,
          bonus_entry_granted = true
      where id = pass_record.id
      returning * into pass_record;
      bonus_entry_awarded := true;
    end if;
  end if;

  update public.participants
  set attendance_done = attendance_done + 1,
      attendance_total = case when v_membership then attendance_total else greatest(attendance_total, pass_record.total_entries) end,
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

  if not v_membership then
    update public.coach_wards
    set entries_left = greatest(pass_record.total_entries - pass_record.used_entries, 0),
        last_attendance = today_text
    where name = pass_record.holder_name
      and p_location = any(locations);
  else
    update public.coach_wards
    set last_attendance = today_text
    where name = pass_record.holder_name
      and p_location = any(locations);
  end if;

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
  remaining_entries := case when v_membership then -1 else pass_record.total_entries - pass_record.used_entries end;
  return next;
end;
$function$;
