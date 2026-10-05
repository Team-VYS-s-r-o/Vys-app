import { Building2, Gauge, ShieldCheck, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import { SignInForm } from '@/components/auth/sign-in-form';

export const metadata = {
  title: 'Přihlášení',
  description: 'Přihlášení správců organizací a přihlášení přes mobilní aplikaci Team VYS.',
};

export default function SignInPage() {
  return (
    <section className="section-shell grid gap-6 py-10 md:py-14 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
      <div className="rounded-[28px] border border-brand-purple/12 bg-white p-6 text-brand-ink shadow-brand-float md:p-8">
        <span className="inline-flex rounded-[16px] bg-brand-purple-light px-3 py-2 text-xs font-black uppercase text-brand-purple-deep">
          Správa organizace
        </span>
        <h1 className="mt-5 text-3xl font-black leading-tight md:text-5xl">Přihlášení pro správce</h1>
        <p className="mt-4 max-w-[620px] text-base leading-7 text-brand-ink-soft md:text-lg">
          Administrace kroužků, plateb, trenérů a účastníků vaší organizace.
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <Info icon={<Gauge size={19} />} title="Dashboard" body="Finance a provozní přehledy." />
          <Info icon={<Building2 size={19} />} title="Organizace" body="Kroužky, produkty a trenéři." />
          <Info icon={<ShieldCheck size={19} />} title="Bezpečné" body="Přístup jen pro schválené správce." />
        </div>
        <div className="mt-6 rounded-[18px] bg-brand-paper p-4">
          <div className="flex items-start gap-3">
            <Smartphone size={20} className="mt-0.5 shrink-0 text-brand-purple" />
            <div>
              <p className="font-black text-brand-ink">Jste rodič?</p>
              <p className="mt-1 text-sm leading-6 text-brand-ink-soft">
                Rodičovský portál (platby, docházka, dokumenty) je nyní v mobilní aplikaci Team VYS.{' '}
                <Link href="/aplikace" className="font-black text-brand-purple hover:text-brand-pink">
                  Stáhněte si aplikaci
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <Suspense fallback={<div className="rounded-[28px] border border-brand-purple/12 bg-white p-7 shadow-brand-soft">Načítám přihlášení…</div>}>
        <SignInForm variant="admin" />
      </Suspense>
    </section>
  );
}

function Info({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-[18px] bg-brand-paper p-4">
      <span className="text-brand-purple">{icon}</span>
      <h2 className="mt-3 font-black text-brand-ink">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-brand-ink-soft">{body}</p>
    </div>
  );
}