-- Fix: parents were asked to agree to Team VYS storno podmínky before paying,
-- but the signable "Souhlas s obchodními a storno podmínkami" template only
-- contained generic clauses ("Seznámil/a jsem se s podmínkami…") without the
-- ACTUAL cancellation terms. The parent therefore couldn't read what they were
-- agreeing to. The mobile checklist already renders `body.clauses`, so we just
-- need to put the real storno text into the template body.
--
-- Text mirrors the public obchodní podmínky (aplikacevys.cz §5 "Platby rodičů").
--
-- Org-scoped to Team VYS only. Idempotent (updates by org_id + name).

do $mig$
declare
  vys uuid := '00000000-0000-4000-8000-000000000001';
begin
  update public.document_templates
  set body = $j$
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
  $j$::jsonb
  where org_id = vys
    and name = 'Souhlas s obchodními a storno podmínkami'
    and kind = 'electronic';
end $mig$;
