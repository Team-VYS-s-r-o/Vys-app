'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CreditCard, PartyPopper, UserPlus, Users } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { PhoneFrame } from '@/components/phone-frame';

/**
 * Návod „Jak koupit permanentku dítěti": čtyři kroky vlevo, vpravo iPhone
 * s krátkým videem toho, co se v aplikaci opravdu dělá. Kroky se samy
 * střídají, dokud na některý rodič neklepne. Stejný návod je na prodejním
 * webu aplikacevys.cz (tam s vymyšlenou nabídkou, tady se skutečnou).
 *
 * Videa se natáčí skriptem `scripts/demo-shots/guide-videos.mjs` v repu
 * aplikacevys.cz (`REAL=1`), obrazovka je 390 × 797 bez stavového řádku —
 * ten kreslíme tady.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

type GuideStep = {
  icon: ReactNode;
  title: string;
  text: ReactNode;
  video: string;
  poster: string;
  alt: string;
  /** Barva horního okraje obrazovky (pozadí stavového řádku). */
  tone: string;
  /** Jak dlouho krok svítí při automatickém střídání, v sekundách. */
  seconds: number;
};

const STEPS: GuideStep[] = [
  {
    icon: <UserPlus size={18} />,
    title: 'Založ si účet rodiče',
    text: (
      <>
        Stáhni si aplikaci z App Storu, nebo ji otevři v prohlížeči. Klepni na{' '}
        <strong className="text-white">Zaregistrovat</strong> a vyber roli <strong className="text-white">Rodič</strong>. Na e-mail ti
        přijde kód, kterým účet potvrdíš.
      </>
    ),
    video: '/navod/krok-1.mp4',
    poster: '/navod/krok-1.webp',
    alt: 'Registrace v aplikaci: výběr role Rodič',
    tone: '#f4f0e7',
    seconds: 5,
  },
  {
    icon: <Users size={18} />,
    title: 'Přidej dítě',
    text: (
      <>
        V záložce <strong className="text-white">Děti</strong> klepni na Přidat. Dítě buď{' '}
        <strong className="text-white">vytvoříš ručně</strong>, nebo ho <strong className="text-white">propojíš kódem</strong> z jeho
        vlastního účtu. S vlastním účtem sbírá náramky a hraje hru.
      </>
    ),
    video: '/navod/krok-2.mp4',
    poster: '/navod/krok-2.webp',
    alt: 'Přidání dítěte: vyplnění jména a příjmení',
    tone: '#f8f7fc',
    seconds: 5.5,
  },
  {
    icon: <CreditCard size={18} />,
    title: 'Vyber kroužek a zaplať',
    text: (
      <>
        V záložce <strong className="text-white">Platby</strong> najdeš kroužky i tábory. Vybereš místo a permanentku na 10 nebo
        15 vstupů, klepneš na Koupit, podepíšeš souhlasy přímo v aplikaci a zaplatíš kartou.
      </>
    ),
    video: '/navod/krok-3.mp4',
    poster: '/navod/krok-3.webp',
    alt: 'Záložka Platby: výběr kroužku a tlačítko Koupit',
    tone: '#f8f7fc',
    seconds: 6,
  },
  {
    icon: <PartyPopper size={18} />,
    title: 'Vyraz na první trénink',
    text: (
      <>
        Permanentka se hned objeví u dítěte. První lekce je zdarma: u dítěte uvidíš vstupenku, klepneš na{' '}
        <strong className="text-white">Aktivovat</strong> a trenérovi ukážeš QR kód.
      </>
    ),
    video: '/navod/krok-4.mp4',
    poster: '/navod/krok-4.webp',
    alt: 'Vstupenka na první lekci zdarma s QR kódem',
    tone: '#f8f7fc',
    seconds: 5,
  },
];

export function AppGuide() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const running = auto && inView && !reduced;

  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => setActive((i) => (i + 1) % STEPS.length), STEPS[active].seconds * 1000);
    return () => window.clearTimeout(id);
  }, [running, active]);

  return (
    <section id="navod" className="section-shell relative scroll-mt-28 pb-24 md:pb-36">
      <div
        aria-hidden
        className="pointer-events-none absolute right-[8%] top-1/3 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(139,29,255,0.22),transparent_60%)] blur-2xl"
      />
      <div ref={ref} className="relative mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: EASE }}
          className="text-center"
        >
          <h2 className="text-balance text-3xl font-black tracking-tight text-white md:text-5xl">Jak koupit permanentku dítěti</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-white/60 md:text-base">Od registrace k prvnímu tréninku ve čtyřech krocích.</p>
        </motion.div>

        <div className="mt-10 grid items-center gap-10 md:mt-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
          <ol className="space-y-3">
            {STEPS.map((step, i) => {
              const selected = i === active;
              return (
                <motion.li
                  key={step.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.5, delay: i * 0.07, ease: EASE }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActive(i);
                      setAuto(false);
                    }}
                    aria-expanded={selected}
                    className={`relative w-full overflow-hidden rounded-3xl border p-5 text-left transition-colors duration-300 md:p-6 ${
                      selected ? 'border-brand-purple/50 bg-white/[0.07] shadow-[0_24px_60px_-28px_rgba(139,29,255,0.7)]' : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05]'
                    }`}
                  >
                    {selected && running ? (
                      <motion.span
                        key={`bar-${active}`}
                        className="absolute bottom-0 left-0 h-1 rounded-full bg-gradient-to-r from-brand-purple to-[#F12BB3]"
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: step.seconds, ease: 'linear' }}
                      />
                    ) : null}
                    <span className="flex items-center gap-3.5">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black transition-all duration-300 ${
                          selected ? 'bg-gradient-to-br from-brand-purple to-[#F12BB3] text-white shadow-[0_10px_24px_rgba(139,29,255,0.45)]' : 'bg-white/10 text-white/75'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className={`transition-colors duration-300 ${selected ? 'text-brand-purple-light' : 'text-white/40'}`}>{step.icon}</span>
                      <span className="text-base font-black text-white md:text-lg">{step.title}</span>
                    </span>
                    <AnimatePresence initial={false}>
                      {selected ? (
                        <motion.span
                          key="text"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.35, ease: EASE }}
                          className="block overflow-hidden"
                        >
                          <span className="block pt-3 text-sm leading-7 text-white/65 md:pl-[3.4rem] md:text-[15px]">{step.text}</span>
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                  </button>
                </motion.li>
              );
            })}
          </ol>

          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
            className="relative mx-auto w-[68%] max-w-[270px]"
          >
            <div aria-hidden className="pointer-events-none absolute -inset-10 rounded-full bg-[radial-gradient(circle,rgba(139,29,255,0.35),transparent_62%)] blur-2xl" />
            <div className="relative" style={{ aspectRatio: '390 / 812' }}>
              {STEPS.map((step, i) => (
                <div
                  key={step.title}
                  className="absolute inset-0 transition-[opacity,transform] duration-500 ease-out"
                  style={{
                    opacity: i === active ? 1 : 0,
                    transform: i === active ? 'translateY(0) scale(1)' : 'translateY(14px) scale(0.97)',
                    pointerEvents: i === active ? 'auto' : 'none',
                  }}
                  aria-hidden={i !== active}
                >
                  <PhoneFrame video={step.video} poster={step.poster} alt={step.alt} tone={step.tone} playing={i === active && inView} />
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
