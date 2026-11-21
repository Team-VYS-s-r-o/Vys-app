'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Star } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

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

export function CampDay() {
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
    const id = window.setTimeout(() => setActive((i) => (i + 1) % campSchedule.length), DAY_MS);
    return () => window.clearTimeout(id);
  }, [running, active]);

  // Slunce jede po oblouku zleva doprava podle části dne.
  const t = (active + 0.5) / campSchedule.length;
  const sunX = 20 + t * 260;
  const sunY = 150 - Math.sin(t * Math.PI) * 118;
  const slot = campSchedule[active];

  return (
    <div ref={ref} className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.8, ease: EASE }}
        className="relative mx-auto w-full max-w-[460px] overflow-hidden rounded-[2rem] border border-white/10"
      >
        <motion.div
          className="absolute inset-0"
          animate={{ background: `linear-gradient(180deg, ${DAY_COLORS[active]}55 0%, #130c22 78%)` }}
          transition={{ duration: 0.8 }}
        />
        <svg viewBox="0 0 300 190" className="relative block w-full">
          <path d="M20 150 A130 118 0 0 1 280 150" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2" strokeDasharray="3 7" strokeLinecap="round" />
          {campSchedule.map((item, i) => {
            const p = (i + 0.5) / campSchedule.length;
            return <circle key={item.time} cx={20 + p * 260} cy={150 - Math.sin(p * Math.PI) * 118} r={i === active ? 0 : 4} fill="rgba(255,255,255,0.45)" />;
          })}
          <motion.g initial={false} animate={{ x: sunX, y: sunY }} transition={{ type: 'spring', stiffness: 70, damping: 15 }}>
            <circle r="26" fill={DAY_COLORS[active]} opacity="0.28" />
            <circle r="16" fill="#fff" />
          </motion.g>
          <line x1="0" y1="150" x2="300" y2="150" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
        </svg>
        <div className="relative px-7 pb-7">
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
