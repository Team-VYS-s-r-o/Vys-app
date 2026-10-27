'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

// Meta Pixel „Team VYS web" + GA4 TeamVYS_Analytics (zadání docs/zadani-meta-pixel-ga4.md).
export const META_PIXEL_ID = '1729085625407355';
export const GA4_MEASUREMENT_ID = 'G-NSSLDPLBNF';

const CONSENT_KEY = 'vys-cookie-consent';
export const CONSENT_EVENT = 'vys-consent-changed';

type FbqFn = (...args: unknown[]) => void;
type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: FbqFn;
    _fbq?: FbqFn;
    gtag?: GtagFn;
    dataLayer?: unknown[];
  }
}

export function hasMarketingConsent(): boolean {
  try {
    return window.localStorage.getItem(CONSENT_KEY) === 'all';
  } catch {
    return false;
  }
}

let loaded = false;

/** Skripty se vkládají až PO souhlasu „Přijmout vše" — před ním nic neběží (GDPR). */
function loadAnalytics() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;

  // Meta Pixel
  const fbq: FbqFn & { queue?: unknown[]; callMethod?: FbqFn; push?: FbqFn; loaded?: boolean; version?: string } = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else (fbq.queue as unknown[]).push(args);
  };
  if (!window.fbq) {
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;
    const pixelScript = document.createElement('script');
    pixelScript.async = true;
    pixelScript.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(pixelScript);
  }
  window.fbq?.('init', META_PIXEL_ID);
  window.fbq?.('track', 'PageView');

  // GA4
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA4_MEASUREMENT_ID, { anonymize_ip: true });
  const gaScript = document.createElement('script');
  gaScript.async = true;
  gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`;
  document.head.appendChild(gaScript);
}

/** Pošle událost do Pixelu i GA4; `eventId` slouží k deduplikaci se server-side CAPI. */
export function trackEvent(name: string, params: Record<string, unknown> = {}, eventId?: string) {
  if (!loaded) return;
  const standard = ['ViewContent', 'Lead', 'InitiateCheckout', 'Purchase', 'PageView'].includes(name);
  window.fbq?.(standard ? 'track' : 'trackCustom', name, params, eventId ? { eventID: eventId } : undefined);
  window.gtag?.('event', name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase(), params);
}

export function SiteAnalytics() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (hasMarketingConsent()) loadAnalytics();
    const onConsent = () => {
      if (hasMarketingConsent()) loadAnalytics();
    };
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!loaded) return;
    window.fbq?.('track', 'PageView');
    window.gtag?.('event', 'page_view', { page_path: pathname });
  }, [pathname]);

  return null;
}
