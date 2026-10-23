'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

/** Přímý odkaz na napsání recenze na firemní profil Team VYS. */
export const GOOGLE_REVIEW_URL =
  'https://search.google.com/local/writereview?placeid=ChIJlcyeibOHf6MRopMA53eBDtY';

/** Odkaz na profil s již napsanými recenzemi. */
export const GOOGLE_PROFILE_URL =
  'https://www.google.com/maps/place/?q=place_id:ChIJlcyeibOHf6MRopMA53eBDtY';

const ease = [0.22, 1, 0.36, 1] as const;

function Stars({ size = 18 }: { size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} size={size} className="fill-[#FFC53D] text-[#FFC53D]" />
      ))}
    </span>
  );
}

/**
 * Výzva k hodnocení na Googlu. Recenze jsou pro místní vyhledávání to
 * nejsilnější, co klub má — proto je blok vidět na každé lokální stránce.
 */
export function GoogleReviewCta({ city }: { city?: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, ease }}
      className="section-shell pb-16 md:pb-24"
    >
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-8 md:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-[52ch]">
            <div className="flex items-center gap-3">
              <Stars />
              <span className="text-sm font-semibold uppercase tracking-wide text-white/50">
                Hodnocení na Googlu
              </span>
            </div>
            <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight md:text-4xl">
              Chodí k nám vaše dítě?
            </h2>
            <p className="mt-3 leading-relaxed text-white/70">
              Většina rodičů nás najde přes Google. Když nám napíšete pár vět o tom, jak se
              {city ? ` ${city} ` : ' '}
              dětem na parkouru líbí, pomůže to dalším rodičům z okolí se rozhodnout. Zabere to
              minutu.
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-3">
            <a
              href={GOOGLE_REVIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 font-bold text-[#0B0B10] transition hover:scale-[1.02] hover:bg-white/90 active:scale-[0.99]"
            >
              <Star size={18} className="fill-[#0B0B10]" />
              Napsat hodnocení
            </a>
            <a
              href={GOOGLE_PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-center text-sm font-semibold text-white/60 underline-offset-4 transition hover:text-white hover:underline"
            >
              Přečíst, co píšou ostatní
            </a>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/** Drobný odkaz do patičky — ať je hodnocení po ruce na každé stránce. */
export function GoogleReviewFooterLink() {
  return (
    <a
      href={GOOGLE_REVIEW_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 transition hover:text-white"
    >
      <Stars size={13} />
      Ohodnotit nás na Googlu
    </a>
  );
}
