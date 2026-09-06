import { createBrowserSupabaseClient, hasSupabaseBrowserConfig } from '@/lib/supabase/browser';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://server-psi-ochre-40.vercel.app';

type CheckoutPayload = {
  productId: string;
  participantId: string;
  participantName: string;
  successUrl: string;
  cancelUrl: string;
  receiptEmail?: string;
  discountCode?: string;
};

type CheckoutResponse = {
  id: string;
  url: string | null;
};

export type EmbeddedPaymentIntentPayload = {
  parentProfileId?: string;
  productId: string;
  participantId: string;
  participantName: string;
  receiptEmail?: string;
  discountCode?: string;
};

export type EmbeddedPaymentIntentResponse = {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  originalAmount: number;
  discountAmount: number;
  discountPercent: number;
  priceLabel: string;
};

type SaveCourseDocument = {
  kind: string;
  title: string;
  parentName: string;
  payload: Record<string, unknown>;
};

type SaveCourseDocumentsPayload = {
  parentProfileId?: string;
  productId: string;
  participantId: string;
  participantName: string;
  participantFirstName: string;
  participantLastName: string;
  documents: SaveCourseDocument[];
};

type SaveCourseDocumentsResponse = {
  documents: Array<{
    id: string;
    participant_id: string;
    product_id: string;
    kind: string;
    title: string;
    status: string;
    updated_at_text: string;
  }>;
};

type CreateManualParticipantPayload = {
  parentProfileId?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  schoolYear: string;
  parentName: string;
  parentPhone: string;
  emergencyPhone: string;
  address: string;
  preferredCourse: string;
  departureMode: string;
  authorizedPeople?: string;
  allergies: string;
  healthLimits: string;
  medicationNote: string;
  coachNote?: string;
};

type CreateManualParticipantResponse = {
  participant: {
    id: string;
    first_name: string;
    last_name: string;
    active_course: string | null;
  };
};

type LinkParticipantPayload = {
  parentProfileId?: string;
  claimCode: string;
};

type LinkParticipantResponse = {
  participant: {
    id: string;
    first_name: string;
    last_name: string;
    active_course: string | null;
    parent_profile_id: string | null;
  };
};

type RegisterWorkshopInterestPayload = {
  parentProfileId?: string;
  productId: string;
  participantId: string;
  participantName: string;
};

type RegisterWorkshopInterestResponse = {
  interestCount: number;
  canPurchase: boolean;
  threshold: number;
};

type ConfirmResponse = {
  purchase: {
    id: string;
    title: string;
    participantName: string;
    amount: number;
    priceLabel: string;
    status: string;
    paidAt: string;
  };
};

export type SaveCoachAttendancePayload = {
  coachId: string;
  sessionId: string;
  place: string;
  present: string;
  durationHours: number;
  hourlyRate: number;
  latitude?: number;
  longitude?: number;
};

export type SaveCoachAttendanceResponse = {
  attendance: {
    id: string;
    coach_id: string;
    session_id: string;
    date_text: string;
    place: string;
    status: string;
    present: string;
    duration_hours: number;
    hourly_rate: number;
    amount: number;
  };
};

export type TrainerPayoutPayload = {
  coachId: string;
  coachName: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  stripeAccountId: string;
  amount: number;
};

export type TrainerPayoutTransfer = {
  id: string;
  coachId: string;
  coachName: string;
  periodKey: string;
  amount: number;
  status: string;
  createdAt?: string;
  stripeTransferId?: string;
};

type RawTrainerPayoutTransfer = {
  id: string;
  coach_id?: string;
  coachId?: string;
  coach_name?: string;
  coachName?: string;
  period_key?: string;
  periodKey?: string;
  amount: number;
  status: string;
  created_at_text?: string;
  createdAt?: string;
  stripe_transfer_id?: string | null;
  stripeTransferId?: string;
};

export async function createCheckoutSession(payload: CheckoutPayload): Promise<CheckoutResponse> {
  return requestJson('/api/payments/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, { auth: true });
}

export type RegisterOrganizationPayload = {
  orgName: string;
  contactEmail: string;
  adminFirstName: string;
  adminLastName: string;
  password: string;
  ico: string;
  sportType?: string;
  city?: string;
  successUrl: string;
  cancelUrl: string;
};

export async function registerOrganization(payload: RegisterOrganizationPayload): Promise<CheckoutResponse> {
  return requestJson('/api/orgs/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function finalizeOrganizationRegistration(sessionId: string): Promise<{ ok: boolean; orgId: string; orgName: string; contactEmail: string }> {
  return requestJson('/api/orgs/finalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
}

export type OrgConnectStatus = {
  connected: boolean;
  accountId?: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
};

export async function getOrgConnectStatus(): Promise<OrgConnectStatus> {
  return requestJson('/api/orgs/connect/status', { method: 'GET' }, { auth: true });
}

export async function startOrgConnectOnboarding(returnUrl: string, refreshUrl: string): Promise<{ accountId: string; onboardingUrl: string }> {
  return requestJson('/api/orgs/connect/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnUrl, refreshUrl }),
  }, { auth: true });
}

export type OrgStripeStatus = {
  configured: boolean;
  publishableKey: string | null;
  webhookConfigured: boolean;
  webhookUrl: string;
  isVys: boolean;
  keyValid: boolean;
};

export async function getOrgStripeStatus(): Promise<OrgStripeStatus> {
  return requestJson('/api/orgs/stripe/status', { method: 'GET' }, { auth: true });
}

export async function saveOrgStripeKeys(payload: { secretKey: string; publishableKey: string; webhookSecret?: string }): Promise<{ ok: boolean; webhookUrl: string }> {
  return requestJson('/api/orgs/stripe/save-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, { auth: true });
}

export async function deleteOrgStripeKeys(): Promise<{ ok: boolean }> {
  return requestJson('/api/orgs/stripe/keys', { method: 'DELETE' }, { auth: true });
}

export async function getOrgCoachRate(): Promise<{ defaultCoachHourlyRate: number }> {
  return requestJson('/api/orgs/coach-rate', { method: 'GET' }, { auth: true });
}

export async function saveOrgCoachRate(defaultCoachHourlyRate: number): Promise<{ ok: boolean; defaultCoachHourlyRate: number }> {
  return requestJson('/api/orgs/coach-rate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ defaultCoachHourlyRate }),
  }, { auth: true });
}

export type OrgDppTemplate = {
  dppRole: string | null;
  dppScope: string | null;
  dppClauses: string[] | null;
};

export async function getOrgDppTemplate(): Promise<OrgDppTemplate> {
  return requestJson('/api/orgs/dpp-template', { method: 'GET' }, { auth: true });
}

export async function saveOrgDppTemplate(template: OrgDppTemplate): Promise<{ ok: boolean } & OrgDppTemplate> {
  return requestJson('/api/orgs/dpp-template', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template),
  }, { auth: true });
}

export type DocumentSlotActivityType = 'Kroužek' | 'Tábor' | 'Workshop';
export type DocumentSlotFulfillment = 'electronic' | 'upload';

export type DocumentSlot = {
  id: string;
  orgId: string;
  activityType: DocumentSlotActivityType;
  label: string;
  description: string | null;
  fulfillment: DocumentSlotFulfillment;
  templateKind: string | null;
  productId: string | null;
  templateId: string | null;
  templatePath: string | null;
  templateFilename: string | null;
  required: boolean;
  sortOrder: number;
  active: boolean;
  updatedAt: string;
};

export type CreateDocumentSlotPayload = {
  activityType: DocumentSlotActivityType;
  label: string;
  description?: string | null;
  fulfillment?: DocumentSlotFulfillment;
  templateKind?: string | null;
  productId?: string | null;
  templateId?: string | null;
  templatePath?: string | null;
  templateFilename?: string | null;
  required?: boolean;
  sortOrder?: number;
};

export type UpdateDocumentSlotPayload = Partial<Omit<CreateDocumentSlotPayload, 'activityType'>> & { active?: boolean };

export async function listAdminDocumentSlots(options?: { activityType?: DocumentSlotActivityType; productId?: string }): Promise<{ slots: DocumentSlot[] }> {
  const params = new URLSearchParams();
  if (options?.activityType) params.set('activityType', options.activityType);
  if (options?.productId) params.set('productId', options.productId);
  const query = params.toString() ? `?${params.toString()}` : '';
  return requestJson(`/api/admin/document-slots${query}`, { method: 'GET', cache: 'no-store' }, { auth: true });
}

export async function createDocumentSlot(payload: CreateDocumentSlotPayload): Promise<{ slot: DocumentSlot }> {
  return requestJson('/api/admin/document-slots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, { auth: true });
}

export async function updateDocumentSlot(id: string, patch: UpdateDocumentSlotPayload): Promise<{ slot: DocumentSlot }> {
  return requestJson(`/api/admin/document-slots/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }, { auth: true });
}

export async function deleteDocumentSlot(id: string): Promise<{ ok: boolean }> {
  return requestJson(`/api/admin/document-slots/${encodeURIComponent(id)}`, { method: 'DELETE' }, { auth: true });
}

export async function listDocumentSlots(params: { orgId?: string; activityType?: DocumentSlotActivityType; productId?: string }): Promise<{ slots: DocumentSlot[] }> {
  const search = new URLSearchParams();
  if (params.orgId) search.set('orgId', params.orgId);
  if (params.activityType) search.set('activityType', params.activityType);
  if (params.productId) search.set('productId', params.productId);
  return requestJson(`/api/document-slots?${search.toString()}`, { method: 'GET', cache: 'no-store' }, { auth: true });
}

export type CustomDocFieldType = 'text' | 'textarea' | 'check' | 'choice' | 'date';

export type CustomDocField = {
  id: string;
  label: string;
  type: CustomDocFieldType;
  required?: boolean;
  options?: string[];
};

export type ElectronicDocBody = {
  intro: string | null;
  clauses: string[];
  fields: CustomDocField[];
};

export type DocumentTemplateKind = 'file' | 'electronic';

export type DocumentTemplate = {
  id: string;
  orgId: string;
  name: string;
  kind: DocumentTemplateKind;
  filePath: string | null;
  fileFilename: string | null;
  body: ElectronicDocBody | null;
  createdAt: string;
};

export async function listDocumentTemplates(): Promise<{ templates: DocumentTemplate[] }> {
  return requestJson('/api/admin/document-templates', { method: 'GET', cache: 'no-store' }, { auth: true });
}

export type CreateDocumentTemplatePayload = {
  name: string;
  kind?: DocumentTemplateKind;
  filePath?: string;
  fileFilename?: string;
  body?: ElectronicDocBody;
};

export async function createDocumentTemplate(payload: CreateDocumentTemplatePayload): Promise<{ template: DocumentTemplate }> {
  return requestJson('/api/admin/document-templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, { auth: true });
}

export async function updateDocumentTemplate(id: string, patch: { name?: string; body?: ElectronicDocBody }): Promise<{ template: DocumentTemplate }> {
  return requestJson(`/api/admin/document-templates/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }, { auth: true });
}

export async function deleteDocumentTemplate(id: string): Promise<{ ok: boolean }> {
  return requestJson(`/api/admin/document-templates/${encodeURIComponent(id)}`, { method: 'DELETE' }, { auth: true });
}

export type TrickVoteResult = { trickName: string; votes: number };

export async function getAdminTrickVotes(): Promise<{ week: string; results: TrickVoteResult[]; totalVotes: number; totalVoters: number }> {
  return requestJson('/api/admin/trick-votes', { method: 'GET', cache: 'no-store' }, { auth: true });
}

export type CoachDocument = {
  id: string;
  coachId: string;
  templateId: string;
  createdAt: string;
  template: { id: string; name: string; kind: DocumentTemplateKind; filePath: string | null; fileFilename: string | null };
};

export async function listCoachDocuments(coachId: string): Promise<{ documents: CoachDocument[] }> {
  return requestJson(`/api/admin/coach-documents?coachId=${encodeURIComponent(coachId)}`, { method: 'GET', cache: 'no-store' }, { auth: true });
}

export async function attachCoachDocument(coachId: string, templateId: string): Promise<{ document: CoachDocument }> {
  return requestJson('/api/admin/coach-documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coachId, templateId }),
  }, { auth: true });
}

export async function deleteCoachDocument(id: string): Promise<{ ok: boolean }> {
  return requestJson(`/api/admin/coach-documents/${encodeURIComponent(id)}`, { method: 'DELETE' }, { auth: true });
}

export async function createEmbeddedPaymentIntent(payload: EmbeddedPaymentIntentPayload): Promise<EmbeddedPaymentIntentResponse> {
  return requestJson('/api/payments/payment-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, { auth: true });
}

export async function confirmEmbeddedPaymentIntent(paymentIntentId: string): Promise<ConfirmResponse> {
  return requestJson('/api/payments/confirm-payment-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentIntentId }),
  }, { auth: true });
}

export async function saveCourseDocuments(payload: SaveCourseDocumentsPayload): Promise<SaveCourseDocumentsResponse> {
  return requestJson('/api/course-documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, { auth: true });
}

export async function createManualParticipantProfile(payload: CreateManualParticipantPayload): Promise<CreateManualParticipantResponse> {
  return requestJson('/api/participants/manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, { auth: true });
}

export async function linkParticipantByClaimCode(payload: LinkParticipantPayload): Promise<LinkParticipantResponse> {
  // This route lives in the Next.js app itself — use a relative fetch, NOT the external apiUrl
  const init = await withAuthHeader({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const response = await fetch('/api/participants/link', init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data as LinkParticipantResponse;
}

export async function registerWorkshopInterest(payload: RegisterWorkshopInterestPayload): Promise<RegisterWorkshopInterestResponse> {
  return requestJson('/api/workshop-interests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, { auth: true });
}

export async function confirmCheckoutSession(sessionId: string): Promise<ConfirmResponse> {
  return requestJson('/api/payments/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  }, { auth: true });
}

export type ParentOrganizationsResponse = {
  joined: Array<{ id: string; name: string; orgType: string; productCount: number }>;
  available: Array<{ id: string; name: string; orgType: string }>;
};

export async function listParentOrganizations(parentProfileId?: string): Promise<ParentOrganizationsResponse> {
  const query = parentProfileId ? `?parentProfileId=${encodeURIComponent(parentProfileId)}` : '';
  return requestJson(`/api/parent/organizations${query}`, { method: 'GET', cache: 'no-store' }, { auth: true });
}

export async function joinParentOrganization(orgId: string, parentProfileId?: string): Promise<{ ok: boolean; orgId: string; name: string }> {
  return requestJson('/api/parent/organizations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgId, parentProfileId }),
  }, { auth: true });
}

export async function leaveParentOrganization(orgId: string, parentProfileId?: string): Promise<{ ok: boolean; orgId: string }> {
  const query = parentProfileId ? `?parentProfileId=${encodeURIComponent(parentProfileId)}` : '';
  return requestJson(`/api/parent/organizations/${encodeURIComponent(orgId)}${query}`, {
    method: 'DELETE',
  }, { auth: true });
}

export async function saveCoachAttendance(payload: SaveCoachAttendancePayload): Promise<SaveCoachAttendanceResponse> {  return requestJson('/api/coach/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, { auth: true });
}

export async function createCoachStripeOnboarding(coachId: string, returnUrl: string, refreshUrl: string): Promise<{ accountId: string; onboardingUrl: string }> {
  return requestJson('/api/admin/coaches/' + coachId + '/stripe-onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnUrl, refreshUrl }),
  }, { auth: true });
}

export async function sendTrainerPayout(payload: TrainerPayoutPayload): Promise<{ transfer: TrainerPayoutTransfer }> {
  const result = await requestJson<{ transfer: RawTrainerPayoutTransfer }>('/api/admin/trainer-payouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, { auth: true });

  return { transfer: normalizeTrainerPayoutTransfer(result.transfer, payload) };
}

async function requestJson<T>(path: string, init: RequestInit, options: { auth?: boolean } = {}): Promise<T> {
  const requestInit = options.auth ? await withAuthHeader(init) : init;
  const response = await fetch(`${apiUrl}${path}`, requestInit);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `Backend returned HTTP ${response.status}`);
  }

  return payload as T;
}

async function withAuthHeader(init: RequestInit): Promise<RequestInit> {
  if (!hasSupabaseBrowserConfig()) return init;

  const supabase = createBrowserSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return init;

  return {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  };
}

function normalizeTrainerPayoutTransfer(transfer: RawTrainerPayoutTransfer, fallback: TrainerPayoutPayload): TrainerPayoutTransfer {
  return {
    id: transfer.id,
    coachId: transfer.coachId ?? transfer.coach_id ?? fallback.coachId,
    coachName: transfer.coachName ?? transfer.coach_name ?? fallback.coachName,
    periodKey: transfer.periodKey ?? transfer.period_key ?? fallback.periodKey,
    amount: Number(transfer.amount || fallback.amount),
    status: transfer.status,
    createdAt: transfer.createdAt ?? transfer.created_at_text,
    stripeTransferId: transfer.stripeTransferId ?? transfer.stripe_transfer_id ?? undefined,
  };
}

// ─── Admin products ───────────────────────────────────────────────────────────

export type AdminProductRow = {
  id: string;
  type: string;
  org_id?: string;
  title: string;
  city: string;
  place: string;
  venue: string;
  price: number;
  original_price?: number;
  price_label: string;
  entries_total?: number;
  primary_meta: string;
  secondary_meta: string;
  description: string;
  important_info: Array<{ label: string; value: string }>;
  badge: string;
  event_date?: string;
  expires_at?: string;
  capacity_total?: number;
  capacity_current: number;
  interest_count?: number;
  can_purchase?: boolean;
  hero_image?: string;
  gallery: string[];
  map_query?: string;
  latitude?: number;
  longitude?: number;
  coach_ids: string[];
  training_focus: string[];
  is_published: boolean;
  skill_category?: string;
};

export async function loadAdminProducts(): Promise<AdminProductRow[]> {
  const result = await requestJson<{ products: AdminProductRow[] }>('/api/admin/products', { method: 'GET' }, { auth: true });
  return result.products;
}

export async function loadPublicProducts(): Promise<AdminProductRow[]> {
  const result = await requestJson<{ products: AdminProductRow[] }>('/api/public/products', { method: 'GET', cache: 'no-store' });
  return result.products;
}

export async function loadParentProducts(): Promise<AdminProductRow[]> {
  const result = await requestJson<{ products: AdminProductRow[] }>('/api/parent/products', { method: 'GET', cache: 'no-store' }, { auth: true });
  return result.products;
}

export type PublicCoachSummary = {
  id: string;
  name: string;
  photoUrl: string;
};

export async function loadPublicCoaches(): Promise<PublicCoachSummary[]> {
  const result = await requestJson<{ coaches: PublicCoachSummary[] }>('/api/public/coaches', { method: 'GET', cache: 'no-store' });
  return result.coaches;
}

export async function saveAdminProduct(product: AdminProductRow): Promise<{ id: string }> {
  return requestJson('/api/admin/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product }),
  }, { auth: true });
}

export async function deleteAdminProduct(productId: string): Promise<void> {
  await requestJson(`/api/admin/products/${encodeURIComponent(productId)}`, { method: 'DELETE' }, { auth: true });
}

// ─── Admin broadcasts (parent notification center) ────────────────────────

export type AdminBroadcast = {
  id: string;
  title: string;
  body: string;
  audience: 'all' | 'selected';
  recipient_count: number;
  sender_name: string;
  created_at: string;
};

export async function sendBroadcast(payload: {
  title: string;
  body: string;
  audience: 'all' | 'selected';
  parentProfileIds: string[];
}): Promise<{ ok: boolean; recipients: number; pushed: number; skipped: number }> {
  return requestJson('/api/admin/broadcasts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, { auth: true });
}

export async function listBroadcasts(): Promise<{ broadcasts: AdminBroadcast[] }> {
  return requestJson('/api/admin/broadcasts', { method: 'GET', cache: 'no-store' }, { auth: true });
}

// ─── Admin invoices ──────────────────────────────────────────────────────────

export type AdminInvoiceRow = {
  id: number | string;
  dodavatel: string | null;
  castka: string | null;
  mena: string | null;
  datum_vystaveni: string | null;
  datum_splatnosti: string | null;
  cislo_faktury: string | null;
  popis: string | null;
  file_url: string | null;
  kategorie: string | null;
  zaplaceno: boolean;
  datum_zaplaceni: string | null;
  odeslal: string | null;
  created_at: string | null;
};

export type AdminInvoiceInput = {
  supplier: string;
  description: string;
  amount: number;
  issuedDate: string;
  dueDate?: string;
  paid?: boolean;
  paidDate?: string;
  category?: string;
  fileUrl?: string;
};

export async function loadAdminInvoices(): Promise<AdminInvoiceRow[]> {
  const result = await requestJson<{ invoices: AdminInvoiceRow[] }>('/api/admin/invoices', { method: 'GET' }, { auth: true });
  return result.invoices;
}

export async function createAdminInvoice(invoice: AdminInvoiceInput): Promise<AdminInvoiceRow> {
  const result = await requestJson<{ invoice: AdminInvoiceRow }>('/api/admin/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoice }),
  }, { auth: true });
  return result.invoice;
}

export async function updateAdminInvoicePayment(invoiceId: string, paid: boolean): Promise<AdminInvoiceRow> {
  const result = await requestJson<{ invoice: AdminInvoiceRow }>(`/api/admin/invoices/${encodeURIComponent(invoiceId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paid }),
  }, { auth: true });
  return result.invoice;
}

export async function deleteAdminInvoice(invoiceId: string): Promise<void> {
  await requestJson(`/api/admin/invoices/${encodeURIComponent(invoiceId)}`, { method: 'DELETE' }, { auth: true });
}

export async function createAdminInvoiceUploadUrl(filename: string): Promise<{ signedUrl: string; path: string }> {
  return requestJson<{ signedUrl: string; path: string }>('/api/admin/invoices/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  }, { auth: true });
}

export async function createProductVideoUploadUrl(filename: string): Promise<{ signedUrl: string; path: string }> {
  return requestJson<{ signedUrl: string; path: string }>('/api/admin/products/video-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  }, { auth: true });
}