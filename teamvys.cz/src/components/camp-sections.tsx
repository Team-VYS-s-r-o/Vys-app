'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Star } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { PublicCampCatalog } from '@/components/public-admin-products';
import { useAdminCreatedProducts } from '@/lib/admin-created-products';
import { campSchedule } from '@shared/content';

/**
 * Sekce stránky Tábory. Když není vypsaný žádný turnus, místo prázdného
 * katalogu se ukáže „připravujeme" — zbytek stránky vysvětluje, jak tábor
 * funguje, takže má smysl i mimo sezónu.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

/* ---------- nabídka turnusů / připravujeme ---------- */

export function CampOffer() {
  const { products, loading } = useAdminCreatedProducts();
  const hasCamps = products.some((product) => product.type === 'Tabor');

  if (hasCamps) {
    return (
      <section className="section-shell py-16 md:py-24">
        <h2 className="text-3xl font-black tracking-tight text-white md:text-5xl">Vyber si turnus</h2>
        <div className="mx-[calc(50%-50vw)] mt-10 bg-brand-paper p-4 shadow-[0_30px_80px_rgba(0,0,0,0.45)] md:mx-0 md:rounded-[28px] md:p-6 lg:p-8">
          <PublicCampCatalog />
        </div>
      </section>
    );
  }

  return (
    <section className="section-shell py-16 md:py-24">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.8, ease: EASE }}
        className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-brand-purple/[0.28] via-[#1a1030] to-[#0B0B10] p-8 md:rounded-[2.5rem] md:p-14"
      >
        {/* vycházející slunce */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,#FFB21A_0%,rgba(255,178,26,0.35)_45%,transparent_70%)] md:h-96 md:w-96"
          animate={{ y: [18, -6, 18], scale: [1, 1.06, 1] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative max-w-2xl">
          <h2 className="text-balance text-4xl font-black leading-[1.02] tracking-tight text-white md:text-6xl">
            {loading ? 'Načítám turnusy…' : 'Turnusy na léto připravujeme'}
          </h2>
          <p className="mt-5 max-w-lg text-lg font-medium leading-relaxed text-white/70 md:text-xl">
            Jakmile je vypíšeme, najdeš je tady i v aplikaci. Chceš vědět jako první?
          </p>
          <Link
            href="/kontakty"
            className="group mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-base font-black text-[#0B0B10] transition-transform hover:-translate-y-0.5"
          >
            Napiš nám
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

/* ---------- den na táboře ---------- */

const DAY_COLORS = ['#FFB21A', '#F12BB3', '#B23BFF', '#22D3EE'];
const DAY_MS = 3400;

// Obloha pro čtyři části dne: ráno slunce vychází, přes poledne je nahoře
// a při odpoledním vyzvednutí zapadá za kopec. `t` je poloha na oblouku (0 = východ, 1 = západ).
const SKY = [
  { t: 0.12, top: '#33235F', mid: '#D9739A', low: '#FFD08A', sun: '#FFE7A6', glow: '#FFC36B', r: 17, cloud: 0.5, cloudFill: '#FFE3D2', dusk: 0.25 },
  { t: 0.36, top: '#1B4A8C', mid: '#4C95D4', low: '#C9E6F5', sun: '#FFF9DC', glow: '#FFEFB0', r: 14, cloud: 0.85, cloudFill: '#FFFFFF', dusk: 0 },
  { t: 0.6, top: '#1F5AA6', mid: '#62AEE4', low: '#DDF1FA', sun: '#FFFFFF', glow: '#FFF6CF', r: 13, cloud: 0.9, cloudFill: '#FFFFFF', dusk: 0 },
  { t: 0.975, top: '#2B1150', mid: '#D8447A', low: '#FF9A3D', sun: '#FF6A2A', glow: '#FF4D2E', r: 24, cloud: 0.6, cloudFill: '#FF9E8A', dusk: 0.75 },
];

const sunPoint = (t: number) => ({ x: 30 + t * 240, y: 150 - Math.sin(t * Math.PI) * 112 });

/** Cesta slunce mezi dvěma částmi dne — po oblouku, ne po přímce. Z večera do rána zajde za kopec a vyjde vlevo. */
function sunPath(from: number, to: number) {
  const a = SKY[from].t;
  const b = SKY[to].t;
  const wrap = from === SKY.length - 1 && to === 0;
  const ts = wrap ? [a, 1.05, 1.12, -0.12, -0.05, b] : Array.from({ length: 9 }, (_, i) => a + ((b - a) * i) / 8);
  const points = ts.map(sunPoint);
  return {
    x: points.map((p) => p.x),
    y: points.map((p) => p.y),
    times: wrap ? [0, 0.22, 0.36, 0.64, 0.78, 1] : undefined,
    duration: wrap ? 2.4 : 1.7,
  };
}

/** Malovaná obloha: slunce jede po oblouku, mění barvu a u poslední části dne zapadá za kopec s táborem. */
function CampSky({ from, to }: { from: number; to: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const sky = SKY[to];
  const path = useMemo(() => sunPath(from, to), [from, to]);
  const slow = { duration: 1.6, ease: 'easeInOut' as const };

  return (
    <svg viewBox="0 0 300 200" className="relative block w-full" role="img" aria-label="Slunce nad táborem podle části dne">
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <motion.stop offset="0" initial={false} animate={{ stopColor: sky.top }} transition={slow} />
          <motion.stop offset="0.5" initial={false} animate={{ stopColor: sky.mid }} transition={slow} />
          <motion.stop offset="0.78" initial={false} animate={{ stopColor: sky.low }} transition={slow} />
        </linearGradient>
        <filter id={`${uid}-soft`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id={`${uid}-cloud`} x="-20%" y="-60%" width="140%" height="220%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>

      <rect width="300" height="188" fill={`url(#${uid}-sky)`} />

      {/* záře u obzoru — navečer zčervená celé nebe nad kopcem */}
      <motion.ellipse cx="250" cy="146" rx="150" ry="34" fill="#FF7A3D" filter={`url(#${uid}-soft)`} initial={false} animate={{ opacity: sky.dusk }} transition={slow} />

      {/* slunce */}
      <motion.g initial={false} animate={{ x: path.x, y: path.y }} transition={{ duration: path.duration, ease: 'easeInOut', times: path.times }}>
        <motion.circle filter={`url(#${uid}-soft)`} opacity="0.55" initial={false} animate={{ r: sky.r * 2.6, fill: sky.glow }} transition={slow} />
        <motion.circle initial={false} animate={{ r: sky.r, fill: sky.sun }} transition={slow} />
      </motion.g>

      {/* mraky pomalu plují */}
      <motion.g filter={`url(#${uid}-cloud)`} initial={false} animate={{ opacity: sky.cloud, fill: sky.cloudFill }} transition={slow}>
        <motion.g animate={{ x: [0, 22, 0] }} transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}>
          <ellipse cx="78" cy="52" rx="26" ry="7" />
          <ellipse cx="96" cy="46" rx="18" ry="7" />
          <ellipse cx="62" cy="48" rx="14" ry="5" />
        </motion.g>
        <motion.g animate={{ x: [0, -18, 0] }} transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut' }}>
          <ellipse cx="214" cy="84" rx="30" ry="6" />
          <ellipse cx="232" cy="79" rx="16" ry="6" />
        </motion.g>
      </motion.g>

      {/* zadní kopec — za ním slunce zapadá */}
      <path d="M0 140 C30 128 70 124 110 136 C150 148 190 138 230 140 C260 141 285 144 300 146 L300 200 L0 200 Z" fill="#2A1A4A" />
      {/* přední kopec s lesem a stanem */}
      <path d="M0 162 C60 152 110 156 160 163 C210 170 255 156 300 160 L300 200 L0 200 Z" fill="#130c22" />
      <g fill="#130c22">
        <path d="M22 162 l8 -24 l8 24 z M26 150 l4 -14 l4 14 z" />
        <path d="M42 160 l10 -30 l10 30 z M47 146 l5 -17 l5 17 z" />
        <path d="M66 159 l7 -20 l7 20 z" />
        <path d="M270 160 l8 -24 l8 24 z M274 148 l4 -14 l4 14 z" />
      </g>
      <path d="M186 166 L203 141 L220 166 Z" fill="#1D1236" />
      <motion.path d="M199 166 L203 153 L207 166 Z" fill="#FFB21A" initial={false} animate={{ opacity: 0.35 + sky.dusk * 0.85 }} transition={slow} />
    </svg>
  );
}

export function CampDay() {
  const reduced = useReducedMotion();
  const [move, setMove] = useState({ from: 0, to: 0 });
  const active = move.to;
  const setActive = (next: number | ((current: number) => number)) =>
    setMove((current) => {
      const to = typeof next === 'function' ? next(current.to) : next;
      return to === current.to ? current : { from: current.to, to };
    });
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
    const id = window.setTimeout(() => setActive((i) => (i + 1) % campSchedule.length), DAY_MS);
    return () => window.clearTimeout(id);
  }, [running, active]);

  const slot = campSchedule[active];

  return (
    <div ref={ref} className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.8, ease: EASE }}
        className="relative mx-auto w-full max-w-[460px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#130c22]"
      >
        <CampSky from={Math.min(move.from, SKY.length - 1)} to={Math.min(active, SKY.length - 1)} />
        <div className="relative -mt-px bg-[#130c22] px-7 pb-7 pt-2">
          <motion.p key={slot.time} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} className="text-4xl font-black tracking-tight text-white md:text-5xl" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {slot.time}
          </motion.p>
          <p className="mt-1 text-lg font-bold text-white/70">{slot.title}</p>
        </div>
      </motion.div>

      <ol className="space-y-2">
        {campSchedule.map((item, i) => {
          const lit = i === active;
          return (
            <motion.li
              key={item.time}
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
                className={`relative flex w-full items-center gap-4 overflow-hidden rounded-3xl border px-5 py-4 text-left transition-colors duration-300 md:gap-6 md:px-6 md:py-5 ${lit ? 'border-white/20 bg-white/[0.07]' : 'border-transparent hover:bg-white/[0.03]'}`}
              >
                {lit && running ? (
                  <motion.span
                    key={`bar-${active}`}
                    className="absolute bottom-0 left-0 h-1 rounded-full"
                    style={{ background: DAY_COLORS[i] }}
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: DAY_MS / 1000, ease: 'linear' }}
                  />
                ) : null}
                <motion.span
                  animate={{ scale: lit && !reduced ? 1 : 0.86, opacity: lit ? 1 : 0.55 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                  className="flex h-14 w-[4.6rem] shrink-0 items-center justify-center rounded-2xl text-lg font-black text-[#0B0B10] md:h-16 md:w-20 md:text-xl"
                  style={{ background: DAY_COLORS[i], fontVariantNumeric: 'tabular-nums' }}
                >
                  {item.time.slice(0, 5)}
                </motion.span>
                <span className="min-w-0">
                  <span className={`block text-xl font-black leading-tight tracking-tight transition-colors duration-300 md:text-3xl ${lit ? 'text-white' : 'text-white/45'}`}>{item.title}</span>
                  <span className={`mt-1 block text-[15px] font-medium leading-6 transition-colors duration-300 md:text-base ${lit ? 'text-white/75' : 'text-white/35'}`}>{item.text}</span>
                </span>
              </button>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---------- co je v ceně: velký jezdící pás ---------- */

const INCLUDED = ['Obědy a svačiny', 'Pitný režim', 'Táborové tričko', 'Trenéři a animátoři', 'Trénink, hry a výzvy', 'Překážková dráha'];

export function CampIncluded() {
  const row = [...INCLUDED, ...INCLUDED];
  return (
    <div className="relative overflow-hidden py-2 [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
      <div className="camp-marquee flex w-max items-center gap-8 md:gap-12">
        {row.map((label, i) => (
          <span key={`${label}-${i}`} className="flex items-center gap-8 whitespace-nowrap text-4xl font-black tracking-tight text-white md:gap-12 md:text-7xl">
            {label}
            <Star size={28} className="shrink-0 fill-[#FFB21A] text-[#FFB21A] md:h-10 md:w-10" />
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- čím jsme jiní: tři věty, svítí ta uprostřed obrazovky ---------- */

const DIFFERENCES = [
  { title: 'Celý den v pohybu', text: 'Trénink, hry a překážková dráha od rána do odpoledne.' },
  { title: 'Bez ranního papírování', text: 'Přihlášku, souhlasy i zdravotní údaje vyplníš předem v aplikaci.' },
  { title: 'Vedou to certifikovaní trenéři', text: 'A animátoři, kteří děti opravdu baví.' },
];

export function CampDifferences() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const rows = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const middle = window.innerHeight * 0.55;
      let best = 0;
      let bestDistance = Infinity;
      rows.current.forEach((row, i) => {
        if (!row) return;
        const rect = row.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - middle);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      });
      setActive(best);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <ol className="space-y-4 md:space-y-8">
      {DIFFERENCES.map((item, i) => {
        const lit = i === active;
        return (
          <motion.li
            key={item.title}
            ref={(el) => {
              rows.current[i] = el;
            }}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: i * 0.06, ease: EASE }}
            onMouseEnter={() => setActive(i)}
            className="relative py-4 md:py-6"
          >
            <motion.div
              animate={{ x: lit && !reduced ? 16 : 0, opacity: lit ? 1 : 0.3 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="flex items-start gap-5 md:gap-8"
            >
              <span className={`text-5xl font-black leading-none tracking-tight md:text-8xl ${lit ? 'bg-gradient-to-br from-brand-purple-light to-[#F12BB3] bg-clip-text text-transparent' : 'text-white/40'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {i + 1}
              </span>
              <span className="min-w-0 pt-1">
                <span className="block text-3xl font-black leading-[1.02] tracking-tight text-white md:text-6xl">{item.title}</span>
                <span className="mt-2 block max-w-xl text-lg font-medium leading-relaxed text-white/70 md:text-xl">{item.text}</span>
              </span>
            </motion.div>
            <motion.span
              className="absolute bottom-0 left-0 h-px bg-gradient-to-r from-brand-purple via-[#F12BB3] to-transparent"
              animate={{ width: lit ? '100%' : '0%', opacity: lit ? 1 : 0 }}
              transition={{ duration: 0.6, ease: EASE }}
            />
          </motion.li>
        );
      })}
    </ol>
  );
}
