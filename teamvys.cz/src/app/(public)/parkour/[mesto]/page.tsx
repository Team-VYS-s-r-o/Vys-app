import { Phone, ShieldCheck, Sparkles, Trophy, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageHero } from '@/components/page-hero';
import { phoneForCity } from '@shared/content';
import { SubpageCta } from '@/components/subpage-cta';
import { FeatureCard, SectionIntro } from '@/components/subpage-feature-card';
import { GoogleReviewCta } from '@/components/google-review';
import { CityFaq, CityGallery, CitySessionCard } from '@/components/city-showcase';
import { freeSpots, loadCities, loadCity, type City } from '@/lib/cities';
import { cityPhotos } from '@/lib/photos';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https')
  ? process.env.NEXT_PUBLIC_SITE_URL
  : 'https://teamvys.cz';

type Props = { params: Promise<{ mesto: string }> };

/** Nové město založené v adminu se vyrenderuje samo při první návštěvě. */
export const dynamicParams = true;
/** Rozvrhy a obsazenost se obnoví z adminu každou půlhodinu. */
export const revalidate = 1800;

export async function generateStaticParams() {
  const cities = await loadCities();
  return cities.map((c) => ({ mesto: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { mesto } = await params;
  const city = await loadCity(mesto);
  if (!city) return {};

  const title = `Parkour kroužek ${city.name} pro děti`;
  const schedule = city.sessions.map((s) => `${s.venue}, ${s.when}`).join(' · ');
  const description = `Parkour kroužek pro děti ${city.inCity} — ${schedule}. První lekce zdarma, certifikovaní trenéři, děti ${city.ageRange}. Permanentka od ${city.priceFrom.toLocaleString('cs-CZ')} Kč.`;

  return {
    title,
    description,
    alternates: { canonical: `/parkour/${city.slug}` },
    openGraph: {
      title: `${title} · Team VYS`,
      description,
      url: `/parkour/${city.slug}`,
      type: 'website',
      locale: 'cs_CZ',
      images: [
        { url: '/cats/parkour.png', width: 1307, height: 1203, alt: `Parkour kroužek ${city.name}` },
      ],
    },
  };
}

/** Otázky, na které se rodiče ptají nejčastěji — zároveň krmivo pro FAQ v Googlu. */
function faqFor(city: City) {
  const first = city.sessions[0];
  const start = first?.startsOn
    ? `Kroužek ${city.inCity} startuje ${first.startsOn} a pokračuje každý týden.`
    : `Kroužek ${city.inCity} běží průběžně celý školní rok, přijít se dá kdykoliv během roku.`;

  return [
    {
      q: 'Je první lekce opravdu zdarma?',
      a: `Ano. První trénink ${city.inCity} je zdarma a k ničemu nezavazuje — dítě si parkour vyzkouší a teprve pak se rozhodujete, jestli budete pokračovat. Stačí přijít, nemusíte se nikde dopředu registrovat.`,
    },
    {
      q: 'Pro jak staré děti je kroužek vhodný?',
      a: `Kroužek ${city.inCity} je pro děti ${city.ageRange} a předchozí zkušenost není potřeba. Začínáme od úplných základů — bezpečných dopadů, kotoulů a odhadu vlastních sil.`,
    },
    {
      q: 'Není parkour nebezpečný?',
      a: 'Trénujeme v tělocvičně, na žíněnkách a pod vedením certifikovaných trenérů. Učíme přesně to, co dítě chrání: jak bezpečně padat, jak si pohlídat vlastní limity a jak postupovat krok za krokem. Dítě, které umí padat, se méně zraní i na hřišti.',
    },
    {
      q: 'Kolik kroužek stojí?',
      a: city.membership
        ? `Platí se členství na období od ${city.priceFrom.toLocaleString('cs-CZ')} Kč. Po dobu členství chodí dítě na tréninky neomezeně.`
        : `Neplatí se měsíční paušál, ale permanentka na vstupy — ${city.priceFrom.toLocaleString('cs-CZ')} Kč za 10 vstupů nebo ${city.priceTo.toLocaleString('cs-CZ')} Kč za 15 vstupů. Vstupy nepropadají na konci pololetí, takže když dítě onemocní, o nic nepřijdete.`,
    },
    {
      q: 'Kdy kroužek začíná?',
      a: start,
    },
    {
      q: 'Co si má dítě vzít s sebou?',
      a: 'Sálové boty se světlou podrážkou, volné tričko, tepláky nebo kraťasy a pití. Nic dalšího není potřeba, veškeré vybavení máme.',
    },
  ];
}

export default async function CityPage({ params }: Props) {
  const { mesto } = await params;
  const city = await loadCity(mesto);
  if (!city) notFound();

  const faq = faqFor(city);
  const free = freeSpots(city);
  const photos = cityPhotos[city.slug] ?? [];
  const others = (await loadCities()).filter((c) => c.slug !== city.slug);
  const phone = phoneForCity(city.slug);

  const sportsLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    '@id': `${SITE_URL}/parkour/${city.slug}#location`,
    name: `Team VYS — parkour kroužek ${city.name}`,
    description: city.intro,
    url: `${SITE_URL}/parkour/${city.slug}`,
    parentOrganization: { '@id': `${SITE_URL}/#organization` },
    sport: 'Parkour',
    telephone: `+420${phone.replaceAll(' ', '')}`,
    email: 'info@teamvys.cz',
    priceRange: `${city.priceFrom} – ${city.priceTo} Kč`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: city.street,
      addressLocality: city.name,
      addressRegion: city.region,
      addressCountry: 'CZ',
    },
    areaServed: [city.name, ...city.nearby].map((n) => ({ '@type': 'Place', name: n })),
    openingHoursSpecification: city.sessions.map((s) => ({
      '@type': 'OpeningHoursSpecification',
      description: `${s.venue} — ${s.when}`,
    })),
  };

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <div className="bg-[#0B0B10] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsLd) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      <PageHero
        eyebrow="Parkour kroužek"
        title={`Parkour kroužek ${city.name} pro děti`}
        accent="pro děti"
        media={
          // Jen na širokých obrazovkách — názvy měst jsou dlouhé a na mobilu by kočka překryla nadpis.
          <Image
            src="/cats/parkour.png"
            alt=""
            width={1307}
            height={1203}
            priority
            className="hidden h-72 w-auto select-none drop-shadow-[0_16px_48px_rgba(139,29,255,0.35)] xl:block"
          />
        }
      />

      {/* Úvod ve stylu zbytku webu — karta s textem + rychlá fakta vedle. */}
      <section className="section-shell grid gap-6 pb-16 pt-8 md:pb-20 md:pt-12 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-purple/20 px-4 py-2 text-sm font-black text-white">
            <Sparkles size={15} className="text-brand-purple-light" /> První lekce zdarma — stačí přijít
          </p>
          <p className="mt-5 max-w-[62ch] text-lg leading-relaxed text-white/70">{city.intro}</p>
          <p className="mt-4 max-w-[62ch] leading-relaxed text-white/70">
            Učíme děti {city.ageRange} bezpečné dopady, kotouly a triky krok za krokem — na
            zkušenostech nezáleží, většina dětí k nám přichází úplně od nuly.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href="#terminy"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-purple px-7 text-sm font-black text-white transition-transform hover:-translate-y-0.5"
            >
              Vybrat termín
            </a>
            <Link
              href={`tel:+420${phone.replaceAll(' ', '')}`}
              className="inline-flex h-12 items-center gap-2 rounded-full border border-white/15 px-6 text-sm font-black text-white/80 transition-colors hover:border-brand-purple/60 hover:text-white"
            >
              <Phone size={15} className="text-brand-purple-light" />
              {phone}
            </Link>
          </div>
        </div>

        <div className="grid content-start grid-cols-2 gap-3">
          <CityFact label="Věk dětí" value={city.ageRange.replace(/^od (\d+) do (\d+)/, '$1–$2')} />
          <CityFact label="Cena" value={`od ${city.priceFrom.toLocaleString('cs-CZ')} Kč`} />
          <CityFact label="Termíny v týdnu" value={`${city.sessions.length}×`} />
          <CityFact label="Volná místa" value={free > 0 ? String(free) : 'pořadník'} />
        </div>
      </section>

      {photos.length ? (
        <section className="section-shell pb-16 md:pb-20">
          <CityGallery photos={photos} cityName={city.name} />
        </section>
      ) : null}

      {/* Kde a kdy — nejdůležitější blok stránky, proto hned pod úvodem. */}
      <section id="terminy" className="section-shell scroll-mt-24 pb-16 md:pb-24">
        <SectionIntro eyebrow="Kde a kdy" title={`Tréninky ${city.inCity}`} />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {city.sessions.map((sess, i) => (
            <CitySessionCard key={`${sess.venue}-${sess.when}`} session={sess} street={city.street} index={i} />
          ))}
        </div>

        <div className="mt-6 rounded-[22px] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-lg font-semibold">Kolik to stojí</p>
          {city.membership ? (
            <p className="mt-2 max-w-[62ch] text-white/70">
              Platí se členství na období —{' '}
              <strong className="text-white">od {city.priceFrom.toLocaleString('cs-CZ')} Kč</strong>. Po dobu členství
              chodí dítě na tréninky neomezeně, docházku vidíte v aplikaci.
            </p>
          ) : (
            <p className="mt-2 max-w-[62ch] text-white/70">
              Žádný měsíční paušál. Platí se permanentka na vstupy —{' '}
              <strong className="text-white">{city.priceFrom.toLocaleString('cs-CZ')} Kč za 10 vstupů</strong> nebo{' '}
              <strong className="text-white">{city.priceTo.toLocaleString('cs-CZ')} Kč za 15 vstupů</strong>.
              Vstupy nepropadají na konci pololetí, takže nemoc ani prázdniny nejsou problém. Docházku
              i zbývající vstupy vidíte v aplikaci.
            </p>
          )}
        </div>
      </section>

      <section className="section-shell pb-16 md:pb-24">
        <SectionIntro eyebrow="Proč zrovna parkour" title="Trénink, který má hlavu a patu" />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <FeatureCard
            index={0}
            icon={<ShieldCheck size={20} />}
            title="Bezpečně od základů"
            body="Dopady, kotouly a odhad vlastních sil. Trénujeme v tělocvičně na žíněnkách pod vedením certifikovaných trenérů."
          />
          <FeatureCard
            index={1}
            icon={<Trophy size={20} />}
            title="Pokrok je vidět"
            body="Dítě sbírá XP, odemyká nové triky a postupuje barevnými náramky. Vy to vidíte v aplikaci po každém tréninku."
          />
          <FeatureCard
            index={2}
            icon={<Users size={20} />}
            title="Parta, ne závod"
            body="Každý jede svým tempem. Nejsou tu výkonnostní tabulky ani vyřazování — děti si fandí navzájem."
          />
        </div>
      </section>

      <section className="section-shell pb-16 md:pb-24">
        <SectionIntro eyebrow="Časté dotazy" title={`Na co se rodiče ${city.inCity} ptají`} />
        <CityFaq items={faq} />
      </section>

      {city.nearby.length ? (
        <section className="section-shell pb-16">
          <p className="max-w-[70ch] text-white/60">
            Do kroužku {city.inCity} k nám jezdí děti také z okolí —{' '}
            {city.nearby.join(', ')}. {free > 0 ? `Momentálně máme volno pro ${free} dětí.` : ''}
          </p>
        </section>
      ) : null}

      <section className="section-shell pb-16 md:pb-24">
        <SectionIntro eyebrow="Další města" title="Kde ještě trénujeme" />
        <div className="mt-8 flex flex-wrap gap-3">
          {others.map((c) => (
            <Link
              key={c.slug}
              href={`/parkour/${c.slug}`}
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
            >
              Parkour {c.name}
            </Link>
          ))}
        </div>
      </section>

      <GoogleReviewCta city={city.inCity} />

      <SubpageCta
        title={`Přijďte si parkour ${city.inCity} zkusit.`}
        highlight="Nic za to nedáte."
        ctaHref="/krouzky"
        ctaLabel="Zobrazit kroužky"
        secondaryHref="/kontakty"
        secondaryLabel="Zeptat se"
      />
    </div>
  );
}

/** Dlaždice rychlého faktu vedle úvodu — stejný vizuál jako karty na Kontaktech. */
function CityFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-[12.5px] font-bold uppercase tracking-wide text-white/65 md:text-xs md:text-white/50">{label}</p>
      <p className="mt-1.5 text-xl font-black text-white md:text-2xl">{value}</p>
    </div>
  );
}
