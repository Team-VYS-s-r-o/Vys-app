import { corsHeaders, jsonResponse, requiredString, stripeRequest, supabaseRestHeaders, supabaseRestUrl } from '../_shared/http.ts';

type StripeSession = {
  id: string;
  amount_total: number | null;
  created: number;
  metadata?: Record<string, string>;
  payment_intent?: string | { id?: string } | null;
  payment_status: string;
};

type PurchaseRow = {
  id: string;
  org_id?: string;
  parent_profile_id?: string | null;
  product_id: string;
  participant_id: string;
  participant_name: string;
  type: 'Kroužek' | 'Tábor' | 'Workshop';
  title: string;
  amount: number;
  original_amount?: number | null;
  discount_code?: string | null;
  discount_percent?: number | null;
  discount_amount?: number;
  price_label: string;
  place: string;
  status: 'Zaplaceno';
  paid_at: string;
  event_date: string | null;
  expires_at: string | null;
  stripe_checkout_session_id?: string;
  stripe_payment_intent_id?: string | null;
};

type ProductRow = {
  id: string;
  type: 'Kroužek' | 'Tábor' | 'Workshop';
  title: string;
  place: string;
  entries_total: number | null;
  event_date: string | null;
  expires_at: string | null;
};

function paidAtText(created: number) {
  return new Date(created * 1000).toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' });
}

function paymentIntentId(session: StripeSession) {
  if (typeof session.payment_intent === 'string') return session.payment_intent;
  if (typeof session.payment_intent?.id === 'string') return session.payment_intent.id;
  return null;
}

async function upsertPurchase(row: PurchaseRow) {
  const response = await fetch(supabaseRestUrl('parent_purchases?on_conflict=id'), {
    method: 'POST',
    headers: {
      ...supabaseRestHeaders(),
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify([row]),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.message === 'string' ? data.message : 'Nepodařilo se uložit potvrzenou platbu.');
  return Array.isArray(data) && data[0] ? data[0] as PurchaseRow : row;
}

async function getProduct(productId: string) {
  const response = await fetch(
    supabaseRestUrl(`products?id=eq.${encodeURIComponent(productId)}&select=id,type,title,place,entries_total,event_date,expires_at&limit=1`),
    { headers: supabaseRestHeaders() },
  );
  const data = await response.json().catch(() => []);
  if (!response.ok || !Array.isArray(data) || !data[0]) throw new Error('Produkt pro potvrzenou platbu nebyl nalezen.');
  return data[0] as ProductRow;
}

async function updateProductCapacity(productId: string) {
  const countResponse = await fetch(
    supabaseRestUrl(`parent_purchases?product_id=eq.${encodeURIComponent(productId)}&status=eq.Zaplaceno&select=id`),
    { headers: { ...supabaseRestHeaders(), Prefer: 'count=exact' } },
  );
  if (!countResponse.ok) throw new Error('Nepodařilo se přepočítat kapacitu produktu.');

  const contentRange = countResponse.headers.get('content-range') || '';
  const count = Number(contentRange.split('/')[1] || 0);

  const updateResponse = await fetch(supabaseRestUrl(`products?id=eq.${encodeURIComponent(productId)}`), {
    method: 'PATCH',
    headers: supabaseRestHeaders(),
    body: JSON.stringify({ capacity_current: Number.isFinite(count) ? count : 0 }),
  });
  if (!updateResponse.ok) throw new Error('Nepodařilo se uložit kapacitu produktu.');
}

async function participantPurchaseSummary(participantId: string) {
  const response = await fetch(
    supabaseRestUrl(`parent_purchases?participant_id=eq.${encodeURIComponent(participantId)}&status=eq.Zaplaceno&select=id,product_id,type,title,status,place,paid_at,created_at&order=created_at.desc`),
    { headers: supabaseRestHeaders() },
  );
  const data = await response.json().catch(() => []);
  if (!response.ok || !Array.isArray(data)) throw new Error('Nepodařilo se načíst nákupy účastníka.');

  return data.map((purchase) => ({
    purchaseId: purchase.id,
    productId: purchase.product_id,
    type: purchase.type,
    title: purchase.title,
    status: 'Aktivní',
    place: purchase.place,
    paidAt: purchase.paid_at,
  }));
}

async function updateParticipantPurchases(purchase: PurchaseRow, product: ProductRow) {
  const update: Record<string, unknown> = {
    paid_status: 'paid',
    active_purchases: await participantPurchaseSummary(purchase.participant_id),
  };

  if (product.type === 'Kroužek') update.active_course = product.place;
  if (product.event_date || product.expires_at) update.next_training = product.event_date || product.expires_at;

  const response = await fetch(supabaseRestUrl(`participants?id=eq.${encodeURIComponent(purchase.participant_id)}`), {
    method: 'PATCH',
    headers: supabaseRestHeaders(),
    body: JSON.stringify(update),
  });
  if (!response.ok) throw new Error('Nepodařilo se propsat nákup k účastníkovi.');
}

async function upsertDigitalPass(purchase: PurchaseRow, product: ProductRow) {
  const totalEntries = Math.max(Number(product.entries_total || (product.type === 'Kroužek' ? 10 : 1)), 1);
  const chipPrefix = product.type === 'Kroužek' ? 'NFC' : 'QR';
  const passId = `pass-${purchase.id}`;

  const existingResponse = await fetch(
    supabaseRestUrl(`digital_passes?id=eq.${encodeURIComponent(passId)}&select=used_entries,last_scan_at,last_scan_place&limit=1`),
    { headers: supabaseRestHeaders() },
  );
  const existingRows = await existingResponse.json().catch(() => []);
  if (!existingResponse.ok) throw new Error('Nepodařilo se načíst existující digitální vstup.');
  const existingPass = Array.isArray(existingRows) ? existingRows[0] : null;

  const pass = {
    id: passId,
    participant_id: purchase.participant_id,
    holder_name: purchase.participant_name,
    title: product.type === 'Kroužek' ? `Permanentka ${totalEntries} vstupů` : `${product.title} · ticket`,
    location: product.place,
    nfc_chip_id: `${chipPrefix}-${purchase.participant_id.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()}-${product.id.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()}`,
    total_entries: totalEntries,
    used_entries: Number(existingPass?.used_entries || 0),
    last_scan_at: existingPass?.last_scan_at ?? null,
    last_scan_place: existingPass?.last_scan_place ?? product.place,
  };

  const response = await fetch(supabaseRestUrl('digital_passes?on_conflict=id'), {
    method: 'POST',
    headers: { ...supabaseRestHeaders(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([pass]),
  });
  if (!response.ok) throw new Error('Nepodařilo se vytvořit digitální vstup pro účastníka.');
}

async function upsertParentPayment(purchase: PurchaseRow) {
  const response = await fetch(supabaseRestUrl('parent_payments?on_conflict=id'), {
    method: 'POST',
    headers: { ...supabaseRestHeaders(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{
      id: `payment-${purchase.id}`,
      org_id: purchase.org_id || '00000000-0000-4000-8000-000000000001',
      participant_id: purchase.participant_id,
      participant_name: purchase.participant_name,
      title: purchase.title,
      amount: purchase.amount,
      due_date: purchase.paid_at,
      status: 'paid',
      stripe_ready: true,
    }]),
  });
  if (!response.ok) throw new Error('Nepodařilo se propsat platbu rodiči.');
}

async function syncPaidPurchaseSideEffects(purchase: PurchaseRow) {
  const product = await getProduct(purchase.product_id);
  await Promise.all([
    updateProductCapacity(purchase.product_id),
    updateParticipantPurchases(purchase, product),
    upsertDigitalPass(purchase, product),
    upsertParentPayment(purchase),
  ]);
}

function toClientPurchase(row: PurchaseRow) {
  return {
    id: row.id,
    productId: row.product_id,
    participantId: row.participant_id,
    participantName: row.participant_name,
    type: row.type,
    title: row.title,
    amount: row.amount,
    priceLabel: row.price_label,
    place: row.place,
    status: row.status,
    paidAt: row.paid_at,
    eventDate: row.event_date ?? undefined,
    expiresAt: row.expires_at ?? undefined,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = requiredString(body.sessionId, 'sessionId');
    const session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent`) as StripeSession;

    if (session.payment_status !== 'paid') throw new Error('Stripe platba ještě není zaplacená.');

    const metadata = session.metadata ?? {};
    const amount = Number(metadata.amount || Math.round((session.amount_total ?? 0) / 100));

    const row: PurchaseRow = {
      id: `stripe-${session.id}`,
      org_id: metadata.org_id || '00000000-0000-4000-8000-000000000001',
      parent_profile_id: metadata.parent_profile_id || null,
      product_id: requiredString(metadata.product_id, 'product metadata'),
      participant_id: requiredString(metadata.participant_id, 'participant metadata'),
      participant_name: requiredString(metadata.participant_name, 'participantName metadata'),
      type: requiredString(metadata.type, 'type metadata') as PurchaseRow['type'],
      title: requiredString(metadata.title, 'title metadata'),
      amount,
      original_amount: Number(metadata.original_amount || amount),
      discount_code: metadata.discount_code || null,
      discount_percent: metadata.discount_percent ? Number(metadata.discount_percent) : null,
      discount_amount: metadata.discount_amount ? Number(metadata.discount_amount) : 0,
      price_label: metadata.price_label || `${amount} Kč`,
      place: requiredString(metadata.place, 'place metadata'),
      status: 'Zaplaceno',
      paid_at: paidAtText(session.created),
      event_date: metadata.event_date || null,
      expires_at: metadata.expires_at || null,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId(session),
    };

    const saved = await upsertPurchase(row);
    await syncPaidPurchaseSideEffects(saved);
    return jsonResponse({ purchase: toClientPurchase(saved) });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Stripe platbu se nepodařilo ověřit.' }, 400);
  }
});