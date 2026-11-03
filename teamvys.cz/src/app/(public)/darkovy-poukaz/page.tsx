import { GiftVoucherPurchase } from '@/components/gift-voucher-purchase';
import { PageHero } from '@/components/page-hero';

export const metadata = {
  title: 'Dárkový poukaz na parkour',
  description:
    'Darujte dítěti parkour. Poukaz na permanentku do kroužku Team VYS platí v kterémkoliv našem městě — obdarovaný si sám vybere místo i termín.',
  alternates: { canonical: '/darkovy-poukaz' },
  openGraph: {
    title: 'Dárkový poukaz na parkour · Team VYS',
    description: 'Poukaz na permanentku do parkour kroužku. Přijde e-mailem k vytištění, platí ve všech našich městech.',
    url: '/darkovy-poukaz',
    type: 'website',
    locale: 'cs_CZ',
    images: [{ url: '/cats/parkour.png', alt: 'Dárkový poukaz Team VYS' }],
  },
};

const steps = [
  { title: 'Vyberete permanentku', body: 'Na 10 nebo 15 tréninků. Město se nevybírá — poukaz platí všude, kde trénujeme.' },
  { title: 'Zaplatíte kartou', body: 'Poukaz vám hned dorazí e-mailem jako PDF k vytištění nebo přeposlání.' },
  { title: 'Obdarovaný zadá kód', body: 'V aplikaci si vybere město, termín i dítě a kód zadá u platby. Permanentka se připíše.' },
];

export default function GiftVoucherPage() {
  return (
    <div className="bg-[#0B0B10] text-white">
      <PageHero
        eyebrow="Dárkový poukaz"
        title="Darujte parkour"
        word="Poukaz"
        ctaHref="#koupit"
        ctaLabel="Koupit poukaz"
      />

      <section className="mx-auto w-full max-w-6xl px-5 pb-10 pt-12 md:px-8">
        <p className="max-w-2xl text-lg font-semibold leading-8 text-white/70">
          Permanentka do parkour kroužku jako dárek k Vánocům nebo narozeninám. Nemusíte vědět,
          do kterého města bude dítě chodit ani kdy začne — <span className="text-white">poukaz platí všude a bez omezení platnosti</span>.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-6">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#B23BFF]/20 text-sm font-black text-[#D9A6FF]">
                {index + 1}
              </span>
              <h2 className="mt-4 text-lg font-black">{step.title}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-white/60">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="koupit" className="mx-auto w-full max-w-6xl px-5 pb-24 md:px-8">
        <GiftVoucherPurchase />
      </section>
    </div>
  );
}
