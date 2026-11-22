'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Play } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { WorkshopBrowser } from '@/components/public-admin-products';
import { useAdminCreatedProducts } from '@/lib/admin-created-products';

/**
 * Sekce stránky Workshopy. Když není vypsaný žádný termín, místo prázdného
 * prohlížeče víkendů se ukáže „připravujeme" — a pod tím tři kroky s animovanou
 * scénou, které vysvětlí, jak workshop funguje, takže stránka dává smysl i bez termínů.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

/* ---------- nabídka termínů / připravujeme ---------- */

export function WorkshopOffer() {
  const reduced = useReducedMotion();
  const { products, loading, error } = useAdminCreatedProducts();
  // Počítá se jen workshop, který teprve bude — prošlé termíny by jinak ukazovaly prázdný kalendář.
  const today = new Date().toISOString().slice(0, 10);
  const hasWorkshops = products.some((product) => {
    if (product.type !== 'Workshop') return false;
    const match = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(product.primaryMeta ?? '');
    if (!match) return true; // bez data nejde poznat, že už proběhl
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` >= today;
  });

  if (loading || error || hasWorkshops) {
    return (
      <section className="section-shell py-16 md:py-24">
        <h2 className="text-3xl font-black tracking-tight text-white md:text-5xl">Vyber si termín</h2>
        <div className="mx-[calc(50%-50vw)] mt-10 bg-brand-paper p-4 shadow-[0_30px_80px_rgba(0,0,0,0.45)] md:mx-0 md:rounded-[28px] md:p-6 lg:p-8">
          <WorkshopBrowser />
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
        className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#F12BB3]/[0.22] via-[#1a1030] to-[#0B0B10] p-8 md:rounded-[2.5rem] md:p-14"
      >
        {reduced ? null : (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,#8B1DFF_0%,rgba(139,29,255,0.35)_45%,transparent_70%)] md:h-96 md:w-96"
            animate={{ x: [0, -26, 0], y: [0, 20, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <div className="relative max-w-2xl">
          <h2 className="text-balance text-4xl font-black leading-[1.02] tracking-tight text-white md:text-6xl">Další termíny připravujeme</h2>
          <p className="mt-5 max-w-lg text-lg font-medium leading-relaxed text-white/70 md:text-xl">Jakmile je vypíšeme, najdeš je tady i v aplikaci. Chceš vědět jako první?</p>
          <Link href="/kontakty" className="group mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-base font-black text-[#0B0B10] transition-transform hover:-translate-y-0.5">
            Napiš nám
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

/* ---------- tři kroky se scénou ---------- */

/** Karta se otočí: z jedné strany video, z druhé totéž naživo v tělocvičně. */
function SceneLive() {
  const loop = { duration: 6, repeat: Infinity };
  return (
    <div className="w-full max-w-[340px] [perspective:1100px]">
      <motion.div
        className="relative aspect-[16/10] w-full [transform-style:preserve-3d]"
        animate={{ rotateY: [0, 0, 180, 180, 360] }}
        transition={{ ...loop, times: [0, 0.34, 0.46, 0.88, 1], ease: 'easeInOut' }}
      >
        {/* video */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-[#2a1650] to-[#0f0a1c] [backface-visibility:hidden]">
          <span className="absolute left-4 top-4 rounded-full bg-white/15 px-3 py-1 text-xs font-black text-white">Video</span>
          <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#0B0B10]">
            <Play size={26} className="translate-x-0.5 fill-current" />
          </span>
          <div className="absolute inset-x-4 bottom-4 h-1.5 overflow-hidden rounded-full bg-white/20">
            <motion.div className="h-full origin-left rounded-full bg-[#F12BB3]" animate={{ scaleX: [0, 0.75, 0.75, 0] }} transition={{ ...loop, times: [0, 0.34, 0.95, 1], ease: 'linear' }} />
          </div>
        </div>
        {/* naživo */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-purple to-[#F12BB3] [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-black text-[#0B0B10]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            Naživo
          </span>
          <p className="absolute inset-x-5 bottom-5 text-3xl font-black leading-none tracking-tight text-white">V tělocvičně, vedle tebe</p>
        </div>
      </motion.div>
    </div>
  );
}

// Obrazec QR kódu — jen kresba, nic se z něj nedá načíst.
const QR = Array.from({ length: 11 }, (_, row) => Array.from({ length: 11 }, (_, col) => ((row * 7 + col * 13 + row * col) % 5 < 2)));
const inFinder = (row: number, col: number) => (row < 3 && col < 3) || (row < 3 && col > 7) || (row > 7 && col < 3);

/** Vstupenka s QR kódem: přejede po ní čtečka a naskočí potvrzení. */
function SceneTicket() {
  const loop = { duration: 5.5, repeat: Infinity };
  return (
    <div className="relative w-full max-w-[300px]">
      <motion.div
        className="relative overflow-hidden rounded-3xl bg-white p-5 shadow-[0_30px_60px_-24px_rgba(139,29,255,0.8)]"
        animate={{ rotate: [-3, -3, 0, 0, -3] }}
        transition={{ ...loop, times: [0, 0.2, 0.3, 0.92, 1], ease: 'easeInOut' }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xl font-black tracking-tight text-[#0B0B10]">Workshop</span>
          <span className="text-sm font-black text-brand-purple">1 vstup</span>
        </div>
        <div className="relative mx-auto mt-4 w-[176px]">
          <svg viewBox="0 0 11 11" className="block w-full" shapeRendering="crispEdges" aria-hidden>
            {QR.map((cells, row) => cells.map((on, col) => (on && !inFinder(row, col) ? <rect key={`${row}-${col}`} x={col} y={row} width="1" height="1" fill="#0B0B10" /> : null)))}
            {[[0, 0], [0, 8], [8, 0]].map(([row, col]) => (
              <g key={`${row}-${col}`}>
                <rect x={col} y={row} width="3" height="3" fill="#0B0B10" />
                <rect x={col + 0.5} y={row + 0.5} width="2" height="2" fill="#fff" />
                <rect x={col + 1} y={row + 1} width="1" height="1" fill="#0B0B10" />
              </g>
            ))}
          </svg>
          {/* čtečka */}
          <motion.span
            className="absolute inset-x-[-6px] h-[3px] rounded-full bg-[#F12BB3] shadow-[0_0_18px_4px_rgba(241,43,179,0.7)]"
            animate={{ top: ['0%', '0%', '100%', '0%', '0%'], opacity: [0, 1, 1, 1, 0] }}
            transition={{ ...loop, times: [0, 0.2, 0.42, 0.6, 0.64], ease: 'easeInOut' }}
          />
          <motion.span
            className="absolute inset-0 flex items-center justify-center rounded-2xl bg-emerald-500/95 text-white"
            animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.8, 0.8, 1, 1, 0.96] }}
            transition={{ ...loop, times: [0, 0.62, 0.7, 0.93, 1] }}
          >
            <Check size={64} strokeWidth={4} />
          </motion.span>
        </div>
        <div className="mt-4 border-t-2 border-dashed border-[#0B0B10]/15 pt-3 text-center text-base font-black text-[#0B0B10]">
          <span className="relative block h-6">
            <motion.span className="absolute inset-0" animate={{ opacity: [1, 1, 0, 0, 1] }} transition={{ ...loop, times: [0, 0.62, 0.68, 0.95, 1] }}>
              Ukaž u vstupu
            </motion.span>
            <motion.span className="absolute inset-0 text-emerald-600" animate={{ opacity: [0, 0, 1, 1, 0] }} transition={{ ...loop, times: [0, 0.62, 0.7, 0.93, 1] }}>
              Vstup potvrzen
            </motion.span>
          </span>
        </div>
      </motion.div>
    </div>
  );
}

/** Karta triku dostane razítko „Zapsáno" a přičtou se XP. */
function SceneStamp() {
  const loop = { duration: 5.5, repeat: Infinity };
  return (
    <div className="relative w-full max-w-[340px]">
      <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-white/[0.06] p-6">
        <p className="text-sm font-bold text-white/55">Trik dne</p>
        <p className="mt-1 text-5xl font-black leading-none tracking-tight text-white">Backflip</p>
        <p className="mt-2 text-base font-semibold text-white/65">Salto vzad z místa</p>
        <div className="mt-6 flex items-center justify-between gap-3">
          <motion.span
            className="text-3xl font-black text-[#FFB21A]"
            style={{ fontVariantNumeric: 'tabular-nums' }}
            animate={{ opacity: [0, 0, 1, 1, 0], y: [14, 14, 0, 0, 0], scale: [0.8, 0.8, 1.2, 1, 1] }}
            transition={{ ...loop, times: [0, 0.48, 0.56, 0.94, 1] }}
          >
            +1 050 XP
          </motion.span>
        </div>
        {/* razítko */}
        <motion.span
          className="absolute bottom-6 right-5 rounded-xl border-[3px] border-emerald-400 px-3 py-1.5 text-lg font-black uppercase tracking-wide text-emerald-400"
          animate={{ opacity: [0, 0, 1, 1, 0], scale: [2.4, 2.4, 0.92, 1, 1], rotate: [-28, -28, -12, -12, -12] }}
          transition={{ ...loop, times: [0, 0.3, 0.38, 0.94, 1], ease: 'easeOut' }}
        >
          Zapsáno
        </motion.span>
      </div>
    </div>
  );
}

const STEPS: { title: string; text: string; scene: ReactNode }[] = [
  { title: 'Z videa do tělocvičny', text: 'Youtuber, na kterého koukáš, ti triky ukáže naživo.', scene: <SceneLive /> },
  { title: 'Vstupenka v telefonu', text: 'Po zaplacení máš v aplikaci QR vstupenku. Na místě ji jen ukážeš.', scene: <SceneTicket /> },
  { title: 'Trik se ti zapíše', text: 'Co se naučíš, ti trenér připíše do aplikace.', scene: <SceneStamp /> },
];

export function WorkshopSteps() {
  return (
    <section className="section-shell pb-20 md:pb-32">
      <h2 className="max-w-4xl text-balance text-3xl font-black leading-[1.02] tracking-tight text-white md:text-6xl">Jeden den, jeden trik navíc</h2>
      <div className="mt-12 space-y-6 md:mt-16 md:space-y-8">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.title}
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
              <h3 className="mt-4 text-balance text-3xl font-black leading-[1.02] tracking-tight text-white md:text-5xl">{step.title}</h3>
              <p className="mt-4 max-w-md text-lg font-medium leading-relaxed text-white/70 md:text-xl">{step.text}</p>
            </div>
            <div className="flex justify-center">{step.scene}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
