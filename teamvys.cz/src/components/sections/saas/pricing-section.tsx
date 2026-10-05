'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';

const ease = [0.22, 1, 0.36, 1] as const;

const included = [
  'Neomezený počet trenérů, skupin a dětí',
  'Mobilní aplikace pro trenéry a účastníky',
  'Webový portál pro rodiče a administraci',
  'Online platby kroužků, táborů a workshopů',
  'NFC docházkové čipy — dodáme my',
  'Gamifikace: XP, maskoti, bedny, arény, questová mapa',
] as const;

export function PricingSection() {
  return (
    <section className="relative overflow-hidden bg-white py-20 md:py-28">
      <div className="section-shell">
        {/* Asymmetric split: massive price left, card right, overlapping the divide */}
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, ease }}
              className="text-xs font-black uppercase tracking-[0.2em] text-brand-ember"
            >
              Jedna cena, všechno v ní
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7, delay: 0.08, ease }}
              className="mt-4"
            >
              <p className="text-[clamp(4rem,9vw,7.5rem)] font-black leading-none tracking-tight text-brand-night">
                790<span className="bg-gradient-ember bg-clip-text text-transparent"> Kč</span>
              </p>
              <p className="mt-2 text-lg font-black text-brand-night/55">měsíčně za celou organizaci</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7, delay: 0.18, ease }}
              className="mt-6 flex flex-wrap gap-2.5"
            >
              {['Prvních 30 dní zdarma', 'Bez vstupního poplatku', 'Zrušení kdykoliv'].map((perk) => (
                <span key={perk} className="rounded-full border border-brand-ember/20 bg-brand-ember-soft px-4 py-2 text-xs font-black text-brand-ember-deep">
                  {perk}
                </span>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 40, rotate: 1.5 }}
            whileInView={{ opacity: 1, y: 0, rotate: 1.5 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.75, delay: 0.15, ease }}
            className="relative rounded-[28px] bg-brand-night p-8 shadow-[0_40px_90px_rgba(26,26,46,0.35)] md:p-10"
          >
            <div aria-hidden className="absolute -top-px inset-x-8 h-px bg-gradient-ember" />
            <h3 className="text-xl font-black text-white">V ceně je všechno</h3>
            <ul className="mt-6 space-y-3.5">
              {included.map((line, index) => (
                <motion.li
                  key={line}
                  initial={{ opacity: 0, x: 18 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.45, delay: 0.25 + index * 0.07, ease }}
                  className="flex items-start gap-3"
                >
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-ember text-white">
                    <Check size={12} strokeWidth={3.5} />
                  </span>
                  <span className="text-sm font-bold leading-6 text-white/75">{line}</span>
                </motion.li>
              ))}
            </ul>
            <Link
              href="/kontakty"
              className="group mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-ember text-sm font-black text-white shadow-[0_14px_34px_rgba(139,29,255,0.4)] transition-all duration-200 hover:-translate-y-0.5"
            >
              Kontaktovat Team VYS
              <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
