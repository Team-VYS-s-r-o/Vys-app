-- Faktury nahrané trenérem/koordinátorem v aplikaci čekají na kartě dotyčného
-- v adminu a do sekce Faktury se dostanou až akcí "Přesunout do Faktur"
-- (prijato=true). Admin/e-mailové faktury jsou přijaté rovnou.
--
-- Idempotent.

alter table public.invoices
  add column if not exists prijato boolean not null default true;

-- Trenérská samofakturace: nové faktury čekají na přijetí adminem.
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
    file_url, kategorie, zaplaceno, coach_id, zdroj, org_id, prijato
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
    v_org_id,
    false
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.teamvys_submit_coach_invoice(text, numeric, text, text, text, text, text) to authenticated;
