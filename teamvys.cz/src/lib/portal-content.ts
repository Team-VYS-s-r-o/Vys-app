import { courseGallery, courseHero } from '@/lib/photos';
import { camps, courses, workshops } from '@shared/content';

export type ActivityType = 'Krouzek' | 'Tabor' | 'Workshop';
export type PaymentStatus = 'paid' | 'due' | 'overdue';
export type DocumentStatus = 'signed' | 'draft' | 'missing';
export type CoachDppStatus = 'signed' | 'physical' | 'sent' | 'draft' | 'missing';
export type RequiredDocumentKind = 'gdpr' | 'guardian-consent' | 'health' | 'departure' | 'infection-free' | 'packing' | 'workshop-terms';

export type ParentParticipant = {
  id: string;
  firstName: string;
  lastName: string;
  claimCode: string;
  level: number;
  bracelet: string;
  braceletColor: string;
  xp: number;
  nextBraceletXp: number;
  attendanceDone: number;
  attendanceTotal: number;
  activeCourse: string;
  nextTraining: string;
  activePurchases: Array<{ type: ActivityType; title: string; status: string; trainingDays?: string[] }>;
};

export type ParentOrganization = {
  id: string;
  name: string;
  orgType: string;
  productCount: number;
};

export type ParentOrganizations = {
  joined: ParentOrganization[];
  available: Array<{ id: string; name: string; orgType: string }>;
};

export type ParentProduct = {
  id: string;
  type: ActivityType;
  title: string;
  orgId?: string;
  orgName?: string;
  city: string;
  place: string;
  venue: string;
  /** Nepovinné kontaktní údaje k tělocvičně (správce, telefon, e-mail…) */
  gymContact?: string;
  price: number;
  priceLabel: string;
  originalPrice?: number;
  entriesTotal?: number;
  capacityTotal: number;
  capacityCurrent: number;
  interestCount?: number;
  canPurchase?: boolean;
  primaryMeta: string;
  secondaryMeta: string;
  description: string;
  badge: string;
  heroImage: string;
  gallery: string[];
  mapQuery?: string;
  latitude?: number;
  longitude?: number;
  coachIds?: string[];
  importantInfo: Array<{ label: string; value: string }>;
  trainingFocus: string[];
  skillCategory?: string;
};

export type RequiredDocumentTemplate = {
  kind: RequiredDocumentKind;
  title: string;
  description: string;
  requiredFor: ActivityType[];
  /** Document is NOT filled online — must be brought physically on the first day */
  physicalOnly?: boolean;
  /** Extra note shown to parent (e.g. date rule) */
  physicalNote?: string;
  /** Download URL for a PDF template */
  pdfUrl?: string;
};

export type ParentPayment = {
  id: string;
  title: string;
  participantName: string;
  amount: number;
  dueDate: string;
  paidAt: string;
  method: string;
  status: PaymentStatus;
  trainingDays?: string[];
};

export type ParentDocument = {
  id: string;
  participantName: string;
  activityTitle: string;
  activityType: ActivityType;
  title: string;
  status: DocumentStatus;
  updatedAt: string;
};

export type AdminCoachSummary = {
  id: string;
  name: string;
  email: string;
  phone: string;
  bankAccount: string;
  iban?: string;
  payoutAccountHolder?: string;
  payoutNote?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'suspended';
  status: 'Aktivni' | 'Ceka na klic' | 'Pozastaveny';
  level: number;
  xp: number;
  locations: string[];
  loggedHours: number;
  baseAmount: number;
  approvedBonuses: number;
  pendingBonuses: number;
  nextPayout: string;
  lastAttendance: string;
  childrenLogged: number;
  qrTricksApproved: number;
  profilePhotoUrl?: string;
  stripeAccountId?: string;
};

export type AdminCoachAccessRequest = {
  id: string;
  coachId?: string;
  name: string;
  email: string;
  phone: string;
  requestedLocation: string;
  requestedAt: string;
  note: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'suspended';
};

export type ParentProductTrainer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  locations: string[];
  qrTricksApproved: number;
  profilePhotoUrl: string;
};

export type AdminCoachDppDocument = {
  id: string;
  coachId: string;
  coachName: string;
  title: string;
  status: CoachDppStatus;
  validFrom: string;
  validTo: string;
  hourlyRate: number;
  role: string;
  workplace: string;
  scope: string;
  digitalEnvelopeId?: string;
  signedAt?: string;
  updatedAt: string;
  clauses: string[];
};

export type SharedTrainingSlot = {
  id: string;
  activityType: ActivityType;
  day: string;
  time: string;
  place: string;
  group: string;
  regularCoachId: string;
  regularCoachName: string;
  assignedCoachId?: string;
  assignedCoachName?: string;
  secondCoachId?: string;
  secondCoachName?: string;
  releasedBy?: string;
  releaseReason?: string;
  updatedAt: string;
};

export type WorkshopCity = 'Brno' | 'Praha' | 'Ostrava';
export type WorkshopCoachRef = { coachId: string; coachName: string };
export type WorkshopSlot = {
  id: string;
  date: string; // Saturday ISO date
  dateTo: string; // Sunday ISO date
  time: string;
  city: WorkshopCity;
  venue: string;
  coaches: WorkshopCoachRef[];
  maxCoaches: number;
  notes?: string;
  updatedAt: string;
};

export const WORKSHOP_HOURLY_RATE = 750;
export const WORKSHOP_MAX_COACHES = 4;

export type CampCoachRef = { coachId: string; coachName: string };
export type CampTurnus = {
  id: string;
  campId: string;
  campTitle: string;
  city: string;
  venue: string;
  dateFrom: string;
  dateTo: string;
  durationDays: number;
  coaches: CampCoachRef[];
  maxCoaches: number;
};

export const CAMP_DAILY_RATE = 1500;
export const CAMP_MAX_COACHES = 3;

export const campTurnusy: CampTurnus[] = [
  {
    id: 'camp-vyskov-orel-2026-t1',
    campId: 'camp-vyskov-orel',
    campTitle: 'Příměstský tábor Vyškov',
    city: 'Vyškov',
    venue: 'Orel jednota Vyškov',
    dateFrom: '2026-07-13',
    dateTo: '2026-07-17',
    durationDays: 5,
    coaches: [
      { coachId: 'coach-demo', coachName: 'Filip Trenér' },
      { coachId: 'coach-tereza', coachName: 'Tereza Novotná' },
    ],
    maxCoaches: 3,
  },
  {
    id: 'camp-vyskov-orel-2026-t2',
    campId: 'camp-vyskov-orel',
    campTitle: 'Příměstský tábor Vyškov',
    city: 'Vyškov',
    venue: 'Orel jednota Vyškov',
    dateFrom: '2026-08-10',
    dateTo: '2026-08-14',
    durationDays: 5,
    coaches: [],
    maxCoaches: 3,
  },
  {
    id: 'camp-veliny-mlynek-2026-t1',
    campId: 'camp-veliny-mlynek',
    campTitle: 'Příměstský tábor Veliny',
    city: 'Veliny',
    venue: 'Tábor Mlýnek',
    dateFrom: '2026-07-20',
    dateTo: '2026-07-24',
    durationDays: 5,
    coaches: [
      { coachId: 'coach-anna', coachName: 'Anna Králová' },
    ],
    maxCoaches: 3,
  },
  {
    id: 'camp-veliny-mlynek-2026-t2',
    campId: 'camp-veliny-mlynek',
    campTitle: 'Příměstský tábor Veliny',
    city: 'Veliny',
    venue: 'Tábor Mlýnek',
    dateFrom: '2026-07-27',
    dateTo: '2026-07-31',
    durationDays: 5,
    coaches: [
      { coachId: 'coach-marek', coachName: 'Marek Hlaváč' },
    ],
    maxCoaches: 3,
  },
];

const WORKSHOP_VENUES: Record<WorkshopCity, string[]> = {
  Brno: ['Sportovní hala Vodova', 'TJ Sokol Brno-Líšeň', 'Sportovní centrum Omega Brno'],
  Praha: ['Hala Strahov', 'TJ Sokol Vinohrady', 'Sportovní centrum Chodov Praha'],
  Ostrava: ['Hala Poruba', 'TJ Sokol Zábřeh Ostrava', 'Sportovní hala Vítkovice'],
};
const WS_CITY_CYCLE: WorkshopCity[] = ['Brno', 'Praha', 'Ostrava'];
const WS_SEEDED: Record<string, { coaches: WorkshopCoachRef[]; notes?: string }> = {
  '2025-11-08': { coaches: [{ coachId: 'coach-demo', coachName: 'Filip Trenér' }, { coachId: 'coach-anna', coachName: 'Anna Králová' }, { coachId: 'coach-marek', coachName: 'Marek Hlaváč' }, { coachId: 'coach-tereza', coachName: 'Tereza Novotná' }] },
  '2025-11-22': { coaches: [{ coachId: 'coach-anna', coachName: 'Anna Králová' }, { coachId: 'coach-tereza', coachName: 'Tereza Novotná' }] },
  '2025-12-06': { coaches: [{ coachId: 'coach-marek', coachName: 'Marek Hlaváč' }, { coachId: 'coach-anna', coachName: 'Anna Králová' }, { coachId: 'coach-demo', coachName: 'Filip Trenér' }] },
  '2026-01-24': { coaches: [{ coachId: 'coach-demo', coachName: 'Filip Trenér' }, { coachId: 'coach-anna', coachName: 'Anna Králová' }, { coachId: 'coach-tereza', coachName: 'Tereza Novotná' }, { coachId: 'coach-marek', coachName: 'Marek Hlaváč' }] },
  '2026-02-14': { coaches: [{ coachId: 'coach-demo', coachName: 'Filip Trenér' }] },
  '2026-04-18': { coaches: [{ coachId: 'coach-anna', coachName: 'Anna Králová' }, { coachId: 'coach-tereza', coachName: 'Tereza Novotná' }], notes: 'Speciální workshopový den – junior soustředění' },
  '2026-05-09': { coaches: [{ coachId: 'coach-demo', coachName: 'Filip Trenér' }, { coachId: 'coach-marek', coachName: 'Marek Hlaváč' }, { coachId: 'coach-anna', coachName: 'Anna Králová' }, { coachId: 'coach-tereza', coachName: 'Tereza Novotná' }] },
  '2026-06-06': { coaches: [{ coachId: 'coach-demo', coachName: 'Filip Trenér' }, { coachId: 'coach-anna', coachName: 'Anna Králová' }] },
};
function generateWeekendWorkshopSlots(): WorkshopSlot[] {
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const slots: WorkshopSlot[] = [];
  const cur = new Date(2025, 9, 1);
  const end = new Date(2026, 5, 30);
  let idx = 0;
  while (cur <= end) {
    if (cur.getDay() === 6) { // Saturdays only — workshop is the whole weekend
      const dateStr = fmt(cur);
      const sun = new Date(cur); sun.setDate(sun.getDate() + 1);
      const dateToStr = fmt(sun);
      const city = WS_CITY_CYCLE[idx % 3];
      const venueList = WORKSHOP_VENUES[city];
      const venue = venueList[Math.floor(idx / 3) % venueList.length];
      const seeded = WS_SEEDED[dateStr];
      slots.push({ id: `ws-${city.toLowerCase()}-${dateStr}`, date: dateStr, dateTo: dateToStr, time: '13:00 - 17:00', city, venue, coaches: seeded?.coaches ?? [], maxCoaches: 4, notes: seeded?.notes, updatedAt: seeded ? dateStr.split('-').reverse().join('.') : '' });
      idx++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return slots;
}
export const workshopCalendar = generateWeekendWorkshopSlots();

export const requiredDocumentTemplates: RequiredDocumentTemplate[] = [
  { kind: 'gdpr', title: 'GDPR souhlas', description: 'Souhlas se zpracováním osobních údajů dítěte a zákonného zástupce.', requiredFor: ['Krouzek', 'Tabor', 'Workshop'] },
  { kind: 'guardian-consent', title: 'Souhlas zákonného zástupce', description: 'Potvrzení účasti na aktivitě, pravidel organizátora a odpovědné osoby.', requiredFor: ['Krouzek', 'Tabor'] },
  { kind: 'health', title: 'Zdravotní prohlášení', description: 'Alergie, léky, omezení a potvrzení zdravotní způsobilosti dítěte.', requiredFor: ['Krouzek', 'Tabor', 'Workshop'] },
  { kind: 'departure', title: 'Samostatný odchod dítěte', description: 'Souhlas rodiče, že dítě může po skončení aktivity odejít samo bez vyzvednutí.', requiredFor: ['Krouzek', 'Tabor'] },
  { kind: 'infection-free', title: 'Prohlášení o bezinfekčnosti', description: 'Čestné prohlášení, které přinesete první den tábora. Neplní se online.', requiredFor: ['Tabor'], physicalOnly: true, physicalNote: 'Na dokumentu musí být datum dne odjezdu (max. 1 den předem). Starší datum je neplatné.', pdfUrl: '/bezinfekcnost-vzor.html' },
  { kind: 'packing', title: 'Věci s sebou', description: 'Potvrzení výbavy, léků, kartičky pojišťovny a táborových pokynů.', requiredFor: ['Tabor'] },
  { kind: 'workshop-terms', title: 'Přihláška a podmínky', description: 'Souhlas zákonného zástupce s fyzicky náročnou aktivitou, souhlas s focením a natáčením a storno podmínky organizátora.', requiredFor: ['Workshop'] },
];

export type AdminActivityRow = {
  id: string;
  type: ActivityType;
  title: string;
  place: string;
  capacityTotal: number;
  registered: number;
  visits: number;
  revenue: number;
  pendingRevenue: number;
  documentsMissing: number;
};

export type AdminProductTemplate = {
  type: ActivityType;
  title: string;
  description: string;
  defaults: Array<{ label: string; value: string }>;
  checklist: string[];
};

export const parentProfile = {
  name: 'Testovací rodič',
  email: 'rodic@example.cz',
  phone: '+420 000 000 000',
};

export const linkedParticipants: ParentParticipant[] = [
  {
    id: 'demo-child-1',
    firstName: 'Eliška',
    lastName: 'Nováková',
    claimCode: 'ABCD-1234',
    level: 7,
    bracelet: 'Růžová',
    braceletColor: '#F5A7C8',
    xp: 920,
    nextBraceletXp: 1400,
    attendanceDone: 14,
    attendanceTotal: 16,
    activeCourse: 'Vyškov · ZŠ Nádražní',
    nextTraining: 'Středa 16:30',
    activePurchases: [
      { type: 'Krouzek', title: 'Permanentka 10 vstupů · Vyškov', status: 'Aktivní' },
      { type: 'Tabor', title: 'Příměstský tábor Vyškov · 1. turnus', status: 'Zaplaceno' },
    ],
  },
  {
    id: 'demo-child-2',
    firstName: 'Alex',
    lastName: 'Svoboda',
    claimCode: 'WXYZ-5678',
    level: 4,
    bracelet: 'Béžová',
    braceletColor: '#D8C2A3',
    xp: 570,
    nextBraceletXp: 600,
    attendanceDone: 7,
    attendanceTotal: 10,
    activeCourse: 'Prostějov · ZŠ Melantrichova',
    nextTraining: 'Sobota 10:00',
    activePurchases: [],
  },
];

export const parentProducts: ParentProduct[] = [
  ...courses.flatMap((course) => [
    {
      id: course.id,
      type: 'Krouzek' as const,
      title: `Kroužek ${course.city}`,
      city: course.city,
      place: `${course.city} · ${course.venue}`,
      venue: course.venue,
      price: course.priceAmount,
      priceLabel: `10 vstupů · ${course.priceAmount} Kč`,
      entriesTotal: 10,
      capacityTotal: course.capacityTotal,
      capacityCurrent: course.capacityCurrent,
      primaryMeta: `${course.day} ${course.from}-${course.to}`,
      secondaryMeta: 'Digitální permanentka přes NFC čip',
      description: 'Pravidelný parkour trénink s metodickým postupem od dopadů přes přeskoky až po flow. Docházka se odečítá přes NFC čip a rodič vidí progres i historii vstupů.',
      badge: 'Kroužek',
      heroImage: courseHero[course.id] ?? '/courses/prostejov_Prostejov_parkour_main.webp',
      gallery: courseGallery[course.id] ?? [],
      importantInfo: [
        { label: 'Permanentka', value: '10 vstupů na vybranou lokalitu' },
        { label: 'Docházka', value: 'Odečítání přes NFC čip při příchodu' },
        { label: 'Kapacita', value: `${course.capacityCurrent}/${course.capacityTotal} dětí aktuálně přihlášeno` },
      ],
      trainingFocus: ['bezpečné dopady', 'přeskoky', 'koordinace', 'skill tree a QR triky'],
    },
    {
      id: `${course.id}-15`,
      type: 'Krouzek' as const,
      title: `Kroužek ${course.city}`,
      city: course.city,
      place: `${course.city} · ${course.venue}`,
      venue: course.venue,
      price: 2590,
      priceLabel: '15 vstupů · 2590 Kč',
      originalPrice: course.priceAmount ? course.priceAmount + Math.round(course.priceAmount / 2) : undefined,
      entriesTotal: 15,
      capacityTotal: course.capacityTotal,
      capacityCurrent: course.capacityCurrent,
      primaryMeta: `${course.day} ${course.from}-${course.to}`,
      secondaryMeta: 'Výhodnější digitální permanentka',
      description: 'Výhodnější permanentka pro dítě, které chodí pravidelně. Stejná lokalita, stejní trenéři, více vstupů a přehled v rodičovském portálu.',
      badge: 'Kroužek',
      heroImage: courseHero[course.id] ?? '/courses/prostejov_Prostejov_parkour_main.webp',
      gallery: courseGallery[course.id] ?? [],
      importantInfo: [
        { label: 'Permanentka', value: '15 vstupů na vybranou lokalitu' },
        { label: 'Výhoda', value: 'Lepší cena za vstup pro pravidelnou docházku' },
        { label: 'Kapacita', value: `${course.capacityCurrent}/${course.capacityTotal} dětí aktuálně přihlášeno` },
      ],
      trainingFocus: ['pravidelný progres', 'přeskoky', 'flow', 'QR potvrzení triků'],
    },
  ]),
  ...camps.flatMap((camp) => {
    const terms = camp.terms ?? [{ id: 't1', label: camp.season, dates: camp.season }];
    return terms.map((term) => ({
      id: `${camp.id}-${term.id}`,
      type: 'Tabor' as const,
      title: `Příměstský tábor ${camp.place}`,
      city: camp.place,
      place: `${camp.place} · ${camp.venue}`,
      venue: camp.venue,
      price: camp.priceAmount,
      priceLabel: camp.price,
      capacityTotal: camp.capacityTotal,
      capacityCurrent: Math.ceil(camp.capacityCurrent / terms.length),
      primaryMeta: `${term.label} · ${term.dates}`,
      secondaryMeta: 'Jídlo a tričko v ceně',
      description: `Týden pohybu, her a parkouru v lokalitě ${camp.place}. Tábor má denní režim, trenérský dohled a dokumenty pro rodiče. První den stačí přijít a nahlásit jméno.`,
      badge: 'Táborový turnus',
      heroImage: camp.place === 'Vyškov' ? '/courses/nadrazka_ZS-Nadrazka-Foto3.webp' : '/courses/brandys_BR4.webp',
      gallery: camp.place === 'Vyškov' ? ['/courses/nadrazka_ZS-Nadrazka-Foto3.webp', '/courses/nadrazka_ZS-Nadrazka-Foto1.webp', '/courses/nadrazka_ZS-Nadrazka-Foto2.webp'] : ['/courses/brandys_BR4.webp', '/courses/brandys_BR5.webp', '/courses/brandys_BR6.webp'],
      importantInfo: [
        { label: 'Turnus', value: `${term.label} · ${term.dates}` },
        { label: 'Dokumenty', value: 'GDPR, souhlas, anamnéza, bezinfekčnost, vyzvedávání a věci s sebou' },
        { label: 'Nástup', value: '1. den nahlaste jméno u vstupu — trenér zkontroluje přihlášku v systému' },
        { label: 'V ceně', value: 'jídlo, pitný režim a táborové tričko' },
      ],
      trainingFocus: ['parkour základy', 'týmové hry', 'venkovní výzvy', 'bezpečný režim dne'],
    }));
  }),
  ...workshops.map((workshop) => ({
    id: workshop.id,
    type: 'Workshop' as const,
    title: workshop.place,
    city: workshop.city,
    place: workshop.place,
    venue: workshop.place,
    price: Number.parseInt(workshop.price, 10),
    priceLabel: workshop.price,
    capacityTotal: workshop.capacityTotal,
    capacityCurrent: workshop.capacityCurrent,
    primaryMeta: workshop.date,
    secondaryMeta: 'QR ticket po zaplacení',
    description: `${workshop.body} Workshop je jednorázový, intenzivní a rodič po zaplacení dostane QR ticket pro kontrolu na místě.`,
    badge: 'Workshop',
    heroImage: '/courses/brandys_BR2.webp',
    gallery: ['/courses/brandys_BR2.webp', '/courses/brandys_BR3.webp', '/courses/brandys_BR4.webp'],
    importantInfo: [
      { label: 'Ticket', value: 'QR ticket po zaplacení' },
      { label: 'Platnost', value: 'Pouze pro uvedený termín workshopu' },
      { label: 'Zaměření', value: 'Konkrétní triky, flow a bezpečný progres' },
    ],
    trainingFocus: ['tic-tac', 'kong vault', 'lazy vault', 'butterfly kick', 'macaco'],
  })),
];

export const parentPayments: ParentPayment[] = [
  { id: 'pay-course-1', title: 'Permanentka 10 vstupů · Vyškov', participantName: 'Eliška Nováková', amount: 1790, dueDate: '24. 4. 2026', paidAt: '24. 4. 2026', method: 'Stripe karta', status: 'paid' },
  { id: 'pay-camp-1', title: 'Letní tábor Vyškov', participantName: 'Eliška Nováková', amount: 3890, dueDate: '25. 4. 2026', paidAt: '25. 4. 2026', method: 'Stripe karta', status: 'paid' },
  { id: 'pay-course-2', title: 'Permanentka 10 vstupů · Prostějov', participantName: 'Alex Svoboda', amount: 1790, dueDate: '27. 4. 2026', paidAt: '27. 4. 2026', method: 'Stripe karta', status: 'paid' },
];

export const parentNotifications = [
  { id: 'note-1', text: 'Eliška dorazila na kroužek Vyškov · ZŠ Nádražní.', createdAt: '24. 4. 2026', method: '16:34' },
  { id: 'note-2', text: 'Alex dorazil na kroužek Prostějov · ZŠ Melantrichova.', createdAt: '27. 4. 2026', method: '10:06' },
];

export const parentDigitalPasses = [
  { id: 'pass-1', participantId: 'demo-child-1', title: 'Permanentka 10 vstupů · Vyškov', location: 'Vyškov · ZŠ Nádražní', usedEntries: 6, totalEntries: 10, nfcChipId: 'NFC-VYS-0142', lastScanAt: '24. 4. 2026 · 16:34' },
  { id: 'pass-2', participantId: 'demo-child-2', title: 'Permanentka 10 vstupů · Prostějov', location: 'Prostějov · ZŠ Melantrichova', usedEntries: 2, totalEntries: 10, nfcChipId: 'NFC-PV-0098', lastScanAt: '27. 4. 2026 · 10:06' },
];

export const parentAttendanceHistory = [
  { id: 'att-1', participantName: 'Eliška Nováková', date: '24. 4. 2026', location: 'Vyškov · ZŠ Nádražní', time: '16:34', method: 'NFC' },
  { id: 'att-2', participantName: 'Eliška Nováková', date: '17. 4. 2026', location: 'Vyškov · ZŠ Nádražní', time: '16:31', method: 'NFC' },
  { id: 'att-3', participantName: 'Alex Svoboda', date: '27. 4. 2026', location: 'Prostějov · ZŠ Melantrichova', time: '10:06', method: 'NFC' },
];

export const parentDocuments: ParentDocument[] = [
  { id: 'doc-course-gdpr', participantName: 'Eliška Nováková', activityTitle: 'Permanentka 10 vstupů · Vyškov', activityType: 'Krouzek', title: 'GDPR souhlas', status: 'signed', updatedAt: '24. 4. 2026' },
  { id: 'doc-course-health', participantName: 'Eliška Nováková', activityTitle: 'Permanentka 10 vstupů · Vyškov', activityType: 'Krouzek', title: 'Zdravotní informace', status: 'signed', updatedAt: '24. 4. 2026' },
  { id: 'doc-camp-gdpr', participantName: 'Eliška Nováková', activityTitle: 'Příměstský tábor Vyškov', activityType: 'Tabor', title: 'GDPR souhlas', status: 'signed', updatedAt: '25. 4. 2026' },
];

export const reviewableCoaches = [
  { id: 'coach-demo', name: 'Filip Trenér', locations: ['Vyškov · ZŠ Nádražní'] },
  { id: 'coach-marek', name: 'Marek Hlaváč', locations: ['Blansko · ZŠ Erbenova'] },
  { id: 'coach-anna', name: 'Anna Králová', locations: ['Brandýs · ZŠ Na Výsluní'] },
];

export const coachReviews = [
  { id: 'review-1', coachId: 'coach-demo', coachName: 'Filip Trenér', parentName: 'Testovací rodič', participantName: 'Eliška Nováková', rating: 5, comment: 'Bezpečný přístup a dobrá komunikace po tréninku.', createdAt: '28. 4. 2026' },
];

export const adminCoachSummaries: AdminCoachSummary[] = [
  { id: 'coach-demo', name: 'Filip Trenér', email: 'filip@teamvys.cz', phone: '+420 605 324 417', bankAccount: '2902345671/2010', iban: 'CZ65 2010 0000 0029 0234 5671', status: 'Aktivni', level: 5, xp: 1840, locations: ['Vyskov · ZS Nadrazni', 'Vyskov · ZS Purkynova', 'Prostejov · ZS Melantrichova'], loggedHours: 3, baseAmount: 1500, approvedBonuses: 600, pendingBonuses: 0, nextPayout: '15. 5. 2026', lastAttendance: '24. 4. 2026', childrenLogged: 22, qrTricksApproved: 184, profilePhotoUrl: '/vys-logo-mark.png', stripeAccountId: 'acct_demo_filip' },
  { id: 'coach-marek', name: 'Marek Hlaváč', email: 'marek@teamvys.cz', phone: '+420 777 904 118', bankAccount: '2201849034/5500', iban: 'CZ28 5500 0000 0022 0184 9034', status: 'Aktivni', level: 4, xp: 1260, locations: ['Blansko · ZS Erbenova', 'Jesenik · Gymnazium Komenskeho'], loggedHours: 7.5, baseAmount: 3750, approvedBonuses: 1000, pendingBonuses: 0, nextPayout: '15. 5. 2026', lastAttendance: '29. 4. 2026', childrenLogged: 38, qrTricksApproved: 126, profilePhotoUrl: '/vys-logo-mark.png' },
  { id: 'coach-anna', name: 'Anna Králová', email: 'anna@teamvys.cz', phone: '+420 775 441 903', bankAccount: '2500441903/0800', iban: 'CZ40 0800 0000 0025 0044 1903', status: 'Aktivni', level: 3, xp: 970, locations: ['Brandys · ZS Na Vysluni', 'Praha · Balkan'], loggedHours: 5, baseAmount: 2500, approvedBonuses: 300, pendingBonuses: 0, nextPayout: '15. 5. 2026', lastAttendance: '28. 4. 2026', childrenLogged: 24, qrTricksApproved: 97, profilePhotoUrl: '/vys-logo-mark.png' },
  { id: 'coach-tereza', name: 'Tereza Novotná', email: 'tereza@teamvys.cz', phone: '+420 733 210 665', bankAccount: '2107330665/2700', iban: 'CZ41 2700 0000 0021 0733 0665', status: 'Ceka na klic', level: 1, xp: 0, locations: ['Vyskov · Orel jednota Vyskov', 'Veliny · Tabor Mlynek'], loggedHours: 0, baseAmount: 0, approvedBonuses: 0, pendingBonuses: 0, nextPayout: 'Po aktivaci', lastAttendance: 'Zatim netrenovala', childrenLogged: 0, qrTricksApproved: 0, profilePhotoUrl: '/vys-logo-mark.png' },
];

export const sharedTrainingCalendar: SharedTrainingSlot[] = [
  { id: 'slot-vyskov-purkynova', activityType: 'Krouzek', day: 'Pondělí', time: '15:30 - 16:30', place: 'Vyškov · ZŠ Purkyňova', group: 'Mladší skupina', regularCoachId: 'coach-demo', regularCoachName: 'Filip Trenér', assignedCoachId: 'coach-demo', assignedCoachName: 'Filip Trenér', secondCoachId: 'coach-anna', secondCoachName: 'Anna Králová', updatedAt: 'pravidelně' },
  { id: 'slot-blansko-erbenova', activityType: 'Krouzek', day: 'Úterý', time: '17:30 - 18:30', place: 'Blansko · ZŠ Erbenova', group: 'Začátečníci', regularCoachId: 'coach-marek', regularCoachName: 'Marek Hlaváč', assignedCoachId: 'coach-marek', assignedCoachName: 'Marek Hlaváč', updatedAt: 'pravidelně' },
  { id: 'slot-brandys-vysluni', activityType: 'Krouzek', day: 'Úterý / Čtvrtek', time: '17:00 - 18:00', place: 'Brandýs · ZŠ Na Výsluní', group: 'Mix level', regularCoachId: 'coach-anna', regularCoachName: 'Anna Králová', assignedCoachId: 'coach-anna', assignedCoachName: 'Anna Králová', secondCoachId: 'coach-tereza', secondCoachName: 'Tereza Novotná', updatedAt: 'pravidelně' },
  { id: 'slot-vyskov-nadrazni', activityType: 'Krouzek', day: 'Středa', time: '16:30 - 17:30', place: 'Vyškov · ZŠ Nádražní', group: 'Začátečníci 8-12', regularCoachId: 'coach-demo', regularCoachName: 'Filip Trenér', assignedCoachId: 'coach-demo', assignedCoachName: 'Filip Trenér', secondCoachId: 'coach-marek', secondCoachName: 'Marek Hlaváč', updatedAt: 'pravidelně' },
  { id: 'slot-jesenik-komenskeho', activityType: 'Krouzek', day: 'Pátek', time: '18:00 - 19:00', place: 'Jeseník · Gymnázium Komenského', group: 'Pokročilí', regularCoachId: 'coach-marek', regularCoachName: 'Marek Hlaváč', releasedBy: 'Marek Hlaváč', releaseReason: 'Marek nahlásil, že v pátek nemůže dorazit.', updatedAt: 'dnes 09:20' },
  { id: 'slot-prostejov-melantrichova', activityType: 'Krouzek', day: 'Sobota', time: '10:00 - 11:00', place: 'Prostějov · ZŠ Melantrichova', group: 'Mix level', regularCoachId: 'coach-demo', regularCoachName: 'Filip Trenér', assignedCoachId: 'coach-demo', assignedCoachName: 'Filip Trenér', updatedAt: 'pravidelně' },
  { id: 'slot-vyskov-orel', activityType: 'Krouzek', day: 'Neděle', time: '11:00 - 12:00', place: 'Vyškov · Orel jednota Vyškov', group: 'Pokročilí', regularCoachId: 'coach-tereza', regularCoachName: 'Tereza Novotná', assignedCoachId: 'coach-tereza', assignedCoachName: 'Tereza Novotná', updatedAt: 'pravidelně' },
];

export const coachDppTemplateClauses = [
  'Trenér zajišťuje vedení parkourových lekcí, přípravu prostoru, evidenci docházky a bezpečné předání informací administrátorovi.',
  'Rozsah práce se řídí domluveným rozpisem lekcí a nepřekročí zákonný limit pro DPP v daném kalendářním roce.',
  'Odměna se počítá podle schválené hodinové sazby a potvrzené docházky v administraci TeamVYS.',
  'Trenér potvrzuje mlčenlivost o osobních údajích dětí, rodičů a interních provozních informacích.',
  'Digitální podpis trenéra a zástupce TeamVYS je považovaný za potvrzení vyplněných údajů a uložení dokumentu do evidence.',
];

export const adminCoachDppDocuments: AdminCoachDppDocument[] = [
  {
    id: 'dpp-coach-demo-2026',
    coachId: 'coach-demo',
    coachName: 'Filip Trenér',
    title: 'DPP 2026 · Filip Trenér',
    status: 'signed',
    validFrom: '1. 4. 2026',
    validTo: '31. 12. 2026',
    hourlyRate: 500,
    role: 'Trenér parkour kroužků',
    workplace: 'Vyškov · Prostějov',
    scope: 'Vedení pravidelných lekcí, evidence docházky a bezpečnostní dohled.',
    digitalEnvelopeId: 'DPP-VYS-2026-0001',
    signedAt: '1. 4. 2026 · 09:14',
    updatedAt: '1. 4. 2026',
    clauses: coachDppTemplateClauses,
  },
  {
    id: 'dpp-coach-marek-2026',
    coachId: 'coach-marek',
    coachName: 'Marek Hlaváč',
    title: 'DPP 2026 · Marek Hlaváč',
    status: 'sent',
    validFrom: '1. 4. 2026',
    validTo: '31. 12. 2026',
    hourlyRate: 500,
    role: 'Trenér parkour kroužků',
    workplace: 'Blansko · Jeseník',
    scope: 'Vedení lekcí, kontrola docházky a potvrzování QR triků.',
    digitalEnvelopeId: 'DPP-VYS-2026-0002',
    updatedAt: '28. 4. 2026',
    clauses: coachDppTemplateClauses,
  },
  {
    id: 'dpp-coach-anna-2026',
    coachId: 'coach-anna',
    coachName: 'Anna Králová',
    title: 'DPP 2026 · Anna Králová',
    status: 'draft',
    validFrom: '1. 5. 2026',
    validTo: '31. 12. 2026',
    hourlyRate: 500,
    role: 'Trenérka workshopů a kroužků',
    workplace: 'Brandýs · Praha',
    scope: 'Vedení workshopů, kroužků a kontrola digitálních ticketů.',
    updatedAt: '30. 4. 2026',
    clauses: coachDppTemplateClauses,
  },
  {
    id: 'dpp-coach-tereza-2026',
    coachId: 'coach-tereza',
    coachName: 'Tereza Novotná',
    title: 'DPP 2026 · Tereza Novotná',
    status: 'missing',
    validFrom: '1. 6. 2026',
    validTo: '31. 8. 2026',
    hourlyRate: 450,
    role: 'Asistentka příměstských táborů',
    workplace: 'Vyškov · Veliny',
    scope: 'Asistence u táborového programu, evidence příchodů a dohled u aktivit.',
    updatedAt: 'Čeká na vytvoření',
    clauses: coachDppTemplateClauses,
  },
];

export function requiredDocumentsForProduct(product: ParentProduct) {
  return requiredDocumentTemplates.filter((document) => document.requiredFor.includes(product.type));
}

export function trainersForProduct(product: ParentProduct): ParentProductTrainer[] {
  const normalizedPlace = normalizeLocation(product.place);

  return adminCoachSummaries
    .filter((coach) => coach.status === 'Aktivni' || coach.status === 'Ceka na klic')
    .filter((coach) => coach.locations.some((location) => {
      const normalizedLocation = normalizeLocation(location);
      return normalizedLocation === normalizedPlace || normalizedPlace.includes(normalizedLocation);
    }))
    .map((coach) => ({
      id: coach.id,
      name: coach.name,
      email: coach.email,
      phone: coach.phone,
      locations: coach.locations,
      qrTricksApproved: coach.qrTricksApproved,
      profilePhotoUrl: coach.profilePhotoUrl ?? '/vys-logo-mark.png',
    }));
}

function normalizeLocation(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/zs/g, 'zš')
    .replace(/tabor/g, 'tábor')
    .trim();
}

export const adminCoachAccessRequests: AdminCoachAccessRequest[] = [
  { id: 'request-tereza-vyskov', name: 'Tereza Novotna', email: 'tereza@teamvys.cz', phone: '+420 733 210 665', requestedLocation: 'Vyskov · Orel jednota Vyskov', requestedAt: '30. 4. 2026 · 09:20', note: 'Chce pomahat u primestskych taboru a pozdeji prevzit pondelni skupinu.' },
  { id: 'request-daniel-brandys', name: 'Daniel Svetlik', email: 'daniel@teamvys.cz', phone: '+420 724 511 809', requestedLocation: 'Brandys · ZS Na Vysluni', requestedAt: '29. 4. 2026 · 18:42', note: 'Doporuceni od Marka, ceka na kontrolu dokumentu a vydani klice.' },
];

export const adminProductTemplates: AdminProductTemplate[] = [
  { type: 'Krouzek', title: 'Novy krouzek / permanentka', description: 'Pravidelny tydenni krouzek s NFC permanentkou a kapacitou skupiny.', defaults: [{ label: 'Kapacita', value: '25 deti' }, { label: 'Vstupy', value: '10 nebo 15' }, { label: 'Dokumenty', value: 'GDPR, souhlas, zdravi' }], checklist: ['Mesto a telocvicna', 'Den a cas', 'Trener', 'Cena', 'Kapacita'] },
  { type: 'Workshop', title: 'Jednorazovy workshop', description: 'Workshop s QR ticketem, mistem a platnosti ticketu.', defaults: [{ label: 'Kapacita', value: '40 ucastniku' }, { label: 'Ticket', value: 'QR po zaplaceni' }, { label: 'Platnost', value: 'Do dne po akci' }], checklist: ['Datum a cas', 'Misto', 'Cena', 'Platnost QR', 'Seznam triku'] },
  { type: 'Tabor', title: 'Primestsky tabor', description: 'Taborovy turnus s dokumenty, anamnezou a prezencni listinou pro prvni den.', defaults: [{ label: 'Kapacita', value: '30 deti' }, { label: 'Dokumenty', value: 'GDPR, anamneza, bezinfekcnost' }, { label: 'Strava', value: 'Svaciny, obed, pitny rezim' }], checklist: ['Terminy', 'Adresa', 'Vek', 'Cena', 'Strava', 'Treneri'] },
];

export const adminAttendanceAdjustments = [
  { id: 'adjust-1', coachName: 'Filip Trener', sessionTitle: 'Vyskov · ZS Nadrazni', date: '30. 4. 2026', present: '12/14', durationHours: 1, amount: 500, reason: 'Doplneno administratorem podle prezencni listiny.' },
];

export const adminCoachAttendance = [
  { id: 'coach-att-1', coachName: 'Filip Trener', sessionTitle: 'Vyskov · ZS Nadrazni', date: '24. 4. 2026', present: '10/14', durationHours: 1, amount: 500, reason: 'Standardni zapis trenera.' },
  { id: 'coach-att-2', coachName: 'Marek Hlavac', sessionTitle: 'Blansko · ZS Erbenova', date: '29. 4. 2026', present: '13/15', durationHours: 1.5, amount: 750, reason: 'Standardni zapis trenera.' },
];

export const adminIssuedCoachKeys = [
  { id: 'key-1', code: 'VYS-MAREK-4821', coachName: 'Marek Hlavac', email: 'marek@teamvys.cz', phone: '+420 777 904 118', location: 'Blansko · ZS Erbenova', status: 'Vydan', createdAt: '21. 4. 2026', note: 'Vydano po overeni adminem.' },
];

export function adminActivityRows(products: ParentProduct[] = parentProducts): AdminActivityRow[] {
  return products.map((product, index) => {
    const registered = Math.min(product.capacityTotal, Math.max(1, Math.round(product.capacityTotal * (0.32 + (index % 4) * 0.13))));
    const visits = product.type === 'Krouzek' ? registered * (4 + (index % 3)) : product.type === 'Workshop' ? registered : registered * 5;
    const revenue = registered * product.price;
    const pendingRevenue = index % 3 === 0 ? Math.round(product.price * 0.7) : 0;

    return {
      id: product.id,
      type: product.type,
      title: product.title,
      place: product.place,
      capacityTotal: product.capacityTotal,
      registered,
      visits,
      revenue,
      pendingRevenue,
      documentsMissing: product.type === 'Workshop' ? 0 : index % 4,
    };
  });
}

export function adminPaymentRows() {
  return parentPayments.map((payment) => ({
    id: payment.id,
    participantName: payment.participantName,
    title: payment.title,
    amount: payment.amount,
    status: 'Zaplaceno',
    dueDate: payment.dueDate,
  }));
}

export function currency(value: number) {
  return `${Math.round(value).toLocaleString('cs-CZ')} Kč`;
}

export function paymentStatusLabel(status: PaymentStatus) {
  if (status === 'paid') return 'Zaplaceno';
  if (status === 'overdue') return 'Nezaplaceno';
  return 'Nezaplaceno';
}

export function documentStatusLabel(status: DocumentStatus) {
  if (status === 'signed') return 'Podepsano';
  if (status === 'draft') return 'Rozpracovano';
  return 'Chybi';
}

export function activityLabel(type: ActivityType) {
  if (type === 'Krouzek') return 'Kroužek';
  if (type === 'Tabor') return 'Tábor';
  return 'Workshop';
}

export function attendancePercent(participant: ParentParticipant) {
  if (!participant.attendanceTotal) return 0;
  return Math.round((participant.attendanceDone / participant.attendanceTotal) * 100);
}

export function duePaymentsTotal() {
  return parentPayments.filter((payment) => payment.status !== 'paid').reduce((sum, payment) => sum + payment.amount, 0);
}

export function remainingEntries(pass: { usedEntries: number; totalEntries: number }) {
  return Math.max(pass.totalEntries - pass.usedEntries, 0);
}

export function documentStats() {
  const signed = parentDocuments.filter((document) => document.status === 'signed').length;
  const missing = parentDocuments.filter((document) => document.status !== 'signed').length;
  return { signed, missing, total: parentDocuments.length };
}

export type WorkshopCoachTrickCount = { coachId: string; coachName: string; count: number };
export type WorkshopAttendanceRecord = {
  slotId: string;
  attendees: number;
  participants: string[];
  coachTrickCounts: WorkshopCoachTrickCount[];
};

export const workshopAttendanceRecords: WorkshopAttendanceRecord[] = [
  {
    slotId: 'ws-ostrava-2025-11-08',
    attendees: 31,
    participants: ['Jakub N.', 'Eliška K.', 'Tomáš P.', 'Martin S.', 'Klára M.', 'Ondřej B.', 'Tereza V.', 'Michal H.', 'Adéla R.', 'Jan Č.', 'Barbora F.', 'Adam D.', 'Petra N.', 'David L.', 'Zuzana T.', 'Jiří K.', 'Veronika P.', 'Natálie O.', 'Filip S.', 'Lenka H.', 'Pavel M.', 'Anežka B.', 'Václav Č.', 'Simona R.', 'Radek K.', 'Lucie V.', 'Miroslav D.', 'Eva P.', 'Jana H.', 'Lukáš R.', 'Karolína T.'],
    coachTrickCounts: [
      { coachId: 'coach-demo', coachName: 'Filip Trenér', count: 19 },
      { coachId: 'coach-anna', coachName: 'Anna Králová', count: 15 },
      { coachId: 'coach-marek', coachName: 'Marek Hlaváč', count: 14 },
      { coachId: 'coach-tereza', coachName: 'Tereza Novotná', count: 10 },
    ],
  },
  {
    slotId: 'ws-praha-2025-11-22',
    attendees: 22,
    participants: ['Jakub N.', 'Tomáš P.', 'Klára M.', 'Tereza V.', 'Michal H.', 'Jan Č.', 'Adam D.', 'David L.', 'Jiří K.', 'Veronika P.', 'Filip S.', 'Pavel M.', 'Václav Č.', 'Radek K.', 'Lucie V.', 'Eva P.', 'Lukáš R.', 'Ondřej B.', 'Martin S.', 'Barbora F.', 'Natálie O.', 'Lenka H.'],
    coachTrickCounts: [
      { coachId: 'coach-anna', coachName: 'Anna Králová', count: 17 },
      { coachId: 'coach-tereza', coachName: 'Tereza Novotná', count: 12 },
    ],
  },
  {
    slotId: 'ws-brno-2025-12-06',
    attendees: 27,
    participants: ['Jakub N.', 'Eliška K.', 'Tomáš P.', 'Martin S.', 'Ondřej B.', 'Tereza V.', 'Jan Č.', 'Barbora F.', 'Adam D.', 'David L.', 'Jiří K.', 'Filip S.', 'Pavel M.', 'Václav Č.', 'Radek K.', 'Lucie V.', 'Eva P.', 'Jana H.', 'Lukáš R.', 'Karolína T.', 'Simona R.', 'Adéla R.', 'Natálie O.', 'Lenka H.', 'Zuzana T.', 'Michal H.', 'Petra N.'],
    coachTrickCounts: [
      { coachId: 'coach-marek', coachName: 'Marek Hlaváč', count: 16 },
      { coachId: 'coach-anna', coachName: 'Anna Králová', count: 15 },
      { coachId: 'coach-demo', coachName: 'Filip Trenér', count: 12 },
    ],
  },
  {
    slotId: 'ws-praha-2026-01-24',
    attendees: 34,
    participants: ['Jakub N.', 'Eliška K.', 'Tomáš P.', 'Martin S.', 'Klára M.', 'Ondřej B.', 'Tereza V.', 'Michal H.', 'Adéla R.', 'Jan Č.', 'Barbora F.', 'Adam D.', 'Petra N.', 'David L.', 'Zuzana T.', 'Jiří K.', 'Veronika P.', 'Natálie O.', 'Filip S.', 'Lenka H.', 'Pavel M.', 'Anežka B.', 'Václav Č.', 'Simona R.', 'Radek K.', 'Lucie V.', 'Miroslav D.', 'Eva P.', 'Jana H.', 'Lukáš R.', 'Karolína T.', 'Petr M.', 'Markéta H.', 'Josef K.'],
    coachTrickCounts: [
      { coachId: 'coach-demo', coachName: 'Filip Trenér', count: 18 },
      { coachId: 'coach-anna', coachName: 'Anna Králová', count: 16 },
      { coachId: 'coach-tereza', coachName: 'Tereza Novotná', count: 15 },
      { coachId: 'coach-marek', coachName: 'Marek Hlaváč', count: 12 },
    ],
  },
  {
    slotId: 'ws-praha-2026-02-14',
    attendees: 18,
    participants: ['Jakub N.', 'Tomáš P.', 'Klára M.', 'Tereza V.', 'Jan Č.', 'Adam D.', 'Jiří K.', 'Filip S.', 'Pavel M.', 'Václav Č.', 'Radek K.', 'Eva P.', 'Lukáš R.', 'Ondřej B.', 'Barbora F.', 'Natálie O.', 'Lenka H.', 'Zuzana T.'],
    coachTrickCounts: [
      { coachId: 'coach-demo', coachName: 'Filip Trenér', count: 22 },
    ],
  },
  {
    slotId: 'ws-praha-2026-04-18',
    attendees: 24,
    participants: ['Jakub N.', 'Eliška K.', 'Tomáš P.', 'Tereza V.', 'Michal H.', 'Jan Č.', 'Adam D.', 'David L.', 'Jiří K.', 'Veronika P.', 'Filip S.', 'Pavel M.', 'Václav Č.', 'Radek K.', 'Lucie V.', 'Eva P.', 'Lukáš R.', 'Karolína T.', 'Martin S.', 'Ondřej B.', 'Barbora F.', 'Natálie O.', 'Simona R.', 'Lenka H.'],
    coachTrickCounts: [
      { coachId: 'coach-anna', coachName: 'Anna Králová', count: 21 },
      { coachId: 'coach-tereza', coachName: 'Tereza Novotná', count: 17 },
    ],
  },
];

export type CourseEnrollment = { courseId: string; participants: Array<{ name: string; remaining: number }> };
export const courseEnrollments: CourseEnrollment[] = [
  {
    courseId: 'course-blansko-erbenova',
    participants: [
      { name: 'Jakub Nováček', remaining: 8 }, { name: 'Tereza Procházková', remaining: 5 }, { name: 'Martin Kratochvíl', remaining: 10 }, { name: 'Klára Šimáčková', remaining: 3 }, { name: 'Adam Bartoš', remaining: 7 }, { name: 'Veronika Hrubá', remaining: 9 }, { name: 'Filip Sedláček', remaining: 6 }, { name: 'Lenka Horáková', remaining: 2 }, { name: 'David Lukáš', remaining: 8 }, { name: 'Zuzana Tichá', remaining: 10 }, { name: 'Jiří Kovář', remaining: 4 }, { name: 'Natálie Obrová', remaining: 7 },
    ],
  },
  {
    courseId: 'course-brandys-vysluni',
    participants: [
      { name: 'Tomáš Polívka', remaining: 9 }, { name: 'Eliška Krejčí', remaining: 6 }, { name: 'Ondřej Bláha', remaining: 10 }, { name: 'Michal Houžvička', remaining: 4 }, { name: 'Adéla Richterová', remaining: 8 }, { name: 'Jan Čech', remaining: 7 }, { name: 'Barbora Fantová', remaining: 3 }, { name: 'Petra Navrátilová', remaining: 10 }, { name: 'Václav Čermák', remaining: 5 }, { name: 'Simona Řezáčová', remaining: 9 }, { name: 'Radek Kříž', remaining: 6 }, { name: 'Lucie Vlčková', remaining: 8 }, { name: 'Pavel Matoušek', remaining: 2 }, { name: 'Eva Procházková', remaining: 10 }, { name: 'Jana Horová', remaining: 7 }, { name: 'Lukáš Rybář', remaining: 5 }, { name: 'Karolína Tůmová', remaining: 9 }, { name: 'Petr Müller', remaining: 3 },
    ],
  },
  {
    courseId: 'course-jesenik-komenskeho',
    participants: [
      { name: 'Jakub Nováček', remaining: 7 }, { name: 'Martin Kratochvíl', remaining: 10 }, { name: 'Filip Sedláček', remaining: 5 }, { name: 'Tereza Procházková', remaining: 8 }, { name: 'Ondřej Bláha', remaining: 4 }, { name: 'Klára Šimáčková', remaining: 9 }, { name: 'Adam Bartoš', remaining: 6 }, { name: 'Lenka Horáková', remaining: 10 }, { name: 'David Lukáš', remaining: 3 },
    ],
  },
  {
    courseId: 'course-prostejov-melantrichova',
    participants: [
      { name: 'Alex Svoboda', remaining: 8 }, { name: 'Eliška Krejčí', remaining: 6 }, { name: 'Tomáš Polívka', remaining: 10 }, { name: 'Michal Houžvička', remaining: 4 }, { name: 'Barbora Fantová', remaining: 9 }, { name: 'Jan Čech', remaining: 7 }, { name: 'Jiří Kovář', remaining: 5 }, { name: 'Veronika Hrubá', remaining: 10 }, { name: 'Natálie Obrová', remaining: 3 }, { name: 'Lenka Horáková', remaining: 8 }, { name: 'Václav Čermák', remaining: 6 }, { name: 'Simona Řezáčová', remaining: 9 }, { name: 'David Lukáš', remaining: 2 }, { name: 'Adéla Richterová', remaining: 7 },
    ],
  },
  {
    courseId: 'course-vyskov-nadrazni',
    participants: [
      { name: 'Eliška Nováková', remaining: 6 }, { name: 'Jakub Nováček', remaining: 9 }, { name: 'Klára Šimáčková', remaining: 4 }, { name: 'Martin Kratochvíl', remaining: 10 }, { name: 'Tereza Procházková', remaining: 7 }, { name: 'Adam Bartoš', remaining: 5 }, { name: 'Ondřej Bláha', remaining: 8 }, { name: 'Filip Sedláček', remaining: 3 }, { name: 'Lucie Vlčková', remaining: 10 }, { name: 'Pavel Matoušek', remaining: 6 }, { name: 'Jan Čech', remaining: 9 }, { name: 'Barbora Fantová', remaining: 4 }, { name: 'Radek Kříž', remaining: 7 }, { name: 'Eva Procházková', remaining: 10 }, { name: 'Petra Navrátilová', remaining: 5 }, { name: 'Lukáš Rybář', remaining: 8 }, { name: 'Jana Horová', remaining: 2 },
    ],
  },
  {
    courseId: 'course-vyskov-purkynova',
    participants: [
      { name: 'Tomáš Polívka', remaining: 9 }, { name: 'Michal Houžvička', remaining: 5 }, { name: 'Adéla Richterová', remaining: 8 }, { name: 'Jiří Kovář', remaining: 3 }, { name: 'Veronika Hrubá', remaining: 10 }, { name: 'Simona Řezáčová', remaining: 6 }, { name: 'Václav Čermák', remaining: 9 }, { name: 'Natálie Obrová', remaining: 4 }, { name: 'Karolína Tůmová', remaining: 7 }, { name: 'David Lukáš', remaining: 10 }, { name: 'Zuzana Tichá', remaining: 5 },
    ],
  },
];