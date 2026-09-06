import { corsHeaders, jsonResponse, requiredString, stripeRequest, supabaseRestHeaders, supabaseRestUrl } from '../_shared/http.ts';

type ProductRow = {
  id: string;
  type: 'Kroužek' | 'Tábor' | 'Workshop';
  title: string;
  price: number;
  price_label: string;
  place: string;
  event_date: string | null;
  expires_at: string | null;
  capacity_total: number | null;
  org_id: string;
};

type ParticipantRow = {
  first_name: string;
  last_name: string;
};

async function getProduct(productId: string) {
  const response = await fetch(
    supabaseRestUrl(`products?id=eq.${encodeURIComponent(productId)}&select=id,type,title,price,price_label,place,event_date,expires_at,capacity_total,org_id&limit=1`),
    { headers: supabaseRestHeaders() },
  );
  const rows = await response.json().catch(() => []);
  if (!response.ok || !Array.isArray(rows) || rows.length === 0) throw new Error('Produkt pro Stripe platbu nebyl nalezen v Supabase.');
  return rows[0] as ProductRow;
}

async function ensureCapacity(product: ProductRow) {
  if (!product.capacity_total) return;

  const response = await fetch(
    supabaseRestUrl(`parent_purchases?product_id=eq.${encodeURIComponent(product.id)}&status=eq.Zaplaceno&select=id`),
    { headers: { ...supabaseRestHeaders(), Prefer: 'count=exact' } },
  );
  if (!response.ok) throw new Error('Nepodařilo se ověřit kapacitu produktu.');

  const used = Number((response.headers.get('content-range') || '').split('/')[1] || 0);
  if (used >= product.capacity_total) throw new Error(`Kapacita produktu je plná (${used}/${product.capacity_total}).`);
}

async function getParticipantName(participantId: string, fallback: string) {
  const response = await fetch(
    supabaseRestUrl(`participants?id=eq.${encodeURIComponent(participantId)}&select=first_name,last_name&limit=1`),
    { headers: supabaseRestHeaders() },
  );
  const rows = await response.json().catch(() => []);
  if (!response.ok || !Array.isArray(rows) || rows.length === 0) return fallback;

  const participant = rows[0] as ParticipantRow;
  return `${participant.first_name} ${participant.last_name}`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await request.json().catch(() => ({}));
    const productId = requiredString(body.productId, 'productId');
    const participantId = requiredString(body.participantId, 'participantId');
    const fallbackParticipantName = requiredString(body.participantName, 'participantName');
    const successUrl = requiredString(body.successUrl, 'successUrl');
    const cancelUrl = requiredString(body.cancelUrl, 'cancelUrl');
    const parentProfileId = typeof body.parentProfileId === 'string' ? body.parentProfileId.trim() : '';

    const product = await getProduct(productId);
    await ensureCapacity(product);
    const participantName = await getParticipantName(participantId, fallbackParticipantName);
    const amount = Math.round(Number(product.price));

    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Produkt má neplatnou cenu.');

    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('locale', 'cs');
    params.set('success_url', successUrl);
    params.set('cancel_url', cancelUrl);
    params.set('allow_promotion_codes', 'true');
    params.set('line_items[0][quantity]', '1');
    params.set('line_items[0][price_data][currency]', 'czk');
    params.set('line_items[0][price_data][unit_amount]', String(amount * 100));
    params.set('line_items[0][price_data][product_data][name]', product.title);
    params.set('line_items[0][price_data][product_data][description]', `${product.place} · ${participantName}`);

    const metadata = {
      parent_profile_id: parentProfileId,
      product_id: product.id,
      participant_id: participantId,
      participant_name: participantName,
      type: product.type,
      title: product.title,
      amount: String(amount),
      price_label: product.price_label,
      place: product.place,
      org_id: product.org_id || '00000000-0000-4000-8000-000000000001',
      event_date: product.event_date ?? '',
      expires_at: product.expires_at ?? '',
    };

    for (const [key, value] of Object.entries(metadata)) {
      params.set(`metadata[${key}]`, value);
      params.set(`payment_intent_data[metadata][${key}]`, value);
    }

    const session = await stripeRequest('/checkout/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    return jsonResponse({ id: session.id, url: session.url });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Stripe Checkout se nepodařilo vytvořit.' }, 400);
  }
});