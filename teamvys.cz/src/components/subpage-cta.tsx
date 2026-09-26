'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  eyebrow: string;
  title: string;
  highlight?: string;
  ctaHref: string;
  ctaLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

/** Closing CTA — a phone rising out of the footer's gradient line. */
export function SubpageCta({ eyebrow, title, highlight, ctaHref, ctaLabel, secondaryHref, secondaryLabel }: Props) {
  return (
    <section className="section-shell pt-16 md:pt-24">
      <motion.div
        initial={{ opacity: 0, y: 90 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, ease }}
        className="relative mx-auto w-full max-w-[460px]"
      >
        {/* Glow spilling from behind the phone onto the page */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-28 bottom-0 top-8 [background:radial-gradient(ellipse_at_50%_100%,rgba(139,29,255,0.35),transparent_65%)]"
        />

        {/* Phone frame — no bottom edge, it sinks into the footer line */}
        <div className="relative overflow-hidden rounded-t-[44px] border border-b-0 border-white/15 bg-[#141020] px-6 pb-16 pt-16 text-center md:px-10 md:pb-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_50%_0%,rgba(139,29,255,0.25),transparent_60%)]"
          />
          {/* Speaker slot */}
          <div aria-hidden className="absolute left-1/2 top-5 h-1.5 w-16 -translate-x-1/2 rounded-full bg-white/15" />

          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-purple-light">{eyebrow}</p>
            <h2 className="mx-auto mt-4 max-w-[16ch] text-2xl font-black leading-[1.08] tracking-tight text-white md:text-3xl">
              {title}
              {highlight ? <span className="text-brand-purple-light"> {highlight}</span> : null}
            </h2>

            <div className="mt-9 flex flex-col items-stretch gap-3">
              <Link
                href={ctaHref}
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-purple px-8 text-sm font-black text-white transition-transform hover:-translate-y-0.5"
              >
                {ctaLabel}
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              {secondaryHref && secondaryLabel ? (
                <Link
                  href={secondaryHref}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 px-8 text-sm font-black text-white/85 transition-colors hover:bg-white/10"
                >
                  {secondaryLabel}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
