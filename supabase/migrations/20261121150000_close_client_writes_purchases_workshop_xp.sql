-- Zavření dvou zbylých děr v zápisu (navazuje na 20261121120000).
--
-- 1) workshop_xp_awards měla policy "workshop_xp_awards prototype all" (ALL pro
--    roli public, `true AND teamvys_org_match(org_id)`). teamvys_org_match vrací
--    pro nepřihlášeného TRUE, takže kdokoli s anon klíčem mohl záznamy o XP
--    vkládat i mazat. Zápis dělal klient (vys-aplikace, hooks/use-qr-events.ts),
--    včetně výpočtu XP. Nově zapisuje jen SECURITY DEFINER funkce
--    teamvys_claim_workshop_xp; čtení má vlastník, rodič dítěte a staff.
--
-- 2) parent_purchases měla policy "parent_purchases scoped write" (FOR ALL to
--    authenticated): přihlášený rodič si mohl vložit vlastní řádek se
--    status='Zaplaceno' a trigger teamvys_sync_paid_purchase_side_effects mu
--    založil permanentku bez platby. Nákupy zapisuje výhradně server (service
--    role, obchází RLS); žádný klient (vys-aplikace, aplikacevys.cz, teamvys.cz)
--    do tabulky nezapisuje, takže zápisová policy se ruší bez náhrady.
--
-- Rušené definice (pro případný návrat):
--   workshop_xp_awards "workshop_xp_awards prototype all"
--     ALL to public using/with check (true AND teamvys_org_match(org_id))
--   parent_purchases "parent_purchases scoped write"
--     ALL to authenticated using/with check (
--       ((participant_id = auth.uid()::text) OR (parent_profile_id = auth.uid()::text)
--         OR (teamvys_app_role() = 'admin')) AND teamvys_org_match(org_id))

-- ── parent_purchases ────────────────────────────────────────────────────────
-- Zůstává "parent_purchases scoped read" a "parent_purchases assigned coach read".
drop policy if exists "parent_purchases scoped write" on public.parent_purchases;
revoke insert, update, delete, truncate, references, trigger
  on public.parent_purchases from anon, authenticated;

-- ── workshop_xp_awards ──────────────────────────────────────────────────────
drop policy if exists "workshop_xp_awards prototype all" on public.workshop_xp_awards;
revoke all on public.workshop_xp_awards from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.workshop_xp_awards from authenticated;

drop policy if exists "workshop_xp_awards scoped read" on public.workshop_xp_awards;
create policy "workshop_xp_awards scoped read" on public.workshop_xp_awards
  for select to authenticated
  using (
    (
      participant_id = auth.uid()::text
      or exists (
        select 1
        from public.participants p
        where p.id = workshop_xp_awards.participant_id
          and p.parent_profile_id = auth.uid()::text
      )
      or public.teamvys_is_staff()
    )
    and public.teamvys_org_match(org_id)
  );

-- Claim XP za workshop. Volá přihlášený účastník sám za sebe, nebo rodič za své
-- dítě (p_participant_id). XP se počítá tady z coach_tricks, ne z klienta:
-- 0 splněných triků → nic, 1 ze 2 → polovina (zaokrouhleno nahoru), 2 ze 2 → vše.
--
-- Dvojice triků workshopu zrcadlí `workshopSkillIds` ve vys-aplikace
-- (lib/workshop-ticket.ts) — při novém workshopu doplnit na obou místech.
drop function if exists public.teamvys_claim_workshop_xp(text, text, bigint, text, text);

create function public.teamvys_claim_workshop_xp(
  p_product_id text,
  p_product_title text,
  p_ts bigint,
  p_coach_id text default null,
  p_participant_id text default null
)
returns table (
  status text,
  product_title text,
  xp integer,
  participant_name text,
  tricks_completed integer,
  total_tricks integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id text := auth.uid()::text;
  product_key text := trim(coalesce(p_product_id, ''));
  target_id text;
  participant_record public.participants%rowtype;
  ward_record public.coach_wards%rowtype;
  existing_record public.workshop_xp_awards%rowtype;
  participant_full_name text;
  db_product_title text;
  trick_ids text[];
  completed_count integer;
  total_xp integer;
  awarded_xp integer;
  scanned_at timestamptz;
  resolved_coach_id text;
begin
  total_tricks := 2;

  if current_user_id is null then
    status := 'not-authenticated'; return next; return;
  end if;

  target_id := coalesce(nullif(trim(coalesce(p_participant_id, '')), ''), current_user_id);

  select * into participant_record from public.participants where id = target_id;
  if not found then
    status := 'missing-participant'; return next; return;
  end if;

  -- Sám za sebe, nebo rodič za své dítě. Nikdo jiný.
  if participant_record.id <> current_user_id
     and participant_record.parent_profile_id is distinct from current_user_id then
    status := 'forbidden'; return next; return;
  end if;

  participant_full_name := trim(participant_record.first_name || ' ' || participant_record.last_name);
  participant_name := participant_full_name;

  -- Známý workshop: buď v pevné mapě triků, nebo produkt typu Workshop v DB.
  select p.title into db_product_title
  from public.products p
  where p.id = product_key and p.type = 'Workshop';

  trick_ids := case product_key
    when 'workshop-praha-balkan' then array['tic-tac', 'kong-vault']
    else null
  end;

  if trick_ids is null then
    if db_product_title is null then
      status := 'not-found'; return next; return;
    end if;
    trick_ids := array['safety-roll', 'safety-vault'];
  end if;

  product_title := coalesce(
    db_product_title,
    nullif(left(trim(coalesce(p_product_title, '')), 160), ''),
    'Workshop'
  );

  -- QR platí 60 s; tolerance na rozdíl hodin telefonu trenéra a serveru.
  if p_ts is null then
    status := 'expired'; return next; return;
  end if;
  scanned_at := to_timestamp(p_ts / 1000.0);
  if scanned_at < now() - interval '120 seconds' or scanned_at > now() + interval '120 seconds' then
    status := 'expired'; return next; return;
  end if;

  select * into existing_record
  from public.workshop_xp_awards a
  where a.participant_id = participant_record.id and a.product_id = product_key;
  if found then
    status := 'already-claimed';
    xp := existing_record.xp_awarded;
    tricks_completed := existing_record.tricks_completed;
    return next; return;
  end if;

  -- Svěřenec trenéra (volitelně) — stejné párování jako teamvys_claim_qr_trick.
  select * into ward_record
  from public.coach_wards w
  where w.participant_id = participant_record.id
     or (w.name = participant_full_name and w.org_id = participant_record.org_id)
  order by case when w.participant_id = participant_record.id then 0 else 1 end
  limit 1;

  select count(distinct a.trick_id) into completed_count
  from public.coach_manual_trick_awards a
  where a.trick_id = any (trick_ids)
    and (
      a.participant_id = participant_record.id
      or (ward_record.id is not null and a.ward_id = ward_record.id)
    );

  if coalesce(completed_count, 0) = 0 then
    status := 'not-unlocked'; return next; return;
  end if;

  select coalesce(sum(t.xp), 0) into total_xp
  from public.coach_tricks t
  where t.id = any (trick_ids);

  awarded_xp := case
    when completed_count >= total_tricks then total_xp
    else ceil(total_xp / total_tricks::numeric)::integer
  end;

  resolved_coach_id := nullif(trim(coalesce(p_coach_id, '')), '');
  if resolved_coach_id is not null and not public.teamvys_is_approved_coach(resolved_coach_id) then
    resolved_coach_id := null;
  end if;

  begin
    insert into public.workshop_xp_awards
      (id, participant_id, participant_name, product_id, product_title,
       tricks_completed, xp_awarded, coach_id, awarded_at_text, org_id)
    values (
      'ws-award-' || participant_record.id || '-' || product_key,
      participant_record.id,
      participant_full_name,
      product_key,
      product_title,
      completed_count,
      awarded_xp,
      resolved_coach_id,
      to_char(now() at time zone 'Europe/Prague', 'FMDD. FMMM. YYYY HH24:MI'),
      participant_record.org_id
    );
  exception when unique_violation then
    status := 'already-claimed';
    xp := awarded_xp;
    tricks_completed := completed_count;
    return next; return;
  end;

  status := 'claimed';
  xp := awarded_xp;
  tricks_completed := completed_count;
  return next;
end;
$$;

revoke all on function public.teamvys_claim_workshop_xp(text, text, bigint, text, text) from public, anon;
grant execute on function public.teamvys_claim_workshop_xp(text, text, bigint, text, text) to authenticated, service_role;
