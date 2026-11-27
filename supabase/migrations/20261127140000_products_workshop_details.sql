-- Workshop s hostem: podrobnosti pro šablonu stránky Workshopy (web i aplikace).
-- { guestName, instagram, youtube, tiktok, intro,
--   program: [{ title, text, minutes }], notes: [{ label, text }] }
alter table public.products add column if not exists workshop_details jsonb;
comment on column public.products.workshop_details is 'Workshop: host (jméno, sociální sítě), program po částech (title, text, minutes) a poznámky pro web.';
