-- Supabase schema for TeamVYS app prototype.
-- Run this in Supabase SQL editor, then set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
-- Auth is intentionally demo-mode friendly. Policies are open for the prototype and must be tightened before production.

create table if not exists public.app_profiles (
  id text primary key,
  role text not null check (role in ('participant', 'parent', 'coach', 'admin')),
  name text not null,
  email text,
  phone text,
  address text,
  bio text,
  created_at timestamptz not null default now()
);

do $$
begin
  alter table public.app_profiles drop constraint if exists app_profiles_role_check;
  alter table public.app_profiles add constraint app_profiles_role_check check (role in ('participant', 'parent', 'coach', 'admin'));
end $$;

create table if not exists public.participants (
  id text primary key,
  parent_profile_id text references public.app_profiles(id) on delete set null,
  first_name text not null,
  last_name text not null,
  birth_number_masked text,
  level integer not null default 1,
  bracelet text,
  bracelet_color text,
  xp integer not null default 0,
  next_bracelet_xp integer not null default 0,
  attendance_done integer not null default 0,
  attendance_total integer not null default 0,
  date_of_birth text,
  school_year text,
  parent_name text,
  parent_phone text,
  emergency_phone text,
  address text,
  departure_mode text not null default 'parent' check (departure_mode in ('parent', 'alone', 'authorized')),
  authorized_people text,
  allergies text,
  health_limits text,
  medication_note text,
  coach_note text,
  without_phone boolean not null default false,
  active_course text,
  next_training text,
  paid_status text not null default 'paid' check (paid_status in ('paid', 'due', 'overdue')),
  active_purchases jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.participants add column if not exists date_of_birth text;
alter table public.participants add column if not exists school_year text;
alter table public.participants add column if not exists parent_name text;
alter table public.participants add column if not exists parent_phone text;
alter table public.participants add column if not exists emergency_phone text;
alter table public.participants add column if not exists address text;
alter table public.participants add column if not exists departure_mode text not null default 'parent';
alter table public.participants add column if not exists authorized_people text;
alter table public.participants add column if not exists allergies text;
alter table public.participants add column if not exists health_limits text;
alter table public.participants add column if not exists medication_note text;
alter table public.participants add column if not exists coach_note text;
alter table public.participants add column if not exists without_phone boolean not null default false;
alter table public.participants add column if not exists claim_code text unique;
alter table public.participants add column if not exists coins integer not null default 0;
alter table public.participants add column if not exists converted_attendance integer not null default 0;
alter table public.participants add column if not exists owned_mascots jsonb not null default '[]'::jsonb;

do $$
begin
  alter table public.participants drop constraint if exists participants_departure_mode_check;
  alter table public.participants add constraint participants_departure_mode_check check (departure_mode in ('parent', 'alone', 'authorized'));
end $$;

create table if not exists public.products (
  id text primary key,
  type text not null check (type in ('Kroužek', 'Tábor', 'Workshop')),
  title text not null,
  city text not null,
  place text not null,
  venue text not null,
  price integer not null,
  price_label text not null,
  original_price integer,
  entries_total integer,
  primary_meta text not null,
  secondary_meta text not null,
  description text not null,
  important_info jsonb not null default '[]'::jsonb,
  capacity_total integer,
  capacity_current integer not null default 0,
  hero_image text,
  gallery jsonb not null default '[]'::jsonb,
  coach_ids text[] not null default '{}',
  training_focus text[] not null default '{}',
  is_published boolean not null default true,
  badge text not null,
  event_date text,
  expires_at text,
  created_at timestamptz not null default now()
);

alter table public.products add column if not exists capacity_total integer;
alter table public.products add column if not exists capacity_current integer not null default 0;
alter table public.products add column if not exists hero_image text;
alter table public.products add column if not exists gallery jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists coach_ids text[] not null default '{}';
alter table public.products add column if not exists training_focus text[] not null default '{}';
alter table public.products add column if not exists is_published boolean not null default true;

create table if not exists public.product_faqs (
  id text primary key,
  question text not null,
  answer text not null,
  categories text[] not null default '{}',
  sort_order integer not null default 0
);

create table if not exists public.parent_payments (
  id text primary key,
  participant_id text references public.participants(id) on delete set null,
  participant_name text not null,
  title text not null,
  amount integer not null,
  due_date text not null,
  status text not null check (status in ('paid', 'due', 'overdue')),
  stripe_ready boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.parent_purchases (
  id text primary key,
  parent_profile_id text references public.app_profiles(id) on delete set null,
  product_id text not null,
  participant_id text not null,
  participant_name text not null,
  type text not null check (type in ('Kroužek', 'Tábor', 'Workshop')),
  title text not null,
  amount integer not null,
  original_amount integer,
  discount_code text,
  discount_percent integer,
  discount_amount integer not null default 0,
  price_label text not null,
  place text not null,
  status text not null default 'Zaplaceno',
  paid_at text not null,
  event_date text,
  expires_at text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

alter table public.parent_purchases add column if not exists parent_profile_id text references public.app_profiles(id) on delete set null;
alter table public.parent_purchases add column if not exists original_amount integer;
alter table public.parent_purchases add column if not exists discount_code text;
alter table public.parent_purchases add column if not exists discount_percent integer;
alter table public.parent_purchases add column if not exists discount_amount integer not null default 0;
alter table public.parent_purchases add column if not exists stripe_checkout_session_id text;
alter table public.parent_purchases add column if not exists stripe_payment_intent_id text;
create unique index if not exists parent_purchases_stripe_checkout_session_id_key on public.parent_purchases (stripe_checkout_session_id) where stripe_checkout_session_id is not null;
create unique index if not exists parent_purchases_stripe_payment_intent_id_key on public.parent_purchases (stripe_payment_intent_id) where stripe_payment_intent_id is not null;

create table if not exists public.workshop_interests (
  id text primary key,
  parent_profile_id text references public.app_profiles(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  participant_id text not null references public.participants(id) on delete cascade,
  participant_name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists workshop_interests_product_participant_key
  on public.workshop_interests (product_id, participant_id);

create table if not exists public.workshop_xp_awards (
  id text primary key,
  participant_id text not null,
  participant_name text not null,
  product_id text not null,
  product_title text not null,
  tricks_completed integer not null,
  xp_awarded integer not null,
  coach_id text,
  awarded_at_text text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists workshop_xp_awards_participant_product
  on public.workshop_xp_awards (participant_id, product_id);

create table if not exists public.course_documents (
  id text primary key,
  participant_id text not null references public.participants(id) on delete cascade,
  participant_name text not null,
  purchase_id text not null,
  product_id text not null,
  activity_type text not null default 'Kroužek' check (activity_type in ('Kroužek', 'Tábor', 'Workshop')),
  kind text not null check (kind in ('gdpr', 'guardian-consent', 'health', 'departure', 'infection-free', 'packing', 'workshop-terms')),
  title text not null,
  status text not null check (status in ('draft', 'signed')),
  parent_name text not null,
  course_place text not null,
  payload jsonb not null default '{}'::jsonb,
  signed_at_text text,
  updated_at_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.course_documents add column if not exists activity_type text not null default 'Kroužek';

do $$
begin
  alter table public.course_documents drop constraint if exists course_documents_activity_type_check;
  alter table public.course_documents add constraint course_documents_activity_type_check check (activity_type in ('Kroužek', 'Tábor', 'Workshop'));
  alter table public.course_documents drop constraint if exists course_documents_kind_check;
  alter table public.course_documents add constraint course_documents_kind_check check (kind in ('gdpr', 'guardian-consent', 'health', 'departure', 'infection-free', 'packing', 'workshop-terms', 'custom'));
end $$;

-- Organization-defined document slots (see migration 20260707170000_document_slots.sql).
create table if not exists public.document_slots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  activity_type text not null check (activity_type in ('Kroužek', 'Tábor', 'Workshop')),
  label text not null,
  description text,
  fulfillment text not null default 'both' check (fulfillment in ('electronic', 'upload', 'both')),
  template_kind text,
  product_id text references public.products(id) on delete cascade,
  template_path text,
  template_filename text,
  required boolean not null default true,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.course_documents add column if not exists slot_id uuid references public.document_slots(id) on delete set null;

-- Reusable document template library (see migration 20260707190000_document_templates.sql
-- and 20260707200000_document_templates_electronic.sql).
-- kind = 'file' -> uploaded blank form; kind = 'electronic' -> custom form in body jsonb.
create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  kind text not null default 'file' check (kind in ('file', 'electronic')),
  file_path text,
  file_filename text,
  body jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Weekly trick voting (see migration 20260707210000_trick_votes.sql).
create table if not exists public.trick_votes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  voter_profile_id text not null references public.app_profiles(id) on delete cascade,
  participant_id text references public.participants(id) on delete cascade,
  trick_name text not null,
  week_start date not null,
  created_at timestamptz not null default now()
);

-- Library documents attached to a coach (see migration 20260707220000_coach_documents.sql).
create table if not exists public.coach_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  coach_id text not null references public.app_profiles(id) on delete cascade,
  template_id uuid not null references public.document_templates(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (coach_id, template_id)
);

alter table public.document_slots add column if not exists template_id uuid references public.document_templates(id) on delete set null;

create or replace view public.camp_medical_overview as
select
  id,
  participant_id,
  participant_name,
  purchase_id,
  product_id,
  course_place as camp_place,
  payload ->> 'allergies' as allergies,
  payload ->> 'healthLimits' as health_limits,
  payload ->> 'medication' as medication,
  payload ->> 'insuranceCompany' as insurance_company,
  payload ->> 'emergencyPhone' as emergency_phone,
  signed_at_text,
  updated_at_text
from public.course_documents
where activity_type = 'Tábor' and kind = 'health' and status = 'signed';

create table if not exists public.digital_passes (
  id text primary key,
  participant_id text not null references public.participants(id) on delete cascade,
  holder_name text not null,
  title text not null,
  location text not null,
  nfc_chip_id text not null,
  total_entries integer not null,
  used_entries integer not null default 0,
  last_scan_at text,
  last_scan_place text,
  created_at timestamptz not null default now()
);

create table if not exists public.parent_notifications (
  id text primary key,
  participant_name text not null,
  location text not null,
  method text not null check (method in ('NFC', 'Ručně')),
  text text not null,
  created_at_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_profiles (
  id text primary key references public.app_profiles(id) on delete cascade,
  level integer not null default 1,
  xp integer not null default 0,
  next_level_xp integer not null default 0,
  qr_tricks_approved integer not null default 0,
  attendance_logged integer not null default 0,
  bonus_total integer not null default 0,
  current_location text,
  assigned_courses text[] not null default '{}',
  profile_photo_url text,
  stripe_account_id text
);

alter table public.coach_profiles add column if not exists profile_photo_url text;
alter table public.coach_profiles add column if not exists stripe_account_id text;

create table if not exists public.coach_sessions (
  id text primary key,
  coach_id text not null references public.coach_profiles(id) on delete cascade,
  city text not null,
  venue text not null,
  day text not null,
  time text not null,
  group_name text not null,
  enrolled integer not null default 0,
  present integer not null default 0,
  duration_hours numeric not null default 1,
  hourly_rate integer not null default 500,
  latitude numeric,
  longitude numeric,
  check_in_radius_meters integer not null default 300
);

alter table public.coach_sessions add column if not exists latitude numeric;
alter table public.coach_sessions add column if not exists longitude numeric;
alter table public.coach_sessions add column if not exists check_in_radius_meters integer not null default 300;

create table if not exists public.coach_wards (
  id text primary key,
  name text not null,
  parent_name text,
  locations text[] not null default '{}',
  activity_type text not null check (activity_type in ('krouzek', 'tabor', 'workshop')),
  parent_phone text,
  emergency_phone text,
  birth_year integer,
  school_year text,
  coach_note text,
  departure_mode text not null default 'parent' check (departure_mode in ('parent', 'alone', 'authorized')),
  departure_signed boolean not null default false,
  departure_signed_at_text text,
  authorized_people text,
  departure_note text,
  allergies text,
  health_limits text,
  medication_note text,
  completed_trick_ids jsonb not null default '[]'::jsonb,
  level integer not null default 1,
  bracelet text,
  bracelet_color text,
  payment_status text not null check (payment_status in ('Zaplaceno', 'Čeká na platbu')),
  physical_bracelet_received boolean not null default false,
  has_nfc_chip boolean not null default false,
  pass_title text,
  entries_left integer not null default 0,
  last_attendance text
);

alter table public.coach_wards add column if not exists parent_name text;
alter table public.coach_wards add column if not exists emergency_phone text;
alter table public.coach_wards add column if not exists birth_year integer;
alter table public.coach_wards add column if not exists school_year text;
alter table public.coach_wards add column if not exists coach_note text;
alter table public.coach_wards add column if not exists departure_mode text not null default 'parent';
alter table public.coach_wards add column if not exists departure_signed boolean not null default false;
alter table public.coach_wards add column if not exists departure_signed_at_text text;
alter table public.coach_wards add column if not exists authorized_people text;
alter table public.coach_wards add column if not exists departure_note text;
alter table public.coach_wards add column if not exists allergies text;
alter table public.coach_wards add column if not exists health_limits text;
alter table public.coach_wards add column if not exists medication_note text;
alter table public.coach_wards add column if not exists completed_trick_ids jsonb not null default '[]'::jsonb;

do $$
begin
  alter table public.coach_wards drop constraint if exists coach_wards_departure_mode_check;
  alter table public.coach_wards add constraint coach_wards_departure_mode_check check (departure_mode in ('parent', 'alone', 'authorized'));
end $$;

create table if not exists public.nfc_chip_assignments (
  chip_id text primary key,
  ward_id text not null references public.coach_wards(id) on delete cascade,
  participant_name text not null,
  location text not null,
  assigned_at_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bracelet_confirmations (
  ward_id text primary key references public.coach_wards(id) on delete cascade,
  confirmed_at timestamptz not null default now()
);

create table if not exists public.coach_attendance_records (
  id text primary key,
  coach_id text not null references public.coach_profiles(id) on delete cascade,
  session_id text references public.coach_sessions(id) on delete set null,
  date_text text not null,
  place text not null,
  status text not null default 'Zapsáno',
  present text,
  duration_hours numeric not null default 1,
  hourly_rate integer not null default 500,
  amount integer not null default 500,
  created_at timestamptz not null default now()
);

create or replace function public.teamvys_coach_session_is_workshop(p_session_id text, p_group_name text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_session_id, '') like 'coach-workshop-%'
    or coalesce(p_group_name, '') like 'Workshop:%';
$$;

create or replace function public.teamvys_resolve_coach_attendance_rate(
  p_session_id text,
  p_coach_id text,
  p_default_rate integer default 500
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session public.coach_sessions%rowtype;
  assigned_count integer := 0;
  is_assigned boolean := false;
  normal_rate integer := coalesce(p_default_rate, 500);
begin
  select *
  into target_session
  from public.coach_sessions
  where id = p_session_id;

  if not found then
    return normal_rate;
  end if;

  normal_rate := coalesce(target_session.hourly_rate, normal_rate, 500);

  if public.teamvys_coach_session_is_workshop(target_session.id, target_session.group_name) then
    return normal_rate;
  end if;

  select count(distinct coach_id), bool_or(coach_id = p_coach_id)
  into assigned_count, is_assigned
  from public.coach_sessions
  where city = target_session.city
    and venue = target_session.venue
    and day = target_session.day
    and time = target_session.time
    and coalesce(coach_id, '') <> ''
    and not public.teamvys_coach_session_is_workshop(id, group_name);

  if assigned_count = 1 and coalesce(is_assigned, false) then
    return 750;
  end if;

  return 500;
end;
$$;

create or replace function public.teamvys_apply_coach_attendance_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.duration_hours := coalesce(nullif(new.duration_hours, 0), 1);
  new.hourly_rate := public.teamvys_resolve_coach_attendance_rate(new.session_id, new.coach_id, coalesce(new.hourly_rate, 500));
  new.amount := round(new.duration_hours * new.hourly_rate)::integer;
  return new;
end;
$$;

drop trigger if exists trg_teamvys_apply_coach_attendance_rate on public.coach_attendance_records;
create trigger trg_teamvys_apply_coach_attendance_rate
before insert or update of coach_id, session_id, duration_hours, hourly_rate on public.coach_attendance_records
for each row
execute function public.teamvys_apply_coach_attendance_rate();

create table if not exists public.child_attendance_records (
  id text primary key,
  session_id text references public.coach_sessions(id) on delete set null,
  date_text text not null,
  location text not null,
  attendees jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_tricks (
  id text primary key,
  title text not null,
  bracelet text not null,
  xp integer not null,
  category text not null,
  level integer not null default 1,
  level_title text not null default 'Základy',
  discipline text not null default 'Parkour',
  description text not null default '',
  sort_order integer not null default 0
);

alter table public.coach_tricks add column if not exists level integer not null default 1;
alter table public.coach_tricks add column if not exists level_title text not null default 'Základy';
alter table public.coach_tricks add column if not exists discipline text not null default 'Parkour';
alter table public.coach_tricks add column if not exists description text not null default '';
alter table public.coach_tricks add column if not exists sort_order integer not null default 0;

create table if not exists public.qr_events (
  id text primary key,
  coach_id text references public.coach_profiles(id) on delete set null,
  trick_id text references public.coach_tricks(id) on delete set null,
  generated_at_text text not null,
  valid_until_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_manual_trick_awards (
  id text primary key,
  ward_id text references public.coach_wards(id) on delete cascade,
  participant_name text not null,
  trick_id text not null,
  trick_title text not null,
  coach_id text not null references public.coach_profiles(id) on delete cascade,
  awarded_at_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_leaderboard (
  id text primary key,
  rank integer not null,
  name text not null,
  xp integer not null,
  qr integer not null,
  bonus text not null
);

create table if not exists public.coach_reward_path (
  id text primary key,
  xp integer not null,
  title text not null,
  reward text not null,
  unlocked boolean not null default false
);

create table if not exists public.coach_payouts (
  id text primary key,
  coach_id text not null references public.coach_profiles(id) on delete cascade,
  hourly_rate integer not null default 500,
  logged_hours numeric not null default 0,
  base_amount integer not null default 0,
  approved_bonuses integer not null default 0,
  pending_bonuses integer not null default 0,
  next_payout text not null,
  status text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_reviews (
  id text primary key,
  coach_id text not null,
  coach_name text not null,
  parent_id text not null,
  parent_name text not null,
  participant_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  created_at_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_coach_access_keys (
  id text primary key,
  code text not null unique,
  coach_name text not null,
  email text not null,
  phone text,
  location text not null,
  status text not null check (status in ('Vydán', 'Použitý', 'Zamítnutý')),
  note text not null default '',
  created_at_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_attendance_adjustments (
  id text primary key,
  coach_id text not null,
  coach_name text not null,
  session_id text,
  session_title text not null,
  date_text text not null,
  present text not null,
  duration_hours numeric not null default 1,
  hourly_rate integer not null default 500,
  amount integer not null default 500,
  reason text not null,
  created_at_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_product_drafts (
  id text primary key,
  type text not null check (type in ('Kroužek', 'Tábor', 'Workshop')),
  title text not null,
  place text not null,
  price integer not null default 0,
  capacity_total integer not null default 0,
  primary_meta text not null,
  status text not null check (status in ('Koncept', 'Připraveno k publikaci')),
  payload jsonb not null default '{}'::jsonb,
  created_at_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_coach_payout_transfers (
  id text primary key,
  coach_id text not null,
  coach_name text not null,
  period_key text not null,
  period_start date not null,
  period_end date not null,
  amount integer not null check (amount > 0),
  currency text not null default 'czk' check (currency in ('czk')),
  status text not null default 'paid' check (status in ('paid', 'pending', 'failed')),
  mode text not null default 'connect_transfer' check (mode in ('connect_transfer')),
  stripe_account_id text not null,
  stripe_transfer_id text,
  stripe_payout_id text,
  created_at_text text not null,
  available_from date not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'admin_coach_payout_transfers_unique_month'
  ) then
    alter table public.admin_coach_payout_transfers
      add constraint admin_coach_payout_transfers_unique_month unique (coach_id, period_key);
  end if;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'app_profiles', 'participants', 'products', 'product_faqs', 'parent_payments', 'parent_purchases',
    'workshop_interests', 'workshop_xp_awards', 'course_documents', 'digital_passes', 'parent_notifications', 'coach_profiles', 'coach_sessions', 'coach_wards',
    'nfc_chip_assignments', 'bracelet_confirmations', 'coach_attendance_records', 'child_attendance_records',
    'coach_tricks', 'qr_events', 'coach_manual_trick_awards', 'coach_leaderboard', 'coach_reward_path', 'coach_payouts',
    'coach_reviews', 'admin_coach_access_keys', 'admin_attendance_adjustments', 'admin_product_drafts',
    'admin_coach_payout_transfers'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = table_name and policyname = table_name || ' prototype all'
    ) then
      execute format('create policy %I on public.%I for all using (true) with check (true)', table_name || ' prototype all', table_name);
    end if;
  end loop;
end $$;

insert into public.app_profiles (id, role, name, email, phone, address, bio) values
  ('parent-demo', 'parent', 'David Kropáč', 'rodic@example.cz', '+420 605 324 417', null, null),
  ('participant-demo', 'participant', 'Eliška Nováková', null, null, null, null),
  ('coach-demo', 'coach', 'Filip Trenér', 'trener@teamvys.cz', '+420 777 221 904', 'Vyškov, Brněnská 12', 'Hlavní trenér pro Vyškov a Prostějov. Zaměřuje se na bezpečný postup, techniku dopadů a motivaci dětí přes QR progres.'),
  ('admin-demo', 'admin', 'TeamVYS Admin', 'admin@teamvys.cz', '+420 605 324 417', null, 'Administrátor provozu, výplat, produktů, dokumentů a trenérských přístupů.')
on conflict (id) do update set role = excluded.role, name = excluded.name, email = excluded.email, phone = excluded.phone, address = excluded.address, bio = excluded.bio;

insert into public.participants (id, parent_profile_id, first_name, last_name, birth_number_masked, level, bracelet, bracelet_color, xp, next_bracelet_xp, attendance_done, attendance_total, active_course, next_training, paid_status, active_purchases) values
  ('demo-child-1', 'parent-demo', 'Eliška', 'Nováková', '******/1234', 7, 'Růžová', '#F5A7C8', 920, 1400, 14, 16, 'Vyškov · ZŠ Nádražní', 'Středa 16:30', 'paid', '[{"type":"Kroužek","title":"Permanentka 10 vstupů · Vyškov","status":"Aktivní"},{"type":"Tábor","title":"Letní tábor Vyškov","status":"Rezervováno"},{"type":"Workshop","title":"Workshop se odemkne po přihlášení","status":"Zatím nezakoupeno"}]'::jsonb),
  ('demo-child-2', 'parent-demo', 'Alex', 'Svoboda', '******/7788', 4, 'Béžová', '#D8C2A3', 570, 600, 7, 10, 'Prostějov · ZŠ Melantrichova', 'Sobota 10:00', 'paid', '[]'::jsonb)
on conflict (id) do update set parent_profile_id = excluded.parent_profile_id, first_name = excluded.first_name, last_name = excluded.last_name, birth_number_masked = excluded.birth_number_masked, level = excluded.level, bracelet = excluded.bracelet, bracelet_color = excluded.bracelet_color, xp = excluded.xp, next_bracelet_xp = excluded.next_bracelet_xp, attendance_done = excluded.attendance_done, attendance_total = excluded.attendance_total, active_course = excluded.active_course, next_training = excluded.next_training, paid_status = excluded.paid_status, active_purchases = excluded.active_purchases;

delete from public.products where id in ('workshop-parkour-intro', 'workshop-flow-session');

insert into public.products (id, type, title, city, place, venue, price, price_label, original_price, entries_total, primary_meta, secondary_meta, description, important_info, badge, event_date, expires_at) values
  ('course-blansko-erbenova', 'Kroužek', 'Kroužek Blansko', 'Blansko', 'Blansko · ZŠ Erbenova', 'ZŠ Erbenova', 1790, '10 vstupů · 1790 Kč', null, 10, 'Úterý 17:30 - 18:30', 'Digitální permanentka přes NFC čip', 'Permanentka na 10 vstupů do parkour tréninku.', '[{"label":"Platí pouze pro lokaci","value":"Blansko · ZŠ Erbenova"},{"label":"Odečítání","value":"10 vstupů se odečítá přes NFC čip při příchodu na trénink."}]'::jsonb, 'Kroužek', null, null),
  ('course-blansko-erbenova-15', 'Kroužek', 'Kroužek Blansko', 'Blansko', 'Blansko · ZŠ Erbenova', 'ZŠ Erbenova', 2590, '15 vstupů · 2590 Kč', 2685, 15, 'Úterý 17:30 - 18:30', 'Výhodnější digitální permanentka přes NFC čip', 'Permanentka na 15 vstupů do parkour tréninku.', '[{"label":"Platí pouze pro lokaci","value":"Blansko · ZŠ Erbenova"},{"label":"Odečítání","value":"15 vstupů se odečítá přes NFC čip při příchodu na trénink."}]'::jsonb, 'Kroužek', null, null),
  ('course-brandys-vysluni', 'Kroužek', 'Kroužek Brandýs', 'Brandýs', 'Brandýs · ZŠ Na Výsluní', 'ZŠ Na Výsluní', 1790, '10 vstupů · 1790 Kč', null, 10, 'Úterý / Čtvrtek 17:00 - 18:00', 'Digitální permanentka přes NFC čip', 'Permanentka na 10 vstupů do parkour tréninku.', '[{"label":"Platí pouze pro lokaci","value":"Brandýs · ZŠ Na Výsluní"}]'::jsonb, 'Kroužek', null, null),
  ('course-brandys-vysluni-15', 'Kroužek', 'Kroužek Brandýs', 'Brandýs', 'Brandýs · ZŠ Na Výsluní', 'ZŠ Na Výsluní', 2590, '15 vstupů · 2590 Kč', 2685, 15, 'Úterý / Čtvrtek 17:00 - 18:00', 'Výhodnější digitální permanentka přes NFC čip', 'Permanentka na 15 vstupů do parkour tréninku.', '[{"label":"Platí pouze pro lokaci","value":"Brandýs · ZŠ Na Výsluní"}]'::jsonb, 'Kroužek', null, null),
  ('course-jesenik-komenskeho', 'Kroužek', 'Kroužek Jeseník', 'Jeseník', 'Jeseník · Gymnázium Komenského', 'Gymnázium Komenského', 1790, '10 vstupů · 1790 Kč', null, 10, 'Pátek 18:00 - 19:00', 'Digitální permanentka přes NFC čip', 'Permanentka na 10 vstupů do parkour tréninku.', '[{"label":"Platí pouze pro lokaci","value":"Jeseník · Gymnázium Komenského"}]'::jsonb, 'Kroužek', null, null),
  ('course-jesenik-komenskeho-15', 'Kroužek', 'Kroužek Jeseník', 'Jeseník', 'Jeseník · Gymnázium Komenského', 'Gymnázium Komenského', 2590, '15 vstupů · 2590 Kč', 2685, 15, 'Pátek 18:00 - 19:00', 'Výhodnější digitální permanentka přes NFC čip', 'Permanentka na 15 vstupů do parkour tréninku.', '[{"label":"Platí pouze pro lokaci","value":"Jeseník · Gymnázium Komenského"}]'::jsonb, 'Kroužek', null, null),
  ('course-prostejov-melantrichova', 'Kroužek', 'Kroužek Prostějov', 'Prostějov', 'Prostějov · ZŠ Melantrichova', 'ZŠ Melantrichova', 1790, '10 vstupů · 1790 Kč', null, 10, 'Sobota 10:00 - 11:00', 'Digitální permanentka přes NFC čip', 'Permanentka na 10 vstupů do parkour tréninku.', '[{"label":"Platí pouze pro lokaci","value":"Prostějov · ZŠ Melantrichova"}]'::jsonb, 'Kroužek', null, null),
  ('course-prostejov-melantrichova-15', 'Kroužek', 'Kroužek Prostějov', 'Prostějov', 'Prostějov · ZŠ Melantrichova', 'ZŠ Melantrichova', 2590, '15 vstupů · 2590 Kč', 2685, 15, 'Sobota 10:00 - 11:00', 'Výhodnější digitální permanentka přes NFC čip', 'Permanentka na 15 vstupů do parkour tréninku.', '[{"label":"Platí pouze pro lokaci","value":"Prostějov · ZŠ Melantrichova"}]'::jsonb, 'Kroužek', null, null),
  ('course-vyskov-nadrazni', 'Kroužek', 'Kroužek Vyškov', 'Vyškov', 'Vyškov · ZŠ Nádražní', 'ZŠ Nádražní', 1790, '10 vstupů · 1790 Kč', null, 10, 'Středa 16:30 - 17:30', 'Digitální permanentka přes NFC čip', 'Permanentka na 10 vstupů do parkour tréninku.', '[{"label":"Platí pouze pro lokaci","value":"Vyškov · ZŠ Nádražní"},{"label":"Kapacita","value":"25 dětí ve skupině."}]'::jsonb, 'Kroužek', null, null),
  ('course-vyskov-nadrazni-15', 'Kroužek', 'Kroužek Vyškov', 'Vyškov', 'Vyškov · ZŠ Nádražní', 'ZŠ Nádražní', 2590, '15 vstupů · 2590 Kč', 2685, 15, 'Středa 16:30 - 17:30', 'Výhodnější digitální permanentka přes NFC čip', 'Permanentka na 15 vstupů do parkour tréninku.', '[{"label":"Platí pouze pro lokaci","value":"Vyškov · ZŠ Nádražní"},{"label":"Kapacita","value":"25 dětí ve skupině."}]'::jsonb, 'Kroužek', null, null),
  ('course-vyskov-purkynova', 'Kroužek', 'Kroužek Vyškov', 'Vyškov', 'Vyškov · ZŠ Purkyňova', 'ZŠ Purkyňova', 1790, '10 vstupů · 1790 Kč', null, 10, 'Pondělí 15:30 - 16:30', 'Digitální permanentka přes NFC čip', 'Permanentka na 10 vstupů do parkour tréninku.', '[{"label":"Platí pouze pro lokaci","value":"Vyškov · ZŠ Purkyňova"}]'::jsonb, 'Kroužek', null, null),
  ('course-vyskov-purkynova-15', 'Kroužek', 'Kroužek Vyškov', 'Vyškov', 'Vyškov · ZŠ Purkyňova', 'ZŠ Purkyňova', 2590, '15 vstupů · 2590 Kč', 2685, 15, 'Pondělí 15:30 - 16:30', 'Výhodnější digitální permanentka přes NFC čip', 'Permanentka na 15 vstupů do parkour tréninku.', '[{"label":"Platí pouze pro lokaci","value":"Vyškov · ZŠ Purkyňova"}]'::jsonb, 'Kroužek', null, null),
  ('camp-veliny-mlynek', 'Tábor', 'Příměstský tábor Veliny', 'Veliny', 'Veliny · Tábor Mlýnek', 'Tábor Mlýnek', 3300, 'Turnusy od 3300 Kč', null, null, 'Veliny 2025/2026', 'Jídlo a tričko v ceně', 'Týden pohybu, her a parkouru v lokalitě Veliny.', '[{"label":"Termíny","value":"20.7.-24.7. nebo 27.7.-31.7."},{"label":"Věk","value":"7-16 let."},{"label":"Dokumenty","value":"Po zaplacení rodič podepíše GDPR, souhlas, anamnézu, bezinfekčnost, vyzvedávání a věci s sebou."},{"label":"QR první den","value":"QR se odemkne až po zaplacení a kompletních dokumentech."},{"label":"Co mít s sebou","value":"Láhev, sportovní oblečení, sálové i venkovní boty, kšiltovku, opalovací krém, kopii kartičky pojišťovny a označené léky."}]'::jsonb, 'Táborový turnus', null, null),
  ('camp-vyskov-orel', 'Tábor', 'Příměstský tábor Vyškov', 'Vyškov', 'Vyškov · Orel jednota Vyškov', 'Orel jednota Vyškov', 3890, 'Turnusy od 3890 Kč', null, null, 'Vyškov 2025/2026', 'Jídlo a tričko v ceně', 'Týden pohybu, her a parkouru v lokalitě Vyškov.', '[{"label":"Termíny","value":"13.7.-17.7. nebo 10.8.-14.8."},{"label":"Věk","value":"6-14 let."},{"label":"Dokumenty","value":"Po zaplacení rodič podepíše GDPR, souhlas, anamnézu, bezinfekčnost, vyzvedávání a věci s sebou."},{"label":"QR první den","value":"QR se odemkne až po zaplacení a kompletních dokumentech."},{"label":"Co mít s sebou","value":"Láhev, sportovní oblečení, sálové i venkovní boty, kšiltovku, opalovací krém, kopii kartičky pojišťovny a označené léky."}]'::jsonb, 'Táborový turnus', null, null),
  ('workshop-praha-balkan', 'Workshop', 'Praha Balkan workshop', 'Praha', 'Praha · Balkan', 'Balkan tréninková hala', 890, '890 Kč', null, null, '14. 6. 2026 · 10:00', 'QR ticket po zaplacení', 'Jednorázový workshop pro růžovou cestu: parkour přeskoky, plynulost a první tricking kombinace.', '[{"label":"Vstupenka","value":"Po zaplacení se rodiči i účastníkovi zobrazí QR ticket."},{"label":"Platnost","value":"Ticket platí pouze pro workshop Praha · Balkan do 15. 6. 2026."},{"label":"Triky","value":"Tic-tac, Kong vault, Lazy vault, Butterfly kick, Tornado kick a Macaco."}]'::jsonb, 'Workshop', '14. 6. 2026 · 10:00', '2026-06-15')
on conflict (id) do update set type = excluded.type, title = excluded.title, city = excluded.city, place = excluded.place, venue = excluded.venue, price = excluded.price, price_label = excluded.price_label, original_price = excluded.original_price, entries_total = excluded.entries_total, primary_meta = excluded.primary_meta, secondary_meta = excluded.secondary_meta, description = excluded.description, important_info = excluded.important_info, badge = excluded.badge, event_date = excluded.event_date, expires_at = excluded.expires_at;

update public.products
set capacity_total = case type when 'Kroužek' then 25 when 'Tábor' then 30 when 'Workshop' then 40 end
where type in ('Kroužek', 'Tábor', 'Workshop')
  and capacity_total is distinct from case type when 'Kroužek' then 25 when 'Tábor' then 30 when 'Workshop' then 40 end;

update public.products p
set important_info = p.important_info || case p.type
  when 'Kroužek' then '[{"label":"Kapacita","value":"25 dětí ve skupině."}]'::jsonb
  when 'Tábor' then '[{"label":"Kapacita","value":"30 dětí na turnus."}]'::jsonb
  when 'Workshop' then '[{"label":"Kapacita","value":"40 účastníků."}]'::jsonb
end
where p.type in ('Kroužek', 'Tábor', 'Workshop')
  and not exists (
    select 1 from jsonb_array_elements(p.important_info) item
    where item->>'label' = 'Kapacita'
  );

update public.products p
set important_info = p.important_info || '[{"label":"Dokumenty","value":"Po zakoupení kroužku rodič vyplní GDPR, souhlas rodiče, zdravotní informace a odchod z tréninku."}]'::jsonb
where p.type = 'Kroužek'
  and not exists (
    select 1 from jsonb_array_elements(p.important_info) item
    where item->>'label' = 'Dokumenty'
  );

insert into public.product_faqs (id, question, answer, categories, sort_order) values
  ('course-location-pass', 'Můžu jednu permanentku používat ve více lokalitách?', 'Ne. Jedna permanentka platí pouze pro jednu vybranou lokaci.', array['Kroužek'], 10),
  ('course-attendance-chip', 'Jak se odečítají vstupy z permanentky?', 'Vstup se odečte při příchodu na trénink po načtení NFC čipu.', array['Kroužek'], 20),
  ('course-documents-required', 'Jaké dokumenty musím vyplnit před kroužkem?', 'V rodičovském profilu je potřeba podepsat GDPR, souhlas zákonného zástupce, zdravotní informace a odchod z tréninku. Bez kompletních dokumentů trenér vidí, že profil není připravený pro pravidelnou účast.', array['Kroužek'], 25),
  ('camp-day-time', 'V kolik děti na táboře začínají a končí?', 'Typický den začíná příchodem mezi 8:00 a 9:00, vyzvednutí je kolem 16:00.', array['Tábor'], 30),
  ('camp-food', 'Je v ceně jídlo a pitný režim?', 'Ano. V ceně je svačina, oběd a pitný režim.', array['Tábor'], 40),
  ('camp-documents-qr', 'Kdy se zobrazí táborový QR ticket?', 'QR ticket se uloží do profilu rodiče i účastníka až po zaplacení tábora a podpisu GDPR, souhlasu, anamnézy, bezinfekčnosti, vyzvedávání a seznamu věcí s sebou.', array['Tábor'], 45),
  ('camp-medical-check', 'Kdo uvidí alergie a anamnézu?', 'Po prvním skenu QR je trenér uvidí v táborové evidenci skenů pro kontrolu alergií, léků, omezení a vyzvedávání.', array['Tábor'], 46),
  ('registered-members', 'Musím mít dítě přidané v účtu?', 'Ano. Nákup se váže na konkrétního účastníka.', array['Kroužek','Tábor','Workshop'], 50)
on conflict (id) do update set question = excluded.question, answer = excluded.answer, categories = excluded.categories, sort_order = excluded.sort_order;

insert into public.parent_payments (id, participant_id, participant_name, title, amount, due_date, status, stripe_ready) values
  ('pay-course-1', 'demo-child-1', 'Eliška Nováková', 'Permanentka 10 vstupů Vyškov', 1790, 'Zaplaceno', 'paid', true),
  ('pay-camp-1', 'demo-child-1', 'Eliška Nováková', 'Letní tábor Vyškov', 3890, '30. 5. 2026', 'due', true)
on conflict (id) do update set participant_id = excluded.participant_id, participant_name = excluded.participant_name, title = excluded.title, amount = excluded.amount, due_date = excluded.due_date, status = excluded.status, stripe_ready = excluded.stripe_ready;

insert into public.digital_passes (id, participant_id, holder_name, title, location, nfc_chip_id, total_entries, used_entries, last_scan_at, last_scan_place) values
  ('pass-demo-child-1', 'demo-child-1', 'Eliška Nováková', 'Permanentka 10 vstupů', 'Vyškov · ZŠ Nádražní', 'NFC-VYS-0428', 10, 4, 'Středa 24. 4. 2026 · 16:27', 'Vyškov · ZŠ Nádražní')
on conflict (id) do update set participant_id = excluded.participant_id, holder_name = excluded.holder_name, title = excluded.title, location = excluded.location, nfc_chip_id = excluded.nfc_chip_id, total_entries = excluded.total_entries, used_entries = excluded.used_entries, last_scan_at = excluded.last_scan_at, last_scan_place = excluded.last_scan_place;

insert into public.coach_profiles (id, level, xp, next_level_xp, qr_tricks_approved, attendance_logged, bonus_total, current_location, assigned_courses) values
  ('coach-demo', 5, 1840, 2400, 68, 42, 1500, 'Vyškov · ZŠ Nádražní', array['Vyškov · ZŠ Nádražní','Vyškov · ZŠ Purkyňova','Prostějov · ZŠ Melantrichova'])
on conflict (id) do update set level = excluded.level, xp = excluded.xp, next_level_xp = excluded.next_level_xp, qr_tricks_approved = excluded.qr_tricks_approved, attendance_logged = excluded.attendance_logged, bonus_total = excluded.bonus_total, current_location = excluded.current_location, assigned_courses = excluded.assigned_courses;

insert into public.coach_sessions (id, coach_id, city, venue, day, time, group_name, enrolled, present, duration_hours, hourly_rate, latitude, longitude, check_in_radius_meters) values
  ('session-vyskov-nadrazni', 'coach-demo', 'Vyškov', 'ZŠ Nádražní', 'Středa', '16:30 - 17:30', 'Začátečníci 8-12', 14, 11, 1, 500, 49.2775, 16.9984, 300),
  ('session-vyskov-purkynova', 'coach-demo', 'Vyškov', 'ZŠ Purkyňova', 'Pondělí', '15:30 - 16:30', 'Mladší skupina', 12, 10, 1, 500, 49.2792, 17.0029, 300),
  ('session-prostejov', 'coach-demo', 'Prostějov', 'ZŠ Melantrichova', 'Sobota', '10:00 - 11:00', 'Mix level', 16, 13, 1, 500, 49.4734, 17.1128, 350)
on conflict (id) do update set coach_id = excluded.coach_id, city = excluded.city, venue = excluded.venue, day = excluded.day, time = excluded.time, group_name = excluded.group_name, enrolled = excluded.enrolled, present = excluded.present, duration_hours = excluded.duration_hours, hourly_rate = excluded.hourly_rate, latitude = excluded.latitude, longitude = excluded.longitude, check_in_radius_meters = excluded.check_in_radius_meters;

insert into public.coach_wards (id, name, parent_name, locations, activity_type, parent_phone, emergency_phone, birth_year, school_year, coach_note, departure_mode, departure_signed, departure_signed_at_text, authorized_people, departure_note, allergies, health_limits, medication_note, completed_trick_ids, level, bracelet, bracelet_color, payment_status, physical_bracelet_received, has_nfc_chip, pass_title, entries_left, last_attendance) values
  ('ward-eliska', 'Eliška Nováková', 'David Kropáč', array['Vyškov · ZŠ Nádražní'], 'krouzek', '+420 605 324 417', '+420 605 324 417', 2015, '5. třída', 'Pečlivá v dopadech, při saltech potřebuje jistit první pokusy.', 'alone', true, '24. 4. 2026', 'Rodič David Kropáč, tel. +420 605 324 417', 'Může odejít sama na autobus v 17:45. Při změně počasí volat rodiči.', 'Bez alergií', 'Bez omezení', 'Bez léků', '["safety-roll","safety-vault","precision-jump","wall-run","cartwheel","roundhouse-kick","backward-roll","reverse-vault","tic-tac","kong-vault","lazy-vault","butterfly-kick"]'::jsonb, 7, 'Růžová', '#F5A7C8', 'Zaplaceno', false, true, 'Permanentka 10 vstupů', 6, 'Středa 24. 4. 2026 · 16:27'),
  ('ward-alex', 'Alex Svoboda', 'Petra Svobodová', array['Vyškov · ZŠ Nádražní','Prostějov · ZŠ Melantrichova'], 'krouzek', '+420 731 800 224', '+420 731 800 224', 2013, '7. třída', 'Rychle chápe nové vaulty, hlídat rozcvičení kotníků.', 'authorized', true, '18. 4. 2026', 'Petra Svobodová, Tomáš Svoboda, babička Jana Malá', 'Po tréninku čeká u vstupu, odchází jen s pověřenou osobou.', 'Bez alergií', 'Pozor na pravý kotník po výronu, bez tvrdých dopadů při bolesti.', 'Bez léků', '["safety-roll","safety-vault","precision-jump","wall-run","cartwheel","roundhouse-kick","backward-roll","reverse-vault","tic-tac","kong-vault","lazy-vault","butterfly-kick","tornado-kick","macaco","wall-spin","frontflip","backflip","full-twist"]'::jsonb, 9, 'Fialová', '#8A62D6', 'Zaplaceno', false, false, 'Permanentka 10 vstupů', 3, 'Čeká na ruční zápis'),
  ('ward-nela', 'Nela Horáková', 'Lenka Horáková', array['Vyškov · ZŠ Purkyňova'], 'krouzek', '+420 604 112 889', '+420 604 112 889', 2016, '4. třída', 'Potřebuje jasné instrukce po krocích, technicky silná v precizních skocích.', 'parent', false, 'Chybí podpis', 'Neuvedeno', 'Dokud rodič nepodepíše odchod, dítě neodchází samo.', 'Bez alergií', 'Bez omezení', 'Bez léků', '["safety-roll","safety-vault","precision-jump","wall-run","cartwheel","roundhouse-kick","backward-roll","reverse-vault","tic-tac"]'::jsonb, 6, 'Růžová', '#F5A7C8', 'Čeká na platbu', false, true, 'Permanentka 10 vstupů', 0, '17. 4. 2026 · 16:31')
on conflict (id) do update set name = excluded.name, parent_name = excluded.parent_name, locations = excluded.locations, activity_type = excluded.activity_type, parent_phone = excluded.parent_phone, emergency_phone = excluded.emergency_phone, birth_year = excluded.birth_year, school_year = excluded.school_year, coach_note = excluded.coach_note, departure_mode = excluded.departure_mode, departure_signed = excluded.departure_signed, departure_signed_at_text = excluded.departure_signed_at_text, authorized_people = excluded.authorized_people, departure_note = excluded.departure_note, allergies = excluded.allergies, health_limits = excluded.health_limits, medication_note = excluded.medication_note, completed_trick_ids = excluded.completed_trick_ids, level = excluded.level, bracelet = excluded.bracelet, bracelet_color = excluded.bracelet_color, payment_status = excluded.payment_status, physical_bracelet_received = excluded.physical_bracelet_received, has_nfc_chip = excluded.has_nfc_chip, pass_title = excluded.pass_title, entries_left = excluded.entries_left, last_attendance = excluded.last_attendance;

insert into public.nfc_chip_assignments (chip_id, ward_id, participant_name, location, assigned_at_text) values
  ('NFC-VYS-0428', 'ward-eliska', 'Eliška Nováková', 'Vyškov · ZŠ Nádražní', 'Výchozí čip'),
  ('NFC-VYS-0612', 'ward-nela', 'Nela Horáková', 'Vyškov · ZŠ Purkyňova', 'Výchozí čip')
on conflict (chip_id) do update set ward_id = excluded.ward_id, participant_name = excluded.participant_name, location = excluded.location, assigned_at_text = excluded.assigned_at_text;

insert into public.coach_attendance_records (id, coach_id, session_id, date_text, place, status, present, duration_hours, hourly_rate, amount) values
  ('coach-att-2026-04-24-nadrazni', 'coach-demo', 'session-vyskov-nadrazni', '24. 4. 2026', 'Vyškov · ZŠ Nádražní', 'Zapsáno', '11/14', 1, 500, 500),
  ('coach-att-2026-04-22-purkynova', 'coach-demo', 'session-vyskov-purkynova', '22. 4. 2026', 'Vyškov · ZŠ Purkyňova', 'Zapsáno', '10/12', 1, 500, 500),
  ('coach-att-2026-04-18-prostejov', 'coach-demo', 'session-prostejov', '18. 4. 2026', 'Prostějov · ZŠ Melantrichova', 'Zapsáno', '13/16', 1, 500, 500)
on conflict (id) do update set coach_id = excluded.coach_id, session_id = excluded.session_id, date_text = excluded.date_text, place = excluded.place, status = excluded.status, present = excluded.present, duration_hours = excluded.duration_hours, hourly_rate = excluded.hourly_rate, amount = excluded.amount;

insert into public.child_attendance_records (id, session_id, date_text, location, attendees) values
  ('children-2026-04-24-nadrazni', 'session-vyskov-nadrazni', '24. 4. 2026', 'Vyškov · ZŠ Nádražní', '[{"name":"Eliška Nováková","time":"16:27","method":"NFC"},{"name":"Alex Svoboda","time":"16:31","method":"Ručně"}]'::jsonb),
  ('children-2026-04-17-nadrazni', 'session-vyskov-nadrazni', '17. 4. 2026', 'Vyškov · ZŠ Nádražní', '[{"name":"Eliška Nováková","time":"16:25","method":"NFC"}]'::jsonb),
  ('children-2026-04-22-purkynova', 'session-vyskov-purkynova', '22. 4. 2026', 'Vyškov · ZŠ Purkyňova', '[{"name":"Nela Horáková","time":"15:28","method":"NFC"}]'::jsonb),
  ('children-2026-04-18-prostejov', 'session-prostejov', '18. 4. 2026', 'Prostějov · ZŠ Melantrichova', '[{"name":"Alex Svoboda","time":"10:03","method":"Ručně"}]'::jsonb)
on conflict (id) do update set session_id = excluded.session_id, date_text = excluded.date_text, location = excluded.location, attendees = excluded.attendees;

delete from public.coach_tricks where id in ('roll-basic', 'speed-vault', 'cat-leap');

insert into public.coach_tricks (id, title, bracelet, xp, category, level, level_title, discipline, description, sort_order) values
  ('safety-roll', 'Safety roll', 'Béžová', 80, 'Parkour', 1, 'Základy', 'Parkour', 'Bezpečný dopad přes rameno.', 101),
  ('safety-vault', 'Safety vault', 'Béžová', 150, 'Parkour', 1, 'Základy', 'Parkour', 'Přeskok s oporou ruky a nohy.', 102),
  ('precision-jump', 'Precision jump', 'Béžová', 220, 'Parkour', 1, 'Základy', 'Parkour', 'Skok snožmo na přesnost.', 103),
  ('wall-run', 'Wall run', 'Béžová', 290, 'Parkour', 1, 'Základy', 'Parkour', 'Výběh na zeď a výlez nahoru.', 104),
  ('cartwheel', 'Cartwheel', 'Béžová', 360, 'Tricking', 1, 'Základy', 'Tricking', 'Klasická hvězda.', 105),
  ('roundhouse-kick', 'Roundhouse kick', 'Béžová', 430, 'Tricking', 1, 'Základy', 'Tricking', 'Základní obloukový kop.', 106),
  ('backward-roll', 'Backward roll', 'Béžová', 500, 'Parkour', 1, 'Základy', 'Parkour', 'Kotoul vzad pro orientaci.', 107),
  ('reverse-vault', 'Reverse vault', 'Béžová', 570, 'Parkour', 1, 'Základy', 'Parkour', 'Přeskok s otočkou o 360 stupňů.', 108),
  ('tic-tac', 'Tic-tac', 'Růžová', 680, 'Parkour', 2, 'Mírně pokročilý', 'Parkour', 'Odraz od stěny do dálky nebo výšky.', 201),
  ('kong-vault', 'Kong vault', 'Růžová', 760, 'Parkour', 2, 'Mírně pokročilý', 'Parkour', 'Přeskok opičák oběma rukama najednou.', 202),
  ('lazy-vault', 'Lazy vault', 'Růžová', 840, 'Parkour', 2, 'Mírně pokročilý', 'Parkour', 'Přeskok překážky z úhlu.', 203),
  ('butterfly-kick', 'Butterfly kick', 'Růžová', 920, 'Tricking', 2, 'Mírně pokročilý', 'Tricking', 'Horizontální skok s nohama do nůžek.', 204),
  ('tornado-kick', 'Tornado kick', 'Růžová', 1000, 'Tricking', 2, 'Mírně pokročilý', 'Tricking', 'Výskok s otočkou a kopem vnější nohou.', 205),
  ('macaco', 'Macaco', 'Růžová', 1080, 'Tricking', 2, 'Mírně pokročilý', 'Tricking', 'Přemet vzad přes jednu ruku z dřepu.', 206),
  ('wall-spin', 'Wall spin', 'Růžová', 1160, 'Parkour', 2, 'Mírně pokročilý', 'Parkour', 'Rotace o 360 stupňů dlaněmi o zeď.', 207),
  ('frontflip', 'Frontflip', 'Růžová', 1240, 'Tricking/Parkour', 2, 'Mírně pokročilý', 'Tricking/Parkour', 'Salto vpřed.', 208),
  ('backflip', 'Backflip', 'Fialová', 1500, 'Tricking', 3, 'Pokročilý', 'Tricking', 'Salto vzad z místa.', 301),
  ('full-twist', 'Full twist', 'Fialová', 1580, 'Tricking', 3, 'Pokročilý', 'Tricking', 'Salto vzad s jednou celou vrutovou rotací 360 stupňů.', 302),
  ('sideflip', 'Sideflip', 'Fialová', 1660, 'Parkour/Tricking', 3, 'Pokročilý', 'Parkour/Tricking', 'Salto stranou.', 303),
  ('wall-flip', 'Wall flip', 'Fialová', 1740, 'Parkour', 3, 'Pokročilý', 'Parkour', 'Salto vzad s odrazem od zdi.', 304),
  ('aerial', 'Aerial', 'Fialová', 1820, 'Tricking', 3, 'Pokročilý', 'Tricking', 'Hvězda bez rukou.', 305),
  ('540-kick', '540 kick', 'Fialová', 1900, 'Tricking', 3, 'Pokročilý', 'Tricking', 'Kop s dopadem na kopající nohu.', 306),
  ('pop-360-kick', 'Pop 360 kick', 'Fialová', 1980, 'Tricking', 3, 'Pokročilý', 'Tricking', 'Kop z odrazu snožmo s rotací.', 307),
  ('scoot', 'Scoot', 'Fialová', 2060, 'Tricking', 3, 'Pokročilý', 'Tricking', 'Setupový prvek, odraz z ruky a nohy do švihu.', 308),
  ('dash-vault', 'Dash vault', 'Fialová', 2140, 'Parkour', 3, 'Pokročilý', 'Parkour', 'Přeskok nohama napřed.', 309),
  ('webster', 'Webster', 'Fialová', 2220, 'Tricking/Parkour', 3, 'Pokročilý', 'Tricking/Parkour', 'Salto vpřed z jedné nohy.', 310),
  ('corkscrew', 'Corkscrew', 'Tmavě fialová', 2500, 'Tricking', 4, 'Expert', 'Tricking', 'Salto vzad s vrutem z rozběhu a švihem nohy.', 401),
  ('scoot-full', 'Scoot Full', 'Tmavě fialová', 2580, 'Tricking', 4, 'Expert', 'Tricking', 'Kombinace scootu a salta s vrutem.', 402),
  ('shuriken-twist', 'Shuriken twist', 'Tmavě fialová', 2660, 'Tricking', 4, 'Expert', 'Tricking', 'B-twist, kde ve vzduchu proběhne kop shuriken.', 403),
  ('butterfly-twist', 'Butterfly twist', 'Tmavě fialová', 2740, 'Tricking', 4, 'Expert', 'Tricking', 'B-kick s plnou rotací vrutem.', 404),
  ('raiz', 'Raiz', 'Tmavě fialová', 2820, 'Tricking', 4, 'Expert', 'Tricking', 'Horizontální rotace těla se švihem nohou.', 405),
  ('gainer', 'Gainer', 'Tmavě fialová', 2900, 'Parkour/Tricking', 4, 'Expert', 'Parkour/Tricking', 'Salto vzad při pohybu vpřed.', 406),
  ('cheat-720-kick', 'Cheat 720 kick', 'Tmavě fialová', 2980, 'Tricking', 4, 'Expert', 'Tricking', 'Rotace o 720 stupňů zakončená kopem.', 407),
  ('castaway', 'Castaway', 'Tmavě fialová', 3060, 'Parkour', 4, 'Expert', 'Parkour', 'Salto vzad z odrazu rukama o překážku.', 408),
  ('double-kong', 'Double Kong', 'Tmavě fialová', 3140, 'Parkour', 4, 'Expert', 'Parkour', 'Dlouhý skok se dvěma dotyky rukou o překážku.', 409),
  ('flashkick', 'Flashkick', 'Tmavě fialová', 3220, 'Tricking', 4, 'Expert', 'Tricking', 'Salto vzad s kopem ve vzduchu.', 410),
  ('double-full', 'Double Full', 'Černá', 3900, 'Tricking', 5, 'Master', 'Tricking', 'Salto vzad se dvěma vruty.', 501),
  ('double-cork', 'Double Cork', 'Černá', 4000, 'Tricking', 5, 'Master', 'Tricking', 'Cork se dvěma vruty.', 502),
  ('touchdown-raiz-tdr', 'Touchdown Raiz / TDR', 'Černá', 4100, 'Tricking', 5, 'Master', 'Tricking', 'Raiz s dotykem ruky pro extrémní švih.', 503),
  ('double-b-twist', 'Double B-twist', 'Černá', 4200, 'Tricking', 5, 'Master', 'Tricking', 'Butterfly twist se dvěma vruty.', 504),
  ('cheat-1080-kick', 'Cheat 1080 kick', 'Černá', 4300, 'Tricking', 5, 'Master', 'Tricking', 'Tři plné rotace ve vzduchu s kopem.', 505),
  ('jackknife', 'Jackknife', 'Černá', 4400, 'Tricking', 5, 'Master', 'Tricking', '540 kick s přidaným kopem druhou nohou ve vzduchu.', 506),
  ('snapuswipe', 'Snapuswipe', 'Černá', 4500, 'Tricking', 5, 'Master', 'Tricking', '540 kick s horizontální rotací navíc.', 507),
  ('palm-flip', 'Palm flip', 'Černá', 4600, 'Parkour', 5, 'Master', 'Parkour', 'Salto vzad pouze z odrazu dlaněmi o svislou zeď.', 508),
  ('double-backflip', 'Double Backflip', 'Černá', 4700, 'Tricking', 5, 'Master', 'Tricking', 'Dvojité salto vzad.', 509),
  ('cartwheel-full', 'Cartwheel Full', 'Černá', 4800, 'Tricking', 5, 'Master', 'Tricking', 'Hvězda následovaná okamžitým saltem s vrutem.', 510)
on conflict (id) do update set title = excluded.title, bracelet = excluded.bracelet, xp = excluded.xp, category = excluded.category, level = excluded.level, level_title = excluded.level_title, discipline = excluded.discipline, description = excluded.description, sort_order = excluded.sort_order;

insert into public.coach_manual_trick_awards (id, ward_id, participant_name, trick_id, trick_title, coach_id, awarded_at_text) values
  ('manual-ward-eliska-wall-spin', 'ward-eliska', 'Eliška Nováková', 'wall-spin', 'Wall spin', 'coach-demo', '29. 4. 2026 · 17:12')
on conflict (id) do update set ward_id = excluded.ward_id, participant_name = excluded.participant_name, trick_id = excluded.trick_id, trick_title = excluded.trick_title, coach_id = excluded.coach_id, awarded_at_text = excluded.awarded_at_text;

insert into public.coach_leaderboard (id, rank, name, xp, qr, bonus) values
  ('leader-marek', 1, 'Marek', 2320, 91, '+1000 Kč'),
  ('leader-filip', 2, 'Filip Trenér', 1840, 68, '+500 Kč'),
  ('leader-anna', 3, 'Anna', 1710, 63, '+300 Kč'),
  ('leader-tereza', 4, 'Tereza', 1360, 48, 'čeká')
on conflict (id) do update set rank = excluded.rank, name = excluded.name, xp = excluded.xp, qr = excluded.qr, bonus = excluded.bonus;

insert into public.coach_reward_path (id, xp, title, reward, unlocked) values
  ('reward-500', 500, 'TeamVYS badge trenéra', 'Profilový odznak', true),
  ('reward-1200', 1200, 'Stabilní docházka', '+300 Kč', true),
  ('reward-1800', 1800, 'QR progres svěřenců', '+500 Kč', true),
  ('reward-2400', 2400, 'Mentor skupiny', '+1000 Kč', false)
on conflict (id) do update set xp = excluded.xp, title = excluded.title, reward = excluded.reward, unlocked = excluded.unlocked;

insert into public.coach_payouts (id, coach_id, hourly_rate, logged_hours, base_amount, approved_bonuses, pending_bonuses, next_payout, status) values
  ('payout-coach-demo-current', 'coach-demo', 500, 3, 1500, 1500, 1000, '15. 5. 2026', 'Připraveno k výplatě')
on conflict (id) do update set coach_id = excluded.coach_id, hourly_rate = excluded.hourly_rate, logged_hours = excluded.logged_hours, base_amount = excluded.base_amount, approved_bonuses = excluded.approved_bonuses, pending_bonuses = excluded.pending_bonuses, next_payout = excluded.next_payout, status = excluded.status, updated_at = now();

insert into public.coach_reviews (id, coach_id, coach_name, parent_id, parent_name, participant_name, rating, comment, created_at_text) values
  ('review-parent-demo-coach-demo', 'coach-demo', 'Filip Trenér', 'parent-demo', 'David Kropáč', 'Eliška Nováková', 5, 'Filip dobře komunikuje, děti vede bezpečně a Eliška se na tréninky těší.', '28. 4. 2026'),
  ('review-parent-demo-coach-marek', 'coach-marek', 'Marek Hlaváč', 'parent-demo', 'David Kropáč', 'Eliška Nováková', 4, 'Super energie na lekci, jen bych uvítal rychlejší zprávu po změně času.', '22. 4. 2026')
on conflict (id) do update set coach_id = excluded.coach_id, coach_name = excluded.coach_name, parent_id = excluded.parent_id, parent_name = excluded.parent_name, participant_name = excluded.participant_name, rating = excluded.rating, comment = excluded.comment, created_at_text = excluded.created_at_text;
