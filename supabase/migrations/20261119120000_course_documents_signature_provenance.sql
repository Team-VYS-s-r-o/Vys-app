-- Prokazatelnost elektronických podpisů rodičů (právní audit 19. 11. 2026).
--
-- Dřív: řádek course_documents měl jen `signed_at_text` (string), žádné uid
-- podepisujícího, žádný snapshot šablony, a upsert po `id` přepisoval předchozí
-- podpis bez historie. Rodič navíc zapisoval rovnou z klienta přes RLS.
--
-- Teď:
--  * podpis zapisuje jen server (POST /api/course-documents/sign) a doplní
--    uid, roli, přesný čas, IP, user-agent, snapshot šablony a její verzi;
--  * podepsaný řádek se už nikdy nepřepisuje — nový podpis téhož slotu vloží
--    řádek s version+1 a starý dostane superseded_by;
--  * rodič z klienta nesmí vkládat ani měnit řádky se status='signed'
--    (čtení zůstává přes "course_documents scoped read").
-- Existující data zůstávají beze změny (nové sloupce jsou NULL / version 1).

alter table public.course_documents
  add column if not exists signed_by_profile_id text,
  add column if not exists signed_by_role text,
  add column if not exists signed_at timestamptz,
  add column if not exists signed_ip text,
  add column if not exists signed_user_agent text,
  add column if not exists template_snapshot jsonb,
  add column if not exists template_version text,
  add column if not exists legal_version text,
  add column if not exists app_version text,
  add column if not exists version integer not null default 1,
  add column if not exists superseded_by text;

comment on column public.course_documents.signed_by_profile_id is 'auth uid (app_profiles.id) toho, kdo podpis odeslal';
comment on column public.course_documents.signed_by_role is 'parent | participant | admin — admin = podepsáno za rodiče, nikdy se netváří jako podpis rodiče';
comment on column public.course_documents.template_snapshot is 'Celá šablona (intro, clauses, fields) tak, jak ji rodič viděl v okamžiku podpisu';
comment on column public.course_documents.template_version is 'sha256 snapshotu + updated_at šablony';
comment on column public.course_documents.superseded_by is 'id novějšího podpisu téhož slotu; NULL = aktuálně platný řádek';

create index if not exists course_documents_slot_version_idx
  on public.course_documents (participant_id, purchase_id, slot_id, version desc);

create index if not exists course_documents_current_idx
  on public.course_documents (participant_id, product_id)
  where superseded_by is null;

-- Rodič/účastník z klienta: jen řádky, které NEJSOU podepsané (draft).
-- Podepsané řádky vkládá a mění výhradně server (service role).
drop policy if exists "course_documents parent write" on public.course_documents;
create policy "course_documents parent write" on public.course_documents for all to authenticated
  using (
    (
      (
        exists (select 1 from public.participants where participants.id = course_documents.participant_id and participants.parent_profile_id = auth.uid()::text)
        and course_documents.status <> 'signed'
      )
      or public.teamvys_app_role() = 'admin'
    )
    and public.teamvys_org_match(org_id)
  )
  with check (
    (
      (
        exists (select 1 from public.participants where participants.id = course_documents.participant_id and participants.parent_profile_id = auth.uid()::text)
        and course_documents.status <> 'signed'
      )
      or public.teamvys_app_role() = 'admin'
    )
    and public.teamvys_org_match(org_id)
  );
