import { Mail, MapPin, Phone } from 'lucide-react';

import { GoogleReviewFooterLink } from '@/components/google-review';
import Link from 'next/link';

import { TeamVysLogo } from '@/components/brand/team-vys-logo';
import { contacts } from '@shared/content';

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
    <footer className="relative overflow-hidden border-t border-white/10 bg-brand-ink px-4 pt-10 pb-8 text-white sm:px-6">
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-brand" />
      <div aria-hidden className="absolute inset-0 diagonal-rails opacity-[0.08]" />

      <div className="relative mx-auto w-full max-w-[1180px]">
        <div className="grid gap-9 sm:grid-cols-2 md:grid-cols-[1.35fr_0.8fr_0.95fr]">
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
            <div className="mt-2 flex flex-wrap gap-2">
              {contacts.cities.slice(0, 4).map((city) => (
                <span key={city} className="rounded-brand border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-white/[0.72]">
                  {city}
                </span>
              ))}
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

          <div className="flex flex-col gap-3 sm:col-span-2 md:col-span-1">
            <h3 className="mb-1 text-[13px] font-black uppercase text-brand-pink">Spojení</h3>
            <FooterContact icon={<Mail size={16} />} value={contacts.email} href={`mailto:${contacts.email}`} />
            <FooterContact icon={<Phone size={16} />} value={contacts.phone} href={`tel:${contacts.phone.replaceAll(' ', '')}`} />
            <FooterContact icon={<MapPin size={16} />} value={contacts.cities.join(', ')} />
            <p className="text-sm leading-6 text-white/[0.58]">Team VYS s.r.o. · IČO {contacts.ico}{contacts.bank ? ` · ${contacts.bank}` : ''}</p>
            <div className="mt-1 text-sm font-semibold text-white/70">
              <GoogleReviewFooterLink />
            </div>
          </div>
        </div>

        {cities.length ? (
          <div className="mt-8 border-t border-white/10 pt-5">
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
            © {new Date().getFullYear()} Team VYS s.r.o. · Vyškov · Prostějov · Blansko · Brandýs · Jeseník · Šumperk · Písečná · Jesenice · Praha
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
