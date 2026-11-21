'use client';

import { Apple, LogIn } from 'lucide-react';
import Image from 'next/image';

import { AppGuide } from '@/components/app-guide';
import { AppShowcase } from '@/components/app-showcase';
import { NfcCardSpin } from '@/components/home/nfc-card-spin';

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
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-purple-light">Aplikace</p>
            <h1 className="mt-4 max-w-[18ch] text-3xl font-black leading-[1.05] tracking-tight text-white md:text-6xl">
              Celý Team VYS v telefonu
            </h1>
            <p className="mt-5 max-w-[46ch] text-sm leading-7 text-white/65 md:text-base">
              Stáhni si ji do iPhonu, nebo se přihlas rovnou v prohlížeči — bez stahování.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <AppStoreButton />
              <WebSignInButton />
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
