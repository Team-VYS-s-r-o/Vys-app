'use client';

import { animate, motion, useInView, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { ArrowLeft, ArrowRight, CreditCard, Instagram, MapPin, PlayCircle, Ticket, UserPlus, Users, Youtube } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AppGuide, PASS_GUIDE_STEPS, type GuideStep } from '@/components/app-guide';
import { PhaseDial, type DialPhase } from '@/components/training-timeline';
import { useAdminCreatedProducts } from '@/lib/admin-created-products';
import type { ParentProduct } from '@/lib/portal-content';

/**
 * Šablona stránky Workshopy s youtuberem. Všechno se kreslí z produktu typu
 * Workshop tak, jak ho admin vyplnil: první fotka = host, jméno hosta a jeho
 * sociální sítě, termín, místo, cena, volná místa a program po částech
 * (`products.workshop_details`). Když je vypsaných víc termínů, karty se dají
 * přetahovat do stran a program s poznámkami pod nimi patří k vybrané kartě.
 * Proběhlé workshopy se neukazují; bez termínu stránka říká „připravujeme".
 */

const EASE = [0.22, 1, 0.36, 1] as const;
const WEB_APP_URL = 'https://app.aplikacevys.cz/sign-in?source=pwa';
const PHASE_COLORS = ['#FFB21A', '#22D3EE', '#F12BB3', '#8B1DFF', '#FF6B3D', '#34D399', '#B23BFF', '#60A5FA'];
const DEFAULT_BRING = ['Sálové boty', 'pohodlné oblečení', 'pití a svačinu'];

type WorkshopView = {
  id: string;
  title: string;
  guest: string;
  photo: string;
  instagram: { handle: string; url: string } | null;
  youtube: { handle: string; url: string } | null;
  dateIso: string | null;
  dateLabel: string;
  dayLabel: string;
  startMinutes: number | null;
  endMinutes: number | null;
  venue: string;
  address: string;
  mapsUrl: string;
  price: number;
  capacity: number;
  left: number;
  intro: string;
  phases: DialPhase[];
  totalMinutes: number;
  notes: { label: string; text: string }[];
};

/** „vovacoldy", „@vovacoldy" i celá adresa → jméno účtu a odkaz. */
function socialLink(value: string | undefined, base: string) {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  const handle = raw.replace(/^https?:\/\/[^/]+\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
  if (!handle) return null;
  return { handle, url: /^https?:\/\//i.test(raw) ? raw : `${base}${handle}` };
}

function clock(minutes: number) {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toWorkshopView(product: ParentProduct): WorkshopView {
  const details = product.workshopDetails ?? {};
  const meta = product.primaryMeta ?? '';

  const dateMatch = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(meta);
  const day = dateMatch ? Number(dateMatch[1]) : null;
  const month = dateMatch ? Number(dateMatch[2]) : null;
  const year = dateMatch ? Number(dateMatch[3]) : null;
  const dateIso = dateMatch ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
  const date = dateMatch ? new Date(year as number, (month as number) - 1, day as number) : null;

  const timeMatch = /(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/.exec(meta);
  const startMinutes = timeMatch ? Number(timeMatch[1]) * 60 + Number(timeMatch[2]) : null;
  const endMinutes = timeMatch ? Number(timeMatch[3]) * 60 + Number(timeMatch[4]) : null;

  const weekday = date ? capitalize(date.toLocaleDateString('cs-CZ', { weekday: 'long' })) : '';
  const timeLabel = startMinutes !== null && endMinutes !== null ? `${clock(startMinutes)}–${clock(endMinutes)}` : '';

  const guest = (details.guestName ?? product.importantInfo.find((item) => item.label === 'Hlavní host')?.value ?? '').trim();

  // Program: minuty jednotlivých částí na sebe navazují.
  let cursor = 0;
  const phases: DialPhase[] = (details.program ?? [])
    .filter((part) => part && part.title && Number(part.minutes) > 0)
    .map((part, i) => {
      const from = cursor;
      cursor += Math.round(Number(part.minutes));
      return { from, to: cursor, title: part.title, text: part.text ?? '', color: PHASE_COLORS[i % PHASE_COLORS.length] };
    });

  const capacity = product.capacityTotal || 0;
  const left = Math.max(0, capacity - Math.max(0, product.capacityCurrent ?? 0));

  const hasCoords = typeof product.latitude === 'number' && typeof product.longitude === 'number';
  const mapsQuery = hasCoords ? `${product.latitude},${product.longitude}` : [product.venue, product.mapQuery || product.city].filter(Boolean).join(', ');

  const bring = (product.bringItems && product.bringItems.length > 0 ? product.bringItems : DEFAULT_BRING)
    .map((item, i) => (i === 0 ? item : item.charAt(0).toLowerCase() + item.slice(1)))
    .join(', ');
  const stornoUntil = date ? new Date(date.getFullYear(), date.getMonth(), date.getDate() - 7) : null;
  const notes = [
    { label: 'S sebou', text: `${bring}.` },
    { label: 'Vstupenka', text: 'QR kód v aplikaci i v e-mailu. U vstupu ho jen ukážeš.' },
    { label: 'Dokumenty', text: 'Přihlášku a souhlasy podepíšeš v aplikaci před platbou.' },
    {
      label: 'Storno',
      text: stornoUntil
        ? `Do ${stornoUntil.getDate()}. ${stornoUntil.getMonth() + 1}. vracíme celou částku. Později jde vstupenka převést na jiné dítě.`
        : 'Nejpozději týden předem vracíme celou částku. Později jde vstupenka převést na jiné dítě.',
    },
    ...(details.notes ?? []).filter((note) => note && note.label && note.text),
  ];

  return {
    id: product.id,
    title: product.title,
    guest,
    photo: product.heroImage || '',
    instagram: socialLink(details.instagram, 'https://www.instagram.com/'),
    youtube: socialLink(details.youtube, 'https://www.youtube.com/@'),
    dateIso,
    dateLabel: day && month ? `${day}. ${month}.` : product.primaryMeta,
    dayLabel: [weekday, timeLabel].filter(Boolean).join(' · '),
    startMinutes,
    endMinutes,
    venue: product.venue || product.place,
    address: product.mapQuery || product.city,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`,
    price: product.price,
    capacity,
    left,
    intro: (details.intro ?? '').trim() || product.description,
    phases,
    totalMinutes: cursor,
    notes,
  };
}

/** Vypsané workshopy, které teprve budou — nejbližší první. */
export function useUpcomingWorkshops() {
  const { products, loading, error } = useAdminCreatedProducts();
  const workshops = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return products
      .filter((product) => product.type === 'Workshop')
      .map(toWorkshopView)
      .filter((view) => !view.dateIso || view.dateIso >= today) // bez data nejde poznat, že už proběhl
      .sort((a, b) => (a.dateIso ?? '9999').localeCompare(b.dateIso ?? '9999'));
  }, [products]);
  return { workshops, loading, error };
}

/* ---------- drobnosti ---------- */

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

function placesWord(count: number) {
  if (count === 1) return 'místo';
  if (count >= 2 && count <= 4) return 'místa';
  return 'míst';
}

/* ---------- fotka hosta ---------- */

/**
 * Fotka hosta, která není jen obrázek: při příjezdu se odkryje a doostří,
 * pak se pomalu nadechuje (jemný posun a přiblížení) a na počítači se naklání
 * za myší — fotka, jméno a štítky se hýbou každý jinak rychle, takže má hloubku.
 * Žádná záře ani nálepky přes fotku.
 */
function GuestPhoto({ view }: { view: WorkshopView }) {
  const reduced = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const hover = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 140, damping: 18, mass: 0.6 });
  const sy = useSpring(py, { stiffness: 140, damping: 18, mass: 0.6 });
  const glow = useSpring(hover, { stiffness: 120, damping: 20 });
  const rotateY = useTransform(sx, [-0.5, 0.5], [-8, 8]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [6, -6]);
  const imageX = useTransform(sx, [-0.5, 0.5], [12, -12]);
  const imageY = useTransform(sy, [-0.5, 0.5], [10, -10]);
  const labelX = useTransform(sx, [-0.5, 0.5], [-10, 10]);
  const labelY = useTransform(sy, [-0.5, 0.5], [-6, 6]);
  const lightX = useTransform(sx, [-0.5, 0.5], [15, 85]);
  const lightY = useTransform(sy, [-0.5, 0.5], [10, 90]);
  const light = useMotionTemplate`radial-gradient(380px circle at ${lightX}% ${lightY}%, rgba(255,255,255,0.16), transparent 62%)`;

  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    px.set((event.clientX - rect.left) / rect.width - 0.5);
    py.set((event.clientY - rect.top) / rect.height - 0.5);
    hover.set(1);
  };
  const onLeave = () => {
    px.set(0);
    py.set(0);
    hover.set(0);
  };

  const letters = Array.from(view.guest);

  return (
    <motion.div
      className="relative mx-auto w-[86%] max-w-[420px] [perspective:1100px] lg:w-full"
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      animate={reduced ? undefined : { y: [0, -9, 0] }}
      transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.div
        style={{ rotateX, rotateY }}
        initial={reduced ? false : { opacity: 0, scale: 0.9, filter: 'blur(14px)' }}
        whileInView={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.95, ease: EASE }}
        className="relative aspect-[3/4] overflow-hidden rounded-[2rem] bg-[#16131f] shadow-[0_40px_70px_-40px_rgba(0,0,0,0.9)] ring-1 ring-white/10 [transform-style:preserve-3d]"
      >
        {view.photo ? (
          <motion.div className="absolute -inset-4" style={{ x: imageX, y: imageY }}>
            <motion.img
              src={view.photo}
              alt={view.guest ? `${view.guest}, host workshopu` : view.title}
              className="h-full w-full object-cover object-[50%_18%]"
              animate={reduced ? undefined : { scale: [1.03, 1.1] }}
              transition={{ duration: 11, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' }}
              draggable={false}
            />
          </motion.div>
        ) : null}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0B0B10]/90 to-transparent" />
        {/* světlo, které jde za myší */}
        <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: light, opacity: glow }} />

        <motion.div className="absolute inset-x-0 bottom-0 p-6 md:p-7" style={{ x: labelX, y: labelY }}>
          {view.guest ? (
            <p className="text-5xl font-black leading-none tracking-tight text-white md:text-6xl" aria-label={view.guest}>
              {letters.map((letter, i) => (
                <motion.span
                  key={`${letter}-${i}`}
                  aria-hidden
                  className="inline-block"
                  initial={reduced ? false : { opacity: 0, y: '0.5em', rotate: 8 }}
                  whileInView={{ opacity: 1, y: '0em', rotate: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.45 + i * 0.06 }}
                >
                  {letter === ' ' ? '\u00a0' : letter}
                </motion.span>
              ))}
            </p>
          ) : null}
          {view.youtube || view.instagram ? (
            <motion.div
              className="mt-4 flex flex-wrap gap-2"
              initial={reduced ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: 0.75, ease: EASE }}
            >
              {view.youtube ? <SocialPill href={view.youtube.url} icon={<Youtube size={16} />} label={view.youtube.handle} /> : null}
              {view.instagram ? <SocialPill href={view.instagram.url} icon={<Instagram size={16} />} label={view.instagram.handle} /> : null}
            </motion.div>
          ) : null}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/* ---------- karta jednoho termínu ---------- */

function WorkshopCard({ view }: { view: WorkshopView }) {
  const soldOut = view.capacity > 0 && view.left <= 0;

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
      {/* host */}
      <GuestPhoto view={view} />

      {/* kdy, kde, za kolik */}
      <div>
        {/* Datum je bílé a menší než nadpis stránky — barevný přechod patří jen nadpisu. */}
        <p className="text-[clamp(3.6rem,15vw,6.75rem)] font-black leading-[0.9] tracking-[-0.045em] text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {view.dateLabel}
        </p>
        {view.dayLabel ? <p className="mt-3 text-2xl font-black tracking-tight text-white/75 md:text-3xl">{view.dayLabel}</p> : null}
        {view.intro ? <p className="mt-5 max-w-xl text-lg font-medium leading-relaxed text-white/70 md:text-xl">{view.intro}</p> : null}

        <a href={view.mapsUrl} target="_blank" rel="noopener noreferrer" className="group mt-8 flex items-start gap-4 border-t border-white/12 pt-6">
          <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors group-hover:bg-white group-hover:text-[#0B0B10]">
            <MapPin size={20} />
          </span>
          <span>
            <span className="block text-2xl font-black leading-tight tracking-tight text-white md:text-3xl">{view.venue}</span>
            <span className="mt-1 block text-base font-medium text-white/60 underline-offset-4 group-hover:underline md:text-lg">{view.address}</span>
          </span>
        </a>

        <div className="mt-6 grid gap-6 border-t border-white/12 pt-6 sm:grid-cols-[auto_1fr] sm:gap-12">
          <div>
            <p className="text-4xl font-black leading-none tracking-tight text-white md:text-5xl" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {view.price.toLocaleString('cs-CZ')} Kč
            </p>
            <p className="mt-2 text-base font-bold text-white/55">za dítě</p>
          </div>
          {view.capacity > 0 ? (
            <div className="min-w-0 self-end">
              <div className="flex items-end justify-between gap-4">
                <p className="text-2xl font-black leading-tight tracking-tight text-white md:text-3xl">
                  {soldOut ? 'Vyprodáno' : (
                    <>
                      Zbývá <CountUp value={view.left} /> {placesWord(view.left)}
                    </>
                  )}
                </p>
                <p className="pb-1 text-base font-bold text-white/55">z {view.capacity}</p>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full origin-left rounded-full bg-gradient-to-r from-brand-purple via-[#F12BB3] to-[#FFB21A]"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: Math.max(0.02, view.left / view.capacity) }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 1.2, delay: 0.2, ease: EASE }}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          {soldOut ? null : (
            <a href={WEB_APP_URL} className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-base font-black text-[#0B0B10] transition-transform hover:-translate-y-0.5">
              <Ticket size={19} />
              Koupit vstupenku
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </a>
          )}
          <a href="#navod-workshop" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-4 text-base font-black text-white transition-colors hover:border-white/50 hover:bg-white/[0.06]">
            <PlayCircle size={19} />
            Video návod
          </a>
        </div>
        <p className="mt-4 text-sm font-medium text-white/50">Vstupenky se kupují v aplikaci Team VYS, v telefonu i v prohlížeči.</p>
      </div>
    </div>
  );
}

/* ---------- přetahování mezi termíny ---------- */

function WorkshopCarousel({ workshops, active, onChange }: { workshops: WorkshopView[]; active: number; onChange: (index: number) => void }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const many = workshops.length > 1;

  // Která karta je vidět — podle polohy posunu.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !many) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const index = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
        onChange(Math.max(0, Math.min(workshops.length - 1, index)));
      });
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener('scroll', onScroll);
    };
  }, [many, onChange, workshops.length]);

  const go = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
  };

  return (
    <div>
      {many ? (
        <div className="mb-8 flex items-center justify-between gap-4 md:mb-10">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Termíny workshopů">
            {workshops.map((view, i) => (
              <button
                key={view.id}
                type="button"
                role="tab"
                aria-selected={i === active}
                onClick={() => go(i)}
                className={`relative rounded-full px-4 py-2.5 text-sm font-black transition-colors md:text-base ${i === active ? 'text-[#0B0B10]' : 'text-white/70 hover:text-white'}`}
              >
                {i === active ? <motion.span layoutId="workshop-date-pill" className="absolute inset-0 rounded-full bg-white" transition={{ type: 'spring', stiffness: 380, damping: 32 }} /> : null}
                <span className="relative">{view.dateLabel}{view.guest ? ` · ${view.guest}` : ''}</span>
              </button>
            ))}
          </div>
          <div className="hidden shrink-0 gap-2 sm:flex">
            <button type="button" onClick={() => go(active - 1)} disabled={active === 0} aria-label="Předchozí termín" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:bg-white hover:text-[#0B0B10] disabled:pointer-events-none disabled:opacity-25">
              <ArrowLeft size={18} />
            </button>
            <button type="button" onClick={() => go(active + 1)} disabled={active === workshops.length - 1} aria-label="Další termín" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:bg-white hover:text-[#0B0B10] disabled:pointer-events-none disabled:opacity-25">
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      ) : null}

      <div
        ref={trackRef}
        className={many ? 'flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : ''}
      >
        {workshops.map((view) => (
          <div key={view.id} className={many ? 'w-full shrink-0 snap-center [scroll-snap-stop:always]' : ''}>
            <WorkshopCard view={view} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- program a praktické věci vybraného termínu ---------- */

function WorkshopProgram({ view }: { view: WorkshopView }) {
  if (view.phases.length === 0) return null;
  const timeNote = view.startMinutes !== null ? `Od ${clock(view.startMinutes)} do ${clock(view.startMinutes + view.totalMinutes)}. Časy jsou orientační.` : 'Časy jsou orientační.';
  return (
    <section className="section-shell pb-20 md:pb-28">
      <h2 className="text-balance text-3xl font-black leading-[1.02] tracking-tight text-white md:text-6xl">Jak to bude probíhat</h2>
      <p className="mt-4 max-w-xl text-base font-medium leading-7 text-white/65 md:text-lg">{timeNote}</p>
      <div className="mt-10 md:mt-12">
        <PhaseDial key={view.id} phases={view.phases} total={view.totalMinutes} clockStart={view.startMinutes ?? undefined} compact />
      </div>
    </section>
  );
}

function WorkshopNotes({ view }: { view: WorkshopView }) {
  return (
    <section className="section-shell pb-20 md:pb-28">
      <h2 className="max-w-4xl text-balance text-3xl font-black leading-[1.02] tracking-tight text-white md:text-6xl">Dobré vědět předem</h2>
      <dl className="mt-8 md:mt-10">
        {view.notes.map((note, i) => (
          <motion.div
            key={`${view.id}-${note.label}`}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6, delay: i * 0.05, ease: EASE }}
            className="grid gap-1 border-t border-white/12 py-5 md:grid-cols-[220px_1fr] md:items-baseline md:gap-10 md:py-7"
          >
            <dt className="text-lg font-black text-white/45 md:text-2xl">{note.label}</dt>
            <dd className="text-balance text-xl font-black leading-tight tracking-tight text-white md:text-3xl">{note.text}</dd>
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
    alt: 'Záložka Platby: workshop a tlačítko Koupit vstupenku',
    tone: '#f8f7fc',
    seconds: 6.5,
  },
  {
    icon: <Ticket size={18} />,
    title: 'Ukaž vstupenku u vstupu',
    text: (
      <>
        Vstupenku najdeš hned na úvodní stránce u dítěte a taky v e-mailu. Klepneš na <strong className="text-white">Ukázat QR</strong> a
        u vstupu ho necháš načíst.
      </>
    ),
    video: '/navod/workshop-4.mp4',
    poster: '/navod/workshop-4.webp',
    alt: 'Vstupenka na workshop s QR kódem',
    tone: '#f8f7fc',
    seconds: 5.5,
  },
];

/* ---------- když žádný termín vypsaný není ---------- */

function WorkshopComingSoon() {
  const reduced = useReducedMotion();
  return (
    <section className="section-shell pb-16 md:pb-24">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.8, ease: EASE }}
        className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#F12BB3]/[0.22] via-[#1a1030] to-[#0B0B10] p-8 md:rounded-[2.5rem] md:p-14"
      >
        {reduced ? null : (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,#8B1DFF_0%,rgba(139,29,255,0.35)_45%,transparent_70%)] md:h-96 md:w-96"
            animate={{ x: [0, -26, 0], y: [0, 20, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <div className="relative max-w-2xl">
          <h2 className="text-balance text-4xl font-black leading-[1.02] tracking-tight text-white md:text-6xl">Další termíny připravujeme</h2>
          <p className="mt-5 max-w-lg text-lg font-medium leading-relaxed text-white/70 md:text-xl">Jakmile je vypíšeme, najdeš je tady i v aplikaci. Chceš vědět jako první?</p>
          <Link href="/kontakty" className="group mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-base font-black text-[#0B0B10] transition-transform hover:-translate-y-0.5">
            Napiš nám
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

/** Kostra karty, než se termíny načtou — stejné rozložení jako hotová karta. */
function WorkshopSkeleton() {
  return (
    <section className="section-shell pb-20 md:pb-28" aria-busy>
      <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="mx-auto aspect-[3/4] w-[86%] max-w-[420px] animate-pulse rounded-[2rem] bg-white/[0.06] lg:w-full" />
        <div className="space-y-5">
          <div className="h-28 w-3/4 animate-pulse rounded-3xl bg-white/[0.06] md:h-36" />
          <div className="h-9 w-2/3 animate-pulse rounded-2xl bg-white/[0.06]" />
          <div className="h-20 w-full animate-pulse rounded-2xl bg-white/[0.05]" />
          <div className="h-20 w-full animate-pulse rounded-2xl bg-white/[0.05]" />
        </div>
      </div>
    </section>
  );
}

/* ---------- celá nabídka ---------- */

export function WorkshopShowcase() {
  const { workshops, loading } = useUpcomingWorkshops();
  const [active, setActive] = useState(0);
  const index = Math.min(active, Math.max(0, workshops.length - 1));

  if (loading) return <WorkshopSkeleton />;
  if (workshops.length === 0) return <WorkshopComingSoon />;

  const view = workshops[index];
  return (
    <>
      <section className="section-shell pb-20 md:pb-28">
        <WorkshopCarousel workshops={workshops} active={index} onChange={setActive} />
      </section>
      <motion.div key={view.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45, ease: EASE }}>
        <WorkshopProgram view={view} />
        <WorkshopNotes view={view} />
      </motion.div>
      <AppGuide id="navod-workshop" steps={WORKSHOP_GUIDE_STEPS} title="Jak koupit vstupenku" subtitle="Čtyři kroky v aplikaci. Zabere to pár minut." />
    </>
  );
}
