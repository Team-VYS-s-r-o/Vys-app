'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  eyebrow: string;
  title: string;
  body?: string;
  ctaHref?: string;
  ctaLabel?: string;
  /** Optional oversized outlined word echoed faintly behind the heading. */
  word?: string;
};

/** Premium dark page header shared across all public subpages. */
export function PageHero({ title, body, ctaHref, ctaLabel, word }: Props) {
  return (
    <section className="relative overflow-hidden bg-[#0B0B10] pt-36 md:pt-44">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_15%_0%,rgba(139,29,255,0.18),transparent_45%),radial-gradient(circle_at_90%_20%,rgba(178,59,255,0.10),transparent_45%)]"
      />

      {word ? (
        <div
          aria-hidden
          className="hero-outline-text pointer-events-none absolute -right-4 top-16 select-none text-[22vw] font-black uppercase leading-none tracking-tighter opacity-[0.05]"
          style={{ WebkitTextStrokeWidth: '1.5px' }}
        >
          {word}
        </div>
      ) : null}

      <div className="section-shell relative pb-16 md:pb-24">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.06, ease }}
          className="max-w-[15ch] text-4xl font-black leading-[1.02] tracking-tight text-white md:text-7xl"
        >
          {title}
        </motion.h1>

        {body ? (
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12, ease }}
            className="mt-6 max-w-[560px] text-base leading-8 text-white/60 md:text-lg"
          >
            {body}
          </motion.p>
        ) : null}

        {ctaHref && ctaLabel ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18, ease }}
            className="mt-9"
          >
            <Link
              href={ctaHref}
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-brand-purple px-7 text-sm font-black text-white transition-transform hover:-translate-y-0.5"
            >
              {ctaLabel}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        ) : null}
      </div>
    </section>
  );
}
