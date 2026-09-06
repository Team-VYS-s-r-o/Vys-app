'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  eyebrow: string;
  title: string;
  highlight?: string;
  body?: string;
  ctaHref: string;
  ctaLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

/** Bold closing CTA — a purple-glow panel that closes every subpage. */
export function SubpageCta({ title, highlight, body, ctaHref, ctaLabel, secondaryHref, secondaryLabel }: Props) {
  return (
    <section className="section-shell py-16 md:py-24">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease }}
        className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.03] px-6 py-16 text-center md:px-12 md:py-24"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_50%_0%,rgba(139,29,255,0.28),transparent_60%)]"
        />
        <div className="relative">
          <h2 className="mx-auto max-w-[20ch] text-3xl font-black leading-[1.05] tracking-tight text-white md:text-5xl">
            {title}
            {highlight ? <span className="text-brand-purple-light"> {highlight}</span> : null}
          </h2>
          {body ? <p className="mx-auto mt-5 max-w-[52ch] text-sm leading-8 text-white/60 md:text-base">{body}</p> : null}

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={ctaHref}
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-brand-purple px-8 text-sm font-black text-white transition-transform hover:-translate-y-0.5"
            >
              {ctaLabel}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            {secondaryHref && secondaryLabel ? (
              <Link
                href={secondaryHref}
                className="inline-flex h-12 items-center rounded-full border border-white/15 px-8 text-sm font-black text-white/85 transition-colors hover:bg-white/10"
              >
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
