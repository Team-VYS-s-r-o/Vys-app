import { camps, courses, workshops } from '@shared/content';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://server-psi-ochre-40.vercel.app';

export type WebProduct = {
  id: string;
  type: 'Kroužek' | 'Tábor' | 'Workshop';
  title: string;
  place: string;
  priceLabel: string;
  priceAmount: number;
  meta: string;
  description: string;
};

type PublicProductRow = {
  id: string;
  type: string;
  title?: string | null;
  city?: string | null;
  place?: string | null;
  venue?: string | null;
  price?: number | null;
  price_label?: string | null;
  primary_meta?: string | null;
  secondary_meta?: string | null;
  description?: string | null;
  event_date?: string | null;
  expires_at?: string | null;
};

export async function findWebProduct(productId: string): Promise<WebProduct | null> {
  const liveProduct = await findLiveWebProduct(productId);
  if (liveProduct) return liveProduct;
  return findStaticWebProduct(productId);
}

async function findLiveWebProduct(productId: string): Promise<WebProduct | null> {
  try {
    const response = await fetch(`${apiUrl}/api/public/products`, { cache: 'no-store' });
    if (!response.ok) return null;
    const payload = await response.json() as { products?: PublicProductRow[] };
    const row = payload.products?.find((item) => item.id === productId);
    return row ? rowToWebProduct(row) : null;
  } catch {
    return null;
  }
}

function rowToWebProduct(row: PublicProductRow): WebProduct {
  const type = normalizeProductType(row.type);
  const amount = Math.max(0, Math.round(Number(row.price || 0)));

  return {
    id: row.id,
    type,
    title: text(row.title, productTypeFallbackTitle(type)),
    place: text(row.place, text(row.venue, text(row.city, 'Team VYS'))),
    priceLabel: text(row.price_label, `${amount.toLocaleString('cs-CZ')} Kč`),
    priceAmount: amount,
    meta: text(row.primary_meta, text(row.event_date, text(row.expires_at, 'Termín doplníme'))),
    description: text(row.description, text(row.secondary_meta, 'Rezervace a platba Team VYS.')),
  };
}

function normalizeProductType(value: string): WebProduct['type'] {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('tabor')) return 'Tábor';
  if (normalized.includes('workshop')) return 'Workshop';
  return 'Kroužek';
}

function productTypeFallbackTitle(type: WebProduct['type']) {
  if (type === 'Tábor') return 'Příměstský tábor';
  if (type === 'Workshop') return 'Workshop';
  return 'Kroužek';
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function findStaticWebProduct(productId: string): WebProduct | null {
  const course = courses.find((item) => item.id === productId || `${item.id}-15` === productId);
  if (course) {
    const isFifteenEntries = productId.endsWith('-15');

    return {
      id: isFifteenEntries ? `${course.id}-15` : course.id,
      type: 'Kroužek',
      title: `Kroužek ${course.city}`,
      place: course.venue,
      priceLabel: isFifteenEntries ? '15 vstupů · 3190 Kč' : course.price,
      priceAmount: isFifteenEntries ? 3190 : course.priceAmount,
      meta: `${course.day} ${course.from}-${course.to}`,
      description: isFifteenEntries
        ? 'Výhodnější permanentka s 15 vstupy, NFC docházkou, skill tree a průběžným přehledem pro rodiče.'
        : 'Permanentka s NFC docházkou, skill tree a průběžným přehledem pro rodiče.',
    };
  }

  const camp = camps.find((item) => item.id === productId);
  if (camp) {
    return {
      id: camp.id,
      type: 'Tábor',
      title: `Příměstský tábor ${camp.place}`,
      place: camp.venue,
      priceLabel: camp.price,
      priceAmount: camp.priceAmount,
      meta: camp.season,
      description: camp.highlights.join(' · '),
    };
  }

  const workshop = workshops.find((item) => item.id === productId);
  if (workshop) {
    return {
      id: workshop.id,
      type: 'Workshop',
      title: workshop.place,
      place: workshop.city,
      priceLabel: workshop.price,
      priceAmount: Number.parseInt(workshop.price, 10),
      meta: workshop.date,
      description: workshop.body,
    };
  }

  return null;
}