-- Team VYS default signable documents for kroužky & workshops.
--
-- Parents must electronically sign these 4 documents before they can pay for a
-- Team VYS kroužek or workshop (enforced in the mobile checkout gate):
--   1. Přihláška
--   2. Prohlášení o zdravotním stavu
--   3. Souhlas se zpracováním osobních údajů (GDPR)
--   4. Souhlas s obchodními a storno podmínkami
--
-- IMPORTANT (multi-tenant): these templates are OWNED by the Team VYS org and
-- carry Team VYS's own data. They are org-scoped, so no other organization ever
-- sees Team VYS in its documents — every other org defines its own templates
-- (with its own data) in the admin "Dokumenty" section.
--
-- The slots are seeded as ORG-LEVEL DEFAULTS (product_id = NULL) for the
-- Kroužek and Workshop activity types, so they automatically apply to every
-- current AND future Team VYS kroužek/workshop without per-product setup. The
-- mobile useDocumentSlots hook reads product-specific slots UNION these
-- org-level defaults.
--
-- ⚠️ AI-generated legal text — recommend a lawyer review before going fully
-- public (same disclaimer as the other legal documents).
--
-- Idempotent.

do $mig$
declare
  vys uuid := '00000000-0000-4000-8000-000000000001';
  tpl_prihlaska uuid;
  tpl_zdravi uuid;
  tpl_gdpr uuid;
  tpl_terms uuid;
  activities text[] := array['Kroužek', 'Workshop'];
  act text;
begin
  -- ── Templates (idempotent by org_id + name) ────────────────────────────────
  select id into tpl_prihlaska from public.document_templates where org_id = vys and name = 'Přihláška' and kind = 'electronic' limit 1;
  if tpl_prihlaska is null then
    insert into public.document_templates (org_id, name, kind, body)
    values (vys, 'Přihláška', 'electronic', $j$
      {
        "intro": "Závazná přihláška dítěte do aktivity pořádané organizací Team VYS.",
        "clauses": [
          "Pořadatel: Team VYS s.r.o., IČO 30059496, se sídlem Puškinova 520/37, 682 01 Vyškov. Kontakt: info@teamvys.cz, +420 734 167 417.",
          "Přihlašuji níže uvedené dítě k účasti v aktivitě. Přihláška je závazná po zaplacení."
        ],
        "fields": [
          { "id": "child_name", "label": "Jméno a příjmení dítěte", "type": "text", "required": true },
          { "id": "child_birthdate", "label": "Datum narození dítěte", "type": "date", "required": true },
          { "id": "address", "label": "Adresa bydliště", "type": "text", "required": true },
          { "id": "parent_name", "label": "Jméno a příjmení zákonného zástupce", "type": "text", "required": true },
          { "id": "parent_phone", "label": "Telefon zákonného zástupce", "type": "text", "required": true },
          { "id": "parent_email", "label": "E-mail zákonného zástupce", "type": "text", "required": true },
          { "id": "confirm", "label": "Uvedené údaje jsou pravdivé a přihlášku podávám závazně.", "type": "check", "required": true }
        ]
      }
    $j$::jsonb)
    returning id into tpl_prihlaska;
  end if;

  select id into tpl_zdravi from public.document_templates where org_id = vys and name = 'Prohlášení o zdravotním stavu' and kind = 'electronic' limit 1;
  if tpl_zdravi is null then
    insert into public.document_templates (org_id, name, kind, body)
    values (vys, 'Prohlášení o zdravotním stavu', 'electronic', $j$
      {
        "intro": "Prohlášení zákonného zástupce o zdravotním stavu dítěte.",
        "clauses": [
          "Prohlašuji, že dítě je zdravotně způsobilé k pohybové a sportovní aktivitě a netrpí nemocí ani stavem, který by jeho účast vylučoval.",
          "Zavazuji se neprodleně informovat organizátora o jakékoli změně zdravotního stavu dítěte."
        ],
        "fields": [
          { "id": "allergies", "label": "Alergie (pokud žádné, nechte prázdné)", "type": "textarea", "required": false },
          { "id": "health_limits", "label": "Zdravotní omezení", "type": "textarea", "required": false },
          { "id": "medication", "label": "Pravidelně užívané léky", "type": "textarea", "required": false },
          { "id": "emergency_phone", "label": "Nouzový kontakt (telefon)", "type": "text", "required": true },
          { "id": "confirm", "label": "Prohlašuji, že dítě je zdravotně způsobilé k účasti a údaje jsou pravdivé.", "type": "check", "required": true }
        ]
      }
    $j$::jsonb)
    returning id into tpl_zdravi;
  end if;

  select id into tpl_gdpr from public.document_templates where org_id = vys and name = 'Souhlas se zpracováním osobních údajů (GDPR)' and kind = 'electronic' limit 1;
  if tpl_gdpr is null then
    insert into public.document_templates (org_id, name, kind, body)
    values (vys, 'Souhlas se zpracováním osobních údajů (GDPR)', 'electronic', $j$
      {
        "intro": "Souhlas se zpracováním osobních údajů dle nařízení (EU) 2016/679 (GDPR).",
        "clauses": [
          "Správcem osobních údajů je Team VYS s.r.o., IČO 30059496, se sídlem Puškinova 520/37, 682 01 Vyškov.",
          "Osobní údaje dítěte a zákonného zástupce zpracováváme za účelem evidence účasti, docházky, plateb a komunikace, a to po dobu trvání účasti a po dobu zákonných lhůt.",
          "Máte právo na přístup k údajům, jejich opravu, výmaz a další práva dle GDPR. Souhlas lze kdykoli odvolat na info@teamvys.cz."
        ],
        "fields": [
          { "id": "consent_data", "label": "Souhlasím se zpracováním osobních údajů pro účely účasti v aktivitě.", "type": "check", "required": true },
          { "id": "consent_photos", "label": "Souhlasím s pořizováním fotografií a videí z aktivit a jejich použitím k propagaci (nepovinné).", "type": "check", "required": false }
        ]
      }
    $j$::jsonb)
    returning id into tpl_gdpr;
  end if;

  select id into tpl_terms from public.document_templates where org_id = vys and name = 'Souhlas s obchodními a storno podmínkami' and kind = 'electronic' limit 1;
  if tpl_terms is null then
    insert into public.document_templates (org_id, name, kind, body)
    values (vys, 'Souhlas s obchodními a storno podmínkami', 'electronic', $j$
      {
        "intro": "Souhlas s obchodními a storno podmínkami organizace Team VYS. Než potvrdíš souhlas, přečti si prosím níže uvedené storno podmínky.",
        "clauses": [
          "Nevyužitou permanentku na kroužek je možné stornovat do 14 dnů od jejího zakoupení. Pokud z permanentky nebyl využit žádný placený vstup, vrátíme ti 100 % uhrazené částky.",
          "Storno provedeš sám/sama přímo v mobilní aplikaci a peníze se vrací zpět na původní platební kartu.",
          "Permanentka se považuje za aktivovanou okamžikem využití prvního placeného vstupu. Po aktivaci už standardně není možné požadovat její storno ani vrácení ceny za zbývající nevyužité vstupy.",
          "Ve výjimečných a závažných případech (například dlouhodobý úraz nebo vážné zdravotní omezení, které dítěti dlouhodobě znemožňuje trénovat) je možné požádat Team VYS o individuální posouzení – například prodloužení platnosti permanentky, její dočasné pozastavení, převod zbývajících vstupů nebo vrácení přiměřené části ceny. Na toto individuální řešení nevzniká automatický nárok.",
          "Pokud dojde ke zrušení tréninku ze strany Team VYS, vstup se z permanentky neodečítá. Při dlouhodobém ukončení tréninků ze strany Team VYS ti nabídneme náhradní řešení nebo odpovídající finanční náhradu.",
          "Těmito storno podmínkami nejsou dotčena práva spotřebitele, která ti náleží podle platných právních předpisů. Kontakt pro storno a dotazy: info@teamvys.cz, +420 734 167 417.",
          "Seznámil/a jsem se s výše uvedenými obchodními, platebními a storno podmínkami organizace Team VYS a beru je na vědomí."
        ],
        "fields": [
          { "id": "consent_terms", "label": "Souhlasím s obchodními a storno podmínkami.", "type": "check", "required": true }
        ]
      }
    $j$::jsonb)
    returning id into tpl_terms;
  end if;

  -- ── Org-level default slots (product_id NULL) for Kroužek + Workshop ────────
  foreach act in array activities loop
    if not exists (select 1 from public.document_slots where org_id = vys and activity_type = act and product_id is null and label = 'Přihláška') then
      insert into public.document_slots (org_id, activity_type, label, fulfillment, template_id, required, sort_order, active)
      values (vys, act, 'Přihláška', 'electronic', tpl_prihlaska, true, 1, true);
    end if;
    if not exists (select 1 from public.document_slots where org_id = vys and activity_type = act and product_id is null and label = 'Prohlášení o zdravotním stavu') then
      insert into public.document_slots (org_id, activity_type, label, fulfillment, template_id, required, sort_order, active)
      values (vys, act, 'Prohlášení o zdravotním stavu', 'electronic', tpl_zdravi, true, 2, true);
    end if;
    if not exists (select 1 from public.document_slots where org_id = vys and activity_type = act and product_id is null and label = 'Souhlas se zpracováním osobních údajů (GDPR)') then
      insert into public.document_slots (org_id, activity_type, label, fulfillment, template_id, required, sort_order, active)
      values (vys, act, 'Souhlas se zpracováním osobních údajů (GDPR)', 'electronic', tpl_gdpr, true, 3, true);
    end if;
    if not exists (select 1 from public.document_slots where org_id = vys and activity_type = act and product_id is null and label = 'Souhlas s obchodními a storno podmínkami') then
      insert into public.document_slots (org_id, activity_type, label, fulfillment, template_id, required, sort_order, active)
      values (vys, act, 'Souhlas s obchodními a storno podmínkami', 'electronic', tpl_terms, true, 4, true);
    end if;
  end loop;
end $mig$;
