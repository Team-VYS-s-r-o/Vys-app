'use client';

import { motion } from 'framer-motion';
import { Apple, ArrowDown, LogIn, Play } from 'lucide-react';
import Image from 'next/image';

import { AppGuide } from '@/components/app-guide';
import { AppShowcase } from '@/components/app-showcase';
import { NfcCardSpin } from '@/components/home/nfc-card-spin';
import { HeroTitle } from '@/components/page-hero';

const WEB_APP_URL = 'https://app.aplikacevys.cz/sign-in?source=pwa';
const APP_STORE_URL = 'https://apps.apple.com/cz/app/vys/id6816709958';



export default function AplikacePage() {
  return (
    <div className="bg-[#0B0B10] text-white">
      {/* Stažení / přihlášení je první, co návštěvník uvidí — hero stránky.
          Nese H1, telefon stojí vpravo, kolem hodně vzduchu. */}
      <section className="relative overflow-hidden pt-32 pb-24 md:pt-40 md:pb-40">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_15%_0%,rgba(139,29,255,0.20),transparent_45%),radial-gradient(circle_at_90%_20%,rgba(178,59,255,0.12),transparent_45%)]"
        />
        <div className="section-shell relative grid items-center gap-14 lg:grid-cols-[1fr_360px]">
          <div>
            <HeroTitle
              title="Celý Team VYS v telefonu"
              accent="v telefonu"
              className="max-w-[12ch] text-[clamp(2.6rem,11vw,6.5rem)] font-black leading-[0.98] tracking-[-0.035em] text-white"
            />
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 max-w-[46ch] text-base leading-7 text-white/65 md:text-lg"
            >
              Stáhni si ji do iPhonu, nebo se přihlas rovnou v prohlížeči — bez stahování.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.68, ease: [0.22, 1, 0.36, 1] }}
              className="mt-9 flex flex-col gap-3 sm:flex-row"
            >
              <AppStoreButton />
              <WebSignInButton />
            </motion.div>
            {/* Malý odkaz dolů na video návod */}
            <motion.a
              href="#navod"
              onClick={(event) => {
                const target = document.getElementById('navod');
                if (!target) return;
                event.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.85 }}
              className="group mt-6 inline-flex items-center gap-2.5 text-sm font-bold text-white/60 transition-colors hover:text-white"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 transition-colors group-hover:bg-brand-purple">
                <Play size={11} className="translate-x-[1px] fill-current" />
              </span>
              Video návod: jak přidat dítě a koupit permanentku
              <motion.span
                aria-hidden
                animate={{ y: [0, 3, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                className="inline-flex"
              >
                <ArrowDown size={14} />
              </motion.span>
            </motion.a>
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

      {/* Ukázky z aplikace — scroll-pinned telefony s videem */}
      <section>
        <div className="section-shell">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-purple-light">Pro všechny</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-white md:text-4xl">Jedna aplikace, tři pohledy</h2>
        </div>
        <AppShowcase />
      </section>

      {/* NFC kartička — otáčí se scrollováním; karta vlevo, text vpravo */}
      <section className="section-shell relative pb-24 pt-10 md:pb-40 md:pt-16">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(139,29,255,0.22),transparent_60%)] blur-2xl"
        />
        <div className="relative grid items-center gap-10 lg:grid-cols-[440px_1fr]">
          <NfcCardSpin className="mx-auto w-full max-w-[440px]" />
          <div className="lg:pl-6">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-purple-light">NFC docházka</p>
            <h2 className="mt-3 max-w-[16ch] text-2xl font-black tracking-tight text-white md:text-4xl">
              Jedna kartička, celá docházka
            </h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/65 md:text-base">
              Dítě přiloží kartičku k telefonu trenéra — vstup se odečte z digitální permanentky
              a rodiči hned přijde zpráva, že dorazilo v pořádku.
            </p>
          </div>
        </div>
      </section>

      <AppGuide />
    </div>
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
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-white/80">Bez stahování</span>
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
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#0B0B10]/70">Stáhnout pro iPhone</span>
        <span className="block text-base font-black">App Store</span>
      </span>
    </a>
  );
}
