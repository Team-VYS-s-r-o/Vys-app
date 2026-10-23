/**
 * Města, kde Team VYS vede parkour kroužky.
 *
 * Zdroj pravdy pro lokální landing stránky `/parkour/<slug>`. Údaje odpovídají
 * tabulce `products` v Supabase — když se mění rozvrh nebo přibude město,
 * aktualizuj i tenhle soubor, ať si stránka a katalog neodporují.
 *
 * `street` vyplňuj jen tam, kde je adresa ověřená; prázdná hodnota je lepší
 * než odhad, protože adresa jde do strukturovaných dat pro Google.
 */

export type CitySession = {
  /** Název tělocvičny tak, jak ho zná rodič. */
  venue: string;
  /** Den a čas, např. „Pondělí 17:00–18:00“. */
  when: string;
  /** Ulice a PSČ, pokud je ověřená. */
  street?: string;
  /** Datum první lekce u kroužků, které teprve startují. */
  startsOn?: string;
  /** Volných míst / kapacita — pro větu o obsazenosti. */
  taken?: number;
  capacity?: number;
};

export type City = {
  slug: string;
  /** Název v 1. pádě pro nadpisy: „Vyškov“. */
  name: string;
  /** Tvar do věty „parkour kroužek ve Vyškově“ — včetně předložky. */
  inCity: string;
  /** Kraj nebo region pro strukturovaná data. */
  region: string;
  /** Jedna až dvě věty, které se objeví jako úvod — pro každé město jiné. */
  intro: string;
  /** Okolní obce, odkud děti dojíždějí — pomáhá na dlouhý ocas dotazů. */
  nearby: string[];
  sessions: CitySession[];
};

export const PRICE_10 = 2190;
export const PRICE_15 = 3190;

export const CITIES: City[] = [
  {
    slug: 'vyskov',
    name: 'Vyškov',
    inCity: 've Vyškově',
    region: 'Jihomoravský kraj',
    intro:
      'Ve Vyškově trénujeme na dvou základních školách, takže si můžete vybrat termín, který sedí k rozvrhu družiny. Je to naše domovské město — vedle kroužků tu děláme i příměstské tábory.',
    nearby: ['Rousínov', 'Slavkov u Brna', 'Bučovice', 'Drnovice', 'Ruprechtov'],
    sessions: [
      { venue: 'ZŠ Purkyňova', when: 'Pondělí 15:30–16:30', taken: 14, capacity: 25 },
      { venue: 'ZŠ Nádražní', when: 'Středa 16:30–17:30', taken: 14, capacity: 25 },
    ],
  },
  {
    slug: 'prostejov',
    name: 'Prostějov',
    inCity: 'v Prostějově',
    region: 'Olomoucký kraj',
    intro:
      'V Prostějově trénujeme v sobotu dopoledne, takže kroužek nekoliduje s odpoledními aktivitami ani s družinou. Máme dvě skupiny — v té pozdější bývá víc místa.',
    nearby: ['Olomouc', 'Kostelec na Hané', 'Plumlov', 'Němčice nad Hanou'],
    sessions: [
      { venue: 'ZŠ Melantrichova', when: 'Sobota 10:00–11:00', taken: 12, capacity: 25 },
      { venue: 'ZŠ Melantrichova', when: 'Sobota 11:00–12:00', taken: 4, capacity: 25 },
    ],
  },
  {
    slug: 'blansko',
    name: 'Blansko',
    inCity: 'v Blansku',
    region: 'Jihomoravský kraj',
    intro:
      'Blanenský kroužek běží v úterý podvečer na ZŠ Erbenova. Hodí se i dětem, které po škole chodí do družiny — začínáme až v 17:30.',
    nearby: ['Boskovice', 'Adamov', 'Rájec-Jestřebí', 'Jedovnice', 'Brno-sever'],
    sessions: [{ venue: 'ZŠ Erbenova', when: 'Úterý 17:30–18:30', taken: 8, capacity: 25 }],
  },
  {
    slug: 'brandys-nad-labem',
    name: 'Brandýs nad Labem',
    inCity: 'v Brandýse nad Labem',
    region: 'Středočeský kraj',
    intro:
      'V Brandýse máme dva termíny ve stejné tělocvičně — úterý bývá plnější, ve čtvrtek je klidnější skupina a víc prostoru na jednotlivce.',
    nearby: ['Stará Boleslav', 'Čelákovice', 'Neratovice', 'Lysá nad Labem', 'Praha-východ'],
    sessions: [
      { venue: 'ZŠ Na Výsluní', when: 'Úterý 17:00–18:00', taken: 15, capacity: 25 },
      { venue: 'ZŠ Na Výsluní', when: 'Čtvrtek 17:00–18:00', taken: 4, capacity: 20 },
    ],
  },
  {
    slug: 'jesenik',
    name: 'Jeseník',
    inCity: 'v Jeseníku',
    region: 'Olomoucký kraj',
    intro:
      'V Jeseníku trénujeme v pátek večer v tělocvičně gymnázia. Je to zavedená skupina, kam jezdí děti i z okolních obcí.',
    nearby: ['Česká Ves', 'Lipová-lázně', 'Mikulovice', 'Zlaté Hory', 'Písečná'],
    sessions: [{ venue: 'Gymnázium Komenského', when: 'Pátek 18:00–19:00', taken: 12, capacity: 25 }],
  },
  {
    slug: 'praha-vrsovice',
    name: 'Praha — Vršovice',
    inCity: 'v Praze ve Vršovicích',
    region: 'Praha',
    intro:
      'V Praze trénujeme v sokolovně na Vršovickém náměstí, v sobotu odpoledne. Dva navazující termíny — ve druhém je zatím nejvíc volného místa z celé republiky.',
    nearby: ['Praha 10', 'Praha 2', 'Praha 4', 'Vinohrady', 'Strašnice', 'Michle'],
    sessions: [
      {
        venue: 'Sokolovna Vršovice',
        when: 'Sobota 14:00–15:00',
        street: 'Vršovické náměstí 111/2, 101 00 Praha 10',
        taken: 2,
        capacity: 25,
      },
      {
        venue: 'Sokolovna Vršovice',
        when: 'Sobota 15:00–16:00',
        street: 'Vršovické náměstí 111/2, 101 00 Praha 10',
        taken: 1,
        capacity: 25,
      },
    ],
  },
  {
    slug: 'jesenice-zdimerice',
    name: 'Jesenice — Zdiměřice',
    inCity: 'v Jesenici u Prahy',
    region: 'Středočeský kraj',
    intro:
      'Kroužek pro Jesenici a okolí běží na ZŠ Zdiměřice v pátek odpoledne. Dva termíny hned po sobě — ten pozdější je zatím skoro prázdný, takže tam má dítě trenéra skoro pro sebe.',
    nearby: ['Průhonice', 'Vestec', 'Dolní Břežany', 'Praha-Zbraslav', 'Psáry'],
    sessions: [
      {
        venue: 'ZŠ Zdiměřice',
        when: 'Pátek 15:00–16:00',
        street: 'Hrnčířská 500, 252 42 Jesenice',
        taken: 7,
        capacity: 25,
      },
      {
        venue: 'ZŠ Zdiměřice',
        when: 'Pátek 16:00–17:00',
        street: 'Hrnčířská 500, 252 42 Jesenice',
        taken: 0,
        capacity: 25,
      },
    ],
  },
  {
    slug: 'sumperk',
    name: 'Šumperk',
    inCity: 'v Šumperku',
    region: 'Olomoucký kraj',
    intro:
      'V Šumperku otevíráme nový kroužek — trénovat budeme ve specializované gymnastické tělocvičně ZŠ Sluneční, která má molitanové jámy a gymnastické nářadí. Pro parkour je to jedno z nejlepších zázemí, jaké v kraji máme.',
    nearby: ['Zábřeh', 'Bludov', 'Rapotín', 'Hanušovice', 'Mohelnice'],
    sessions: [
      {
        venue: 'ZŠ Sluneční',
        when: 'Pondělí 17:00–18:00',
        street: 'Sluneční 38, 787 01 Šumperk',
        startsOn: '2. listopadu 2026',
        taken: 0,
        capacity: 20,
      },
    ],
  },
  {
    slug: 'pisecna',
    name: 'Písečná',
    inCity: 'v Písečné u Jeseníku',
    region: 'Olomoucký kraj',
    intro:
      'V Písečné otevíráme nový kroužek přímo v tělocvičně místní školy, takže děti nemusí nikam dojíždět. Začínáme ve středu odpoledne hned po vyučování.',
    nearby: ['Jeseník', 'Česká Ves', 'Mikulovice', 'Supíkovice'],
    sessions: [
      {
        venue: 'ZŠ a MŠ Písečná',
        when: 'Středa 16:00–18:00',
        street: 'Písečná 76, 790 82 Písečná',
        startsOn: '4. listopadu 2026',
        taken: 0,
        capacity: 20,
      },
    ],
  },
];

export function cityBySlug(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}

/** Volná místa napříč termíny jednoho města. */
export function freeSpots(city: City): number {
  return city.sessions.reduce(
    (sum, s) => sum + Math.max(0, (s.capacity ?? 0) - (s.taken ?? 0)),
    0,
  );
}
