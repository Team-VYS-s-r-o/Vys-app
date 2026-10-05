import type { Metadata, Viewport } from 'next';

import { PwaRegister } from '@/components/pwa-register';

export const metadata: Metadata = {
  title: {
    default: 'Team VYS aplikace',
    template: '%s · Team VYS aplikace',
  },
  description: 'Instalovatelná Team VYS aplikace pro účastníky a trenéry.',
  manifest: '/app/manifest.webmanifest',
  icons: {
    icon: '/vys-logo-mark.png',
    apple: '/vys-logo-mark.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#FFF9F0',
  width: 'device-width',
  initialScale: 1,
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-brand-paper text-brand-ink">
      <PwaRegister />
      {children}
    </div>
  );
}