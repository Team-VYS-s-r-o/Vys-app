'use client';

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';

type Props = {
  eyebrow: string;
  title: string;
  highlight?: string;
  ctaHref: string;
  ctaLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

/** Closing CTA — a phone that smoothly rises out of the footer line as you scroll. */
export function SubpageCta({ eyebrow, title, highlight, ctaHref, ctaLabel, secondaryHref, secondaryLabel }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);

  // Scrubbed by scroll: progress 0 = section entering the viewport bottom,
  // progress 1 = section fully revealed. Scrolling back down tucks the phone away again.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end end'] });
  const rawY = useTransform(scrollYProgress, [0, 1], [220, 0]);
  const y = useSpring(rawY, { stiffness: 110, damping: 22, mass: 0.6 });
  const opacity = useTransform(scrollYProgress, [0, 0.4], [0.2, 1]);

  return (
    <section ref={sectionRef} className="section-shell overflow-hidden pt-16 md:pt-24">
      <motion.div
        style={prefersReducedMotion ? undefined : { y, opacity }}
        className="relative mx-auto w-full max-w-[760px]"
      >
        {/* Glow spilling from behind the phone onto the page */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-28 bottom-0 top-8 [background:radial-gradient(ellipse_at_50%_100%,rgba(139,29,255,0.35),transparent_65%)]"
        />

        <div className="relative">
          {/*
            Obsah leží v průhledném výřezu displeje kočičího telefonu.
            Souřadnice odpovídají díře v obrázku (x 282–789 z 1073,
            y 109–1208 z 1465) — při změně obrázku je přepočítat.
          */}
          <div
            className="absolute z-0 overflow-hidden rounded-[6%/4%] bg-[#141020]"
            style={{ left: '26.28%', top: '7.44%', width: '47.34%', height: '75.09%' }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_50%_0%,rgba(139,29,255,0.3),transparent_65%)]"
            />
            <div className="relative flex h-full flex-col justify-center px-[7%] pb-[14%] text-center">
              <p className="text-[clamp(0.5rem,1.1vw,0.75rem)] font-bold uppercase tracking-[0.25em] text-brand-purple-light">
                {eyebrow}
              </p>
              <h2 className="mx-auto mt-[4%] max-w-[16ch] text-[clamp(0.95rem,2.6vw,1.75rem)] font-black leading-[1.08] tracking-tight text-white">
                {title}
                {highlight ? <span className="text-brand-purple-light"> {highlight}</span> : null}
              </h2>

              <div className="mt-[9%] flex flex-col items-stretch gap-[4%]">
                <Link
                  href={ctaHref}
                  className="group inline-flex h-[clamp(2rem,4.4vw,3rem)] items-center justify-center gap-2 rounded-full bg-brand-purple px-[6%] text-[clamp(0.6rem,1.3vw,0.875rem)] font-black text-white transition-transform hover:-translate-y-0.5"
                >
                  {ctaLabel}
                  <ArrowRight className="h-[1em] w-[1em] transition-transform group-hover:translate-x-0.5" />
                </Link>
                {secondaryHref && secondaryLabel ? (
                  <Link
                    href={secondaryHref}
                    className="inline-flex h-[clamp(2rem,4.4vw,3rem)] items-center justify-center rounded-full border border-white/15 px-[6%] text-[clamp(0.6rem,1.3vw,0.875rem)] font-black text-white/85 transition-colors hover:bg-white/10"
                  >
                    {secondaryLabel}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          {/* Kočičí packa s telefonem — leží nad obsahem, proklik jde skrz. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/kocka-telefon.webp"
            alt=""
            aria-hidden
            className="pointer-events-none relative z-10 w-full select-none drop-shadow-[0_30px_60px_rgba(0,0,0,0.5)]"
          />
        </div>
      </motion.div>
    </section>
  );
}
