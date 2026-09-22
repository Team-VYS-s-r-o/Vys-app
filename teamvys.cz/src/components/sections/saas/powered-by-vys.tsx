'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

const ease = [0.22, 1, 0.36, 1] as const;

export function PoweredByVys() {
  return (
    <section className="relative overflow-hidden bg-brand-paper py-20 md:py-28">
      <div className="section-shell">
        <div className="relative overflow-hidden rounded-[32px] bg-brand-night px-7 py-14 md:px-14 md:py-20">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -right-[10%] top-[-30%] h-[55vh] w-[55vh] rounded-full bg-[radial-gradient(circle,rgba(139,29,255,0.24)_0%,transparent_70%)]" />
            <div className="absolute -left-[8%] bottom-[-35%] h-[45vh] w-[45vh] rounded-full bg-[radial-gradient(circle,rgba(241,43,179,0.12)_0%,transparent_70%)]" />
          </div>
          <div aria-hidden className="pointer-events-none absolute -bottom-8 right-4 select-none text-[16vw] font-black leading-none tracking-tighter text-white/[0.03] md:text-[10vw]">
            TEAMVYS
          </div>

          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
            <div>
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.6, ease }}
                className="text-xs font-black uppercase tracking-[0.2em] text-brand-ember"
              >
                Powered by Team VYS
              </motion.p>
              <motion.h2
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.7, delay: 0.08, ease }}
                className="mt-3 text-3xl font-black leading-[1.05] tracking-tight text-white md:text-5xl"
              >
                Nestavěli jsme software od stolu.
                <br />
                <span className="bg-gradient-ember bg-clip-text text-transparent">Stavěli jsme ho v tělocvičně.</span>
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.7, delay: 0.16, ease }}
                className="mt-5 max-w-[52ch] text-base font-bold leading-7 text-white/65"
              >
                TeamVYS je parkourový klub, který tuhle platformu vytvořil pro vlastní kroužky, tábory
                a workshopy — a dodnes na ní denně jede. Každá funkce vznikla z reálné potřeby trenérů,
                rodičů a dětí, ne z prezentace.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.6, delay: 0.26, ease }}
                className="mt-7 flex flex-wrap gap-3"
              >
                <Link
                  href="/o-nas"
                  className="group inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-6 text-sm font-black text-white backdrop-blur-md transition-all duration-200 hover:bg-white/[0.12]"
                >
                  Poznat klub TeamVYS
                  <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/krouzky"
                  className="inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-black text-white/65 transition-colors hover:text-white"
                >
                  Kroužky a tábory TeamVYS
                </Link>
              </motion.div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { value: '6', label: 'měst, kde trénujeme' },
                { value: '500+', label: 'dětí v systému' },
                { value: '4 roky', label: 'denního provozu platformy' },
                { value: '1.', label: 'klub byl náš vlastní' },
              ].map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.55, delay: index * 0.09, ease }}
                  className={`rounded-[20px] border border-white/[0.08] bg-white/[0.05] p-6 backdrop-blur-md ${index % 2 === 1 ? 'translate-y-5' : ''}`}
                >
                  <p className="bg-gradient-ember bg-clip-text text-4xl font-black text-transparent">{stat.value}</p>
                  <p className="mt-1.5 text-xs font-bold leading-5 text-white/55">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
