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
  jesenice: { lat: 49.9686, lng: 14.5128 },
  jesenik: { lat: 50.2243, lng: 17.1998 },
  kobylisy: { lat: 50.1273, lng: 14.4519 },
  prostejov: { lat: 49.4719, lng: 17.1093 },
  vrsovice: { lat: 50.0682, lng: 14.4576 },
  vyskov: { lat: 49.2792, lng: 16.9986 },
};

// Směr popisku, ať se štítky blízkých měst (Praha a okolí) nepřekrývají
const LABEL_DIR: Record<string, 'top' | 'bottom' | 'left' | 'right'> = {
  blansko: 'left',
  brandys: 'top',
  jesenice: 'bottom',
  jesenik: 'top',
  kobylisy: 'left',
  prostejov: 'top',
  vrsovice: 'right',
  vyskov: 'bottom',
};

const LABEL_POS: Record<'top' | 'bottom' | 'left' | 'right', string> = {
  top: 'left:0;top:-13px;transform:translate(-50%,-100%);',
  bottom: 'left:0;top:13px;transform:translateX(-50%);',
  left: 'left:-13px;top:0;transform:translate(-100%,-50%);',
  right: 'left:13px;top:0;transform:translateY(-50%);',
};

type MapLocation = { city: string; venue: string };

export function CourseLocationsMap({ locations, onCityPick }: { locations: MapLocation[]; onCityPick?: (cityKey: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const homeRef = useRef<(() => void) | null>(null);
  const pickRef = useRef(onCityPick);
  pickRef.current = onCityPick;

  const byCity = new Map<string, { key: string; city: string; venues: string[] }>();
  for (const loc of locations) {
    const key = normalizeCity(loc.city);
    if (!CITY_POINTS[key]) continue;
    const entry = byCity.get(key) ?? { key, city: loc.city, venues: [] };
    if (!entry.venues.includes(loc.venue)) entry.venues.push(loc.venue);
    byCity.set(key, entry);
  }
  const pins = Array.from(byCity.values());
  const pinsKey = pins.map((p) => p.key).sort().join(',');

  useEffect(() => {
    if (!containerRef.current || pins.length === 0) return;
    let cancelled = false;
    let detachWheel: (() => void) | null = null;

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
        scrollWheelZoom: true,
        // Mírnější citlivost zoomu kolečkem
        wheelPxPerZoomLevel: 160,
        zoomSnap: 0.5,
        zoomDelta: 0.5,
        minZoom: 6,
        maxZoom: 17,
      });
      mapRef.current = map;
      if (coarse) {
        // Jistota: jedním prstem projde scroll stránky, pinch chytá Leaflet
        containerRef.current.style.touchAction = 'pan-y';
      }

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const bounds = L.latLngBounds([]);
      for (const pin of pins) {
        const point = CITY_POINTS[pin.key];
        bounds.extend([point.lat, point.lng]);
        const icon = L.divIcon({
          className: '',
          iconSize: [0, 0],
          html: `<div style="position:relative;width:0;height:0;cursor:pointer;">
            <span style="position:absolute;left:0;top:0;width:18px;height:18px;transform:translate(-50%,-50%);border-radius:9999px;background:#8B1DFF;border:3px solid #fff;box-shadow:0 2px 10px rgba(139,29,255,0.55);"></span>
            <span style="position:absolute;${LABEL_POS[LABEL_DIR[pin.key] ?? 'bottom']}padding:3px 9px;border-radius:9999px;background:#171220;color:#fff;font-size:11px;font-weight:800;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${pin.city}</span>
          </div>`,
        });
        const marker = L.marker([point.lat, point.lng], { icon }).addTo(map);
        marker.bindTooltip(pin.venues.join(' · '), { direction: 'top', offset: [0, -14], opacity: 0.95 });
        marker.on('click', () => pickRef.current?.(pin.key));
      }

      map.fitBounds(bounds, { padding: [70, 70] });
      homeRef.current = () => map.fitBounds(bounds, { padding: [70, 70] });
      // Mapa jen pro ČR a blízké okolí — nejde odjet ani odzoomovat na celý svět
      map.setMaxBounds(bounds.pad(1.1));
      map.setMinZoom(Math.floor(map.getZoom()));
      map.options.maxBoundsViscosity = 1.0;

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
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsKey]);

  if (pins.length === 0) return null;

  const venueCount = new Set(locations.map((l) => `${l.city}|${l.venue}`)).size;

  return (
    <div className="mt-10">
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
      <div ref={wrapperRef} className="relative mt-4">
        <div
          ref={containerRef}
          className="z-0 h-[380px] w-full overflow-hidden rounded-[24px] border border-brand-purple/15 shadow-brand-soft md:h-[460px]"
        />
        <button
          type="button"
          onClick={() => homeRef.current?.()}
          aria-label="Zpět na celou ČR"
          className="absolute right-3 top-3 z-[500] inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-purple/20 bg-white text-brand-purple shadow-brand-soft transition-colors hover:bg-brand-purple hover:text-white"
        >
          <RotateCcw size={18} />
        </button>
      </div>
    </div>
  );
}
