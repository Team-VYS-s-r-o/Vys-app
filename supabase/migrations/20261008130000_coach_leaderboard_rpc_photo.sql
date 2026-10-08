-- Leaderboard trenérů ukazoval jen barevná kolečka s iniciálami, protože RPC
-- profilovku nevracela. Přímý select na cizí coach_profiles nejde (RLS je
-- "own read"), takže fotka musí jít přes tuhle SECURITY DEFINER funkci.
-- Návratový typ se mění → nutný DROP (CREATE OR REPLACE to neumí).
drop function if exists public.teamvys_coach_leaderboard(integer);

create function public.teamvys_coach_leaderboard(p_limit integer default 20)
returns table(
  id text,
  name text,
  qr_tricks_approved integer,
  bonus_total integer,
  profile_photo_url text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    cp.id,
    coalesce(ap.name, 'Trenér') as name,
    coalesce(cp.qr_tricks_approved, 0) as qr_tricks_approved,
    coalesce(cp.bonus_total, 0) as bonus_total,
    nullif(btrim(coalesce(cp.profile_photo_url, '')), '') as profile_photo_url
  from public.coach_profiles cp
  join public.app_profiles ap on ap.id = cp.id
  where cp.approval_status = 'approved'
    -- jen přihlášený schválený trenér nebo admin
    and public.teamvys_is_staff()
    -- jen trenéři z organizací, kde je volající členem
    and exists (
      select 1
      from public.organization_members m
      where m.profile_id = auth.uid()::text
        and m.org_id = cp.org_id
    )
  order by coalesce(cp.qr_tricks_approved, 0) desc, ap.name asc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;
