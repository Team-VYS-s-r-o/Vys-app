'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, RotateCcw, Send } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const ease = [0.22, 1, 0.36, 1] as const;

/* ──────────────────────────────────────────────────────────────────────────
 * Znalostní báze — odpovědi na nejčastější dotazy rodičů.
 * Bot hledá shodu přes klíčová slova (bez diakritiky), jinak nabídne kontakt.
 * ────────────────────────────────────────────────────────────────────────── */

type BotLink = { href: string; label: string; external?: boolean };

type KnowledgeEntry = {
  id: string;
  /** Text na rychlém tlačítku (chip). */
  chip: string;
  /** Klíčová slova pro vyhledání (malá písmena, bez diakritiky). */
  keywords: string[];
  /** Odpověď bota — každá položka = jedna bublina. */
  answer: string[];
  links?: BotLink[];
  /** Navazující otázky, které bot nabídne. */
  followUps?: string[];
};

const APP_URL = 'https://vys-expo-web-export.vercel.app';

const KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: 'add-child',
    chip: 'Jak přidám dítě?',
    keywords: ['pridat dite', 'pridam dite', 'pridani ditete', 'nove dite', 'druhe dite', 'propojit dite', 'kod ditete', 'claim', 'sparovat', 'parovani', 'dite do aplikace', 'dite do uctu'],
    answer: [
      'Dítě přidáš přímo v aplikaci Team VYS: přihlas se jako rodič a v sekci Děti klepni na Přidat dítě. 🐾',
      'Pokud už má dítě vlastní účastnický účet, propojíš ho jeho kódem dítěte — ten najde ve svém profilu v aplikaci. Můžeš mít pod sebou klidně víc dětí najednou.',
    ],
    links: [{ href: APP_URL, label: 'Otevřít aplikaci', external: true }],
    followUps: ['buy-pass', 'ucastnik', 'app-download'],
  },
  {
    id: 'buy-pass',
    chip: 'Kde koupím permanentku?',
    keywords: ['koupit', 'koupim', 'nakup', 'permanentka', 'permice', 'zaplatit krouzek', 'platba za krouzek', 'prihlasit na krouzek', 'prihlaska', 'objednat', 'cena', 'kolik stoji'],
    answer: [
      'Všechny nákupy — permanentky na kroužky, tábory i workshopy — probíhají v aplikaci Team VYS. Vybereš dítě, zvolíš kroužek podle města a zaplatíš kartou. Potvrzení přijde hned. 💳',
      'Permanentka má 10 nebo 15 vstupů a platí celý semestr. Na webu se neplatí — vše bezpečně v aplikaci přes platební bránu Stripe.',
    ],
    links: [
      { href: APP_URL, label: 'Otevřít aplikaci', external: true },
      { href: '/krouzky', label: 'Nabídka kroužků' },
    ],
    followUps: ['missed-training', 'nfc-card', 'invoice'],
  },
  {
    id: 'ucastnik',
    chip: 'Jak funguje účet účastníka?',
    keywords: ['ucastnik', 'ucet ditete', 'detsky ucet', 'xp', 'level', 'maskot', 'maskoti', 'odmeny', 'triky', 'qr trik', 'jak funguje aplikace pro dite'],
    answer: [
      'Každé dítě má v aplikaci vlastní účastnický účet. Za tréninky a splněné triky sbírá XP, postupuje po levelech a odemyká nové maskoty. 🏅',
      'Na tréninku si nechá od trenéra naskenovat docházku, QR triky mu trenér schvaluje přímo v aplikaci. Ty jako rodič vidíš docházku, pokroky i platby přehledně u sebe.',
    ],
    followUps: ['attendance', 'add-child', 'nfc-card'],
  },
  {
    id: 'attendance',
    chip: 'Jak se počítá docházka?',
    keywords: ['dochazka', 'dochazku', 'vstup', 'vstupy', 'zapsat trenink', 'kolik vstupu zbyva', 'zbyvajici vstupy', 'odecet vstupu'],
    answer: [
      'Docházku zapisuje trenér na místě — dítěti se odečte jeden vstup z permanentky a rodiči se vše hned ukáže v aplikaci. 📲',
      'Kolik vstupů zbývá, vidíš v aplikaci u digitální permanentky dítěte.',
    ],
    followUps: ['missed-training', 'nfc-card', 'buy-pass'],
  },
  {
    id: 'missed-training',
    chip: 'Co když dítě nepřijde?',
    keywords: ['nepřijde', 'neprijde', 'nemoc', 'nemocne', 'omluvit', 'omluva', 'nahrada', 'nahradit', 'propadne', 'zmeskany', 'chybet', 'absence'],
    answer: [
      'Žádný stres — vstup nepropadá. 🙌 Permanentka má 10 nebo 15 vstupů a platí celý semestr, takže když dítě kvůli nemoci vynechá, vstup prostě využije na dalším tréninku.',
      'Omlouvat se nemusíš, docházka se odečítá jen za skutečně odchozené tréninky.',
    ],
    followUps: ['attendance', 'buy-pass'],
  },
  {
    id: 'nfc-card',
    chip: 'K čemu je NFC kartička?',
    keywords: ['nfc', 'karticka', 'kartička', 'cip', 'zaloha', 'zaloha 100', 'pipnuti', 'kartu'],
    answer: [
      'NFC kartička slouží k rychlému zapsání docházky — dítě pípne u trenéra a je zapsáno. 🪪',
      'Kartičku vydává trenér oproti vratné záloze 100 Kč, kterou pohodlně zaplatíš v aplikaci. Stav kartičky (vydaná / vrácená) vidíš u dítěte v aplikaci.',
    ],
    followUps: ['attendance', 'buy-pass'],
  },
  {
    id: 'beginner',
    chip: 'Zvládne to začátečník?',
    keywords: ['zacatecnik', 'zacina', 'nikdy necvicil', 'bez zkusenosti', 'prvni trenink', 'zvladne', 'vykonnost', 'urovne', 'pokrocily'],
    answer: [
      'Rozhodně! Tréninky jsou od úplných začátků — učíme základy pádů a koordinace a postupně přidáváme vault, dive roll nebo salto. 🤸',
      'Žádné předchozí zkušenosti nejsou potřeba, trenéři dělí skupinu podle úrovně.',
    ],
    followUps: ['age', 'what-to-bring', 'cities'],
  },
  {
    id: 'age',
    chip: 'Pro jaký věk jsou tréninky?',
    keywords: ['vek', 'roky', 'let', 'stary', 'stara', 'vekovy', 'maly', 'mala', 'od kolika', 'do kolika'],
    answer: [
      'Kroužky jsou pro děti 6–16 let. 🎂',
      'Pro starší máme open jamy a workshopy — mrkni na stránku Workshopy.',
    ],
    links: [{ href: '/workshopy', label: 'Workshopy' }],
    followUps: ['beginner', 'cities'],
  },
  {
    id: 'what-to-bring',
    chip: 'Co s sebou na trénink?',
    keywords: ['s sebou', 'vybaveni', 'obleceni', 'boty', 'co potrebuje', 'co vzit', 'priprava na trenink'],
    answer: [
      'Stačí pohodlné sportovní oblečení, pevné boty se světlou podrážkou (do tělocvičny) a pití. 👟',
      'Žádné speciální vybavení není potřeba — žíněnky a překážky máme my.',
    ],
    followUps: ['beginner', 'cities'],
  },
  {
    id: 'cities',
    chip: 'Kde trénujete?',
    keywords: ['mesta', 'mesto', 'kde trenujete', 'lokalita', 'lokality', 'vyskov', 'prostejov', 'blansko', 'brandys', 'jesenik', 'veliny', 'telocvicna', 'kdy je trenink', 'rozvrh', 'den a cas'],
    answer: [
      'Trénujeme ve Vyškově, Prostějově, Blansku, Brandýse, Jeseníku a Velinách. 📍',
      'Konkrétní tělocvičny, dny a časy najdeš u každého kroužku na stránce Kroužky.',
    ],
    links: [{ href: '/krouzky', label: 'Kroužky podle měst' }],
    followUps: ['buy-pass', 'beginner'],
  },
  {
    id: 'camps',
    chip: 'Jak fungují tábory?',
    keywords: ['tabor', 'tabory', 'primestsky', 'turnus', 'prazdniny', 'leto', 'letni'],
    answer: [
      'Příměstské tábory jedou o prázdninách v turnusech — celodenní program plný parkouru, her a výletů. ☀️',
      'Turnus vybereš a zaplatíš v aplikaci, tam pak nahraješ i potřebné dokumenty (posudek, bezinfekčnost).',
    ],
    links: [
      { href: '/tabory', label: 'Termíny táborů' },
      { href: APP_URL, label: 'Rezervovat v aplikaci', external: true },
    ],
    followUps: ['workshops', 'invoice'],
  },
  {
    id: 'workshops',
    chip: 'Co jsou workshopy?',
    keywords: ['workshop', 'workshopy', 'jednorazova akce', 'open jam', 'jam'],
    answer: [
      'Workshopy jsou jednorázové akce — intenzivní trénink s profíky, často na speciální téma (fliky, vaulty, freerun). 🎟️',
      'Vstupenku koupíš v aplikaci a dorazíš s QR ticketem. Hodí se i pro starší než 16 let.',
    ],
    links: [{ href: '/workshopy', label: 'Aktuální workshopy' }],
    followUps: ['camps', 'age'],
  },
  {
    id: 'app-download',
    chip: 'Kde stáhnu aplikaci?',
    keywords: ['stahnout', 'aplikace', 'appka', 'app store', 'google play', 'android', 'iphone', 'ios', 'telefon', 'web verze'],
    answer: [
      'Aplikace Team VYS je na App Store i Google Play — a funguje i rovnou v prohlížeči, bez instalace. 📱',
    ],
    links: [
      { href: '/aplikace', label: 'Vše o aplikaci' },
      { href: APP_URL, label: 'Spustit web verzi', external: true },
    ],
    followUps: ['add-child', 'login-problem'],
  },
  {
    id: 'login-problem',
    chip: 'Nemůžu se přihlásit',
    keywords: ['prihlasit', 'prihlaseni', 'heslo', 'zapomenute', 'zapomnel', 'zapomnela', 'nefunguje ucet', 'reset hesla', 'email nefunguje'],
    answer: [
      'Zapomenuté heslo vyřešíš přímo na přihlašovací obrazovce aplikace — klepni na „Zapomenuté heslo" a přijde ti e-mail s obnovou. 🔑',
      'Když se zasekneš, napiš nám na info@teamvys.cz nebo zavolej 734 167 417 a vyřešíme to spolu.',
    ],
    links: [{ href: APP_URL, label: 'Otevřít aplikaci', external: true }],
    followUps: ['app-download', 'contact'],
  },
  {
    id: 'invoice',
    chip: 'Dostanu potvrzení o platbě?',
    keywords: ['potvrzeni', 'faktura', 'doklad', 'uctenka', 'prispevek pojistovna', 'pojistovna', 'zamestnavatel'],
    answer: [
      'Ano — po zaplacení najdeš doklad v aplikaci u dané platby. 🧾',
      'Potřebuješ-li potvrzení pro pojišťovnu nebo zaměstnavatele, napiš nám na info@teamvys.cz a připravíme ho.',
    ],
    followUps: ['buy-pass', 'contact'],
  },
  {
    id: 'safety',
    chip: 'Je parkour bezpečný?',
    keywords: ['bezpecny', 'bezpecnost', 'zraneni', 'uraz', 'pojisteni', 'boji se', 'strach', 'nebezpecne'],
    answer: [
      'Bezpečnost je u nás na prvním místě. Učíme nejdřív správně padat, trénujeme na žíněnkách a vše jde krok za krokem podle úrovně dítěte. 🛡️',
      'Trenéři jsou proškolení a skupiny vedeme tak, aby měl každý prostor i dohled.',
    ],
    followUps: ['beginner', 'coaches'],
  },
  {
    id: 'coaches',
    chip: 'Kdo trénuje?',
    keywords: ['trener', 'treneri', 'kdo uci', 'kdo vede', 'lektori'],
    answer: [
      'Tréninky vedou zkušení trenéři Team VYS — aktivní parkouristé, kteří s dětmi trénují roky a pravidelně se vzdělávají. 🧑‍🏫',
      'Více o nás najdeš na stránce O nás.',
    ],
    links: [{ href: '/o-nas', label: 'O nás' }],
    followUps: ['safety', 'cities'],
  },
  {
    id: 'contact',
    chip: 'Kontakt na vás',
    keywords: ['kontakt', 'telefon', 'email', 'e-mail', 'zavolat', 'napsat', 'cislo', 'spojit'],
    answer: [
      'Rádi pomůžeme osobně! 📞 Telefon: 734 167 417 · E-mail: info@teamvys.cz',
      'Nebo mrkni na stránku Kontakty — je tam i rychlý rozcestník.',
    ],
    links: [{ href: '/kontakty', label: 'Kontakty' }],
  },
];

const FALLBACK: Pick<KnowledgeEntry, 'answer' | 'links' | 'followUps'> = {
  answer: [
    'Hmm, na tohle zatím nemám připravenou odpověď. 🐱 Zkus to napsat jinak, nebo vyber jednu z otázek níže.',
    'A kdyby nic — napiš nám na info@teamvys.cz nebo zavolej 734 167 417, odpovídáme rychle.',
  ],
  links: [{ href: '/kontakty', label: 'Kontakty' }],
  followUps: ['add-child', 'buy-pass', 'cities'],
};

const DEFAULT_CHIPS = ['add-child', 'buy-pass', 'ucastnik', 'missed-training', 'cities', 'app-download'];

const BOT_API_URL = `${process.env.NEXT_PUBLIC_API_URL || 'https://server-psi-ochre-40.vercel.app'}/api/bot/chat`;

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findEntry(question: string): KnowledgeEntry | null {
  const text = normalize(question);
  if (!text) return null;
  let best: { entry: KnowledgeEntry; score: number } | null = null;
  for (const entry of KNOWLEDGE) {
    let score = 0;
    for (const keyword of entry.keywords) {
      if (text.includes(keyword)) score += keyword.length;
    }
    if (normalize(entry.chip) === text) score += 100;
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }
  return best?.entry ?? null;
}

/* ────────────────────────────────────────────────────────────────────────── */

type ChatMessage = {
  id: number;
  from: 'bot' | 'user';
  text: string;
  links?: BotLink[];
};

const GREETING: string[] = [
  'Ahoj! Jsem VYS kočka — pomocník pro rodiče. 🐱',
  'Zeptej se mě na cokoliv kolem kroužků, aplikace, plateb nebo táborů. Nebo vyber otázku níže.',
];

let messageId = 0;
const nextId = () => ++messageId;

export function VysBotChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chips, setChips] = useState<string[]>(DEFAULT_CHIPS);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** Zvýší se při resetu — zahodí odpovědi AI, které dorazí po restartu chatu. */
  const sessionRef = useRef(0);

  // Úvodní pozdrav s prodlevou — působí živě.
  useEffect(() => {
    queueBotMessages(GREETING, undefined, DEFAULT_CHIPS, 500);
    return () => timeouts.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  function queueBotMessages(texts: string[], links: BotLink[] | undefined, followUps: string[] | undefined, startDelay = 650) {
    setTyping(true);
    setChips([]);
    let delay = startDelay;
    texts.forEach((text, index) => {
      const isLast = index === texts.length - 1;
      delay += index === 0 ? 0 : Math.min(420 + text.length * 6, 1200);
      timeouts.current.push(
        setTimeout(() => {
          setMessages((current) => [...current, { id: nextId(), from: 'bot', text, links: isLast ? links : undefined }]);
          if (isLast) {
            setTyping(false);
            setChips(followUps ?? DEFAULT_CHIPS);
          }
        }, delay),
      );
    });
  }

  /** Lokální odpověď ze znalostní báze (zdarma, okamžitě, s odkazy). */
  function answerLocally(question: string) {
    const entry = findEntry(question);
    if (entry) queueBotMessages(entry.answer, entry.links, entry.followUps ?? DEFAULT_CHIPS);
    else queueBotMessages(FALLBACK.answer, FALLBACK.links, FALLBACK.followUps);
  }

  /** AI odpověď přes server (Claude). Při chybě tiše spadne na znalostní bázi. */
  async function answerWithAi(question: string, history: ChatMessage[]) {
    const session = sessionRef.current;
    setTyping(true);
    setChips([]);
    try {
      const apiMessages = [...history, { id: 0, from: 'user' as const, text: question }]
        .slice(-10)
        .map((message) => ({ role: message.from === 'user' ? 'user' : 'assistant', content: message.text }));

      const response = await fetch(BOT_API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });
      if (!response.ok) throw new Error(`Bot API ${response.status}`);
      const payload = (await response.json()) as { reply?: string };
      const reply = (payload.reply || '').trim();
      if (!reply) throw new Error('Empty reply');
      if (session !== sessionRef.current) return;

      const parts = reply
        .split(/\n{2,}/)
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 3);
      queueBotMessages(parts.length ? parts : [reply], undefined, DEFAULT_CHIPS, 150);
    } catch {
      if (session !== sessionRef.current) return;
      answerLocally(question);
    }
  }

  function ask(question: string, options?: { viaChip?: boolean }) {
    const trimmed = question.trim();
    if (!trimmed || typing) return;
    const history = messages;
    setMessages((current) => [...current, { id: nextId(), from: 'user', text: trimmed }]);
    setInput('');
    // Chipy mají připravené odpovědi s odkazy — AI voláme jen pro volně psané dotazy.
    if (options?.viaChip) answerLocally(trimmed);
    else void answerWithAi(trimmed, history);
  }

  function reset() {
    sessionRef.current += 1;
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
    setMessages([]);
    setTyping(false);
    setChips([]);
    queueBotMessages(GREETING, undefined, DEFAULT_CHIPS, 400);
  }

  const chipEntries = chips
    .map((id) => KNOWLEDGE.find((entry) => entry.id === id))
    .filter((entry): entry is KnowledgeEntry => Boolean(entry));

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_32px_120px_rgba(12,10,28,0.45)]">
      {/* Hlavička chatu s kočkou */}
      <div className="relative flex items-center gap-4 border-b border-white/10 bg-white/[0.04] px-5 py-4 md:px-6">
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          className="relative h-14 w-14 shrink-0 md:h-16 md:w-16"
        >
          <Image src="/cats/premyslim.png" alt="VYS kočka" fill sizes="64px" className="object-contain drop-shadow-[0_8px_24px_rgba(139,29,255,0.45)]" />
        </motion.div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-black text-white md:text-lg">VYS kočka</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-bold text-white/50">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            online · odpovídá hned
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          aria-label="Začít znovu"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/50 transition-colors hover:border-brand-purple/50 hover:text-white"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Zprávy */}
      <div ref={scrollRef} className="h-[420px] overflow-y-auto px-4 py-5 md:h-[480px] md:px-6 [scrollbar-width:thin]">
        <div className="grid gap-3">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease }}
                className={message.from === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={
                    message.from === 'user'
                      ? 'max-w-[85%] rounded-2xl rounded-br-md bg-brand-purple px-4 py-3 text-sm font-bold leading-6 text-white'
                      : 'max-w-[85%] rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-bold leading-6 text-white/90'
                  }
                >
                  {message.text}
                  {message.links && message.links.length > 0 ? (
                    <span className="mt-3 flex flex-wrap gap-2">
                      {message.links.map((link) =>
                        link.external ? (
                          <a
                            key={link.href}
                            href={link.href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full bg-brand-purple px-3.5 py-1.5 text-xs font-black text-white transition-transform hover:-translate-y-0.5"
                          >
                            {link.label}
                            <ArrowRight size={12} />
                          </a>
                        ) : (
                          <Link
                            key={link.href}
                            href={link.href}
                            className="inline-flex items-center gap-1.5 rounded-full bg-brand-purple px-3.5 py-1.5 text-xs font-black text-white transition-transform hover:-translate-y-0.5"
                          >
                            {link.label}
                            <ArrowRight size={12} />
                          </Link>
                        ),
                      )}
                    </span>
                  ) : null}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Indikátor psaní */}
          <AnimatePresence>
            {typing ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex justify-start"
              >
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.06] px-4 py-3.5">
                  {[0, 1, 2].map((dot) => (
                    <motion.span
                      key={dot}
                      animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: dot * 0.15 }}
                      className="h-1.5 w-1.5 rounded-full bg-brand-purple-light"
                    />
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {/* Rychlé otázky */}
      <AnimatePresence>
        {chipEntries.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease }}
            className="flex flex-wrap gap-2 border-t border-white/10 px-4 py-3 md:px-6"
          >
            {chipEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => ask(entry.chip, { viaChip: true })}
                className="rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-2 text-xs font-black text-white/75 transition-colors hover:border-brand-purple/60 hover:bg-brand-purple/15 hover:text-white"
              >
                {entry.chip}
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Vstup */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          ask(input);
        }}
        className="flex items-center gap-2 border-t border-white/10 bg-white/[0.04] px-4 py-3 md:px-6"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Napiš dotaz… třeba „jak přidám dítě?"
          aria-label="Tvůj dotaz"
          className="h-12 flex-1 rounded-xl border border-white/10 bg-transparent px-4 text-sm font-bold text-white placeholder:text-white/35 focus:border-brand-purple/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || typing}
          aria-label="Odeslat dotaz"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-purple text-white transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
