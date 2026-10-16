import { corsHeaders, jsonResponse, requiredString, stripeRequest, supabaseRestHeaders, supabaseRestUrl, todayIsoDate } from '../_shared/http.ts';

type ExistingTransferRow = {
  id: string;
  status: string;
};

type PayoutTransferRow = {
  id: string;
  coach_id: string;
  coach_name: string;
  period_key: string;
  period_start: string;
  period_end: string;
  amount: number;
  currency: 'czk';
  status: 'paid' | 'pending' | 'failed';
  mode: 'connect_transfer';
  stripe_account_id: string;
  stripe_transfer_id: string | null;
  stripe_payout_id: string | null;
  created_at_text: string;
  available_from: string;
};

function nextMonthFirstIso(periodEndIso: string) {
  const [year, month] = periodEndIso.split('-').map(Number);
  if (!year || !month) throw new Error('Neplatný konec období výplaty.');

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
}

function createdAtText() {
  return new Date().toLocaleString('cs-CZ', { timeZone: 'Europe/Prague', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function filteredRestUrl(table: string, filters: Record<string, string | string[]>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    const values = Array.isArray(value) ? value : [value];
    values.forEach((item) => params.append(key, item));
  });
  return supabaseRestUrl(`${table}?${params.toString()}`);
}

async function sumAmounts(table: string, coachId: string, periodStart: string, periodEnd: string) {
  const response = await fetch(filteredRestUrl(table, {
    coach_id: `eq.${coachId}`,
    created_at: [`gte.${periodStart}T00:00:00.000Z`, `lte.${periodEnd}T23:59:59.999Z`],
    select: 'amount',
  }), { headers: supabaseRestHeaders() });

  const rows = await response.json().catch(() => []);
  if (!response.ok) throw new Error('Nepodařilo se spočítat podklady výplaty.');
  return Array.isArray(rows) ? rows.reduce((sum, row) => sum + Number(row?.amount || 0), 0) : 0;
}

async function approvedBonuses(coachId: string) {
  const response = await fetch(filteredRestUrl('coach_payouts', {
    coach_id: `eq.${coachId}`,
    select: 'approved_bonuses',
    limit: '1',
  }), { headers: supabaseRestHeaders() });

  const rows = await response.json().catch(() => []);
  if (!response.ok) throw new Error('Nepodařilo se načíst schválené bonusy trenéra.');
  return Array.isArray(rows) && rows[0] ? Number(rows[0].approved_bonuses || 0) : 0;
}

async function calculatePayoutAmount(coachId: string, periodStart: string, periodEnd: string) {
  const [attendanceAmount, adjustmentAmount, bonusAmount] = await Promise.all([
    sumAmounts('coach_attendance_records', coachId, periodStart, periodEnd),
    sumAmounts('admin_attendance_adjustments', coachId, periodStart, periodEnd),
    approvedBonuses(coachId),
  ]);

  return Math.round(attendanceAmount + adjustmentAmount + bonusAmount);
}

async function ensureNotPaid(coachId: string, periodKey: string) {
  const response = await fetch(
    supabaseRestUrl(`admin_coach_payout_transfers?coach_id=eq.${encodeURIComponent(coachId)}&period_key=eq.${encodeURIComponent(periodKey)}&status=in.(paid,pending)&select=id,status&limit=1`),
    { headers: supabaseRestHeaders() },
  );
  const rows = await response.json().catch(() => []);
  if (!response.ok) throw new Error('Nepodařilo se zkontrolovat předchozí výplaty.');
  if (Array.isArray(rows) && rows.length > 0) throw new Error('Tento trenér už má výplatu za daný měsíc odeslanou.');
}

async function saveTransfer(row: PayoutTransferRow) {
  const response = await fetch(supabaseRestUrl('admin_coach_payout_transfers?on_conflict=coach_id,period_key'), {
    method: 'POST',
    headers: {
      ...supabaseRestHeaders(),
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify([row]),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.message === 'string' ? data.message : 'Výplatu se nepodařilo uložit.');
  return Array.isArray(data) && data[0] ? data[0] as PayoutTransferRow : row;
}

function toClientTransfer(row: PayoutTransferRow) {
  return {
    id: row.id,
    coachId: row.coach_id,
    coachName: row.coach_name,
    periodKey: row.period_key,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    mode: row.mode,
    stripeAccountId: row.stripe_account_id,
    stripeTransferId: row.stripe_transfer_id ?? undefined,
    stripePayoutId: row.stripe_payout_id ?? undefined,
    createdAt: row.created_at_text,
    availableFrom: row.available_from,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await request.json().catch(() => ({}));
    const coachId = requiredString(body.coachId, 'coachId');
    const coachName = requiredString(body.coachName, 'coachName');
    const periodKey = requiredString(body.periodKey, 'periodKey');
    const periodStart = requiredString(body.periodStart, 'periodStart');
    const periodEnd = requiredString(body.periodEnd, 'periodEnd');
    const stripeAccountId = requiredString(body.stripeAccountId, 'Stripe Connect účet trenéra');
    const requestedAmount = Math.round(Number(body.amount || 0));
    const currency = body.currency === 'czk' || !body.currency ? 'czk' : null;

    if (!currency) throw new Error('Podporovaná měna pro výplaty je zatím jen CZK.');
    const calculatedAmount = await calculatePayoutAmount(coachId, periodStart, periodEnd);
    const amount = calculatedAmount > 0 ? calculatedAmount : requestedAmount;
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Částka výplaty musí být větší než 0 Kč.');
    if (!stripeAccountId.startsWith('acct_')) throw new Error('Stripe účet trenéra musí být Connect účet ve tvaru acct_...');

    const availableFrom = nextMonthFirstIso(periodEnd);
    if (todayIsoDate() < availableFrom) throw new Error(`Výplatu za ${periodKey} lze poslat nejdříve ${availableFrom}.`);

    await ensureNotPaid(coachId, periodKey);

    const params = new URLSearchParams();
    params.set('amount', String(amount * 100));
    params.set('currency', currency);
    params.set('destination', stripeAccountId);
    params.set('description', `Team VYS výplata ${coachName} ${periodKey}`);
    params.set('metadata[coach_id]', coachId);
    params.set('metadata[coach_name]', coachName);
    params.set('metadata[period_key]', periodKey);
    params.set('metadata[period_start]', periodStart);
    params.set('metadata[period_end]', periodEnd);
    params.set('metadata[calculated_amount]', String(calculatedAmount));

    const transfer = await stripeRequest('/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    const row: PayoutTransferRow = {
      id: `coach-payout-${coachId}-${periodKey}`,
      coach_id: coachId,
      coach_name: coachName,
      period_key: periodKey,
      period_start: periodStart,
      period_end: periodEnd,
      amount,
      currency,
      status: 'paid',
      mode: 'connect_transfer',
      stripe_account_id: stripeAccountId,
      stripe_transfer_id: typeof transfer.id === 'string' ? transfer.id : null,
      stripe_payout_id: null,
      created_at_text: createdAtText(),
      available_from: availableFrom,
    };

    const saved = await saveTransfer(row);
    return jsonResponse({ transfer: toClientTransfer(saved), calculatedAmount });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Výplatu se nepodařilo odeslat přes Stripe.' }, 400);
  }
});