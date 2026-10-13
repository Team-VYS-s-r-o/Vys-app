'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';

import { Reveal } from '@/components/animated/reveal';

const faq = [
  {
    q: 'Od jaké výkonnosti můžu na trénink?',
    a: 'Od úplného začátku. Děláme základy pádů, koordinace a postupně přidáváme vault, dive roll, salto. Žádné předchozí zkušenosti nepotřebuješ.',
  },
  {
    q: 'Co když dítě nepřijde?',
    a: 'Permanentka má 10 nebo 15 vstupů a platí celý semestr — pokud neumožní účast nemoc, dítě prostě využije vstup jindy.',
  },
  {
    q: 'Jaký je věkový strop?',
    a: 'Tréninky jsou pro 6–16 let. Pro starší máme open jamy a workshopy s youtuberem.',
  },
  {
    q: 'Jak je to s rodičovskou částí v aplikaci?',
    a: 'Rodič vidí všechny děti, jejich docházku, zaplacené permanentky a může objednávat tábory či workshopy s youtuberem. Vše v jednom místě.',
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="section-shell py-16">
      <Reveal>
        <div className="max-w-[780px]">
          <p className="text-xs font-black uppercase text-brand-cyan">Časté otázky</p>
          <h2 className="mt-3 text-3xl font-black leading-tight text-brand-ink md:text-5xl">
            Co rodiče řeší před prvním tréninkem
          </h2>
        </div>
      </Reveal>

      <div className="mt-8 grid gap-3">
        {faq.map((item, idx) => {
          const isOpen = open === idx;
          return (
            <Reveal key={item.q} delay={idx * 60}>
              <button
                onClick={() => setOpen(isOpen ? null : idx)}
                className="w-full rounded-brand border border-brand-purple/12 bg-white p-5 text-left shadow-brand-soft transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex-1 text-base font-black text-brand-ink md:text-[17px]">{item.q}</span>
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-brand bg-gradient-brand text-white transition-colors"
                  >
                    {isOpen ? <Minus size={18} /> : <Plus size={18} />}
                  </span>
                </div>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className="mt-3 overflow-hidden text-[15px] leading-6 text-brand-ink-soft"
                    >
                      {item.a}
                    </motion.p>
                  ) : null}
                </AnimatePresence>
              </button>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
