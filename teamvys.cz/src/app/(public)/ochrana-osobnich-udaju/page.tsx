import { Mail, MapPin, Phone } from 'lucide-react';
import Link from 'next/link';

import { PageHero } from '@/components/page-hero';
import { contacts } from '@shared/content';

export const metadata = {
  title: 'Ochrana osobních údajů',
  description:
    'Zásady ochrany osobních údajů parkour klubu Team VYS s.r.o. — jaké údaje o dětech a rodičích zpracováváme, z jakého důvodu, jak dlouho a jaká máte práva.',
  alternates: { canonical: '/ochrana-osobnich-udaju' },
  openGraph: {
    title: 'Ochrana osobních údajů · Team VYS',
    description:
      'Jaké osobní údaje Team VYS s.r.o. zpracovává, na jakém právním základě, jak dlouho je uchovává a jaká máte práva.',
    url: '/ochrana-osobnich-udaju',
    type: 'website',
    locale: 'cs_CZ',
    images: [{ url: '/cats/parkour.png', alt: 'Team VYS — ochrana osobních údajů' }],
  },
};

const EFFECTIVE_FROM = '14. 10. 2026';

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-[#0B0B10] text-white">
      <PageHero eyebrow="Právní informace" title="Ochrana osobních údajů" word="gdpr" />

      <section className="section-shell py-16 md:py-24">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.62fr]">
          <Card>
            <Eyebrow>Kdo jsme</Eyebrow>
            <h2 className="mt-2 text-2xl font-black md:text-3xl">Správce osobních údajů</h2>
            <p className="mt-4 text-sm leading-7 text-white/70">
              Správcem vašich osobních údajů je společnost <strong className="text-white">Team VYS s.r.o.</strong>,
              IČO {contacts.ico}, se sídlem Ruprechtov 198, 683 04 Ruprechtov, zapsaná v obchodním rejstříku.
              Provozujeme parkourové kroužky pro děti, příměstské tábory a workshopy.
            </p>
            <p className="mt-3 text-sm leading-7 text-white/70">
              Osobní údaje zpracováváme v souladu s nařízením Evropského parlamentu a Rady (EU) 2016/679 (GDPR)
              a se zákonem č. 110/2019 Sb., o zpracování osobních údajů.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <ContactRow icon={<Mail size={16} />} value={contacts.email} href={`mailto:${contacts.email}`} />
              <ContactRow
                icon={<Phone size={16} />}
                value={contacts.phone}
                href={`tel:${contacts.phone.replaceAll(' ', '')}`}
              />
              <ContactRow icon={<MapPin size={16} />} value="Ruprechtov 198, 683 04 Ruprechtov" />
            </div>
          </Card>

          <Card>
            <Eyebrow>Zkráceně</Eyebrow>
            <h2 className="mt-2 text-2xl font-black md:text-3xl">Co je dobré vědět</h2>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-white/70">
              <Bullet>Údaje sbíráme jen v rozsahu, který potřebujeme k vedení kroužku a k bezpečnosti dítěte.</Bullet>
              <Bullet>Osobní údaje nikdy neprodáváme ani nepředáváme pro cizí marketing.</Bullet>
              <Bullet>Fotky a videa z tréninků zveřejňujeme pouze s vaším souhlasem, který lze kdykoli odvolat.</Bullet>
              <Bullet>Jmenovaného pověřence pro ochranu osobních údajů (DPO) nemáme — píšete přímo nám.</Bullet>
            </ul>
            <p className="mt-6 text-xs font-bold uppercase tracking-widest text-white/40">
              Účinné od {EFFECTIVE_FROM}
            </p>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <Eyebrow>Rozsah</Eyebrow>
            <h2 className="mt-2 text-2xl font-black md:text-3xl">Jaké údaje zpracováváme</h2>
            <dl className="mt-5 space-y-5">
              <Item term="Údaje o dítěti">
                Jméno a příjmení, datum narození nebo věk, město a vybraný termín tréninku, docházka, postup v tzv.
                skill tree (nasbírané XP, odemčené triky, barva náramku).
              </Item>
              <Item term="Údaje o zákonném zástupci">
                Jméno a příjmení, e-mail, telefonní číslo, případně adresa pro fakturaci.
              </Item>
              <Item term="Údaje o zdraví dítěte">
                Pouze pokud nám je sami sdělíte — alergie, omezení, dlouhodobá onemocnění. Jde o zvláštní kategorii
                údajů, zpracováváme je výhradně na základě vašeho souhlasu a jen proto, abychom dítě na tréninku
                neohrozili.
              </Item>
              <Item term="Platební údaje">
                Historie objednávek, zaplacené permanentky a vstupy. Čísla platebních karet nikdy nevidíme ani
                neukládáme — platbu zpracovává poskytovatel platební brány.
              </Item>
              <Item term="Fotografie a video">
                Záznamy z tréninků, táborů a workshopů — pouze na základě samostatného souhlasu.
              </Item>
              <Item term="Údaje z poptávkových formulářů">
                Pokud vyplníte náš formulář na Facebooku nebo Instagramu (tzv. okamžitý formulář), dostaneme od
                společnosti Meta jméno, telefon, e-mail a věk dítěte, abychom se vám mohli ozvat s nabídkou kroužku.
              </Item>
              <Item term="Technické údaje">
                Při návštěvě webu a aplikace běžné provozní logy a cookies — viz sekce Cookies níže.
              </Item>
            </dl>
          </Card>

          <div className="flex flex-col gap-6">
            <Card>
              <Eyebrow>Právní základ</Eyebrow>
              <h2 className="mt-2 text-2xl font-black md:text-3xl">Proč to smíme zpracovávat</h2>
              <dl className="mt-5 space-y-5">
                <Item term="Plnění smlouvy — čl. 6 odst. 1 písm. b) GDPR">
                  Přihlášení dítěte do kroužku, na tábor nebo workshop, vedení docházky, vystavení permanentky a
                  komunikace o provozu.
                </Item>
                <Item term="Oprávněný zájem — čl. 6 odst. 1 písm. f) GDPR">
                  Bezpečnost na tréninku, ochrana našeho majetku a nároků, a dále kontaktování zájemců, kteří nám
                  sami nechali telefon v poptávkovém formuláři.
                </Item>
                <Item term="Souhlas — čl. 6 odst. 1 písm. a) a čl. 9 odst. 2 písm. a) GDPR">
                  Zdravotní údaje dítěte, fotografie a videa, zasílání newsletteru. Souhlas je dobrovolný a můžete ho
                  kdykoli odvolat, aniž by to ovlivnilo účast dítěte na kroužku.
                </Item>
                <Item term="Právní povinnost — čl. 6 odst. 1 písm. c) GDPR">
                  Vedení účetnictví a daňové evidence podle zákona.
                </Item>
              </dl>
            </Card>

            <Card>
              <Eyebrow>Doba uchování</Eyebrow>
              <h2 className="mt-2 text-2xl font-black md:text-3xl">Jak dlouho údaje držíme</h2>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-white/70">
                <Bullet>Údaje o dítěti a zákonném zástupci — po dobu účasti v klubu a 3 roky poté.</Bullet>
                <Bullet>Zdravotní údaje — pouze po dobu účasti dítěte, pak je mažeme.</Bullet>
                <Bullet>Účetní a daňové doklady — 10 let, jak vyžaduje zákon.</Bullet>
                <Bullet>Poptávky z reklamních formulářů — 6 měsíců od získání kontaktu.</Bullet>
                <Bullet>Fotografie a videa — do odvolání souhlasu.</Bullet>
              </ul>
            </Card>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <Eyebrow>Zpracovatelé</Eyebrow>
            <h2 className="mt-2 text-2xl font-black md:text-3xl">Komu se údaje dostanou</h2>
            <p className="mt-4 text-sm leading-7 text-white/70">
              Osobní údaje nezveřejňujeme ani neprodáváme. Předáváme je pouze trenérům a vedoucím Team VYS, kteří je
              potřebují k práci s dětmi, a dále níže uvedeným zpracovatelům, se kterými máme uzavřenou smlouvu o
              zpracování osobních údajů:
            </p>
            <dl className="mt-5 space-y-5">
              <Item term="Supabase">Databáze a hosting aplikace, servery v EU.</Item>
              <Item term="Vercel Inc.">Hosting webu teamvys.cz a aplikace.</Item>
              <Item term="Stripe">Zpracování platebních transakcí.</Item>
              <Item term="Meta Platforms Ireland Ltd.">
                Údaje z poptávkových formulářů na Facebooku a Instagramu, které vyplníte vy sami, a po vašem
                souhlasu v cookie liště také měření návštěvnosti a konverzí nástrojem Meta Pixel (včetně
                server-side Conversions API u dokončené platby).
              </Item>
              <Item term="Google Ireland Ltd.">
                Po vašem souhlasu v cookie liště anonymizované měření návštěvnosti webu a aplikace nástrojem
                Google Analytics 4.
              </Item>
              <Item term="Poskytovatel e-mailu a účetní kancelář">
                Doručování provozních e-mailů a vedení účetnictví.
              </Item>
            </dl>
            <p className="mt-5 text-sm leading-7 text-white/70">
              Pokud by k přenosu údajů mimo Evropský hospodářský prostor přece jen došlo, děje se tak na základě
              standardních smluvních klauzulí schválených Evropskou komisí.
            </p>
          </Card>

          <div className="flex flex-col gap-6">
            <Card>
              <Eyebrow>Vaše práva</Eyebrow>
              <h2 className="mt-2 text-2xl font-black md:text-3xl">Co můžete žádat</h2>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-white/70">
                <Bullet>Vědět, jaké údaje o vás a o dítěti vedeme, a dostat jejich kopii.</Bullet>
                <Bullet>Nechat nesprávné údaje opravit nebo doplnit.</Bullet>
                <Bullet>Nechat údaje vymazat, pokud je už nepotřebujeme a nedrží nás zákon.</Bullet>
                <Bullet>Omezit zpracování nebo proti němu vznést námitku.</Bullet>
                <Bullet>Získat údaje v přenositelném formátu.</Bullet>
                <Bullet>Kdykoli odvolat dříve udělený souhlas.</Bullet>
              </ul>
              <p className="mt-5 text-sm leading-7 text-white/70">
                Stačí napsat na{' '}
                <Link href={`mailto:${contacts.email}`} className="font-bold text-brand-purple-light hover:text-white">
                  {contacts.email}
                </Link>
                . Odpovídáme nejpozději do jednoho měsíce. Pokud s naším postupem nebudete souhlasit, můžete podat
                stížnost u Úřadu pro ochranu osobních údajů, Pplk. Sochora 27, 170 00 Praha 7, uoou.gov.cz.
              </p>
            </Card>

            <Card>
              <Eyebrow>Cookies</Eyebrow>
              <h2 className="mt-2 text-2xl font-black md:text-3xl">Soubory cookies</h2>
              <p className="mt-4 text-sm leading-7 text-white/70">
                Na webu používáme technicky nezbytné cookies, bez kterých by nefungovalo přihlášení a základní
                provoz stránek. Volitelné cookies — měření návštěvnosti a konverzí přes Meta Pixel a Google
                Analytics 4 — nastavujeme až po vašem souhlasu v cookie liště, kterou vidíte při první návštěvě.
                Souhlas lze kdykoli změnit vymazáním cookies v prohlížeči.
              </p>
            </Card>

            <Card>
              <Eyebrow>Změny</Eyebrow>
              <h2 className="mt-2 text-2xl font-black md:text-3xl">Aktualizace zásad</h2>
              <p className="mt-4 text-sm leading-7 text-white/70">
                Tyto zásady můžeme v budoucnu upravit — například když přidáme novou funkci do aplikace. Aktuální
                verze je vždy na této adrese. O podstatných změnách rodiče informujeme e-mailem.
              </p>
              <p className="mt-4 text-xs font-bold uppercase tracking-widest text-white/40">
                Verze účinná od {EFFECTIVE_FROM}
              </p>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">{children}</div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-widest text-brand-purple-light">{children}</p>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-pink" />
      <span>{children}</span>
    </li>
  );
}

function Item({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-black text-white">{term}</dt>
      <dd className="mt-1 text-sm leading-7 text-white/70">{children}</dd>
    </div>
  );
}

function ContactRow({ icon, value, href }: { icon: React.ReactNode; value: string; href?: string }) {
  const content = (
    <span className="flex items-start gap-2 text-sm font-semibold text-white/80">
      <span className="text-brand-pink">{icon}</span>
      {value}
    </span>
  );
  if (!href) return content;
  return (
    <Link href={href} className="transition-colors hover:text-white">
      {content}
    </Link>
  );
}
