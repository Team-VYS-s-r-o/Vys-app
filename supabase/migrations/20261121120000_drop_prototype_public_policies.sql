-- Zavření úniku osobních údajů (zjištěno 21. 11. 2026).
--
-- V produkční DB zůstaly z doby prototypu policies pro roli `public` s podmínkou
-- `true AND teamvys_org_match(org_id)`. Protože `teamvys_org_match` vrací pro
-- nepřihlášeného (auth.uid() is null) TRUE, mohl kdokoli s veřejným anon klíčem:
--   - číst, vkládat i MAZAT řádky v parent_purchases (jména dětí, částky, Stripe id),
--   - číst a vkládat parent_notifications (jméno dítěte, místo, text),
--   - číst a vkládat bracelet_confirmations.
-- Stejně otevřené byly qr_trick_rescan_claims a workshop_interests a pohled
-- camp_medical_overview (běžel s právy vlastníka, takže obcházel RLS).
--
-- Tyto policies nebyly v žádné migraci v repu (vznikly ručně), proto je migrace
-- z 8. 5. (`... to authenticated`) nepřepsala. Po jejich zrušení platí jen
-- scoped policies: rodič/účastník vidí své, admin vše ve své organizaci.
--
-- Rušené definice (pro případný návrat):
--   parent_purchases      "prototype parent purchases read"   SELECT to public using (true AND teamvys_org_match(org_id))
--   parent_purchases      "prototype parent purchases insert" INSERT to public with check (true AND teamvys_org_match(org_id))
--   parent_purchases      "prototype parent purchases delete" DELETE to public using (true AND teamvys_org_match(org_id))
--   parent_notifications  "prototype parent notifications read"   SELECT to public using (true AND teamvys_org_match(org_id))
--   parent_notifications  "prototype parent notifications insert" INSERT to public with check (true AND teamvys_org_match(org_id))
--   bracelet_confirmations "prototype bracelet confirmations read"   SELECT to public using (true AND teamvys_org_match(org_id))
--   bracelet_confirmations "prototype bracelet confirmations insert" INSERT to public with check (true AND teamvys_org_match(org_id))
--   qr_trick_rescan_claims "qr_trick_rescan_claims all"       ALL to public using/with check (true AND teamvys_org_match(org_id))
--   workshop_interests     "workshop_interests prototype all" ALL to public using/with check (true AND teamvys_org_match(org_id))

-- ── parent_purchases ────────────────────────────────────────────────────────
drop policy if exists "prototype parent purchases read" on public.parent_purchases;
drop policy if exists "prototype parent purchases insert" on public.parent_purchases;
drop policy if exists "prototype parent purchases delete" on public.parent_purchases;

-- Trenér četl přihlášky na své tábory jen díky prototype policy (hook
-- use-coach-camps ve vys-aplikace). Nahrazujeme úzkým pravidlem: schválený
-- trenér vidí nákupy jen u produktů, kde je sám přiřazený.
drop policy if exists "parent_purchases assigned coach read" on public.parent_purchases;
create policy "parent_purchases assigned coach read" on public.parent_purchases
  for select to authenticated
  using (
    public.teamvys_is_approved_coach(auth.uid()::text)
    and public.teamvys_org_match(org_id)
    and exists (
      select 1
      from public.products p
      where p.id = parent_purchases.product_id
        and auth.uid()::text = any (p.coach_ids)
    )
  );

-- ── parent_notifications ────────────────────────────────────────────────────
-- Zůstává "parent_notifications scoped read" (rodič/účastník své, staff vše
-- v organizaci) a "parent_notifications coach insert" (zápis docházky trenérem).
drop policy if exists "prototype parent notifications read" on public.parent_notifications;
drop policy if exists "prototype parent notifications insert" on public.parent_notifications;

-- ── bracelet_confirmations ──────────────────────────────────────────────────
-- Zůstává "bracelet_confirmations coach access" (staff).
drop policy if exists "prototype bracelet confirmations read" on public.bracelet_confirmations;
drop policy if exists "prototype bracelet confirmations insert" on public.bracelet_confirmations;

-- ── qr_trick_rescan_claims ──────────────────────────────────────────────────
-- Tabulku používá jen SECURITY DEFINER funkce teamvys_claim_qr_trick; klient
-- na ni přímo nesahá, takže žádnou policy nepotřebuje.
drop policy if exists "qr_trick_rescan_claims all" on public.qr_trick_rescan_claims;

-- ── workshop_interests ──────────────────────────────────────────────────────
-- Zapisuje server (service role). Klient jen čte vlastní zájem (platby.tsx).
drop policy if exists "workshop_interests prototype all" on public.workshop_interests;
drop policy if exists "workshop_interests own read" on public.workshop_interests;
create policy "workshop_interests own read" on public.workshop_interests
  for select to authenticated
  using (
    (
      parent_profile_id = auth.uid()::text
      or participant_id = auth.uid()::text
      or public.teamvys_app_role() = 'admin'
    )
    and public.teamvys_org_match(org_id)
  );

-- ── camp_medical_overview ───────────────────────────────────────────────────
-- Pohled nad course_documents (alergie, léky, pojišťovna). Bez security_invoker
-- běžel s právy vlastníka a RLS na course_documents obcházel → čitelný i pro
-- anon. Teď se řídí RLS volajícího. (Klienti ani server ho nepoužívají.)
alter view public.camp_medical_overview set (security_invoker = true);
