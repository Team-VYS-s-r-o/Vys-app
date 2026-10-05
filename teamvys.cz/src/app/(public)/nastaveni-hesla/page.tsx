import { KeyRound, ShieldCheck, Sparkles } from 'lucide-react';
import { Suspense } from 'react';

import { SetPasswordForm } from '@/components/auth/set-password-form';

export const metadata = {
  title: 'Nastavení hesla',
  description: 'Nastavte si heslo k účtu Team VYS.',
};

export default function SetPasswordPage() {
  return (
    <section className="section-shell grid gap-6 py-10 md:py-14 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
      <div className="rounded-[28px] border border-brand-purple/12 bg-white p-6 text-brand-ink shadow-brand-float md:p-8">
        <span className="inline-flex rounded-[16px] bg-brand-purple-light px-3 py-2 text-xs font-black uppercase text-brand-purple-deep">
          Aktivace účtu
        </span>
        <h1 className="mt-5 text-3xl font-black leading-tight md:text-5xl">Nastavení hesla</h1>
        <p className="mt-4 max-w-[620px] text-base leading-7 text-brand-ink-soft md:text-lg">
          Zvolte si heslo a dokončete aktivaci svého účtu Team VYS.
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <Info icon={<KeyRound size={19} />} title="Bezpečné" body="Heslo si volíte jen vy, nikam se neposílá." />
          <Info icon={<ShieldCheck size={19} />} title="Jednorázový odkaz" body="Odkaz z e-mailu funguje jen jednou." />
          <Info icon={<Sparkles size={19} />} title="Hned hotovo" body="Po uložení vás přihlásíme automaticky." />
        </div>
      </div>

      <Suspense fallback={<div className="rounded-[28px] border border-brand-purple/12 bg-white p-7 shadow-brand-soft">Načítám…</div>}>
        <SetPasswordForm />
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
