-- Fronta SMS pro leady z reklam (Meta formuláře). Leady nejsou v DB — žijí
-- v Google Tabulkách — takže je sem zapisuje marketingový autopilot (service
-- přístup přes SQL) a server je odešle přes BulkGate (`POST /api/lead-sms/flush`).
-- `dedupe_key` (telefon|město) hlídá, že stejné číslo nedostane návod dvakrát.
create table if not exists public.lead_sms_outbox (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default '00000000-0000-4000-8000-000000000001',
  phone text not null,
  body text not null,
  city text,
  source text not null default 'meta-lead',
  dedupe_key text not null unique,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed')),
  provider_response text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists lead_sms_outbox_status_idx on public.lead_sms_outbox (status, created_at);

-- Jen server (service role). Žádné policies = klient nečte ani nezapisuje.
alter table public.lead_sms_outbox enable row level security;
