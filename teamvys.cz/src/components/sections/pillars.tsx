'use client';

import { ShieldCheck, Smartphone, Trophy, Users } from 'lucide-react';

import { Reveal } from '@/components/animated/reveal';
import { aboutPillars } from '@shared/content';

const icons = [ShieldCheck, Trophy, Users, Smartphone];

const accentColors = [
  'from-[#8B1DFF] to-[#F12BB3]',
  'from-[#F12BB3] to-[#8B1DFF]',
  'from-[#7C2DDB] to-[#E879F9]',
  'from-[#8B1DFF] to-[#F12BB3]',
];

export function PillarsSection() {
  return (
    <section className="section-shell py-24 md:py-32">
      <Reveal>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-cyan">Proč Team VYS</p>
        <h2 className="mt-4 max-w-[20ch] text-[clamp(2.4rem,5vw,4.5rem)] font-black leading-[0.94] tracking-[-0.03em] text-brand-ink">
          Bezpečný sport, který má energii hry i jasný systém.
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {aboutPillars.map((pillar, index) => {
          const Icon = icons[index % icons.length];
          const accent = accentColors[index % accentColors.length];
          const isLastOdd = aboutPillars.length % 2 === 1 && index === aboutPillars.length - 1;

          return (
            <Reveal key={pillar.title} delay={index * 70}>
              <div className={isLastOdd ? 'md:col-span-2 md:mx-auto md:w-[min(100%,720px)] lg:col-span-1 lg:mx-0 lg:w-auto' : ''}>
                <article className="relative overflow-hidden rounded-[32px] border border-brand-purple/12 bg-white p-8 shadow-brand-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-brand">
                  <div className="flex items-start gap-5">
                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br ${accent} text-white shadow-lg`}>
                      <Icon size={24} />
                    </div>
                    <span className="mt-1 text-[11px] font-black tracking-[0.2em] text-brand-pink">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="mt-6 text-[1.75rem] font-black leading-tight tracking-[-0.02em] text-brand-ink">
                    {pillar.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-7 text-brand-ink-soft">{pillar.body}</p>
                  <div className={`mt-6 h-1 w-12 rounded-full bg-gradient-to-r ${accent}`} />
                </article>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
