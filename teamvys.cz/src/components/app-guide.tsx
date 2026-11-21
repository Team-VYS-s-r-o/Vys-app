'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CreditCard, PartyPopper, UserPlus, Users } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

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
                  <GuidePhone step={step} playing={i === active && inView} />
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/** iPhone kreslený v CSS: titanový rám, boční tlačítka, stavový řádek a video obrazovky. */
function GuidePhone({ step, playing }: { step: GuideStep; playing: boolean }) {
  const metal = 'linear-gradient(135deg, #5b5b63 0%, #1d1d22 22%, #3f3f47 48%, #131316 74%, #4c4c54 100%)';
  const button = 'linear-gradient(90deg, #2a2a30, #55555d 45%, #1c1c20)';
  return (
    <div className="relative h-full w-full">
      <span className="absolute rounded-l-[2px]" style={{ left: '-0.9%', top: '17.5%', width: '1.4%', height: '3.6%', background: button }} />
      <span className="absolute rounded-l-[2px]" style={{ left: '-0.9%', top: '24.5%', width: '1.4%', height: '7%', background: button }} />
      <span className="absolute rounded-l-[2px]" style={{ left: '-0.9%', top: '33%', width: '1.4%', height: '7%', background: button }} />
      <span className="absolute rounded-r-[2px]" style={{ right: '-0.9%', top: '27%', width: '1.4%', height: '11%', background: button }} />

      <div className="relative h-full w-full shadow-[0_50px_90px_-35px_rgba(0,0,0,0.8)]" style={{ background: metal, borderRadius: '17.5% / 8.4%', padding: '1.05%' }}>
        <div className="h-full w-full bg-black" style={{ borderRadius: '16.6% / 7.9%', padding: '2.35%' }}>
          <div className="relative h-full w-full overflow-hidden bg-black" style={{ borderRadius: '14% / 6.5%', containerType: 'inline-size' }}>
            <div className="relative flex h-full w-full flex-col overflow-hidden" style={{ background: step.tone, fontSize: '4.1cqw' }}>
              <div className="relative flex shrink-0 items-center justify-between text-[#0b0a1a]" style={{ height: '5.57%', padding: '0 7.2% 0 9.4%' }}>
                <span className="font-semibold leading-none" style={{ letterSpacing: '-0.02em' }}>9:41</span>
                <span className="absolute left-1/2 -translate-x-1/2 rounded-full bg-black" style={{ top: '24%', height: '62%', width: '30.5%' }} />
                <span className="flex items-center" style={{ gap: '0.32em' }}>
                  <svg viewBox="0 0 18 12" style={{ height: '0.72em' }} fill="currentColor" aria-hidden>
                    <rect x="0" y="8.2" width="3" height="3.8" rx="0.9" />
                    <rect x="5" y="5.6" width="3" height="6.4" rx="0.9" />
                    <rect x="10" y="2.9" width="3" height="9.1" rx="0.9" />
                    <rect x="15" y="0" width="3" height="12" rx="0.9" />
                  </svg>
                  <svg viewBox="0 0 16 12" style={{ height: '0.72em' }} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
                    <path d="M1.2 4.2a9.6 9.6 0 0 1 13.6 0" />
                    <path d="M3.6 6.7a6.2 6.2 0 0 1 8.8 0" />
                    <path d="M6.1 9.2a2.7 2.7 0 0 1 3.8 0" />
                  </svg>
                  <svg viewBox="0 0 27 12" style={{ height: '0.76em' }} aria-hidden>
                    <rect x="0.6" y="0.6" width="22.8" height="10.8" rx="3.4" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.4" />
                    <rect x="2.2" y="2.2" width="19.6" height="7.6" rx="2" fill="currentColor" />
                    <path d="M25 4v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2Z" fill="currentColor" opacity="0.45" />
                  </svg>
                </span>
              </div>
              <video
                ref={(el) => {
                  if (!el) return;
                  if (playing) {
                    el.play().catch(() => {});
                  } else {
                    el.pause();
                    el.currentTime = 0;
                  }
                }}
                src={step.video}
                poster={step.poster}
                aria-label={step.alt}
                muted
                loop
                playsInline
                preload="metadata"
                className="block min-h-0 w-full flex-1 object-cover object-top"
              />
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-[#0b0a1a]/80" style={{ bottom: '0.95%', width: '35%', height: '0.6%' }} />
            </div>
            <span className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(115deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.03) 22%, transparent 38%)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
