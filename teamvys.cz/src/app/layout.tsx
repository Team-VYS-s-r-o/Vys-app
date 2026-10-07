import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import { CookieConsent, ExitGuard } from '@/components/cookie-and-exit';
import { SubscriptionBanner } from '@/components/subscription-banner';

import './globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https')
  ? process.env.NEXT_PUBLIC_SITE_URL
  : 'https://teamvys.cz';

export const metadata: Metadata = {
  title: {
    default: 'Team VYS — parkour kroužky, tábory a workshopy pro děti',
    template: '%s · Team VYS',
  },
  description:
    'Parkour kroužky pro děti, příměstské tábory a workshopy pod vedením certifikovaných trenérů. Vyškov, Prostějov, Blansko, Brandýs nad Labem, Jeseník a Praha. Přihlaste své dítě online.',
  metadataBase: new URL(SITE_URL),
  applicationName: 'Team VYS',
  keywords: [
    'parkour kroužek',
    'parkour pro děti',
    'parkour kroužek pro děti',
    'parkour tábor',
    'příměstský tábor parkour',
    'parkour workshop',
    'sportovní kroužek pro děti',
    'parkour Vyškov',
    'parkour Prostějov',
    'parkour Blansko',
    'parkour Brandýs nad Labem',
    'parkour Jeseník',
    'parkour Praha',
    'Team VYS',
  ],
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    siteName: 'Team VYS',
    title: 'Team VYS — parkour kroužky, tábory a workshopy pro děti',
    description:
      'Parkour kroužky, příměstské tábory a workshopy pro děti v 6 městech. Certifikovaní trenéři, bezpečný progres a appka, kde dítě vidí svůj pokrok.',
    type: 'website',
    url: '/',
    locale: 'cs_CZ',
    images: [
      {
        url: '/cats/parkour.png',
        width: 1307,
        height: 1203,
        alt: 'Team VYS — parkour kroužky pro děti',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Team VYS — parkour kroužky, tábory a workshopy pro děti',
    description:
      'Parkour kroužky, příměstské tábory a workshopy pro děti v 6 městech. Certifikovaní trenéři a bezpečný progres.',
    images: ['/cats/parkour.png'],
  },
  icons: {
    icon: '/vys-logo-mark.png',
    apple: '/vys-logo-mark.png',
  },
};

/** Strukturovaná data pro Google — sportovní organizace (parkour pro děti). */
const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': ['SportsOrganization', 'LocalBusiness'],
  '@id': `${SITE_URL}/#organization`,
  name: 'Team VYS',
  legalName: 'Team VYS s.r.o.',
  url: SITE_URL,
  logo: `${SITE_URL}/vys-logo-mark.png`,
  image: `${SITE_URL}/cats/parkour.png`,
  description:
    'Parkour kroužky pro děti, příměstské tábory a jednorázové workshopy pod vedením certifikovaných trenérů.',
  email: 'info@teamvys.cz',
  telephone: '+420734167417',
  sport: 'Parkour',
  priceRange: 'Kč',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'CZ',
  },
  areaServed: ['Vyškov', 'Prostějov', 'Blansko', 'Brandýs nad Labem', 'Jeseník', 'Jesenice', 'Praha'],
  makesOffer: [
    {
      '@type': 'Offer',
      name: 'Parkour kroužky pro děti',
      url: `${SITE_URL}/krouzky`,
      category: 'Sportovní kroužek',
    },
    {
      '@type': 'Offer',
      name: 'Příměstské parkour tábory',
      url: `${SITE_URL}/tabory`,
      category: 'Příměstský tábor',
    },
    {
      '@type': 'Offer',
      name: 'Parkour workshopy',
      url: `${SITE_URL}/workshopy`,
      category: 'Workshop',
    },
  ],
};

export const viewport: Viewport = {
  themeColor: '#FBFAFE',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" className={inter.variable}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <SubscriptionBanner />
        {children}
        <CookieConsent />
        <ExitGuard />
      </body>
    </html>
  );
}
