-- První lekce zdarma: každý účastník ji má v profilu PRÁVĚ JEDNOU.
-- Aktivací vznikne QR kód (TRIAL-…), trenér ho načte a potvrdí příchod
-- (status active → used, atomicky — kód projde jen jednou). Seznam
-- „přišli na zkoušku a nezaplatili" se počítá živě proti parent_purchases,
-- takže po zaplacení dítě ze seznamu zmizí samo a historie zůstane.
create table if not exists public.free_lesson_claims (
  id uuid primary key default gen_random_uuid(),
  participant_id text not null unique,
  org_id uuid not null,
  code text not null unique,
  status text not null default 'active' check (status in ('active','used')),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_location text,
  used_by_coach_id text
);

create index if not exists free_lesson_claims_org_idx on public.free_lesson_claims (org_id, status);

alter table public.free_lesson_claims enable row level security;
-- Čtení/zápis řeší výhradně server (service role) — klientům tabulku nevystavujeme.
