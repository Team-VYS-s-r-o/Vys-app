import type { Metadata } from 'next';

import { PageHero } from '@/components/page-hero';
import { SubpageCta } from '@/components/subpage-cta';
import { WorkshopShowcase } from '@/components/workshop-feature';
import { WorkshopSteps } from '@/components/workshop-sections';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://server-psi-ochre-40.vercel.app';

type PublicProductRow = { type?: string; title?: string; primary_meta?: string; city?: string; hero_image?: string | null; is_published?: boolean };

/** Nejbližší vypsaný workshop — do titulku a náhledu při sdílení odkazu. */
async function nextWorkshop(): Promise<PublicProductRow | null> {
  try {
    const response = await fetch(`${API_URL}/api/public/products`, { next: { revalidate: 900 } });
    if (!response.ok) return null;
    const payload = (await response.json()) as { products?: PublicProductRow[] } | PublicProductRow[];
    const rows = Array.isArray(payload) ? payload : payload.products ?? [];
    const today = new Date().toISOString().slice(0, 10);
    const dated = rows
      .filter((row) => row.type === 'Workshop')
      .map((row) => {
        const match = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(row.primary_meta ?? '');
        return { row, iso: match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : null };
      })
      .filter((item) => !item.iso || item.iso >= today)
      .sort((a, b) => (a.iso ?? '9999').localeCompare(b.iso ?? '9999'));
    return dated[0]?.row ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const workshop = await nextWorkshop();
  const baseTitle = 'Workshopy s youtuberem pro děti';
  const baseDescription =
    'Jednorázové workshopy s youtuberem pro děti — triky, challenge a bezpečný progres pod vedením trenérů Team VYS. Vstupenka s QR kódem v aplikaci.';
  const title = workshop?.title ? `${workshop.title} · ${(workshop.primary_meta ?? '').split('·')[0].trim()}` : baseTitle;
  const description = workshop?.title
    ? `${workshop.title} — ${workshop.primary_meta ?? ''}${workshop.city ? `, ${workshop.city}` : ''}. Vstupenka s QR kódem v aplikaci Team VYS.`
    : baseDescription;
  // Fotka nahraná v adminu bývá vložená přímo v datech — do náhledu jde jen skutečná adresa obrázku.
  const hero = workshop?.hero_image ?? '';
  const image = hero.startsWith('/') || hero.startsWith('http') ? hero : '/cats/workshop.png';
  return {
    title,
    description,
    alternates: { canonical: '/workshopy' },
    openGraph: {
      title: `${title} · Team VYS`,
      description,
      url: '/workshopy',
      type: 'website',
      locale: 'cs_CZ',
      images: [{ url: image, alt: workshop?.title ?? 'Workshopy s youtuberem — Team VYS' }],
    },
  };
}

export default function WorkshopsPage() {
  return (
    <div className="bg-[#0B0B10] text-white">
      <PageHero eyebrow="Workshopy s youtuberem" title="Workshopy s youtuberem" accent="s youtuberem" />

      {/* Vypsané termíny (šablona z produktu v adminu), nebo „připravujeme". */}
      <WorkshopShowcase />

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
