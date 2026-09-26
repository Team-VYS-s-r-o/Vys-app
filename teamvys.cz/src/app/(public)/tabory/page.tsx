import { CalendarClock, ClipboardCheck, Shirt, Trophy, Users, Utensils } from 'lucide-react';

import { PageHero } from '@/components/page-hero';
import { PublicCampCatalog } from '@/components/public-admin-products';
import { SubpageCta } from '@/components/subpage-cta';
import { FeatureCard, SectionIntro } from '@/components/subpage-feature-card';
import { campSchedule } from '@shared/content';

export const metadata = {
  title: 'Tábory',
  description: 'Příměstské parkour tábory TeamVYS s trenéry, programem, jídlem a digitálními dokumenty pro rodiče.',
};

const includes = [
  { icon: <Utensils size={20} />, title: 'Jídlo a pitný režim', body: 'Obědy a svačiny po celý den, zdravá strava i pitný režim.' },
  { icon: <Shirt size={20} />, title: 'Táborové tričko', body: 'Designové tričko z nové letní kolekce TeamVYS.' },
  { icon: <Users size={20} />, title: 'Trenéři a animátoři', body: 'Certifikovaní trenéři a animátoři, kteří děti opravdu baví.' },
  { icon: <Trophy size={20} />, title: 'Trénink, hry a výzvy', body: 'Bohatý program: trénink, hry, překážková dráha i kreativní výzvy.' },
];

export default function CampsPage() {
  return (
    <div className="bg-[#0B0B10] text-white">
      <PageHero
        eyebrow="Příměstské tábory"
        title="Týden pohybu, her a parkour výzev"
        word="tábory"
      />

      {/* Katalog turnusů */}
      <section className="section-shell py-16 md:py-24">
        <SectionIntro eyebrow="Nabídka" title="Vyber si turnus" />
        <div className="mx-[calc(50%-50vw)] mt-10 bg-brand-paper p-4 shadow-[0_30px_80px_rgba(0,0,0,0.45)] md:mx-0 md:rounded-[28px] md:p-6 lg:p-8">
          <PublicCampCatalog />
        </div>
      </section>

      {/* Co je v ceně */}
      <section className="section-shell pb-16 md:pb-24">
        <SectionIntro eyebrow="Co je v ceně" title="Vše bez skrytých příplatků" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {includes.map((item, i) => (
            <FeatureCard key={item.title} icon={item.icon} title={item.title} body={item.body} index={i} />
          ))}
        </div>
      </section>

      {/* Typický den */}
      <section className="section-shell pb-16 md:pb-24">
        <SectionIntro eyebrow="Harmonogram" title="Typický den na táboře" />
        <ol className="mt-10 grid gap-3">
          {campSchedule.map((slot) => (
            <li
              key={slot.time}
              className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:flex-row sm:items-center sm:gap-6"
            >
              <span className="inline-flex w-max items-center gap-2 text-sm font-bold text-brand-purple-light sm:w-[170px]">
                <CalendarClock size={16} />
                {slot.time}
              </span>
              <div>
                <p className="text-base font-black text-white">{slot.title}</p>
                <p className="mt-0.5 text-sm leading-6 text-white/55">{slot.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-brand-purple/[0.08] p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-purple/20 text-brand-purple-light">
            <ClipboardCheck size={18} />
          </span>
          <div>
            <p className="text-sm font-black text-white">Bez ranního papírování</p>
            <p className="mt-0.5 text-sm leading-6 text-white/55">Přihláška, souhlasy i anamnéza jsou připravené v systému pro trenéra.</p>
          </div>
        </div>
      </section>

      <SubpageCta
        eyebrow="Léto 2026"
        title="Rezervuj místo na táboře"
        highlight="včas."
        ctaHref="/aplikace"
        ctaLabel="Stáhnout aplikaci"
        secondaryHref="/kontakty"
        secondaryLabel="Mám dotaz"
      />
    </div>
  );
}
