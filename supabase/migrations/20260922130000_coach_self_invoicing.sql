-- Coach self-invoicing → admin "Faktury" + payout comparison.
--
-- Coaches who invoice manually flag themselves in their profile and upload their
-- invoices directly in the mobile app. Each invoice lands in the SAME org-scoped
-- `invoices` table the admin "Faktury" section already reads, tagged with
-- coach_id + zdroj='coach', so the admin can compare the invoiced amount against
-- the coach's real attendance hours before paying, and mark it paid like any
-- other invoice.
--
-- Multi-tenant: the invoice's org_id is derived SERVER-SIDE from the coach's own
-- profile (never trusted from the client), so invoices can never leak across orgs.
--
-- Idempotent.

-- 1. Coach flags whether they invoice manually. Coaches may update their own
--    coach_profiles row (existing "coach_profiles own update" RLS policy).
alter table public.coach_profiles
  add column if not exists invoices_manually boolean not null default false;

-- 2. Link invoices to a coach + record their origin.
alter table public.invoices
  add column if not exists coach_id text,
  add column if not exists zdroj    text not null default 'email';  -- 'email' | 'admin' | 'coach'

create index if not exists invoices_coach_id_idx on public.invoices (coach_id);
create index if not exists invoices_org_id_idx   on public.invoices (org_id);

-- 3. Tighten invoices RLS (previously any authenticated user could read/update
--    ALL invoices). A coach now reads only their OWN invoices; only admins may
--    update via the client. The backend uses the service role and is unaffected.
drop policy if exists "authenticated read" on public.invoices;
create policy "invoices coach or admin read" on public.invoices
  for select to authenticated
  using (coach_id = auth.uid()::text or public.teamvys_app_role() = 'admin');

drop policy if exists "authenticated update" on public.invoices;
create policy "invoices admin update" on public.invoices
  for update to authenticated
  using (public.teamvys_app_role() = 'admin')
  with check (public.teamvys_app_role() = 'admin');

-- 4. Coach invoice submission RPC. SECURITY DEFINER so org_id is derived from the
--    coach's own profile and coach_id is pinned to the caller. Only an APPROVED
--    coach may submit.
create or replace function public.teamvys_submit_coach_invoice(
  p_supplier       text,
  p_amount         numeric,
  p_invoice_number text default null,
  p_description    text default null,
  p_issued_date    text default null,
  p_file_url       text default null,
  p_category       text default null
)
returns public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id text := auth.uid()::text;
  v_org_id uuid;
  v_row public.invoices;
begin
  if v_coach_id is null or not public.teamvys_is_approved_coach(v_coach_id) then
    raise exception 'Only an approved coach can submit an invoice.' using errcode = '42501';
  end if;
  if coalesce(round(p_amount), 0) <= 0 then
    raise exception 'Invoice amount must be greater than 0.' using errcode = '22023';
  end if;

  select org_id into v_org_id from public.coach_profiles where id = v_coach_id;

  insert into public.invoices (
    dodavatel, castka, mena, datum_vystaveni, cislo_faktury, popis,
    file_url, kategorie, zaplaceno, coach_id, zdroj, org_id
  ) values (
    nullif(trim(coalesce(p_supplier, '')), ''),
    (round(p_amount))::text,
    'CZK',
    nullif(trim(coalesce(p_issued_date, '')), ''),
    nullif(trim(coalesce(p_invoice_number, '')), ''),
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_file_url, '')), ''),
    nullif(trim(coalesce(p_category, '')), ''),
    false,
    v_coach_id,
    'coach',
    v_org_id
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.teamvys_submit_coach_invoice(text, numeric, text, text, text, text, text) to authenticated;

-- 5. Storage: let approved staff upload invoice files to the invoices bucket
--    under a per-coach folder (coach/<uid>/...). Reads already allowed by the
--    existing "authenticated storage read" policy on the invoices bucket.
drop policy if exists "coach upload invoices storage" on storage.objects;
create policy "coach upload invoices storage" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] = 'coach'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.teamvys_is_staff()
  );
