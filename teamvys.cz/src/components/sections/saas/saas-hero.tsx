'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, CalendarCheck, Coins, Nfc, Sparkles, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';

const ease = [0.22, 1, 0.36, 1] as const;

const item = {
  hidden: { opacity: 0, y: 32 },
  visible: (d = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.72, delay: d, ease } }),
};

export function SaasHero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const cardsY = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const cardsY2 = useTransform(scrollYProgress, [0, 1], [0, -160]);

  return (
    <section ref={ref} className="relative overflow-hidden bg-brand-night">
      {/* Ambient ember glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[18%] top-[-12%] h-[68vh] w-[68vh] rounded-full bg-[radial-gradient(circle,rgba(139,29,255,0.28)_0%,transparent_70%)]" />
        <div className="absolute -right-[12%] bottom-[-20%] h-[60vh] w-[60vh] rounded-full bg-[radial-gradient(circle,rgba(241,43,179,0.15)_0%,transparent_70%)]" />
        <div className="absolute left-[42%] top-[30%] h-[40vh] w-[55vh] rounded-full bg-[radial-gradient(circle,rgba(139,29,255,0.12)_0%,transparent_70%)]" />
      </div>

      {/* Subtle grid */}
      <div aria-hidden className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_85%_65%_at_45%_0%,black,transparent)]" />

      {/* Giant background word — Hims-style oversized typography */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[8%] select-none text-center text-[22vw] font-black leading-none tracking-tighter text-white/[0.025]">
        platforma
      </div>

      <div className="section-shell relative grid gap-14 py-24 md:py-32 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-8 lg:py-36">
        {/* Left: copy */}
        <div className="relative z-10">
          <motion.span
            initial="hidden"
            animate="visible"
            variants={item}
            custom={0}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-black uppercase tracking-wider text-white/80 backdrop-blur-md"
          >
            <Sparkles size={14} className="text-brand-ember" />
            Platforma pro dětské sportovní organizace
          </motion.span>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={item}
            custom={0.1}
            className="mt-6 max-w-[14ch] text-[clamp(2.8rem,6.5vw,5.2rem)] font-black leading-[0.98] tracking-[-0.035em] text-white"
          >
            Váš klub.
            <br />
            <span className="bg-gradient-ember bg-clip-text text-transparent">Digitálně.</span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={item}
            custom={0.2}
            className="mt-6 max-w-[46ch] text-base font-bold leading-7 text-white/70 md:text-lg"
          >
            Docházka, skupiny, trenéři, platby i gamifikace pro děti — kompletní správa sportovního
            klubu v jedné platformě. Postaveno klubem, který ji sám denně používá.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={item}
            custom={0.32}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/kontakty"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-ember px-7 text-sm font-black text-white shadow-[0_14px_36px_rgba(139,29,255,0.4)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(139,29,255,0.5)]"
            >
              Požádat o aktivaci
              <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#platforma"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-7 text-sm font-black text-white backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.1]"
            >
              Co umí platforma
            </Link>
          </motion.div>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={item}
            custom={0.42}
            className="mt-5 text-xs font-bold text-white/45"
          >
            2 490 Kč / měsíc · první měsíc zdarma · zrušit můžete kdykoliv
          </motion.p>
        </div>

        {/* Right: overlapping glass cards with parallax */}
        <div className="relative z-10 hidden min-h-[460px] lg:block" aria-hidden>
          <motion.div
            style={{ y: cardsY }}
            initial={{ opacity: 0, y: 60, rotate: -3 }}
            animate={{ opacity: 1, y: 0, rotate: -3 }}
            transition={{ duration: 0.9, delay: 0.35, ease }}
            className="absolute left-0 top-6 w-[300px] rounded-[22px] border border-white/10 bg-white/[0.07] p-5 shadow-[0_30px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-gradient-ember text-white"><CalendarCheck size={18} /></span>
              <div>
                <p className="text-sm font-black text-white">Dnešní trénink</p>
                <p className="text-xs font-bold text-white/55">Parkour začátečníci · 16:30</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {[
                { name: 'Eliška N.', here: true },
                { name: 'Matyáš K.', here: true },
                { name: 'Tobiáš R.', here: false },
              ].map((row) => (
                <div key={row.name} className="flex items-center justify-between rounded-[12px] bg-white/[0.05] px-3 py-2">
                  <span className="text-xs font-bold text-white/80">{row.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${row.here ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/[0.08] text-white/40'}`}>
                    {row.here ? 'NFC ✓' : '—'}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            style={{ y: cardsY2 }}
            initial={{ opacity: 0, y: 80, rotate: 2.5 }}
            animate={{ opacity: 1, y: 0, rotate: 2.5 }}
            transition={{ duration: 0.9, delay: 0.5, ease }}
            className="absolute right-0 top-44 w-[280px] rounded-[22px] border border-white/10 bg-white/[0.07] p-5 shadow-[0_30px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-white/[0.08] text-brand-pink"><TrendingUp size={18} /></span>
              <div>
                <p className="text-sm font-black text-white">XP účastníka</p>
                <p className="text-xs font-bold text-white/55">Level 4 · maskot Ras</p>
              </div>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full w-[72%] rounded-full bg-gradient-ember" />
            </div>
            <p className="mt-2 text-right text-[11px] font-black text-white/60">2 880 / 4 000 XP</p>
          </motion.div>

          <motion.div
            style={{ y: cardsY }}
            initial={{ opacity: 0, y: 100, rotate: -1.5 }}
            animate={{ opacity: 1, y: 0, rotate: -1.5 }}
            transition={{ duration: 0.9, delay: 0.65, ease }}
            className="absolute bottom-0 left-16 flex w-[260px] items-center gap-3 rounded-[20px] border border-white/10 bg-white/[0.07] p-4 shadow-[0_30px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-emerald-400/15 text-emerald-300"><Coins size={18} /></span>
            <div>
              <p className="text-sm font-black text-white">Platba přijata</p>
              <p className="text-xs font-bold text-white/55">Kroužek · 1 890 Kč · Stripe</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.85, ease }}
            className="absolute right-14 top-6 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 backdrop-blur-xl"
          >
            <Nfc size={14} className="text-brand-ember" />
            <span className="text-[11px] font-black text-white/80">NFC čipy dodáme my</span>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
