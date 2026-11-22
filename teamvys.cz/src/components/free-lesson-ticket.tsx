'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * „První lekce zdarma" jako vstupenka: velký nadpis, útržek s cenou 0 Kč,
 * perforace mezi nimi a odlesk, který po vstupence jednou za čas přejede.
 * Stojí na světlém podkladu katalogu kroužků (výřezy mají jeho barvu).
 */
export function FreeLessonTicket() {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 26, rotate: -1.5, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ type: 'spring', stiffness: 160, damping: 20 }}
      whileHover={reduced ? undefined : { rotate: -0.6, y: -3 }}
      className="relative mx-auto flex max-w-4xl flex-col overflow-hidden rounded-[28px] bg-gradient-to-br from-[#8B1DFF] via-[#A52BE6] to-[#F12BB3] text-white shadow-[0_30px_60px_-24px_rgba(139,29,255,0.75)] md:flex-row"
    >
      {/* odlesk */}
      {reduced ? null : (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          animate={{ left: ['-40%', '130%'] }}
          transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 3.6, ease: 'easeInOut' }}
        />
      )}

      <div className="relative flex-1 p-6 md:p-9">
        <h2 className="text-balance text-[2.6rem] font-black leading-[0.95] tracking-tight md:text-6xl">První lekce zdarma</h2>
        <p className="mt-3 max-w-md text-base font-semibold leading-snug text-white/85 md:text-lg">
          Přijď si to vyzkoušet. Naskočit můžeš kdykoliv během roku – jedeme na permanentky.
        </p>
      </div>

      {/* útržek */}
      <div className="relative flex items-center justify-between gap-3 border-t-2 border-dashed border-white/45 px-6 py-5 md:w-[240px] md:flex-col md:justify-center md:gap-1 md:border-l-2 md:border-t-0 md:px-8 md:py-9">
        <span aria-hidden className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-brand-paper" />
        <span aria-hidden className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-brand-paper md:-bottom-3 md:-left-3 md:right-auto md:top-auto" />
        <motion.span
          className="text-6xl font-black leading-none tracking-tight md:text-7xl"
          style={{ fontVariantNumeric: 'tabular-nums' }}
          animate={reduced ? undefined : { scale: [1, 1.06, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          0 Kč
        </motion.span>
        <span className="text-right text-sm font-black text-white/85 md:text-center md:text-base">za první trénink</span>
      </div>
    </motion.div>
  );
}
