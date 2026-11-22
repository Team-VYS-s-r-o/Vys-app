'use client';

import { animate, motion, useInView, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { Check } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

import { SceneRows } from '@/components/scene-rows';

/**
 * Sekce stránky O nás: čísla, která se dopočítají, věta, která se rozsvěcuje
 * scrollem, tři pilíře s malou animovanou scénou a pás tělocvičen.
 */

const EASE = [0.22, 1, 0.36, 1] as const;
const LOOP = { duration: 5, repeat: Infinity, ease: 'easeInOut' as const };

/* ---------- čísla ---------- */

function CountUp({ value }: { value: string }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const match = /^(\d+)(.*)$/.exec(value.trim());
  const target = match ? Number(match[1]) : null;
  const suffix = match ? match[2] : '';

  useEffect(() => {
    const el = ref.current;
    if (!el || target === null || !inView) return;
    if (reduced) {
      el.textContent = `${target}${suffix}`;
      return;
    }
    const controls = animate(0, target, {
      duration: 1.6,
      ease: EASE,
      onUpdate: (latest) => {
        el.textContent = `${Math.round(latest)}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [inView, reduced, suffix, target]);

  return (
    <span ref={ref} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {target === null ? value : `0${suffix}`}
    </span>
  );
}

export function AboutStats({ stats }: { stats: { value: string; label: string }[] }) {
  return (
    <section className="section-shell py-16 md:py-24">
      <div className="grid grid-cols-2 gap-y-12 md:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: i * 0.08, ease: EASE }}
            className={`px-4 text-center md:px-6 ${i > 0 ? 'md:border-l md:border-white/10' : ''}`}
          >
            <p className="bg-gradient-to-br from-white via-brand-purple-light to-[#F12BB3] bg-clip-text text-6xl font-black leading-none tracking-tight text-transparent md:text-8xl">
              <CountUp value={stat.value} />
            </p>
            <p className="mt-3 text-base font-bold text-white/65 md:text-lg">{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ---------- věta, která se rozsvěcuje scrollem ---------- */

function Word({ children, progress, range }: { children: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.16, 1]);
  return (
    <motion.span style={{ opacity }} className="mr-[0.24em] inline-block">
      {children}
    </motion.span>
  );
}

export function AboutManifesto({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.45'] });
  const words = text.split(' ');
  return (
    <section className="section-shell pb-20 md:pb-32">
      <p ref={ref} className="max-w-5xl text-[2rem] font-black leading-[1.1] tracking-tight text-white md:text-6xl">
        {words.map((word, i) => (
          <Word key={`${word}-${i}`} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
            {word}
          </Word>
        ))}
      </p>
    </section>
  );
}

/* ---------- pilíře se scénou ---------- */

/** Maskot skáče po schodech od pádů k saltům; na každém schodu, kam dopadne, se rozsvítí. Poslední skok je salto. */
function SceneSteps() {
  const steps = ['Pády', 'Koordinace', 'Přeskoky', 'Salta'];
  const loop = { duration: 6.5, repeat: Infinity };
  const times = [0, 0.1, 0.19, 0.28, 0.38, 0.47, 0.56, 0.66, 0.75, 0.84, 0.94, 1];
  const land = [0.02, 0.28, 0.56, 0.84];
  return (
    <div className="relative h-[240px] w-full max-w-[380px]">
      <div className="absolute inset-x-0 bottom-0 flex h-[180px] items-end gap-2">
        {steps.map((step, i) => (
          <div key={step} className="relative flex-1" style={{ height: `${40 + i * 20}%` }}>
            <div className="absolute inset-0 rounded-t-2xl rounded-b-md border border-white/10 bg-white/[0.05]" />
            <motion.div
              className="absolute inset-0 rounded-t-2xl rounded-b-md bg-gradient-to-t from-brand-purple to-[#F12BB3]"
              animate={{ opacity: [0, 0, 1, 1, 0] }}
              transition={{ ...loop, times: [0, Math.max(0, land[i] - 0.02), land[i] + 0.05, 0.95, 1], ease: 'easeOut' }}
            />
            <span className="absolute inset-x-0 bottom-3 text-center text-[11px] font-black leading-none text-white sm:text-sm">{step}</span>
          </div>
        ))}
      </div>
      <motion.div
        className="absolute h-11 w-11"
        animate={{
          left: ['12.5%', '12.5%', '25%', '37.5%', '37.5%', '50%', '62.5%', '62.5%', '75%', '87.5%', '87.5%', '87.5%'],
          bottom: [72, 72, 128, 108, 108, 164, 144, 144, 200, 180, 180, 180],
          opacity: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        }}
        transition={{
          ...loop,
          times,
          left: { ...loop, times, ease: 'linear' },
          bottom: { ...loop, times, ease: ['linear', 'easeOut', 'easeIn', 'linear', 'easeOut', 'easeIn', 'linear', 'easeOut', 'easeIn', 'linear', 'linear'] },
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <motion.img
          src="/vys-logo-mark.png"
          alt=""
          className="h-11 w-11 select-none drop-shadow-[0_8px_14px_rgba(0,0,0,0.5)]"
          style={{ x: '-50%' }}
          animate={{ rotate: [0, 0, -360, -360], scale: [1, 1, 1, 1.18, 1] }}
          transition={{ rotate: { ...loop, times: [0, 0.66, 0.84, 1], ease: 'easeInOut' }, scale: { ...loop, times: [0, 0.84, 0.86, 0.9, 1] } }}
        />
      </motion.div>
    </div>
  );
}

/** Tři triky se postupně odemknou, XP přibývají a při plném pruhu se béžový náramek změní na růžový. */
function SceneXp() {
  const loop = { duration: 6.5, repeat: Infinity };
  // skutečné první triky ze skill tree a jejich XP
  const tricks = [
    ['Safety roll', 50],
    ['Safety vault', 100],
    ['Precision jump', 150],
  ] as const;
  const unlock = [0.12, 0.34, 0.56];
  return (
    <div className="w-full max-w-[380px]">
      <div className="flex items-center gap-4">
        <motion.svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0" animate={{ scale: [1, 1, 1.22, 1, 1] }} transition={{ ...loop, times: [0, 0.7, 0.76, 0.84, 1] }}>
          <motion.circle cx="32" cy="32" r="22" fill="none" strokeWidth="11" animate={{ stroke: ['#D8C2A3', '#D8C2A3', '#F5A7C8', '#F5A7C8', '#D8C2A3'] }} transition={{ ...loop, times: [0, 0.7, 0.76, 0.96, 1] }} />
          <circle cx="32" cy="32" r="22" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeDasharray="2 9" />
        </motion.svg>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white/55">Náramek</p>
          <div className="relative h-10">
            <motion.p className="absolute inset-0 text-4xl font-black leading-10 tracking-tight text-[#D8C2A3]" animate={{ opacity: [1, 1, 0, 0, 1], y: [0, 0, -10, -10, 0] }} transition={{ ...loop, times: [0, 0.7, 0.75, 0.96, 1] }}>
              Béžový
            </motion.p>
            <motion.p className="absolute inset-0 text-4xl font-black leading-10 tracking-tight text-[#F5A7C8]" animate={{ opacity: [0, 0, 1, 1, 0], y: [10, 10, 0, 0, 10] }} transition={{ ...loop, times: [0, 0.7, 0.76, 0.96, 1] }}>
              Růžový
            </motion.p>
          </div>
        </div>
      </div>

      <div className="mt-5 h-4 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full origin-left rounded-full bg-gradient-to-r from-brand-purple to-[#F12BB3]"
          animate={{ scaleX: [0.1, 0.1, 0.4, 0.4, 0.7, 0.7, 1, 1, 0.1] }}
          transition={{ ...loop, times: [0, 0.12, 0.2, 0.34, 0.42, 0.56, 0.64, 0.96, 1], ease: 'easeInOut' }}
        />
      </div>

      <div className="mt-5 space-y-2">
        {tricks.map(([name, xp], i) => (
          <div key={name} className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5">
            <motion.span
              className="absolute inset-0 bg-gradient-to-r from-brand-purple/70 to-[#F12BB3]/60"
              animate={{ opacity: [0, 0, 1, 1, 0] }}
              transition={{ ...loop, times: [0, unlock[i], unlock[i] + 0.06, 0.96, 1] }}
            />
            <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-white/35">
              <motion.span
                className="absolute inset-[-2px] flex items-center justify-center rounded-full bg-white text-brand-purple"
                animate={{ scale: [0, 0, 1.25, 1, 0] }}
                transition={{ ...loop, times: [0, unlock[i], unlock[i] + 0.05, 0.96, 1] }}
              >
                <Check size={14} strokeWidth={4} />
              </motion.span>
            </span>
            <span className="relative flex-1 text-base font-black text-white">{name}</span>
            <motion.span
              className="relative text-base font-black text-[#FFB21A]"
              style={{ fontVariantNumeric: 'tabular-nums' }}
              animate={{ opacity: [0.35, 0.35, 1, 1, 0.35], scale: [1, 1, 1.25, 1, 1] }}
              transition={{ ...loop, times: [0, unlock[i], unlock[i] + 0.05, 0.96, 1] }}
            >
              +{xp} XP
            </motion.span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Trenérův telefon a skutečná kartička: přiloží se, telefon pípne a dítě je zapsané. */
function SceneCard() {
  const loop = { duration: 5.5, repeat: Infinity };
  return (
    <div className="relative h-[280px] w-full max-w-[380px]">
      {/* telefon trenéra */}
      <div className="absolute right-[12%] top-0 z-10 h-[210px] w-[108px] rounded-[26px] border-[3px] border-white/80 bg-[#17102a] shadow-[0_24px_50px_-18px_rgba(139,29,255,0.8)]">
        <span className="absolute left-1/2 top-2.5 h-[7px] w-9 -translate-x-1/2 rounded-full bg-white/25" />
        {[0, 1, 2].map((ring) => (
          <motion.span
            key={ring}
            className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#B23BFF]"
            animate={{ scale: [0.5, 0.5, 2.6, 2.6], opacity: [0, 0.9, 0, 0] }}
            transition={{ ...loop, times: [0, 0.32 + ring * 0.05, 0.6 + ring * 0.05, 1], ease: 'easeOut' }}
          />
        ))}
        <motion.span
          className="absolute inset-0 rounded-[23px] bg-emerald-400/25"
          animate={{ opacity: [0, 0, 1, 0.5, 0] }}
          transition={{ ...loop, times: [0, 0.34, 0.4, 0.9, 1] }}
        />
        <motion.span
          className="absolute left-1/2 top-1/2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg"
          style={{ x: '-50%', y: '-50%' }}
          animate={{ scale: [0, 0, 1.25, 1, 0] }}
          transition={{ ...loop, times: [0, 0.36, 0.44, 0.9, 1] }}
        >
          <Check size={30} strokeWidth={4} />
        </motion.span>
      </div>

      {/* kartička se přiloží k telefonu a zase odjede */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <motion.img
        src="/nfc-card/f000.webp"
        alt="Kartička Team VYS"
        className="absolute left-0 top-[46px] w-[168px] select-none drop-shadow-[0_18px_26px_rgba(0,0,0,0.55)]"
        animate={{ x: ['0%', '70%', '70%', '0%', '0%'], rotate: [-12, -4, -4, -12, -12] }}
        transition={{ ...loop, times: [0, 0.3, 0.52, 0.78, 1], ease: 'easeInOut' }}
      />

      <motion.span
        className="absolute bottom-0 left-1/2 z-20 whitespace-nowrap rounded-full bg-white px-4 py-2 text-sm font-black text-[#0B0B10] shadow-[0_14px_30px_-12px_rgba(0,0,0,0.7)]"
        style={{ x: '-50%' }}
        animate={{ opacity: [0, 0, 1, 1, 0], y: [12, 12, 0, 0, 12] }}
        transition={{ ...loop, times: [0, 0.4, 0.48, 0.9, 1] }}
      >
        Eliška je zapsaná · zbývá 9 vstupů
      </motion.span>
    </div>
  );
}

/** Zamčená obrazovka rodiče: zprávy z aplikace přicházejí jedna po druhé a starší odsouvají dolů. */
function SceneParent() {
  const loop = { duration: 7, repeat: Infinity };
  const STEP = 70;
  const notes = [
    { text: 'Eliška dorazila na trénink', at: 0.08, y: [0, 0, STEP, STEP, STEP * 2, STEP * 2], yTimes: [0, 0.27, 0.34, 0.55, 0.62, 1] },
    { text: 'Zbývá 9 vstupů z 15', at: 0.36, y: [0, 0, STEP, STEP], yTimes: [0, 0.55, 0.62, 1] },
    { text: 'Platba přijata', at: 0.64, y: [0, 0], yTimes: [0, 1] },
  ];
  return (
    <div className="relative h-[270px] w-full max-w-[300px] overflow-hidden rounded-t-[38px] border-[3px] border-b-0 border-white/25 bg-gradient-to-b from-[#2a1650] to-[#130c22] px-3 pt-4 [mask-image:linear-gradient(180deg,#000_78%,transparent)]">
      <span className="mx-auto block h-[22px] w-[84px] rounded-full bg-black" />
      <p className="mt-3 text-center text-5xl font-black leading-none tracking-tight text-white/90" style={{ fontVariantNumeric: 'tabular-nums' }}>
        17:02
      </p>
      <div className="relative mt-4">
        {notes.map((note) => (
          <motion.div
            key={note.text}
            className="absolute inset-x-0 top-0"
            animate={{ y: note.y }}
            transition={{ ...loop, times: note.yTimes, ease: 'easeInOut' }}
          >
            <motion.div
              className="flex items-center gap-2.5 rounded-[18px] bg-white/95 px-3 py-2.5 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.8)]"
              animate={{ opacity: [0, 0, 1, 1, 0], y: [-18, -18, 0, 0, 0], scale: [0.94, 0.94, 1, 1, 0.98] }}
              transition={{ ...loop, times: [0, note.at, note.at + 0.06, 0.95, 1], ease: 'easeOut' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/vys-logo-mark.png" alt="" className="h-9 w-9 shrink-0 rounded-[10px] bg-[#1D0D31] p-1" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wide text-[#0B0B10]/55">Team VYS</span>
                  <span className="text-[11px] font-bold text-[#0B0B10]/45">teď</span>
                </span>
                <span className="block text-[15px] font-black leading-tight text-[#0B0B10]">{note.text}</span>
              </span>
            </motion.div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const PILLARS: { title: string; text: string; scene: ReactNode }[] = [
  { title: 'Bezpečně a postupně', text: 'Každý trik nejdřív na žíněnce, až potom v terénu.', scene: <SceneSteps /> },
  { title: 'Skill tree a XP', text: 'Dítě sbírá XP, odemyká triky a získává barevné náramky.', scene: <SceneXp /> },
  { title: 'Kartička místo prezenčky', text: 'Dítě pípne kartičkou u trenéra a je zapsané. Vstup se odečte sám.', scene: <SceneCard /> },
  { title: 'Pro rodiče jednoduše', text: 'Platby, docházku i pokrok dítěte vidíte v aplikaci.', scene: <SceneParent /> },
];

export function AboutPillars() {
  return (
    <section className="section-shell pb-20 md:pb-32">
      <h2 className="max-w-4xl text-balance text-3xl font-black leading-[1.02] tracking-tight text-white md:text-6xl">Parkour je cesta, ne jednorázový výkon</h2>
      <SceneRows items={PILLARS} />
    </section>
  );
}

/* ---------- pás tělocvičen ---------- */

const GYMS = [
  ['/courses/prostejov_Prostejov_parkour_2.webp', 'Prostějov'],
  ['/courses/blansko_ZS-Erbenova-Foto1.webp', 'Blansko'],
  ['/courses/purkynka_Purkynova_4.webp', 'Vyškov'],
  ['/courses/jesenik_JS1.webp', 'Jeseník'],
  ['/courses/prostejov_Prostejov_parkour_3.webp', 'Prostějov'],
  ['/courses/brandys_BR5.webp', 'Brandýs'],
  ['/courses/nadrazka_ZS-Nadrazka-Foto1.webp', 'Vyškov'],
  ['/courses/prostejov_Prostejov_parkour_4.webp', 'Prostějov'],
  ['/courses/zdimerice_3.webp', 'Zdiměřice'],
  ['/courses/purkynka_Purkynova_5.webp', 'Vyškov'],
];

export function AboutGyms() {
  const row = [...GYMS, ...GYMS];
  return (
    <section className="pb-20 md:pb-32">
      <div className="section-shell">
        <h2 className="text-3xl font-black tracking-tight text-white md:text-6xl">Tady trénujeme</h2>
        <p className="mt-3 max-w-xl text-base font-medium leading-7 text-white/65 md:text-lg">Školní tělocvičny a sokolovny, kde máme žíněnky, bedny a prostor na dráhu.</p>
      </div>
      <div className="relative mt-10 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)] md:mt-14">
        <div className="gym-marquee flex w-max gap-4 md:gap-6">
          {row.map(([src, city], i) => (
            <figure key={`${src}-${i}`} className="relative h-[220px] w-[300px] shrink-0 overflow-hidden rounded-3xl md:h-[340px] md:w-[460px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Tělocvična — ${city}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
              <figcaption className="absolute bottom-4 left-4 rounded-full bg-black/55 px-4 py-1.5 text-base font-black text-white backdrop-blur">{city}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
