'use client';

// Interactive location picker for admin product forms — lets the admin drop a
// pin on the EXACT building (e.g. the gym) instead of relying purely on a
// free-text address that gets fuzzily geocoded. The resulting lat/lng is what
// coach attendance GPS check-in verifies against (see
// geocodeProductLocation / persistCourseCoachAssignments in admin-dashboard.tsx,
// which prefer this admin-picked pin over a Nominatim text search).
//
// No internal address box here — the parent form already has an "Adresa pro
// mapu" text field; this component exposes searchAddress() via ref so a
// single "Najít na mapě" button (next to that field) can drive the map. This
// avoids two competing address inputs and never auto-searches on mount (which
// used to fire against whatever placeholder text happened to be in the form).
//
// Uses vanilla Leaflet loaded from a CDN (no API key, no new npm dependency —
// matches the same technique already used for the mobile app's spots map).
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

type LatLng = { lat: number; lng: number };

type LeafletMap = {
  setView: (center: [number, number], zoom: number) => void;
  on: (event: string, handler: (e: { latlng: { lat: number; lng: number } }) => void) => void;
  invalidateSize: () => void;
  remove: () => void;
};
type LeafletMarker = {
  setLatLng: (latlng: [number, number] | { lat: number; lng: number }) => void;
  getLatLng: () => { lat: number; lng: number };
  on: (event: string, handler: () => void) => void;
};
type LeafletNamespace = {
  map: (el: HTMLElement, options?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, options: Record<string, unknown>) => { addTo: (map: LeafletMap) => void };
  marker: (latlng: [number, number], options?: Record<string, unknown>) => LeafletMarker & { addTo: (map: LeafletMap) => LeafletMarker };
};

declare global {
  interface Window {
    L?: LeafletNamespace;
  }
}

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const CZECHIA_CENTER: LatLng = { lat: 49.8175, lng: 15.473 };

let leafletLoadPromise: Promise<void> | null = null;
function loadLeaflet(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.L) return Promise.resolve();
  if (leafletLoadPromise) return leafletLoadPromise;
  leafletLoadPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Mapu se nepodařilo načíst.'));
    document.body.appendChild(script);
  });
  return leafletLoadPromise;
}

export type LocationPickerMapHandle = {
  /** Geocode the given free-text address and move the pin there. */
  searchAddress: (query: string) => Promise<void>;
};

export const LocationPickerMap = forwardRef<
  LocationPickerMapHandle,
  {
    latitude?: number;
    longitude?: number;
    onChange: (coords: { latitude: number; longitude: number }) => void;
  }
>(function LocationPickerMap({ latitude, longitude, onChange }, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const invalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [coords, setCoords] = useState<LatLng | null>(
    typeof latitude === 'number' && typeof longitude === 'number' ? { lat: latitude, lng: longitude } : null,
  );
  const hasInitialPin = coords !== null;

  useEffect(() => {
    let cancelled = false;

    void loadLeaflet().then(() => {
      if (cancelled || !containerRef.current || !window.L) return;
      const L = window.L;
      const initial = coords ?? CZECHIA_CENTER;
      const map = L.map(containerRef.current);
      map.setView([initial.lat, initial.lng], hasInitialPin ? 16 : 7);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      const marker = L.marker([initial.lat, initial.lng], { draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setCoords({ lat: pos.lat, lng: pos.lng });
        setMessage(null);
        onChange({ latitude: pos.lat, longitude: pos.lng });
      });
      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        setCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
        setMessage(null);
        onChange({ latitude: e.latlng.lat, longitude: e.latlng.lng });
      });

      mapRef.current = map;
      markerRef.current = marker;
      setReady(true);

      // This map often gets created while its container is still mid-animation
      // (e.g. inside a framer-motion modal that scales in). Leaflet measures
      // the container size once at init, so if that happened before the modal
      // settled, clicks resolve against a stale/wrong size and land on the
      // wrong lat/lng (or appear to do nothing). Recompute the size once the
      // container has settled, and again on every real resize.
      requestAnimationFrame(() => map.invalidateSize());
      invalidateTimerRef.current = setTimeout(() => map.invalidateSize(), 350);
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(containerRef.current);
        resizeObserverRef.current = observer;
      }
    });

    return () => {
      cancelled = true;
      if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Only initialize once — updates happen imperatively via the map/marker refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(query: string) {
    const q = query.trim();
    if (!q) {
      setMessage('Nejdřív vyplň adresu výše.');
      return;
    }
    setSearching(true);
    setMessage(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cz&accept-language=cs&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      const results = (await res.json()) as Array<{ lat: string; lon: string }>;
      const hit = results[0];
      if (!hit) {
        setMessage('Adresa nebyla nalezena. Zkus přesnější název, nebo klikni přímo na mapu.');
        return;
      }
      const lat = Number(hit.lat);
      const lng = Number(hit.lon);
      mapRef.current?.setView([lat, lng], 17);
      markerRef.current?.setLatLng([lat, lng]);
      setCoords({ lat, lng });
      onChange({ latitude: lat, longitude: lng });
    } catch {
      setMessage('Vyhledávání se nepodařilo. Zkus to znovu, nebo klikni přímo na mapu.');
    } finally {
      setSearching(false);
    }
  }

  useImperativeHandle(ref, () => ({ searchAddress: runSearch }), []);

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="h-[260px] w-full overflow-hidden rounded-[14px] border border-brand-purple/15 bg-brand-paper" />
      {!ready ? <p className="text-[11px] font-bold text-brand-ink-soft">Načítám mapu…</p> : null}
      {searching ? <p className="text-[11px] font-bold text-brand-ink-soft">Hledám adresu…</p> : null}
      {coords ? (
        <p className="text-[11px] font-bold text-brand-ink-soft">
          Přesná pozice: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} · klikni na mapu nebo přetáhni špendlík pro upřesnění
        </p>
      ) : (
        <p className="text-[11px] font-bold text-brand-ink-soft">Klikni přímo na mapu na přesné místo tělocvičny, nebo vyplň adresu výše a klikni na „Najít na mapě".</p>
      )}
      {message ? <p className="text-[11px] font-bold text-red-600">{message}</p> : null}
    </div>
  );
});

