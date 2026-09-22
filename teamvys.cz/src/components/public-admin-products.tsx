'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ChevronDown, ChevronsLeft, ChevronsRight, Clock, CreditCard, MapPin, ScanLine, Search, Users, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { Reveal } from '@/components/animated/reveal';
import { useAdminCreatedProducts } from '@/lib/admin-created-products';
import { type ParentProduct } from '@/lib/portal-content';
import { usePublicCoaches, type PublicCoachSummary } from '@/lib/use-public-coaches';

const VYS_ORG_ID = '00000000-0000-4000-8000-000000000001';

// Team VYS gear list shown on every VYS kroužek detail (fixed, not per product).
const VYS_WHAT_TO_BRING = [
  'Sálové boty se světlou podrážkou',
  'Volné tričko',
  'Tepláky nebo volné kraťasy',
  'Pití',
];

// ─── Weekend calendar helpers ─────────────────────────────────────────────────

type Weekend = { sat: Date; sun: Date };

/** Returns the next N upcoming weekends (starting from today or next Saturday) */
function buildUpcomingWeekends(count = 10): Weekend[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Find nearest upcoming Saturday
  const dayOfWeek = today.getDay(); // 0=Sun … 6=Sat
  const daysUntilSat = dayOfWeek === 6 ? 0 : (6 - dayOfWeek);
  const firstSat = new Date(today);
  firstSat.setDate(today.getDate() + daysUntilSat);
  const weekends: Weekend[] = [];
  for (let i = 0; i < count; i++) {
    const sat = new Date(firstSat);
    sat.setDate(firstSat.getDate() + i * 7);
    const sun = new Date(sat);
    sun.setDate(sat.getDate() + 1);
    weekends.push({ sat, sun });
  }
  return weekends;
}

function parsePrimaryMetaDate(meta: string): string | null {
  // Parses "13. 6. 2026 · 10:00 - 17:00" → "2026-06-13"
  const m = meta.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatWeekendLabel(w: Weekend): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'numeric' };
  const satStr = w.sat.toLocaleDateString('cs-CZ', opts);
  const sunStr = w.sun.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
  return `${satStr} – ${sunStr}`;
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' });
}

// ─── Workshop Browser (city filter + weekend calendar) ───────────────────────

const CITIES = ['Vše', 'Praha', 'Brno', 'Ostrava'] as const;
type CityFilter = (typeof CITIES)[number];

export function WorkshopBrowser() {
  const { products, loading, error } = useAdminCreatedProducts();
  const { coachesForIds } = usePublicCoaches();
  const workshops = products.filter((p) => p.type === 'Workshop');

  const weekends = useMemo(() => buildUpcomingWeekends(12), []);
  const [weekendIdx, setWeekendIdx] = useState(0);
  const [cityFilter, setCityFilter] = useState<CityFilter>('Vše');
  const [trickSearch, setTrickSearch] = useState('');

  const selectedWeekend = weekends[weekendIdx];

  // Collect all unique trick names from all workshops for the suggestion dropdown
  const allTricks = useMemo(() => {
    const names = new Set<string>();
    for (const w of workshops) {
      for (const t of w.trainingFocus) {
        if (t) names.add(t);
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'cs'));
  }, [workshops]);

  const trickSearchLower = trickSearch.trim().toLowerCase();

  const filteredSuggestions = useMemo(() => {
    if (!trickSearchLower) return [];
    return allTricks.filter((t) => t.toLowerCase().includes(trickSearchLower));
  }, [allTricks, trickSearchLower]);

  const filteredWorkshops = useMemo(() => {
    return workshops.filter((w) => {
      const date = parsePrimaryMetaDate(w.primaryMeta);
      const matchesWeekend = trickSearchLower
        ? true // when searching by trick, ignore weekend filter
        : date
          ? date === isoDate(selectedWeekend.sat) || date === isoDate(selectedWeekend.sun)
          : false;
      const matchesCity = cityFilter === 'Vše' || w.city.toLowerCase().includes(cityFilter.toLowerCase());
      const matchesTrick = !trickSearchLower || w.trainingFocus.some((t) => t.toLowerCase().includes(trickSearchLower));
      return matchesWeekend && matchesCity && matchesTrick;
    });
  }, [workshops, selectedWeekend, cityFilter, trickSearchLower]);

  // How many workshops exist per weekend (for dot indicators)
  const weekendCounts = useMemo(() => {
    return weekends.map((w) =>
      workshops.filter((ws) => {
        const d = parsePrimaryMetaDate(ws.primaryMeta);
        return d === isoDate(w.sat) || d === isoDate(w.sun);
      }).length,
    );
  }, [workshops, weekends]);

  if (loading) return <CatalogInlineState label="Načítám aktuální workshopy..." />;
  if (error) return <CatalogInlineState label="Aktuální workshopy se nepodařilo načíst." />;

  return (
    <div className="space-y-6">
      {/* City filter */}
      <div className="flex flex-wrap gap-2">
        {CITIES.map((city) => (
          <button
            key={city}
            type="button"
            onClick={() => setCityFilter(city)}
            className={`rounded-[14px] px-4 py-2 text-sm font-black transition ${cityFilter === city ? 'bg-brand-purple text-white shadow-brand' : 'border border-brand-purple/15 bg-white text-brand-ink-soft hover:bg-brand-purple/5 hover:text-brand-purple'}`}
          >
            {city}
          </button>
        ))}
      </div>

      {/* Trick search */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-brand-purple/50">
          <Search size={16} />
        </div>
        <input
          type="text"
          value={trickSearch}
          onChange={(e) => setTrickSearch(e.target.value)}
          placeholder="Hledat podle triku (Backflip, Safety roll…)"
          className="w-full rounded-[14px] border border-brand-purple/15 bg-white py-3 pl-10 pr-10 text-sm font-bold text-brand-ink placeholder:text-brand-ink-soft/50 outline-none focus:border-brand-purple/40 focus:ring-2 focus:ring-brand-purple/10 transition"
        />
        {trickSearch && (
          <button
            type="button"
            onClick={() => setTrickSearch('')}
            className="absolute inset-y-0 right-3 flex items-center text-brand-ink-soft/60 hover:text-brand-ink transition"
          >
            <X size={16} />
          </button>
        )}
        {/* Autocomplete suggestions */}
        {filteredSuggestions.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-[14px] border border-brand-purple/15 bg-white shadow-brand-soft">
            {filteredSuggestions.map((trick) => (
              <li key={trick}>
                <button
                  type="button"
                  onClick={() => setTrickSearch(trick)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-bold text-brand-ink hover:bg-brand-purple/5 hover:text-brand-purple transition"
                >
                  <Search size={13} className="shrink-0 text-brand-purple/40" />
                  {trick}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Active trick filter badge */}
      {trickSearchLower && (
        <div className="flex items-center gap-2 rounded-[12px] border border-brand-purple/15 bg-brand-purple/5 px-4 py-2 text-sm font-black text-brand-purple">
          <Search size={14} />
          Triky obsahující: <span className="font-black">{trickSearch.trim()}</span>
          <button type="button" onClick={() => setTrickSearch('')} className="ml-auto text-brand-purple/60 hover:text-brand-purple transition">
            <X size={14} />
          </button>
          {!trickSearchLower && null}
        </div>
      )}

      {/* Weekend calendar */}
      <div className="rounded-[24px] border border-brand-purple/12 bg-white p-5 shadow-brand-soft">
        <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase text-brand-ink-soft">
          <CalendarDays size={14} />
          Víkend
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={weekendIdx === 0}
            onClick={() => setWeekendIdx((i) => i - 1)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-purple/15 bg-brand-paper text-brand-ink-soft transition hover:bg-brand-purple hover:text-white disabled:pointer-events-none disabled:opacity-30"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="flex-1 text-center">
            <p className="text-xl font-black text-brand-ink md:text-2xl">{formatWeekendLabel(selectedWeekend)}</p>
            <div className="mt-2 flex justify-center gap-1.5">
              <span className="rounded-full bg-brand-paper px-2.5 py-1 text-xs font-bold text-brand-ink-soft">So {dayLabel(selectedWeekend.sat).split(' ').slice(1).join(' ')}</span>
              <span className="text-brand-ink-soft/40 text-xs font-bold self-center">·</span>
              <span className="rounded-full bg-brand-paper px-2.5 py-1 text-xs font-bold text-brand-ink-soft">Ne {dayLabel(selectedWeekend.sun).split(' ').slice(1).join(' ')}</span>
            </div>
          </div>

          <button
            type="button"
            disabled={weekendIdx === weekends.length - 1}
            onClick={() => setWeekendIdx((i) => i + 1)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-purple/15 bg-brand-paper text-brand-ink-soft transition hover:bg-brand-purple hover:text-white disabled:pointer-events-none disabled:opacity-30"
          >
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Dot indicators for next weekends */}
        <div className="mt-4 flex justify-center gap-1.5">
          {weekends.slice(0, 8).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setWeekendIdx(i)}
              className={`h-2 rounded-full transition-all ${i === weekendIdx ? 'w-5 bg-brand-purple' : weekendCounts[i] > 0 ? 'w-2 bg-brand-purple/40' : 'w-2 bg-brand-purple/15'}`}
            />
          ))}
        </div>
      </div>

      {/* Workshop cards */}
      {filteredWorkshops.length === 0 ? (
        <div className="rounded-brand border border-brand-purple/12 bg-white p-8 text-center shadow-brand-soft">
          <CalendarDays size={32} className="mx-auto mb-3 text-brand-purple/30" />
          <p className="font-black text-brand-ink">
            {trickSearchLower ? `Žádný workshop s trikem "${trickSearch.trim()}"` : 'Tento víkend žádný workshop'}
          </p>
          <p className="mt-1 text-sm font-bold text-brand-ink-soft">
            {trickSearchLower
              ? 'Zkus jiné jméno triku nebo vymaž filtr.'
              : `${cityFilter !== 'Vše' ? `V ${cityFilter} ` : ''}Zkus jiný víkend nebo vyber jiné město.`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredWorkshops.map((workshop, index) => (
            <Reveal key={workshop.id} delay={index * 80}>
              <WorkshopPublicCard product={workshop} coaches={coachesForIds(workshop.coachIds ?? [])} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminCreatedWorkshopCards({ startDelay = 0 }: { startDelay?: number }) {
  const { products, loading, error } = useAdminCreatedProducts();
  const { coachesForIds } = usePublicCoaches();
  const workshops = products.filter((product) => product.type === 'Workshop');

  if (loading) {
    return <CatalogInlineState label="Načítám aktuální workshopy..." />;
  }

  if (error) {
    return <CatalogInlineState label="Aktuální workshopy se nepodařilo načíst." />;
  }

  if (workshops.length === 0) {
    return (
      <div className="col-span-full rounded-brand border border-brand-purple/12 bg-white p-8 shadow-brand-soft">
        <p className="text-xs font-black uppercase text-brand-pink">Brzy</p>
        <h3 className="mt-2 text-xl font-black text-brand-ink">Žádné aktuální workshopy</h3>
        <p className="mt-2 text-sm font-bold leading-6 text-brand-ink-soft">Nové workshopy přidáváme průběžně. Sleduj nás na sociálních sítích nebo se přihlas do portálu a dostaneš upozornění, jakmile vypíšeme termín.</p>
      </div>
    );
  }

  return (
    <>
      {workshops.map((workshop, index) => (
        <Reveal key={workshop.id} delay={startDelay + index * 80}>
          <WorkshopPublicCard product={workshop} coaches={coachesForIds(workshop.coachIds ?? [])} />
        </Reveal>
      ))}
    </>
  );
}

function CatalogInlineState({ label }: { label: string }) {
  return (
    <div className="col-span-full rounded-brand border border-brand-purple/12 bg-white p-8 text-sm font-black text-brand-ink-soft shadow-brand-soft">
      {label}
    </div>
  );
}

export function AdminCreatedCourseCards({ startDelay = 0 }: { startDelay?: number }) {
  const { products } = useAdminCreatedProducts();
  // Filtruj 15vstupové varianty — zobrazujeme jen 10vstupovou kartu, cena "od X Kč" zahrnuje obě
  const courses = products
    .filter((product) => product.type === 'Krouzek' && !product.id.endsWith('-15'))
    .sort((a, b) => a.city.localeCompare(b.city, 'cs') || a.venue.localeCompare(b.venue, 'cs'));

  return (
    <>
      {courses.map((course, index) => (
        <CoursePublicCard key={course.id} product={course} delay={startDelay + index * 55} />
      ))}
    </>
  );
}

export function PublicCourseCatalog() {
  const { products, loading, error } = useAdminCreatedProducts();
  const courses = publicProductsByType(products, 'Krouzek');
  const totalCapacity = courses.reduce((sum, course) => sum + course.capacityTotal, 0);
  const registered = courses.reduce((sum, course) => sum + course.capacityCurrent, 0);

  return (
    <section className="section-shell py-10">
      <Reveal>
        <div className="relative flex flex-col gap-4 rounded-[34px] border border-brand-purple/12 bg-white p-6 shadow-brand-soft lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[720px]">
            <h2 className="text-2xl font-black leading-tight text-brand-ink md:text-4xl">
              Kroužky <span className="text-brand-purple">startují v říjnu</span>
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full bg-brand-purple/10 px-3 py-1.5 text-xs font-black text-brand-purple-deep">
                První lekce zdarma
              </span>
              <span className="inline-flex items-center rounded-full bg-brand-cyan/10 px-3 py-1.5 text-xs font-black text-brand-ink">
                Permanentka 10 nebo 15 vstupů
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:min-w-[390px]">
            <CatalogSummaryTile value={loading ? '...' : `${courses.length}`} label="lokalit" />
            <CatalogSummaryTile value={loading ? '...' : `${registered}/${totalCapacity}`} label="dětí" />
            <CatalogSummaryTile value="10 / 15" label="vstupů" />
          </div>
        </div>
      </Reveal>

      <CatalogState loading={loading} error={error} empty={!loading && courses.length === 0} emptyTitle="Žádné kroužky nejsou aktuálně vypsané" emptyText="Jakmile admin zveřejní lokalitu v databázi, objeví se tady s aktuální kapacitou." />

      {courses.length > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-wide text-brand-ink-soft">
          <motion.span animate={{ x: [-3, 3, -3] }} transition={{ repeat: Infinity, duration: 1.3, ease: 'easeInOut' }} className="inline-flex">
            <ChevronsLeft size={16} className="text-brand-purple" />
          </motion.span>
          Potáhni prstem pro další lokality
          <motion.span animate={{ x: [3, -3, 3] }} transition={{ repeat: Infinity, duration: 1.3, ease: 'easeInOut' }} className="inline-flex">
            <ChevronsRight size={16} className="text-brand-purple" />
          </motion.span>
        </div>
      ) : null}

      {courses.length > 0 ? (
        <div className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth pb-4 touch-pan-x sm:gap-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {courses.map((course, index) => (
            <div key={course.id} className="w-[86%] shrink-0 snap-center [scroll-snap-stop:always] sm:w-[47%] xl:w-[31.5%]">
              <CoursePublicCard product={course} delay={index * 55} />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function PublicCampCatalog() {
  const { products, loading, error } = useAdminCreatedProducts();
  const { coachesForIds } = usePublicCoaches();
  const camps = publicProductsByType(products, 'Tabor');

  return (
    <section className="section-shell py-10">
      <Reveal>
        <div className="max-w-[760px]">
          <p className="text-xs font-black uppercase text-brand-cyan">Aktuální turnusy</p>
          <h2 className="mt-2 text-2xl font-black text-brand-ink md:text-4xl">Vyber místo a rezervuj dítěti místo</h2>
        </div>
      </Reveal>

      <CatalogState loading={loading} error={error} empty={!loading && camps.length === 0} emptyTitle="Žádné tábory nejsou aktuálně vypsané" emptyText="Turnusy se zobrazují až z publikovaných produktů v administraci." />

      {camps.length > 0 ? (
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {camps.map((camp, index) => (
            <Reveal key={camp.id} delay={index * 80}>
              <CampPublicCard product={camp} coaches={coachesForIds(camp.coachIds ?? [])} />
            </Reveal>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function publicProductsByType(products: ParentProduct[], type: ParentProduct['type']) {
  return products
    .filter((product) => product.type === type && (type !== 'Krouzek' || !product.id.endsWith('-15')))
    .sort((a, b) => a.city.localeCompare(b.city, 'cs') || a.venue.localeCompare(b.venue, 'cs'));
}

function CatalogSummaryTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[22px] border border-brand-purple/10 bg-white px-4 py-3 text-center shadow-brand-soft">
      <p className="text-xl font-black text-brand-ink">{value}</p>
      <p className="mt-1 text-[11px] font-black uppercase text-brand-ink-soft">{label}</p>
    </div>
  );
}

function CatalogState({ loading, error, empty, emptyTitle, emptyText }: { loading: boolean; error: string | null; empty: boolean; emptyTitle: string; emptyText: string }) {
  if (loading) {
    return <div className="mt-6 rounded-brand border border-brand-purple/12 bg-white p-5 text-sm font-black text-brand-ink-soft shadow-brand-soft">Načítám aktuální nabídku...</div>;
  }

  if (error) {
    return <div className="mt-6 rounded-brand border border-brand-pink/25 bg-white p-5 text-sm font-black text-brand-ink-soft shadow-brand-soft">Nabídku se nepodařilo načíst: {error}</div>;
  }

  if (empty) {
    return (
      <div className="mt-6 rounded-brand border border-brand-purple/12 bg-white p-6 shadow-brand-soft">
        <p className="text-xs font-black uppercase text-brand-pink">Brzy</p>
        <h3 className="mt-2 text-xl font-black text-brand-ink">{emptyTitle}</h3>
        <p className="mt-2 text-sm font-bold leading-6 text-brand-ink-soft">{emptyText}</p>
      </div>
    );
  }

  return null;
}

export function AdminCreatedCourseDetail({ productId }: { productId: string }) {
  const { products } = useAdminCreatedProducts();
  const { coachesForIds } = usePublicCoaches();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => setLoaded(true), []);

  const product = products.find((item) => item.id === productId && item.type === 'Krouzek');

  if (!loaded) {
    return (
      <article className="section-shell py-10">
        <div className="rounded-brand border border-brand-purple/12 bg-white p-6 text-sm font-bold text-brand-ink-soft shadow-brand-soft">Načítám kroužek...</div>
      </article>
    );
  }

  if (!product) {
    return (
      <article className="section-shell py-10">
        <Link href="/krouzky" className="inline-flex items-center gap-2 text-sm font-bold text-brand-ink-soft transition-colors hover:text-brand-purple">
          <ArrowLeft size={17} />
          Všechny kroužky
        </Link>
        <div className="mt-7 rounded-brand border border-brand-purple/12 bg-white p-6 shadow-brand-soft">
          <h1 className="text-2xl font-black text-brand-ink">Kroužek není aktuálně zveřejněný</h1>
          <p className="mt-2 text-sm font-bold leading-6 text-brand-ink-soft">Detail se zobrazuje jen pro publikované produkty z databáze.</p>
        </div>
      </article>
    );
  }

  const gallery = product.gallery.length ? product.gallery : [product.heroImage];
  const [hero, ...rest] = gallery;
  const { day, time } = splitCourseMeta(product.primaryMeta);
  const coaches = coachesForIds(product.coachIds ?? []);

  return (
    <article className="section-shell py-10">
      <Reveal>
        <div className="flex flex-wrap items-center gap-3 text-sm font-bold">
          <Link href="/krouzky" className="inline-flex items-center gap-2 text-brand-ink-soft transition-colors hover:text-brand-purple">
            <ArrowLeft size={17} />
            Všechny kroužky
          </Link>
        </div>
      </Reveal>

      <div className="mt-7 grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <Reveal>
          <div className="space-y-3">
            <div className="relative aspect-[4/3] overflow-hidden rounded-brand bg-white shadow-brand-float">
              <ProductImage src={hero} alt={product.venue} className="h-full w-full object-cover" />
              <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(23,18,32,0)_42%,rgba(23,18,32,0.68)_100%)]" />
              <div className="absolute bottom-0 left-0 p-6 text-white">
                <p className="text-sm font-black uppercase text-brand-lime">{product.city}</p>
                <h1 className="mt-2 text-4xl font-black leading-tight md:text-6xl">{product.venue}</h1>
              </div>
            </div>
            {rest.length ? (
              <div className="grid grid-cols-3 gap-3">
                {rest.slice(0, 6).map((src, idx) => (
                  <div key={`${src}-${idx}`} className="relative aspect-square overflow-hidden rounded-brand bg-white shadow-brand-soft">
                    <ProductImage src={src} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : null}
            {product.mapQuery ? (
              <div className="overflow-hidden rounded-brand shadow-brand-soft">
                <iframe
                  title="Mapa místa"
                  src={`https://www.openstreetmap.org/export/embed.html?query=${encodeURIComponent(product.mapQuery)}&layer=mapnik`}
                  className="h-64 w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            ) : null}
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="sticky top-24 rounded-brand border border-brand-purple/12 bg-white p-6 shadow-brand">
            <div>
              <p className="text-xs font-black uppercase text-brand-cyan">Rezervace kroužku</p>
              <h2 className="mt-2 text-3xl font-black text-brand-ink">{product.city} · {product.venue}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">Permanentka 10 nebo 15 vstupů s NFC docházkou, skill tree a rodičovským přehledem.</p>
            </div>

            <div className="mt-5 grid gap-3 text-sm font-bold text-slate-700">
              <Stat icon={<CalendarDays size={18} />} label="Den" value={day} />
              <Stat icon={<Clock size={18} />} label="Čas" value={time} />
              {product.skillCategory && product.skillCategory !== 'smisene' ? (
                <Stat icon={<CheckCircle2 size={18} />} label="Úroveň" value={product.skillCategory === 'zacatecnici' ? 'Začátečníci' : 'Pokročilí'} />
              ) : null}
              <Stat icon={<Users size={18} />} label="Živá kapacita" value={`${product.capacityCurrent}/${product.capacityTotal} dětí`} />
              <Stat icon={<MapPin size={18} />} label="Místo" value={`${product.city} · ${product.venue}`} />
            </div>
            <CourseCapacityMeter current={product.capacityCurrent} total={product.capacityTotal} />

            <div className="mt-5 border-t border-black/10 pt-5">
              <p className="text-xs font-black uppercase text-slate-400">Trenéři na lokaci</p>
              <div className="mt-3 grid gap-2">
                {coaches.length > 0 ? coaches.map((coach) => <CoachCompact key={coach.id} name={coach.name} photoUrl={coach.photoUrl} />) : <p className="rounded-brand bg-brand-paper p-3 text-sm font-bold leading-6 text-brand-ink-soft">Trenér se pro tuto lokaci doplní v administraci.</p>}
              </div>
            </div>

            <div className="mt-5 border-t border-black/10 pt-5">
              <p className="text-xs font-black uppercase text-slate-400">Co je v ceně</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>Permanentka 10 nebo 15 vstupů</li>
                <li>NFC docházka v rodičovském přehledu</li>
                <li>Skill tree s XP a barevnými náramky</li>
                <li>Profesionální trenéři a žíněnky</li>
              </ul>
            </div>

            {product.orgId === VYS_ORG_ID || !product.orgId ? (
              <div className="mt-5 border-t border-black/10 pt-5">
                <p className="text-xs font-black uppercase text-slate-400">Co s sebou</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  {VYS_WHAT_TO_BRING.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-cyan" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Link href="/aplikace" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-brand bg-gradient-brand px-6 py-4 text-sm font-black text-white shadow-brand-soft transition-transform hover:-translate-y-0.5">
              <CreditCard size={18} />
              Stáhnout aplikaci
            </Link>
            <p className="mt-3 inline-flex items-center justify-center gap-2 text-center text-xs font-bold text-slate-500">
              <ScanLine size={15} />
              Platba kartou přes Stripe, potvrzení e-mailem.
            </p>
          </div>
        </Reveal>
      </div>
    </article>
  );
}

function CampPublicCard({ product, coaches = [] }: { product: ParentProduct; coaches?: PublicCoachSummary[] }) {
  const hasImage = Boolean(product.heroImage);
  return (
    <article className="group h-full overflow-hidden rounded-[30px] border border-brand-purple/12 bg-white shadow-brand transition-all duration-300 hover:-translate-y-1 hover:shadow-brand-float">
      <div className={`relative h-56 overflow-hidden ${hasImage ? '' : 'bg-[radial-gradient(ellipse_at_top_left,#a855f7_0%,#7c3aed_45%,#5b21b6_100%)]'}`}>
        {hasImage ? (
          <ProductImage src={product.heroImage} alt={product.venue} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div aria-hidden className="absolute inset-0 diagonal-rails opacity-[0.07]" />
        )}
        <div aria-hidden className={`absolute inset-0 bg-gradient-to-t ${hasImage ? 'from-black/70 via-black/20 to-transparent' : 'from-black/30 via-transparent to-transparent'}`} />
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-[16px] bg-white/95 px-3 py-1.5 text-xs font-black uppercase text-brand-ink shadow-sm backdrop-blur-sm">
          <CalendarDays size={13} className="text-brand-pink" />
          {product.primaryMeta}
        </span>
        <div className="absolute bottom-4 left-4 pr-4">
          <h3 className="text-2xl font-black text-white drop-shadow-sm">{product.venue}</h3>
          <p className="mt-0.5 text-sm font-bold text-white/80">{product.place}</p>
        </div>
      </div>
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase text-slate-400">Cena</p>
            <p className="mt-1 text-2xl font-black text-brand-ink">{product.priceLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-black uppercase text-slate-400">Kapacita</p>
            <p className="mt-1 text-lg font-black text-brand-ink">{product.capacityCurrent}/{product.capacityTotal} dětí</p>
          </div>
        </div>
        <CourseCapacityMeter current={product.capacityCurrent} total={product.capacityTotal} />
        <p className="mt-5 text-sm font-bold leading-6 text-brand-ink-soft">{product.description}</p>
        {product.trainingFocus.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {product.trainingFocus.slice(0, 5).map((focus) => (
              <span key={focus} className="rounded-[14px] bg-brand-cyan/10 px-3 py-1.5 text-xs font-black text-brand-cyan">{focus}</span>
            ))}
          </div>
        ) : null}
        {coaches.length > 0 ? (
          <div className="mt-5 border-t border-black/10 pt-4">
            <p className="text-xs font-black uppercase text-slate-400">Trenéři tábora</p>
            <div className="mt-3 grid gap-2">
              {coaches.map((coach) => <CoachCompact key={coach.id} name={coach.name} photoUrl={coach.photoUrl} />)}
            </div>
          </div>
        ) : null}
        <Link href="/aplikace" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-brand bg-gradient-brand px-6 py-4 text-sm font-black text-white shadow-brand-soft transition-transform hover:-translate-y-0.5">
          Stáhnout aplikaci
          <ArrowRight size={18} />
        </Link>
      </div>
    </article>
  );
}

function WorkshopPublicCard({ product, coaches = [] }: { product: ParentProduct; coaches?: PublicCoachSummary[] }) {
  return (
    <article className="h-full overflow-hidden rounded-brand border border-brand-purple/12 bg-white shadow-brand">
      <div className="relative h-48 overflow-hidden bg-brand-paper">
        <ProductImage src={product.heroImage} alt={product.venue} className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
        <div className="absolute bottom-4 left-4 pr-4">
          <p className="text-xs font-black uppercase text-brand-lime">{product.city}</p>
          <h3 className="mt-1 text-2xl font-black text-white">{product.venue}</h3>
        </div>
      </div>
      <div className="p-6 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-block rounded-brand bg-brand-cyan/12 px-3 py-2 text-xs font-black uppercase text-brand-cyan">{product.city}</span>
            <h3 className="mt-3 text-2xl font-black text-brand-ink md:text-3xl">{product.place}</h3>
          </div>
          <div className="text-left md:text-right">
            <p className="text-xs font-black uppercase text-slate-400">Cena</p>
            <p className="mt-1 text-2xl font-black text-brand-ink">{product.price.toLocaleString('cs-CZ')} Kč</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Info label="Termín" value={product.primaryMeta} />
          <Info label="Kapacita" value={`${product.capacityCurrent}/${product.capacityTotal} míst`} />
        </div>
        <WorkshopCapacityMeter current={product.capacityCurrent} total={product.capacityTotal} />
        <p className="mt-5 text-sm leading-6 text-slate-600">{product.description}</p>
        {product.trainingFocus.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {product.trainingFocus.map((focus) => (
              <span key={focus} className="rounded-[14px] bg-brand-cyan/10 px-3 py-1.5 text-xs font-black text-brand-cyan">{focus}</span>
            ))}
          </div>
        ) : null}
        {(() => {
          const videos = product.importantInfo.filter((i) => i.label === 'Video trik 1' || i.label === 'Video trik 2');
          if (videos.length === 0) return null;
          return (
            <div className="mt-5 border-t border-black/10 pt-4">
              <p className="text-xs font-black uppercase text-slate-400">Ukázky triků</p>
              <div className="mt-3 grid gap-3">
                {videos.map((v) => (
                  <div key={v.label}>
                    <p className="mb-1.5 text-xs font-black text-brand-ink-soft">{v.label.replace('Video t', 'T')}</p>
                    <video src={v.value} controls className="w-full rounded-[18px] bg-black" style={{ maxHeight: 260 }} playsInline />
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        <p className="mt-4 inline-flex gap-2 text-sm font-bold text-brand-ink"><CheckCircle2 size={18} className="text-brand-cyan" /> QR ticket po zaplacení</p>
        {coaches.length > 0 ? (
          <div className="mt-5 border-t border-black/10 pt-4">
            <p className="text-xs font-black uppercase text-slate-400">Trenéři workshopu</p>
            <div className="mt-3 grid gap-2">
              {coaches.map((coach) => <CoachCompact key={coach.id} name={coach.name} photoUrl={coach.photoUrl} />)}
            </div>
          </div>
        ) : null}
        <Link href="/aplikace" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-brand bg-gradient-brand px-6 py-4 text-sm font-black text-white shadow-brand-soft transition-transform hover:-translate-y-0.5">
          Stáhnout aplikaci
          <ArrowRight size={18} />
        </Link>
      </div>
    </article>
  );
}

function CoursePublicCard({ product, delay }: { product: ParentProduct; delay: number }) {
  void delay;
  const firstLesson = firstOctoberLessonLabel(product.primaryMeta);
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[30px] border border-brand-purple/12 bg-white shadow-brand-soft">
      <div className="relative h-[210px] shrink-0 bg-brand-paper">
        <ProductImage src={product.heroImage} alt={product.venue} className="h-full w-full object-cover" />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(23,18,32,0)_48%,rgba(23,18,32,0.44)_100%)]" />
        <span className="absolute left-3 top-3 rounded-[16px] bg-white px-3 py-2 text-xs font-black uppercase text-brand-ink shadow-brand-soft">{product.city}</span>
      </div>

      <div className="flex h-full flex-col p-5">
        {/* Název místa */}
        <h3 className="text-xl font-black leading-tight text-brand-ink">{product.venue}</h3>

        {/* Město + úroveň */}
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="inline-flex min-w-0 items-center gap-1.5 text-sm font-bold text-brand-ink-soft">
            <MapPin size={16} className="shrink-0 text-brand-pink" />
            <span className="truncate">{product.city}</span>
          </p>
          {product.skillCategory && product.skillCategory !== 'smisene' ? (
            <span className="shrink-0 rounded-[12px] bg-brand-purple-light px-2.5 py-1 text-[11px] font-black uppercase text-brand-purple-deep">
              {product.skillCategory === 'zacatecnici' ? 'Začátečníci' : 'Pokročilí'}
            </span>
          ) : null}
        </div>

        {/* Termín (datum a čas) — místo ceny a kapacity */}
        <div className="mt-4 grid gap-2 rounded-[22px] bg-brand-paper p-3 text-sm font-bold text-brand-ink">
          <span className="inline-flex items-center gap-2">
            <CalendarDays size={16} className="text-brand-purple" />
            {product.primaryMeta}
          </span>
          <span className="inline-flex items-start gap-2 leading-5 text-brand-purple-deep">
            <Clock size={16} className="text-brand-cyan" />
            <span>
              {firstLesson ? <>1. lekce {firstLesson}</> : <>Startujeme v říjnu</>} · <span className="text-brand-cyan">zdarma</span>
            </span>
          </span>
        </div>

        {/* Rozbalení: cena + živá kapacita */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-3 inline-flex items-center justify-between gap-2 rounded-[16px] bg-brand-paper px-4 py-3 text-sm font-black text-brand-ink transition-colors hover:bg-brand-purple-light"
        >
          {open ? 'Skrýt info' : 'Zobrazit více info'}
          <ChevronDown size={18} className={`text-brand-purple transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              key="more"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-3 flex items-center justify-between gap-3 rounded-[16px] bg-brand-paper px-3 py-2.5">
                <span className="inline-flex items-center gap-2 text-sm font-bold text-brand-ink">
                  <ScanLine size={16} className="text-brand-pink" />
                  Permanentka 10 nebo 15 vstupů
                </span>
                <span className="shrink-0 rounded-[14px] bg-brand-purple-light px-3 py-1.5 text-sm font-black text-brand-purple-deep">{coursePriceLabel(product)}</span>
              </div>

              <CourseCapacityMeter current={product.capacityCurrent} total={product.capacityTotal} />

              <Link
                href={`/krouzky/${product.id}`}
                className="group mt-3 flex items-center justify-between gap-3 rounded-[18px] border border-black/10 px-4 py-3 transition-colors hover:border-brand-purple/30"
              >
                <p className="text-xs font-black uppercase text-slate-400">Detail lokality a trenéři</p>
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-gradient-brand text-white transition-transform group-hover:translate-x-1">
                  <ArrowRight size={18} />
                </span>
              </Link>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ProductImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  if (!src) return null;
  return <img src={src} alt={alt} className={className} />;
}

function CoachCompact({ name, photoUrl }: { name: string; photoUrl: string }) {
  return (
    <div className="flex items-center gap-3 rounded-brand bg-brand-paper p-3">
      <ProductImage src={photoUrl} alt={name} className="h-10 w-10 rounded-brand bg-white object-contain p-1.5" />
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-brand-ink">{name}</p>
        <p className="mt-0.5 text-xs font-bold text-brand-ink-soft">Trenér TeamVYS</p>
      </div>
    </div>
  );
}

function WorkshopCapacityMeter({ current, total }: { current: number; total: number }) {
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const remaining = Math.max(0, total - current);

  return (
    <div className="mt-4 rounded-brand bg-brand-paper p-3">
      <div className="flex items-center justify-between gap-3 text-xs font-black">
        <span className="text-brand-ink">Aktuálně {current}/{total}</span>
        <span className="text-brand-cyan">{remaining} volných míst</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-brand-cyan" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function CourseCapacityMeter({ current, total }: { current: number; total: number }) {
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const remaining = Math.max(0, total - current);

  return (
    <div className="mt-4 rounded-[22px] bg-brand-paper p-3">
      <div className="flex items-center justify-between gap-3 text-xs font-black">
        <span className="text-brand-ink">{current}/{total} dětí</span>
        <span className="text-brand-cyan">{remaining} volných míst</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-brand-cyan" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-brand bg-brand-paper p-4">
      <p className="text-xs font-black uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-brand-ink">{value}</p>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-brand bg-brand-paper p-3">
      <span className="mt-0.5 text-brand-cyan">{icon}</span>
      <div>
        <p className="text-xs font-black uppercase text-slate-400">{label}</p>
        <p className="mt-0.5 text-sm font-black text-brand-ink">{value}</p>
      </div>
    </div>
  );
}

function splitCourseMeta(primaryMeta: string) {
  // Non-greedy day so "Pátek 18:00 - 19:00" splits into day="Pátek" and
  // time="18:00 - 19:00" (greedy .* wrongly put "Pátek 18:00 -" into the day).
  const match = primaryMeta.match(/^(.*?)\s+(\d{1,2}:\d{2}.*)$/);
  return match ? { day: match[1].trim(), time: match[2].trim() } : { day: primaryMeta, time: primaryMeta };
}

const CZ_WEEKDAY_INDEX: Record<string, number> = {
  nedele: 0,
  pondeli: 1,
  utery: 2,
  streda: 3,
  ctvrtek: 4,
  patek: 5,
  sobota: 6,
};

/** Vrací první lekeční datum v říjnu podle dne v týdnu z primaryMeta (např. „úterý 6. 10.“). */
function firstOctoberLessonLabel(primaryMeta: string): string | null {
  const { day } = splitCourseMeta(primaryMeta);
  const key = day
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)[0];
  const weekday = CZ_WEEKDAY_INDEX[key];
  if (weekday === undefined) return null;
  const now = new Date();
  const year = now.getMonth() > 9 ? now.getFullYear() + 1 : now.getFullYear();
  const date = new Date(year, 9, 1);
  for (let i = 0; i < 7 && date.getDay() !== weekday; i += 1) {
    date.setDate(date.getDate() + 1);
  }
  return date.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'numeric' });
}

function coursePriceLabel(product: ParentProduct) {
  return `od ${product.price.toLocaleString('cs-CZ')} Kč`;
}