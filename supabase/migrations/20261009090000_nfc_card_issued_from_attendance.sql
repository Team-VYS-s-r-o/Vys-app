-- Kartička je fyzicky u dítěte ve chvíli, kdy mu trenér zapíše docházku.
-- digital_passes.nfc_chip_id se na to použít nedá: server ho generuje synteticky
-- z participant_id + product_id při každém nákupu, takže "spárovaný čip" měl
-- i každý, kdo kartičku nikdy nedostal (a u manual-* id navíc kolidoval).
create or replace function teamvys_mark_nfc_issued_from_attendance()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update participants p
     set nfc_card_status = 'issued',
         nfc_card_issued_at = coalesce(p.nfc_card_issued_at, now())
   from (
     select distinct lower(btrim(a->>'name')) as name
     from jsonb_array_elements(coalesce(new.attendees, '[]'::jsonb)) a
     where btrim(coalesce(a->>'name', '')) <> ''
   ) att
  where lower(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))) = att.name
    and p.org_id is not distinct from new.org_id
    -- Jedno dítě = jedna kartička: stav se nikdy nepřepisuje, jen se poprvé
    -- založí. Vrácené / ztracené / proplacené zůstávají, jak jsou.
    and coalesce(p.nfc_card_status, 'none') = 'none';
  return new;
end;
$$;

drop trigger if exists child_attendance_marks_nfc_issued on child_attendance_records;
create trigger child_attendance_marks_nfc_issued
after insert or update of attendees on child_attendance_records
for each row execute function teamvys_mark_nfc_issued_from_attendance();

-- Dorovnání už zapsané docházky.
with att as (
  select distinct r.org_id, lower(btrim(a->>'name')) as name
  from child_attendance_records r, jsonb_array_elements(r.attendees) a
  where btrim(coalesce(a->>'name', '')) <> ''
)
update participants p
   set nfc_card_status = 'issued',
       nfc_card_issued_at = coalesce(p.nfc_card_issued_at, now())
  from att
 where lower(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))) = att.name
   and p.org_id is not distinct from att.org_id
   and coalesce(p.nfc_card_status, 'none') = 'none';
