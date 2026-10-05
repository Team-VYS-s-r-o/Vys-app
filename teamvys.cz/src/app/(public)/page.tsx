import { HomeHero } from '@/components/home/hero';

export const metadata = {
  title: 'TeamVYS — parkour kroužky, tábory a workshopy pro děti',
  description:
    'Parkour kroužky pro děti, příměstské tábory a workshopy v šesti městech. Certifikovaní trenéři, bezpečný progres a appka pro děti, rodiče i trenéry.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'TeamVYS — parkour kroužky, tábory a workshopy pro děti',
    description:
      'Parkour kroužky pro děti, příměstské tábory a workshopy v šesti městech. Certifikovaní trenéři, bezpečný progres a appka pro děti i rodiče.',
    url: '/',
    type: 'website',
    locale: 'cs_CZ',
    images: [{ url: '/cats/parkour.png', width: 1307, height: 1203, alt: 'TeamVYS — parkour kroužky pro děti' }],
  },
};

export default function HomePage() {
  return <HomeHero />;
}
