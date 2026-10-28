'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Apple, Bell, Building2, Check, Gamepad2, LogIn, Play, Sparkles, Ticket, UserPlus, Users, X, Zap } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState, type ReactNode } from 'react';

import { NfcCardSpin } from '@/components/home/nfc-card-spin';

const ease = [0.22, 1, 0.36, 1] as const;

const WEB_APP_URL = 'https://app.aplikacevys.cz/sign-in?source=pwa';
const APP_STORE_URL = 'https://apps.apple.com/cz/app/vys/id6816709958';
const WAITLIST_MAILTO =
  'mailto:info@teamvys.cz' +
  '?subject=' +
  encodeURIComponent('Chci vědět, až bude aplikace na Google Play') +
  '&body=' +
  encodeURIComponent(
    'Dobrý den,\n\ndejte mi prosím vědět e-mailem, jakmile bude aplikace Team VYS ke stažení na Google Play.\n\nDěkuji.'
  );

const audiences = [
  {
    title: 'Účastník',
    label: 'pro dítě',
    bullets: [
      'Skill tree, XP a animovaný progres náramků',
      'Digitální permanentka přes NFC čip',
      'Notifikace o dalším tréninku a odměnách',
    ],
  },
  {
    title: 'Rodič',
    label: 'pro rodiče',
    bullets: [
      'Přehled dětí, docházky a aktivních nákupů',
      'Platby kroužků, táborů a workshopů s youtuberem online',
      'Správa organizací, profilu a hodnocení trenérů',
    ],
  },
  {
    title: 'Trenér',
    label: 'pro trenéra',
    bullets: [
      'Docházka přes NFC i ručně, kontrola lokality',
      'QR potvrzení splněných triků',
      'Přehled výplaty, bonusů a DPP dokumentů',
    ],
  },
] as const;

const steps = [
  'iPhone: stáhni si aplikaci VYS z App Storu. Android: brzy na Google Play, zatím funguje prohlížeč.',
  'Přihlas se jako účastník, rodič nebo trenér — jde to i rovnou v prohlížeči bez stahování.',
  'Účastník vidí progres, rodič spravuje děti a platby, trenér řeší docházku a QR potvrzení triků.',
] as const;

export default function AplikacePage() {
  return (
    <div className="bg-[#0B0B10] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden pt-36 md:pt-44">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_15%_0%,rgba(139,29,255,0.20),transparent_45%),radial-gradient(circle_at_90%_20%,rgba(178,59,255,0.12),transparent_45%)]"
        />
        <div className="section-shell relative grid items-center gap-14 pb-16 md:pb-24 lg:grid-cols-[1fr_360px]">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease }}
              className="text-xs font-bold uppercase tracking-[0.25em] text-brand-purple-light"
            >
              Aplikace
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.06, ease }}
              className="mt-5 max-w-[14ch] text-4xl font-black leading-[1.02] tracking-tight text-white md:text-7xl"
            >
              Celý Team VYS v telefonu
            </motion.h1>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <AppStoreButton />
              <WebSignInButton />
            </div>

            <div className="mt-5 max-w-[620px] rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Play className="mt-0.5 shrink-0 fill-brand-purple-light text-brand-purple-light" size={20} aria-hidden />
                  <div>
                    <h2 className="text-sm font-black text-white">Android: brzy na Google Play</h2>
                    <p className="mt-1 text-xs leading-5 text-white/60">
                      Aplikaci právě schvalujeme. Nechte nám e-mail a dáme vám vědět, jakmile půjde stáhnout.
                    </p>
                  </div>
                </div>
                <a
                  href={WAITLIST_MAILTO}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-brand-purple/40 bg-brand-purple/15 px-4 py-2.5 text-xs font-black text-white transition hover:bg-brand-purple/25"
                  aria-label="Dejte mi vědět e-mailem, až bude aplikace na Google Play"
                >
                  <Bell size={15} />
                  Dejte mi vědět
                </a>
              </div>
            </div>

          </div>

          <div className="pointer-events-none relative mx-auto w-full max-w-[300px] lg:max-w-[360px]">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-10 rounded-full bg-[radial-gradient(circle,rgba(139,29,255,0.25),transparent_60%)] blur-2xl"
            />
            <Image
              src="/telefon-web.png"
              alt="Ukázka aplikace VYS v telefonu"
              width={760}
              height={960}
              priority
              sizes="(min-width: 1024px) 360px, 80vw"
              className="relative w-full drop-shadow-[0_40px_80px_rgba(0,0,0,0.55)] [-webkit-mask-image:linear-gradient(to_bottom,black_78%,transparent_100%)] [mask-image:linear-gradient(to_bottom,black_78%,transparent_100%)]"
            />
          </div>
        </div>
      </section>

      {/* NFC kartička — otáčí se scrollováním */}
      <section className="section-shell relative py-10 md:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(139,29,255,0.22),transparent_60%)] blur-2xl"
        />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_440px]">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-purple-light">NFC docházka</p>
            <h2 className="mt-3 max-w-[16ch] text-2xl font-black tracking-tight text-white md:text-4xl">
              Jedna kartička, celá docházka
            </h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/65 md:text-base">
              Dítě přiloží kartičku k telefonu trenéra — vstup se odečte z digitální permanentky
              a rodiči hned přijde zpráva, že dorazilo v pořádku.
            </p>
          </div>
          <NfcCardSpin className="mx-auto w-full max-w-[440px]" />
        </div>
      </section>

      {/* Pro koho */}
      <section className="section-shell py-16 md:py-24">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-purple-light">Pro všechny</p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-white md:text-4xl">Jedna aplikace, tři pohledy</h2>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {audiences.map((role, index) => (
            <motion.div
              key={role.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-70px' }}
              transition={{ duration: 0.5, delay: index * 0.08, ease }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-brand-purple-light">{role.label}</p>
              <h3 className="mt-1 text-2xl font-black text-white">{role.title}</h3>
              <ul className="mt-6 space-y-3">
                {role.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-purple/20 text-brand-purple-light">
                      <Check size={13} strokeWidth={3} />
                    </span>
                    <span className="text-sm leading-6 text-white/65">{bullet}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Jak to funguje */}
      <section className="section-shell pb-16 md:pb-24">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-purple-light">Jak to funguje</p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-white md:text-4xl">Tři kroky a jedeš</h2>

        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-purple text-sm font-black text-white">
                {index + 1}
              </span>
              <p className="mt-5 text-sm leading-6 text-white/65">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <HowToBuy />
    </div>
  );
}

function Step({ n, icon, title, children }: { n: number; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-purple-deep text-sm font-black text-white shadow-[0_10px_24px_rgba(139,29,255,0.4)]">
          {n}
        </span>
        <span className="text-brand-purple-light">{icon}</span>
        <h3 className="text-base font-black text-white md:text-lg">{title}</h3>
      </div>
      <div className="mt-3 text-sm leading-7 text-white/65">{children}</div>
    </li>
  );
}

/**
 * Návod se otevírá v okně přes celou stránku s rozmazaným pozadím — rozbalená
 * sekce byla dlouhá a nepřehledná. Blur vrstva se NEanimuje přes opacity
 * (Chrome by překresloval backdrop po dlaždicích a probliklo by to),
 * animuje se jen karta uvnitř.
 */
function HowToBuy() {
  const [open, setOpen] = useState(false);

  // Escape zavírá, pozadí pod oknem nescrolluje.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open]);

  return (
    <section className="section-shell pb-20 md:pb-28">
      <div className="mx-auto max-w-[880px] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-4 p-6 text-left transition hover:bg-white/[0.02] md:p-8"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-brand-purple/30 bg-brand-purple/15 text-brand-purple-light">
            <Sparkles size={22} />
          </span>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-purple-light">Návod krok za krokem</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-white md:text-3xl">Jak koupit permanentku dítěti</h2>
            <p className="mt-1 text-sm text-white/50">Od registrace k první lekci za pár minut.</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand-purple px-4 py-2.5 text-sm font-black text-white shadow-[0_14px_34px_rgba(139,29,255,0.4)] transition-transform hover:-translate-y-0.5">
            Otevřít návod
          </span>
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="howto-overlay"
            initial={false}
            role="dialog"
            aria-modal="true"
            aria-label="Jak koupit permanentku dítěti"
            onMouseDown={() => setOpen(false)}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xl md:p-8"
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.8 }}
              onMouseDown={(event) => event.stopPropagation()}
              className="flex max-h-[calc(100dvh-32px)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#15121D] shadow-[0_40px_120px_rgba(0,0,0,0.6)]"
            >
              <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6 md:px-8">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-brand-purple-light">Návod krok za krokem</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-white md:text-2xl">Jak koupit permanentku dítěti</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Zavřít návod"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                >
                  <X size={18} />
                </button>
              </div>
              <ol className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6 md:p-8">
                <Step n={1} icon={<UserPlus size={18} />} title="Vytvoř si profil rodiče">
                  Stáhni si aplikaci z App Storu (tlačítko nahoře) nebo ji otevři v prohlížeči a zaregistruj se jako{' '}
                  <strong className="text-white">rodič</strong>. Stačí e-mail a heslo — hotovo za minutu.
                </Step>

                <Step n={2} icon={<Users size={18} />} title="Přidej dítě — vyber si ze dvou možností">
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/70"><Zap size={16} /></span>
                        <p className="text-xs font-black uppercase tracking-wide text-white/50">Rychlá varianta</p>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-white/70">Dítě vytvoříš rovnou ve svém rodičovském profilu. Nejrychlejší cesta k zaplacení.</p>
                      <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-white/50"><X size={16} className="mt-0.5 shrink-0" /> Dítě ale nevidí své postupy a nemůže hrát hru.</p>
                    </div>
                    <div className="relative rounded-2xl border border-brand-purple/30 bg-brand-purple/[0.1] p-5">
                      <span className="absolute right-3 top-3 rounded-full bg-brand-purple px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">Doporučeno</span>
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-purple/25 text-brand-purple-light"><Gamepad2 size={16} /></span>
                        <p className="text-xs font-black uppercase tracking-wide text-brand-purple-light">S hrou</p>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-white/75">Dítě si na svém telefonu otevře aplikaci a vytvoří si vlastní <strong className="text-white">profil účastníka</strong>. Pak ho k sobě přidáš pomocí <strong className="text-white">kódu (toho s pomlčkou)</strong>, který dítě najde ve svém profilu.</p>
                      <ul className="mt-4 space-y-2.5">
                        {['Sleduje vlastní progres a XP', 'Sbírá barevné náramky a hraje hru', 'Ty ho máš propojeného ve svém přehledu'].map((b) => (
                          <li key={b} className="flex items-start gap-2 text-sm leading-6 text-white/70">
                            <Check size={15} strokeWidth={3} className="mt-1 shrink-0 text-brand-purple-light" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Step>

                <Step n={3} icon={<Building2 size={18} />} title="Vyber organizaci">
                  V nabídce aplikace zvol organizaci. Naše parkourová organizace je{' '}
                  <strong className="text-white">Team VYS</strong>.
                </Step>

                <Step n={4} icon={<Ticket size={18} />} title="Kup permanentku a vyber účastníka">
                  V sekci <strong className="text-white">Platby</strong> vyber permanentku (10 nebo 15 vstupů), zvol, pro které dítě je, a zaplať kartou. Potvrzení dorazí e-mailem a permanentka se objeví v aplikaci — dítě může vyrazit na první trénink.
                </Step>
              </ol>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function WebSignInButton() {
  return (
    <a
      href={WEB_APP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-brand-purple px-5 py-3.5 text-left text-white shadow-[0_20px_50px_rgba(139,29,255,0.35)] transition-transform hover:-translate-y-0.5 sm:w-auto sm:px-6"
      aria-label="Přihlásit se do aplikace v prohlížeči (bez stahování)"
    >
      <LogIn size={22} />
      <span className="leading-tight">
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/70">Bez stahování</span>
        <span className="block text-base font-black">Přihlásit se v prohlížeči</span>
      </span>
    </a>
  );
}

function AppStoreButton() {
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white px-5 py-3.5 text-left text-[#0B0B10] transition-transform hover:-translate-y-0.5 sm:w-auto sm:px-6"
      aria-label="Stáhnout aplikaci VYS pro iPhone z App Storu"
    >
      <Apple size={24} className="fill-[#0B0B10]" aria-hidden />
      <span className="leading-tight">
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#0B0B10]/60">Stáhnout pro iPhone</span>
        <span className="block text-base font-black">App Store</span>
      </span>
    </a>
  );
}
