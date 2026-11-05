-- Faktura se umí navázat na konkrétní tělocvičnu (products.place) a umí nést
-- počet NFC kartiček, který se z ní přečte a jednou připíše do NFC nastavení.
-- Vazba je na MÍSTO, ne na id produktu: jedna tělocvična má typicky dvě
-- varianty permanentky (10/15 vstupů) i víc dnů v týdnu, faktura ale patří hale.
alter table public.invoices add column if not exists gym_place text;
alter table public.invoices add column if not exists nfc_card_count integer;
alter table public.invoices add column if not exists nfc_cards_applied boolean not null default false;

create index if not exists invoices_gym_place_idx on public.invoices (gym_place);
