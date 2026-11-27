'use client';

import { AnimatePresence, motion, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

/**
 * Jak vypadá trénink: 60 minut rozdělených do pěti částí. Vlevo ciferník,
 * na kterém svítí právě vybraná část, vpravo pět řádků. Části se samy střídají,
 * dokud na některou rodič neklepne nebo nenajede myší. Text je krátký a vidět
 * je pořád celý — hýbe se jen ciferník.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export type DialPhase = { from: number; to: number; title: string; text: string; color: string };

const TRAINING_PHASES: DialPhase[] = [
  { from: 0, to: 15, title: 'Rozcvička hrou', text: 'Honička nebo hra. Tělo se zahřeje a nikdo nestojí.', color: '#FFB21A' },
  { from: 15, to: 25, title: 'Průprava', text: 'Cviky, které tělo připraví na dnešní trik.', color: '#B23BFF' },
  { from: 25, to: 40, title: 'Trik dne', text: 'Nový trik krok za krokem, s dopomocí trenéra.', color: '#F12BB3' },
  { from: 40, to: 55, title: 'Variace a dráha', text: 'Trik obměníme a zapojíme do překážkové dráhy.', color: '#8B1DFF' },
  { from: 55, to: 60, title: 'Protažení', text: 'Zklidnění, protažení a co se dnes povedlo.', color: '#22D3EE' },
];

const AUTO_MS = 3400;

/** Čas na hodinách: začátek akce + minuty od začátku → „15:05". */
function clockLabel(startMinutes: number, offset: number) {
  const value = startMinutes + offset;
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export function TrainingTimeline() {
  return <PhaseDial phases={TRAINING_PHASES} total={60} />;
}

/**
 * Ciferník s částmi programu. Bez `clockStart` ukazuje délku části v minutách
 * (trénink), s `clockStart` (minuty od půlnoci) skutečný čas na hodinách (workshop).
 */
export function PhaseDial({ phases, total, clockStart, compact = false }: { phases: DialPhase[]; total: number; clockStart?: number; /** Hodně částí: řádky jsou nízké a popis má jen vybraná. */ compact?: boolean }) {
  const PHASES = phases;
  const GAP = total * 0.015; // mezera mezi oblouky v „minutách"
  const withClock = typeof clockStart === 'number';
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const running = auto && inView && !reduced;

  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => setActive((i) => (i + 1) % PHASES.length), AUTO_MS);
    return () => window.clearTimeout(id);
  }, [running, active]);

  const phase = PHASES[active];

  // Ručička jede po kružnici vždy dopředu (i z poslední části zpět na první).
  const turns = useRef(0);
  const lastActive = useRef(0);
  if (active < lastActive.current) turns.current += 1;
  lastActive.current = active;
  const handAngle = ((phase.from + phase.to) / 2 / total) * 360 + turns.current * 360;
  const angle = useSpring(handAngle, { stiffness: 90, damping: 16 });
  useEffect(() => {
    angle.set(handAngle);
  }, [angle, handAngle]);
  const handX = useTransform(angle, (value) => 100 + 84 * Math.cos((value * Math.PI) / 180));
  const handY = useTransform(angle, (value) => 100 + 84 * Math.sin((value * Math.PI) / 180));

  return (
    <div ref={ref} className={compact ? 'grid items-center gap-10 lg:grid-cols-[minmax(0,400px)_1fr] lg:gap-16' : 'grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16'}>
      {/* Ciferník */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, rotate: -20 }}
        whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.9, ease: EASE }}
        className={`relative mx-auto aspect-square w-full ${compact ? 'max-w-[340px] lg:max-w-[400px]' : 'max-w-[420px]'}`}
      >
        <motion.div
          aria-hidden
          className="absolute inset-[12%] rounded-full blur-3xl"
          animate={{ backgroundColor: phase.color, opacity: 0.28 }}
          transition={{ duration: 0.6 }}
        />
        <svg viewBox="0 0 200 200" className="relative h-full w-full -rotate-90">
          <circle cx="100" cy="100" r="84" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
          {PHASES.map((item, i) => {
            const length = item.to - item.from - GAP;
            const lit = i === active;
            return (
              <motion.circle
                key={item.title}
                cx="100"
                cy="100"
                r="84"
                fill="none"
                pathLength={total}
                stroke={item.color}
                strokeLinecap="round"
                strokeDasharray={`${length} ${total - length}`}
                strokeDashoffset={-(item.from + GAP / 2)}
                initial={false}
                animate={{ strokeWidth: lit ? 18 : 11, opacity: lit ? 1 : 0.3 }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                onClick={() => {
                  setActive(i);
                  setAuto(false);
                }}
                style={{ cursor: 'pointer' }}
              />
            );
          })}
          {/* ručička */}
          <motion.circle cx={handX} cy={handY} r="11" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.5" />
          <motion.circle cx={handX} cy={handY} r="6.5" fill="#fff" />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <motion.p
            key={`minutes-${active}`}
            initial={{ opacity: 0, y: 14, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: EASE }}
            className={`font-black leading-none tracking-tight text-white ${withClock ? 'text-6xl md:text-7xl' : 'text-7xl md:text-8xl'}`}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {withClock ? clockLabel(clockStart, phase.from) : phase.to - phase.from}
          </motion.p>
          <p className="mt-1 text-lg font-bold text-white/60">{withClock ? `do ${clockLabel(clockStart, phase.to)}` : 'minut'}</p>
          <motion.p
            key={`title-${active}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="mt-3 rounded-full px-4 py-1.5 text-sm font-black text-[#0B0B10]"
            style={{ background: phase.color }}
          >
            {phase.title}
          </motion.p>
        </div>
      </motion.div>

      {/* Části programu */}
      <ol className={compact ? 'space-y-1' : 'space-y-2'}>
        {PHASES.map((item, i) => {
          const lit = i === active;
          return (
            <motion.li
              key={item.title}
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.55, delay: i * 0.07, ease: EASE }}
            >
              <button
                type="button"
                onMouseEnter={() => {
                  setActive(i);
                  setAuto(false);
                }}
                onClick={() => {
                  setActive(i);
                  setAuto(false);
                }}
                aria-pressed={lit}
                className={`relative flex w-full items-center overflow-hidden border text-left transition-colors duration-300 ${
                  compact ? 'gap-4 rounded-2xl px-4 py-2.5 md:gap-5 md:px-5 md:py-3' : 'gap-4 rounded-3xl px-5 py-4 md:gap-6 md:px-6 md:py-5'
                } ${lit ? 'border-white/20 bg-white/[0.07]' : 'border-transparent hover:bg-white/[0.03]'}`}
              >
                {lit && running ? (
                  <motion.span
                    key={`bar-${active}`}
                    className="absolute bottom-0 left-0 h-1 rounded-full"
                    style={{ background: item.color }}
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: AUTO_MS / 1000, ease: 'linear' }}
                  />
                ) : null}
                <motion.span
                  animate={{ scale: lit && !reduced ? 1 : 0.86, opacity: lit ? 1 : 0.55 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                  className={`flex shrink-0 items-center justify-center font-black text-[#0B0B10] ${
                    compact ? 'h-10 w-[4.25rem] rounded-xl text-sm md:h-11 md:w-[4.75rem] md:text-base' : 'h-14 w-[5.5rem] rounded-2xl text-base md:h-16 md:w-24 md:text-lg'
                  }`}
                  style={{ background: item.color, fontVariantNumeric: 'tabular-nums' }}
                >
                  {withClock ? clockLabel(clockStart, item.from) : `${item.from}–${item.to}′`}
                </motion.span>
                <span className="min-w-0">
                  <span className={`block font-black leading-tight tracking-tight transition-colors duration-300 ${compact ? 'text-lg md:text-2xl' : 'text-xl md:text-3xl'} ${lit ? 'text-white' : 'text-white/45'}`}>{item.title}</span>
                  {compact ? (
                    <AnimatePresence initial={false}>
                      {lit && item.text ? (
                        <motion.span
                          key="text"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.32, ease: EASE }}
                          className="block overflow-hidden"
                        >
                          <span className="block pt-1 text-[15px] font-medium leading-6 text-white/75 md:text-base">{item.text}</span>
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                  ) : (
                    <span className={`mt-1 block text-[15px] font-medium leading-6 transition-colors duration-300 md:text-base ${lit ? 'text-white/75' : 'text-white/35'}`}>{item.text}</span>
                  )}
                </span>
              </button>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
