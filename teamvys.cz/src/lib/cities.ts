/**
 * Města pro lokální stránky `/parkour/<slug>`.
 *
 * Zdrojem pravdy jsou **produkty z adminu** (`/api/public/products`) — když
 * David založí nový kroužek, město se na webu objeví samo. Statický je tu jen
 * doprovodný text (úvodní odstavec, okolní obce), protože ten se z databáze
 * vzít nedá; město bez něj funguje dál, jen má obecnější úvod.
 */

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://server-psi-ochre-40.vercel.app';

export type CitySession = {
  venue: string;
  /** „Pondělí 17:00–18:00“ */
  when: string;
  /** Datum první lekce u kroužku, který teprve startuje. */
  startsOn?: string;
  taken: number;
  capacity: number;
};

export type City = {
  slug: string;
  name: string;
  /** Tvar do věty „parkour kroužek ve Vyškově“ — s předložkou. */
  inCity: string;
  region?: string;
  intro: string;
  nearby: string[];
  street?: string;
  sessions: CitySession[];
  priceFrom: number;
  priceTo: number;
};

type PublicProduct = {
  id: string;
  type?: string | null;
  city?: string | null;
  venue?: string | null;
  place?: string | null;
  primary_meta?: string | null;
  price?: number | null;
  event_date?: string | null;
  capacity_total?: number | null;
  capacity_current?: number | null;
  interest_mode?: boolean | null;
  is_published?: boolean | null;
};

/**
 * Ručně psané doplňky k městům. Klíč je slug odvozený z názvu města.
 * Město, které tu chybí, se na webu přesto objeví — jen s obecným úvodem.
 */
const CITY_COPY: Record<string, { inCity?: string; intro?: string; nearby?: string[]; street?: string; name?: string }> = {
  vyskov: {
    inCity: 've Vyškově',
    intro:
      'Ve Vyškově trénujeme na dvou základních školách, takže si můžete vybrat termín, který sedí k rozvrhu družiny. Je to naše domovské město — vedle kroužků tu děláme i příměstské tábory.',
    nearby: ['Rousínov', 'Slavkov u Brna', 'Bučovice', 'Drnovice', 'Ruprechtov'],
  },
  prostejov: {
    inCity: 'v Prostějově',
    intro:
      'V Prostějově trénujeme v sobotu dopoledne, takže kroužek nekoliduje s odpoledními aktivitami ani s družinou. Máme dvě skupiny — v té pozdější bývá víc místa.',
    nearby: ['Olomouc', 'Kostelec na Hané', 'Plumlov', 'Němčice nad Hanou'],
  },
  blansko: {
    inCity: 'v Blansku',
    intro:
      'Blanenský kroužek běží v úterý podvečer na ZŠ Erbenova. Hodí se i dětem, které po škole chodí do družiny — začínáme až v 17:30.',
    nearby: ['Boskovice', 'Adamov', 'Rájec-Jestřebí', 'Jedovnice', 'Brno-sever'],
  },
  brandys: {
    name: 'Brandýs nad Labem',
    inCity: 'v Brandýse nad Labem',
    intro:
      'V Brandýse máme dva termíny ve stejné tělocvičně — úterý bývá plnější, ve čtvrtek je klidnější skupina a víc prostoru na jednotlivce.',
    nearby: ['Stará Boleslav', 'Čelákovice', 'Neratovice', 'Lysá nad Labem', 'Praha-východ'],
  },
  jesenik: {
    inCity: 'v Jeseníku',
    intro:
      'V Jeseníku trénujeme v pátek večer v tělocvičně gymnázia. Je to zavedená skupina, kam jezdí děti i z okolních obcí.',
    nearby: ['Česká Ves', 'Lipová-lázně', 'Mikulovice', 'Zlaté Hory', 'Písečná'],
  },
  vrsovice: {
    name: 'Praha — Vršovice',
    inCity: 'v Praze ve Vršovicích',
    street: 'Vršovické náměstí 111/2, 101 00 Praha 10',
    intro:
      'V Praze trénujeme v sokolovně na Vršovickém náměstí, v sobotu odpoledne. Dva navazující termíny — ve druhém bývá nejvíc volného místa.',
    nearby: ['Praha 10', 'Praha 2', 'Praha 4', 'Vinohrady', 'Strašnice', 'Michle'],
  },
  zdimerice: {
    name: 'Jesenice — Zdiměřice',
    inCity: 'v Jesenici u Prahy',
    street: 'Hrnčířská 500, 252 42 Jesenice',
    intro:
      'Kroužek pro Jesenici a okolí běží na ZŠ Zdiměřice v pátek odpoledne. Dva termíny hned po sobě — ten pozdější bývá volnější, takže tam má dítě trenéra skoro pro sebe.',
    nearby: ['Průhonice', 'Vestec', 'Dolní Břežany', 'Praha-Zbraslav', 'Psáry'],
  },
  sumperk: {
    inCity: 'v Šumperku',
    street: 'Sluneční 38, 787 01 Šumperk',
    intro:
      'V Šumperku otevíráme nový kroužek — trénovat budeme ve specializované gymnastické tělocvičně ZŠ Sluneční, která má molitanové jámy a gymnastické nářadí. Pro parkour je to jedno z nejlepších zázemí v kraji.',
    nearby: ['Zábřeh', 'Bludov', 'Rapotín', 'Hanušovice', 'Mohelnice'],
  },
  pisecna: {
    inCity: 'v Písečné u Jeseníku',
    street: 'Písečná 76, 790 82 Písečná',
    intro:
      'V Písečné otevíráme nový kroužek přímo v tělocvičně místní školy, takže děti nemusí nikam dojíždět. Začínáme ve středu odpoledne hned po vyučování.',
    nearby: ['Jeseník', 'Česká Ves', 'Mikulovice', 'Supíkovice'],
  },
};

/** „Brandýs nad Labem“ → „brandys-nad-labem“ */
export function citySlug(city: string): string {
  return city
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Předložka pro město, které nemá ručně psaný tvar. */
function guessInCity(name: string): string {
  const first = name.trim()[0]?.toLowerCase() ?? '';
  return `${'vfw'.includes(first) ? 've' : 'v'} ${name}`;
}

/** „Pondělí 17:00 - 18:00“ → „Pondělí 17:00–18:00“ */
function tidySchedule(meta: string): string {
  return meta.replace(/\s*-\s*/g, '–').trim();
}

/** „2.11.2026“ → „2. listopadu 2026“ */
function czechDate(raw: string): string {
  const months = ['ledna','února','března','dubna','května','června','července','srpna','září','října','listopadu','prosince'];
  const m = raw.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (!m) return raw;
  const [, d, mo, y] = m;
  return `${Number(d)}. ${months[Number(mo) - 1] ?? ''} ${y}`.replace(/\s+/g, ' ').trim();
}

async function fetchPublicProducts(): Promise<PublicProduct[]> {
  try {
    const res = await fetch(`${apiUrl}/api/public/products`, { next: { revalidate: 1800 } });
    if (!res.ok) return [];
    const payload = (await res.json()) as { products?: PublicProduct[] };
    return payload.products ?? [];
  } catch {
    return [];
  }
}

/**
 * Města s aktivním kroužkem, postavená z produktů v adminu.
 * Termíny ve stavu „sběr zájmu“ (`interest_mode`) se nenabízejí — nejsou to
 * reálné lekce a nesmí se objevit jako termín pro rodiče.
 */
export async function loadCities(): Promise<City[]> {
  const products = await fetchPublicProducts();
  const courses = products.filter(
    (p) => p.type === 'Kroužek' && p.is_published !== false && !p.interest_mode && p.city,
  );

  const byCity = new Map<string, PublicProduct[]>();
  for (const course of courses) {
    const slug = citySlug(String(course.city));
    if (!slug) continue;
    byCity.set(slug, [...(byCity.get(slug) ?? []), course]);
  }

  const cities: City[] = [];
  for (const [slug, rows] of byCity) {
    const copy = CITY_COPY[slug] ?? {};
    const rawName = String(rows[0].city);
    const name = copy.name ?? rawName;

    // Jeden termín může mít dvě varianty permanentky (10 a 15 vstupů) —
    // pro rodiče je to jedna lekce, takže je slučujeme podle místa a času.
    const seen = new Map<string, CitySession>();
    for (const row of rows) {
      const venue = row.venue ?? rawName;
      const when = tidySchedule(row.primary_meta ?? '');
      if (!when) continue;
      const key = `${venue}|${when}`;
      if (seen.has(key)) continue;
      seen.set(key, {
        venue,
        when,
        startsOn: row.event_date ? czechDate(row.event_date) : undefined,
        taken: Math.max(0, Number(row.capacity_current ?? 0)),
        capacity: Math.max(0, Number(row.capacity_total ?? 0)),
      });
    }
    const sessions = [...seen.values()];
    if (!sessions.length) continue;

    const prices = rows.map((r) => Number(r.price ?? 0)).filter((n) => n > 0);

    cities.push({
      slug,
      name,
      inCity: copy.inCity ?? guessInCity(name),
      intro:
        copy.intro ??
        `Parkourový kroužek Team VYS ${copy.inCity ?? guessInCity(name)} vedou certifikovaní trenéři. Učíme děti od 6 do 14 let bezpečné dopady a triky krok za krokem — na zkušenostech nezáleží.`,
      nearby: copy.nearby ?? [],
      street: copy.street,
      sessions,
      priceFrom: prices.length ? Math.min(...prices) : 2190,
      priceTo: prices.length ? Math.max(...prices) : 3190,
    });
  }

  return cities.sort((a, b) => a.name.localeCompare(b.name, 'cs'));
}

export async function loadCity(slug: string): Promise<City | undefined> {
  return (await loadCities()).find((c) => c.slug === slug);
}

/** Volná místa napříč termíny jednoho města. */
export function freeSpots(city: City): number {
  return city.sessions.reduce((sum, s) => sum + Math.max(0, s.capacity - s.taken), 0);
}
