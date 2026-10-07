-- Žebříček trenérů pro aplikaci.
--
-- Proč RPC: `app_profiles` má RLS "own read" (každý vidí jen svůj profil),
-- takže trenér by u ostatních v žebříčku neviděl jména. SECURITY DEFINER
-- funkce vrací jen bezpečnou podmnožinu (jméno + herní statistiky) a jen
-- schválené trenéry ze stejné organizace jako volající. Stejný vzor jako
-- teamvys_klubicka_leaderboard.
create or replace function public.teamvys_coach_leaderboard(p_limit integer default 20)
returns table (
  id text,
  name text,
  qr_tricks_approved integer,
  bonus_total integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cp.id,
    coalesce(ap.name, 'Trenér') as name,
    coalesce(cp.qr_tricks_approved, 0) as qr_tricks_approved,
    coalesce(cp.bonus_total, 0) as bonus_total
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
