'use client';

import { animate, motion, useInView, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { Bell, Check } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

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
      <p ref={ref} className="max-w-5xl text-4xl font-black leading-[1.08] tracking-tight text-white md:text-7xl">
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

function SceneLadder() {
  const steps = ['Pády', 'Koordinace', 'Přeskoky', 'Salta'];
  return (
    <div className="flex h-[200px] w-full max-w-[380px] items-end gap-3">
      {steps.map((step, i) => (
        <div key={step} className="relative flex-1" style={{ height: `${40 + i * 20}%` }}>
          <div className="absolute inset-0 rounded-2xl border border-white/10 bg-white/[0.05]" />
          <motion.div
            className="absolute inset-0 rounded-2xl bg-gradient-to-t from-brand-purple to-[#F12BB3]"
            animate={{ opacity: [0, 0, 1, 1, 0], scaleY: [0.2, 0.2, 1, 1, 1] }}
            transition={{ ...LOOP, times: [0, 0.1 + i * 0.16, 0.2 + i * 0.16, 0.92, 1] }}
            style={{ transformOrigin: 'bottom' }}
          />
          <span className="absolute inset-x-0 bottom-3 text-center text-sm font-black text-white">{step}</span>
        </div>
      ))}
    </div>
  );
}

function SceneXp() {
  const bracelets = ['#D6C2A8', '#B23BFF', '#5410B7', '#F12BB3', '#171220'];
  return (
    <div className="w-full max-w-[380px]">
      <div className="flex items-end justify-between">
        <span className="text-5xl font-black leading-none text-white">
          Level <span className="text-[#FFB21A]">7</span>
        </span>
        <span className="text-base font-bold text-white/60">920 / 1 800 XP</span>
      </div>
      <div className="mt-4 h-4 overflow-hidden rounded-full bg-white/10">
        <motion.div className="h-full origin-left rounded-full bg-gradient-to-r from-brand-purple to-[#F12BB3]" animate={{ scaleX: [0.08, 0.51, 0.51, 0.08] }} transition={{ ...LOOP, times: [0, 0.45, 0.9, 1] }} />
      </div>
      <div className="mt-7 flex items-center gap-3">
        {bracelets.map((color, i) => (
          <motion.span
            key={color}
            className="h-12 flex-1 rounded-full border-[5px]"
            style={{ borderColor: color, boxShadow: `0 0 24px ${color}66` }}
            animate={{ opacity: [0.2, 0.2, 1, 1, 0.2], scale: [0.85, 0.85, 1.08, 1, 0.85] }}
            transition={{ ...LOOP, times: [0, 0.1 + i * 0.13, 0.18 + i * 0.13, 0.92, 1] }}
          />
        ))}
      </div>
    </div>
  );
}

function SceneParent() {
  const toasts = ['Eliška dorazila na trénink', 'Zbývá 9 vstupů z 15', 'Platba přijata'];
  return (
    <div className="w-full max-w-[380px] space-y-3">
      {toasts.map((text, i) => (
        <motion.div
          key={text}
          className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-[0_18px_40px_-18px_rgba(139,29,255,0.7)]"
          animate={{ opacity: [0, 0, 1, 1, 0], x: [40, 40, 0, 0, -10], scale: [0.95, 0.95, 1, 1, 0.98] }}
          transition={{ ...LOOP, times: [0, 0.08 + i * 0.18, 0.16 + i * 0.18, 0.92, 1] }}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-[#F12BB3] text-white">{i === 2 ? <Check size={18} strokeWidth={3.5} /> : <Bell size={18} />}</span>
          <span className="text-base font-black text-[#0B0B10]">{text}</span>
        </motion.div>
      ))}
    </div>
  );
}

const PILLARS: { title: string; text: string; scene: ReactNode }[] = [
  { title: 'Bezpečně a postupně', text: 'Každý trik nejdřív na žíněnce, až potom v terénu.', scene: <SceneLadder /> },
  { title: 'Skill tree a XP', text: 'Dítě sbírá XP, odemyká triky a získává barevné náramky.', scene: <SceneXp /> },
  { title: 'Pro rodiče jednoduše', text: 'Platby, docházku i pokrok dítěte vidíte v aplikaci.', scene: <SceneParent /> },
];

export function AboutPillars() {
  return (
    <section className="section-shell pb-20 md:pb-32">
      <h2 className="max-w-4xl text-balance text-3xl font-black leading-[1.02] tracking-tight text-white md:text-6xl">Parkour je cesta, ne jednorázový výkon</h2>
      <div className="mt-12 space-y-6 md:mt-16 md:space-y-8">
        {PILLARS.map((pillar, i) => (
          <motion.div
            key={pillar.title}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, ease: EASE }}
            className="grid items-center gap-8 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-7 md:grid-cols-2 md:gap-12 md:rounded-[2.5rem] md:p-12"
          >
            <div className={i % 2 === 1 ? 'md:order-2' : ''}>
              <p className="text-6xl font-black leading-none text-white/15 md:text-8xl" style={{ fontVariantNumeric: 'tabular-nums' }}>
                0{i + 1}
              </p>
              <h3 className="mt-4 text-balance text-3xl font-black leading-[1.02] tracking-tight text-white md:text-5xl">{pillar.title}</h3>
              <p className="mt-4 max-w-md text-lg font-medium leading-relaxed text-white/70 md:text-xl">{pillar.text}</p>
            </div>
            <div className="flex justify-center">{pillar.scene}</div>
          </motion.div>
        ))}
      </div>
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
