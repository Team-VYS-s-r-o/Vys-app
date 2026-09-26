const crypto = require('crypto');
const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const nodemailer = require('nodemailer');
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const app = express();

function envValue(name) {
  return (process.env[name] || '').replace(/\\n/g, '\n').trim();
}

const port = Number(process.env.SERVER_PORT || 3001);
const defaultCorsOrigins = [
  'https://teamvys.cz',
  'https://www.teamvys.cz',
  'https://vys-web.vercel.app',
  'https://vys-app.vercel.app',
  'https://aplikacevys-web.vercel.app',
  'https://aplikacevys.cz',
  'https://www.aplikacevys.cz',
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:8081',
  'http://localhost:8088',
];
const configuredCorsOrigins = envValue('CORS_ORIGIN')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultCorsOrigins, ...configuredCorsOrigins]));

const supabaseUrl = envValue('SUPABASE_URL') || envValue('EXPO_PUBLIC_SUPABASE_URL');
const supabaseServiceKey = envValue('SUPABASE_SERVICE_ROLE_KEY');
const stripeSecretKey = envValue('STRIPE_SECRET_KEY');
const stripeWebhookSecret = envValue('STRIPE_WEBHOOK_SECRET');
const stripePublishableKey = envValue('STRIPE_PUBLISHABLE_KEY');
const smtpHost = envValue('SMTP_HOST');
const smtpPort = Number(envValue('SMTP_PORT') || 587);
const smtpUser = envValue('SMTP_USER');
const smtpPass = envValue('SMTP_PASS');
const smtpFrom = envValue('SMTP_FROM') || envValue('PAYMENT_CONFIRMATION_FROM') || smtpUser;
const isProduction = envValue('NODE_ENV') === 'production';

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : null;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
let paymentEmailTransporter = null;

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
  credentials: true,
}));

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), asyncRoute(async (request, response) => {
  requireServices();

  const orgId = optionalString(request.query.org_id) || null;
  const isOrgWebhook = orgId && orgId !== VYS_ORG_ID;

  const signature = request.headers['stripe-signature'];
  let event;
  let webhookClient;

  if (isOrgWebhook) {
    // External org webhook — look up org's own Stripe key + webhook secret.
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('stripe_secret_key,stripe_webhook_secret')
      .eq('id', orgId)
      .maybeSingle();
    if (orgError || !org) throw new Error(`Org ${orgId} not found for webhook routing.`);

    webhookClient = org.stripe_secret_key ? new Stripe(org.stripe_secret_key) : null;
    const orgWebhookSecret = org.stripe_webhook_secret;

    if (!orgWebhookSecret) {
      // No secret configured — accept unsigned in dev, reject in prod.
      if (isProduction) throw new Error(`Missing stripe_webhook_secret for org ${orgId}. Refusing unsigned webhook.`);
      event = JSON.parse(request.body.toString('utf8'));
    } else {
      if (!signature) throw new Error('Missing Stripe webhook signature.');
      // Use platform Stripe's webhooks helper to verify (crypto only, no API call).
      if (!webhookClient) throw new Error(`Missing stripe_secret_key for org ${orgId}.`);
      event = webhookClient.webhooks.constructEvent(request.body, signature, orgWebhookSecret);
    }
  } else {
    // VYS platform webhook.
    requireStripe();
    webhookClient = stripe;
    if (!stripeWebhookSecret) {
      if (isProduction) throw new Error('Missing STRIPE_WEBHOOK_SECRET on the backend. Refusing unsigned Stripe webhook.');
      event = JSON.parse(request.body.toString('utf8'));
    } else {
      if (!signature) throw new Error('Missing Stripe webhook signature.');
      event = stripe.webhooks.constructEvent(request.body, signature, stripeWebhookSecret);
    }
  }

  if (event.type === 'payment_intent.succeeded') {
    await finalizePaymentIntent(event.data.object);
  }

  if (event.type === 'payment_intent.payment_failed' || event.type === 'payment_intent.canceled') {
    await markPaymentIntentFailed(event.data.object);
  }

  // Org subscription lifecycle — only relevant for VYS platform webhook.
  if (!isOrgWebhook) {
    if (event.type === 'checkout.session.completed' && event.data.object.mode === 'subscription'
      && event.data.object.metadata?.org_registration === 'true') {
      if (ORG_SELF_REGISTRATION_ENABLED) {
        await provisionOrganizationFromCheckout(event.data.object);
      } else {
        console.info('Ignoring org self-registration webhook event because self-registration is disabled.');
      }
    }

    if (event.type === 'invoice.paid') {
      await handleOrgInvoicePaid(event.data.object);
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      await syncOrgSubscriptionStatus(event.data.object, event.type === 'customer.subscription.deleted');
    }

    if (event.type === 'customer.subscription.trial_will_end') {
      await sendOrgTrialEndingEmail(event.data.object);
    }
  }

  response.json({ received: true });
}));

app.use(express.json({ limit: '15mb' }));

// --- Multi-tenant read-only mode --------------------------------------------
// Organizations with a lapsed subscription (past_due / canceled) are blocked
// on every write endpoint except billing-related ones, so they can still
// renew. The VYS org is 'exempt' and never locked. Anonymous requests pass
// through — anon flows default to the exempt VYS org and each route still
// enforces its own auth.
const ORG_LOCKED_STATUSES = new Set(['pending_approval', 'past_due', 'canceled']);
const ORG_WRITE_EXEMPT_PATHS = new Set(['/api/orgs/register', '/api/orgs/finalize', '/api/orgs/connect/onboarding', '/api/stripe/webhook']);
const ORG_STATUS_CACHE_TTL_MS = 60 * 1000;
const orgStatusCache = new Map(); // orgId -> { status, expiresAt }

async function organizationSubscriptionStatus(orgId) {
  const cachedStatus = orgStatusCache.get(orgId);
  if (cachedStatus && cachedStatus.expiresAt > Date.now()) return cachedStatus.status;

  const { data, error } = await supabase
    .from('organizations')
    .select('subscription_status')
    .eq('id', orgId)
    .maybeSingle();
  if (error) throw error;

  const subscriptionStatus = data?.subscription_status ?? null;
  orgStatusCache.set(orgId, { status: subscriptionStatus, expiresAt: Date.now() + ORG_STATUS_CACHE_TTL_MS });
  return subscriptionStatus;
}

app.use(asyncRoute(async (request, _response, next) => {
  const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method.toUpperCase());
  if (!isWrite || ORG_WRITE_EXEMPT_PATHS.has(request.path) || !supabase) {
    next();
    return;
  }

  const token = bearerTokenFromRequest(request);
  if (!token) {
    next();
    return;
  }

  const { data: userResult } = await supabase.auth.getUser(token);
  const userId = userResult?.user?.id;
  if (!userId) {
    next();
    return;
  }

  const { data: profile } = await supabase
    .from('app_profiles')
    .select('org_id')
    .eq('id', userId)
    .maybeSingle();
  const orgId = profile?.org_id;
  if (!orgId) {
    next();
    return;
  }

  const subscriptionStatus = await organizationSubscriptionStatus(orgId);
  if (ORG_LOCKED_STATUSES.has(subscriptionStatus)) {
    throw httpError(
      subscriptionStatus === 'pending_approval'
        ? 'Organizace čeká na schválení správcem platformy.'
        : 'Předplatné vypršelo — obnovte platbu pro plný přístup.',
      402,
    );
  }

  next();
}));

function requireServices() {
  if (!supabase) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on the backend.');
}

function requireStripe() {
  if (!stripe) throw new Error('Missing STRIPE_SECRET_KEY on the backend.');
}

// Return a Stripe client for the given org.
// VYS (platform org) → global Stripe client from env vars.
// External orgs → Stripe client using the org's own stripe_secret_key stored in
// the organizations table. Returns null when no key is configured (caller must
// check and throw a user-facing error).
const orgStripeCache = new Map(); // orgId -> { client, expiresAt }
const ORG_STRIPE_CACHE_TTL_MS = 5 * 60 * 1000;

async function getOrgStripe(orgId) {
  if (!orgId || orgId === VYS_ORG_ID) return stripe;
  const now = Date.now();
  const cached = orgStripeCache.get(orgId);
  if (cached && cached.expiresAt > now) return cached.client;

  const { data: org, error } = await supabase
    .from('organizations')
    .select('stripe_secret_key')
    .eq('id', orgId)
    .maybeSingle();
  if (error) throw error;

  const client = org?.stripe_secret_key ? new Stripe(org.stripe_secret_key) : null;
  orgStripeCache.set(orgId, { client, expiresAt: now + ORG_STRIPE_CACHE_TTL_MS });
  return client;
}

// Like getOrgStripe but throws a user-facing 409 when not configured.
async function requireOrgStripe(orgId, orgName) {
  const client = await getOrgStripe(orgId);
  if (!client) {
    const label = orgName ? `Organizace ${orgName}` : 'Organizace';
    throw httpError(`${label} zatím nemá nakonfigurovaný vlastní Stripe účet pro příjem plateb. Požádejte správce organizace o nastavení Stripe v admin panelu.`, 409);
  }
  return client;
}

async function getOrgWebhookSecret(orgId) {
  if (!orgId || orgId === VYS_ORG_ID) return stripeWebhookSecret;
  const { data: org, error } = await supabase
    .from('organizations')
    .select('stripe_webhook_secret')
    .eq('id', orgId)
    .maybeSingle();
  if (error) throw error;
  return org?.stripe_webhook_secret || null;
}

function requiredString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) throw httpError(`Vyplň pole: ${label}.`, 400);
  return value.trim();
}

function optionalString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

const rewardDiscountRules = [
  { suffix: 'KROUZEK-5', type: 'Krouzek', percent: 5 },
  { suffix: 'WORKSHOP-10', type: 'Workshop', percent: 10 },
  { suffix: 'KROUZEK-12', type: 'Krouzek', percent: 12 },
  { suffix: 'WORKSHOP-15', type: 'Workshop', percent: 15 },
  { suffix: 'KROUZEK-20', type: 'Krouzek', percent: 20 },
];

const WORKSHOP_INTEREST_THRESHOLD = 9;
const WORKSHOP_PAYMENT_OPEN_DAYS = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_COURSE_ATTENDANCE_RATE = 500;
const SOLO_COURSE_ATTENDANCE_RATE = 750;
const IGNORED_COACH_SESSION_IDS = new Set(['coach-demo']);
const VYS_ORG_ID = '00000000-0000-4000-8000-000000000001';

function normalizeActivityType(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized.includes('workshop')) return 'Workshop';
  if (normalized.includes('krouzek')) return 'Krouzek';
  return null;
}

function rewardDiscountForCode(code, productType) {
  const normalizedCode = String(code || '').trim().toUpperCase().replace(/\s+/g, '');
  const normalizedType = normalizeActivityType(productType);
  if (!normalizedCode) return null;
  return rewardDiscountRules.find((rule) => normalizedCode.endsWith(rule.suffix) && rule.type === normalizedType) || null;
}

const czechWeekdays = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];

// Aktuální čas v Evropě/Praze v minutách od půlnoci (server běží v UTC).
function pragueNowMinutes() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

// Den v týdnu (česky) v Evropě/Praze.
function pragueWeekday() {
  const en = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Prague', weekday: 'short' }).format(new Date());
  const map = { Sun: 'Neděle', Mon: 'Pondělí', Tue: 'Úterý', Wed: 'Středa', Thu: 'Čtvrtek', Fri: 'Pátek', Sat: 'Sobota' };
  return map[en] ?? czechWeekdays[new Date().getDay()];
}

// Rozparsuje "16:00 - 17:00" (i pomlčka –) na { start, end } v minutách od půlnoci.
function parseSessionTimeRange(timeText) {
  const matches = String(timeText || '').match(/(\d{1,2}):(\d{2})/g);
  if (!matches || matches.length === 0) return null;
  const toMin = (value) => {
    const [h, m] = value.split(':');
    return Number(h) * 60 + Number(m);
  };
  const start = toMin(matches[0]);
  const end = matches.length > 1 ? toMin(matches[1]) : start + 60;
  return { start, end };
}

function formatMinutes(total) {
  const normalized = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isWorkshopCoachSession(session) {
  return String(session?.id || '').startsWith('coach-workshop-') || String(session?.group_name || '').startsWith('Workshop:');
}

function numericOrFallback(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

async function resolveCoachAttendanceRate(coachId, session, requestedHourlyRate) {
  const defaultRate = numericOrFallback(session?.hourly_rate, numericOrFallback(requestedHourlyRate, DEFAULT_COURSE_ATTENDANCE_RATE));

  if (!session || isWorkshopCoachSession(session)) return defaultRate;

  // External organizations set their own per-training wage on the session
  // (coach_sessions.hourly_rate). The VYS-specific solo/shared course rates
  // below only apply to the platform org.
  if (session.org_id && session.org_id !== VYS_ORG_ID) {
    return numericOrFallback(session.hourly_rate, numericOrFallback(requestedHourlyRate, DEFAULT_COURSE_ATTENDANCE_RATE));
  }

  const { data, error } = await supabase
    .from('coach_sessions')
    .select('id,coach_id,group_name')
    .eq('city', session.city)
    .eq('venue', session.venue)
    .eq('day', session.day)
    .eq('time', session.time);

  if (error) throw error;

  const assignedCoachIds = new Set(
    (data || [])
      .filter((row) => !isWorkshopCoachSession(row) && !IGNORED_COACH_SESSION_IDS.has(row.coach_id))
      .map((row) => row.coach_id)
      .filter(Boolean),
  );

  if (assignedCoachIds.size === 1 && assignedCoachIds.has(coachId)) return SOLO_COURSE_ATTENDANCE_RATE;
  return DEFAULT_COURSE_ATTENDANCE_RATE;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => d * (Math.PI / 180);
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function slugify(value) {
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'participant';
}

function normalizePersonNamePart(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function birthNumberSuffix(value) {
  return String(value || '').replace(/\D/g, '').slice(-4);
}

function generateClaimCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[bytes[i] % chars.length];
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

function asyncRoute(handler) {
  return async (request, response, next) => {
    try {
      await handler(request, response, next);
    } catch (error) {
      next(error);
    }
  };
}

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function bearerTokenFromRequest(request) {
  const header = request.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] || null;
}

async function requireAuthenticatedProfile(request) {
  requireServices();

  const token = bearerTokenFromRequest(request);
  if (!token) throw httpError('Přihlášení je vyžadováno.', 401);

  const { data: userResult, error: userError } = await supabase.auth.getUser(token);
  const user = userResult?.user;
  if (userError || !user) throw httpError('Přihlášení vypršelo nebo není platné.', 401);

  const { data: profile, error: profileError } = await supabase
    .from('app_profiles')
    .select('id,role,email,name')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) throw httpError('Profil účtu nebyl nalezen.', 403);

  return profile;
}

async function requireAdmin(request) {
  const profile = await requireAuthenticatedProfile(request);
  if (profile.role !== 'admin') throw httpError('Tahle operace je pouze pro admina.', 403);
  return profile;
}

// Resolve the organization an admin belongs to. Defaults to the VYS platform org
// for admins without an explicit org_id (legacy/VYS admins).
async function adminOrgId(profile) {
  const { data, error } = await supabase
    .from('app_profiles')
    .select('org_id')
    .eq('id', profile.id)
    .maybeSingle();
  if (error) throw error;
  return data?.org_id || VYS_ORG_ID;
}

async function requireParentOrAdmin(request) {
  const profile = await requireAuthenticatedProfile(request);
  if (profile.role !== 'admin' && profile.role !== 'parent' && profile.role !== 'participant') throw httpError('Tahle operace vyžaduje přihlášení.', 403);
  return profile;
}

function parentProfileIdForActor(actor, requestedParentProfileId) {
  const requested = optionalString(requestedParentProfileId);
  if (actor.role === 'admin') return requested || actor.id;
  if (requested && requested !== actor.id) throw httpError('Rodič může zapisovat jen ke svému účtu.', 403);
  return actor.id;
}

async function assertParticipantAccessible(actor, participantId) {
  if (actor.role === 'admin') return;

  // A participant account may act on its own record. For participant logins the
  // participants row id equals the auth/profile id (see participant profile hook),
  // so allow when the requested participant is the actor itself.
  if (actor.role === 'participant' && participantId === actor.id) return;

  const { data: participant, error } = await supabase
    .from('participants')
    .select('parent_profile_id')
    .eq('id', participantId)
    .maybeSingle();

  if (error) throw error;
  if (participant?.parent_profile_id && participant.parent_profile_id !== actor.id) {
    throw httpError('Účastník patří k jinému rodičovskému účtu.', 403);
  }
}

function assertPaymentIntentAccessible(actor, paymentIntent) {
  if (actor.role === 'admin') return;
  const metadata = paymentIntent.metadata || {};
  if (metadata.parent_profile_id && metadata.parent_profile_id !== actor.id) {
    throw httpError('Platba patří k jinému rodičovskému účtu.', 403);
  }
}

function assertCheckoutSessionAccessible(actor, session) {
  if (actor.role === 'admin') return;
  const metadata = session.metadata || {};
  if (metadata.parent_profile_id && metadata.parent_profile_id !== actor.id) {
    throw httpError('Platba patří k jinému rodičovskému účtu.', 403);
  }
}

async function requireStaff(request) {
  const profile = await requireAuthenticatedProfile(request);
  if (profile.role === 'admin') return profile;
  if (profile.role !== 'coach') throw httpError('Tahle operace je pouze pro tým TeamVYS.', 403);

  const { data: coach, error } = await supabase
    .from('coach_profiles')
    .select('approval_status')
    .eq('id', profile.id)
    .maybeSingle();

  if (error) throw error;
  if (coach?.approval_status !== 'approved') throw httpError('Trenérský účet ještě není schválený.', 403);
  return profile;
}

async function getProduct(productId) {
  requireServices();

  const { data, error } = await supabase
    .from('products')
    .select('id,type,title,price,price_label,place,primary_meta,event_date,expires_at,entries_total,capacity_total,capacity_current,org_id')
    .eq('id', productId)
    .single();

  if (error || !data) throw new Error('Product was not found.');
  return data;
}

// Resolve the Stripe client to use for a product's payments.
// Products of the VYS org → platform Stripe (env var key).
// Products of an external org → org's own Stripe (stripe_secret_key in organizations).
// Throws 409 when an external org has no Stripe configured.
async function getProductOrgStripe(product) {
  const orgId = product.org_id || VYS_ORG_ID;
  if (orgId === VYS_ORG_ID) return { orgStripe: stripe, orgId };

  const { data: org, error } = await supabase
    .from('organizations')
    .select('id,name,stripe_secret_key')
    .eq('id', orgId)
    .maybeSingle();
  if (error) throw error;
  if (!org) throw httpError('Organizace produktu nebyla nalezena.', 404);

  const orgStripe = org.stripe_secret_key ? new Stripe(org.stripe_secret_key) : null;
  if (!orgStripe) {
    throw httpError(`Organizace ${org.name} zatím nemá nakonfigurovaný vlastní Stripe účet pro příjem plateb. Požádejte správce organizace o nastavení Stripe v admin panelu.`, 409);
  }
  return { orgStripe, orgId };
}

// Legacy helper kept for backward compatibility (unused in new flow).
async function connectDestinationForProduct(product) {
  const orgId = product.org_id || VYS_ORG_ID;
  if (orgId === VYS_ORG_ID) return null;

  const { data: org, error } = await supabase
    .from('organizations')
    .select('id,name,stripe_connect_account_id,stripe_connect_charges_enabled')
    .eq('id', orgId)
    .maybeSingle();
  if (error) throw error;
  if (!org) throw httpError('Organizace produktu nebyla nalezena.', 404);

  if (org.stripe_connect_account_id && !org.stripe_connect_charges_enabled && stripe) {
    try {
      const account = await stripe.accounts.retrieve(org.stripe_connect_account_id);
      if (account.charges_enabled === true) {
        org.stripe_connect_charges_enabled = true;
        await supabase.from('organizations').update({ stripe_connect_charges_enabled: true }).eq('id', org.id);
      }
    } catch (accountError) {
      console.warn(`Stripe Connect account check failed for org ${org.id}: ${accountError.message}`);
    }
  }

  if (!org.stripe_connect_account_id || !org.stripe_connect_charges_enabled) {
    throw httpError(`Organizace ${org.name} zatím nemá propojený Stripe účet pro příjem plateb. Požádejte správce organizace o dokončení Stripe onboardingu.`, 409);
  }
  return org.stripe_connect_account_id;
}

function toClientPurchase(row) {
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
    eventDate: row.event_date || undefined,
    expiresAt: row.expires_at || undefined,
    trainingDays: Array.isArray(row.training_days) && row.training_days.length > 0 ? row.training_days : undefined,
  };
}

const SCHEDULE_DAY_NAMES = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];

function normalizeDayName(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// "Úterý / Čtvrtek 17:00 - 18:00" → ['Úterý', 'Čtvrtek']
function parseScheduleDays(primaryMeta) {
  const normalizedMeta = normalizeDayName(primaryMeta);
  return SCHEDULE_DAY_NAMES.filter((day) => normalizedMeta.includes(normalizeDayName(day)));
}

function resolveTrainingDaysSelection(product, requestedDays) {
  if (product?.type !== 'Kroužek') return null;

  const scheduleDays = parseScheduleDays(product.primary_meta);
  if (scheduleDays.length < 2) return null;

  const requested = Array.isArray(requestedDays) ? requestedDays.map((day) => String(day)) : [];
  const selected = scheduleDays.filter((day) => requested.some((req) => normalizeDayName(req) === normalizeDayName(day)));
  if (selected.length === 0) {
    throw httpError(`Vyber prosím tréninkové dny (${scheduleDays.join(', ')} nebo oba).`, 400);
  }
  return selected;
}

function nextMonthFirstIso(periodEndIso) {
  const [year, month] = String(periodEndIso).split('-').map(Number);
  if (!year || !month) throw new Error('Invalid payout period end date.');

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function createdAtText() {
  return new Date().toLocaleString('cs-CZ', { timeZone: 'Europe/Prague', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function profileReceiptEmail(parentProfileId, fallbackEmail) {
  const fallback = normalizedEmail(fallbackEmail);
  if (!parentProfileId) return fallback;

  const { data, error } = await supabase
    .from('app_profiles')
    .select('email')
    .eq('id', parentProfileId)
    .maybeSingle();

  if (error) throw error;
  return normalizedEmail(data?.email) || fallback;
}

function normalizedEmail(value) {
  const email = optionalString(value)?.toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function paymentEmailer() {
  if (!smtpHost || !smtpFrom) return null;
  if (smtpUser && !smtpPass) return null;
  if (!paymentEmailTransporter) {
    paymentEmailTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
    });
  }
  return paymentEmailTransporter;
}

async function sendPaymentConfirmationEmail(purchase, fallbackEmail) {
  const to = await profileReceiptEmail(purchase.parent_profile_id, fallbackEmail);
  if (!to) return;

  const emailer = paymentEmailer();
  if (!emailer) {
    console.info(`Payment confirmation email skipped for ${purchase.id}: SMTP is not configured.`);
    return;
  }

  const subject = `Potvrzení platby TeamVYS - ${purchase.title}`;
  const lines = [
    'Dobrý den,',
    '',
    'potvrzujeme přijetí platby v rodičovském portálu TeamVYS.',
    '',
    `Produkt: ${purchase.title}`,
    `Účastník: ${purchase.participant_name}`,
    `Částka: ${purchase.price_label || `${purchase.amount} Kč`}`,
    `Místo: ${purchase.place}`,
    purchase.event_date ? `Termín: ${purchase.event_date}` : null,
    '',
    'Děkujeme, TeamVYS',
  ].filter(Boolean);

  await emailer.sendMail({
    from: smtpFrom,
    to,
    subject,
    text: lines.join('\n'),
    html: `<p>Dobrý den,</p><p>potvrzujeme přijetí platby v rodičovském portálu TeamVYS.</p><table>${[
      ['Produkt', purchase.title],
      ['Účastník', purchase.participant_name],
      ['Částka', purchase.price_label || `${purchase.amount} Kč`],
      ['Místo', purchase.place],
      purchase.event_date ? ['Termín', purchase.event_date] : null,
    ].filter(Boolean).map(([label, value]) => `<tr><td style="padding:4px 12px 4px 0;font-weight:700">${escapeHtml(label)}</td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`).join('')}</table><p>Děkujeme,<br>TeamVYS</p>`,
  });
}

async function safelySendPaymentConfirmationEmail(purchase, fallbackEmail) {
  try {
    await sendPaymentConfirmationEmail(purchase, fallbackEmail);
  } catch (error) {
    console.error(`Payment confirmation email failed for ${purchase?.id || 'unknown purchase'}:`, error);
  }
}

// Sends a coach an e-mail once their account is approved by an org admin.
async function sendCoachApprovalEmail(to, coachName, orgName) {
  if (!to) return;
  const emailer = paymentEmailer();
  if (!emailer) {
    console.info(`Coach approval email skipped for ${to}: SMTP is not configured.`);
    return;
  }

  const org = orgName || 'TeamVYS';
  const subject = `Trenérský účet schválen — ${org}`;
  const lines = [
    `Dobrý den${coachName ? ` ${coachName}` : ''},`,
    '',
    `váš trenérský účet u organizace ${org} byl schválen.`,
    'Nyní se můžete přihlásit do aplikace a začít trénovat.',
    '',
    'Přihlášení: otevřete aplikaci TeamVYS a přihlaste se svým e-mailem a heslem.',
    '',
    `Děkujeme, ${org}`,
  ];

  await emailer.sendMail({
    from: smtpFrom,
    to,
    subject,
    text: lines.join('\n'),
    html: `<p>Dobrý den${coachName ? ` ${escapeHtml(coachName)}` : ''},</p>`
      + `<p>váš trenérský účet u organizace <strong>${escapeHtml(org)}</strong> byl schválen.</p>`
      + `<p>Nyní se můžete přihlásit do aplikace a začít trénovat — otevřete aplikaci TeamVYS a přihlaste se svým e-mailem a heslem.</p>`
      + `<p>Děkujeme,<br>${escapeHtml(org)}</p>`,
  });
}

async function safelySendCoachApprovalEmail(to, coachName, orgName) {
  try {
    await sendCoachApprovalEmail(to, coachName, orgName);
  } catch (error) {
    console.error(`Coach approval email failed for ${to || 'unknown coach'}:`, error);
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isWorkshopProduct(product) {
  return normalizeActivityType(product?.type) === 'Workshop';
}

function parseProductDate(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  const isoMatch = /(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (isoMatch) return new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])));

  const czechMatch = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(text);
  if (czechMatch) return new Date(Date.UTC(Number(czechMatch[3]), Number(czechMatch[2]) - 1, Number(czechMatch[1])));

  return null;
}

function workshopEventDate(product) {
  return parseProductDate(product?.event_date) || parseProductDate(product?.primary_meta) || parseProductDate(product?.expires_at);
}

function workshopPurchaseGate(product, interestCount) {
  if (!isWorkshopProduct(product)) return { canPurchase: true, interestCount };

  const eventDate = workshopEventDate(product);
  const opensByInterest = interestCount >= WORKSHOP_INTEREST_THRESHOLD;
  const opensByDate = eventDate ? Date.now() >= eventDate.getTime() - WORKSHOP_PAYMENT_OPEN_DAYS * MS_PER_DAY : true;

  return {
    canPurchase: opensByInterest || opensByDate,
    interestCount,
    threshold: WORKSHOP_INTEREST_THRESHOLD,
    opensByInterest,
    opensByDate,
    eventDate: eventDate ? eventDate.toISOString().slice(0, 10) : null,
  };
}

async function countWorkshopInterests(productId) {
  const { data, error } = await supabase
    .from('workshop_interests')
    .select('id,parent_profile_id,participant_id,participant_name')
    .eq('product_id', productId);

  if (error) throw error;

  const participants = new Set();
  for (const interest of data || []) {
    if (isDemoAdminRecord(interest.id, interest.parent_profile_id, interest.participant_id, interest.participant_name)) continue;
    participants.add(interest.participant_id || normalizeAdminSeedText(interest.participant_name) || interest.id);
  }

  return participants.size;
}

function purchaseRowFromPaymentIntent(paymentIntent, metadata, status = 'Čeká na platbu') {
  const amount = Number(metadata.amount || Math.round((paymentIntent.amount || 0) / 100));

  return {
    id: `stripe-pi-${paymentIntent.id}`,
    org_id: optionalString(metadata.org_id) || VYS_ORG_ID,
    parent_profile_id: optionalString(metadata.parent_profile_id),
    product_id: requiredString(metadata.product_id, 'product metadata'),
    participant_id: requiredString(metadata.participant_id, 'participant metadata'),
    participant_name: requiredString(metadata.participant_name, 'participantName metadata'),
    type: requiredString(metadata.type, 'type metadata'),
    title: requiredString(metadata.title, 'title metadata'),
    amount,
    original_amount: Number(metadata.original_amount || amount),
    discount_code: optionalString(metadata.discount_code),
    discount_percent: metadata.discount_percent ? Number(metadata.discount_percent) : null,
    discount_amount: metadata.discount_amount ? Number(metadata.discount_amount) : 0,
    price_label: metadata.price_label || `${amount} Kč`,
    place: requiredString(metadata.place, 'place metadata'),
    status,
    paid_at: status === 'Zaplaceno' ? new Date().toLocaleDateString('cs-CZ') : 'Čeká na zaplacení',
    event_date: metadata.event_date || null,
    expires_at: metadata.expires_at || null,
    training_days: metadata.training_days ? String(metadata.training_days).split(',').filter(Boolean) : null,
    stripe_payment_intent_id: paymentIntent.id,
  };
}

async function finalizePaymentIntent(paymentIntent) {
  requireServices();

  if (paymentIntent.status !== 'succeeded') throw new Error('Stripe payment is not paid yet.');

  const metadata = paymentIntent.metadata || {};
  const row = purchaseRowFromPaymentIntent(paymentIntent, metadata, 'Zaplaceno');
  const { data: existingPurchase, error: existingPurchaseError } = await supabase
    .from('parent_purchases')
    .select('status')
    .eq('id', row.id)
    .maybeSingle();

  if (existingPurchaseError) throw existingPurchaseError;

  const { data, error } = await supabase
    .from('parent_purchases')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;
  await syncPaidPurchaseSideEffects(data);
  if (existingPurchase?.status !== 'Zaplaceno') {
    await safelySendPaymentConfirmationEmail(data, metadata.receipt_email || paymentIntent.receipt_email);
  }
  return data;
}

async function markPaymentIntentFailed(paymentIntent) {
  requireServices();

  const { error } = await supabase
    .from('parent_purchases')
    .update({ status: 'Platba selhala', paid_at: 'Platba se nepovedla' })
    .eq('stripe_payment_intent_id', paymentIntent.id);

  if (error) throw error;
}

async function createDigitalPassForPurchase(purchase, productOverride) {
  if (!purchase || !purchase.participant_id || !purchase.product_id) return;
  // Camps use name-based check-in via coach list — no QR pass needed
  if (purchase.type === 'Tábor' || purchase.type === 'Tabor') return;

  const product = productOverride || await getProduct(purchase.product_id);

  const totalEntries = Number(product?.entries_total || (purchase.type === 'Kroužek' ? 10 : 1));
  const passId = `pass-${purchase.id}`;
  const passTitle = purchase.type === 'Kroužek' ? purchase.title : `${purchase.title} · ticket`;
  const chipPrefix = purchase.type === 'Kroužek' ? 'NFC' : 'QR';

  const { data: existingPass, error: existingPassError } = await supabase
    .from('digital_passes')
    .select('used_entries,last_scan_at,last_scan_place')
    .eq('id', passId)
    .maybeSingle();

  if (existingPassError) throw existingPassError;

  const { error } = await supabase
    .from('digital_passes')
    .upsert({
      id: passId,
      participant_id: purchase.participant_id,
      holder_name: purchase.participant_name,
      title: passTitle,
      location: purchase.place,
      nfc_chip_id: `${chipPrefix}-${purchase.participant_id.slice(0, 8).toUpperCase()}-${purchase.product_id.slice(0, 8).toUpperCase()}`,
      total_entries: totalEntries,
      used_entries: Number(existingPass?.used_entries || 0),
      last_scan_at: existingPass?.last_scan_at ?? null,
      last_scan_place: existingPass?.last_scan_place ?? purchase.place,
    }, { onConflict: 'id' });

  if (error) throw error;
}

async function ensureProductCapacity(productId) {
  const product = await getProduct(productId);

  if (isWorkshopProduct(product)) {
    const interestCount = await countWorkshopInterests(product.id);
    const gate = workshopPurchaseGate(product, interestCount);
    if (!gate.canPurchase) {
      throw httpError(`Workshop zatím nejde zaplatit. Platba se otevře ${WORKSHOP_PAYMENT_OPEN_DAYS} dny před termínem nebo při ${WORKSHOP_INTEREST_THRESHOLD} zájemcích. Teď má ${interestCount} zájemců.`, 409);
    }
  }

  if (!product.capacity_total) return product;

  const used = await countPaidProductParticipants(product);
  if (used >= Number(product.capacity_total)) throw new Error(`Kapacita produktu je plná (${used}/${product.capacity_total}).`);

  return { ...product, capacity_current: used };
}

async function syncProductCapacity(product) {
  const used = await countPaidProductParticipants(product);
  const productIds = capacityProductIds(product);

  const { error: updateError } = await supabase
    .from('products')
    .update({ capacity_current: used })
    .in('id', productIds);

  if (updateError) throw updateError;
}

function capacityProductIds(product) {
  const productId = String(product?.id || '');
  if (product?.type !== 'Kroužek') return [productId];

  const baseId = productId.endsWith('-15') ? productId.slice(0, -3) : productId;
  return [baseId, `${baseId}-15`];
}

async function countPaidProductParticipants(product) {
  const productIds = capacityProductIds(product);
  const { data, error } = await supabase
    .from('parent_purchases')
    .select('id,parent_profile_id,participant_id,participant_name')
    .in('product_id', productIds)
    .eq('status', 'Zaplaceno');

  if (error) throw error;

  const participants = new Set();
  for (const purchase of data || []) {
    if (isDemoAdminRecord(purchase.id, purchase.parent_profile_id, purchase.participant_id, purchase.participant_name)) continue;
    participants.add(purchase.participant_id || normalizeAdminSeedText(purchase.participant_name) || purchase.id);
  }

  return participants.size;
}

async function applyLiveProductCapacities(products) {
  const productList = products || [];
  const capacityProducts = productList.filter((product) => product.capacity_total);
  const workshopProducts = productList.filter(isWorkshopProduct);
  if (capacityProducts.length === 0 && workshopProducts.length === 0) return productList;

  const allProductIds = Array.from(new Set(capacityProducts.flatMap(capacityProductIds).filter(Boolean)));
  const workshopProductIds = Array.from(new Set(workshopProducts.map((product) => product.id).filter(Boolean)));
  const [purchaseResult, interestResult] = await Promise.all([
    allProductIds.length > 0
      ? supabase
        .from('parent_purchases')
        .select('id,parent_profile_id,participant_id,participant_name,product_id')
        .in('product_id', allProductIds)
        .eq('status', 'Zaplaceno')
      : Promise.resolve({ data: [], error: null }),
    workshopProductIds.length > 0
      ? supabase
        .from('workshop_interests')
        .select('id,parent_profile_id,participant_id,participant_name,product_id')
        .in('product_id', workshopProductIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (purchaseResult.error) throw purchaseResult.error;
  if (interestResult.error) throw interestResult.error;

  const participantsByProductId = new Map();
  for (const purchase of purchaseResult.data || []) {
    if (isDemoAdminRecord(purchase.id, purchase.parent_profile_id, purchase.participant_id, purchase.participant_name)) continue;
    const participantKey = purchase.participant_id || normalizeAdminSeedText(purchase.participant_name) || purchase.id;
    if (!participantsByProductId.has(purchase.product_id)) participantsByProductId.set(purchase.product_id, new Set());
    participantsByProductId.get(purchase.product_id).add(participantKey);
  }

  const interestsByProductId = new Map();
  for (const interest of interestResult.data || []) {
    if (isDemoAdminRecord(interest.id, interest.parent_profile_id, interest.participant_id, interest.participant_name)) continue;
    const participantKey = interest.participant_id || normalizeAdminSeedText(interest.participant_name) || interest.id;
    if (!interestsByProductId.has(interest.product_id)) interestsByProductId.set(interest.product_id, new Set());
    interestsByProductId.get(interest.product_id).add(participantKey);
  }

  return productList.map((product) => {
    const participants = new Set();
    if (product.capacity_total) {
      for (const productId of capacityProductIds(product)) {
        for (const participantKey of participantsByProductId.get(productId) || []) participants.add(participantKey);
      }
    }
    const interestCount = interestsByProductId.get(product.id)?.size ?? 0;
    return {
      ...product,
      capacity_current: product.capacity_total ? participants.size : product.capacity_current,
      interest_count: isWorkshopProduct(product) ? interestCount : 0,
      can_purchase: workshopPurchaseGate(product, interestCount).canPurchase,
    };
  });
}

async function syncParticipantPaidPurchases(participantId, product) {
  const { data: purchases, error } = await supabase
    .from('parent_purchases')
    .select('id,product_id,type,title,status,place,paid_at,created_at')
    .eq('participant_id', participantId)
    .eq('status', 'Zaplaceno')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const activePurchases = (purchases || []).map((purchase) => ({
    purchaseId: purchase.id,
    productId: purchase.product_id,
    type: purchase.type,
    title: purchase.title,
    status: 'Aktivní',
    place: purchase.place,
    paidAt: purchase.paid_at,
  }));

  const update = {
    paid_status: 'paid',
    active_purchases: activePurchases,
  };

  if (product) {
    if (product.type === 'Kroužek') update.active_course = product.place;
    const nextTraining = product.event_date || product.expires_at;
    if (nextTraining) update.next_training = nextTraining;
  }

  const { error: participantError } = await supabase
    .from('participants')
    .update(update)
    .eq('id', participantId);

  if (participantError) throw participantError;
}

async function syncParentPaymentForPurchase(purchase) {
  const { error } = await supabase
    .from('parent_payments')
    .upsert({
      id: `payment-${purchase.id}`,
      org_id: purchase.org_id || VYS_ORG_ID,
      participant_id: purchase.participant_id,
      participant_name: purchase.participant_name,
      title: purchase.title,
      amount: purchase.amount,
      due_date: purchase.paid_at,
      status: 'paid',
      stripe_ready: true,
    }, { onConflict: 'id' });

  if (error) throw error;
}

// Drží coach_sessions.enrolled v souladu s nákupy: u kroužků s více tréninkovými
// dny (Út/Čt) se dítě počítá jen do dnů, které si rodič vybral při platbě.
async function syncCoachSessionEnrollment(product) {
  if (product?.type !== 'Kroužek' || !product.city || !product.venue) return;

  const { data: sessions, error: sessionsError } = await supabase
    .from('coach_sessions')
    .select('id,day,enrolled')
    .eq('city', product.city)
    .eq('venue', product.venue);

  if (sessionsError) throw sessionsError;
  if (!sessions || sessions.length === 0) return;

  const { data: purchases, error: purchasesError } = await supabase
    .from('parent_purchases')
    .select('id,parent_profile_id,participant_id,participant_name,training_days')
    .in('product_id', capacityProductIds(product))
    .eq('status', 'Zaplaceno');

  if (purchasesError) throw purchasesError;

  for (const session of sessions) {
    const sessionDay = normalizeDayName(session.day);
    if (!sessionDay) continue;

    const participants = new Set();
    for (const purchase of purchases || []) {
      if (isDemoAdminRecord(purchase.id, purchase.parent_profile_id, purchase.participant_id, purchase.participant_name)) continue;
      const days = Array.isArray(purchase.training_days) ? purchase.training_days : null;
      if (days && days.length > 0 && !days.some((day) => normalizeDayName(day) === sessionDay)) continue;
      participants.add(purchase.participant_id || normalizeAdminSeedText(purchase.participant_name) || purchase.id);
    }

    if (Number(session.enrolled) === participants.size) continue;

    const { error: updateError } = await supabase
      .from('coach_sessions')
      .update({ enrolled: participants.size })
      .eq('id', session.id);

    if (updateError) throw updateError;
  }
}

async function syncPaidPurchaseSideEffects(purchase) {
  if (!purchase || purchase.status !== 'Zaplaceno') return;

  const product = await getProduct(purchase.product_id);
  await Promise.all([
    syncProductCapacity(product),
    syncCoachSessionEnrollment(product),
    syncParticipantPaidPurchases(purchase.participant_id, product),
    syncParentPaymentForPurchase(purchase),
    createDigitalPassForPurchase(purchase, product),
  ]);
}

async function calculateTrainerPayoutAmount(coachId, periodStart, periodEnd) {
  const [attendanceResult, adjustmentsResult, payoutResult] = await Promise.all([
    supabase
      .from('coach_attendance_records')
      .select('amount,created_at')
      .eq('coach_id', coachId)
      .gte('created_at', `${periodStart}T00:00:00.000Z`)
      .lte('created_at', `${periodEnd}T23:59:59.999Z`),
    supabase
      .from('admin_attendance_adjustments')
      .select('amount,created_at')
      .eq('coach_id', coachId)
      .gte('created_at', `${periodStart}T00:00:00.000Z`)
      .lte('created_at', `${periodEnd}T23:59:59.999Z`),
    supabase
      .from('coach_payouts')
      .select('approved_bonuses')
      .eq('coach_id', coachId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (attendanceResult.error) throw attendanceResult.error;
  if (adjustmentsResult.error) throw adjustmentsResult.error;
  if (payoutResult.error) throw payoutResult.error;

  const attendanceAmount = (attendanceResult.data || []).reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const adjustmentAmount = (adjustmentsResult.data || []).reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const approvedBonuses = Number(payoutResult.data?.approved_bonuses || 0);

  return Math.round(attendanceAmount + adjustmentAmount + approvedBonuses);
}

app.get('/health', (_request, response) => {
  response.json({ ok: true, service: 'teamvys-api' });
});

// GET /api/parent/products — published products for the authenticated parent's orgs.
// Falls back to VYS-only when unauthenticated.
app.get('/api/parent/products', asyncRoute(async (request, response) => {
  requireServices();

  let orgIds = [VYS_ORG_ID];
  try {
    const actor = await requireParent(request);
    const { data: memberRows } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('profile_id', actor.id);
    if (Array.isArray(memberRows) && memberRows.length > 0) {
      orgIds = memberRows.map((row) => row.org_id).filter(Boolean);
    }
  } catch {
    // unauthenticated — fall back to VYS only
  }

  const { data, error } = await supabase
    .from('products')
    .select('id,type,title,city,place,venue,price,price_label,original_price,entries_total,primary_meta,secondary_meta,description,important_info,badge,event_date,expires_at,capacity_total,capacity_current,hero_image,gallery,coach_ids,training_focus,is_published,skill_category,org_id')
    .eq('is_published', true)
    .in('org_id', orgIds)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const products = await applyLiveProductCapacities(data || []);
  response.json({ products });
}));

app.get('/api/public/products', asyncRoute(async (_request, response) => {
  requireServices();

  const { data, error } = await supabase
    .from('products')
    .select('id,type,title,city,place,venue,price,price_label,original_price,entries_total,primary_meta,secondary_meta,description,important_info,badge,event_date,expires_at,capacity_total,capacity_current,hero_image,gallery,coach_ids,training_focus,is_published,skill_category')
    .eq('is_published', true)
    .eq('org_id', VYS_ORG_ID)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const products = await applyLiveProductCapacities(data || []);
  response.json({ products });
}));

app.post('/api/workshop-interests', asyncRoute(async (request, response) => {
  requireServices();
  const actor = await requireParentOrAdmin(request);

  const parentProfileId = parentProfileIdForActor(actor, request.body.parentProfileId);
  const productId = requiredString(request.body.productId, 'productId');
  const participantId = requiredString(request.body.participantId, 'participantId');
  await assertParticipantAccessible(actor, participantId);

  const participantName = requiredString(request.body.participantName, 'participantName');
  const product = await getProduct(productId);
  if (!isWorkshopProduct(product)) throw httpError('Zájem lze zapsat jen u workshopu.', 400);

  const row = {
    id: `workshop-interest-${product.id}-${participantId}`,
    parent_profile_id: parentProfileId,
    product_id: product.id,
    participant_id: participantId,
    participant_name: participantName,
  };

  // Count before, so we can detect the moment the workshop crosses the
  // threshold and opens for payment — then notify everyone who's interested.
  const prevCount = await countWorkshopInterests(product.id);

  const { data, error } = await supabase
    .from('workshop_interests')
    .upsert(row, { onConflict: 'product_id,participant_id' })
    .select()
    .single();

  if (error) throw error;

  const interestCount = await countWorkshopInterests(product.id);
  const gate = workshopPurchaseGate(product, interestCount);

  // Just opened by interest? (crossed the threshold with this registration)
  if (prevCount < WORKSHOP_INTEREST_THRESHOLD && interestCount >= WORKSHOP_INTEREST_THRESHOLD) {
    const { data: interestRows } = await supabase
      .from('workshop_interests')
      .select('parent_profile_id')
      .eq('product_id', product.id);
    const parentIds = (interestRows || []).map((r) => r.parent_profile_id);
    const title = 'Workshop se otevřel k platbě';
    const body = `${product.title} má dost zájemců — teď ho můžeš zaplatit a rezervovat místo.`;
    void sendExpoPushToProfiles(parentIds, title, body);
  }

  response.status(201).json({ interest: data, interestCount, canPurchase: gate.canPurchase, threshold: WORKSHOP_INTEREST_THRESHOLD });
}));

// ─── Weekly trick voting ─────────────────────────────────────────────────────
// Parents and participants pick up to 2 tricks per week they'd like to see at a
// future workshop. Admin sees the aggregated tally. Resets weekly (by week_start).
const MAX_TRICK_VOTES_PER_WEEK = 2;

function currentTrickVoteWeek() {
  const now = new Date();
  const monday = (now.getUTCDay() + 6) % 7; // Monday = 0
  now.setUTCDate(now.getUTCDate() - monday);
  return now.toISOString().slice(0, 10);
}

async function profileOrgId(profileId) {
  const { data, error } = await supabase.from('app_profiles').select('org_id').eq('id', profileId).maybeSingle();
  if (error) throw error;
  return data?.org_id || VYS_ORG_ID;
}

app.get('/api/trick-votes/me', asyncRoute(async (request, response) => {
  requireServices();
  const actor = await requireParentOrAdmin(request);
  const participantId = optionalString(request.query.participantId);
  if (participantId) await assertParticipantAccessible(actor, participantId);
  const week = currentTrickVoteWeek();

  let query = supabase
    .from('trick_votes')
    .select('trick_name')
    .eq('voter_profile_id', actor.id)
    .eq('week_start', week);
  query = participantId ? query.eq('participant_id', participantId) : query.is('participant_id', null);

  const { data, error } = await query;
  if (error) throw error;
  response.json({ week, tricks: (data || []).map((row) => row.trick_name) });
}));

app.post('/api/trick-votes', asyncRoute(async (request, response) => {
  requireServices();
  const actor = await requireParentOrAdmin(request);
  const participantId = optionalString(request.body.participantId);
  if (participantId) await assertParticipantAccessible(actor, participantId);

  const tricksInput = Array.isArray(request.body.tricks) ? request.body.tricks : [];
  const tricks = Array.from(
    new Set(tricksInput.filter((t) => typeof t === 'string').map((t) => t.trim()).filter(Boolean)),
  ).slice(0, MAX_TRICK_VOTES_PER_WEEK).map((t) => t.slice(0, 120));

  const week = currentTrickVoteWeek();
  const orgId = await profileOrgId(actor.id);

  // Voting is one-shot per week: once a pick exists for this voter + week +
  // participant scope, block any further changes (server-side, not just a UI
  // hint) until next Monday's reset — a client-side lock alone could be
  // bypassed with a direct API call.
  let existingQuery = supabase
    .from('trick_votes')
    .select('id', { count: 'exact', head: true })
    .eq('voter_profile_id', actor.id)
    .eq('week_start', week);
  existingQuery = participantId ? existingQuery.eq('participant_id', participantId) : existingQuery.is('participant_id', null);
  const { count: existingCount, error: existingError } = await existingQuery;
  if (existingError) throw existingError;
  if ((existingCount || 0) > 0) {
    throw httpError('Tento týden jsi už hlasoval/a. Další hlasování je až po pondělním resetu.', 409);
  }

  if (tricks.length > 0) {
    const rows = tricks.map((name) => ({
      org_id: orgId,
      voter_profile_id: actor.id,
      participant_id: participantId || null,
      trick_name: name,
      week_start: week,
    }));
    const { error: insError } = await supabase.from('trick_votes').insert(rows);
    if (insError) throw insError;
  }

  response.status(201).json({ week, tricks });
}));

app.get('/api/admin/trick-votes', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);
  const week = currentTrickVoteWeek();

  const { data, error } = await supabase
    .from('trick_votes')
    .select('trick_name,voter_profile_id')
    .eq('org_id', orgId)
    .eq('week_start', week);
  if (error) throw error;

  const counts = new Map();
  const voters = new Set();
  for (const row of data || []) {
    counts.set(row.trick_name, (counts.get(row.trick_name) || 0) + 1);
    voters.add(row.voter_profile_id);
  }
  const results = Array.from(counts.entries())
    .map(([trickName, votes]) => ({ trickName, votes }))
    .sort((a, b) => b.votes - a.votes || a.trickName.localeCompare(b.trickName));

  response.json({ week, results, totalVotes: (data || []).length, totalVoters: voters.size });
}));

// ─── Parent organization membership ─────────────────────────────────────────
// A parent can belong to several organizations. They see only the products of
// the organizations they have joined (enforced by RLS via organization_members).
const JOINABLE_ORG_STATUSES = ['exempt', 'active', 'trialing'];

// List the parent's joined organizations (with product counts) + organizations
// that are still available to join.
app.get('/api/parent/organizations', asyncRoute(async (request, response) => {
  requireServices();
  const actor = await requireParentOrAdmin(request);
  const parentProfileId = parentProfileIdForActor(actor, request.query.parentProfileId);

  const { data: memberRows, error: memberError } = await supabase
    .from('organization_members')
    .select('org_id, organizations(id,name,org_type,subscription_status)')
    .eq('profile_id', parentProfileId);
  if (memberError) throw memberError;

  const joinedIds = (memberRows || []).map((row) => row.org_id);

  // Per-org product counts (published products only).
  const productCounts = new Map();
  if (joinedIds.length > 0) {
    const { data: productRows, error: productError } = await supabase
      .from('products')
      .select('org_id')
      .eq('is_published', true)
      .in('org_id', joinedIds);
    if (productError) throw productError;
    for (const row of productRows || []) {
      productCounts.set(row.org_id, (productCounts.get(row.org_id) || 0) + 1);
    }
  }

  const joined = (memberRows || [])
    .map((row) => {
      const org = row.organizations || {};
      return {
        id: org.id || row.org_id,
        name: org.name || 'Organizace',
        orgType: org.org_type || 'external',
        productCount: productCounts.get(row.org_id) || 0,
      };
    })
    // VYS first, then alphabetical.
    .sort((a, b) => (a.orgType === 'vys' ? -1 : b.orgType === 'vys' ? 1 : a.name.localeCompare(b.name)));

  // Available = publicly joinable orgs the parent is not already in.
  const { data: publicOrgs, error: publicError } = await supabase.rpc('teamvys_public_organizations');
  if (publicError) throw publicError;
  const joinedSet = new Set(joinedIds);
  const available = (publicOrgs || [])
    .filter((org) => !joinedSet.has(org.id))
    .map((org) => ({ id: org.id, name: org.name, orgType: org.org_type }));

  response.json({ joined, available });
}));

// Join an organization — adds a parent membership row so its products appear.
app.post('/api/parent/organizations', asyncRoute(async (request, response) => {
  requireServices();
  const actor = await requireParentOrAdmin(request);
  const parentProfileId = parentProfileIdForActor(actor, request.body.parentProfileId);
  const orgId = requiredString(request.body.orgId, 'orgId');

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id,name,subscription_status')
    .eq('id', orgId)
    .maybeSingle();
  if (orgError) throw orgError;
  if (!org) throw httpError('Organizace nebyla nalezena.', 404);
  if (!JOINABLE_ORG_STATUSES.includes(org.subscription_status)) {
    throw httpError('Tahle organizace momentálně nepřijímá nové členy.', 409);
  }

  const { error: insertError } = await supabase
    .from('organization_members')
    .upsert({ org_id: orgId, profile_id: parentProfileId, role: 'parent' }, { onConflict: 'org_id,profile_id' });
  if (insertError) throw insertError;

  response.status(201).json({ ok: true, orgId, name: org.name });
}));

// Leave an organization — removes the parent membership (cannot leave the last one).
app.delete('/api/parent/organizations/:orgId', asyncRoute(async (request, response) => {
  requireServices();
  const actor = await requireParentOrAdmin(request);
  const parentProfileId = parentProfileIdForActor(actor, request.query.parentProfileId);
  const orgId = requiredString(request.params.orgId, 'orgId');

  const { data: memberRows, error: memberError } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('profile_id', parentProfileId);
  if (memberError) throw memberError;

  const memberIds = (memberRows || []).map((row) => row.org_id);
  if (!memberIds.includes(orgId)) throw httpError('Tahle organizace není mezi tvými.', 404);
  if (memberIds.length <= 1) throw httpError('Musíš zůstat alespoň v jedné organizaci.', 409);

  const { error: deleteError } = await supabase
    .from('organization_members')
    .delete()
    .eq('profile_id', parentProfileId)
    .eq('org_id', orgId);
  if (deleteError) throw deleteError;

  response.json({ ok: true, orgId });
}));

// GET /api/parent/coaches — only coaches teaching a product the parent actually
// paid for, each labeled with where/what they coach so parents don't rate
// random unrelated coaches.
app.get('/api/parent/coaches', asyncRoute(async (request, response) => {
  requireServices();
  const actor = await requireParentOrAdmin(request);
  const parentProfileId = parentProfileIdForActor(actor, request.query.parentProfileId);

  const { data: purchaseRows, error: purchaseError } = await supabase
    .from('parent_purchases')
    .select('product_id')
    .eq('parent_profile_id', parentProfileId)
    .eq('status', 'Zaplaceno');
  if (purchaseError) throw purchaseError;

  const productIds = Array.from(new Set((purchaseRows || []).map((row) => row.product_id).filter(Boolean)));
  if (productIds.length === 0) { response.json({ coaches: [] }); return; }

  const { data: productRows, error: productError } = await supabase
    .from('products')
    .select('id,title,place,coach_ids')
    .in('id', productIds);
  if (productError) throw productError;

  const coachIds = Array.from(new Set((productRows || []).flatMap((p) => p.coach_ids || []).filter(Boolean)));
  if (coachIds.length === 0) { response.json({ coaches: [] }); return; }

  const { data: profileRows, error: profileError } = await supabase
    .from('app_profiles')
    .select('id,name')
    .in('id', coachIds);
  if (profileError) throw profileError;

  const namesById = new Map((profileRows || []).map((p) => [p.id, p.name]));
  const placesByCoachId = new Map();
  for (const product of productRows || []) {
    for (const coachId of product.coach_ids || []) {
      const label = `${product.title} · ${product.place}`;
      const existing = placesByCoachId.get(coachId);
      if (existing) { if (!existing.includes(label)) existing.push(label); } else { placesByCoachId.set(coachId, [label]); }
    }
  }

  const coaches = coachIds
    .filter((id) => namesById.has(id))
    .map((id) => ({ id, name: namesById.get(id), places: placesByCoachId.get(id) || [] }));

  response.json({ coaches });
}));

app.get('/api/public/coaches', asyncRoute(async (_request, response) => {
  requireServices();

  const { data: coachRows, error } = await supabase
    .from('coach_profiles')
    .select('id, profile_photo_url')
    .eq('approval_status', 'approved');

  if (error) throw error;

  const ids = (coachRows || []).map((r) => r.id).filter((id) => !isDemoAdminRecord(id));
  if (ids.length === 0) {
    response.json({ coaches: [] });
    return;
  }

  const { data: profiles } = await supabase
    .from('app_profiles')
    .select('id, name')
    .in('id', ids);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p.name]));
  const coaches = (coachRows || [])
    .filter((r) => !isDemoAdminRecord(r.id))
    .map((r) => ({
      id: r.id,
      name: profileMap.get(r.id) || 'Trenér TeamVYS',
      photoUrl: r.profile_photo_url || '/vys-logo-mark.png',
    }));

  response.json({ coaches });
}));

app.get('/api/camps', asyncRoute(async (_request, response) => {
  requireServices();

  const { data, error } = await supabase
    .from('products')
    .select('id,type,title,city,place,venue,price,price_label,primary_meta,secondary_meta,description,important_info,capacity_total,capacity_current,coach_ids,badge,event_date,expires_at')
    .eq('type', 'Tábor')
    .eq('org_id', VYS_ORG_ID)
    .order('created_at', { ascending: true });

  if (error) throw error;
  const camps = await applyLiveProductCapacities(data || []);
  response.json({ camps });
}));

app.get('/api/courses', asyncRoute(async (_request, response) => {
  requireServices();

  const { data, error } = await supabase
    .from('products')
    .select('id,type,title,city,place,venue,price,price_label,entries_total,primary_meta,secondary_meta,description,important_info,capacity_total,capacity_current,coach_ids,badge')
    .eq('type', 'Kroužek')
    .eq('org_id', VYS_ORG_ID)
    .order('city', { ascending: true });

  if (error) throw error;
  const courses = await applyLiveProductCapacities(data || []);
  response.json({ courses });
}));

app.get('/api/coach/sessions', asyncRoute(async (request, response) => {
  requireServices();
  const actor = await requireStaff(request);

  const requestedCoachId = typeof request.query.coachId === 'string' ? request.query.coachId : actor.id;
  if (actor.role !== 'admin' && actor.id !== requestedCoachId) {
    throw httpError('Trenér může zobrazit jen vlastní sessions.', 403);
  }

  const { data, error } = await supabase
    .from('coach_sessions')
    .select('*')
    .eq('coach_id', requestedCoachId)
    .order('day', { ascending: true });

  if (error) throw error;
  response.json({ sessions: data });
}));

// Sends a real native push notification to a parent's phone when their child
// taps NFC at a training. The parent_notifications row already has
// parent_profile_id resolved by a DB trigger; the coach client reads it back
// and passes it here. Service role reads the parent's Expo push tokens and
// forwards the message to Expo's push service.
// Send an Expo push notification to a set of profile ids. Never throws — push
// is best-effort (Expo may be briefly unreachable). Returns the number sent.
async function sendExpoPushToProfiles(profileIds, title, body) {
  const ids = Array.from(new Set((profileIds || []).filter(Boolean)));
  if (ids.length === 0) return 0;

  const { data: tokenRows, error } = await supabase
    .from('push_tokens')
    .select('token')
    .in('profile_id', ids);
  if (error) return 0;

  const tokens = (tokenRows || [])
    .map((row) => row.token)
    .filter((token) => typeof token === 'string' && token.startsWith('ExponentPushToken'));
  if (tokens.length === 0) return 0;

  const messages = tokens.map((to) => ({ to, sound: 'default', title, body, priority: 'high', channelId: 'default' }));
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch {
    // best-effort
  }
  return tokens.length;
}

app.post('/api/notifications/attendance-push', asyncRoute(async (request, response) => {
  requireServices();
  await requireStaff(request);

  const parentProfileId = requiredString(request.body.parentProfileId, 'parentProfileId');
  const participantName = optionalString(request.body.participantName) || 'Dítě';
  const location = optionalString(request.body.location) || '';

  const { data: tokenRows, error } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('profile_id', parentProfileId);
  if (error) throw error;

  const pushTokens = (tokenRows || [])
    .map((row) => row.token)
    .filter((token) => typeof token === 'string' && token.startsWith('ExponentPushToken'));

  if (pushTokens.length === 0) {
    response.json({ ok: true, sent: 0 });
    return;
  }

  const messages = pushTokens.map((to) => ({
    to,
    sound: 'default',
    title: `${participantName} dorazil/a na trénink`,
    body: location ? `${location} · zapsáno v pořádku` : 'Zapsáno v pořádku',
    priority: 'high',
    channelId: 'default',
  }));

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch {
    // Never fail the request if Expo is briefly unreachable — the in-app
    // realtime notification still delivers.
  }

  response.json({ ok: true, sent: pushTokens.length });
}));

app.post('/api/coach/attendance', asyncRoute(async (request, response) => {
  requireServices();
  const actor = await requireStaff(request);

  const coachId = requiredString(request.body.coachId, 'coachId');
  if (actor.role !== 'admin' && actor.id !== coachId) throw httpError('Trenér může zapisovat jen vlastní docházku.', 403);

  const sessionId = requiredString(request.body.sessionId, 'sessionId');
  const place = requiredString(request.body.place, 'place');
  const present = requiredString(request.body.present, 'present');
  const requestedHourlyRate = Number(request.body.hourlyRate || DEFAULT_COURSE_ATTENDANCE_RATE);

  const { data: session, error: sessionError } = await supabase
    .from('coach_sessions')
    .select('id, coach_id, org_id, city, venue, day, time, group_name, duration_hours, hourly_rate, latitude, longitude, check_in_radius_meters')
    .eq('id', sessionId)
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session && actor.role !== 'admin') throw new Error('Session nebyla nalezena.');
  if (session && actor.role !== 'admin' && session.coach_id !== coachId) throw httpError('Trenér může zapisovat jen trénink, na který je přiřazený.', 403);

  const durationHours = numericOrFallback(request.body.durationHours, numericOrFallback(session?.duration_hours, 1));
  const hourlyRate = session ? await resolveCoachAttendanceRate(coachId, session, requestedHourlyRate) : numericOrFallback(requestedHourlyRate, DEFAULT_COURSE_ATTENDANCE_RATE);

  // GPS + den + časové okno validace (admin bypasses)
  if (actor.role !== 'admin') {
    const todayName = pragueWeekday();
    if (session.day && session.day !== todayName) {
      throw httpError(`Tato session je na ${session.day}, ale dnes je ${todayName}.`, 403);
    }

    // Časové okno: docházku lze zapsat od 1 hodiny před začátkem tréninku
    // do 1 hodiny po jeho konci (čas na zapsání před i po).
    const range = parseSessionTimeRange(session.time);
    if (range) {
      const nowMin = pragueNowMinutes();
      const windowStart = range.start - 60;
      const windowEnd = range.end + 60;
      if (nowMin < windowStart || nowMin > windowEnd) {
        throw httpError(`Docházku lze zapsat jen v čase tréninku — od ${formatMinutes(windowStart)} do ${formatMinutes(windowEnd)}. Teď je ${formatMinutes(nowMin)}.`, 403);
      }
    }

    if (session.latitude != null && session.longitude != null) {
      const reqLat = Number(request.body.latitude);
      const reqLon = Number(request.body.longitude);
      if (isNaN(reqLat) || isNaN(reqLon) || request.body.latitude === undefined) {
        throw httpError('Pro zápis docházky je vyžadována GPS poloha (latitude, longitude).', 400);
      }
      const distanceMeters = Math.round(haversineMeters(reqLat, reqLon, session.latitude, session.longitude));
      const radiusMeters = session.check_in_radius_meters ?? 300;
      if (distanceMeters > radiusMeters) {
        throw httpError(`Jsi ${distanceMeters} m od tréninku (povoleno ${radiusMeters} m). Přesuň se blíž ke škole.`, 403);
      }
    }
  }
  const today = new Date().toLocaleDateString('cs-CZ');
  const row = {
    id: `coach-att-${sessionId}-${new Date().toISOString().slice(0, 10)}`,
    coach_id: coachId,
    session_id: session?.id ?? null,
    date_text: today,
    place,
    status: 'Zapsáno',
    present,
    duration_hours: durationHours,
    hourly_rate: hourlyRate,
    amount: Math.round(durationHours * hourlyRate),
  };
  if (session?.org_id) row.org_id = session.org_id;

  const { data, error } = await supabase
    .from('coach_attendance_records')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;
  response.status(201).json({ attendance: data });
}));

app.post('/api/payments/checkout', asyncRoute(async (request, response) => {
  requireServices();
  const actor = await requireParentOrAdmin(request);
  requireStripe();

  const productId = requiredString(request.body.productId, 'productId');
  const participantId = requiredString(request.body.participantId, 'participantId');
  await assertParticipantAccessible(actor, participantId);

  const participantName = requiredString(request.body.participantName, 'participantName');
  const successUrl = requiredString(request.body.successUrl, 'successUrl');
  const cancelUrl = requiredString(request.body.cancelUrl, 'cancelUrl');
  const parentProfileId = parentProfileIdForActor(actor, request.body.parentProfileId);
  const receiptEmail = await profileReceiptEmail(parentProfileId, request.body.receiptEmail || actor.email);
  const product = await ensureProductCapacity(productId);
  const originalAmount = Math.round(Number(product.price));
  const discountCode = optionalString(request.body.discountCode);
  const discount = discountCode ? rewardDiscountForCode(discountCode, product.type) : null;

  if (discountCode && !discount) throw new Error('Slevový kód nejde použít pro tento produkt.');

  const discountAmount = discount ? Math.round((originalAmount * discount.percent) / 100) : 0;
  const amount = Math.max(0, originalAmount - discountAmount);
  const { orgStripe } = await getProductOrgStripe(product);

  const paymentIntentData = {
    ...(receiptEmail ? { receipt_email: receiptEmail } : {}),
  };

  const session = await orgStripe.checkout.sessions.create({
    mode: 'payment',
    locale: 'cs',
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: receiptEmail || undefined,
    payment_intent_data: Object.keys(paymentIntentData).length > 0 ? paymentIntentData : undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'czk',
          unit_amount: amount * 100,
          product_data: {
            name: product.title,
            description: `${product.place} · ${participantName}`,
          },
        },
      },
    ],
    metadata: {
      parent_profile_id: parentProfileId,
      product_id: product.id,
      participant_id: participantId,
      participant_name: participantName,
      type: product.type,
      title: product.title,
      amount: String(amount),
      original_amount: String(originalAmount),
      discount_code: discountCode || '',
      discount_percent: discount ? String(discount.percent) : '',
      discount_amount: discountAmount ? String(discountAmount) : '',
      receipt_email: receiptEmail || '',
      price_label: discount ? `${product.price_label} · sleva ${discount.percent} %` : product.price_label,
      place: product.place,
      org_id: product.org_id || VYS_ORG_ID,
      event_date: product.event_date || '',
      expires_at: product.expires_at || '',
    },
  });

  response.json({ id: session.id, url: session.url });
}));

// Publishable keys are not secret — this endpoint requires no auth so the
// mobile/web client can load the correct Stripe.js instance for a product's
// owning organization before creating the PaymentIntent Elements/PaymentSheet UI.
app.get('/api/payments/publishable-key', asyncRoute(async (request, response) => {
  requireServices();
  const productId = requiredString(request.query.productId, 'productId');
  const product = await getProduct(productId);
  const orgId = product.org_id || VYS_ORG_ID;

  if (orgId === VYS_ORG_ID) {
    if (!stripePublishableKey) throw httpError('Na serveru chybí STRIPE_PUBLISHABLE_KEY.', 500);
    return response.json({ publishableKey: stripePublishableKey });
  }

  const { data: org, error } = await supabase
    .from('organizations')
    .select('stripe_publishable_key')
    .eq('id', orgId)
    .maybeSingle();
  if (error) throw error;
  if (!org?.stripe_publishable_key) throw httpError('Organizace zatím nemá nastavený Stripe publishable key.', 409);

  response.json({ publishableKey: org.stripe_publishable_key });
}));

app.post('/api/payments/payment-intent', asyncRoute(async (request, response) => {
  requireServices();
  const actor = await requireParentOrAdmin(request);
  requireStripe();

  const productId = requiredString(request.body.productId, 'productId');
  const participantId = requiredString(request.body.participantId, 'participantId');
  await assertParticipantAccessible(actor, participantId);

  const participantName = requiredString(request.body.participantName, 'participantName');
  const parentProfileId = parentProfileIdForActor(actor, request.body.parentProfileId);
  const receiptEmail = await profileReceiptEmail(parentProfileId, request.body.receiptEmail || actor.email);
  const product = await ensureProductCapacity(productId);
  const originalAmount = Math.round(Number(product.price));
  const discountCode = optionalString(request.body.discountCode);
  const discount = discountCode ? rewardDiscountForCode(discountCode, product.type) : null;

  if (discountCode && !discount) throw new Error('Slevový kód nejde použít pro tento produkt.');

  const discountAmount = discount ? Math.round((originalAmount * discount.percent) / 100) : 0;
  const amount = Math.max(0, originalAmount - discountAmount);
  if (amount <= 0) throw new Error('Částka platby musí být větší než 0 Kč.');

  const trainingDays = resolveTrainingDaysSelection(product, request.body.trainingDays);
  const priceLabel = discount ? `${product.price_label} · sleva ${discount.percent} %` : product.price_label;
  const metadata = {
    parent_profile_id: parentProfileId,
    product_id: product.id,
    participant_id: participantId,
    participant_name: participantName,
    type: product.type,
    title: product.title,
    amount: String(amount),
    original_amount: String(originalAmount),
    discount_code: discountCode || '',
    discount_percent: discount ? String(discount.percent) : '',
    discount_amount: discountAmount ? String(discountAmount) : '',
    receipt_email: receiptEmail || '',
    price_label: priceLabel,
    place: product.place,
    org_id: product.org_id || VYS_ORG_ID,
    event_date: product.event_date || '',
    expires_at: product.expires_at || '',
    training_days: trainingDays ? trainingDays.join(',') : '',
  };

  const connectDestination = await connectDestinationForProduct(product);
  const { orgStripe: piOrgStripe } = await getProductOrgStripe(product);
  const paymentIntent = await piOrgStripe.paymentIntents.create({
    amount: amount * 100,
    currency: 'czk',
    description: `TeamVYS · ${product.title} · ${participantName}`,
    receipt_email: receiptEmail || undefined,
    metadata,
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
  });

  // Intentionally do NOT write to parent_purchases here — clicking "Koupit" only
  // creates a Stripe PaymentIntent, it does not mean the payment succeeded.
  // The purchase row is created exclusively in finalizePaymentIntent(), once
  // Stripe confirms the PaymentIntent actually succeeded (via the webhook or
  // the explicit /confirm-payment-intent call below).

  response.status(201).json({
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amount,
    originalAmount,
    discountAmount,
    discountPercent: discount?.percent ?? 0,
    priceLabel,
  });
}));

app.post('/api/payments/confirm-payment-intent', asyncRoute(async (request, response) => {
  requireServices();
  const actor = await requireParentOrAdmin(request);
  requireStripe();

  const paymentIntentId = requiredString(request.body.paymentIntentId, 'paymentIntentId');
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  assertPaymentIntentAccessible(actor, paymentIntent);
  const purchase = await finalizePaymentIntent(paymentIntent);

  response.json({ purchase: toClientPurchase(purchase) });
}));

// Parent self-service cancellation of a kroužek permanentka:
// allowed only within 14 days of purchase AND when no paid entry was used.
// Refunds the original card payment via the owning org's Stripe account.
app.post('/api/parent/purchases/:id/cancel', asyncRoute(async (request, response) => {
  requireServices();
  const actor = await requireParentOrAdmin(request);
  const purchaseId = requiredString(request.params.id, 'purchase id');

  const { data: purchase, error } = await supabase
    .from('parent_purchases')
    .select('*')
    .eq('id', purchaseId)
    .maybeSingle();
  if (error) throw error;
  if (!purchase) throw httpError('Nákup nebyl nalezen.', 404);

  if (actor.role !== 'admin' && purchase.parent_profile_id !== actor.id) {
    throw httpError('Tento nákup nepatří k tvému účtu.', 403);
  }
  if (purchase.status === 'Stornováno') throw httpError('Tento nákup je už stornovaný.', 409);
  if (purchase.type !== 'Kroužek') {
    throw httpError('Automatické storno je možné jen u permanentky na kroužek. U ostatních produktů nám prosím napiš.', 409);
  }

  const createdAtMs = purchase.created_at ? new Date(purchase.created_at).getTime() : NaN;
  const daysSince = Number.isNaN(createdAtMs) ? Infinity : (Date.now() - createdAtMs) / (1000 * 60 * 60 * 24);
  if (daysSince > 14) {
    throw httpError('Storno je možné jen do 14 dnů od zakoupení. Napiš nám prosím na e-mail o individuální posouzení.', 409);
  }

  const { data: passes, error: passErr } = await supabase
    .from('digital_passes')
    .select('id,used_entries')
    .eq('purchase_id', purchase.id);
  if (passErr) throw passErr;
  const usedEntries = (passes ?? []).reduce((sum, p) => sum + Number(p.used_entries || 0), 0);
  if (usedEntries > 0) {
    throw httpError('Permanentka je už aktivovaná (byl využit vstup), automatické storno už není možné. Napiš nám o individuální řešení.', 409);
  }

  if (!purchase.stripe_payment_intent_id) {
    throw httpError('U této platby chybí údaj pro automatické vrácení. Napiš nám prosím na e-mail a peníze vrátíme ručně.', 409);
  }
  const orgId = purchase.org_id || VYS_ORG_ID;
  const stripeClient = await getOrgStripe(orgId);
  if (!stripeClient) {
    throw httpError('Platbu nejde automaticky vrátit (chybí Stripe). Napiš nám prosím na e-mail.', 409);
  }

  let refund;
  try {
    refund = await stripeClient.refunds.create({ payment_intent: purchase.stripe_payment_intent_id });
  } catch (err) {
    throw httpError(`Vrácení platby se nepodařilo: ${err?.message || 'zkus to prosím znovu'}`, 502);
  }

  await supabase.from('parent_purchases').update({ status: 'Stornováno', paid_at: 'Stornováno' }).eq('id', purchase.id);
  await supabase.from('digital_passes').delete().eq('purchase_id', purchase.id);
  await supabase.from('parent_payments').update({ status: 'refunded' }).ilike('id', `%${purchase.stripe_payment_intent_id}%`);

  response.json({ ok: true, refunded: Number(purchase.amount || 0), refundId: refund?.id || null });
}));

app.post('/api/participants/manual', asyncRoute(async (request, response) => {
  requireServices();
  const actor = await requireParentOrAdmin(request);

  const firstName = requiredString(request.body.firstName, 'firstName');
  const lastName = requiredString(request.body.lastName, 'lastName');
  const dateOfBirth = requiredString(request.body.dateOfBirth, 'dateOfBirth');
  const schoolYear = requiredString(request.body.schoolYear, 'schoolYear');
  const parentName = requiredString(request.body.parentName, 'parentName');
  const parentPhone = requiredString(request.body.parentPhone, 'parentPhone');
  const emergencyPhone = requiredString(request.body.emergencyPhone, 'emergencyPhone');
  const address = requiredString(request.body.address, 'address');
  const preferredCourse = optionalString(request.body.preferredCourse) ?? '';
  const departureMode = optionalString(request.body.departureMode) ?? 'parent';
  const allergies = optionalString(request.body.allergies) ?? 'Bez alergií';
  const healthLimits = optionalString(request.body.healthLimits) ?? 'Bez omezení';
  const medicationNote = optionalString(request.body.medicationNote) ?? 'Bez léků';

  if (!['parent', 'alone', 'authorized'].includes(departureMode)) throw httpError('Neplatný způsob odchodu.', 400);

  const participantId = `manual-${slugify(`${firstName}-${lastName}-${dateOfBirth}`)}`;
  await assertParticipantAccessible(actor, participantId);

  const parentProfileId = parentProfileIdForActor(actor, request.body.parentProfileId);
  const row = {
    id: participantId,
    parent_profile_id: parentProfileId,
    first_name: firstName,
    last_name: lastName,
    date_of_birth: dateOfBirth,
    school_year: schoolYear,
    parent_name: parentName,
    parent_phone: parentPhone,
    emergency_phone: emergencyPhone,
    address,
    departure_mode: departureMode,
    authorized_people: optionalString(request.body.authorizedPeople),
    allergies,
    health_limits: healthLimits,
    medication_note: medicationNote,
    coach_note: optionalString(request.body.coachNote),
    without_phone: true,
    active_course: preferredCourse,
    next_training: 'Doplní se po zařazení do kurzu',
    paid_status: 'due',
    active_purchases: [],
  };

  // Generate claim_code for new participants (do not overwrite existing code on upsert)
  const { data: existing } = await supabase.from('participants').select('id,claim_code').eq('id', participantId).maybeSingle();
  if (!existing?.claim_code) row.claim_code = generateClaimCode();

  const { data, error } = await supabase
    .from('participants')
    .upsert(row, { onConflict: 'id' })
    .select('id,first_name,last_name,active_course,claim_code')
    .single();

  if (error) throw error;
  response.status(201).json({ participant: data });
}));

app.post('/api/participants/link', asyncRoute(async (request, response) => {
  requireServices();
  const actor = await requireParentOrAdmin(request);

  const parentProfileId = parentProfileIdForActor(actor, request.body.parentProfileId);
  const claimCode = requiredString(request.body.claimCode, 'claimCode').toUpperCase().trim();

  const { data: participant, error: findError } = await supabase
    .from('participants')
    .select('id,parent_profile_id,first_name,last_name,active_course')
    .eq('claim_code', claimCode)
    .maybeSingle();

  if (findError) throw findError;
  if (!participant) throw new Error('Účastník s tímto kódem nebyl nalezen. Zkontroluj kód a zkus to znovu.');

  if (participant.parent_profile_id && participant.parent_profile_id !== parentProfileId) {
    throw new Error('Účastník už je připojený k jinému rodičovskému účtu.');
  }

  const { data, error } = await supabase
    .from('participants')
    .update({ parent_profile_id: parentProfileId })
    .eq('id', participant.id)
    .select('id,first_name,last_name,active_course,parent_profile_id')
    .single();

  if (error) throw error;
  response.json({ participant: data });
}));

// Set the additional schools (same city) a child can attend on ONE permanentka.
// The child keeps a single kroužek pass; its entries are shared across the
// primary school (active_course) and these extra schools. Attendance RPC and
// admin/coach views read participants.extra_courses.
app.post('/api/participants/extra-courses', asyncRoute(async (request, response) => {
  requireServices();
  const actor = await requireParentOrAdmin(request);

  const participantId = requiredString(request.body.participantId, 'participantId');
  await assertParticipantAccessible(actor, participantId);

  const requested = Array.isArray(request.body.extraCourses) ? request.body.extraCourses : [];
  const requestedPlaces = [...new Set(requested.map((place) => String(place || '').trim()).filter(Boolean))];

  const { data: participant, error: participantError } = await supabase
    .from('participants')
    .select('id, active_course, org_id')
    .eq('id', participantId)
    .maybeSingle();
  if (participantError) throw participantError;
  if (!participant) throw httpError('Účastník nenalezen.', 404);

  const cityOf = (place) => String(place || '').split(' · ')[0].trim().toLowerCase();
  const primaryCourse = String(participant.active_course || '').trim();
  const primaryCity = cityOf(primaryCourse);

  // Only real published Kroužek schools in the SAME city and same org are allowed
  // (and never the primary course itself). This prevents a client from smuggling
  // arbitrary or cross-city places into extra_courses.
  const { data: courses, error: coursesError } = await supabase
    .from('products')
    .select('place, city, type, org_id, is_published')
    .eq('type', 'Kroužek')
    .eq('is_published', true);
  if (coursesError) throw coursesError;

  const allowed = new Set(
    (courses || [])
      .filter((course) => !participant.org_id || course.org_id === participant.org_id)
      .filter((course) => primaryCity && (String(course.city || '').trim().toLowerCase() === primaryCity || cityOf(course.place) === primaryCity))
      .map((course) => String(course.place || '').trim())
      .filter((place) => place && place !== primaryCourse),
  );

  const extraCourses = requestedPlaces.filter((place) => allowed.has(place));

  const { error: updateError } = await supabase
    .from('participants')
    .update({ extra_courses: extraCourses })
    .eq('id', participantId);
  if (updateError) throw updateError;

  response.json({ ok: true, extraCourses });
}));

app.post('/api/course-documents', asyncRoute(async (request, response) => {
  requireServices();
  const actor = await requireParentOrAdmin(request);

  const productId = requiredString(request.body.productId, 'productId');
  const participantId = requiredString(request.body.participantId, 'participantId');
  await assertParticipantAccessible(actor, participantId);

  const participantName = requiredString(request.body.participantName, 'participantName');
  const participantFirstName = requiredString(request.body.participantFirstName, 'participantFirstName');
  const participantLastName = requiredString(request.body.participantLastName, 'participantLastName');
  const documents = Array.isArray(request.body.documents) ? request.body.documents : [];

  if (documents.length === 0) throw new Error('At least one document is required.');

  const product = await getProduct(productId);
  const parentProfileId = parentProfileIdForActor(actor, request.body.parentProfileId);

  const { error: participantError } = await supabase
    .from('participants')
    .upsert({
      id: participantId,
      parent_profile_id: parentProfileId,
      first_name: participantFirstName,
      last_name: participantLastName,
      active_course: product.place,
      next_training: product.event_date || product.expires_at || 'Doplní se po registraci',
    }, { onConflict: 'id' });

  if (participantError) throw participantError;

  const now = new Date();
  const purchaseId = `pending-${participantId}-${product.id}`;
  const rows = documents.map((document) => {
    const kind = requiredString(document.kind, 'document kind');
    const title = requiredString(document.title, 'document title');
    const parentName = requiredString(document.parentName, 'parentName');
    const payload = document.payload && typeof document.payload === 'object' ? document.payload : {};

    return {
      id: `web-doc-${participantId}-${product.id}-${kind}`,
      participant_id: participantId,
      participant_name: participantName,
      purchase_id: purchaseId,
      product_id: product.id,
      activity_type: product.type,
      kind,
      title,
      status: 'signed',
      parent_name: parentName,
      course_place: product.place,
      payload: {
        ...payload,
        savedFrom: 'web-parent-checkout',
        savedVia: 'teamvys-api',
      },
      signed_at_text: now.toLocaleDateString('cs-CZ'),
      updated_at_text: now.toLocaleString('cs-CZ'),
    };
  });

  const { data, error } = await supabase
    .from('course_documents')
    .upsert(rows, { onConflict: 'id' })
    .select('id,participant_id,product_id,kind,title,status,updated_at_text');

  if (error) throw error;
  response.status(201).json({ documents: data });
}));

// ---------------------------------------------------------------------------
// Admin → parents broadcast messages (parent notification center)
// ---------------------------------------------------------------------------
app.post('/api/admin/broadcasts', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);

  const title = requiredString(request.body.title, 'title');
  const body = requiredString(request.body.body, 'body');
  const audience = optionalString(request.body.audience) === 'selected' ? 'selected' : 'all';
  const requestedParentProfileIds = Array.isArray(request.body.parentProfileIds)
    ? Array.from(new Set(request.body.parentProfileIds.map((id) => optionalString(id)).filter(Boolean)))
    : [];

  if (requestedParentProfileIds.length === 0) throw httpError('Vyber aspoň jednoho příjemce.', 400);

  // SECURITY: this route uses the service role (bypasses RLS), and the client
  // only ever offers org-scoped parents in its UI — but that's not enough on
  // its own, since nothing stops a crafted request from passing an arbitrary
  // parentProfileId. Cross-check every id against organization_members for
  // THIS admin's org before writing anything, so a message can never reach a
  // parent belonging to a different organization.
  const { data: memberRows, error: memberError } = await supabase
    .from('organization_members')
    .select('profile_id')
    .eq('org_id', orgId)
    .eq('role', 'parent')
    .in('profile_id', requestedParentProfileIds);
  if (memberError) throw memberError;

  const validParentIds = new Set((memberRows || []).map((row) => row.profile_id));
  const parentProfileIds = requestedParentProfileIds.filter((id) => validParentIds.has(id));

  if (parentProfileIds.length === 0) throw httpError('Žádný z vybraných příjemců nepatří k tvé organizaci.', 403);

  const senderName = profile.name || 'Organizace';
  const nowIso = new Date().toISOString();

  const { data: broadcast, error: broadcastError } = await supabase
    .from('parent_broadcasts')
    .insert({
      org_id: orgId,
      sender_id: profile.id,
      sender_name: senderName,
      title,
      body,
      audience,
      recipient_count: parentProfileIds.length,
      created_at: nowIso,
    })
    .select('id')
    .single();
  if (broadcastError) throw broadcastError;

  const recipientRows = parentProfileIds.map((parentProfileId) => ({
    broadcast_id: broadcast.id,
    org_id: orgId,
    parent_profile_id: parentProfileId,
    title,
    body,
    sender_name: senderName,
    created_at: nowIso,
  }));
  const { error: recipientsError } = await supabase.from('parent_broadcast_recipients').insert(recipientRows);
  if (recipientsError) throw recipientsError;

  // Best-effort native push to each parent (no-op for parents without a device).
  const pushed = await sendExpoPushToProfiles(parentProfileIds, title, body);

  response.status(201).json({
    ok: true,
    broadcastId: broadcast.id,
    recipients: parentProfileIds.length,
    pushed,
    skipped: requestedParentProfileIds.length - parentProfileIds.length,
  });
}));


app.get('/api/admin/broadcasts', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);

  const { data, error } = await supabase
    .from('parent_broadcasts')
    .select('id,title,body,audience,recipient_count,sender_name,created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  response.json({ broadcasts: data || [] });
}));

// ---------------------------------------------------------------------------
// Organization-defined document slots
// ---------------------------------------------------------------------------
const DOCUMENT_SLOT_ACTIVITY_TYPES = ['Kroužek', 'Tábor', 'Workshop'];
const DOCUMENT_SLOT_FULFILLMENTS = ['electronic', 'upload', 'both'];
const DOCUMENT_SLOT_TEMPLATE_KINDS = ['gdpr', 'guardian-consent', 'health', 'departure', 'infection-free', 'packing', 'workshop-terms'];

function documentSlotFromRow(row) {
  return {
    id: row.id,
    orgId: row.org_id,
    activityType: row.activity_type,
    label: row.label,
    description: row.description ?? null,
    fulfillment: row.fulfillment,
    templateKind: row.template_kind ?? null,
    productId: row.product_id ?? null,
    templateId: row.template_id ?? null,
    templatePath: row.template_path ?? null,
    templateFilename: row.template_filename ?? null,
    required: row.required,
    sortOrder: row.sort_order,
    active: row.active,
    updatedAt: row.updated_at,
  };
}

function validateDocumentSlotActivity(activityType, orgId) {
  if (!DOCUMENT_SLOT_ACTIVITY_TYPES.includes(activityType)) {
    throw httpError('Neplatný typ aktivity. Povolené: Kroužek, Tábor, Workshop.', 400);
  }
  // Workshops are a VYS-only activity.
  if (activityType === 'Workshop' && orgId !== VYS_ORG_ID) {
    throw httpError('Workshopy může spravovat pouze organizace TeamVYS.', 403);
  }
}

app.get('/api/admin/document-slots', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);
  const activityType = optionalString(request.query.activityType);
  const productId = optionalString(request.query.productId);

  let query = supabase
    .from('document_slots')
    .select('*')
    .eq('org_id', orgId)
    .order('activity_type', { ascending: true })
    .order('sort_order', { ascending: true });

  if (activityType) query = query.eq('activity_type', activityType);
  if (productId) query = query.eq('product_id', productId);

  const { data, error } = await query;
  if (error) throw error;
  response.json({ slots: (data || []).map(documentSlotFromRow) });
}));

app.post('/api/admin/document-slots', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);

  const activityType = requiredString(request.body.activityType, 'typ aktivity');
  validateDocumentSlotActivity(activityType, orgId);

  const label = requiredString(request.body.label, 'název pole');
  const description = optionalString(request.body.description);
  const fulfillment = optionalString(request.body.fulfillment) || 'both';
  if (!DOCUMENT_SLOT_FULFILLMENTS.includes(fulfillment)) {
    throw httpError('Neplatný způsob plnění. Povolené: electronic, upload, both.', 400);
  }
  const templateKind = optionalString(request.body.templateKind);
  if (templateKind && !DOCUMENT_SLOT_TEMPLATE_KINDS.includes(templateKind)) {
    throw httpError('Neplatná elektronická šablona.', 400);
  }
  const required = request.body.required === undefined ? true : Boolean(request.body.required);
  const sortOrder = Number.isFinite(Number(request.body.sortOrder)) ? Number(request.body.sortOrder) : 0;
  const productId = optionalString(request.body.productId);
  const templatePath = optionalString(request.body.templatePath);
  const templateFilename = optionalString(request.body.templateFilename);
  const templateId = optionalString(request.body.templateId);

  const { data, error } = await supabase
    .from('document_slots')
    .insert({
      org_id: orgId,
      activity_type: activityType,
      label,
      description,
      fulfillment,
      template_kind: templateKind,
      product_id: productId,
      template_id: templateId,
      template_path: templatePath,
      template_filename: templateFilename,
      required,
      sort_order: sortOrder,
      active: true,
    })
    .select('*')
    .single();

  if (error) throw error;
  response.status(201).json({ slot: documentSlotFromRow(data) });
}));

app.patch('/api/admin/document-slots/:id', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);
  const id = requiredString(request.params.id, 'id pole');

  const { data: existing, error: existingError } = await supabase
    .from('document_slots')
    .select('id,org_id')
    .eq('id', id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing || existing.org_id !== orgId) throw httpError('Pole nebylo nalezeno.', 404);

  const patch = {};
  if (request.body.label !== undefined) patch.label = requiredString(request.body.label, 'název pole');
  if (request.body.description !== undefined) patch.description = optionalString(request.body.description);
  if (request.body.fulfillment !== undefined) {
    const fulfillment = requiredString(request.body.fulfillment, 'způsob plnění');
    if (!DOCUMENT_SLOT_FULFILLMENTS.includes(fulfillment)) throw httpError('Neplatný způsob plnění.', 400);
    patch.fulfillment = fulfillment;
  }
  if (request.body.templateKind !== undefined) {
    const templateKind = optionalString(request.body.templateKind);
    if (templateKind && !DOCUMENT_SLOT_TEMPLATE_KINDS.includes(templateKind)) throw httpError('Neplatná elektronická šablona.', 400);
    patch.template_kind = templateKind;
  }
  if (request.body.required !== undefined) patch.required = Boolean(request.body.required);
  if (request.body.sortOrder !== undefined && Number.isFinite(Number(request.body.sortOrder))) patch.sort_order = Number(request.body.sortOrder);
  if (request.body.active !== undefined) patch.active = Boolean(request.body.active);
  if (request.body.productId !== undefined) patch.product_id = optionalString(request.body.productId);
  if (request.body.templatePath !== undefined) patch.template_path = optionalString(request.body.templatePath);
  if (request.body.templateFilename !== undefined) patch.template_filename = optionalString(request.body.templateFilename);
  if (request.body.templateId !== undefined) patch.template_id = optionalString(request.body.templateId);

  if (Object.keys(patch).length === 0) throw httpError('Není co upravit.', 400);

  const { data, error } = await supabase
    .from('document_slots')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  response.json({ slot: documentSlotFromRow(data) });
}));

app.delete('/api/admin/document-slots/:id', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);
  const id = requiredString(request.params.id, 'id pole');

  const { data: existing, error: existingError } = await supabase
    .from('document_slots')
    .select('id,org_id')
    .eq('id', id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing || existing.org_id !== orgId) throw httpError('Pole nebylo nalezeno.', 404);

  const { error } = await supabase.from('document_slots').delete().eq('id', id);
  if (error) throw error;
  response.json({ ok: true });
}));

// Parent / app read: active slot definitions for an org + activity type.
app.get('/api/document-slots', asyncRoute(async (request, response) => {
  requireServices();
  await requireParentOrAdmin(request);

  const orgId = optionalString(request.query.orgId) || VYS_ORG_ID;
  const activityType = optionalString(request.query.activityType);
  const productId = optionalString(request.query.productId);

  let query = supabase
    .from('document_slots')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (productId) {
    query = query.eq('product_id', productId);
  } else {
    query = query.eq('org_id', orgId);
    if (activityType) query = query.eq('activity_type', activityType);
  }

  const { data, error } = await query;
  if (error) throw error;
  response.json({ slots: (data || []).map(documentSlotFromRow) });
}));

// ---------------------------------------------------------------------------
// Reusable document template library (per organization)
// ---------------------------------------------------------------------------
const DOCUMENT_TEMPLATE_KINDS = ['file', 'electronic'];
const CUSTOM_FIELD_TYPES = ['text', 'textarea', 'check', 'choice', 'date'];

function documentTemplateFromRow(row) {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    kind: row.kind || 'file',
    filePath: row.file_path ?? null,
    fileFilename: row.file_filename ?? null,
    body: row.body ?? null,
    createdAt: row.created_at,
  };
}

// Validate + normalize the custom electronic document body coming from the admin
// builder. Throws httpError(400) on malformed input.
function normalizeElectronicBody(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};

  const intro = typeof source.intro === 'string' ? source.intro.trim().slice(0, 2000) : '';

  const clausesInput = Array.isArray(source.clauses) ? source.clauses : [];
  const clauses = clausesInput
    .filter((c) => typeof c === 'string')
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 40)
    .map((c) => c.slice(0, 1000));

  const fieldsInput = Array.isArray(source.fields) ? source.fields : [];
  const usedIds = new Set();
  const fields = [];
  for (const rawField of fieldsInput.slice(0, 40)) {
    if (!rawField || typeof rawField !== 'object') continue;
    const label = typeof rawField.label === 'string' ? rawField.label.trim().slice(0, 200) : '';
    if (!label) continue;
    const type = CUSTOM_FIELD_TYPES.includes(rawField.type) ? rawField.type : 'text';

    let id = typeof rawField.id === 'string' && rawField.id.trim() ? rawField.id.trim().slice(0, 60) : '';
    if (!id) id = `f_${fields.length + 1}`;
    id = id.replace(/[^a-zA-Z0-9_]/g, '_');
    while (usedIds.has(id)) id = `${id}_`;
    usedIds.add(id);

    const field = { id, label, type, required: Boolean(rawField.required) };
    if (type === 'choice') {
      const options = (Array.isArray(rawField.options) ? rawField.options : [])
        .filter((o) => typeof o === 'string')
        .map((o) => o.trim())
        .filter(Boolean)
        .slice(0, 20)
        .map((o) => o.slice(0, 120));
      field.options = options;
    }
    fields.push(field);
  }

  if (!intro && clauses.length === 0 && fields.length === 0) {
    throw httpError('Elektronický dokument musí mít úvodní text, klauzuli nebo aspoň jedno pole.', 400);
  }

  return { intro: intro || null, clauses, fields };
}

app.get('/api/admin/document-templates', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);

  const { data, error } = await supabase
    .from('document_templates')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  response.json({ templates: (data || []).map(documentTemplateFromRow) });
}));

app.post('/api/admin/document-templates', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);

  const name = requiredString(request.body.name, 'název šablony');
  const kind = DOCUMENT_TEMPLATE_KINDS.includes(request.body.kind) ? request.body.kind : 'file';

  const insert = { org_id: orgId, name, kind };
  if (kind === 'electronic') {
    insert.body = normalizeElectronicBody(request.body.body);
    insert.file_path = null;
    insert.file_filename = null;
  } else {
    insert.file_path = requiredString(request.body.filePath, 'soubor šablony');
    insert.file_filename = requiredString(request.body.fileFilename, 'název souboru');
    insert.body = null;
  }

  const { data, error } = await supabase
    .from('document_templates')
    .insert(insert)
    .select('*')
    .single();

  if (error) throw error;
  response.status(201).json({ template: documentTemplateFromRow(data) });
}));

app.patch('/api/admin/document-templates/:id', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);
  const id = requiredString(request.params.id, 'id šablony');

  const { data: existing, error: existingError } = await supabase
    .from('document_templates')
    .select('id,org_id,kind')
    .eq('id', id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing || existing.org_id !== orgId) throw httpError('Šablona nebyla nalezena.', 404);

  const patch = {};
  if (request.body.name !== undefined) patch.name = requiredString(request.body.name, 'název šablony');
  if (request.body.body !== undefined && existing.kind === 'electronic') {
    patch.body = normalizeElectronicBody(request.body.body);
  }
  if (Object.keys(patch).length === 0) throw httpError('Není co uložit.', 400);
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('document_templates')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  response.json({ template: documentTemplateFromRow(data) });
}));

// Public/parent: fetch electronic template bodies for an org so the mobile app
// can render + let parents fill and sign a custom document.
app.get('/api/document-templates', asyncRoute(async (request, response) => {
  requireServices();
  await requireParentOrAdmin(request);
  const orgId = optionalString(request.query.orgId);
  const templateId = optionalString(request.query.id);

  let query = supabase.from('document_templates').select('*').eq('kind', 'electronic');
  if (orgId) query = query.eq('org_id', orgId);
  if (templateId) query = query.eq('id', templateId);

  const { data, error } = await query;
  if (error) throw error;
  response.json({ templates: (data || []).map(documentTemplateFromRow) });
}));

app.delete('/api/admin/document-templates/:id', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);
  const id = requiredString(request.params.id, 'id šablony');

  const { data: existing, error: existingError } = await supabase
    .from('document_templates')
    .select('id,org_id')
    .eq('id', id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing || existing.org_id !== orgId) throw httpError('Šablona nebyla nalezena.', 404);

  const { error } = await supabase.from('document_templates').delete().eq('id', id);
  if (error) throw error;
  response.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Library documents attached to a coach (trenér)
// ---------------------------------------------------------------------------
function coachDocumentFromRow(row) {
  const tpl = row.document_templates || {};
  return {
    id: row.id,
    coachId: row.coach_id,
    templateId: row.template_id,
    createdAt: row.created_at,
    template: {
      id: tpl.id ?? row.template_id,
      name: tpl.name ?? 'Dokument',
      kind: tpl.kind ?? 'file',
      filePath: tpl.file_path ?? null,
      fileFilename: tpl.file_filename ?? null,
    },
  };
}

app.get('/api/admin/coach-documents', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);
  const coachId = optionalString(request.query.coachId);

  let query = supabase
    .from('coach_documents')
    .select('id,coach_id,template_id,created_at,document_templates(id,name,kind,file_path,file_filename)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (coachId) query = query.eq('coach_id', coachId);

  const { data, error } = await query;
  if (error) throw error;
  response.json({ documents: (data || []).map(coachDocumentFromRow) });
}));

app.post('/api/admin/coach-documents', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);
  const coachId = requiredString(request.body.coachId, 'trenér');
  const templateId = requiredString(request.body.templateId, 'dokument');

  const { data: tpl, error: tplError } = await supabase
    .from('document_templates')
    .select('id,org_id')
    .eq('id', templateId)
    .maybeSingle();
  if (tplError) throw tplError;
  if (!tpl || tpl.org_id !== orgId) throw httpError('Dokument nebyl nalezen.', 404);

  const { data, error } = await supabase
    .from('coach_documents')
    .upsert({ org_id: orgId, coach_id: coachId, template_id: templateId }, { onConflict: 'coach_id,template_id' })
    .select('id,coach_id,template_id,created_at,document_templates(id,name,kind,file_path,file_filename)')
    .single();
  if (error) throw error;
  response.status(201).json({ document: coachDocumentFromRow(data) });
}));

app.delete('/api/admin/coach-documents/:id', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);
  const id = requiredString(request.params.id, 'id');

  const { data: existing, error: existingError } = await supabase
    .from('coach_documents')
    .select('id,org_id')
    .eq('id', id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing || existing.org_id !== orgId) throw httpError('Záznam nebyl nalezen.', 404);

  const { error } = await supabase.from('coach_documents').delete().eq('id', id);
  if (error) throw error;
  response.json({ ok: true });
}));

app.post('/api/payments/confirm', asyncRoute(async (request, response) => {
  requireServices();
  const actor = await requireParentOrAdmin(request);
  requireStripe();

  const sessionId = requiredString(request.body.sessionId, 'sessionId');
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent'] });
  assertCheckoutSessionAccessible(actor, session);

  if (session.payment_status !== 'paid') throw new Error('Stripe payment is not paid yet.');

  const metadata = session.metadata || {};
  const amount = Number(metadata.amount || Math.round((session.amount_total || 0) / 100));
  const row = {
    id: `stripe-${session.id}`,
    parent_profile_id: optionalString(metadata.parent_profile_id),
    product_id: requiredString(metadata.product_id, 'product metadata'),
    participant_id: requiredString(metadata.participant_id, 'participant metadata'),
    participant_name: requiredString(metadata.participant_name, 'participantName metadata'),
    type: requiredString(metadata.type, 'type metadata'),
    title: requiredString(metadata.title, 'title metadata'),
    amount,
    original_amount: Number(metadata.original_amount || amount),
    discount_code: optionalString(metadata.discount_code),
    discount_percent: metadata.discount_percent ? Number(metadata.discount_percent) : null,
    discount_amount: metadata.discount_amount ? Number(metadata.discount_amount) : 0,
    price_label: metadata.price_label || `${amount} Kč`,
    place: requiredString(metadata.place, 'place metadata'),
    org_id: optionalString(metadata.org_id) || VYS_ORG_ID,
    status: 'Zaplaceno',
    paid_at: new Date(session.created * 1000).toLocaleDateString('cs-CZ'),
    event_date: metadata.event_date || null,
    expires_at: metadata.expires_at || null,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null,
  };

  const { data: existingPurchase, error: existingPurchaseError } = await supabase
    .from('parent_purchases')
    .select('status')
    .eq('id', row.id)
    .maybeSingle();

  if (existingPurchaseError) throw existingPurchaseError;

  const { data, error } = await supabase
    .from('parent_purchases')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;
  await syncPaidPurchaseSideEffects(data);
  if (existingPurchase?.status !== 'Zaplaceno') {
    await safelySendPaymentConfirmationEmail(data, metadata.receipt_email || session.customer_details?.email || session.customer_email);
  }
  response.json({ purchase: toClientPurchase(data) });
}));

app.get('/api/admin/finance', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);

  const [purchasesResult, payoutTransfersResult, coachesResult] = await Promise.all([
    supabase.from('parent_purchases').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    supabase.from('admin_coach_payout_transfers').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    supabase.from('coach_profiles').select('id,level,xp,qr_tricks_approved,stripe_account_id').eq('org_id', orgId),
  ]);

  if (purchasesResult.error) throw purchasesResult.error;
  if (payoutTransfersResult.error) throw payoutTransfersResult.error;
  if (coachesResult.error) throw coachesResult.error;

  response.json({
    purchases: (purchasesResult.data || []).filter((purchase) => !isDemoAdminRecord(purchase.id, purchase.parent_profile_id, purchase.participant_id)),
    payoutTransfers: (payoutTransfersResult.data || []).filter((transfer) => !isDemoAdminRecord(transfer.id, transfer.coach_id, transfer.coach_name)),
    coaches: (coachesResult.data || []).filter((coach) => !isDemoAdminRecord(coach.id)),
  });
}));

function isDemoAdminRecord(...values) {
  return values.some((value) => {
    if (typeof value !== 'string') return false;
    const normalized = normalizeAdminSeedText(value);
    return normalized === 'coach demo'
      || normalized === 'parent demo'
      || normalized === 'participant demo'
      || normalized === 'admin demo'
      || normalized === 'demo child 1'
      || normalized === 'demo child 2'
      || normalized.startsWith('demo ')
      || normalized.includes(' demo ')
      || normalized.includes(' test ')
      || normalized.startsWith('test ')
      || normalized.endsWith(' test')
      || normalized === 'test'
      || normalized.includes('filip trener')
      || normalized.includes('eliska novakova')
      || normalized.includes('alex svoboda')
      || normalized.includes('nela horakova');
  });
}

function isSeedInvoice(row) {
  const supplier = normalizeAdminSeedText(row?.dodavatel);
  const description = normalizeAdminSeedText(row?.popis);
  const amount = String(row?.castka || '').replace(/\s+/g, '');
  const invoiceText = `${supplier} ${description}`;

  return (supplier === 'zs nadrazni vyskov' && description.includes('pronajem telocvicny') && amount === '3200')
    || (supplier === 'orel jednota vyskov' && description.includes('pronajem haly') && amount === '8500')
    || (supplier === 'sportovni sklad praha' && description.includes('nakup matraci') && amount === '14200')
    || (supplier === 'zs prostejov' && description.includes('pronajem telocvicny') && amount === '2800')
    || (invoiceText.includes('test') && invoiceText.includes('teamvys'));
}

function normalizeAdminSeedText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Notify a coach by e-mail that their account has been approved. Called by the
// web admin after a successful approval RPC. Admin-only and org-scoped.
app.post('/api/admin/coaches/:coachId/notify-approved', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);

  const coachId = requiredString(request.params.coachId, 'coachId');

  const { data: coach, error: coachError } = await supabase
    .from('coach_profiles')
    .select('org_id')
    .eq('id', coachId)
    .maybeSingle();
  if (coachError) throw coachError;
  if (!coach) throw httpError('Trenér nenalezen.', 404);
  if ((coach.org_id || VYS_ORG_ID) !== orgId) {
    throw httpError('Můžete spravovat pouze trenéry vlastní organizace.', 403);
  }

  // Resolve the coach's e-mail + name (app_profiles, then auth.users fallback).
  const { data: coachProfile } = await supabase
    .from('app_profiles')
    .select('email,name')
    .eq('id', coachId)
    .maybeSingle();

  let to = normalizedEmail(coachProfile?.email);
  let coachName = optionalString(coachProfile?.name);
  if (!to) {
    try {
      const { data: authMeta } = await supabase.rpc('teamvys_get_coach_auth_meta', { p_coach_ids: [coachId] });
      const meta = Array.isArray(authMeta) ? authMeta[0] : null;
      to = normalizedEmail(meta?.email);
      coachName = coachName || optionalString(meta?.full_name);
    } catch (metaError) {
      console.warn(`Coach auth meta lookup failed for ${coachId}: ${metaError.message}`);
    }
  }

  // Resolve org name for the e-mail body.
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .maybeSingle();

  await safelySendCoachApprovalEmail(to, coachName, org?.name);
  response.json({ ok: true, emailed: Boolean(to) });
}));

app.post('/api/admin/coaches/:coachId/stripe-onboarding', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);
  requireStripe();

  const coachId = requiredString(request.params.coachId, 'coachId');
  const returnUrl = requiredString(request.body.returnUrl, 'returnUrl');
  const refreshUrl = requiredString(request.body.refreshUrl, 'refreshUrl');

  const { data: profileData } = await supabase
    .from('coach_profiles')
    .select('org_id,stripe_account_id')
    .eq('id', coachId)
    .maybeSingle();
  if (!profileData) throw httpError('Trenér nebyl nalezen.', 404);

  if ((profileData.org_id || VYS_ORG_ID) !== orgId) {
    throw httpError('Můžete spravovat pouze trenéry vlastní organizace.', 403);
  }

  const coachOrgId = profileData.org_id || VYS_ORG_ID;
  const coachStripe = await requireOrgStripe(coachOrgId);

  let accountId = profileData?.stripe_account_id ?? null;

  // Create Express account if not yet set
  if (!accountId) {
    const account = await coachStripe.accounts.create({ type: 'express', country: 'CZ' });
    accountId = account.id;

    await supabase
      .from('coach_profiles')
      .update({ stripe_account_id: accountId })
      .eq('id', coachId);
  }

  // Generate a fresh onboarding link (valid ~5 min)
  const accountLink = await coachStripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });

  response.json({ accountId, onboardingUrl: accountLink.url });
}));

app.post('/api/admin/trainer-payouts', asyncRoute(async (request, response) => {
  requireServices();
  const actor = await requireAdmin(request);
  requireStripe();

  const coachId = requiredString(request.body.coachId, 'coachId');
  const coachName = requiredString(request.body.coachName, 'coachName');
  const periodKey = requiredString(request.body.periodKey, 'periodKey');
  const periodStart = requiredString(request.body.periodStart, 'periodStart');
  const periodEnd = requiredString(request.body.periodEnd, 'periodEnd');
  const stripeAccountId = requiredString(request.body.stripeAccountId, 'stripeAccountId');
  const requestedAmount = Math.round(Number(request.body.amount || 0));
  const calculatedAmount = await calculateTrainerPayoutAmount(coachId, periodStart, periodEnd);
  const amount = calculatedAmount > 0 ? calculatedAmount : requestedAmount;
  const availableFrom = nextMonthFirstIso(periodEnd);

  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payout amount must be greater than 0.');
  if (todayIsoDate() < availableFrom) throw new Error(`Výplatu za ${periodKey} lze poslat nejdříve ${availableFrom}.`);

  // Resolve the organization of the admin and of the coach so payouts stay
  // org-scoped. VYS coaches are paid from the platform balance; coaches of an
  // external org are paid from THAT org's own connected Stripe balance.
  const { data: actorProfile } = await supabase
    .from('app_profiles')
    .select('org_id')
    .eq('id', actor.id)
    .maybeSingle();
  const actorOrgId = actorProfile?.org_id || VYS_ORG_ID;

  const { data: coachProfile } = await supabase
    .from('coach_profiles')
    .select('org_id')
    .eq('id', coachId)
    .maybeSingle();
  const coachOrgId = coachProfile?.org_id || VYS_ORG_ID;

  if (actorOrgId !== VYS_ORG_ID && coachOrgId !== actorOrgId) {
    throw httpError('Můžete vyplácet pouze trenéry vlastní organizace.', 403);
  }

  const { data: existingTransfer, error: existingTransferError } = await supabase
    .from('admin_coach_payout_transfers')
    .select('id,status')
    .eq('coach_id', coachId)
    .eq('period_key', periodKey)
    .in('status', ['paid', 'pending'])
    .limit(1)
    .maybeSingle();

  if (existingTransferError) throw existingTransferError;
  if (existingTransfer) throw new Error('Tento trenér už má výplatu za daný měsíc odeslanou.');

  // Use the org's own Stripe client for the transfer.
  const payoutStripe = await requireOrgStripe(coachOrgId);

  const transferParams = {
    amount: amount * 100,
    currency: 'czk',
    destination: stripeAccountId,
    description: `Výplata ${coachName} ${periodKey}`,
    metadata: { coach_id: coachId, coach_name: coachName, period_key: periodKey, period_start: periodStart, period_end: periodEnd, calculated_amount: String(calculatedAmount), org_id: coachOrgId },
  };

  const transfer = await payoutStripe.transfers.create(transferParams);

  const row = {
    id: `coach-payout-${coachId}-${periodKey}`,
    coach_id: coachId,
    coach_name: coachName,
    period_key: periodKey,
    period_start: periodStart,
    period_end: periodEnd,
    amount,
    currency: 'czk',
    status: 'paid',
    mode: 'connect_transfer',
    stripe_account_id: stripeAccountId,
    stripe_transfer_id: transfer.id,
    stripe_payout_id: null,
    created_at_text: createdAtText(),
    available_from: availableFrom,
    org_id: coachOrgId,
  };

  const { data, error } = await supabase
    .from('admin_coach_payout_transfers')
    .upsert(row, { onConflict: 'coach_id,period_key' })
    .select()
    .single();

  if (error) throw error;
  response.status(201).json({ transfer: data });
}));

app.post('/api/admin/invoices/upload-url', asyncRoute(async (request, response) => {
  requireServices();
  await requireAdmin(request);

  const filename = optionalString(request.body.filename) || 'invoice.pdf';
  const path = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { data, error } = await supabase.storage.from('invoices').createSignedUploadUrl(path);
  if (error) throw error;
  response.json({ signedUrl: data.signedUrl, path: data.path });
}));

app.post('/api/admin/products/video-upload-url', asyncRoute(async (request, response) => {
  requireServices();
  await requireAdmin(request);

  const filename = optionalString(request.body.filename) || 'video.mp4';
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${Date.now()}_${safeName}`;
  const { data, error } = await supabase.storage.from('product-videos').createSignedUploadUrl(path);
  if (error) throw error;
  response.json({ signedUrl: data.signedUrl, path: data.path });
}));

app.get('/api/admin/invoices', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);

  const { data, error } = await supabase
    .from('invoices')
    .select('id,dodavatel,castka,mena,datum_vystaveni,datum_splatnosti,cislo_faktury,popis,file_url,kategorie,zaplaceno,datum_zaplaceni,odeslal,coach_id,zdroj,created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  response.json({ invoices: (data || []).filter((invoice) => !isSeedInvoice(invoice)) });
}));

app.post('/api/admin/invoices', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);

  const invoice = request.body.invoice || {};
  const amount = Math.round(Number(invoice.amount || 0));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Částka faktury musí být větší než 0.');

  const row = {
    dodavatel: requiredString(invoice.supplier, 'dodavatel'),
    popis: optionalString(invoice.description) || null,
    castka: String(amount),
    mena: 'CZK',
    datum_vystaveni: optionalString(invoice.issuedDate),
    datum_splatnosti: optionalString(invoice.dueDate),
    zaplaceno: Boolean(invoice.paid),
    datum_zaplaceni: invoice.paid ? optionalString(invoice.paidDate) || todayIsoDate() : null,
    kategorie: optionalString(invoice.category),
    file_url: optionalString(invoice.fileUrl),
    zdroj: 'admin',
    org_id: orgId,
  };

  const { data, error } = await supabase
    .from('invoices')
    .insert(row)
    .select('id,dodavatel,castka,mena,datum_vystaveni,datum_splatnosti,cislo_faktury,popis,file_url,kategorie,zaplaceno,datum_zaplaceni,odeslal,coach_id,zdroj,created_at')
    .single();

  if (error) throw error;
  response.status(201).json({ invoice: data });
}));

app.patch('/api/admin/invoices/:id', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);

  const id = requiredString(request.params.id, 'invoice id');
  const paid = Boolean(request.body.paid);
  const { data, error } = await supabase
    .from('invoices')
    .update({ zaplaceno: paid, datum_zaplaceni: paid ? todayIsoDate() : null })
    .eq('id', id)
    .eq('org_id', orgId)
    .select('id,dodavatel,castka,mena,datum_vystaveni,datum_splatnosti,cislo_faktury,popis,file_url,kategorie,zaplaceno,datum_zaplaceni,odeslal,coach_id,zdroj,created_at')
    .single();

  if (error) throw error;
  response.json({ invoice: data });
}));

app.delete('/api/admin/invoices/:id', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);

  const id = requiredString(request.params.id, 'invoice id');
  const { error } = await supabase.from('invoices').delete().eq('id', id).eq('org_id', orgId);
  if (error) throw error;
  response.json({ ok: true });
}));

app.get('/api/admin/products', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);

  const { data, error } = await supabase
    .from('products')
    .select('id,type,title,city,place,venue,price,price_label,original_price,entries_total,primary_meta,secondary_meta,description,important_info,badge,event_date,expires_at,capacity_total,capacity_current,hero_image,gallery,map_query,latitude,longitude,coach_ids,training_focus,is_published,skill_category')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  response.json({ products: data || [] });
}));

app.post('/api/admin/products', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);

  const product = request.body.product;
  if (!product || typeof product.id !== 'string' || product.id.trim().length === 0) {
    throw new Error('Invalid product: id is required.');
  }

  const allowed = ['id', 'type', 'title', 'city', 'place', 'venue', 'price', 'price_label', 'original_price', 'entries_total', 'primary_meta', 'secondary_meta', 'description', 'important_info', 'badge', 'event_date', 'expires_at', 'capacity_total', 'capacity_current', 'hero_image', 'gallery', 'coach_ids', 'training_focus', 'is_published', 'map_query', 'latitude', 'longitude', 'skill_category', 'region'];
  const row = Object.fromEntries(Object.entries(product).filter(([key]) => allowed.includes(key)));

  requiredString(row.type, 'type');
  requiredString(row.title, 'title');
  requiredString(row.city, 'city');
  requiredString(row.place, 'place');
  if (!row.region) row.region = regionForCity(row.city);

  // Org separation: a product always belongs to the admin's organization.
  // If the product already exists, it must belong to the same org (no cross-org edits).
  const { data: existing, error: existingError } = await supabase
    .from('products')
    .select('org_id')
    .eq('id', row.id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing && existing.org_id && existing.org_id !== orgId) {
    throw httpError('Tento produkt patří jiné organizaci.', 403);
  }
  row.org_id = orgId;

  const { data, error } = await supabase
    .from('products')
    .upsert(row, { onConflict: 'id' })
    .select('id')
    .single();

  if (error) throw error;
  response.status(201).json({ id: data.id });
}));

app.delete('/api/admin/products/:id', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);

  const id = request.params.id;
  if (!id) {
    throw new Error('Product id is required.');
  }

  const { error } = await supabase.from('products').delete().eq('id', id).eq('org_id', orgId);
  if (error) throw error;
  response.json({ ok: true });
}));

// ============================================================================
// Krajští koordinátoři: region-scoped stats + coach assignment + product
// proposals (prices approved by admin) + tasks + invoices + % commission.
// ============================================================================

const CITY_REGIONS = {
  blansko: 'Jihomoravský kraj',
  vyskov: 'Jihomoravský kraj',
  brandys: 'Středočeský kraj',
  jesenice: 'Středočeský kraj',
  jesenik: 'Olomoucký kraj',
  prostejov: 'Olomoucký kraj',
  praha: 'Praha',
  kobylisy: 'Praha',
  vrsovice: 'Praha',
  veliny: 'Pardubický kraj',
};

const CZECH_REGIONS = ['Praha', 'Středočeský kraj', 'Jihočeský kraj', 'Plzeňský kraj', 'Karlovarský kraj', 'Ústecký kraj', 'Liberecký kraj', 'Královéhradecký kraj', 'Pardubický kraj', 'Kraj Vysočina', 'Jihomoravský kraj', 'Olomoucký kraj', 'Zlínský kraj', 'Moravskoslezský kraj'];

function normalizeCityKey(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
}

function regionForCity(city) {
  return CITY_REGIONS[normalizeCityKey(city)] || null;
}

async function requireCoordinator(request) {
  const profile = await requireAuthenticatedProfile(request);
  if (profile.role !== 'coordinator') throw httpError('Tahle sekce je pouze pro koordinátora.', 403);
  const { data, error } = await supabase
    .from('coordinator_profiles')
    .select('id,org_id,region,percent')
    .eq('id', profile.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw httpError('Koordinátor zatím nemá přiřazený kraj. Ozvi se adminovi.', 403);
  return { ...profile, orgId: data.org_id || VYS_ORG_ID, region: data.region, percent: data.percent ?? 30 };
}

function parseInvoiceAmount(value) {
  const numeric = Number(String(value ?? '').replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
}

// Kraj finance: tržby ze zaplacených nákupů krajských produktů minus náklady
// (docházka trenérů na krajských místech + zaplacené krajské faktury).
// Provize koordinátora = percent % z kladného čistého zisku.
async function computeRegionFinance(orgId, region, percent, coordinatorId) {
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id,type,title,city,place,venue,price,price_label,entries_total,capacity_total,capacity_current,coach_ids,is_published,region,event_date,hero_image')
    .eq('org_id', orgId)
    .eq('region', region)
    .order('created_at', { ascending: false });
  if (productsError) throw productsError;

  const productIds = (products || []).map((product) => product.id);
  const regionPlaces = new Set((products || []).map((product) => product.place).filter(Boolean));

  let purchases = [];
  if (productIds.length > 0) {
    const { data, error } = await supabase
      .from('parent_purchases')
      .select('id,product_id,participant_id,participant_name,type,title,amount,place,status,paid_at,created_at')
      .eq('org_id', orgId)
      .in('product_id', productIds)
      .order('created_at', { ascending: false });
    if (error) throw error;
    purchases = data || [];
  }

  const revenue = purchases.filter((p) => p.status === 'Placeno').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const { data: attendance, error: attendanceError } = await supabase
    .from('coach_attendance_records')
    .select('id,coach_id,date_text,place,duration_hours,amount,created_at')
    .eq('org_id', orgId);
  if (attendanceError) throw attendanceError;
  const regionAttendance = (attendance || []).filter((record) => regionPlaces.has(record.place));
  const coachCost = regionAttendance.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);

  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('id,dodavatel,castka,mena,popis,kategorie,zaplaceno,datum_zaplaceni,file_url,zdroj,coordinator_id,region,odeslal,created_at')
    .eq('org_id', orgId)
    .eq('region', region)
    .order('created_at', { ascending: false });
  if (invoicesError) throw invoicesError;
  const invoiceCost = (invoices || []).filter((invoice) => invoice.zaplaceno).reduce((sum, invoice) => sum + parseInvoiceAmount(invoice.castka), 0);

  const { data: payouts, error: payoutsError } = await supabase
    .from('coordinator_payouts')
    .select('id,coordinator_id,coordinator_name,amount,note,period_label,created_at')
    .eq('coordinator_id', coordinatorId)
    .order('created_at', { ascending: false });
  if (payoutsError) throw payoutsError;

  const net = revenue - coachCost - invoiceCost;
  const commission = net > 0 ? Math.round((net * percent) / 100) : 0;
  const paidOut = (payouts || []).reduce((sum, payout) => sum + (Number(payout.amount) || 0), 0);
  const owed = Math.max(commission - paidOut, 0);

  return {
    products: products || [],
    purchases,
    attendance: regionAttendance,
    invoices: invoices || [],
    payouts: payouts || [],
    finance: { revenue, coachCost, invoiceCost, net, percent, commission, paidOut, owed },
  };
}

app.get('/api/coordinator/overview', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAuthenticatedProfile(request);
  if (profile.role !== 'coordinator') throw httpError('Tahle sekce je pouze pro koordinátora.', 403);
  const { data: coordinatorProfile, error: coordinatorProfileError } = await supabase
    .from('coordinator_profiles')
    .select('id,org_id,region,percent')
    .eq('id', profile.id)
    .maybeSingle();
  if (coordinatorProfileError) throw coordinatorProfileError;
  if (!coordinatorProfile) {
    response.json({
      pending: true,
      coordinator: { id: profile.id, name: profile.name, email: profile.email, region: null, percent: null },
      products: [], purchases: [], attendance: [], invoices: [], payouts: [],
      finance: { revenue: 0, coachCost: 0, invoiceCost: 0, net: 0, percent: 0, commission: 0, paidOut: 0, owed: 0 },
      coaches: [], tasks: [], requests: [],
    });
    return;
  }
  const coordinator = { ...profile, orgId: coordinatorProfile.org_id || VYS_ORG_ID, region: coordinatorProfile.region, percent: coordinatorProfile.percent ?? 30 };

  const financeData = await computeRegionFinance(coordinator.orgId, coordinator.region, coordinator.percent, coordinator.id);

  const { data: coachProfiles, error: coachError } = await supabase
    .from('coach_profiles')
    .select('id,org_id,approval_status')
    .eq('approval_status', 'approved');
  if (coachError) throw coachError;
  const orgCoachIds = (coachProfiles || []).filter((coach) => (coach.org_id || VYS_ORG_ID) === coordinator.orgId).map((coach) => coach.id);

  let coaches = [];
  if (orgCoachIds.length > 0) {
    const { data, error } = await supabase
      .from('app_profiles')
      .select('id,name,email,phone')
      .in('id', orgCoachIds);
    if (error) throw error;
    coaches = data || [];
  }

  const { data: tasks, error: tasksError } = await supabase
    .from('coordinator_tasks')
    .select('id,title,done,due_date,created_at')
    .eq('coordinator_id', coordinator.id)
    .order('created_at', { ascending: false });
  if (tasksError) throw tasksError;

  const { data: requests, error: requestsError } = await supabase
    .from('coordinator_product_requests')
    .select('id,payload,status,admin_note,created_at,resolved_at')
    .eq('coordinator_id', coordinator.id)
    .order('created_at', { ascending: false });
  if (requestsError) throw requestsError;

  response.json({
    coordinator: { id: coordinator.id, name: coordinator.name, email: coordinator.email, region: coordinator.region, percent: coordinator.percent },
    ...financeData,
    coaches,
    tasks: tasks || [],
    requests: requests || [],
  });
}));

app.post('/api/coordinator/tasks', asyncRoute(async (request, response) => {
  requireServices();
  const coordinator = await requireCoordinator(request);
  const title = requiredString(request.body.title, 'úkol');
  const { data, error } = await supabase
    .from('coordinator_tasks')
    .insert({ coordinator_id: coordinator.id, org_id: coordinator.orgId, title, due_date: optionalString(request.body.dueDate) })
    .select('id,title,done,due_date,created_at')
    .single();
  if (error) throw error;
  response.status(201).json({ task: data });
}));

app.patch('/api/coordinator/tasks/:id', asyncRoute(async (request, response) => {
  requireServices();
  const coordinator = await requireCoordinator(request);
  const id = requiredString(request.params.id, 'task id');
  const patch = {};
  if (typeof request.body.done === 'boolean') patch.done = request.body.done;
  if (typeof request.body.title === 'string' && request.body.title.trim()) patch.title = request.body.title.trim();
  const { data, error } = await supabase
    .from('coordinator_tasks')
    .update(patch)
    .eq('id', id)
    .eq('coordinator_id', coordinator.id)
    .select('id,title,done,due_date,created_at')
    .single();
  if (error) throw error;
  response.json({ task: data });
}));

app.delete('/api/coordinator/tasks/:id', asyncRoute(async (request, response) => {
  requireServices();
  const coordinator = await requireCoordinator(request);
  const id = requiredString(request.params.id, 'task id');
  const { error } = await supabase.from('coordinator_tasks').delete().eq('id', id).eq('coordinator_id', coordinator.id);
  if (error) throw error;
  response.json({ ok: true });
}));

// Koordinátor smí u krajského produktu měnit jen přiřazení trenérů.
app.post('/api/coordinator/products/:id/coaches', asyncRoute(async (request, response) => {
  requireServices();
  const coordinator = await requireCoordinator(request);
  const productId = requiredString(request.params.id, 'product id');
  const coachIds = Array.isArray(request.body.coachIds) ? request.body.coachIds.filter((value) => typeof value === 'string') : null;
  if (!coachIds) throw httpError('coachIds musí být pole.', 400);

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id,org_id,region')
    .eq('id', productId)
    .maybeSingle();
  if (productError) throw productError;
  if (!product || (product.org_id || VYS_ORG_ID) !== coordinator.orgId || product.region !== coordinator.region) {
    throw httpError('Tento produkt nepatří do tvého kraje.', 403);
  }

  const { error } = await supabase.from('products').update({ coach_ids: coachIds }).eq('id', productId);
  if (error) throw error;
  response.json({ ok: true, coachIds });
}));

// Návrh produktu / ceny — schvaluje admin. Ceny kroužků (10/15 vstupů) jsou
// fixní a nastavuje je admin, koordinátor posílá jen návrh nákladů.
app.post('/api/coordinator/product-requests', asyncRoute(async (request, response) => {
  requireServices();
  const coordinator = await requireCoordinator(request);
  const payload = request.body.payload;
  if (!payload || typeof payload !== 'object') throw httpError('Chybí návrh produktu.', 400);
  requiredString(payload.title, 'název');
  requiredString(payload.city, 'město');

  const { data, error } = await supabase
    .from('coordinator_product_requests')
    .insert({
      coordinator_id: coordinator.id,
      coordinator_name: coordinator.name,
      org_id: coordinator.orgId,
      region: coordinator.region,
      payload,
    })
    .select('id,payload,status,admin_note,created_at,resolved_at')
    .single();
  if (error) throw error;
  response.status(201).json({ request: data });
}));

app.post('/api/coordinator/invoices/upload-url', asyncRoute(async (request, response) => {
  requireServices();
  await requireCoordinator(request);
  const filename = optionalString(request.body.filename) || 'invoice.pdf';
  const path = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { data, error } = await supabase.storage.from('invoices').createSignedUploadUrl(path);
  if (error) throw error;
  response.json({ signedUrl: data.signedUrl, path: data.path });
}));

app.post('/api/coordinator/invoices', asyncRoute(async (request, response) => {
  requireServices();
  const coordinator = await requireCoordinator(request);
  const invoice = request.body.invoice || {};
  const amount = Math.round(Number(invoice.amount || 0));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Částka faktury musí být větší než 0.');

  const row = {
    dodavatel: optionalString(invoice.supplier) || coordinator.name || 'Koordinátor',
    castka: String(amount),
    mena: 'CZK',
    datum_vystaveni: optionalString(invoice.issuedAt) || todayIsoDate(),
    datum_splatnosti: optionalString(invoice.dueAt),
    cislo_faktury: optionalString(invoice.number),
    popis: optionalString(invoice.description) || `Faktura koordinátora (${coordinator.region})`,
    kategorie: optionalString(invoice.category) || 'Koordinátor',
    file_url: optionalString(invoice.fileUrl),
    zaplaceno: false,
    odeslal: coordinator.name || coordinator.email,
    zdroj: 'koordinator',
    coordinator_id: coordinator.id,
    region: coordinator.region,
    org_id: coordinator.orgId,
  };

  const { data, error } = await supabase.from('invoices').insert(row).select('id').single();
  if (error) throw error;
  response.status(201).json({ id: data.id });
}));

// --- Admin správa koordinátorů -------------------------------------------

app.get('/api/admin/coordinators', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);

  const { data: coordinatorRows, error: coordinatorError } = await supabase
    .from('coordinator_profiles')
    .select('id,org_id,region,percent,created_at');
  if (coordinatorError) throw coordinatorError;
  const orgCoordinators = (coordinatorRows || []).filter((row) => (row.org_id || VYS_ORG_ID) === orgId);

  let profiles = [];
  if (orgCoordinators.length > 0) {
    const { data, error } = await supabase
      .from('app_profiles')
      .select('id,name,email,phone')
      .in('id', orgCoordinators.map((row) => row.id));
    if (error) throw error;
    profiles = data || [];
  }

  const coordinators = [];
  for (const row of orgCoordinators) {
    const person = profiles.find((p) => p.id === row.id);
    const financeData = await computeRegionFinance(orgId, row.region, row.percent ?? 30, row.id);
    coordinators.push({
      id: row.id,
      name: person?.name || person?.email || row.id,
      email: person?.email || null,
      phone: person?.phone || null,
      region: row.region,
      percent: row.percent ?? 30,
      finance: financeData.finance,
      payouts: financeData.payouts,
      productCount: financeData.products.length,
    });
  }

  const { data: requests, error: requestsError } = await supabase
    .from('coordinator_product_requests')
    .select('id,coordinator_id,coordinator_name,region,payload,status,admin_note,created_at,resolved_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (requestsError) throw requestsError;

  // Registrované koordinátorské účty, kterým admin ještě nepřiřadil kraj.
  const { data: candidateRows, error: candidateError } = await supabase
    .from('app_profiles')
    .select('id,name,email,phone,org_id,created_at')
    .eq('role', 'coordinator');
  if (candidateError) throw candidateError;
  const assignedIds = new Set(orgCoordinators.map((row) => row.id));
  const candidates = (candidateRows || [])
    .filter((row) => !assignedIds.has(row.id) && (!row.org_id || row.org_id === orgId))
    .map((row) => ({ id: row.id, name: row.name || row.email || row.id, email: row.email || null, phone: row.phone || null, created_at: row.created_at }));

  response.json({ coordinators, candidates, requests: requests || [], regions: CZECH_REGIONS });
}));

app.post('/api/admin/coordinators', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);

  const candidateId = optionalString(request.body.id);
  const email = candidateId ? null : requiredString(request.body.email, 'e-mail').toLowerCase();
  const region = requiredString(request.body.region, 'kraj');
  const percent = Math.min(Math.max(Math.round(Number(request.body.percent ?? 30)), 0), 100);
  if (!CZECH_REGIONS.includes(region)) throw httpError('Neznámý kraj.', 400);

  let personQuery = supabase.from('app_profiles').select('id,role,name,email,org_id');
  personQuery = candidateId ? personQuery.eq('id', candidateId) : personQuery.ilike('email', email);
  const { data: person, error: personError } = await personQuery.maybeSingle();
  if (personError) throw personError;
  if (!person) throw httpError('Uživatel s tímto e-mailem v aplikaci neexistuje. Musí se nejdřív zaregistrovat.', 404);
  if (person.role === 'admin') throw httpError('Admin nemůže být zároveň koordinátor.', 400);
  if ((person.org_id || VYS_ORG_ID) !== orgId && person.org_id) throw httpError('Uživatel patří jiné organizaci.', 403);

  const { error: roleError } = await supabase.from('app_profiles').update({ role: 'coordinator', org_id: orgId }).eq('id', person.id);
  if (roleError) throw roleError;

  const { data, error } = await supabase
    .from('coordinator_profiles')
    .upsert({ id: person.id, org_id: orgId, region, percent }, { onConflict: 'id' })
    .select('id,region,percent')
    .single();
  if (error) throw error;

  response.status(201).json({ coordinator: { id: data.id, name: person.name, email: person.email, region: data.region, percent: data.percent } });
}));

app.delete('/api/admin/coordinators/:id', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);
  const id = requiredString(request.params.id, 'coordinator id');

  const { data: row, error: rowError } = await supabase
    .from('coordinator_profiles')
    .select('id,org_id')
    .eq('id', id)
    .maybeSingle();
  if (rowError) throw rowError;
  if (!row || (row.org_id || VYS_ORG_ID) !== orgId) throw httpError('Koordinátor nenalezen.', 404);

  const { error: deleteError } = await supabase.from('coordinator_profiles').delete().eq('id', id);
  if (deleteError) throw deleteError;
  const { error: roleError } = await supabase.from('app_profiles').update({ role: 'parent' }).eq('id', id).eq('role', 'coordinator');
  if (roleError) throw roleError;
  response.json({ ok: true });
}));

app.post('/api/admin/coordinator-requests/:id/resolve', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);
  const id = requiredString(request.params.id, 'request id');
  const action = requiredString(request.body.action, 'action');
  if (!['approve', 'reject'].includes(action)) throw httpError('Neplatná akce.', 400);

  const { data: req, error: reqError } = await supabase
    .from('coordinator_product_requests')
    .select('id,org_id,region,coordinator_id,coordinator_name,payload,status')
    .eq('id', id)
    .maybeSingle();
  if (reqError) throw reqError;
  if (!req || (req.org_id || VYS_ORG_ID) !== orgId) throw httpError('Žádost nenalezena.', 404);
  if (req.status !== 'pending') throw httpError('Žádost už je vyřízená.', 409);

  let createdProductId = null;
  if (action === 'approve') {
    const payload = req.payload || {};
    createdProductId = `koord-${Date.now()}`;
    const productRow = {
      id: createdProductId,
      type: payload.type || 'Krouzek',
      title: String(payload.title || 'Nový produkt'),
      city: String(payload.city || ''),
      place: String(payload.place || payload.city || ''),
      venue: optionalString(payload.venue),
      description: optionalString(payload.description),
      capacity_total: Number(payload.capacityTotal) || 0,
      capacity_current: 0,
      event_date: optionalString(payload.eventDate),
      price: Number(payload.price) || 0,
      price_label: optionalString(payload.priceLabel),
      entries_total: Number(payload.entriesTotal) || null,
      is_published: false,
      region: req.region,
      org_id: orgId,
      coach_ids: [],
    };
    const { error: productError } = await supabase.from('products').insert(productRow);
    if (productError) throw productError;
  }

  const { data, error } = await supabase
    .from('coordinator_product_requests')
    .update({ status: action === 'approve' ? 'approved' : 'rejected', admin_note: optionalString(request.body.adminNote), resolved_at: new Date().toISOString() })
    .eq('id', id)
    .select('id,coordinator_id,coordinator_name,region,payload,status,admin_note,created_at,resolved_at')
    .single();
  if (error) throw error;
  response.json({ request: data, createdProductId });
}));

app.post('/api/admin/coordinators/:id/payouts', asyncRoute(async (request, response) => {
  requireServices();
  const profile = await requireAdmin(request);
  const orgId = await adminOrgId(profile);
  const id = requiredString(request.params.id, 'coordinator id');
  const amount = Math.round(Number(request.body.amount || 0));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Částka výplaty musí být větší než 0.');

  const { data: row, error: rowError } = await supabase
    .from('coordinator_profiles')
    .select('id,org_id')
    .eq('id', id)
    .maybeSingle();
  if (rowError) throw rowError;
  if (!row || (row.org_id || VYS_ORG_ID) !== orgId) throw httpError('Koordinátor nenalezen.', 404);

  const { data: person } = await supabase.from('app_profiles').select('name,email').eq('id', id).maybeSingle();

  const { data, error } = await supabase
    .from('coordinator_payouts')
    .insert({
      coordinator_id: id,
      coordinator_name: person?.name || person?.email || id,
      org_id: orgId,
      amount,
      note: optionalString(request.body.note),
      period_label: optionalString(request.body.periodLabel),
    })
    .select('id,coordinator_id,coordinator_name,amount,note,period_label,created_at')
    .single();
  if (error) throw error;
  response.status(201).json({ payout: data });
}));

// ============================================================================
// Multi-tenant SaaS (Phase 5): organization registration + subscription billing
// ============================================================================
// Pricing: 790 Kč/month per organization, first 30 days free (Stripe trial).
// The VYS org is the platform owner: stripe_customer_id = NULL,
// subscription_status = 'exempt' — exempt from every check in this section.

const ORG_MONTHLY_PRICE_CZK = 790;
const ORG_TRIAL_DAYS = 30;
const ORG_SELF_REGISTRATION_ENABLED = true;

// Subscription packages an organization can pick at registration. Longer plans
// are billed as a single recurring Stripe price (e.g. every 6 months) at a
// discount vs. paying month-by-month. Prices are the TOTAL charged per period.
const ORG_PLANS = {
  monthly: {
    label: 'Měsíční',
    priceCzk: 790,
    recurring: { interval: 'month', interval_count: 1 },
    productName: 'TeamVYS platforma — měsíční předplatné',
    periodNote: '790 Kč měsíčně',
  },
  halfyear: {
    label: 'Půlroční',
    priceCzk: 4620, // 6× 790 = 4740, sleva 120 Kč
    recurring: { interval: 'month', interval_count: 6 },
    productName: 'TeamVYS platforma — půlroční předplatné',
    periodNote: '4 620 Kč / 6 měsíců (sleva 120 Kč)',
  },
  yearly: {
    label: 'Roční',
    priceCzk: 9000, // 12× 790 = 9480, sleva 480 Kč
    recurring: { interval: 'year', interval_count: 1 },
    productName: 'TeamVYS platforma — roční předplatné',
    periodNote: '9 000 Kč / rok (sleva 480 Kč)',
  },
};
const ORG_DEFAULT_PLAN = 'monthly';


// Organization existence verification — the IČO must exist in the Czech
// business registry (ARES). Returns the official registered name.
async function verifyIcoInAres(ico) {
  const normalized = String(ico || '').replace(/\s+/g, '');
  if (!/^\d{8}$/.test(normalized)) throw httpError('IČO musí mít 8 číslic.', 400);

  let aresResponse;
  try {
    aresResponse = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${normalized}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
  } catch (aresError) {
    console.warn(`ARES lookup failed for ${normalized}: ${aresError.message}`);
    // ARES outage must not block registration entirely — mark as unverified.
    return { ico: normalized, aresName: null };
  }

  if (aresResponse.status === 404) throw httpError('Organizace s tímto IČO nebyla nalezena v registru ARES.', 400);
  if (!aresResponse.ok) {
    console.warn(`ARES lookup returned ${aresResponse.status} for ${normalized}`);
    return { ico: normalized, aresName: null };
  }

  const subject = await aresResponse.json();
  return { ico: normalized, aresName: subject?.obchodniJmeno || null };
}

function mapStripeSubscriptionStatus(stripeStatus) {
  switch (stripeStatus) {
    case 'trialing': return 'trialing';
    case 'active': return 'active';
    case 'past_due': return 'past_due';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'canceled';
    default: return null; // 'incomplete', 'paused' → leave current status untouched
  }
}

async function orgByStripeCustomerId(customerId) {
  if (!customerId) return null;
  const { data, error } = await supabase
    .from('organizations')
    .select('id,name,contact_email,subscription_status')
    .eq('stripe_customer_id', customerId)
    .neq('subscription_status', 'exempt')
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function findAuthUserByEmail(email) {
  const target = normalizedEmail(email);
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = (data?.users || []).find((user) => normalizedEmail(user.email) === target);
    if (match) return match;
    if (!data || (data.users || []).length < 200) return null;
    page += 1;
    if (page > 50) return null; // safety bound
  }
}

// Create the org admin auth account with the password chosen at registration.
// Returns the auth user id. If an account with this email already exists, we
// only reset its password when it's our own abandoned-registration orphan
// (flagged org_registration_pending) — never an existing real account, which
// would be an account-takeover vector since e-mail ownership isn't verified.
async function upsertPendingOrgAdminUser(email, password, adminName) {
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'admin', name: adminName, org_registration_pending: 'true' },
  });
  if (!createError) return created?.user?.id || null;

  if (!/already.*registered|already.*exists|email.*exists/i.test(createError.message || '')) {
    throw createError;
  }

  const existing = await findAuthUserByEmail(email);
  const isOurOrphan = existing && existing.user_metadata?.org_registration_pending === 'true';
  if (!existing || !isOurOrphan) {
    throw httpError('Tento e-mail už má účet na TeamVYS. Přihlaste se, nebo použijte jiný e-mail.', 409);
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
    password,
    user_metadata: { ...(existing.user_metadata || {}), role: 'admin', name: adminName, org_registration_pending: 'true' },
  });
  if (updateError) throw updateError;
  return existing.id;
}

async function provisionOrganizationFromCheckout(session) {
  const metadata = session.metadata || {};
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  if (!customerId) throw new Error('Org checkout session is missing a Stripe customer.');

  // Idempotency: webhook retries must not create duplicate orgs.
  const existing = await orgByStripeCustomerId(customerId);
  if (existing) return existing;

  const orgName = requiredString(metadata.org_name, 'org_name');
  const contactEmail = requiredString(metadata.contact_email, 'contact_email').toLowerCase();
  const adminName = requiredString(metadata.admin_name, 'admin_name');
  const adminUserId = optionalString(metadata.admin_user_id);
  const ico = optionalString(metadata.ico);
  const aresName = optionalString(metadata.ares_name);
  const legalVersion = optionalString(metadata.legal_version) || 'unknown';
  const consentAt = new Date().toISOString();

  // Approval gate: new orgs are NOT live after checkout. The super admin must
  // approve them in /admin/organizace; only then does the 30-day trial start.
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: orgName,
      org_type: 'external',
      sport_type: optionalString(metadata.sport_type),
      city: optionalString(metadata.city),
      contact_email: contactEmail,
      ico,
      ares_name: aresName,
      stripe_customer_id: customerId,
      subscription_status: 'pending_approval',
      trial_ends_at: null,
      terms_accepted_at: consentAt,
      terms_version: legalVersion,
      dpa_accepted_at: consentAt,
      dpa_version: legalVersion,
      feature_flags: {
        org_type: 'external',
        participant_wristbands: false,
        participant_trick_xp: false,
        participant_vys_leaderboard: false,
        participant_spots_map: false,
        participant_vys_quest_map: false,
        participant_tutorials: false,
        trainer_workshop_registration: false,
        trainer_qr_codes: false,
        trainer_spots: false,
        trainer_leaderboard_qr_xp: false,
        trainer_camps: true,
        shared_arenas: true,
        shared_mascots: true,
        shared_attendance_quest_map: true,
        shared_leaderboard: true,
      },
    })
    .select('id,name,contact_email')
    .single();
  if (orgError) throw orgError;

  // Audit trail: kept even if the org row is later deleted.
  await supabase.from('legal_consents').insert([
    { subject_type: 'organization', subject_id: org.id, consent_type: 'terms', version: legalVersion, accepted_at: consentAt },
    { subject_type: 'organization', subject_id: org.id, consent_type: 'dpa', version: legalVersion, accepted_at: consentAt },
  ]);

  // Allow the admin email through the existing admin-invite gate, scoped to the new org.
  const { error: inviteError } = await supabase
    .from('admin_account_invites')
    .upsert({ email: contactEmail, active: true, note: `Org registration: ${orgName}`, org_id: org.id }, { onConflict: 'email' });
  if (inviteError) throw inviteError;

  // Promote the auth account (created at registration with the chosen password)
  // to admin of the new org. app_profiles is the source of truth for server-side
  // admin checks; updating org_id also fires the membership-sync trigger.
  let provisionedUserId = adminUserId || null;
  if (adminUserId) {
    try {
      await supabase.auth.admin.updateUserById(adminUserId, {
        user_metadata: { role: 'admin', name: adminName, org_id: org.id },
      });
    } catch (metaError) {
      console.warn(`Org provisioning: auth metadata update failed for ${adminUserId}: ${metaError.message}`);
    }
    const { error: profileError } = await supabase
      .from('app_profiles')
      .update({ role: 'admin', org_id: org.id, name: adminName, email: contactEmail })
      .eq('id', adminUserId);
    if (profileError) console.warn(`Org provisioning: app_profiles promote failed for ${adminUserId}: ${profileError.message}`);

    // The signup trigger created a default VYS membership before the org existed
    // (org_id defaulted to VYS). Updating app_profiles.org_id above adds the new
    // org membership via the sync trigger, but the stale VYS membership lingers
    // and would leak VYS data through org-scoped RLS. Remove every membership
    // except the new org so the admin sees ONLY their organization.
    const { error: membershipError } = await supabase
      .from('organization_members')
      .delete()
      .eq('profile_id', adminUserId)
      .neq('org_id', org.id);
    if (membershipError) console.warn(`Org provisioning: stale membership cleanup failed for ${adminUserId}: ${membershipError.message}`);
  } else {
    // Fallback for legacy sessions without a pre-created account: create the
    // user now; the org-aware signup trigger stamps role/org_id.
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: contactEmail,
      email_confirm: true,
      user_metadata: { role: 'admin', name: adminName, org_id: org.id },
    });
    if (createError && !/already.*registered|already.*exists/i.test(createError.message || '')) throw createError;
    provisionedUserId = created?.user?.id || null;
  }

  // No password e-mail to the org admin here — the password already exists and
  // the approval e-mail is sent only after the super admin approves the org.
  // The super admin gets a heads-up that a new org is waiting for review.
  await safelySendOrgPendingApprovalEmail(org, adminName);
  console.info(`Provisioned organization ${org.id} (${orgName}) for Stripe customer ${customerId} — pending super admin approval.`);
  return { ...org, adminUserId: provisionedUserId };
}

async function handleOrgInvoicePaid(invoice) {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  const org = await orgByStripeCustomerId(customerId);
  if (!org) return; // not an org-subscription invoice
  if (org.subscription_status === 'pending_approval') return; // approval gate: Stripe events must not activate a pending org

  const periodEnd = invoice.lines?.data?.[0]?.period?.end;
  const { error } = await supabase
    .from('organizations')
    .update({
      subscription_status: 'active',
      subscription_ends_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    })
    .eq('id', org.id)
    .neq('subscription_status', 'exempt');
  if (error) throw error;
}

async function syncOrgSubscriptionStatus(subscription, isDeleted) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  const org = await orgByStripeCustomerId(customerId);
  if (!org) return;

  const mapped = isDeleted ? 'canceled' : mapStripeSubscriptionStatus(subscription.status);
  if (!mapped) return;
  // Approval gate: Stripe 'trialing'/'active' must not un-pend an org that the
  // super admin has not approved yet. Cancellations still pass through.
  if (org.subscription_status === 'pending_approval' && mapped !== 'canceled') return;

  const update = { subscription_status: mapped };
  if (subscription.trial_end) update.trial_ends_at = new Date(subscription.trial_end * 1000).toISOString();
  if (subscription.current_period_end) update.subscription_ends_at = new Date(subscription.current_period_end * 1000).toISOString();

  const { error } = await supabase
    .from('organizations')
    .update(update)
    .eq('id', org.id)
    .neq('subscription_status', 'exempt');
  if (error) throw error;
}

async function sendOrgOnboardingEmail(org, adminName, trialEndsAt) {
  const emailer = paymentEmailer();
  if (!emailer || !org.contact_email) {
    console.info(`Org onboarding email skipped for ${org.id}: SMTP not configured or missing contact email.`);
    return;
  }

  const trialEndDate = new Date(trialEndsAt).toLocaleDateString('cs-CZ');
  const lines = [
    `Dobrý den, ${adminName},`,
    '',
    `vaše organizace ${org.name} byla schválena a je aktivní. Vítejte na platformě TeamVYS!`,
    '',
    `Zkušební období zdarma běží do ${trialEndDate}. Poté se účtuje ${ORG_MONTHLY_PRICE_CZK} Kč měsíčně.`,
    '',
    `Přihlaste se do administrace na ${WEB_APP_URL}/admin/prihlaseni`,
    'e-mailem a heslem, které jste si zvolili při registraci.',
    '',
    'První kroky: nahrajte logo, pozvěte prvního trenéra a založte první kroužek.',
    '',
    'Děkujeme, TeamVYS',
  ];

  await emailer.sendMail({
    from: smtpFrom,
    to: org.contact_email,
    subject: `Organizace ${org.name} byla schválena — TeamVYS`,
    text: lines.join('\n'),
  });
}

async function sendOrgTrialEndingEmail(subscription) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  const org = await orgByStripeCustomerId(customerId);
  if (!org) return;

  const emailer = paymentEmailer();
  if (!emailer || !org.contact_email) return;

  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000).toLocaleDateString('cs-CZ') : 'brzy';
  await emailer.sendMail({
    from: smtpFrom,
    to: org.contact_email,
    subject: `TeamVYS — zkušební období organizace ${org.name} brzy končí`,
    text: `Dobrý den,\n\nzkušební období organizace ${org.name} končí ${trialEnd}. Poté bude automaticky účtováno ${ORG_MONTHLY_PRICE_CZK} Kč měsíčně.\n\nDěkujeme, TeamVYS`,
  });
}

// --- Super admin approval gate (Phase 8) -----------------------------------

const WEB_APP_URL = process.env.WEB_APP_URL || 'https://teamvys.cz';

async function superAdminEmails() {
  const { data, error } = await supabase
    .from('app_profiles')
    .select('email')
    .eq('super_admin', true);
  if (error) throw error;

  const emails = (data || []).map((row) => normalizedEmail(row.email)).filter(Boolean);
  const fallback = normalizedEmail(process.env.SUPER_ADMIN_EMAIL);
  if (fallback && !emails.includes(fallback)) emails.push(fallback);
  return emails;
}

async function safelySendOrgPendingApprovalEmail(org, adminName) {
  try {
    const emailer = paymentEmailer();
    if (!emailer) {
      console.info(`Pending-approval email skipped for ${org.id}: SMTP is not configured.`);
      return;
    }

    const recipients = await superAdminEmails();
    if (recipients.length === 0) {
      console.warn(`Pending-approval email skipped for ${org.id}: no super admin email found.`);
      return;
    }

    await emailer.sendMail({
      from: smtpFrom,
      to: recipients.join(', '),
      subject: `Nová organizace čeká na schválení: ${org.name}`,
      text: [
        'Dobrý den,',
        '',
        `nová organizace dokončila registraci a čeká na schválení.`,
        '',
        `Organizace: ${org.name}`,
        `Správce: ${adminName}`,
        `Kontaktní e-mail: ${org.contact_email}`,
        '',
        `Schvalte nebo zamítněte ji v dashboardu: ${WEB_APP_URL}/admin/organizace`,
        '',
        'TeamVYS platforma',
      ].join('\n'),
    });
  } catch (error) {
    console.error(`Pending-approval email failed for ${org?.id || 'unknown org'}:`, error);
  }
}

async function sendOrgRejectionEmail(org) {
  const emailer = paymentEmailer();
  if (!emailer || !org.contact_email) {
    console.info(`Org rejection email skipped for ${org.id}: SMTP not configured or missing contact email.`);
    return;
  }

  await emailer.sendMail({
    from: smtpFrom,
    to: org.contact_email,
    subject: `TeamVYS — registrace organizace ${org.name} nebyla schválena`,
    text: [
      'Dobrý den,',
      '',
      `registrace organizace ${org.name} na platformě TeamVYS bohužel nebyla schválena.`,
      '',
      'Případné platby spojené s registrací nebudou účtovány — předplatné bylo zrušeno.',
      'Pokud si myslíte, že jde o omyl, odpovězte prosím na tento e-mail.',
      '',
      'Děkujeme, TeamVYS',
    ].join('\n'),
  });
}

// Align the Stripe trial clock with the approval date so the customer always
// gets the promised 30 free days, even if approval takes a few days.
async function alignStripeTrialEnd(org, trialEndsAt) {
  if (!stripe || !org.stripe_customer_id) return;
  try {
    const subscriptions = await stripe.subscriptions.list({ customer: org.stripe_customer_id, status: 'trialing', limit: 1 });
    const subscription = subscriptions.data[0];
    if (!subscription) return;
    await stripe.subscriptions.update(subscription.id, {
      trial_end: Math.floor(new Date(trialEndsAt).getTime() / 1000),
      proration_behavior: 'none',
    });
  } catch (error) {
    console.warn(`Stripe trial alignment failed for org ${org.id}: ${error.message}`);
  }
}

async function cancelStripeSubscriptionsForOrg(org) {
  if (!stripe || !org.stripe_customer_id) return;
  try {
    const subscriptions = await stripe.subscriptions.list({ customer: org.stripe_customer_id, limit: 10 });
    for (const subscription of subscriptions.data) {
      if (['canceled', 'incomplete_expired'].includes(subscription.status)) continue;
      await stripe.subscriptions.cancel(subscription.id);
    }
  } catch (error) {
    console.warn(`Stripe subscription cancellation failed for org ${org.id}: ${error.message}`);
  }
}

async function requireSuperAdminUser(request) {
  requireServices();
  const token = bearerTokenFromRequest(request);
  if (!token) throw httpError('Přihlášení je vyžadováno.', 401);

  const { data: userResult, error } = await supabase.auth.getUser(token);
  const userId = userResult?.user?.id;
  if (error || !userId) throw httpError('Přihlášení vypršelo nebo není platné.', 401);

  const { data: profile, error: profileError } = await supabase
    .from('app_profiles')
    .select('id,super_admin')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (profile?.super_admin !== true) throw httpError('Tahle operace je pouze pro super admina.', 403);
  return userId;
}

async function pendingOrganizationById(orgId) {
  const { data: org, error } = await supabase
    .from('organizations')
    .select('id,name,contact_email,subscription_status,stripe_customer_id')
    .eq('id', orgId)
    .maybeSingle();
  if (error) throw error;
  if (!org) throw httpError('Organizace nebyla nalezena.', 404);
  if (org.subscription_status === 'exempt') throw httpError('VYS organizaci nelze měnit.', 400);
  if (org.subscription_status !== 'pending_approval') throw httpError('Organizace nečeká na schválení.', 409);
  return org;
}

// Basic in-memory rate limit for the public registration endpoint: max 5
// requests per IP per hour (per server instance) — prevents abuse and
// unnecessary Stripe Checkout session creation.
const ORG_REGISTER_RATE_LIMIT = 5;
const ORG_REGISTER_RATE_WINDOW_MS = 60 * 60 * 1000;
const orgRegisterHitsByIp = new Map(); // ip -> number[] (timestamps)

function assertOrgRegisterRateLimit(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '');
  const ip = (forwarded.split(',')[0] || request.ip || 'unknown').trim() || 'unknown';
  const now = Date.now();

  const hits = (orgRegisterHitsByIp.get(ip) || []).filter((timestamp) => now - timestamp < ORG_REGISTER_RATE_WINDOW_MS);
  if (hits.length >= ORG_REGISTER_RATE_LIMIT) {
    throw httpError('Příliš mnoho pokusů o registraci z této adresy. Zkuste to znovu za hodinu.', 429);
  }

  hits.push(now);
  orgRegisterHitsByIp.set(ip, hits);

  // Opportunistic cleanup so the map can't grow without bound.
  if (orgRegisterHitsByIp.size > 1000) {
    for (const [key, timestamps] of orgRegisterHitsByIp) {
      if (!timestamps.some((timestamp) => now - timestamp < ORG_REGISTER_RATE_WINDOW_MS)) orgRegisterHitsByIp.delete(key);
    }
  }
}

// Public endpoint: organization self-registration → Stripe Checkout (web only).
app.post('/api/orgs/register', asyncRoute(async (request, response) => {
  requireServices();
  requireStripe();
  if (!ORG_SELF_REGISTRATION_ENABLED) throw httpError('Registrace nové organizace je momentálně vypnutá.', 403);
  assertOrgRegisterRateLimit(request);

  const orgName = requiredString(request.body.orgName, 'orgName');
  const contactEmail = requiredString(request.body.contactEmail, 'contactEmail').toLowerCase();
  const adminFirstName = requiredString(request.body.adminFirstName, 'adminFirstName');
  const adminLastName = requiredString(request.body.adminLastName, 'adminLastName');
  const password = requiredString(request.body.password, 'password');
  const sportType = optionalString(request.body.sportType);
  const city = optionalString(request.body.city);
  const successUrl = requiredString(request.body.successUrl, 'successUrl');
  const cancelUrl = requiredString(request.body.cancelUrl, 'cancelUrl');
  const legalVersion = requiredString(request.body.legalVersion, 'legalVersion');
  if (request.body.acceptedTerms !== true) throw httpError('Musíte souhlasit s obchodními podmínkami a zpracováním osobních údajů.', 400);
  if (request.body.acceptedDpa !== true) throw httpError('Musíte souhlasit se zpracovatelskou smlouvou.', 400);

  const planKey = optionalString(request.body.plan) || ORG_DEFAULT_PLAN;
  const plan = ORG_PLANS[planKey];
  if (!plan) throw httpError('Neplatný balíček předplatného.', 400);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) throw httpError('Neplatný kontaktní e-mail.', 400);
  if (password.length < 8) throw httpError('Heslo musí mít alespoň 8 znaků.', 400);

  // Existence verification: the IČO must be a real subject in ARES.
  const { ico, aresName } = await verifyIcoInAres(requiredString(request.body.ico, 'ico'));

  // Refuse duplicate registration for an email that already owns an org.
  const { data: duplicate, error: duplicateError } = await supabase
    .from('organizations')
    .select('id')
    .eq('contact_email', contactEmail)
    .neq('subscription_status', 'canceled')
    .maybeSingle();
  if (duplicateError) throw duplicateError;
  if (duplicate) throw httpError('Organizace s tímto e-mailem už existuje.', 409);

  // Refuse duplicate registration for an IČO that already owns an org.
  const { data: icoDuplicate, error: icoDuplicateError } = await supabase
    .from('organizations')
    .select('id')
    .eq('ico', ico)
    .neq('subscription_status', 'canceled')
    .maybeSingle();
  if (icoDuplicateError) throw icoDuplicateError;
  if (icoDuplicate) throw httpError('Organizace s tímto IČO už existuje.', 409);

  const adminName = `${adminFirstName} ${adminLastName}`;

  // Create the org admin auth account with the password chosen right here at
  // registration. The account exists immediately but can't reach the admin
  // until the super admin approves the org (org stays pending_approval).
  // No password-setup e-mail is sent — the admin already has their password.
  const adminUserId = await upsertPendingOrgAdminUser(contactEmail, password, adminName);

  const orgMetadata = {
    org_registration: 'true',
    org_name: orgName,
    sport_type: sportType || '',
    city: city || '',
    contact_email: contactEmail,
    admin_name: adminName,
    admin_user_id: adminUserId || '',
    ico,
    ares_name: aresName || '',
    plan: planKey,
    legal_version: legalVersion,
  };

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    locale: 'cs',
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: contactEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'czk',
          unit_amount: plan.priceCzk * 100,
          recurring: plan.recurring,
          product_data: {
            name: plan.productName,
            description: `Organizace ${orgName} · první měsíc zdarma · ${plan.periodNote}`,
          },
        },
      },
    ],
    subscription_data: {
      trial_period_days: ORG_TRIAL_DAYS,
      metadata: orgMetadata,
    },
    metadata: orgMetadata,
  });

  response.json({ id: session.id, url: session.url });
}));

// Public endpoint: finalize an org registration straight from the success
// page. The session is re-fetched from Stripe server-side, so the client
// cannot forge anything — this makes registration work even when the Stripe
// webhook is missing or delayed. Idempotent via orgByStripeCustomerId.
app.post('/api/orgs/finalize', asyncRoute(async (request, response) => {
  requireServices();
  requireStripe();
  if (!ORG_SELF_REGISTRATION_ENABLED) throw httpError('Registrace nové organizace je momentálně vypnutá.', 403);

  const sessionId = requiredString(request.body.sessionId, 'sessionId');
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) throw httpError('Neplatné ID platební session.', 400);

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.mode !== 'subscription' || session.metadata?.org_registration !== 'true') {
    throw httpError('Session nepatří k registraci organizace.', 400);
  }
  if (session.status !== 'complete') throw httpError('Platba ještě není dokončená.', 409);

  const org = await provisionOrganizationFromCheckout(session);
  response.json({ ok: true, orgId: org.id, orgName: org.name, contactEmail: org.contact_email });
}));

// --- Stripe Connect for organizations ---------------------------------------
// Each external org onboards its own Stripe Express account; parent payments
// for the org's products are routed there via destination charges.
async function requireOrgAdminWithOrg(request) {
  const profile = await requireAdmin(request);

  const { data: profileRow, error } = await supabase
    .from('app_profiles')
    .select('org_id')
    .eq('id', profile.id)
    .maybeSingle();
  if (error) throw error;

  const orgId = profileRow?.org_id || VYS_ORG_ID;
  if (orgId === VYS_ORG_ID) throw httpError('Platformní organizace TeamVYS přijímá platby přímo — Stripe Connect není potřeba.', 400);

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id,name,contact_email,subscription_status,stripe_connect_account_id,stripe_connect_charges_enabled')
    .eq('id', orgId)
    .maybeSingle();
  if (orgError) throw orgError;
  if (!org) throw httpError('Organizace nebyla nalezena.', 404);
  return { profile, org };
}

// Like requireOrgAdminWithOrg but does NOT reject the VYS platform org. Used for
// settings that every org (incl. VYS) can manage, e.g. default coach hourly rate.
async function requireAnyAdminOrg(request) {
  const profile = await requireAdmin(request);

  const { data: profileRow, error } = await supabase
    .from('app_profiles')
    .select('org_id')
    .eq('id', profile.id)
    .maybeSingle();
  if (error) throw error;

  const orgId = profileRow?.org_id || VYS_ORG_ID;

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id,name')
    .eq('id', orgId)
    .maybeSingle();
  if (orgError) throw orgError;
  if (!org) throw httpError('Organizace nebyla nalezena.', 404);
  return { profile, org };
}

// Org admin: create / resume Stripe Express onboarding for the organization.
app.post('/api/orgs/connect/onboarding', asyncRoute(async (request, response) => {
  requireServices();
  requireStripe();
  const { org } = await requireOrgAdminWithOrg(request);

  const returnUrl = requiredString(request.body.returnUrl, 'returnUrl');
  const refreshUrl = requiredString(request.body.refreshUrl, 'refreshUrl');

  let accountId = org.stripe_connect_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'CZ',
      email: org.contact_email || undefined,
      business_profile: { name: org.name },
      metadata: { org_id: org.id, org_name: org.name },
    });
    accountId = account.id;

    const { error: updateError } = await supabase
      .from('organizations')
      .update({ stripe_connect_account_id: accountId })
      .eq('id', org.id);
    if (updateError) throw updateError;
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });

  response.json({ accountId, onboardingUrl: accountLink.url });
}));

// Org admin: current Connect status (also syncs charges_enabled from Stripe).
app.get('/api/orgs/connect/status', asyncRoute(async (request, response) => {
  requireServices();
  requireStripe();
  const { org } = await requireOrgAdminWithOrg(request);

  if (!org.stripe_connect_account_id) {
    response.json({ connected: false, chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false });
    return;
  }

  const account = await stripe.accounts.retrieve(org.stripe_connect_account_id);
  const chargesEnabled = account.charges_enabled === true;

  if (chargesEnabled !== org.stripe_connect_charges_enabled) {
    await supabase
      .from('organizations')
      .update({ stripe_connect_charges_enabled: chargesEnabled })
      .eq('id', org.id);
  }

  response.json({
    connected: true,
    accountId: org.stripe_connect_account_id,
    chargesEnabled,
    payoutsEnabled: account.payouts_enabled === true,
    detailsSubmitted: account.details_submitted === true,
  });
}));

// GET /api/orgs/stripe/status — returns per-org Stripe configuration status.
// Returns whether keys are configured + publishable key (safe to share).
// Used by admin panel to show "Stripe je nastavený" vs setup form.
app.get('/api/orgs/stripe/status', asyncRoute(async (request, response) => {
  requireServices();
  const { org } = await requireOrgAdminWithOrg(request);

  // VYS is always configured via env vars.
  if (org.id === VYS_ORG_ID) {
    response.json({ configured: true, publishableKey: null, webhookConfigured: false, isVys: true });
    return;
  }

  const { data: orgData, error } = await supabase
    .from('organizations')
    .select('stripe_secret_key,stripe_publishable_key,stripe_webhook_secret')
    .eq('id', org.id)
    .maybeSingle();
  if (error) throw error;

  const secretConfigured = Boolean(orgData?.stripe_secret_key);

  // Verify the key is valid by making a lightweight Stripe API call.
  let keyValid = false;
  if (secretConfigured) {
    try {
      const testClient = new Stripe(orgData.stripe_secret_key);
      await testClient.balance.retrieve();
      keyValid = true;
    } catch {
      keyValid = false;
    }
  }

  response.json({
    configured: secretConfigured && keyValid,
    publishableKey: orgData?.stripe_publishable_key || null,
    webhookConfigured: Boolean(orgData?.stripe_webhook_secret),
    webhookUrl: `https://server-psi-ochre-40.vercel.app/api/stripe/webhook?org_id=${org.id}`,
    isVys: false,
    keyValid,
  });
}));

// POST /api/orgs/stripe/save-keys — saves org's own Stripe API keys.
// Admin-only. Validates the secret key against Stripe before saving.
app.post('/api/orgs/stripe/save-keys', asyncRoute(async (request, response) => {
  requireServices();
  const { org } = await requireOrgAdminWithOrg(request);

  if (org.id === VYS_ORG_ID) {
    throw httpError('VYS organizace používá globální Stripe klíče z prostředí.', 400);
  }

  const secretKey = requiredString(request.body.secretKey, 'secretKey');
  const publishableKey = requiredString(request.body.publishableKey, 'publishableKey');
  const webhookSecret = optionalString(request.body.webhookSecret);

  if (!secretKey.startsWith('sk_')) throw httpError('Zadej platný Stripe secret key (začíná sk_).', 400);
  if (!publishableKey.startsWith('pk_')) throw httpError('Zadej platný Stripe publishable key (začíná pk_).', 400);

  // Validate secret key against Stripe.
  try {
    const testClient = new Stripe(secretKey);
    await testClient.balance.retrieve();
  } catch (stripeError) {
    throw httpError(`Stripe secret key není platný: ${stripeError.message}`, 400);
  }

  // Invalidate cache for this org.
  orgStripeCache.delete(org.id);

  await supabase
    .from('organizations')
    .update({
      stripe_secret_key: secretKey,
      stripe_publishable_key: publishableKey,
      ...(webhookSecret ? { stripe_webhook_secret: webhookSecret } : {}),
    })
    .eq('id', org.id);

  response.json({ ok: true, webhookUrl: `https://server-psi-ochre-40.vercel.app/api/stripe/webhook?org_id=${org.id}` });
}));

// DELETE /api/orgs/stripe/keys — removes org's Stripe keys (disconnect).
app.delete('/api/orgs/stripe/keys', asyncRoute(async (request, response) => {
  requireServices();
  const { org } = await requireOrgAdminWithOrg(request);

  if (org.id === VYS_ORG_ID) throw httpError('VYS nelze odpojit.', 400);

  orgStripeCache.delete(org.id);

  await supabase
    .from('organizations')
    .update({ stripe_secret_key: null, stripe_publishable_key: null, stripe_webhook_secret: null })
    .eq('id', org.id);

  response.json({ ok: true });
}));

// GET /api/orgs/coach-rate — returns the org's default coach hourly rate.
app.get('/api/orgs/coach-rate', asyncRoute(async (request, response) => {
  requireServices();
  const { org } = await requireAnyAdminOrg(request);

  const { data, error } = await supabase
    .from('organizations')
    .select('default_coach_hourly_rate')
    .eq('id', org.id)
    .maybeSingle();
  if (error) throw error;

  response.json({ defaultCoachHourlyRate: data?.default_coach_hourly_rate ?? 500 });
}));

// POST /api/orgs/coach-rate — sets the org's default coach hourly rate.
// Admin-only. This is the org-wide fallback; per-coach overrides live in
// coach_payouts.hourly_rate.
app.post('/api/orgs/coach-rate', asyncRoute(async (request, response) => {
  requireServices();
  const { org } = await requireAnyAdminOrg(request);

  const rate = Number(request.body.defaultCoachHourlyRate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100000) {
    throw httpError('Zadej platnou hodinovou sazbu (0–100000 Kč/h).', 400);
  }

  const { error } = await supabase
    .from('organizations')
    .update({ default_coach_hourly_rate: Math.round(rate) })
    .eq('id', org.id);
  if (error) throw error;

  response.json({ ok: true, defaultCoachHourlyRate: Math.round(rate) });
}));

// GET /api/orgs/dpp-template — returns the org's custom DPP template (role, scope, clauses).
app.get('/api/orgs/dpp-template', asyncRoute(async (request, response) => {
  requireServices();
  const { org } = await requireAnyAdminOrg(request);

  const { data, error } = await supabase
    .from('organizations')
    .select('dpp_role, dpp_scope, dpp_clauses')
    .eq('id', org.id)
    .maybeSingle();
  if (error) throw error;

  response.json({
    dppRole: data?.dpp_role ?? null,
    dppScope: data?.dpp_scope ?? null,
    dppClauses: Array.isArray(data?.dpp_clauses) ? data.dpp_clauses : null,
  });
}));

// POST /api/orgs/dpp-template — saves the org's custom DPP template.
app.post('/api/orgs/dpp-template', asyncRoute(async (request, response) => {
  requireServices();
  const { org } = await requireAnyAdminOrg(request);

  const { dppRole, dppScope, dppClauses } = request.body ?? {};
  if (dppClauses !== undefined && dppClauses !== null && !Array.isArray(dppClauses)) {
    throw httpError('dppClauses musí být pole nebo null.', 400);
  }
  if (Array.isArray(dppClauses) && dppClauses.length > 20) {
    throw httpError('Maximálně 20 klauzulí.', 400);
  }
  if (Array.isArray(dppClauses)) {
    for (const clause of dppClauses) {
      if (typeof clause !== 'string' || clause.length > 500) {
        throw httpError('Každá klauzule musí být text maximálně 500 znaků.', 400);
      }
    }
  }

  const update = {};
  if (dppRole !== undefined) update.dpp_role = typeof dppRole === 'string' && dppRole.trim() ? dppRole.trim() : null;
  if (dppScope !== undefined) update.dpp_scope = typeof dppScope === 'string' && dppScope.trim() ? dppScope.trim() : null;
  if (dppClauses !== undefined) update.dpp_clauses = Array.isArray(dppClauses) && dppClauses.length > 0 ? dppClauses.map((c) => String(c).trim()) : null;

  const { error } = await supabase
    .from('organizations')
    .update(update)
    .eq('id', org.id);
  if (error) throw error;

  response.json({ ok: true, dppRole: update.dpp_role ?? null, dppScope: update.dpp_scope ?? null, dppClauses: update.dpp_clauses ?? null });
}));

// --- Phone-based auth for kids without an e-mail address --------------------
// A child registers with a phone number; the account is created server-side
// with a deterministic alias e-mail (tel-<digits>@ucty.teamvys.cz) and
// e-mail confirmation is skipped (there is no real inbox). Login resolves
// the phone back to the account and verifies the password through Supabase,
// so no credentials or e-mail addresses ever leak to the client.
const PHONE_AUTH_RATE_LIMIT = 10;
const PHONE_AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;
const phoneAuthHitsByIp = new Map(); // ip -> number[] (timestamps)

function assertPhoneAuthRateLimit(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '');
  const ip = (forwarded.split(',')[0] || request.ip || 'unknown').trim() || 'unknown';
  const now = Date.now();

  const hits = (phoneAuthHitsByIp.get(ip) || []).filter((timestamp) => now - timestamp < PHONE_AUTH_RATE_WINDOW_MS);
  if (hits.length >= PHONE_AUTH_RATE_LIMIT) {
    throw httpError('Příliš mnoho pokusů. Zkus to znovu za 15 minut.', 429);
  }

  hits.push(now);
  phoneAuthHitsByIp.set(ip, hits);

  if (phoneAuthHitsByIp.size > 1000) {
    for (const [key, timestamps] of phoneAuthHitsByIp) {
      if (!timestamps.some((timestamp) => now - timestamp < PHONE_AUTH_RATE_WINDOW_MS)) phoneAuthHitsByIp.delete(key);
    }
  }
}

function normalizedPhoneDigits(phoneRaw) {
  const digits = String(phoneRaw).replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) throw httpError('Neplatné telefonní číslo.', 400);
  return digits;
}

function phoneAliasEmail(digits) {
  return `tel-${digits}@ucty.teamvys.cz`;
}

// Public endpoint: register a participant account with a phone number only.
app.post('/api/auth/phone-register', asyncRoute(async (request, response) => {
  requireServices();
  assertPhoneAuthRateLimit(request);

  const phoneRaw = requiredString(request.body.phone, 'phone');
  const password = requiredString(request.body.password, 'password');
  const fullName = optionalString(request.body.fullName) || 'Účastník TeamVYS';
  const orgId = optionalString(request.body.orgId);
  const legalVersion = requiredString(request.body.legalVersion, 'legalVersion');
  if (request.body.acceptedTerms !== true) throw httpError('Musíte souhlasit se zpracováním osobních údajů a obchodními podmínkami.', 400);
  if (password.length < 6) throw httpError('Heslo musí mít alespoň 6 znaků.', 400);

  const digits = normalizedPhoneDigits(phoneRaw);
  const aliasEmail = phoneAliasEmail(digits);

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: aliasEmail,
    email_confirm: true,
    password,
    user_metadata: {
      role: 'participant',
      name: fullName,
      phone: phoneRaw.trim(),
      phone_login: true,
      termsVersion: legalVersion,
      ...(orgId ? { org_id: orgId } : {}),
    },
  });
  if (createError) {
    if (/already|exist|registered/i.test(createError.message || '')) {
      throw httpError('Účet s tímto telefonním číslem už existuje. Přihlas se.', 409);
    }
    throw createError;
  }

  response.json({ ok: true, email: aliasEmail, userId: created.user.id });
}));

// Public endpoint: sign in with a phone number + password. Returns Supabase
// session tokens; the password is verified by Supabase itself, the server
// only resolves which account the phone belongs to.
app.post('/api/auth/phone-login', asyncRoute(async (request, response) => {
  requireServices();
  assertPhoneAuthRateLimit(request);

  const phoneRaw = requiredString(request.body.phone, 'phone');
  const password = requiredString(request.body.password, 'password');
  const digits = normalizedPhoneDigits(phoneRaw);
  const lastNine = digits.slice(-9);

  const candidateEmails = [phoneAliasEmail(digits)];

  // Fallback: participant registered with a real e-mail but a phone stored
  // on the profile — match on the last 9 digits (Czech national number).
  const { data: profiles, error: profilesError } = await supabase
    .from('app_profiles')
    .select('email, phone')
    .eq('role', 'participant')
    .not('phone', 'is', null)
    .not('email', 'is', null)
    .limit(5000);
  if (profilesError) throw profilesError;

  for (const profile of profiles || []) {
    const profileDigits = String(profile.phone).replace(/\D/g, '');
    if (profileDigits.length >= 9 && profileDigits.slice(-9) === lastNine && !candidateEmails.includes(profile.email)) {
      candidateEmails.push(profile.email);
    }
  }

  // Throwaway client so the password grant never touches the service-role client.
  const authClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const email of candidateEmails.slice(0, 5)) {
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });
    if (!error && data?.session) {
      response.json({ ok: true, access_token: data.session.access_token, refresh_token: data.session.refresh_token });
      return;
    }
  }

  throw httpError('Nesprávné telefonní číslo nebo heslo.', 401);
}));

// Public endpoint: register a coach account with an e-mail.
// Uses the admin API with email_confirm:true so no confirmation e-mail is sent —
// coaches are manually approved by an org admin anyway.
app.post('/api/auth/coach-register', asyncRoute(async (request, response) => {
  requireServices();

  const email = requiredString(request.body.email, 'email').trim().toLowerCase();
  const password = requiredString(request.body.password, 'password');
  const fullName = optionalString(request.body.fullName) || 'Trenér TeamVYS';
  const phone = optionalString(request.body.phone) || null;
  const orgId = optionalString(request.body.orgId) || null;
  const coachMessage = optionalString(request.body.coachMessage) || null;
  const legalVersion = requiredString(request.body.legalVersion, 'legalVersion');
  if (request.body.acceptedTerms !== true) throw httpError('Musíte souhlasit se zpracováním osobních údajů a obchodními podmínkami.', 400);

  if (password.length < 6) throw httpError('Heslo musí mít alespoň 6 znaků.', 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError('Zadej platný e-mail.', 400);

  // Check if an account with this e-mail already exists.
  const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  // We can't search by email in listUsers, so attempt to create and let Supabase
  // return the "already registered" error naturally.

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true, // skip email confirmation — coach is approved by org admin
    password,
    user_metadata: {
      role: 'coach',
      name: fullName,
      phone: phone ?? undefined,
      coachMessage: coachMessage ?? undefined,
      termsVersion: legalVersion,
      ...(orgId ? { org_id: orgId } : {}),
    },
  });

  if (createError) {
    if (/already|exist|registered/i.test(createError.message || '')) {
      throw httpError('Účet s tímto e-mailem už existuje. Přihlas se.', 409);
    }
    throw createError;
  }

  // Sign in immediately so the mobile app gets a session.
  const authClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: sessionData, error: signInError } = await authClient.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  response.json({
    ok: true,
    userId: created.user.id,
    email,
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
  });
}));

// TEMPORARY diagnostic endpoint: inspect Stripe webhook configuration.
// Protected by the Supabase service role key — only the operator has it.
app.get('/api/stripe/debug-webhooks', asyncRoute(async (request, response) => {
  requireStripe();
  const token = (request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || token !== supabaseServiceKey) {
    const error = new Error('Unauthorized.');
    error.statusCode = 401;
    throw error;
  }

  const endpoints = await stripe.webhookEndpoints.list({ limit: 20 });
  const events = await stripe.events.list({ limit: 20 });
  response.json({
    webhookSecretConfigured: Boolean(stripeWebhookSecret),
    keyMode: stripeSecretKey.startsWith('sk_test') ? 'test' : (stripeSecretKey.startsWith('sk_live') ? 'live' : 'unknown'),
    endpoints: endpoints.data.map((endpoint) => ({
      id: endpoint.id,
      url: endpoint.url,
      status: endpoint.status,
      enabled_events: endpoint.enabled_events,
      api_version: endpoint.api_version,
    })),
    recentEvents: events.data.map((event) => ({
      id: event.id,
      type: event.type,
      created: new Date(event.created * 1000).toISOString(),
      pending_webhooks: event.pending_webhooks,
    })),
  });
}));

// Super admin only: approve a pending organization — the 30-day trial starts now.
app.post('/api/orgs/:orgId/approve', asyncRoute(async (request, response) => {
  await requireSuperAdminUser(request);
  const orgId = requiredString(request.params.orgId, 'orgId');
  const org = await pendingOrganizationById(orgId);

  const trialEndsAt = new Date(Date.now() + ORG_TRIAL_DAYS * MS_PER_DAY).toISOString();
  const { error: updateError } = await supabase
    .from('organizations')
    .update({ subscription_status: 'trialing', trial_ends_at: trialEndsAt })
    .eq('id', orgId)
    .eq('subscription_status', 'pending_approval');
  if (updateError) throw updateError;
  orgStatusCache.delete(orgId);

  await alignStripeTrialEnd(org, trialEndsAt);

  // The org admin already set a password at registration, so no recovery link
  // is needed — just promote their app_profiles role (in case provisioning's
  // promotion was missed) and send a simple "approved, log in" e-mail.
  const { data: adminProfile } = await supabase
    .from('app_profiles')
    .select('name')
    .eq('email', org.contact_email)
    .eq('org_id', orgId)
    .maybeSingle();

  try {
    await sendOrgOnboardingEmail(org, adminProfile?.name || 'správce organizace', trialEndsAt);
  } catch (emailError) {
    console.error(`Org approval welcome email failed for ${org.id}:`, emailError);
  }

  console.info(`Organization ${org.id} (${org.name}) approved by super admin.`);
  response.json({ ok: true, orgId, subscriptionStatus: 'trialing', trialEndsAt });
}));

// Super admin only: reject a pending organization — cancels the Stripe
// subscription so nothing is ever billed, and informs the org admin.
app.post('/api/orgs/:orgId/reject', asyncRoute(async (request, response) => {
  await requireSuperAdminUser(request);
  const orgId = requiredString(request.params.orgId, 'orgId');
  const org = await pendingOrganizationById(orgId);

  const { error: updateError } = await supabase
    .from('organizations')
    .update({ subscription_status: 'canceled' })
    .eq('id', orgId)
    .eq('subscription_status', 'pending_approval');
  if (updateError) throw updateError;
  orgStatusCache.delete(orgId);

  await cancelStripeSubscriptionsForOrg(org);

  try {
    await sendOrgRejectionEmail(org);
  } catch (emailError) {
    console.error(`Org rejection email failed for ${org.id}:`, emailError);
  }

  console.info(`Organization ${org.id} (${org.name}) rejected by super admin.`);
  response.json({ ok: true, orgId, subscriptionStatus: 'canceled' });
}));

app.use((error, _request, response, _next) => {
  const status = error.statusCode || 400;
  response.status(status).json({ error: error.message || 'Unexpected backend error.' });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`TeamVYS API listening on http://localhost:${port}`);
  });
}

module.exports = app;