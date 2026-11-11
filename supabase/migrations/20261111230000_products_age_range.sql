-- Věkové rozpětí kroužku (zobrazuje web i appka). Výchozí: 6–14, Olomouc 3–6.
alter table public.products add column if not exists age_from integer;
alter table public.products add column if not exists age_to integer;
