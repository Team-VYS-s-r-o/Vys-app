import { CalendarDays, QrCode, ShieldCheck, Smartphone, Trophy, UserRoundCheck } from 'lucide-react';
import Image from 'next/image';
import { Suspense } from 'react';

import { AppInstallButton } from '@/components/app-install-button';
import { AppSignInForm } from '@/components/app/app-sign-in-form';

export const metadata = {
  title: 'Přihlášení',
};

const highlights = [
  { icon: Trophy, label: 'XP a náramky' },
  { icon: QrCode, label: 'QR triky' },
  { icon: CalendarDays, label: 'Docházka' },
  { icon: Smartphone, label: 'PWA na ploše' },
];

export default function AppSignInPage() {
  return (
    <main className="min-h-dvh bg-brand-paper px-3 py-4 text-brand-ink texture-grid sm:px-5 md:py-7">
      <div className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
        <section className="order-2 rounded-brand border border-brand-purple/12 bg-white/90 p-5 shadow-brand-soft backdrop-blur lg:order-1 lg:sticky lg:top-6">
          <div className="flex items-center gap-3">
            <Image src="/vys-logo-mark.png" alt="Team VYS" width={42} height={42} className="rounded-brand bg-white p-1 shadow-brand-soft" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-purple">Team VYS appka</p>
              <p className="text-lg font-black tracking-wide text-brand-ink">Účastník + trenér</p>
            </div>
          </div>

          <h1 className="mt-5 text-3xl font-black leading-tight text-brand-ink md:text-4xl">Přístup bez dětského e-mailu</h1>
          <p className="mt-3 text-sm font-bold leading-6 text-brand-ink-soft">
            Účastník se zakládá přes rodičovský telefon. E-mail je jen volitelný kontakt rodiče, ne účet dítěte.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            {highlights.map((item) => (
              <div key={item.label} className="rounded-brand border border-brand-purple/12 bg-brand-paper p-3">
                <item.icon size={18} className="text-brand-purple" />
                <p className="mt-2 text-xs font-black text-brand-ink">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-brand border border-brand-mint/30 bg-brand-mint/12 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-brand bg-white text-brand-purple shadow-brand-soft">
              <ShieldCheck size={18} />
            </span>
            <p className="text-sm font-bold leading-6 text-brand-ink-soft">
              Rodičovský profil a admin zůstávají na webu. Tahle instalovatelná část je jen rychlý vstup pro účastníka a trenéra.
            </p>
          </div>
        </section>

        <section className="order-1 rounded-brand border border-brand-purple/12 bg-white p-4 text-brand-ink shadow-brand md:p-6 lg:order-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-purple">Přihlášení do appky</p>
              <h2 className="mt-1 text-2xl font-black text-brand-ink">Účastník nebo trenér</h2>
            </div>
            <AppInstallButton label="Přidat" compact />
          </div>
          <div className="mb-4 flex items-center gap-2 rounded-brand bg-brand-paper px-3 py-2 text-xs font-black text-brand-ink-soft">
            <UserRoundCheck size={16} className="text-brand-purple" />
            Účastník používá rodičovský telefon. Trenér používá trenérský e-mail.
          </div>
          <Suspense fallback={<div className="rounded-[18px] bg-brand-paper p-5 text-sm font-bold text-brand-ink-soft">Načítám přihlášení...</div>}>
            <AppSignInForm />
          </Suspense>
        </section>
      </div>
    </main>
  );
}