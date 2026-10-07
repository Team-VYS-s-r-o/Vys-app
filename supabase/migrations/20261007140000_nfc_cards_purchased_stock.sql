-- Evidence nakoupených NFC kartiček (zásoba organizace).
alter table public.organizations
  add column if not exists nfc_cards_purchased integer not null default 0;

-- RPC rozšířené o počet nakoupených kartiček. Starou 4parametrovou signaturu
-- rušíme, aby nevzniklo nejednoznačné přetížení; nový parametr má default,
-- takže staré volání (bez něj) dál funguje a počet nechá beze změny.
drop function if exists public.teamvys_update_nfc_settings(uuid, boolean, integer, integer);

create or replace function public.teamvys_update_nfc_settings(
  p_org_id uuid,
  p_enabled boolean,
  p_deadline_days integer,
  p_fee integer,
  p_cards_purchased integer default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  is_allowed boolean;
begin
  select exists (
    select 1
    from public.app_profiles ap
    where ap.id = (auth.uid())::text
      and (
        ap.super_admin
        or (
          ap.role = 'admin'
          and exists (
            select 1 from public.organization_members om
            where om.profile_id = ap.id and om.org_id = p_org_id
          )
        )
      )
  ) into is_allowed;

  if not is_allowed then
    raise exception 'Jen admin organizace může měnit nastavení NFC kartiček.';
  end if;

  update public.organizations
  set nfc_deposit_enabled = coalesce(p_enabled, false),
      nfc_return_deadline_days = greatest(1, coalesce(p_deadline_days, 14)),
      nfc_deposit_fee = greatest(0, coalesce(p_fee, 100)),
      nfc_cards_purchased = greatest(0, coalesce(p_cards_purchased, nfc_cards_purchased))
  where id = p_org_id;

  if not found then
    raise exception 'Organizace nenalezena.';
  end if;
end;
$function$;

-- Team VYS má nakoupeno 230 kartiček.
update public.organizations
set nfc_cards_purchased = 230
where id = '00000000-0000-4000-8000-000000000001';
