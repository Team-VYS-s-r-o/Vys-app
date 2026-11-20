-- První lekce zdarma patří DÍTĚTI, ne záznamu: totéž dítě mívá dva záznamy
-- (rodič ho přidá a ono si založí vlastní účet, nebo ho rodič smaže a přidá
-- znovu) a dřív tak mohlo dostat druhé QR. identity_key = jméno bez diakritiky
-- + datum narození (yyyy-mm-dd); počítá ho server (freeLessonIdentityKey).
alter table public.free_lesson_claims add column if not exists identity_key text;
create index if not exists free_lesson_claims_identity_idx on public.free_lesson_claims (org_id, identity_key);
