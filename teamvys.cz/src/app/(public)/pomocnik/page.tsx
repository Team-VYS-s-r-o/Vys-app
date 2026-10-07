import { MessageCircle, PhoneCall, Smartphone, Sparkles } from 'lucide-react';
import Link from 'next/link';

import { PageHero } from '@/components/page-hero';
import { VysBotChat } from '@/components/vys-bot/vys-bot-chat';
import { contacts } from '@shared/content';

export const metadata = {
  title: 'Pomocník',
  description:
    'VYS kočka — chytrý pomocník pro rodiče. Zeptej se, jak přidat dítě, koupit permanentku nebo jak funguje účastník v aplikaci Team VYS.',
  alternates: { canonical: '/pomocnik' },
  openGraph: {
    title: 'Pomocník · Team VYS',
    description: 'Zeptej se VYS kočky — odpoví na nejčastější dotazy rodičů během pár vteřin.',
    url: '/pomocnik',
    type: 'website',
    locale: 'cs_CZ',
    images: [{ url: '/cats/premyslim.png', alt: 'Team VYS — pomocník' }],
  },
};

const highlights = [
  {
    icon: <Sparkles size={18} />,
    title: 'Okamžité odpovědi',
    body: 'Přidání dítěte, permanentky, docházka, NFC kartička — vše vysvětlí hned.',
  },
  {
    icon: <Smartphone size={18} />,
    title: 'Provede tě aplikací',
    body: 'Krok za krokem ukáže, kde co v aplikaci Team VYS najdeš a nakoupíš.',
  },
  {
    icon: <PhoneCall size={18} />,
    title: 'Když si neví rady',
    body: 'Pošle tě rovnou na trenéry — telefon i e-mail má po ruce.',
  },
];

export default function PomocnikPage() {
  return (
    <div className="bg-[#0B0B10] text-white">
      <PageHero eyebrow="VYS pomocník" title="Zeptej se VYS kočky" word="pomoc" />

      <section className="section-shell grid gap-6 py-16 md:py-24 lg:grid-cols-[1.6fr_1fr]">
        {/* Chat */}
        <VysBotChat />

        {/* Boční panel */}
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-purple-light">Co umí</p>
            <h2 className="mt-2 text-2xl font-black text-white">Pomocník pro rodiče</h2>
            <div className="mt-6 grid gap-3">
              {highlights.map((item) => (
                <div key={item.title} className="flex items-start gap-4 rounded-xl border border-white/10 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-purple/15 text-brand-purple-light ring-1 ring-inset ring-white/10">
                    {item.icon}
                  </span>
                  <div>
                    <p className="font-black text-white">{item.title}</p>
                    <p className="mt-0.5 text-sm leading-6 text-white/55">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-purple-light">Radši živého člověka?</p>
            <h3 className="mt-2 text-xl font-black text-white">Ozvi se nám přímo</h3>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Kočka zvládne nejčastější dotazy, ale u speciálních situací ti rádi pomůžeme osobně.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Link
                href={`tel:${contacts.phone.replaceAll(' ', '')}`}
                className="flex items-center gap-3 rounded-xl border border-white/10 p-4 transition-colors hover:border-brand-purple/50"
              >
                <PhoneCall size={16} className="shrink-0 text-brand-purple-light" />
                <span className="text-sm font-black text-white">{contacts.phone}</span>
              </Link>
              <Link
                href={`mailto:${contacts.email}`}
                className="flex items-center gap-3 rounded-xl border border-white/10 p-4 transition-colors hover:border-brand-purple/50"
              >
                <MessageCircle size={16} className="shrink-0 text-brand-purple-light" />
                <span className="text-sm font-black text-white">{contacts.email}</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
