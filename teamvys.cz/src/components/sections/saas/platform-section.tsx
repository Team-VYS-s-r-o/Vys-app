'use client';

import { motion } from 'framer-motion';
import { CalendarCheck, CreditCard, LayoutDashboard, Nfc, UsersRound, Wallet } from 'lucide-react';

const ease = [0.22, 1, 0.36, 1] as const;

const features = [
  {
    icon: CalendarCheck,
    title: 'Docházka bez papírů',
    body: 'Trenér odbaví celou skupinu za pár vteřin — NFC čipem nebo jedním klepnutím. Rodič hned vidí, že dítě dorazilo.',
    size: 'lg' as const,
  },
  {
    icon: Nfc,
    title: 'NFC čipy dodáme my',
    body: 'Náramky s čipy posíláme přímo od Team VYS. Spárování s dítětem zabere minutu.',
    size: 'sm' as const,
  },
  {
    icon: UsersRound,
    title: 'Skupiny, trenéři, rodiče',
    body: 'Kroužky, tréninkové skupiny, role trenérů a rodičovské účty propojené do jednoho systému.',
    size: 'sm' as const,
  },
  {
    icon: CreditCard,
    title: 'Platby přes Stripe',
    body: 'Kroužkovné, tábory a workshopy zaplatí rodič kartou online. Vy vidíte přehled v reálném čase — bez honění převodů.',
    size: 'lg' as const,
  },
  {
    icon: LayoutDashboard,
    title: 'Webový portál',
    body: 'Admin spravuje klub, rodiče sledují děti, dokumenty a platby — vše v prohlížeči.',
    size: 'sm' as const,
  },
  {
    icon: Wallet,
    title: 'Výplaty trenérů',
    body: 'Odtrénované hodiny, bonusy a podklady pro DPP na jednom místě.',
    size: 'sm' as const,
  },
] as const;

export function PlatformSection() {
  return (
    <section id="platforma" className="relative overflow-hidden bg-brand-night py-20 md:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute right-[-15%] top-[-20%] h-[60vh] w-[60vh] rounded-full bg-[radial-gradient(circle,rgba(139,29,255,0.18)_0%,transparent_70%)]" />
        <div className="absolute bottom-[-25%] left-[-10%] h-[50vh] w-[50vh] rounded-full bg-[radial-gradient(circle,rgba(241,43,179,0.10)_0%,transparent_70%)]" />
      </div>

      <div className="section-shell relative">
        <div className="max-w-[640px]">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease }}
            className="text-xs font-black uppercase tracking-[0.2em] text-brand-ember"
          >
            Kompletní správa klubu
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, delay: 0.08, ease }}
            className="mt-3 text-3xl font-black leading-[1.05] tracking-tight text-white md:text-5xl"
          >
            Všechno, co klub denně řeší.
            <br />
            <span className="bg-gradient-ember bg-clip-text text-transparent">V jednom systému.</span>
          </motion.h2>
        </div>

        {/* Bento grid — mixed card sizes, not uniform blocks */}
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.article
              key={feature.title}
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.6, delay: (index % 3) * 0.1, ease }}
              className={`group rounded-[24px] border border-white/[0.08] bg-white/[0.05] p-7 backdrop-blur-md transition-colors duration-300 hover:border-brand-ember/40 hover:bg-white/[0.08] ${feature.size === 'lg' ? 'lg:col-span-2' : ''}`}
            >
              <span className="grid h-12 w-12 place-items-center rounded-[16px] bg-gradient-ember text-white shadow-[0_10px_26px_rgba(139,29,255,0.35)] transition-transform duration-300 group-hover:scale-110">
                <feature.icon size={22} />
              </span>
              <h3 className="mt-5 text-xl font-black text-white">{feature.title}</h3>
              <p className={`mt-2 text-sm font-bold leading-6 text-white/55 ${feature.size === 'lg' ? 'max-w-[52ch]' : ''}`}>{feature.body}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
