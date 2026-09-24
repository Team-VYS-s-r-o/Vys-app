// Public content used by the web app.

import type { AboutPillar, Camp, Contacts, Course, Stat, Testimonial, Workshop } from './types';

export const courses: Course[] = [
  { id: 'course-blansko-erbenova', city: 'Blansko', venue: 'ZŠ Erbenova', day: 'Úterý', from: '17:30', to: '18:30', price: 'od 1790 Kč', priceAmount: 1790, capacityTotal: 25, capacityCurrent: 12 },
  { id: 'course-brandys-vysluni', city: 'Brandýs', venue: 'ZŠ Na Výsluní', day: 'Úterý / Čtvrtek', from: '17:00', to: '18:00', price: 'od 1790 Kč', priceAmount: 1790, capacityTotal: 25, capacityCurrent: 18 },
  { id: 'course-jesenik-komenskeho', city: 'Jeseník', venue: 'Gymnázium Komenského', day: 'Pátek', from: '18:00', to: '19:00', price: 'od 1790 Kč', priceAmount: 1790, capacityTotal: 25, capacityCurrent: 9 },
  { id: 'course-prostejov-melantrichova', city: 'Prostějov', venue: 'ZŠ Melantrichova', day: 'Sobota', from: '10:00', to: '11:00', price: 'od 1790 Kč', priceAmount: 1790, capacityTotal: 25, capacityCurrent: 14 },
  { id: 'course-vyskov-nadrazni', city: 'Vyškov', venue: 'ZŠ Nádražní', day: 'Středa', from: '16:30', to: '17:30', price: 'od 1790 Kč', priceAmount: 1790, capacityTotal: 25, capacityCurrent: 17 },
  { id: 'course-vyskov-purkynova', city: 'Vyškov', venue: 'ZŠ Purkyňova', day: 'Pondělí', from: '15:30', to: '16:30', price: 'od 1790 Kč', priceAmount: 1790, capacityTotal: 25, capacityCurrent: 11 },
];

export const camps: Camp[] = [
  {
    id: 'camp-veliny-mlynek',
    place: 'Veliny',
    venue: 'Tábor Mlýnek',
    season: 'Léto 2026',
    price: 'Turnusy od 3300 Kč',
    priceAmount: 3300,
    capacityTotal: 30,
    capacityCurrent: 18,
    highlights: ['Termíny 20.–24. 7. a 27.–31. 7.', 'Věk 7–16 let', 'Jídlo a tričko v ceně'],
    terms: [
      { id: 't1', label: '1. turnus', dates: '20.–24. 7. 2026' },
      { id: 't2', label: '2. turnus', dates: '27.–31. 7. 2026' },
    ],
  },
  {
    id: 'camp-vyskov-orel',
    place: 'Vyškov',
    venue: 'Orel jednota Vyškov',
    season: 'Léto 2026',
    price: 'Turnusy od 3890 Kč',
    priceAmount: 3890,
    capacityTotal: 30,
    capacityCurrent: 21,
    highlights: ['Termíny 13.–17. 7. a 10.–14. 8.', 'Věk 6–14 let', 'Tělocvična, venku i v lese'],
    terms: [
      { id: 't1', label: '1. turnus', dates: '13.–17. 7. 2026' },
      { id: 't2', label: '2. turnus', dates: '10.–14. 8. 2026' },
    ],
  },
];

export const workshops: Workshop[] = [
  {
    id: 'workshop-praha-balkan',
    city: 'Praha',
    place: 'Praha · Balkan',
    date: '14. 6. 2026 · 10:00',
    price: '890 Kč',
    capacityTotal: 40,
    capacityCurrent: 26,
    body: 'Praha Balkan workshop – Tic-tac, Kong vault, Lazy vault, Butterfly kick, Tornado kick a Macaco z růžové cesty.',
  },
];

export const campIncludes: string[] = [
  'Obědy a svačiny po celý den, zdravá strava i pitný režim.',
  'Designové tričko z nové letní kolekce TeamVYS.',
  'Certifikovaní trenéři a animátoři, kteří děti opravdu baví.',
  'Bohatý program: trénink, hry, překážková dráha i kreativní výzvy.',
];

export const campSchedule = [
  { time: '08:00 – 09:00', title: 'Příchod a rozcvička', text: 'Sraz, zahřátí a příprava na den.' },
  { time: '09:00 – 12:00', title: 'Dopolední trénink', text: 'Nácvik prvků, hry a překážková dráha.' },
  { time: '12:00 – 13:30', title: 'Oběd a polední klid', text: 'Načerpání energie a odpočinek.' },
  { time: '13:30 – 16:00', title: 'Odpolední akce', text: 'Soutěže, venkovní aktivity a vyzvednutí.' },
];

export const aboutText =
  'Největší parkourová komunita v regionu. Odvaha, hlava a kamarádi po boku — bezpečně, krok za krokem.';

export const aboutPillars: AboutPillar[] = [
  {
    title: 'Bezpečně a postupně',
    body: 'Začínáme od pádů a koordinace, postupujeme k saltům a vrutům. Každý trik je nejdřív nacvičen na žíněnce a teprve potom v terénu.',
  },
  {
    title: 'Skill tree a XP',
    body: 'Každé dítě má v aplikaci vlastní cestu – sbírá XP, odemyká triky přes QR a získává barevné náramky podle úrovně.',
  },
  {
    title: 'Pro rodiče maximálně jednoduše',
    body: 'V appce vidíte platby, docházku přes NFC i progres dítěte. Všechno na jednom místě, bez papírování.',
  },
];

export const stats: Stat[] = [
  { value: '500+', label: 'aktivních dětí' },
  { value: '6', label: 'měst po Česku' },
  { value: '46', label: 'triků v skill tree' },
  { value: '8', label: 'let zkušeností' },
];

export const testimonials: Testimonial[] = [
  {
    name: 'Petra, maminka Eli (10)',
    text: 'Eliška se za půl roku nepoznala – sebevědomí, koordinace, kamarádi. A já mám konečně všechno v jedné appce.',
  },
  {
    name: 'Honza, tatínek Vojty (12)',
    text: 'Líbí se mi, že trenéři vědí, kdy přidat a kdy zpomalit. Skill tree dělá z tréninku hru.',
  },
  {
    name: 'Adam, 14 let',
    text: 'Mám doma černý náramek za Master triky. To je víc než medaile.',
  },
];

export const heroBullets = [
  'Skill tree s 46 triky a barevnými náramky',
  'NFC docházka přímo na tréninku',
  'Příměstské tábory, workshopy i open jamy',
];

export const contacts: Contacts = {
  phone: '734 167 417',
  email: 'ahoj@teamvys.cz',
  ico: '30059496',
  bank: '',
  social: ['Instagram', 'YouTube', 'Facebook', 'WhatsApp'],
  cities: ['Vyškov', 'Prostějov', 'Blansko', 'Brandýs', 'Jeseník', 'Veliny'],
};
