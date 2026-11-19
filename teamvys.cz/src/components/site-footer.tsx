import { Mail, Phone } from 'lucide-react';

import { GoogleReviewFooterLink } from '@/components/google-review';
import Link from 'next/link';

import { TeamVysLogo } from '@/components/brand/team-vys-logo';
import { contacts, phoneLines } from '@shared/content';

import { loadCities } from '@/lib/cities';

const navLinks = [
  { label: 'Kroužky', href: '/krouzky' as const },
  { label: 'Tábory', href: '/tabory' as const },
  { label: 'Workshopy s youtuberem', href: '/workshopy' as const },
  { label: 'O nás', href: '/o-nas' as const },
  { label: 'Kontakty', href: '/kontakty' as const },
  { label: 'Ochrana osobních údajů', href: '/ochrana-osobnich-udaju' as const },
];

export async function SiteFooter() {
  const cities = await loadCities();

  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-brand-ink px-4 pt-12 pb-8 text-white sm:px-6">
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-brand" />
      <div aria-hidden className="absolute inset-0 diagonal-rails opacity-[0.08]" />

      <div className="relative mx-auto w-full max-w-[1180px]">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.25fr_0.65fr_1fr_1fr]">
          <div className="flex flex-col gap-3">
            <Link href="/" aria-label="Přejít na úvodní stránku" className="flex items-center gap-3 transition-opacity hover:opacity-80">
              <TeamVysLogo size={44} />
              <span className="text-[22px] font-black text-white">
                TEAM<span className="gradient-text">VYS</span>
              </span>
            </Link>
            <p className="max-w-[410px] text-sm leading-6 text-white/70">
              Digitální platforma pro dětské sportovní organizace — docházka, platby, gamifikace a mobilní
              aplikace v jednom. Powered by Team VYS, parkourovým klubem, který na ní denně jede.
            </p>
            <div className="mt-1 text-sm font-semibold text-white/70">
              <GoogleReviewFooterLink />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="mb-1 text-[13px] font-black uppercase text-brand-pink">Web</h3>
            {navLinks.map((item) => (
              <Link key={item.href} href={item.href} className="py-1 text-sm font-semibold text-white/70 transition-colors hover:text-white">
                {item.label}
              </Link>
            ))}
          </div>

          {/* Tři linky podle regionu — rodič volá rovnou tomu, kdo jeho město řeší. */}
          <div className="flex flex-col gap-3">
            <h3 className="mb-1 text-[13px] font-black uppercase text-brand-pink">Zavolej nám</h3>
            {phoneLines.map((line) => (
              <Link
                key={line.number}
                href={`tel:+420${line.number.replaceAll(' ', '')}`}
                className="group rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 transition-colors hover:border-brand-purple/50"
              >
                <p className="text-[11px] font-bold uppercase tracking-wide text-white/45">{line.label}</p>
                <p className="mt-0.5 flex items-center gap-2 text-sm font-black text-white">
                  <Phone size={14} className="text-brand-pink transition-transform group-hover:-rotate-12" />
                  {line.number}
                </p>
              </Link>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-1">
            <h3 className="mb-1 text-[13px] font-black uppercase text-brand-pink">Spojení</h3>
            <FooterContact icon={<Mail size={16} />} value={contacts.email} href={`mailto:${contacts.email}`} />
            <p className="text-sm leading-6 text-white/[0.58]">
              Team VYS s.r.o.
              <br />
              IČO {contacts.ico}
              {contacts.bank ? (
                <>
                  <br />
                  Účet {contacts.bank}
                </>
              ) : null}
            </p>
          </div>
        </div>

        {cities.length ? (
          <div className="mt-9 border-t border-white/10 pt-5">
            <h3 className="mb-2 text-[13px] font-black uppercase text-brand-pink">Parkour podle města</h3>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {cities.map((city) => (
                <Link
                  key={city.slug}
                  href={`/parkour/${city.slug}`}
                  className="text-sm font-semibold text-white/[0.58] transition-colors hover:text-white"
                >
                  {city.name}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-8 border-t border-white/10 pt-5">
          <p className="text-xs leading-[18px] text-white/[0.55]">
            © {new Date().getFullYear()} Team VYS s.r.o. · Parkour kroužky, tábory a workshopy pro děti
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterContact({ icon, value, href }: { icon: React.ReactNode; value: string; href?: string }) {
  const content = (
    <span className="flex items-start gap-2 break-words text-sm font-semibold text-white/70">
      <span className="text-brand-pink">{icon}</span>
      {value}
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} className="transition-colors hover:text-white">
      {content}
    </Link>
  );
}
