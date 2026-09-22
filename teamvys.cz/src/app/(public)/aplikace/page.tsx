'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Building2, Check, ChevronDown, Gamepad2, Info, LogIn, Play, PlusSquare, Share, Sparkles, Ticket, UserPlus, Users, X, Zap } from 'lucide-react';
import Image from 'next/image';
import { useState, type ReactNode } from 'react';

const ease = [0.22, 1, 0.36, 1] as const;

const WEB_APP_URL = 'https://vys-expo-web-export.vercel.app/sign-in?source=pwa';
const WAITLIST_MAILTO =
  'mailto:ahoj@teamvys.cz' +
  '?subject=' +
  encodeURIComponent('Chci vědět, až bude aplikace na Google Play') +
  '&body=' +
  encodeURIComponent(
    'Dobrý den,\n\ndejte mi prosím vědět e-mailem, jakmile bude aplikace TeamVYS ke stažení na Google Play.\n\nDěkuji.'
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
      'Platby kroužků, táborů a workshopů online',
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
  'Přihlas se rovnou v prohlížeči — bez stahování, jako účastník, rodič nebo trenér.',
  'iPhone: otevři VYS v Safari a přidej si ho na plochu. Návod najdeš hned pod tlačítky.',
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
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12, ease }}
              className="mt-6 max-w-[520px] text-base leading-8 text-white/60 md:text-lg"
            >
              Účastníci sledují progres, rodiče řeší platby a správu dětí, trenéři odbavují docházku i QR triky.
            </motion.p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <WebSignInButton />
              <IphoneButton />
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

            <div className="mt-5 max-w-[620px] rounded-2xl border border-brand-purple/30 bg-brand-purple/[0.09] p-4 text-left sm:p-5">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 shrink-0 text-brand-purple-light" size={20} aria-hidden />
                <div>
                  <h2 className="text-sm font-black text-white">Jak přidat VYS na plochu iPhonu</h2>
                  <ol className="mt-3 grid gap-2 text-sm leading-6 text-white/70 sm:grid-cols-3 sm:gap-4">
                    <li><strong className="text-white">1.</strong> Otevři tlačítko „Plochu“ v <strong className="text-white">Safari</strong>.</li>
                    <li><strong className="text-white">2.</strong> Klepni dole na ikonu <Share className="mx-1 inline-block align-[-3px] text-white" size={16} aria-label="Sdílet" /> Sdílet.</li>
                    <li><strong className="text-white">3.</strong> Vyber <PlusSquare className="mx-1 inline-block align-[-3px] text-white" size={16} aria-label="Přidat na plochu" /> Přidat na plochu.</li>
                  </ol>
                </div>
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

function HowToBuy() {
  const [open, setOpen] = useState(false);
  return (
    <section className="section-shell pb-20 md:pb-28">
      <div className="mx-auto max-w-[880px] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-4 p-6 text-left transition hover:bg-white/[0.02] md:p-8"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-brand-purple/30 bg-brand-purple/15 text-brand-purple-light">
            <Sparkles size={22} />
          </span>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-purple-light">Návod krok za krokem</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-white md:text-3xl">Jak koupit permanentku dítěti</h2>
            <p className="mt-1 text-sm text-white/50">Od registrace k první lekci za pár minut. Rozklikni si postup.</p>
          </div>
          <ChevronDown className={`shrink-0 text-brand-purple-light transition-transform duration-300 ${open ? 'rotate-180' : ''}`} size={26} aria-hidden />
        </button>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease }}
              className="overflow-hidden"
            >
              <ol className="space-y-4 p-6 md:p-8">
                <Step n={1} icon={<UserPlus size={18} />} title="Vytvoř si profil rodiče">
                  Otevři aplikaci v prohlížeči (tlačítko nahoře) nebo z plochy iPhonu a zaregistruj se jako{' '}
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
          ) : null}
        </AnimatePresence>
      </div>
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

function IphoneButton() {
  return (
    <a
      href={WEB_APP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/[0.05] px-5 py-3.5 text-left text-white transition-transform hover:-translate-y-0.5 sm:w-auto sm:px-6"
      aria-label="Otevřít VYS v Safari a přidat jej na plochu iPhonu"
    >
      <Share size={20} />
      <span className="leading-tight">
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/50">iPhone · přidat na</span>
        <span className="block text-base font-black">Plochu (web app)</span>
      </span>
    </a>
  );
}
