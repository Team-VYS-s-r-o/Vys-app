
import { PageHero } from '@/components/page-hero';
import { SubpageCta } from '@/components/subpage-cta';
import { WorkshopOffer, WorkshopSteps } from '@/components/workshop-sections';

export const metadata = {
  title: 'Workshopy s youtuberem pro děti',
  description:
    'Jednorázové workshopy s youtuberem pro děti — konkrétní triky, flow a bezpečný progres pod vedením trenérů Team VYS. Vstupenka s QR ticketem online.',
  alternates: { canonical: '/workshopy' },
  openGraph: {
    title: 'Workshopy s youtuberem pro děti · Team VYS',
    description:
      'Jednorázové workshopy s youtuberem pro děti — konkrétní triky, flow a bezpečný progres pod vedením trenérů Team VYS.',
    url: '/workshopy',
    type: 'website',
    locale: 'cs_CZ',
    images: [{ url: '/cats/workshop.png', alt: 'Workshopy s youtuberem — Team VYS' }],
  },
};

export default function WorkshopsPage() {
  return (
    <div className="bg-[#0B0B10] text-white">
      <PageHero
        eyebrow="Workshopy s youtuberem"
        title="Jednorázové akce pro rychlý progres"
        word="workshopy"
      />

      {/* Termíny, nebo „připravujeme", když žádný vypsaný není. */}
      <WorkshopOffer />

      {/* Jak workshop funguje — tři kroky s animovanou scénou. */}
      <WorkshopSteps />

      <SubpageCta
        title="Jeden workshop s youtuberem, viditelný posun."
        highlight="Vyzkoušej to."
        ctaHref="/aplikace"
        ctaLabel="Stáhnout aplikaci"
        secondaryHref="/krouzky"
        secondaryLabel="Spíš pravidelný kroužek"
      />
    </div>
  );
}
