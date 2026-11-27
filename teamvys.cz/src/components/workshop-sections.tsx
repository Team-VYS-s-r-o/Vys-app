'use client';

import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import type { ReactNode } from 'react';

import { SceneRows } from '@/components/scene-rows';

/**
 * Jak workshop funguje — tři kroky s animovanou scénou. Nabídku termínů kreslí
 * `workshop-feature.tsx`; tyhle scény jsou na konci stránky vždy.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

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

// Kresba QR kódu (25 × 25 teček) — jen obrázek, nic se z něj nedá načíst.
const QR_SIZE = 25;
const inFinder = (row: number, col: number) => (row < 8 && col < 8) || (row < 8 && col > QR_SIZE - 9) || (row > QR_SIZE - 9 && col < 8);
const QR_DOTS: [number, number][] = [];
for (let row = 0; row < QR_SIZE; row += 1) {
  for (let col = 0; col < QR_SIZE; col += 1) {
    if (inFinder(row, col)) continue;
    if ((row * 31 + col * 17 + row * col * 7 + (row ^ col) * 13) % 7 < 3) QR_DOTS.push([row, col]);
  }
}
const QR_FINDERS: [number, number][] = [[0, 0], [0, QR_SIZE - 7], [QR_SIZE - 7, 0]];

/** Vstupenka v telefonu: hledáček zaměří QR kód, přejede po něm světlo, kód zezelená a naskočí potvrzení. */
function SceneTicket() {
  const loop = { duration: 6, repeat: Infinity };
  const corner = 'absolute h-7 w-7 border-current';
  return (
    <motion.div
      className="relative w-full max-w-[290px] rounded-[30px] bg-white p-5 shadow-[0_30px_70px_-26px_rgba(139,29,255,0.9)]"
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xl font-black tracking-tight text-[#0B0B10]">Workshop</span>
        <span className="text-sm font-black text-brand-purple">1 vstup</span>
      </div>

      <div className="relative mx-auto mt-5 w-[188px]">
        <svg viewBox={`0 0 ${QR_SIZE} ${QR_SIZE}`} className="block w-full" aria-hidden>
          <motion.g animate={{ fill: ['#0B0B10', '#0B0B10', '#059669', '#059669', '#0B0B10'] }} transition={{ ...loop, times: [0, 0.52, 0.58, 0.94, 1] }}>
            {QR_DOTS.map(([row, col]) => (
              <rect key={`${row}-${col}`} x={col + 0.08} y={row + 0.08} width="0.84" height="0.84" rx="0.24" />
            ))}
            {QR_FINDERS.map(([row, col]) => (
              <g key={`${row}-${col}`}>
                <rect x={col} y={row} width="7" height="7" rx="1.7" />
                <rect x={col + 1} y={row + 1} width="5" height="5" rx="1.1" fill="#fff" />
                <rect x={col + 2} y={row + 2} width="3" height="3" rx="0.75" />
              </g>
            ))}
          </motion.g>
        </svg>

        {/* světlo čtečky */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-x-[-8px] h-14 bg-gradient-to-b from-transparent via-[#F12BB3]/40 to-transparent"
          animate={{ top: ['-20%', '-20%', '95%', '95%'], opacity: [0, 0, 1, 1, 0, 0] }}
          transition={{ top: { ...loop, times: [0, 0.22, 0.46, 1], ease: 'easeInOut' }, opacity: { ...loop, times: [0, 0.2, 0.26, 0.42, 0.48, 1] } }}
        />

        {/* hledáček: čtyři rohy se stáhnou na kód a po načtení zezelenají */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-[-12px]"
          animate={{ scale: [1.28, 1.28, 1, 1, 1.06], opacity: [0, 0, 1, 1, 0], color: ['#F12BB3', '#F12BB3', '#F12BB3', '#10B981', '#10B981'] }}
          transition={{ ...loop, times: [0, 0.1, 0.2, 0.58, 1], ease: 'easeOut' }}
        >
          <span className={`${corner} left-0 top-0 rounded-tl-2xl border-l-[3px] border-t-[3px]`} />
          <span className={`${corner} right-0 top-0 rounded-tr-2xl border-r-[3px] border-t-[3px]`} />
          <span className={`${corner} bottom-0 left-0 rounded-bl-2xl border-b-[3px] border-l-[3px]`} />
          <span className={`${corner} bottom-0 right-0 rounded-br-2xl border-b-[3px] border-r-[3px]`} />
        </motion.div>

        {/* potvrzení: bílý kroužek, do kterého se dokreslí fajfka */}
        <motion.span
          className="absolute left-1/2 top-1/2 flex h-[76px] w-[76px] items-center justify-center rounded-full bg-white shadow-[0_12px_30px_-10px_rgba(5,150,105,0.9)] ring-4 ring-emerald-500"
          style={{ x: '-50%', y: '-50%' }}
          animate={{ scale: [0, 0, 1.18, 1, 0] }}
          transition={{ ...loop, times: [0, 0.54, 0.62, 0.94, 1] }}
        >
          <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="#059669" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <motion.path d="M5 12.5l4.5 4.5L19 7.5" animate={{ pathLength: [0, 0, 1, 1, 0] }} transition={{ ...loop, times: [0, 0.58, 0.68, 0.94, 1] }} />
          </svg>
        </motion.span>
      </div>

      <div className="mt-5 border-t-2 border-dashed border-[#0B0B10]/15 pt-3 text-center text-base font-black text-[#0B0B10]">
        <span className="relative block h-6">
          <motion.span className="absolute inset-0" animate={{ opacity: [1, 1, 0, 0, 1] }} transition={{ ...loop, times: [0, 0.54, 0.6, 0.95, 1] }}>
            Ukaž u vstupu
          </motion.span>
          <motion.span className="absolute inset-0 text-emerald-600" animate={{ opacity: [0, 0, 1, 1, 0] }} transition={{ ...loop, times: [0, 0.56, 0.64, 0.94, 1] }}>
            Vstup potvrzen
          </motion.span>
        </span>
      </div>
    </motion.div>
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
      <SceneRows items={STEPS} />
    </section>
  );
}
