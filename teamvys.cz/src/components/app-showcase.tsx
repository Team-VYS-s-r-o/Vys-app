'use client';

import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { PhoneFrame } from '@/components/phone-frame';

const ease = [0.22, 1, 0.36, 1] as const;

type Chapter = {
  video: string;
  /** Barva horního okraje obrazovky ve videu (pozadí stavového řádku telefonu). */
  tone?: string;
  dark?: boolean;
  title: string;
  lead: string;
  bullets: readonly string[];
};

// Pořadí kapitol: trenér → rodič → účastník. Videa jsou skutečné záznamy obrazovky
// aplikace (`/app-v2/<název>.mp4`, natáčí `guide-videos.mjs` v repu aplikacevys.cz),
// telefon kolem nich kreslí `PhoneFrame`.
const CHAPTERS: readonly Chapter[] = [
  {
    video: 'trener',
    title: 'Trenérská sekce',
    lead: 'Docházka vyřešená za pár vteřin — přímo na tréninku.',
    bullets: [
      'Docházka přes NFC čip i ručně, kontrola lokality',
      'QR potvrzení splněných triků',
      'Přehled výplaty, bonusů a DPP dokumentů',
    ],
  },
  {
    video: 'rodic',
    title: 'Rodičovská sekce',
    lead: 'Děti, platby i permanentky pod palcem.',
    bullets: [
      'Přehled dětí, docházky a aktivních nákupů',
      'Platby kroužků, táborů a workshopů online',
      'Zpráva, že dítě dorazilo v pořádku na trénink',
    ],
  },
  {
    video: 'ucastnik',
    tone: '#963b38',
    dark: true,
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
    // svh, ne dvh: na telefonu se dvh mění s vysouváním lišty prohlížeče a celá
    // scroll-animace pak při každém scrollu přepočítává výšku a cuká.
    <div ref={wrapRef} className="relative h-[480svh]">
      <div className="sticky top-0 flex h-svh items-center overflow-hidden">
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
  const enterEnd = start + span * 0.38;
  const exitStart = end - span * 0.3;
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
    [start + span * 0.2, start + span * 0.5, exitStart, end],
    [isFirst ? '0px' : '60px', '0px', '0px', isLast ? '0px' : '-40px'],
  );
  const textOpacity = useTransform(
    progress,
    [start + span * 0.2, start + span * 0.5, exitStart, end],
    [isFirst ? 1 : 0, 1, 1, isLast ? 1 : 0],
  );

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-6 md:flex-row md:gap-16">
      <motion.div style={{ x: phoneX, opacity: phoneOpacity }} className="shrink-0 will-change-transform">
        <PhoneVideo chapter={chapter} />
      </motion.div>

      <motion.div style={{ x: textX, opacity: textOpacity }} className="max-w-[460px] will-change-transform px-4 text-center md:px-0 md:text-left">
        <h3 className="text-2xl font-black leading-tight tracking-tight text-white md:text-5xl">{chapter.title}</h3>
        <p className="mt-2 text-base font-bold text-brand-purple-light md:mt-3 md:text-lg">{chapter.lead}</p>
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
            <li key={bullet} className="text-[14.5px] leading-[22px] text-white/75">
              {bullet}
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}

/**
 * Telefon se záznamem. Na mobilu jen obrázek: tři videa dekódovaná naráz se při
 * posouvání telefonů sekala. Výchozí stav je obrázek (i při SSR), video se přepne
 * až na širokém displeji s myší.
 */
function PhoneVideo({ chapter }: { chapter: Chapter }) {
  const [useVideo, setUseVideo] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px) and (pointer: fine)');
    const sync = () => setUseVideo(query.matches);
    sync();
    query.addEventListener?.('change', sync);
    return () => query.removeEventListener?.('change', sync);
  }, []);

  return (
    <div className="relative">
      {/* Záře za telefonem: měkký gradient bez blur filtru (ten je na telefonu drahý). */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[80%] w-[150%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(139,29,255,0.32),rgba(139,29,255,0.12)_55%,transparent)]"
      />
      <PhoneFrame
        video={useVideo ? `/app-v2/${chapter.video}.mp4` : undefined}
        poster={`/app-v2/${chapter.video}.webp`}
        alt={`Ukázka z aplikace — ${chapter.title}`}
        tone={chapter.tone}
        dark={chapter.dark}
        className="h-[44svh] md:h-[76dvh]"
      />
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
      <PhoneFrame poster={`/app-v2/${chapter.video}.webp`} alt={chapter.title} tone={chapter.tone} dark={chapter.dark} className="mx-auto h-[60dvh]" />
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
