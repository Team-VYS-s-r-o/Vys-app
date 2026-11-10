-- Prohlášení poplatníka („růžovka") u trenéra: bez něj se z DPP výplaty
-- sráží 15% srážková daň. Fakturujících trenérů se srážka netýká.
alter table public.coach_profiles
  add column if not exists tax_declaration_signed boolean not null default false;

-- U odeslané výplaty evidujeme hrubou částku i sraženou daň,
-- aby admin věděl, kolik má odvést finančnímu úřadu.
alter table public.admin_coach_payout_transfers
  add column if not exists gross_amount integer;
alter table public.admin_coach_payout_transfers
  add column if not exists tax_withheld integer not null default 0;
