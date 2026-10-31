'use client';

import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { Check } from 'lucide-react';
import { useRef } from 'react';

const ease = [0.22, 1, 0.36, 1] as const;

type Chapter = {
  video: string;
  title: string;
  lead: string;
  bullets: readonly string[];
};

// Pořadí kapitol: trenér → rodič → účastník. Videa jsou skutečné záznamy z aplikace
// zasazené do telefonu (webm s alfou pro Chrome/Firefox, HEVC .mov pro Safari).
const CHAPTERS: readonly Chapter[] = [
  {
    video: 'app-trener',
    title: 'Trenérská sekce',
    lead: 'Docházka vyřešená za pár vteřin — přímo na tréninku.',
    bullets: [
      'Docházka přes NFC čip i ručně, kontrola lokality',
      'QR potvrzení splněných triků',
      'Přehled výplaty, bonusů a DPP dokumentů',
    ],
  },
  {
    video: 'app-rodic',
    title: 'Rodičovská sekce',
    lead: 'Děti, platby i permanentky pod palcem.',
    bullets: [
      'Přehled dětí, docházky a aktivních nákupů',
      'Platby kroužků, táborů a workshopů online',
      'Zpráva, že dítě dorazilo v pořádku na trénink',
    ],
  },
  {
    video: 'app-ucastnik',
    title: 'Účastnická sekce',
    lead: 'Trénink jako hra, kterou chceš hrát dál.',
    bullets: [
      'Souboje maskotů, triky a skill tree',
      'XP a animovaný progres barevných náramků',
      'Digitální permanentka přes NFC čip',
    ],
  },
];

/**
 * Scroll-pinned ukázky aplikace: stránka se „zastaví“ a s dalším scrollem
 * se zprava plynule přisouvá telefon s běžícím záznamem; vedle něj najíždí
 * text sekce. Tři kapitoly: trenér → rodič → účastník.
 */
export function AppShowcase() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: wrapRef, offset: ['start start', 'end end'] });

  if (prefersReducedMotion) {
    // Bez animací: tři klidné bloky pod sebou.
    return (
      <section className="section-shell grid gap-10 py-16 md:py-24">
        {CHAPTERS.map((chapter) => (
          <StaticChapter key={chapter.video} chapter={chapter} />
        ))}
      </section>
    );
  }

  return (
    <div ref={wrapRef} className="relative h-[340dvh]">
      <div className="sticky top-0 flex h-dvh items-center overflow-hidden">
        <div className="section-shell relative h-full w-full">
          {CHAPTERS.map((chapter, index) => (
            <ChapterSlide
              key={chapter.video}
              chapter={chapter}
              index={index}
              total={CHAPTERS.length}
              progress={scrollYProgress}
            />
          ))}

          {/* Tečky s průběhem kapitol */}
          <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2 md:bottom-10">
            {CHAPTERS.map((chapter, index) => (
              <Dot key={chapter.video} index={index} total={CHAPTERS.length} progress={scrollYProgress} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function chapterRange(index: number, total: number): [number, number] {
  return [index / total, (index + 1) / total];
}

function ChapterSlide({
  chapter,
  index,
  total,
  progress,
}: {
  chapter: Chapter;
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  const [start, end] = chapterRange(index, total);
  const span = end - start;
  const isFirst = index === 0;
  const isLast = index === total - 1;

  // Telefon: přijede zprava, chvíli drží a odjede doleva (první kapitola je
  // vidět hned, poslední už neodjíždí).
  const enterEnd = start + span * 0.3;
  const exitStart = end - span * 0.22;
  const phoneX = useTransform(
    progress,
    [start, enterEnd, exitStart, end],
    [isFirst ? '0vw' : '80vw', '0vw', '0vw', isLast ? '0vw' : '-85vw'],
  );
  const phoneOpacity = useTransform(
    progress,
    [start, enterEnd, exitStart, end],
    [isFirst ? 1 : 0, 1, 1, isLast ? 1 : 0],
  );

  // Text: objeví se chvilku po telefonu, mizí spolu s ním.
  const textX = useTransform(
    progress,
    [start + span * 0.16, start + span * 0.42, exitStart, end],
    [isFirst ? '0px' : '60px', '0px', '0px', isLast ? '0px' : '-40px'],
  );
  const textOpacity = useTransform(
    progress,
    [start + span * 0.16, start + span * 0.42, exitStart, end],
    [isFirst ? 1 : 0, 1, 1, isLast ? 1 : 0],
  );

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-6 md:flex-row md:gap-16">
      <motion.div style={{ x: phoneX, opacity: phoneOpacity }} className="shrink-0">
        <PhoneVideo name={chapter.video} title={chapter.title} />
      </motion.div>

      <motion.div style={{ x: textX, opacity: textOpacity }} className="max-w-[460px] px-4 text-center md:px-0 md:text-left">
        <h3 className="text-2xl font-black leading-tight tracking-tight text-white md:text-5xl">{chapter.title}</h3>
        <p className="mt-2 text-sm font-bold text-brand-purple-light md:mt-3 md:text-lg">{chapter.lead}</p>
        <ul className="mt-4 hidden space-y-3 md:mt-7 md:block">
          {chapter.bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-purple/20 text-brand-purple-light">
                <Check size={13} strokeWidth={3} />
              </span>
              <span className="text-sm leading-6 text-white/70 md:text-base md:leading-7">{bullet}</span>
            </li>
          ))}
        </ul>
        {/* Na telefonu jen první dva body, ať se vše vejde vedle velkého videa */}
        <ul className="mx-auto mt-3 max-w-[340px] space-y-1.5 md:hidden">
          {chapter.bullets.slice(0, 2).map((bullet) => (
            <li key={bullet} className="text-[13px] leading-5 text-white/65">
              {bullet}
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}

function PhoneVideo({ name, title }: { name: string; title: string }) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[130%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(139,29,255,0.30),transparent_62%)] blur-2xl"
      />
      <video
        autoPlay
        muted
        loop
        playsInline
        poster={`/${name}-poster.webp`}
        aria-label={`Ukázka z aplikace — ${title}`}
        className="relative h-[44dvh] w-auto select-none drop-shadow-[0_40px_80px_rgba(0,0,0,0.55)] md:h-[76dvh]"
      >
        <source src={`/${name}.mov`} type="video/quicktime" />
        <source src={`/${name}.webm`} type="video/webm" />
      </video>
    </div>
  );
}

/** Tečka ukazatele: rozsvítí se, když je její kapitola aktivní. */
function Dot({ index, total, progress }: { index: number; total: number; progress: MotionValue<number> }) {
  const [start, end] = chapterRange(index, total);
  const opacity = useTransform(
    progress,
    [start - 0.03, start + 0.03, end - 0.03, end + 0.03],
    [0.25, 1, 1, 0.25],
  );
  const scale = useTransform(
    progress,
    [start - 0.03, start + 0.03, end - 0.03, end + 0.03],
    [1, 1.3, 1.3, 1],
  );
  return <motion.span style={{ opacity, scale }} className="h-2 w-2 rounded-full bg-brand-purple-light" />;
}

function StaticChapter({ chapter }: { chapter: Chapter }) {
  return (
    <div className="grid items-center gap-8 md:grid-cols-[auto_1fr] md:gap-14">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/${chapter.video}-poster.webp`} alt={chapter.title} className="mx-auto h-[60dvh] w-auto" />
      <div>
        <h3 className="text-2xl font-black text-white md:text-4xl">{chapter.title}</h3>
        <p className="mt-2 text-sm font-bold text-brand-purple-light md:text-base">{chapter.lead}</p>
        <ul className="mt-5 space-y-2">
          {chapter.bullets.map((bullet) => (
            <li key={bullet} className="text-sm leading-6 text-white/70">
              {bullet}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
