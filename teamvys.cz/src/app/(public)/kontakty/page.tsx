import { ArrowRight, Mail, MapPin, Phone } from 'lucide-react';
import Link from 'next/link';

import { PageHero } from '@/components/page-hero';
import { contacts } from '@shared/content';

export const metadata = {
  title: 'Kontakty',
  description: 'Kontakt na TeamVYS, města, fakturační údaje a rychlá cesta pro rodiče do přihlášení.',
};

const quickLinks = [
  { href: '/krouzky', title: 'Vybrat kroužek', body: 'Pravidelné tréninky podle města.' },
  { href: '/tabory', title: 'Rezervovat tábor', body: 'Turnusy, dokumenty a platba.' },
  { href: '/workshopy', title: 'Koupit workshop', body: 'Jednorázové akce a QR ticket.' },
];

export default function ContactsPage() {
  return (
    <div className="bg-[#0B0B10] text-white">
      <PageHero eyebrow="Kontakty" title="Ozvi se nám" word="kontakt" />

      <section className="section-shell grid gap-6 py-16 md:py-24 lg:grid-cols-2">
        {/* Kontaktní údaje */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-purple-light">Spojení</p>
          <div className="mt-6 grid gap-3">
            <ContactRow icon={<Phone size={18} />} label="Telefon" value={contacts.phone} href={`tel:${contacts.phone.replaceAll(' ', '')}`} />
            <ContactRow icon={<Mail size={18} />} label="E-mail" value={contacts.email} href={`mailto:${contacts.email}`} />
            <ContactRow icon={<MapPin size={18} />} label="Města" value={contacts.cities.join(', ')} />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Info label="IČO" value={contacts.ico} />
            {contacts.bank ? <Info label="Účet" value={contacts.bank} /> : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {contacts.social.map((item) => (
              <span key={item} className="rounded-full border border-white/12 px-3 py-1.5 text-xs font-bold text-white/60">
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Rozcestník */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-purple-light">Rychlý rozcestník</p>
          <h2 className="mt-2 text-2xl font-black text-white">Co chceš vyřešit?</h2>
          <div className="mt-6 grid gap-3">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center justify-between gap-4 rounded-xl border border-white/10 p-4 transition-colors hover:border-brand-purple/50"
              >
                <div>
                  <p className="font-black text-white">{link.title}</p>
                  <p className="mt-0.5 text-sm leading-6 text-white/55">{link.body}</p>
                </div>
                <ArrowRight size={18} className="shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-purple-light" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function ContactRow({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const content = (
    <div className="flex items-center gap-4 rounded-xl border border-white/10 p-4 transition-colors hover:border-brand-purple/50">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-purple/15 text-brand-purple-light ring-1 ring-inset ring-white/10">{icon}</span>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-white/40">{label}</p>
        <p className="mt-0.5 text-sm font-black text-white md:text-base">{value}</p>
      </div>
    </div>
  );

  if (!href) return content;
  return <Link href={href}>{content}</Link>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}
