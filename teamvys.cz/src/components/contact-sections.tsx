'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Sekce stránky Kontakty: tři velká čísla podle regionu (svítí to, u kterého
 * člověk zrovna je), e-mail přes celou šířku s kopírováním a tiché firemní údaje.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

/* ---------- telefony podle regionu ---------- */

export function ContactLines({ lines }: { lines: { number: string; label: string }[] }) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const rows = useRef<(HTMLLIElement | null)[]>([]);

  // Na telefonu (bez myši) svítí řádek nejblíž středu obrazovky.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const middle = window.innerHeight * 0.5;
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
    <section className="section-shell py-14 md:py-24">
      <motion.h2
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, ease: EASE }}
        className="max-w-3xl text-balance text-3xl font-black leading-[1.02] tracking-tight text-white md:text-6xl"
      >
        Zavolej tam, kde trénuješ
      </motion.h2>

      <ol className="mt-8 md:mt-14">
        {lines.map((line, i) => {
          const lit = i === active;
          const digits = line.number.split('');
          return (
            <motion.li
              key={line.number}
              ref={(el) => {
                rows.current[i] = el;
              }}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: i * 0.07, ease: EASE }}
              onMouseEnter={() => setActive(i)}
              className="relative"
            >
              <a
                href={`tel:+420${line.number.replaceAll(' ', '')}`}
                aria-label={`Zavolat ${line.number} — ${line.label}`}
                className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 py-6 outline-none md:py-9"
              >
                <motion.span
                  animate={{ x: lit && !reduced ? 14 : 0, opacity: lit ? 1 : 0.32 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                  className="block min-w-0"
                >
                  <span className="block text-base font-bold text-white/70 md:text-xl">{line.label}</span>
                  <span
                    className="mt-1 flex text-[2.6rem] font-black leading-none tracking-tight text-white md:text-8xl"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {digits.map((char, index) => (
                      <motion.span
                        key={`${char}-${index}`}
                        className={char === ' ' ? 'w-[0.28em]' : 'inline-block'}
                        animate={lit && !reduced ? { y: [0, -10, 0] } : { y: 0 }}
                        transition={{ duration: 0.45, delay: index * 0.028, ease: 'easeOut' }}
                      >
                        {char === ' ' ? '' : char}
                      </motion.span>
                    ))}
                  </span>
                </motion.span>

                {/* „Zavolat" se zvonícími kruhy — jen u svítícího řádku */}
                <motion.span
                  animate={{ opacity: lit ? 1 : 0, scale: lit ? 1 : 0.9 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="relative mb-1 ml-3.5 inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-base font-black text-[#0B0B10] md:mb-4 md:ml-0 md:h-14 md:px-7 md:text-lg"
                >
                  {lit && !reduced ? (
                    <>
                      <motion.span aria-hidden className="absolute inset-0 rounded-full border-2 border-white" animate={{ scale: [1, 1.5], opacity: [0.6, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }} />
                      <motion.span aria-hidden className="absolute inset-0 rounded-full border-2 border-white" animate={{ scale: [1, 1.5], opacity: [0.6, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.5 }} />
                    </>
                  ) : null}
                  <span className="relative">Zavolat</span>
                  <ArrowUpRight size={18} className="relative" />
                </motion.span>
              </a>
              <span className="absolute bottom-0 left-0 h-px w-full bg-white/10" />
              <motion.span
                className="absolute bottom-0 left-0 h-px bg-gradient-to-r from-brand-purple via-[#F12BB3] to-transparent"
                animate={{ width: lit ? '100%' : '0%', opacity: lit ? 1 : 0 }}
                transition={{ duration: 0.6, ease: EASE }}
              />
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}

/* ---------- e-mail ---------- */

export function ContactMail({ email }: { email: string }) {
  const reduced = useReducedMotion();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
    } catch {
      // Schránka není dostupná (staré prohlížeče) — necháme jen odkaz na e-mail.
    }
  };

  return (
    <section className="section-shell pb-14 md:pb-24">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.8, ease: EASE }}
        className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-brand-purple/[0.3] via-[#1a1030] to-[#0B0B10] p-7 md:rounded-[2.5rem] md:p-14"
      >
        {reduced ? null : (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[radial-gradient(circle,#F12BB3_0%,rgba(241,43,179,0.3)_45%,transparent_70%)] md:h-[28rem] md:w-[28rem]"
            animate={{ x: [0, -30, 0], y: [0, 24, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <div className="relative">
          <h2 className="text-2xl font-black tracking-tight text-white/80 md:text-4xl">Radši napíšeš?</h2>
          <a
            href={`mailto:${email}`}
            className="mt-3 block text-[2rem] font-black leading-[1.05] tracking-tight text-white underline decoration-white/0 decoration-4 underline-offset-8 transition-[text-decoration-color] duration-300 [overflow-wrap:anywhere] hover:decoration-[#F12BB3] md:text-7xl"
          >
            {email}
          </a>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={`mailto:${email}`} className="group inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-base font-black text-[#0B0B10] transition-transform hover:-translate-y-0.5 md:h-14 md:px-7">
              Napsat e-mail
              <ArrowUpRight size={18} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
            <button
              type="button"
              onClick={copy}
              className="relative inline-flex h-12 min-w-[11.5rem] items-center justify-center overflow-hidden rounded-full border border-white/25 px-6 text-base font-black text-white transition-colors hover:border-white/60 md:h-14 md:px-7"
            >
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={copied ? 'done' : 'copy'}
                  initial={{ y: 18, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -18, opacity: 0 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="inline-flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check size={18} strokeWidth={3.5} className="text-emerald-400" />
                      Zkopírováno
                    </>
                  ) : (
                    'Zkopírovat adresu'
                  )}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

/* ---------- firemní údaje ---------- */

export function ContactCompany({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <section className="section-shell pb-16 md:pb-28">
      <h2 className="text-2xl font-black tracking-tight text-white md:text-4xl">Fakturační údaje</h2>
      <dl className="mt-6 grid gap-x-10 border-t border-white/10 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row, i) => (
          <motion.div
            key={row.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, delay: i * 0.05, ease: EASE }}
            className="border-b border-white/10 py-5"
          >
            <dt className="text-sm font-bold text-white/55">{row.label}</dt>
            <dd className="mt-1 text-xl font-black text-white [overflow-wrap:anywhere] md:text-2xl" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {row.value}
            </dd>
          </motion.div>
        ))}
      </dl>
    </section>
  );
}
