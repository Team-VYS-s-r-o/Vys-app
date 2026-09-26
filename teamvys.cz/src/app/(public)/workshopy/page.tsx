import { QrCode, Sparkles, Target } from 'lucide-react';

import { PageHero } from '@/components/page-hero';
import { WorkshopBrowser } from '@/components/public-admin-products';
import { SubpageCta } from '@/components/subpage-cta';
import { FeatureCard, SectionIntro } from '@/components/subpage-feature-card';

export const metadata = {
  title: 'Workshopy',
  description: 'Jednorázové parkour workshopy TeamVYS pro konkrétní triky, flow a bezpečný progres.',
};

const workshopSteps = [
  { icon: <Target size={20} />, eyebrow: '01', title: 'Konkrétní triky', body: 'Každý workshop má jasné téma a triky, které se učíte krok za krokem.' },
  { icon: <QrCode size={20} />, eyebrow: '02', title: 'QR ticket', body: 'Po zaplacení se rodiči zobrazí digitální ticket pro kontrolu na místě.' },
  { icon: <Sparkles size={20} />, eyebrow: '03', title: 'Navazuje na skill tree', body: 'Trenér ví, které prvky může dítě dostat do svého profilu v appce.' },
];

export default function WorkshopsPage() {
  return (
    <div className="bg-[#0B0B10] text-white">
      <PageHero
        eyebrow="Workshopy a open jamy"
        title="Jednorázové akce pro rychlý progres"
        word="workshopy"
      />

      <section className="section-shell py-16 md:py-24">
        <SectionIntro eyebrow="Nejbližší akce" title="Workshopy s digitálním ticketem" />
        <div className="mx-[calc(50%-50vw)] mt-10 bg-brand-paper p-4 shadow-[0_30px_80px_rgba(0,0,0,0.45)] md:mx-0 md:rounded-[28px] md:p-6 lg:p-8">
          <WorkshopBrowser />
        </div>
      </section>

      <section className="section-shell pb-16 md:pb-24">
        <SectionIntro eyebrow="Jak to funguje" title="Jednorázově, ale s výsledkem" />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {workshopSteps.map((s, i) => (
            <FeatureCard key={s.title} {...s} index={i} />
          ))}
        </div>
      </section>

      <SubpageCta
        eyebrow="Jednorázové akce"
        title="Jeden workshop, viditelný posun."
        highlight="Vyzkoušej to."
        ctaHref="/aplikace"
        ctaLabel="Stáhnout aplikaci"
        secondaryHref="/krouzky"
        secondaryLabel="Spíš pravidelný kroužek"
      />
    </div>
  );
}
