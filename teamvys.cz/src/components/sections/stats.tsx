'use client';

import { useInView } from 'framer-motion';
import { Activity, MapPin, Sparkles, Trophy } from 'lucide-react';
import { useRef } from 'react';

import { AnimatedStatValue } from '@/components/animated/animated-counter';
import { Reveal } from '@/components/animated/reveal';
import { useAdminCreatedProducts } from '@/lib/admin-created-products';
import { publicStatCards } from '@/lib/public-product-summary';

const icons = [Activity, MapPin, Sparkles, Trophy];

export function StatsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-90px' });
  const { products, loading } = useAdminCreatedProducts();
  const stats = publicStatCards(products, loading);

  return (
    <section ref={sectionRef} className="section-shell py-24 md:py-32">
      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
        <Reveal>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-cyan">Team VYS v číslech</p>
          <h2 className="mt-4 text-[clamp(2.4rem,5vw,4.5rem)] font-black leading-[0.94] tracking-[-0.03em] text-brand-ink">
            Děti rostou, rodiče mají přehled.
          </h2>
        </Reveal>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = icons[index % icons.length];
          return (
            <Reveal key={stat.label} delay={index * 70}>
              <div className="group relative overflow-hidden rounded-[28px] border border-brand-purple/12 bg-white p-6 shadow-brand-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-brand">
                <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-gradient-brand text-white shadow-md">
                  <Icon size={20} />
                </div>
                <span className="mt-5 block">
                  <AnimatedStatValue value={stat.value} delay={index * 100} className="text-[2.5rem] font-black leading-none tracking-[-0.03em] text-brand-ink sm:text-5xl" />
                </span>
                <p className="mt-2 text-xs font-bold leading-5 text-brand-ink-soft sm:text-sm">{stat.label}</p>
                <div aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-brand opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
