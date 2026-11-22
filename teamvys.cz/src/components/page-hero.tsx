'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';

const EASE = [0.22, 1, 0.36, 1] as const;

type Props = {
  /** Ponecháno kvůli volajícím — štítek nad nadpisem se nezobrazuje (kickery David nechce). */
  eyebrow?: string;
  title: string;
  /** Konec nadpisu, který dostane barevný přechod (např. „ve městě"). */
  accent?: string;
  ctaHref?: string;
  ctaLabel?: string;
  /** Ponecháno kvůli volajícím — obrysové slovo v pozadí bylo zrušené. */
  word?: string;
  /** Volitelný vizuál (video/obrázek maskota) posazený k pravému spodnímu okraji. */
  media?: React.ReactNode;
};

/**
 * Velký nadpis, jehož slova postupně vyjedou zpod linky. Slova z `accent`
 * mají barevný přechod, který se pomalu přelévá. Nic dalšího v pozadí.
 * Sdílí ho hlavička podstránek i úvod stránky Aplikace.
 */
export function HeroTitle({ title, accent, className, delay = 0.05 }: { title: string; accent?: string; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  const words = title.split(' ');
  const accentWords = accent ? accent.split(' ').length : 0;
  const accentFrom = accent && title.endsWith(accent) ? words.length - accentWords : words.length;

  return (
    <h1 className={className} aria-label={title}>
      {words.map((word, i) => {
        const isAccent = i >= accentFrom;
        return (
          // pb/-mb: maska nesmí useknout ocásky písmen (ý, p, j)
          <span key={`${word}-${i}`} aria-hidden className="mr-[0.22em] inline-block overflow-hidden pb-[0.14em] -mb-[0.14em] align-bottom last:mr-0">
            <motion.span
              className={isAccent ? 'hero-accent inline-block' : 'inline-block'}
              initial={reduced ? false : { y: '108%', rotate: 4 }}
              animate={{ y: '0%', rotate: 0 }}
              transition={{ duration: 0.9, delay: delay + i * 0.075, ease: EASE }}
            >
              {word}
            </motion.span>
          </span>
        );
      })}
    </h1>
  );
}

/** Úvod podstránek: jen velký nadpis, který se při načtení poskládá a při scrollu odplouvá. */
export function PageHero({ title, accent, ctaHref, ctaLabel, media }: Props) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 90]);
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, reduced ? 1 : 0]);
  const words = title.split(' ').length;

  return (
    <section ref={ref} className="relative overflow-hidden bg-[#0B0B10] pt-36 md:pt-48">
      {media ? (
        <motion.div
          aria-hidden
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5, ease: EASE }}
          className="pointer-events-none absolute bottom-0 right-2 z-10 md:right-[7%]"
        >
          {media}
        </motion.div>
      ) : null}

      <motion.div style={{ y, opacity }} className="section-shell relative pb-16 md:pb-28">
        <HeroTitle
          title={title}
          accent={accent}
          className="max-w-[14ch] text-balance text-[clamp(2.6rem,11.5vw,7.25rem)] font-black leading-[0.98] tracking-[-0.035em] text-white"
        />

        {ctaHref && ctaLabel ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 + words * 0.075, ease: EASE }}
            className="mt-10"
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
      </motion.div>
    </section>
  );
}
