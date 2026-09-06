'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { displayFont } from '@/lib/home-font';

const ease = [0.22, 1, 0.36, 1] as const;

type Chapter = {
  key: string;
  label: string;
  copy: string;
  cta: { label: string; href: string };
  /** Accent used for the per-chapter background glow. */
  color: string;
  /** Mascot image that peeks in from the bottom-right (desktop only). */
  mascot: string;
  /** Optional size override for mascots with a taller/wider pose (e.g. holding a trophy). */
  mascotSizeClassName?: string;
};

const MASCOT_SIZE = 'bottom-0 left-1/2 -translate-x-1/2 h-[38dvh] w-[80vw] max-w-[380px] sm:left-auto sm:right-0 sm:translate-x-0 sm:h-[38dvh] sm:w-[26vw] sm:max-w-[340px] lg:h-[52dvh] lg:w-[38vw] lg:max-w-[540px] xl:h-[56dvh] xl:w-[36vw] xl:max-w-[580px]';
const MASCOT_SIZE_COMPACT = 'bottom-0 left-1/2 -translate-x-1/2 h-[32dvh] w-[66vw] max-w-[300px] sm:left-auto sm:right-0 sm:translate-x-0 sm:h-[30dvh] sm:w-[21vw] sm:max-w-[270px] lg:h-[41dvh] lg:w-[30vw] lg:max-w-[430px] xl:h-[44dvh] xl:w-[28vw] xl:max-w-[460px]';

const chapters: Chapter[] = [
  {
    key: 'krouzky',
    label: 'Kroužky',
    copy: 'Pravidelný trénink každý týden v šesti městech s certifikovanými trenéry. Permanentka na 10 nebo 15 vstupů se odečítá postupně přes NFC čip, takže žádný závazek na celý rok. Dítě sbírá XP, odemyká triky a vidí svůj postup rovnou v appce.',
    cta: { label: 'Vybrat kroužek', href: '/krouzky' },
    color: 'rgba(235,225,205,0.24)',
    mascot: '/cats/parkour.png',
  },
  {
    key: 'workshopy',
    label: 'Workshopy',
    copy: 'Jednorázové parkour akce s jasným tématem — každý workshop má konkrétní triky, které se učíte krok za krokem. Po zaplacení dostaneš digitální QR ticket ke kontrole na místě a trenér ví přesně, které prvky může dítěti zapsat do profilu.',
    cta: { label: 'Vybrat workshop', href: '/workshopy' },
    color: 'rgba(244,114,182,0.30)',
    mascot: '/cats/workshop.png',
    mascotSizeClassName: MASCOT_SIZE_COMPACT,
  },
  {
    key: 'tabory',
    label: 'Tábory',
    copy: 'Týden pohybu, her a parkour výzev s jasným režimem dne. Jídlo, pitný režim i táborové tričko jsou v ceně, dohled mají certifikovaní trenéři a animátoři. Dokumenty a přihlášku vyřešíš online předem, první den stačí jen nahlásit jméno.',
    cta: { label: 'Vybrat tábor', href: '/tabory' },
    color: 'rgba(234,179,8,0.26)',
    mascot: '/cats/tabor.png',
  },
  {
    key: 'aplikace',
    label: 'Aplikace',
    copy: 'Appka, ve které trénink pokračuje i doma. Dítě v ní sbírá XP a odemyká nové triky na skill tree, rodič má na jednom místě docházku, platby i permanentku, trenér zapisuje body přes NFC čip nebo QR kód místo papírového archu.',
    cta: { label: 'Zjistit víc o appce', href: '/aplikace' },
    color: 'rgba(139,29,255,0.32)',
    mascot: '/cats/apka.png',
  },
];

export function HomeHero() {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] });

  // On phones the copy + CTA sit under the mascot, so the chapter content needs to
  // ride further up than on desktop (where the mascot is off to the side). The intro
  // stays centred either way because its shift value is 0vh.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Slide 0 is the plain "Team VYS" brand word; slides 1-4 are the chapters.
  // Each fades in, holds, then fades out — except the last, which stays once revealed.
  // The whole headline starts slightly above centre and eases further up as scrolling
  // begins, so there isn't dead space above PARKOUR before the word-swap kicks in.
  const contentY = useTransform(scrollYProgress, [0, 0.09], ['0dvh', isMobile ? '-30dvh' : '-17dvh']);
  const s0Opacity = useTransform(scrollYProgress, [0, 0.05, 0.09], [1, 1, 0]);
  const s0Y = useTransform(scrollYProgress, [0, 0.09], [0, -16]);
  const s1Opacity = useTransform(scrollYProgress, [0.05, 0.11, 0.24, 0.3], [0, 1, 1, 0]);
  const s1Y = useTransform(scrollYProgress, [0.05, 0.11], [20, 0]);
  const s2Opacity = useTransform(scrollYProgress, [0.3, 0.36, 0.49, 0.55], [0, 1, 1, 0]);
  const s2Y = useTransform(scrollYProgress, [0.3, 0.36], [20, 0]);
  const s3Opacity = useTransform(scrollYProgress, [0.55, 0.61, 0.74, 0.8], [0, 1, 1, 0]);
  const s3Y = useTransform(scrollYProgress, [0.55, 0.61], [20, 0]);
  const s4Opacity = useTransform(scrollYProgress, [0.8, 0.86], [0, 1]);
  const s4Y = useTransform(scrollYProgress, [0.8, 0.86], [20, 0]);

  const slideMotion = [
    { opacity: s0Opacity, y: s0Y },
    { opacity: s1Opacity, y: s1Y },
    { opacity: s2Opacity, y: s2Y },
    { opacity: s3Opacity, y: s3Y },
    { opacity: s4Opacity, y: s4Y },
  ];

  const words = ['Team VYS', ...chapters.map((c) => c.label)];

  return (
    <section ref={containerRef} className="relative bg-[#0B0B10] h-[360vh]">
      <div className="relative sticky top-0 flex h-dvh flex-col items-center justify-center overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_18%_22%,rgba(139,29,255,0.14),transparent_42%),radial-gradient(circle_at_82%_78%,rgba(178,59,255,0.10),transparent_46%)]"
        />

        {/* Per-chapter background glow that fades in as each chapter appears. */}
        {prefersReducedMotion
          ? null
          : chapters.map((chapter, index) => (
              <motion.div
                key={`tint-${chapter.key}`}
                aria-hidden
                style={{ opacity: slideMotion[index + 1].opacity, background: `radial-gradient(circle at 82% 80%, ${chapter.color}, transparent 58%)` }}
                className="pointer-events-none absolute inset-0"
              />
            ))}

        {/* Per-chapter mascot peeking in from the bottom-right (desktop only). */}
        {prefersReducedMotion
          ? null
          : chapters.map((chapter, index) => (
              <motion.div
                key={`mascot-${chapter.key}`}
                aria-hidden
                style={{ opacity: slideMotion[index + 1].opacity }}
                className={`pointer-events-none absolute select-none ${chapter.mascotSizeClassName ?? MASCOT_SIZE}`}
              >
                <div aria-hidden className="absolute inset-0 [background:radial-gradient(circle_at_50%_78%,rgba(255,255,255,0.16),transparent_60%)]" />
                <Image src={chapter.mascot} alt="" fill sizes="(min-width: 1024px) 620px, 300px" className="object-contain object-bottom sm:object-right-bottom" priority={index === 0} />
              </motion.div>
            ))}

        <motion.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="section-shell relative flex w-full justify-start text-left"
        >
          {/* Headline block: this is what actually gets vertically centered in the viewport.
              The paragraph/CTA area below is absolutely positioned so it never affects that. */}
          <motion.div className="relative flex w-full flex-col items-center text-center sm:items-start sm:text-left" style={prefersReducedMotion ? undefined : { y: contentY }}>
            <h1
              className={`${displayFont.className} block text-[clamp(2.3rem,11vw,9.5rem)] font-extrabold uppercase leading-[0.94] tracking-[-0.03em] text-white`}
            >
              parkour
            </h1>

            {/* Swappable headline word: "Team VYS" crossfades into each chapter's name, in place.
                Rendered as an outlined (stroked) word so it reads as a secondary title. */}
            <div className="relative grid w-full place-items-center sm:place-items-start">
              {words.map((word, index) => (
                <motion.span
                  key={word}
                  style={prefersReducedMotion ? { opacity: index === 1 ? 1 : 0 } : slideMotion[index]}
                  className={`${displayFont.className} hero-outline-text col-start-1 row-start-1 block text-[clamp(2.3rem,11vw,9.5rem)] font-extrabold uppercase leading-[0.94] tracking-[-0.03em]`}
                >
                  {word}
                </motion.span>
              ))}
            </div>

            {/* Supporting copy + CTA per chapter, synced with the headline word above.
                Positioned out of flow so it doesn't shift the headline's centering. */}
            <div className="absolute inset-x-0 mx-auto top-full mt-8 grid w-[86vw] max-w-[600px] place-items-center text-center sm:inset-x-auto sm:left-0 sm:right-auto sm:mx-0 sm:mt-12 sm:place-items-start sm:text-left md:mt-14">
              {chapters.map((chapter, index) => (
                <motion.div
                  key={chapter.key}
                  style={prefersReducedMotion ? { opacity: index === 0 ? 1 : 0 } : slideMotion[index + 1]}
                  className="col-start-1 row-start-1 flex w-full max-w-[56ch] flex-col items-center gap-5 text-center sm:items-start sm:gap-7 sm:text-left"
                >
                  <p className="text-lg leading-8 text-white/85 sm:text-xl sm:leading-9 md:text-2xl md:leading-10">{chapter.copy}</p>
                  <Link
                    href={chapter.cta.href}
                    className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-purple px-7 text-base font-black text-white transition-transform hover:-translate-y-0.5"
                  >
                    {chapter.cta.label}
                    <ArrowRight size={18} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll hint on the intro — fades away as the story begins. */}
        <motion.div
          aria-hidden
          style={prefersReducedMotion ? { opacity: 1 } : { opacity: s0Opacity }}
          className="pointer-events-none absolute bottom-7 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5 text-white/75"
        >
          <span className="text-[11px] font-black uppercase tracking-[0.25em]">Scrolluj</span>
          <motion.span animate={prefersReducedMotion ? undefined : { y: [0, 7, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}>
            <ChevronDown size={22} />
          </motion.span>
        </motion.div>
      </div>
    </section>
  );
}
