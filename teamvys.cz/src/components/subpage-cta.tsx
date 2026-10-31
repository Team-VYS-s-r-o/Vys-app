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

        {/*
          Telefon je vidět jen do poloviny — spodek zajíždí pod patu sekce.
          Vnější vrstva ořezává (poměr 1086 : 1448×VISIBLE), vnitřní drží
          celý obrázek, takže souřadnice displeje zůstávají platné:
          díra v obrázku x 243–838 z 1086, y 112–1347 z 1448.
        */}
        <div className="relative overflow-hidden" style={{ aspectRatio: '1086 / 797' }}>
          <div className="absolute inset-x-0 top-0" style={{ aspectRatio: '1086 / 1448' }}>
            {/* Obsah leží v průhledném výřezu displeje */}
            <div
              className="absolute z-0 overflow-hidden rounded-[7%/5%] bg-[#141020]"
              style={{ left: '22.38%', top: '7.73%', width: '54.88%', height: '85.36%' }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_50%_0%,rgba(139,29,255,0.3),transparent_60%)]"
              />
              <div className="relative flex h-full flex-col px-[8%] pt-[14%] text-center">
                <p className="text-[clamp(0.5rem,1.05vw,0.75rem)] font-bold uppercase tracking-[0.25em] text-brand-purple-light">
                  {eyebrow}
                </p>
                <h2 className="mx-auto mt-[5%] max-w-[16ch] text-[clamp(0.95rem,2.4vw,1.75rem)] font-black leading-[1.08] tracking-tight text-white">
                  {title}
                  {highlight ? <span className="text-brand-purple-light"> {highlight}</span> : null}
                </h2>

                <div className="mt-[9%] flex flex-col items-stretch gap-[3.5%]">
                  <Link
                    href={ctaHref}
                    className="group inline-flex h-[clamp(2rem,4.2vw,3rem)] items-center justify-center gap-2 rounded-full bg-brand-purple px-[6%] text-[clamp(0.6rem,1.25vw,0.875rem)] font-black text-white transition-transform hover:-translate-y-0.5"
                  >
                    {ctaLabel}
                    <ArrowRight className="h-[1em] w-[1em] transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  {secondaryHref && secondaryLabel ? (
                    <Link
                      href={secondaryHref}
                      className="inline-flex h-[clamp(2rem,4.2vw,3rem)] items-center justify-center rounded-full border border-white/15 px-[6%] text-[clamp(0.6rem,1.25vw,0.875rem)] font-black text-white/85 transition-colors hover:bg-white/10"
                    >
                      {secondaryLabel}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/telefon-cta.webp"
              alt=""
              aria-hidden
              className="pointer-events-none relative z-10 w-full select-none"
            />
          </div>
        </div>
      </motion.div>
    </section>
  );
}
