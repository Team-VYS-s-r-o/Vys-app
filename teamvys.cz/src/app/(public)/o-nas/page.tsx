import { AboutGyms, AboutManifesto, AboutPillars, AboutStats } from '@/components/about-sections';
import { PageHero } from '@/components/page-hero';
import { SubpageCta } from '@/components/subpage-cta';
import { createAdminSupabaseClient, hasSupabaseAdminConfig } from '@/lib/supabase/admin';
import { aboutText, stats } from '@shared/content';

export const metadata = {
  title: 'O nás — parkourová komunita pro děti',
  description:
    'Team VYS je parkourová komunita pro děti, teenagery a rodiče. Certifikovaní trenéři, skill tree, NFC docházka a kroužky po celém Česku.',
  alternates: { canonical: '/o-nas' },
  openGraph: {
    title: 'O nás · Team VYS',
    description:
      'Team VYS je parkourová komunita pro děti, teenagery a rodiče. Certifikovaní trenéři a kroužky po celém Česku.',
    url: '/o-nas',
    type: 'website',
    locale: 'cs_CZ',
    images: [{ url: '/cats/parkour.png', alt: 'Team VYS — o nás' }],
  },
};

// Refresh the live community count at most once per hour.
export const revalidate = 3600;

const VYS_ORG_ID = '00000000-0000-4000-8000-000000000001';

async function loadPeopleCount(): Promise<number | null> {
  if (!hasSupabaseAdminConfig()) return null;
  try {
    const supabase = createAdminSupabaseClient();
    const { count, error } = await supabase
      .from('app_profiles')
      .select('*', { count: 'exact', head: true })
      .in('role', ['participant', 'parent', 'coach']);
    if (error) return null;
    return count ?? null;
  } catch {
    return null;
  }
}

/** Počet měst s vypsaným kroužkem — živě z DB, ať číslo nezastarává jako dřív natvrdo zapsaná „6". */
async function loadCityCount(): Promise<number | null> {
  if (!hasSupabaseAdminConfig()) return null;
  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from('products')
      .select('city')
      .eq('org_id', VYS_ORG_ID)
      .eq('type', 'Kroužek')
      .eq('is_published', true);
    if (error || !data) return null;
    const cities = new Set(data.map((row) => (row.city ?? '').trim()).filter(Boolean));
    return cities.size > 0 ? cities.size : null;
  } catch {
    return null;
  }
}

export default async function AboutPage() {
  const [peopleCount, cityCount] = await Promise.all([loadPeopleCount(), loadCityCount()]);
  const displayStats = [
    { value: peopleCount != null ? String(peopleCount) : stats[0].value, label: 'lidí ve VYS' },
    { value: cityCount != null ? String(cityCount) : stats[1].value, label: stats[1].label },
    ...stats.slice(2),
  ];

  return (
    <div className="bg-[#0B0B10] text-white">
      <PageHero eyebrow="O nás" title="Pohyb s hlavou" word="komunita" />

      <AboutStats stats={displayStats} />

      <AboutManifesto text={aboutText} />

      <AboutPillars />

      <AboutGyms />

      <SubpageCta
        title="Začni s parkourem"
        highlight="bezpečně."
        ctaHref="/krouzky"
        ctaLabel="Najít kroužek"
        secondaryHref="/kontakty"
        secondaryLabel="Napsat nám"
      />
    </div>
  );
}
