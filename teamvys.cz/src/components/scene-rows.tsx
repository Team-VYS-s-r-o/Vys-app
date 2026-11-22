'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

const EASE = [0.22, 1, 0.36, 1] as const;

export type SceneRow = { title: string; text: string; scene: ReactNode };

/**
 * Řádky „číslo + nadpis + věta" s animovanou scénou vedle — bez rámečků a bez
 * šedých bloků. Řádky odděluje jen vzduch; text přijede z jedné strany, scéna
 * z druhé a strany se střídají. Používá to O nás i Workshopy.
 */
export function SceneRows({ items }: { items: SceneRow[] }) {
  return (
    <div className="mt-4 overflow-x-clip md:mt-8">
      {items.map((item, i) => {
        const flip = i % 2 === 1;
        return (
          <div key={item.title} className="grid items-center gap-10 py-12 md:grid-cols-2 md:gap-20 md:py-24">
            <motion.div
              initial={{ opacity: 0, x: flip ? 44 : -44 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-90px' }}
              transition={{ duration: 0.8, ease: EASE }}
              className={flip ? 'md:order-2' : ''}
            >
              <p className="text-6xl font-black leading-none text-white/15 md:text-8xl" style={{ fontVariantNumeric: 'tabular-nums' }}>
                0{i + 1}
              </p>
              <h3 className="mt-4 text-balance text-[2rem] font-black leading-[1.02] tracking-tight text-white md:text-6xl">{item.title}</h3>
              <p className="mt-4 max-w-md text-lg font-medium leading-relaxed text-white/70 md:text-xl">{item.text}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 36, scale: 0.92 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: '-90px' }}
              transition={{ duration: 0.9, delay: 0.08, ease: EASE }}
              className="relative flex justify-center"
            >
              {/* jen měkké světlo za scénou, žádný rámeček */}
              <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(139,29,255,0.26),transparent_65%)] blur-2xl" />
              <div className="relative flex w-full justify-center">{item.scene}</div>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
