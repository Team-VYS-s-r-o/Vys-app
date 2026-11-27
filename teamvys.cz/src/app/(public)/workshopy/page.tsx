import { SubpageCta } from '@/components/subpage-cta';
import { FeaturedWorkshop, WorkshopsHero } from '@/components/workshop-feature';
import { WorkshopOffer, WorkshopSteps } from '@/components/workshop-sections';

export const metadata = {
  title: 'Parkour workshop s Vovou · 12. 12. 2026 Praha',
  description:
    'Parkour workshop pro děti s youtuberem Vovou (sonicvova) — sobota 12. 12. 2026, 14:00–18:00, Sokol Vršovice v Praze. Vstupenka 790 Kč s QR kódem v aplikaci Team VYS.',
  alternates: { canonical: '/workshopy' },
  openGraph: {
    title: 'Parkour workshop s Vovou · 12. 12. 2026 · Team VYS',
    description:
      'Čtyři hodiny parkouru s youtuberem Vovou naživo: seznámení, rozcvička, vystoupení, workshop, challenge a merch. Sokol Vršovice, Praha.',
    url: '/workshopy',
    type: 'website',
    locale: 'cs_CZ',
    images: [{ url: '/workshopy/vova-og.jpg', width: 1200, height: 630, alt: 'Parkour workshop s Vovou — Team VYS' }],
  },
};

export default function WorkshopsPage() {
  return (
    <div className="bg-[#0B0B10] text-white">
      {/* Nadpis podle toho, jestli je vypsaný workshop s hostem ještě před námi. */}
      <WorkshopsHero />

      {/* Vypsaný workshop: fotka a fakta, program na ciferníku, praktické věci, video návod. */}
      <FeaturedWorkshop />

      {/* Další termíny, nebo „připravujeme", když žádný vypsaný není. */}
      <WorkshopOffer />

      {/* Jak workshop obecně funguje — jen když žádný konkrétní vypsaný není. */}
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
