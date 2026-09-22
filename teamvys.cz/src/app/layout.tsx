import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import { SubscriptionBanner } from '@/components/subscription-banner';

import './globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'TeamVYS — platforma pro dětské sportovní organizace',
    template: '%s · Team VYS',
  },
  description:
    'Digitální platforma pro dětské sportovní kluby: docházka, skupiny, trenéři, platby, NFC čipy a gamifikace. Mobilní aplikace i webový portál. Powered by Team VYS.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: {
    title: 'TeamVYS — platforma pro dětské sportovní organizace',
    description: 'Docházka, skupiny, trenéři, platby, NFC čipy a gamifikace pro dětské sportovní organizace. 790 Kč měsíčně, prvních 30 dní zdarma.',
    type: 'website',
    locale: 'cs_CZ',
  },
  icons: {
    icon: '/vys-logo-mark.png',
    apple: '/vys-logo-mark.png',
  },
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
        <SubscriptionBanner />
        {children}
      </body>
    </html>
  );
}
