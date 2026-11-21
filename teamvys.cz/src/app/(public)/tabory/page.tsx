import { CampDay, CampDifferences, CampIncluded, CampOffer } from '@/components/camp-sections';
import { PageHero } from '@/components/page-hero';
import { SubpageCta } from '@/components/subpage-cta';

export const metadata = {
  title: 'Příměstské parkour tábory pro děti',
  description:
    'Příměstské parkour tábory pro děti s certifikovanými trenéry, programem, jídlem a digitálními dokumenty pro rodiče. Léto plné pohybu s Team VYS.',
  alternates: { canonical: '/tabory' },
  openGraph: {
    title: 'Příměstské parkour tábory pro děti · Team VYS',
    description:
      'Příměstské parkour tábory s certifikovanými trenéry, programem, jídlem a digitálními dokumenty pro rodiče.',
    url: '/tabory',
    type: 'website',
    locale: 'cs_CZ',
    images: [{ url: '/cats/tabor.png', alt: 'Příměstské parkour tábory — Team VYS' }],
  },
};

export default function CampsPage() {
  return (
    <div className="bg-[#0B0B10] text-white">
      <PageHero
        eyebrow="Příměstské tábory"
        title="Týden pohybu, her a parkour výzev"
        word="tábory"
      />

      {/* Turnusy, nebo „připravujeme" */}
      <CampOffer />

      {/* Co je v ceně — velký jezdící pás */}
      <section className="pb-20 md:pb-32">
        <div className="section-shell">
          <h2 className="text-3xl font-black tracking-tight text-white md:text-6xl">V ceně je všechno</h2>
          <p className="mt-3 max-w-xl text-base font-medium leading-7 text-white/65 md:text-lg">Žádné příplatky na místě.</p>
        </div>
        <div className="mt-10 md:mt-14">
          <CampIncluded />
        </div>
      </section>

      {/* Den na táboře */}
      <section className="section-shell pb-20 md:pb-32">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-balance text-3xl font-black leading-[1.02] tracking-tight text-white md:text-6xl">Den na táboře</h2>
          <p className="mx-auto mt-4 max-w-xl text-base font-medium leading-7 text-white/65 md:text-lg">Ráno dítě přivedeš, odpoledne si ho vyzvedneš.</p>
        </div>
        <div className="mt-12 md:mt-16">
          <CampDay />
        </div>
      </section>

      {/* Čím jsme jiní */}
      <section className="section-shell pb-20 md:pb-32">
        <h2 className="text-3xl font-black tracking-tight text-white md:text-6xl">Čím jsme jiní</h2>
        <div className="mt-8 md:mt-12">
          <CampDifferences />
        </div>
      </section>

      <SubpageCta
        title="Chceš vědět o táboře"
        highlight="jako první?"
        ctaHref="/kontakty"
        ctaLabel="Napiš nám"
        secondaryHref="/krouzky"
        secondaryLabel="Zatím zkus kroužek"
      />
    </div>
  );
}
