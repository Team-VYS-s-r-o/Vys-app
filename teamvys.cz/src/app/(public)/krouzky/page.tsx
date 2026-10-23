import { ScanLine, ShieldCheck, Trophy } from 'lucide-react';
import Link from 'next/link';

import { PageHero } from '@/components/page-hero';
import { PublicCourseCatalog } from '@/components/public-admin-products';
import { SubpageCta } from '@/components/subpage-cta';
import { FeatureCard, SectionIntro } from '@/components/subpage-feature-card';
import { CITIES } from '@/lib/cities';

export const metadata = {
  title: 'Parkour kroužky pro děti',
  description:
    'Pravidelné parkour kroužky pro děti ve Vyškově, Prostějově, Blansku, Brandýse nad Labem, Jeseníku a Praze. Permanentky 10 nebo 15 vstupů, certifikovaní trenéři.',
  alternates: { canonical: '/krouzky' },
  openGraph: {
    title: 'Parkour kroužky pro děti · Team VYS',
    description:
      'Pravidelné parkour kroužky pro děti v 6 městech. Permanentky 10 nebo 15 vstupů, certifikovaní trenéři a bezpečný progres od základů.',
    url: '/krouzky',
    type: 'website',
    locale: 'cs_CZ',
    images: [{ url: '/cats/parkour.png', width: 1307, height: 1203, alt: 'Parkour kroužky pro děti — Team VYS' }],
  },
};

const benefits = [
  { icon: <ScanLine size={20} />, eyebrow: '10 / 15 vstupů', title: 'Permanentka, ne závazek', body: 'Vstupy se odečítají postupně přes NFC čip. Žádný závazek na celý rok.' },
  { icon: <ShieldCheck size={20} />, eyebrow: 'Bezpečně', title: 'Trénink od základů', body: 'Dopady, koordinace a triky krok za krokem pod dohledem certifikovaných trenérů.' },
  { icon: <Trophy size={20} />, eyebrow: 'Skill tree', title: 'Pokrok je vidět', body: 'Dítě sbírá XP, odemyká triky a postupuje barevnými náramky rovnou v appce.' },
];

export default function CoursesPage() {
  return (
    <div className="bg-[#0B0B10] text-white">
      <PageHero
        eyebrow="Pravidelné kroužky"
        title="Parkour kroužek u tebe ve městě"
        word="kroužky"
      />

      <section className="section-shell py-16 md:py-24">
        <div className="mx-[calc(50%-50vw)] bg-brand-paper p-4 shadow-[0_30px_80px_rgba(0,0,0,0.45)] md:mx-0 md:rounded-[28px] md:p-6 lg:p-8">
          <PublicCourseCatalog />
        </div>
      </section>

      <section className="section-shell pb-16 md:pb-24">
        <SectionIntro eyebrow="Proč kroužek" title="Trénink, který má hlavu a patu" />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {benefits.map((b, i) => (
            <FeatureCard key={b.title} {...b} index={i} />
          ))}
        </div>
      </section>

      {/* Rozcestník na lokální stránky — hlavní vstup z vyhledávání „parkour kroužek <město>“. */}
      <section className="section-shell pb-16 md:pb-24">
        <SectionIntro eyebrow="Podle města" title="Kde trénujeme" />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CITIES.map((city) => (
            <Link
              key={city.slug}
              href={`/parkour/${city.slug}`}
              className="group rounded-[20px] border border-white/10 bg-white/[0.04] p-5 transition hover:border-white/30 hover:bg-white/[0.07]"
            >
              <p className="text-lg font-bold tracking-tight">Parkour {city.name}</p>
              <p className="mt-1 text-sm text-white/60">
                {city.sessions.map((session) => session.when).join(' · ')}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <SubpageCta
        eyebrow="Přidej se"
        title="Místa v kroužcích mizí rychle."
        highlight="Rezervuj včas."
        ctaHref="/aplikace"
        ctaLabel="Stáhnout aplikaci"
        secondaryHref="/kontakty"
        secondaryLabel="Mám dotaz"
      />
    </div>
  );
}
