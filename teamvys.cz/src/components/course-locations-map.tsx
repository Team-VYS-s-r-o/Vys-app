'use client';

import { useEffect, useRef } from 'react';
import { MapPin, RotateCcw } from 'lucide-react';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export function normalizeCity(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
}

// Souřadnice tělocvičen (škola / hala / sokolovna) v jednotlivých městech
const CITY_POINTS: Record<string, { lat: number; lng: number }> = {
  blansko: { lat: 49.3667, lng: 16.6483 },
  brandys: { lat: 50.1866, lng: 14.6613 },
  zdimerice: { lat: 49.9789, lng: 14.5022 },
  jesenik: { lat: 50.2243, lng: 17.1998 },
  pisecna: { lat: 50.2719, lng: 17.2503 },
  sumperk: { lat: 49.9654, lng: 16.9707 },
  prostejov: { lat: 49.4719, lng: 17.1093 },
  vrsovice: { lat: 50.0682, lng: 14.4576 },
  vyskov: { lat: 49.2792, lng: 16.9986 },
};

// Kam od bodu štítek odstoupí, ať se štítky blízkých měst (Praha a okolí,
// Jeseník × Písečná, Olomouc × Prostějov) nepřekrývají. Neznámé město = nahoru.
type PinDir = 'top' | 'bottom' | 'left' | 'right';
const LABEL_DIR: Record<string, PinDir> = {
  blansko: 'left',
  brandys: 'top',
  zdimerice: 'bottom',
  jesenik: 'right',
  pisecna: 'top',
  sumperk: 'left',
  prostejov: 'right',
  olomouc: 'top',
  vrsovice: 'right',
  vyskov: 'bottom',
  hradeckralove: 'top',
};

// Stejný špendlík jako na mapě kroužků v adminu: bílá pilulka s kolečkem
// (počet kroužků ve městě) a názvem města, špička míří na přesné místo.
// Po najetí myší se pilulka zvedne a rozbalí řádek s tělocvičnou.
const PIN_CSS = `
.vys-web-map .leaflet-tile-pane { filter: saturate(0.55) contrast(0.96) brightness(1.04); }
.vys-web-map.leaflet-container { background: #F4F1FA; font-family: inherit; }
.vp-anchor { background: none; border: 0; }
.vp { position: absolute; left: 0; top: 0; cursor: pointer; }
.vp--top { transform: translate(-50%, calc(-100% - 9px)); }
.vp--bottom { transform: translate(-50%, 9px); }
.vp--left { transform: translate(calc(-100% - 9px), -50%); }
.vp--right { transform: translate(9px, -50%); }
.vp__in { animation: vp-in 0.6s cubic-bezier(0.22, 1.25, 0.36, 1) both; animation-delay: var(--d, 0ms); }
.vp__body { position: relative; isolation: isolate; display: flex; align-items: center; gap: 8px; padding: 5px 13px 5px 5px; border-radius: 18px; background: #fff; color: #171220; white-space: nowrap; box-shadow: 0 8px 22px rgba(23,18,32,0.18), 0 0 0 1px rgba(23,18,32,0.06); transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease; }
.vp__body::after { content: ''; position: absolute; width: 12px; height: 12px; border-radius: 3px; background: inherit; z-index: -1; }
.vp--top .vp__body::after { left: 50%; bottom: -5px; transform: translateX(-50%) rotate(45deg); }
.vp--bottom .vp__body::after { left: 50%; top: -5px; transform: translateX(-50%) rotate(45deg); }
.vp--left .vp__body::after { right: -5px; top: 50%; transform: translateY(-50%) rotate(45deg); }
.vp--right .vp__body::after { left: -5px; top: 50%; transform: translateY(-50%) rotate(45deg); }
.vp--top .vp__body { transform-origin: 50% 100%; }
.vp--bottom .vp__body { transform-origin: 50% 0%; }
.vp--left .vp__body { transform-origin: 100% 50%; }
.vp--right .vp__body { transform-origin: 0% 50%; }
.vp__count { display: grid; place-items: center; min-width: 26px; height: 26px; padding: 0 7px; box-sizing: border-box; border-radius: 999px; background: #8B1DFF; color: #fff; font-size: 12px; font-weight: 900; font-variant-numeric: tabular-nums; flex-shrink: 0; }
.vp.is-interest .vp__count { background: #FFB21A; color: #171220; }
/* Jeden kroužek ve městě: místo jedničky jen bílá tečka — číslo má smysl až od dvou. */
.vp__dot { width: 8px; height: 8px; border-radius: 50%; background: #fff; }
.vp__text { display: flex; flex-direction: column; line-height: 1.15; }
.vp__city { font-size: 13px; font-weight: 800; }
/* Sbalený řádek s tělocvičnou nesmí pilulku roztahovat ani do šířky — proto i max-width: 0. */
.vp__sub { max-height: 0; max-width: 0; opacity: 0; overflow: hidden; font-size: 11px; font-weight: 700; color: rgba(23,18,32,0.6); transition: max-height 0.25s cubic-bezier(0.22, 1, 0.36, 1), max-width 0.25s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease, margin-top 0.25s ease; }
.vp:hover .vp__body { transform: scale(1.05); box-shadow: 0 14px 30px rgba(23,18,32,0.26), 0 0 0 1px rgba(139,29,255,0.25); }
.vp:hover .vp__sub, .vp.is-active .vp__sub { max-height: 16px; max-width: 280px; opacity: 1; margin-top: 2px; }
.vp:hover, .vp.is-active { z-index: 5; }
.vp.is-active .vp__body { background: #171220; color: #fff; box-shadow: 0 14px 34px rgba(23,18,32,0.34); }
.vp.is-active .vp__sub { color: rgba(255,255,255,0.7); }
.vp.is-active .vp__count { animation: vp-pulse 1.8s ease-out infinite; }
@keyframes vp-in { from { opacity: 0; transform: translateY(14px) scale(0.6); } to { opacity: 1; transform: none; } }
@keyframes vp-pulse { 0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.5); } 100% { box-shadow: 0 0 0 11px rgba(255,255,255,0); } }
/* Telefon: celá republika na úzké mapě — menší pilulky, ať se města nepřekrývají. */
@media (max-width: 640px) {
  .vp__body { padding: 3px 8px 3px 3px; gap: 4px; border-radius: 13px; }
  .vp__count { min-width: 16px; height: 16px; padding: 0 4px; font-size: 10px; }
  .vp__dot { width: 6px; height: 6px; }
  .vp__city { font-size: 11px; }
  .vp__body::after { width: 9px; height: 9px; }
  .vp--top .vp__body::after { bottom: -4px; }
  .vp--bottom .vp__body::after { top: -4px; }
  .vp--left .vp__body::after { right: -4px; }
  .vp--right .vp__body::after { left: -4px; }
  .vp--top { transform: translate(-50%, calc(-100% - 7px)); }
  .vp--bottom { transform: translate(-50%, 7px); }
  .vp--left { transform: translate(calc(-100% - 7px), -50%); }
  .vp--right { transform: translate(7px, -50%); }
}
@media (prefers-reduced-motion: reduce) {
  .vp__in, .vp.is-active .vp__count { animation: none; }
  .vp__body, .vp__sub { transition: none; }
}
`;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] ?? ch));
}

type MapLocation = { city: string; venue: string; latitude?: number; longitude?: number; /** Kroužek zatím jen sbírá zájemce. */ interest?: boolean };

export function CourseLocationsMap({ locations, onCityPick, activeCity }: { locations: MapLocation[]; onCityPick?: (cityKey: string) => void; /** Vybrané město — jeho špendlík zůstane tmavý a rozbalený. */ activeCity?: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const homeRef = useRef<(() => void) | null>(null);
  const pickRef = useRef(onCityPick);
  pickRef.current = onCityPick;
  // Zvýraznění řídí rodič přes `activeCity` — po kliknutí se sekce překreslí a
  // třída přidaná jen v obsluze kliknutí by se ztratila.
  const pinElementsRef = useRef(new Map<string, HTMLElement>());
  const activeRef = useRef(activeCity ?? null);
  activeRef.current = activeCity ?? null;
  const applyActive = () => {
    for (const [key, el] of pinElementsRef.current) el.classList.toggle('is-active', key === activeRef.current);
  };
  useEffect(applyActive, [activeCity]);

  const byCity = new Map<string, { key: string; city: string; venues: string[]; point: { lat: number; lng: number }; count: number; interestOnly: boolean }>();
  for (const loc of locations) {
    const key = normalizeCity(loc.city);
    // Nové město se na mapě objeví samo — stačí, když má produkt v adminu souřadnice.
    const point =
      CITY_POINTS[key] ??
      (loc.latitude != null && loc.longitude != null ? { lat: loc.latitude, lng: loc.longitude } : undefined);
    if (!point) continue;
    const entry = byCity.get(key) ?? { key, city: loc.city, venues: [], point, count: 0, interestOnly: true };
    if (!entry.venues.includes(loc.venue)) entry.venues.push(loc.venue);
    entry.count += 1;
    if (!loc.interest) entry.interestOnly = false;
    byCity.set(key, entry);
  }
  const pins = Array.from(byCity.values());
  const pinsKey = pins.map((p) => `${p.key}:${p.count}:${p.interestOnly ? 1 : 0}`).sort().join(',');

  useEffect(() => {
    if (!containerRef.current || pins.length === 0) return;
    let cancelled = false;
    let detachWheel: (() => void) | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
        // Jedním prstem se scrolluje stránka, mapa reaguje až na dva prsty
        dragging: !coarse,
        touchZoom: true,
        keyboard: false,
        // Kolečko nezoomuje, dokud uživatel do mapy neklikne — jinak mapa
        // chytala scroll stránky a nešlo přes ni pohodlně projet.
        scrollWheelZoom: false,
        // Mírnější citlivost zoomu kolečkem
        wheelPxPerZoomLevel: 160,
        // Jemnější krok výřezu — na telefonu rozhoduje každý pixel mezi štítky.
        zoomSnap: 0.25,
        zoomDelta: 0.5,
        minZoom: 6,
        maxZoom: 17,
      });
      mapRef.current = map;
      // Klik do mapy zoom kolečkem probudí, odjetí myši ho zase uspí.
      map.on('click', () => map.scrollWheelZoom.enable());
      map.on('mouseout', () => map.scrollWheelZoom.disable());
      if (coarse) {
        // Jistota: jedním prstem projde scroll stránky, pinch chytá Leaflet
        containerRef.current.style.touchAction = 'pan-y';
      }

      // Esri má popisky jen anglicky („Prague", „Pilsen"), proto jedeme na
      // standardních OSM dlaždicích s českými názvy. CARTO od 2026 vyžaduje
      // API klíč (vodoznak „API KEY REQUIRED"), takže Esri drží jako záloha,
      // kdyby OSM přestal odpovídat (usage policy).
      const osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxNativeZoom: 19,
        maxZoom: 19,
        referrerPolicy: 'strict-origin-when-cross-origin',
      }).addTo(map);

      let tileErrors = 0;
      let switched = false;
      const switchTiles = (url: string, attribution: string, subdomains?: string) => {
        if (switched) return;
        switched = true;
        map.removeLayer(osmLayer);
        L.tileLayer(url, { attribution, maxNativeZoom: 18, maxZoom: 19, ...(subdomains ? { subdomains } : {}) }).addTo(map);
      };
      osmLayer.on('tileerror', () => {
        tileErrors += 1;
        if (tileErrors < 4) return;
        switchTiles('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', 'Esri &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>');
      });
      // Prohlížeč bez hlavičky Referer (rozšíření na soukromí, antivir) dostane
      // od OSM obrázek „403 Access blocked" s HTTP 200 — tileerror ho nepozná.
      // Zablokovaná odpověď nese `cache-control: no-cache`, pravá dlaždice `max-age`.
      fetch('https://tile.openstreetmap.org/6/34/21.png', { referrerPolicy: 'strict-origin-when-cross-origin' })
        .then((response) => {
          if (cancelled) return;
          if (!response.ok || /no-cache/i.test(response.headers.get('cache-control') ?? '')) {
            switchTiles('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', 'abc');
          }
        })
        .catch(() => undefined);

      const bounds = L.latLngBounds([]);
      const pinElements = pinElementsRef.current;
      pinElements.clear();
      // Od západu na východ — špendlíky dopadnou ve vlně přes republiku.
      const ordered = [...pins].sort((a, b) => a.point.lng - b.point.lng);
      ordered.forEach((pin, index) => {
        const point = pin.point;
        bounds.extend([point.lat, point.lng]);
        const dir = LABEL_DIR[pin.key] ?? 'top';
        const sub = pin.interestOnly ? `Sbíráme zájem · ${pin.venues.join(' · ')}` : pin.venues.join(' · ');
        const icon = L.divIcon({
          className: 'vp-anchor',
          iconSize: [0, 0],
          html: `<div class="vp vp--${dir}${pin.interestOnly ? ' is-interest' : ''}" data-city="${escapeHtml(pin.key)}" style="--d:${120 + index * 70}ms"><div class="vp__in"><div class="vp__body"><span class="vp__count">${pin.interestOnly ? '?' : pin.count > 1 ? pin.count : '<span class="vp__dot"></span>'}</span><span class="vp__text"><span class="vp__city">${escapeHtml(pin.city)}</span><span class="vp__sub">${escapeHtml(sub)}</span></span></div></div></div>`,
        });
        const marker = L.marker([point.lat, point.lng], { icon, title: `${pin.city} — ${sub}`, riseOnHover: true }).addTo(map);
        marker.on('click', () => pickRef.current?.(pin.key));
      });

      // Na úzkém displeji menší odsazení, jinak se celá ČR nevejde
      // Štítky odstupují od bodu do stran — vpravo a nahoře potřebují víc místa,
      // jinak by města u kraje (Jeseník, Prostějov) přetekla z mapy.
      const narrow = window.innerWidth < 640;
      const fitHome = () => map.fitBounds(bounds, narrow
        ? { paddingTopLeft: [34, 44], paddingBottomRight: [88, 24] }
        : { paddingTopLeft: [90, 80], paddingBottomRight: [150, 60] });
      fitHome();
      homeRef.current = fitHome;
      // Leaflet vloží ikony do stránky až s prvním nastavením výřezu (fitBounds výš),
      // dřív ještě neexistují — proto se prvky špendlíků sbírají až tady.
      containerRef.current.querySelectorAll<HTMLElement>('.vp[data-city]').forEach((element) => {
        if (element.dataset.city) pinElements.set(element.dataset.city, element);
      });
      applyActive();
      // Mapa jen pro ČR a blízké okolí — nejde odjet ani odzoomovat na celý svět
      map.setMaxBounds(bounds.pad(1.1));
      map.options.maxBoundsViscosity = 1.0;

      // Kontejner se často doměří až po prvním renderu — Leaflet si velikost
      // bere jen jednou při initu a fitBounds pak vyjde moc přiblížený
      // (na mobilu nebyla vidět celá republika). Po usazení přepočítat.
      requestAnimationFrame(() => {
        map.invalidateSize();
        fitHome();
      });
      settleTimer = setTimeout(() => {
        map.invalidateSize();
        fitHome();
      }, 400);
      if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
        resizeObserver = new ResizeObserver(() => map.invalidateSize());
        resizeObserver.observe(containerRef.current);
      }

      // Na krajní úrovni zoomu už kolečko nemá co dělat — pustíme ho na
      // stránku. Capture na obalu, aby se událost k Leafletu vůbec nedostala.
      const wrapper = wrapperRef.current;
      const onWheel = (event: WheelEvent) => {
        const zoom = map.getZoom();
        const zoomingOutAtMin = event.deltaY > 0 && zoom <= map.getMinZoom() + 0.01;
        const zoomingInAtMax = event.deltaY < 0 && zoom >= map.getMaxZoom() - 0.01;
        if (zoomingOutAtMin || zoomingInAtMax) event.stopPropagation();
      };
      wrapper?.addEventListener('wheel', onWheel, true);
      detachWheel = () => wrapper?.removeEventListener('wheel', onWheel, true);
    })();

    return () => {
      cancelled = true;
      detachWheel?.();
      if (settleTimer) clearTimeout(settleTimer);
      resizeObserver?.disconnect();
      pinElementsRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsKey]);

  if (pins.length === 0) return null;

  const venueCount = new Set(locations.map((l) => `${l.city}|${l.venue}`)).size;

  return (
    <div className="mt-10">
      <style>{PIN_CSS}</style>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-purple/10 text-brand-purple">
          <MapPin size={20} />
        </span>
        <div>
          <h3 className="text-xl font-black text-brand-ink md:text-2xl">Kde nás najdeš</h3>
          <p className="text-sm font-bold text-brand-ink-soft">
            {pins.length} měst · {venueCount} tělocvičen · klikni na město
          </p>
        </div>
      </div>
      {/* isolate: z-indexy Leafletu a tlačítka zůstanou uvnitř mapy a nepřelezou pevnou lištu webu. */}
      <div ref={wrapperRef} className="relative isolate mt-4">
        <div
          ref={containerRef}
          className="vys-web-map z-0 h-[380px] w-full overflow-hidden rounded-[24px] border border-brand-purple/15 shadow-brand-soft md:h-[460px]"
        />
        <button
          type="button"
          onClick={() => homeRef.current?.()}
          aria-label="Zpět na celou ČR"
          className="absolute right-3 top-3 z-[500] inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/75 text-brand-ink shadow-[0_6px_18px_rgba(23,18,32,0.14)] backdrop-blur-md transition-all duration-200 hover:bg-white active:scale-95"
        >
          <RotateCcw size={18} />
        </button>
      </div>
    </div>
  );
}
