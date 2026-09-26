import { ScanLine, ShieldCheck, Trophy } from 'lucide-react';

import { PageHero } from '@/components/page-hero';
import { PublicCourseCatalog } from '@/components/public-admin-products';
import { SubpageCta } from '@/components/subpage-cta';
import { FeatureCard, SectionIntro } from '@/components/subpage-feature-card';

export const metadata = {
  title: 'Kroužky',
  description: 'Pravidelné parkour kroužky v 6 městech. Permanentky 10 nebo 15 vstupů s NFC docházkou.',
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
        <SectionIntro eyebrow="Proč kroužek" title="Trénink, který má hlavu a patu" />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {benefits.map((b, i) => (
            <FeatureCard key={b.title} {...b} index={i} />
          ))}
        </div>
      </section>

      <section className="section-shell pb-16 md:pb-24">
        <div className="mx-[calc(50%-50vw)] bg-brand-paper p-4 shadow-[0_30px_80px_rgba(0,0,0,0.45)] md:mx-0 md:rounded-[28px] md:p-6 lg:p-8">
          <PublicCourseCatalog />
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
