create table if not exists public.coach_tax_declarations (
  id uuid primary key default gen_random_uuid(),
  coach_id text not null,
  year integer not null,
  signed_path text,
  signed_filename text,
  signed_uploaded_at timestamptz,
  org_id uuid not null default '00000000-0000-4000-8000-000000000001',
  created_at timestamptz not null default now(),
  unique (coach_id, year)
);
alter table public.coach_tax_declarations enable row level security;
drop policy if exists "coach_tax_declarations scoped access" on public.coach_tax_declarations;
create policy "coach_tax_declarations scoped access" on public.coach_tax_declarations
  for all
  using ((((coach_id = (auth.uid())::text) and teamvys_is_approved_coach((auth.uid())::text)) or (teamvys_app_role() = 'admin'::text)) and teamvys_org_match(org_id))
  with check ((((coach_id = (auth.uid())::text) and teamvys_is_approved_coach((auth.uid())::text)) or (teamvys_app_role() = 'admin'::text)) and teamvys_org_match(org_id));

-- Nahrane prohlaseni automaticky prepne priznak u trenera -> vyplata bez srazky.
create or replace function public.teamvys_tax_declaration_uploaded()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.signed_path is not null then
    update public.coach_profiles set tax_declaration_signed = true where id = new.coach_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_tax_declaration_uploaded on public.coach_tax_declarations;
create trigger trg_tax_declaration_uploaded
  after insert or update of signed_path on public.coach_tax_declarations
  for each row execute function public.teamvys_tax_declaration_uploaded();
select 'ok' as stav;
