import { ArrowRight, PlayCircle } from 'lucide-react';
import Link from 'next/link';

import { PageHero } from '@/components/page-hero';
import { PublicCourseCatalog } from '@/components/public-admin-products';
import { SubpageCta } from '@/components/subpage-cta';
import { TrainingTimeline } from '@/components/training-timeline';
import { GoogleReviewCta } from '@/components/google-review';

export const metadata = {
  title: 'Parkour kroužky pro děti',
  description:
    'Pravidelné parkour kroužky pro děti ve Vyškově, Prostějově, Blansku, Brandýse nad Labem, Jeseníku a Praze. Permanentky 10 nebo 15 vstupů, certifikovaní trenéři.',
  alternates: { canonical: '/krouzky' },
  openGraph: {
    title: 'Parkour kroužky pro děti · Team VYS',
    description:
      'Pravidelné parkour kroužky pro děti po celém Česku. Permanentky 10 nebo 15 vstupů, certifikovaní trenéři a bezpečný progres od základů.',
    url: '/krouzky',
    type: 'website',
    locale: 'cs_CZ',
    images: [{ url: '/cats/parkour.png', width: 1307, height: 1203, alt: 'Parkour kroužky pro děti — Team VYS' }],
  },
};

export default function CoursesPage() {
  return (
    <div className="bg-[#0B0B10] text-white">
      <PageHero
        eyebrow="Pravidelné kroužky"
        title="Parkour kroužek u tebe ve městě"
        accent="ve městě"
      />

      <section className="section-shell py-16 md:py-24">
        <div className="mx-[calc(50%-50vw)] bg-brand-paper p-4 shadow-[0_30px_80px_rgba(0,0,0,0.45)] md:mx-0 md:rounded-[28px] md:p-6 lg:p-8">
          <PublicCourseCatalog />
        </div>
      </section>

      {/* Jak vypadá trénink — 60 minut v pěti částech */}
      <section className="section-shell pb-20 md:pb-32">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-balance text-3xl font-black leading-[1.02] tracking-tight text-white md:text-6xl">Trénink, který má hlavu a patu</h2>
          <p className="mx-auto mt-4 max-w-xl text-base font-medium leading-7 text-white/65 md:text-lg">Každá hodina má pět částí. Žádná není navíc.</p>
        </div>
        <div className="mt-12 md:mt-16">
          <TrainingTimeline />
        </div>

        {/* Permanentka */}
        <div className="mt-16 grid items-center gap-8 rounded-[2rem] border border-white/10 bg-gradient-to-br from-brand-purple/[0.16] to-white/[0.03] p-7 md:mt-24 md:grid-cols-[320px_1fr] md:gap-12 md:p-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/permanentka-karta.webp"
            alt="Permanentka Team VYS"
            className="mx-auto w-full max-w-[320px] -rotate-3 select-none rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.5)] transition-transform duration-500 hover:rotate-0 hover:scale-[1.03]"
          />
          <div>
            <h3 className="text-balance text-2xl font-black leading-tight tracking-tight text-white md:text-4xl">Platíš jen za tréninky, na které dítě přijde</h3>
            <p className="mt-3 max-w-xl text-base font-medium leading-7 text-white/65 md:text-lg">Permanentka na 10 nebo 15 vstupů. Vstup se odečte pípnutím kartičky. Žádný závazek na celý rok.</p>
            <Link
              href="/aplikace#navod"
              className="group mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-base font-black text-[#0B0B10] transition-transform hover:-translate-y-0.5"
            >
              <PlayCircle size={19} />
              Video návod: jak koupit permanentku
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      <GoogleReviewCta />

      <SubpageCta
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
