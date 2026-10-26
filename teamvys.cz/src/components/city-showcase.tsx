'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CalendarDays, ChevronDown, MapPin, Sparkles } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import type { CitySession } from '@/lib/cities';

const ease = [0.22, 1, 0.36, 1] as const;

/** Galerie školy/tělocvičny — hned pod úvodem lokální stránky. */
export function CityGallery({ photos, cityName }: { photos: string[]; cityName: string }) {
  if (!photos.length) return null;
  const [main, ...rest] = photos;

  return (
    <div className="relative">
      <div className="grid gap-4 md:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-70px' }}
          transition={{ duration: 0.6, ease }}
          className="group relative aspect-[16/10] overflow-hidden rounded-[22px] border border-white/10 md:col-span-2 md:row-span-2 md:aspect-auto"
        >
          <Image
            src={main}
            alt={`Tělocvična — parkour kroužek ${cityName}`}
            fill
            sizes="(max-width: 768px) 100vw, 66vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B0B10]/70 via-transparent to-transparent" />
          <p className="absolute bottom-4 left-5 text-sm font-bold uppercase tracking-wide text-white/80">
            Tady trénujeme
          </p>
        </motion.div>

        {rest.slice(0, 2).map((src, i) => (
          <motion.div
            key={src}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-70px' }}
            transition={{ duration: 0.55, delay: 0.1 + i * 0.08, ease }}
            className="group relative aspect-[16/10] overflow-hidden rounded-[22px] border border-white/10"
          >
            <Image
              src={src}
              alt={`Zázemí kroužku ${cityName}`}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function czechChildren(n: number) {
  return n === 1 ? 'dítě' : n < 5 ? 'děti' : 'dětí';
}

/** Karta termínu s animovaným ukazatelem obsazenosti a prolinkem na detail kroužku. */
export function CitySessionCard({
  session,
  street,
  index = 0,
}: {
  session: CitySession;
  street?: string;
  index?: number;
}) {
  const capacity = Math.max(0, session.capacity);
  const taken = Math.min(capacity, Math.max(0, session.taken));
  const volno = capacity - taken;
  const ratio = capacity > 0 ? taken / capacity : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-70px' }}
      transition={{ duration: 0.55, delay: index * 0.08, ease }}
      className="group flex h-full flex-col rounded-[22px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur transition-colors duration-300 hover:border-brand-purple/50"
    >
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/50">
        <MapPin size={16} /> {session.venue}
      </div>
      <div className="mt-3 flex items-center gap-2 text-2xl font-black tracking-tight">
        <CalendarDays size={22} className="text-white/60" /> {session.when}
      </div>
      {street ? <p className="mt-2 text-sm text-white/50">{street}</p> : null}
      {session.startsOn ? (
        <p className="mt-3 inline-flex items-center gap-2 self-start rounded-full bg-brand-purple/20 px-3 py-1 text-sm font-semibold text-white">
          <Sparkles size={14} /> První lekce {session.startsOn}
        </p>
      ) : null}

      {capacity > 0 ? (
        <div className="mt-5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold text-white/70">
              {taken}/{capacity} {czechChildren(capacity)}
            </span>
            <span className={`font-bold ${volno > 0 ? 'text-brand-purple-light' : 'text-white/50'}`}>
              {volno > 0 ? `${volno} volných míst` : 'naplněno — vedeme pořadník'}
            </span>
          </div>
          {/* Pozorování viditelnosti musí být na track divu — výplň začíná s nulovou šířkou a observer by ji nikdy nespustil. */}
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"
          >
            <motion.div
              variants={{ hidden: { width: '0%' }, show: { width: `${Math.max(4, ratio * 100)}%` } }}
              transition={{ duration: 0.9, delay: 0.2 + index * 0.08, ease }}
              className="h-full rounded-full bg-gradient-to-r from-brand-purple to-fuchsia-500"
            />
          </motion.div>
        </div>
      ) : null}

      <div className="mt-auto pt-6">
        <Link
          href={`/krouzky/${session.productId}`}
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#0B0B10] transition-transform duration-200 group-hover:scale-[1.03]"
        >
          Detail kroužku a přihláška
          <ArrowRight size={16} />
        </Link>
      </div>
    </motion.div>
  );
}

/** Animovaný akordeon častých dotazů. */
export function CityFaq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="relative mt-8">
      <div className="divide-y divide-white/10 overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04]">
        {items.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 p-6 text-left text-lg font-semibold transition-colors hover:bg-white/[0.03]"
              >
                {f.q}
                <motion.span
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.25, ease }}
                  className="shrink-0 text-white/50"
                >
                  <ChevronDown size={20} />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease }}
                    className="overflow-hidden"
                  >
                    <p className="max-w-[70ch] px-6 pb-6 leading-relaxed text-white/70">{f.a}</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
