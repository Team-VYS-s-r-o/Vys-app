import { ShieldCheck, Smartphone, Trophy, Users } from 'lucide-react';

import { PageHero } from '@/components/page-hero';
import { SubpageCta } from '@/components/subpage-cta';
import { FeatureCard, SectionIntro } from '@/components/subpage-feature-card';
import { createAdminSupabaseClient, hasSupabaseAdminConfig } from '@/lib/supabase/admin';
import { aboutPillars, stats } from '@shared/content';

export const metadata = {
  title: 'O nás',
  description: 'TeamVYS je parkourová komunita pro děti, teenagery a rodiče se skill tree, NFC docházkou a zkušenými trenéry.',
};

const icons = [<ShieldCheck key="s" size={20} />, <Trophy key="t" size={20} />, <Users key="u" size={20} />, <Smartphone key="m" size={20} />];

// Refresh the live community count at most once per hour.
export const revalidate = 3600;

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

export default async function AboutPage() {
  const peopleCount = await loadPeopleCount();
  const displayStats = [
    { value: peopleCount != null ? String(peopleCount) : stats[0].value, label: 'lidí ve VYS' },
    ...stats.slice(1),
  ];

  return (
    <div className="bg-[#0B0B10] text-white">
      <PageHero eyebrow="O nás" title="Pohyb s hlavou" word="komunita" />

      {/* Stats band */}
      <section className="section-shell py-16 md:py-20">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {displayStats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <p className="text-4xl font-black text-white md:text-5xl">{stat.value}</p>
              <p className="mt-2 text-sm font-medium text-white/55">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section-shell pb-16 md:pb-24">
        <SectionIntro eyebrow="Jak trénujeme" title="Parkour je cesta, ne jednorázový výkon" />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {aboutPillars.map((pillar, index) => (
            <FeatureCard
              key={pillar.title}
              icon={icons[index % icons.length]}
              title={pillar.title}
              body={pillar.body}
              index={index}
            />
          ))}
        </div>
      </section>

      <SubpageCta
        eyebrow="Pojď do toho"
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
