import { ContactCompany, ContactLines, ContactMail } from '@/components/contact-sections';

import { PageHero } from '@/components/page-hero';
import { contacts, phoneLines } from '@shared/content';

export const metadata = {
  title: 'Kontakty',
  description:
    'Kontakt na parkour klub Team VYS — telefony podle regionu, e-mail a fakturační údaje.',
  alternates: { canonical: '/kontakty' },
  openGraph: {
    title: 'Kontakty · Team VYS',
    description: 'Kontakt na parkour klub Team VYS — telefony podle regionu, e-mail a fakturační údaje.',
    url: '/kontakty',
    type: 'website',
    locale: 'cs_CZ',
    images: [{ url: '/cats/parkour.png', alt: 'Team VYS — kontakty' }],
  },
};

export default function ContactsPage() {
  return (
    <div className="bg-[#0B0B10] text-white">
      <PageHero
        eyebrow="Kontakty"
        title="Ozvi se nám"
        accent="nám"
        media={
          // Telefonující maskot: Safari bere HEVC s alfou (.mov přes video/quicktime,
          // Chrome/Firefox ho přeskočí), ostatní VP9 webm s průhledností.
          <video
            autoPlay
            muted
            loop
            playsInline
            poster="/kocka-telefon-poster.webp"
            // translate-y: posledních pár řádků videa je jen měkké doznívání alfy.
            // Posun o 1,5 % vlastní výšky je schová pod hranu sekce (ta má overflow-hidden),
            // takže kočka dosedá na černou bez jakékoliv mezery — v každé velikosti.
            className="h-40 w-auto translate-y-[1.5%] select-none sm:h-56 md:h-80"
          >
            <source src="/kocka-telefon.mov" type="video/quicktime" />
            <source src="/kocka-telefon.webm" type="video/webm" />
          </video>
        }
      />

      {/* Tři linky podle regionu — každé město má svého člověka. */}
      <ContactLines lines={phoneLines.map((line) => ({ number: line.number, label: line.label }))} />

      <ContactMail email={contacts.email} />

      <ContactCompany
        rows={[
          { label: 'Firma', value: 'Team VYS s.r.o.' },
          { label: 'IČO', value: contacts.ico },
          { label: 'DIČ', value: `CZ${contacts.ico}` },
          { label: 'Sídlo', value: 'Ruprechtov 198, 683 04 Ruprechtov' },
          ...(contacts.bank ? [{ label: 'Účet', value: contacts.bank }] : []),
        ]}
      />
    </div>
  );
}
