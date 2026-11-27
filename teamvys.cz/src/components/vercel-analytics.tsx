'use client';

import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next';

// Vercel Web Analytics — bez cookies, proto jede i bez souhlasu. Interní sekce se do návštěvnosti nepočítají.
const INTERNAL_PREFIXES = ['/admin', '/rodic', '/checkout', '/nastaveni-hesla', '/sign-in'];

function dropInternal(event: BeforeSendEvent) {
  const path = new URL(event.url).pathname;
  return INTERNAL_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) ? null : event;
}

export function VercelAnalytics() {
  return <Analytics beforeSend={dropInternal} />;
}
