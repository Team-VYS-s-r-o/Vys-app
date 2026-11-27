'use client';

import { animate, motion, useInView, useReducedMotion } from 'framer-motion';
import { ArrowRight, CreditCard, Instagram, MapPin, PlayCircle, Ticket, UserPlus, Users, Youtube } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { AppGuide, PASS_GUIDE_STEPS, type GuideStep } from '@/components/app-guide';
import { PageHero } from '@/components/page-hero';
import { PhaseDial, type DialPhase } from '@/components/training-timeline';
import { useAdminCreatedProducts } from '@/lib/admin-created-products';

/**
 * Vypsaný workshop s hostem: úvod stránky Workshopy, karta s fotkou a fakty,
 * program na ciferníku, praktické věci a video návod, jak koupit vstupenku.
 * Cena a volná místa se berou živě z databáze (produkt `FEATURED.id`), ostatní
 * je tady. Po termínu se všechno samo schová a stránka ukáže „připravujeme".
 *
 * Časy v programu jsou orientační — pořadí částí zadal David, minuty jsou návrh.
 */

const EASE = [0.22, 1, 0.36, 1] as const;
const WEB_APP_URL = 'https://app.aplikacevys.cz/sign-in?source=pwa';

export const FEATURED = {
  id: 'workshop-praha-vova-2026-12-12',
  /** Poslední den, kdy se workshop ještě nabízí (ISO). */
  date: '2026-12-12',
  dateLabel: '12. 12.',
  dayLabel: 'Sobota · 14:00–18:00',
  guest: 'Vova',
  photo: '/workshopy/vova.webp',
  venue: 'Sokol Vršovice',
  address: 'Vršovické náměstí 111/2, Praha 10',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Sokol+Praha+Vr%C5%A1ovice%2C+Vr%C5%A1ovick%C3%A9+n%C3%A1m%C4%9Bst%C3%AD+111%2F2',
  price: 790,
  capacity: 40,
  instagram: { handle: 'vovacoldy', url: 'https://www.instagram.com/vovacoldy/' },
  youtube: { handle: 'sonicvova', url: 'https://www.youtube.com/@sonicvova' },
  stornoUntil: '5. 12.',
};

/** Je vypsaný workshop ještě před námi? Na serveru vždy ano, prohlížeč si to po načtení ověří. */
export function useFeaturedUpcoming() {
  const [upcoming, setUpcoming] = useState(true);
  useEffect(() => {
    setUpcoming(new Date().toISOString().slice(0, 10) <= FEATURED.date);
  }, []);
  return upcoming;
}

/* ---------- úvod stránky ---------- */

export function WorkshopsHero() {
  const upcoming = useFeaturedUpcoming();
  return upcoming ? (
    <PageHero key="featured" title="Parkour workshop s Vovou" accent="s Vovou" />
  ) : (
    <PageHero key="generic" title="Jednorázové akce pro rychlý progres" accent="rychlý progres" />
  );
}

/* ---------- fotka + fakta ---------- */

function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!inView || reduced) {
      el.textContent = String(value);
      return;
    }
    const controls = animate(0, value, { duration: 1.1, ease: EASE, onUpdate: (v) => { el.textContent = String(Math.round(v)); } });
    return () => controls.stop();
  }, [inView, reduced, value]);
  return <span ref={ref} style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>;
}

function SocialPill({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-2 text-sm font-black text-white backdrop-blur-md transition-colors hover:bg-white hover:text-[#0B0B10]"
    >
      {icon}
      {label}
    </a>
  );
}

export function WorkshopSpotlight() {
  const reduced = useReducedMotion();
  const { products } = useAdminCreatedProducts();
  const product = products.find((item) => item.id === FEATURED.id);
  const price = product?.price ?? FEATURED.price;
  const capacity = product?.capacityTotal || FEATURED.capacity;
  const taken = Math.min(capacity, Math.max(0, product?.capacityCurrent ?? 0));
  const left = capacity - taken;
  const soldOut = left <= 0;

  return (
    <section className="section-shell pb-20 md:pb-32">
      <div className="grid items-center gap-14 lg:grid-cols-[0.82fr_1.18fr] lg:gap-20">
        {/* fotka hosta */}
        <motion.div
          initial={{ opacity: 0, y: 44, rotate: -5, scale: 0.94 }}
          whileInView={{ opacity: 1, y: 0, rotate: -2, scale: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.95, ease: EASE }}
          className="relative mx-auto w-[88%] max-w-[430px] lg:w-full"
        >
          <span aria-hidden className="pointer-events-none absolute -inset-8 rounded-[3rem] bg-[radial-gradient(circle_at_30%_20%,rgba(241,43,179,0.5),rgba(139,29,255,0.35)_45%,transparent_72%)] blur-3xl" />
          <div className="relative aspect-[3/4] overflow-hidden rounded-[2.2rem] shadow-[0_40px_90px_-30px_rgba(139,29,255,0.75)]">
            <motion.img
              src={FEATURED.photo}
              alt={`${FEATURED.guest}, host workshopu`}
              className="h-full w-full object-cover object-[50%_18%]"
              initial={reduced ? false : { scale: 1.14 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 1.6, ease: EASE }}
            />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#0B0B10] via-[#0B0B10]/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 md:p-7">
              <p className="text-6xl font-black leading-none tracking-tight text-white md:text-7xl">{FEATURED.guest}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <SocialPill href={FEATURED.youtube.url} icon={<Youtube size={16} />} label={FEATURED.youtube.handle} />
                <SocialPill href={FEATURED.instagram.url} icon={<Instagram size={16} />} label={FEATURED.instagram.handle} />
              </div>
            </div>
          </div>

          {/* cenovka jako útržek vstupenky */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5, rotate: 24 }}
            whileInView={{ opacity: 1, scale: 1, rotate: 8 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.45 }}
            className="absolute -right-4 -top-5 md:-right-8"
          >
            <motion.div
              animate={reduced ? undefined : { y: [0, -7, 0], rotate: [0, -2.5, 0] }}
              transition={{ duration: 4.6, repeat: Infinity, ease: 'easeInOut' }}
              className="rounded-[1.4rem] bg-white px-5 py-3.5 text-[#0B0B10] shadow-[0_22px_44px_-14px_rgba(0,0,0,0.7)]"
            >
              <span className="block text-3xl font-black leading-none tracking-tight md:text-4xl">{price.toLocaleString('cs-CZ')} Kč</span>
              <span className="mt-1 block text-sm font-bold text-[#0B0B10]/60">za dítě</span>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* kdy, kde, kolik míst */}
        <motion.div
          initial={{ opacity: 0, x: 44 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.85, delay: 0.1, ease: EASE }}
        >
          <p className="hero-accent text-[clamp(4.6rem,21vw,10rem)] font-black leading-[0.86] tracking-[-0.05em]" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {FEATURED.dateLabel}
          </p>
          <p className="mt-4 text-2xl font-black tracking-tight text-white md:text-4xl">{FEATURED.dayLabel}</p>
          <p className="mt-5 max-w-xl text-lg font-medium leading-relaxed text-white/70 md:text-xl">
            Čtyři hodiny parkouru s Vovou, kterého znáš z YouTube a Instagramu. Tentokrát naživo v tělocvičně.
          </p>

          <a
            href={FEATURED.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-9 flex items-start gap-4 border-t border-white/12 pt-6"
          >
            <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors group-hover:bg-white group-hover:text-[#0B0B10]">
              <MapPin size={20} />
            </span>
            <span>
              <span className="block text-2xl font-black leading-tight tracking-tight text-white md:text-3xl">{FEATURED.venue}</span>
              <span className="mt-1 block text-base font-medium text-white/60 underline-offset-4 group-hover:underline md:text-lg">{FEATURED.address}</span>
            </span>
          </a>

          <div className="mt-6 border-t border-white/12 pt-6">
            <div className="flex items-end justify-between gap-4">
              <p className="text-2xl font-black leading-tight tracking-tight text-white md:text-3xl">
                {soldOut ? 'Vyprodáno' : (
                  <>
                    Zbývá <CountUp value={left} /> {left === 1 ? 'místo' : left >= 2 && left <= 4 ? 'místa' : 'míst'}
                  </>
                )}
              </p>
              <p className="pb-1 text-base font-bold text-white/55">z {capacity}</p>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full origin-left rounded-full bg-gradient-to-r from-brand-purple via-[#F12BB3] to-[#FFB21A]"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: Math.max(0.02, left / capacity) }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 1.2, delay: 0.2, ease: EASE }}
              />
            </div>
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            {soldOut ? null : (
              <a
                href={WEB_APP_URL}
                className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-base font-black text-[#0B0B10] transition-transform hover:-translate-y-0.5"
              >
                <Ticket size={19} />
                Koupit vstupenku
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </a>
            )}
            <a
              href="#navod-workshop"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-4 text-base font-black text-white transition-colors hover:border-white/50 hover:bg-white/[0.06]"
            >
              <PlayCircle size={19} />
              Video návod
            </a>
          </div>
          <p className="mt-4 text-sm font-medium text-white/50">Vstupenky se kupují v aplikaci Team VYS, v telefonu i v prohlížeči.</p>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- program na ciferníku ---------- */

const WORKSHOP_PHASES: DialPhase[] = [
  { from: 0, to: 20, title: 'Seznámení a pokec', text: 'Poznáš Vovu i trenéry a zeptáš se, na co chceš.', color: '#FFB21A' },
  { from: 20, to: 45, title: 'Rozcvička', text: 'Společně se zahřejeme, ať se nikdo nezraní.', color: '#22D3EE' },
  { from: 45, to: 65, title: 'Naše vystoupení', text: 'Vova a trenéři ukážou, co umí.', color: '#F12BB3' },
  { from: 65, to: 155, title: 'Workshop', text: 'Triky krok za krokem, s dopomocí trenérů.', color: '#8B1DFF' },
  { from: 155, to: 195, title: 'Challenge', text: 'Výzvy od Vovy. Kdo je dá?', color: '#FF6B3D' },
  { from: 195, to: 210, title: 'Protahování', text: 'Zklidnění a protažení po čtyřech hodinách pohybu.', color: '#34D399' },
  { from: 210, to: 240, title: 'Merch', text: 'Na závěr stánek s merchem.', color: '#B23BFF' },
];

export function WorkshopSchedule() {
  return (
    <section className="section-shell pb-20 md:pb-32">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-balance text-3xl font-black leading-[1.02] tracking-tight text-white md:text-6xl">Čtyři hodiny, sedm částí</h2>
        <p className="mx-auto mt-4 max-w-xl text-base font-medium leading-7 text-white/65 md:text-lg">Od 14:00 do 18:00. Časy jsou orientační.</p>
      </div>
      <div className="mt-12 md:mt-16">
        <PhaseDial phases={WORKSHOP_PHASES} total={240} clockStart={14 * 60} />
      </div>
    </section>
  );
}

/* ---------- praktické věci ---------- */

const NOTES: { label: string; text: string }[] = [
  { label: 'S sebou', text: 'Sálové boty, pohodlné oblečení, pití a svačinu.' },
  { label: 'Vstupenka', text: 'QR kód v aplikaci i v e-mailu. U vstupu ho jen ukážeš.' },
  { label: 'Dokumenty', text: 'Přihlášku a souhlasy podepíšeš v aplikaci před platbou.' },
  { label: 'Storno', text: `Do ${FEATURED.stornoUntil} vracíme celou částku. Později jde vstupenka převést na jiné dítě.` },
  { label: 'Merch', text: 'Na místě ke koupi. V ceně vstupenky není.' },
];

export function WorkshopNotes() {
  return (
    <section className="section-shell pb-20 md:pb-32">
      <h2 className="max-w-4xl text-balance text-3xl font-black leading-[1.02] tracking-tight text-white md:text-6xl">Dobré vědět předem</h2>
      <dl className="mt-8 md:mt-12">
        {NOTES.map((note, i) => (
          <motion.div
            key={note.label}
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6, delay: i * 0.06, ease: EASE }}
            className="grid gap-1 border-t border-white/12 py-6 md:grid-cols-[220px_1fr] md:items-baseline md:gap-10 md:py-8"
          >
            <dt className="text-lg font-black text-white/45 md:text-2xl">{note.label}</dt>
            <dd className="text-balance text-2xl font-black leading-tight tracking-tight text-white md:text-4xl">{note.text}</dd>
          </motion.div>
        ))}
      </dl>
    </section>
  );
}

/* ---------- video návod: jak koupit vstupenku ---------- */

const WORKSHOP_GUIDE_STEPS: GuideStep[] = [
  {
    ...PASS_GUIDE_STEPS[0],
    icon: <UserPlus size={18} />,
    text: (
      <>
        Otevři aplikaci v prohlížeči, nebo si ji stáhni do telefonu. Klepni na <strong className="text-white">Zaregistrovat</strong> a vyber
        roli <strong className="text-white">Rodič</strong>. Na e-mail ti přijde kód, kterým účet potvrdíš.
      </>
    ),
  },
  { ...PASS_GUIDE_STEPS[1], icon: <Users size={18} /> },
  {
    icon: <CreditCard size={18} />,
    title: 'Vyber workshop a zaplať',
    text: (
      <>
        V záložce <strong className="text-white">Platby</strong> otevři <strong className="text-white">Workshopy</strong> a klepni na{' '}
        <strong className="text-white">Koupit vstupenku</strong>. Přihlášku a souhlasy podepíšeš přímo v aplikaci a zaplatíš kartou.
      </>
    ),
    video: '/navod/workshop-3.mp4',
    poster: '/navod/workshop-3.webp',
    alt: 'Záložka Platby: workshop s Vovou a tlačítko Koupit vstupenku',
    tone: '#f8f7fc',
    seconds: 6.5,
  },
  {
    icon: <Ticket size={18} />,
    title: 'Ukaž vstupenku u vstupu',
    text: (
      <>
        Vstupenku najdeš u dítěte v záložce <strong className="text-white">Děti</strong> a taky v e-mailu. Klepneš na{' '}
        <strong className="text-white">Ukázat QR</strong> a u vstupu ho necháš načíst.
      </>
    ),
    video: '/navod/workshop-4.mp4',
    poster: '/navod/workshop-4.webp',
    alt: 'Vstupenka na workshop s QR kódem',
    tone: '#f8f7fc',
    seconds: 5.5,
  },
];

export function WorkshopGuide() {
  return <AppGuide id="navod-workshop" steps={WORKSHOP_GUIDE_STEPS} title="Jak koupit vstupenku" subtitle="Čtyři kroky v aplikaci. Zabere to pár minut." />;
}

/** Všechno k vypsanému workshopu pohromadě; po termínu se nevykreslí nic. */
export function FeaturedWorkshop() {
  const upcoming = useFeaturedUpcoming();
  if (!upcoming) return null;
  return (
    <>
      <WorkshopSpotlight />
      <WorkshopSchedule />
      <WorkshopNotes />
      <WorkshopGuide />
    </>
  );
}
