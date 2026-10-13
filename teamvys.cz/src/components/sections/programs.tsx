'use client';

import { ArrowRight, Package, TreePine } from 'lucide-react';
import Link from 'next/link';

import { Reveal } from '@/components/animated/reveal';

const programs = [
  {
    href: '/krouzky' as const,
    eyebrow: 'Pravidelně',
    title: 'Kroužky',
    panel: 'bg-[linear-gradient(160deg,#f4edff_0%,#ead8ff_100%)]',
    motif: 'crate' as const,
  },
  {
    href: '/tabory' as const,
    eyebrow: 'Léto',
    title: 'Tábory',
    panel: 'bg-[linear-gradient(160deg,#fff6e8_0%,#ffe7bf_100%)]',
    motif: 'tree' as const,
  },
  {
    href: '/workshopy' as const,
    eyebrow: 'Jednorázově',
    title: 'Workshopy s youtuberem',
    panel: 'bg-[linear-gradient(160deg,#ffeef8_0%,#ffd7ef_100%)]',
    motif: 'growth' as const,
  },
];

export function ProgramsSection() {
  return (
    <section className="section-shell py-24 md:py-32">
      <Reveal>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-pink">Nabídka</p>
        <h2 className="mt-4 max-w-[16ch] text-[clamp(2.4rem,5vw,4.5rem)] font-black leading-[0.94] tracking-[-0.03em] text-brand-ink">
          Vyber cestu, která sedí tempu dítěte.
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {programs.map((program, i) => (
          <Reveal key={program.href} delay={i * 80}>
            <Link href={program.href} className="group block">
              <article className="overflow-hidden rounded-[34px] border border-brand-purple/15 bg-[#f5f4f8] p-4 shadow-[0_24px_48px_rgba(35,17,67,0.10)] transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_34px_70px_rgba(35,17,67,0.18)]">
                <div className={`relative flex h-[250px] items-end justify-center overflow-hidden rounded-[28px] ${program.panel}`}>
                  <ProgramMotif motif={program.motif} />
                </div>

                <div className="px-4 pb-3 pt-6">
                  <p className="text-[12px] font-black uppercase tracking-[0.2em] text-brand-ink-soft">{program.eyebrow}</p>
                  <h3
                    className={`mt-2 font-black leading-[0.92] tracking-[-0.03em] text-brand-ink ${
                      program.title.length > 8 ? 'text-[clamp(2.25rem,4vw,3.4rem)]' : 'text-[clamp(2.6rem,4.6vw,4rem)]'
                    }`}
                  >
                    {program.title}
                  </h3>

                  <div className="mt-5 inline-flex items-center gap-2 text-[18px] font-semibold text-[#0071e3] transition-all duration-300 group-hover:gap-3">
                    Více
                    <ArrowRight size={16} />
                  </div>
                </div>
              </article>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function ProgramMotif({ motif }: { motif: 'crate' | 'tree' | 'growth' }) {
  if (motif === 'crate') {
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="absolute h-40 w-40 rounded-full bg-brand-purple/12 blur-2xl" />
        <Package size={184} strokeWidth={1.8} className="text-brand-purple/45" />
      </div>
    );
  }

  if (motif === 'tree') {
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="absolute h-40 w-40 rounded-full bg-brand-purple/14 blur-2xl" />
        <TreePine size={198} strokeWidth={1.8} className="text-brand-purple/45" />
      </div>
    );
  }

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="absolute h-44 w-44 rounded-full bg-brand-pink/14 blur-2xl" />
      <svg viewBox="0 0 220 150" className="h-[126px] w-[176px] text-brand-pink/50" fill="none">
        <path d="M24 126H196" stroke="currentColor" strokeWidth="7" strokeLinecap="round" opacity="0.45" />
        <path d="M28 112L84 88L122 98L188 40" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M170 38H190V58" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
