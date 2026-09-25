import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SignOutButton } from '@/components/auth/sign-out-button';
import { NavigationExitGuard } from '@/components/navigation-exit-guard';
import { ParentPortalDashboard, type ParentPortalData } from '@/components/portal/parent-dashboard';
import { DEV_BYPASS_AUTH } from '@/lib/dev-config';
import { parentProducts, type ActivityType, type DocumentStatus, type ParentDocument, type ParentParticipant, type ParentPayment, type ParentProduct, type PaymentStatus } from '@/lib/portal-content';
import { createServerSupabaseClient, hasSupabaseServerConfig } from '@/lib/supabase/server';

export const metadata = {
  title: 'Rodič',
};

export default async function ParentDashboardPage() {
  let displayName = DEV_BYPASS_AUTH ? 'Test rodič' : 'Rodič';
  let displayEmail = DEV_BYPASS_AUTH ? 'rodic@example.cz' : '';
  let parentProfileId: string | undefined;
  let initialData: ParentPortalData | null = null;
  let showSignOut = false;

  if (!DEV_BYPASS_AUTH) {
    if (!hasSupabaseServerConfig()) return <ConfigMissing />;

    const supabase = await createServerSupabaseClient();
    const { data: userResult } = await supabase.auth.getUser();
    const user = userResult.user;
    if (!user) redirect('/sign-in?next=/rodic');

    const { data: profile } = await supabase.from('app_profiles').select('role,name,email').eq('id', user.id).maybeSingle();
    if (profile?.role === 'admin') redirect('/admin');
    if (profile?.role !== 'parent') {
      if (profile?.role === 'participant') redirect('/app/ucastnik');
      if (profile?.role === 'coach') redirect('/app/trener');
      redirect('/sign-in?next=/rodic');
    }

    const profileName = isDemoParentName(profile?.name) ? '' : profile?.name;
    displayName = profileName || nameFromEmail(user.email) || 'Rodič';
    // Prefer the name from auth metadata (what the user typed at registration).
    // If it differs from app_profiles.name, auto-correct app_profiles so the
    // greeting is always consistent with what the user actually registered with.
    const authName = (typeof user.user_metadata?.name === 'string' ? user.user_metadata.name.trim() : '') ||
      (typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '');
    if (authName && !isDemoParentName(authName)) {
      displayName = authName;
      if (profile?.name !== authName) {
        await supabase.from('app_profiles').update({ name: authName }).eq('id', user.id);
      }
    } else if (isDemoParentName(profile?.name) && displayName !== 'Rodič') {
      await supabase.from('app_profiles').update({ name: displayName }).eq('id', user.id);
    }
    displayEmail = profile?.email || user.email || '';
    parentProfileId = user.id;
    initialData = await loadParentPortalData(supabase, user.id);
    showSignOut = true;
  }

  return (
    <main className="min-h-dvh bg-brand-paper px-4 py-4 text-brand-ink texture-grid md:px-6 md:py-6">
      <NavigationExitGuard message="Chceš opustit rodičovský web?" />
      <div className="mx-auto max-w-[1220px] space-y-4">
        <header className="rounded-[18px] border border-brand-purple/12 bg-white/86 shadow-brand-soft backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-5">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-purple">Rodičovský web</p>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="text-xl font-black leading-tight text-brand-ink md:text-2xl">Ahoj, {displayName}</h1>
                <p className="text-xs font-bold text-brand-ink-soft md:text-sm">platby, dokumenty a docházka na jednom místě</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {DEV_BYPASS_AUTH ? <span className="rounded-[12px] bg-[#2B1247] px-3 py-2 text-[10px] font-black uppercase text-brand-lime">Testovací režim</span> : null}
              <Link href="/" className="rounded-[12px] border border-brand-purple/12 bg-brand-paper px-3 py-2 text-sm font-black text-brand-ink transition-colors hover:bg-brand-purple-light">Web</Link>
              {showSignOut ? <SignOutButton /> : null}
            </div>
          </div>
        </header>

        <ParentPortalDashboard displayName={displayName} displayEmail={displayEmail} parentProfileId={parentProfileId} initialData={initialData} />
      </div>
    </main>
  );
}

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

async function loadParentPortalData(supabase: SupabaseClient, parentId: string): Promise<ParentPortalData> {
  const [{ data: participantRows }, { data: productRows }, { data: purchaseRows }, { data: reviewRows }, { data: interestRows }, { data: memberRows }, { data: publicOrgRows }] = await Promise.all([
    supabase.from('participants').select('*').eq('parent_profile_id', parentId).order('created_at', { ascending: true }),
    supabase.from('products').select('*, organizations(id,name)').eq('is_published', true).order('created_at', { ascending: true }),
    supabase.from('parent_purchases').select('*').eq('parent_profile_id', parentId).order('created_at', { ascending: false }),
    supabase.from('coach_reviews').select('*').eq('parent_id', parentId).order('created_at', { ascending: false }),
    supabase.from('workshop_interests').select('id,parent_profile_id,participant_id,participant_name,product_id'),
    supabase.from('organization_members').select('org_id, organizations(id,name,org_type)').eq('profile_id', parentId),
    supabase.rpc('teamvys_public_organizations'),
  ]);

  const participants = (participantRows || []).map(mapParticipantRow);
  const interestCounts = workshopInterestCounts(interestRows || []);
  const participantIds = participants.map((participant) => participant.id);
  const participantNames = new Set(participants.map((participant) => `${participant.firstName} ${participant.lastName}`));

  // Organizations the parent belongs to (products are already RLS-scoped to these).
  const orgNameById = new Map<string, string>();
  for (const row of (memberRows as DbRow[] | null) || []) {
    const org = (row.organizations || {}) as DbRow;
    const id = String(org.id || row.org_id || '');
    if (id) orgNameById.set(id, String(org.name || 'Organizace'));
  }
  const productCountByOrg = new Map<string, number>();
  for (const row of (productRows as DbRow[] | null) || []) {
    const orgId = String(row.org_id || '');
    if (orgId) productCountByOrg.set(orgId, (productCountByOrg.get(orgId) || 0) + 1);
  }
  const joinedOrganizations = Array.from(orgNameById.entries())
    .map(([id, name]) => {
      const member = ((memberRows as DbRow[] | null) || []).find((row) => String((row.organizations as DbRow | undefined)?.id || row.org_id) === id);
      const orgType = String((member?.organizations as DbRow | undefined)?.org_type || 'external');
      return { id, name, orgType, productCount: productCountByOrg.get(id) || 0 };
    })
    .sort((a, b) => (a.orgType === 'vys' ? -1 : b.orgType === 'vys' ? 1 : a.name.localeCompare(b.name)));
  const joinedIds = new Set(joinedOrganizations.map((org) => org.id));
  const availableOrganizations = ((publicOrgRows as DbRow[] | null) || [])
    .filter((org) => !joinedIds.has(String(org.id)))
    .map((org) => ({ id: String(org.id), name: String(org.name || 'Organizace'), orgType: String(org.org_type || 'external') }));

  // Collect unique coach IDs referenced by published products
  const allCoachIds = [...new Set((productRows || []).flatMap((row) => stringArray(row.coach_ids, [])))];

  const [{ data: documentRows }, { data: passRows }, notificationRows, { data: paymentRows }, { data: coachProfileRows }, { data: coachAppRows }] = await Promise.all([
    participantIds.length > 0 ? supabase.from('course_documents').select('*').in('participant_id', participantIds).order('updated_at', { ascending: false }) : Promise.resolve({ data: [] }),
    participantIds.length > 0 ? supabase.from('digital_passes').select('*').in('participant_id', participantIds).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
    loadParentNotifications(supabase, parentId, participantIds),
    participantIds.length > 0 ? supabase.from('parent_payments').select('*').in('participant_id', participantIds).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
    allCoachIds.length > 0 ? supabase.from('coach_profiles').select('id,qr_tricks_approved,profile_photo_url,assigned_courses').in('id', allCoachIds) : Promise.resolve({ data: [] }),
    allCoachIds.length > 0 ? supabase.from('app_profiles').select('id,name,email,phone').in('id', allCoachIds).eq('role', 'coach') : Promise.resolve({ data: [] }),
  ]);

  const notifications = notificationRows
    .filter((row) => participantNames.size === 0 || Array.from(participantNames).some((name) => String(row.text || '').includes(name)))
    .map((row) => ({ id: String(row.id), text: String(row.text || ''), createdAt: String(row.created_at_text || formatDateCz(row.created_at)), method: String(row.method || '') }));

  // Build a map of real coach data from DB
  const coachProfileMap = new Map((coachProfileRows || []).map((row) => [String(row.id), row]));
  const coaches = (coachAppRows || []).map((row) => {
    const profile = coachProfileMap.get(String(row.id));
    return {
      id: String(row.id),
      name: String(row.name || ''),
      email: String(row.email || ''),
      phone: String(row.phone || ''),
      locations: stringArray((profile as DbRow | undefined)?.assigned_courses, []),
      qrTricksApproved: Number((profile as DbRow | undefined)?.qr_tricks_approved || 0),
      profilePhotoUrl: String((profile as DbRow | undefined)?.profile_photo_url || '/vys-logo-mark.png'),
    };
  });

  return {
    participants,
    organizations: { joined: joinedOrganizations, available: availableOrganizations },
    products: (productRows || []).map((row) => mapProductRow(row, interestCounts, orgNameById)),
    payments: dedupePayments([
      ...(purchaseRows || []).map(mapPurchaseRow),
      ...(paymentRows || []).map(mapPaymentRow),
    ]),
    documents: (documentRows || []).map(mapDocumentRow),
    digitalPasses: (passRows || []).map((row) => ({
      id: String(row.id),
      participantId: String(row.participant_id),
      title: String(row.title || 'Digitální vstupenka'),
      location: String(row.location || ''),
      usedEntries: Number(row.used_entries || 0),
      totalEntries: Number(row.total_entries || 1),
      nfcChipId: String(row.nfc_chip_id || ''),
      lastScanAt: String(row.last_scan_at || 'Zatím bez skenu'),
    })),
    notifications,
    attendanceHistory: notifications.map((notification) => ({
      id: `att-${notification.id}`,
      participantName: findParticipantNameInText(notification.text, participantNames) || 'Účastník',
      date: notification.createdAt,
      location: notification.text.split(' · ')[1]?.replace('.', '') || 'TeamVYS',
      time: notification.method,
      method: 'NFC',
    })),
    coachReviews: (reviewRows || []).map((row) => ({
      id: String(row.id),
      coachId: String(row.coach_id),
      coachName: String(row.coach_name),
      parentName: String(row.parent_name),
      participantName: String(row.participant_name),
      rating: Number(row.rating || 5),
      comment: String(row.comment || ''),
      createdAt: String(row.created_at_text || formatDateCz(row.created_at)),
    })),
    coaches,
  };
}

async function loadParentNotifications(supabase: SupabaseClient, parentId: string, participantIds: string[]): Promise<DbRow[]> {
  const [parentResult, participantResult] = await Promise.all([
    supabase.from('parent_notifications').select('*').eq('parent_profile_id', parentId).order('created_at', { ascending: false }).limit(40),
    participantIds.length > 0
      ? supabase.from('parent_notifications').select('*').in('participant_id', participantIds).order('created_at', { ascending: false }).limit(40)
      : Promise.resolve({ data: [] }),
  ]);

  const rows = [...(parentResult.data || []), ...(participantResult.data || [])] as DbRow[];
  const uniqueRows = new Map(rows.map((row) => [String(row.id), row]));
  return Array.from(uniqueRows.values())
    .sort((a, b) => new Date(String(b.created_at || '')).getTime() - new Date(String(a.created_at || '')).getTime())
    .slice(0, 40);
}

function ConfigMissing() {
  return (
    <main className="min-h-dvh bg-brand-paper px-6 py-12">
      <div className="mx-auto max-w-[760px] rounded-brand-lg border bg-white p-7" style={{ borderColor: 'rgba(20,14,38,0.08)', boxShadow: 'var(--shadow-card)' }}>
        <p className="text-brand-pink text-xs font-black uppercase tracking-[0.16em]">Chybí Supabase env</p>
        <h1 className="text-3xl font-black text-brand-ink mt-2">Doplň webové Supabase klíče</h1>
        <p className="text-[#5C5474] leading-7 mt-3">Pro přihlášení je potřeba vyplnit NEXT_PUBLIC_SUPABASE_URL a NEXT_PUBLIC_SUPABASE_ANON_KEY ve web/.env.local.</p>
      </div>
    </main>
  );
}

type DbRow = Record<string, unknown>;

function mapParticipantRow(row: DbRow): ParentParticipant {
  return {
    id: text(row.id),
    firstName: text(row.first_name, 'Účastník'),
    lastName: text(row.last_name),
    claimCode: text(row.claim_code, ''),
    level: numberValue(row.level, 1),
    bracelet: text(row.bracelet, 'bílý'),
    braceletColor: text(row.bracelet_color, '#8B5CF6'),
    xp: numberValue(row.xp, 0),
    nextBraceletXp: numberValue(row.next_bracelet_xp, 100),
    attendanceDone: numberValue(row.attendance_done, 0),
    attendanceTotal: numberValue(row.attendance_total, 0),
    activeCourse: text(row.active_course, 'Bez aktivního kurzu'),
    nextTraining: text(row.next_training, 'Doplní se po zařazení'),
    activePurchases: arrayValue(row.active_purchases).map((purchase) => ({
      type: activityTypeFromDb((purchase as DbRow).type),
      title: text((purchase as DbRow).title, 'Produkt'),
      status: text((purchase as DbRow).status, 'Aktivní'),
    })),
  };
}

function mapProductRow(row: DbRow, interestCounts: Map<string, number> = new Map(), orgNameById: Map<string, string> = new Map()): ParentProduct {
  const fallback = parentProducts.find((product) => product.id === row.id);
  const type = activityTypeFromDb(row.type);
  const title = text(row.title, fallback?.title || 'TeamVYS produkt');
  const price = numberValue(row.price, fallback?.price || 0);
  const orgId = text(row.org_id);

  return {
    id: text(row.id),
    type,
    title,
    orgId: orgId || undefined,
    orgName: String((row.organizations as DbRow | undefined)?.name || '') || (orgId ? orgNameById.get(orgId) : undefined) || undefined,
    city: text(row.city, fallback?.city || ''),
    place: text(row.place, fallback?.place || ''),
    venue: text(row.venue, fallback?.venue || text(row.place)),
    price,
    priceLabel: text(row.price_label, fallback?.priceLabel || `${price} Kč`),
    originalPrice: optionalNumber(row.original_price, fallback?.originalPrice),
    entriesTotal: optionalNumber(row.entries_total, fallback?.entriesTotal),
    capacityTotal: numberValue(row.capacity_total, fallback?.capacityTotal || 0),
    capacityCurrent: numberValue(row.capacity_current, fallback?.capacityCurrent || 0),
    interestCount: type === 'Workshop' ? interestCounts.get(text(row.id)) ?? numberValue(row.interest_count, fallback?.interestCount || 0) : 0,
    canPurchase: typeof row.can_purchase === 'boolean' ? row.can_purchase : fallback?.canPurchase,
    primaryMeta: text(row.primary_meta, fallback?.primaryMeta || ''),
    secondaryMeta: text(row.secondary_meta, fallback?.secondaryMeta || 'QR ticket po zaplacení'),
    description: text(row.description, fallback?.description || ''),
    badge: text(row.badge, fallback?.badge || activityTypeLabel(type)),
    heroImage: text(row.hero_image, fallback?.heroImage || '/vys-logo-mark.png'),
    gallery: stringArray(row.gallery, fallback?.gallery || ['/vys-logo-mark.png']),
    coachIds: stringArray(row.coach_ids, fallback?.coachIds || []),
    importantInfo: typedArray<ParentProduct['importantInfo'][number]>(row.important_info, fallback?.importantInfo || []),
    trainingFocus: stringArray(row.training_focus, fallback?.trainingFocus || []),
  };
}

function workshopInterestCounts(rows: DbRow[]): Map<string, number> {
  const byProduct = new Map<string, Set<string>>();
  for (const row of rows) {
    const productId = text(row.product_id);
    if (!productId) continue;
    const participantKey = text(row.participant_id) || text(row.participant_name) || text(row.id);
    if (!participantKey) continue;
    if (!byProduct.has(productId)) byProduct.set(productId, new Set());
    byProduct.get(productId)?.add(participantKey);
  }

  return new Map(Array.from(byProduct.entries()).map(([productId, participants]) => [productId, participants.size]));
}

// Deduplicate payments that exist in both `parent_purchases` (Stripe) and
// `parent_payments` (manual/admin) for the same product+participant+amount, so
// the parent doesn't see each paid course listed twice.
function dedupePayments(payments: ParentPayment[]): ParentPayment[] {
  const seen = new Map<string, ParentPayment>();
  for (const payment of payments) {
    const key = `${payment.title.trim().toLowerCase()}|${payment.participantName.trim().toLowerCase()}|${payment.amount}`;
    const existing = seen.get(key);
    // Prefer the row that is already marked paid over a pending duplicate.
    if (!existing || (existing.status !== 'paid' && payment.status === 'paid')) {
      seen.set(key, payment);
    }
  }
  return Array.from(seen.values());
}

function mapPurchaseRow(row: DbRow): ParentPayment {
  const paidAt = text(row.paid_at, formatDateCz(row.created_at));
  return {
    id: text(row.id),
    title: text(row.title, 'Platba TeamVYS'),
    participantName: text(row.participant_name, 'Účastník'),
    amount: numberValue(row.amount, 0),
    dueDate: paidAt,
    paidAt,
    method: text(row.stripe_payment_intent_id) ? 'Stripe karta' : 'Supabase',
    status: paymentStatusFromPurchase(row.status),
    trainingDays: Array.isArray(row.training_days) && row.training_days.length > 0 ? row.training_days.map((day) => String(day)) : undefined,
  };
}

function mapPaymentRow(row: DbRow): ParentPayment {
  return {
    id: text(row.id),
    title: text(row.title, 'Platba TeamVYS'),
    participantName: text(row.participant_name, 'Účastník'),
    amount: numberValue(row.amount, 0),
    dueDate: text(row.due_date, formatDateCz(row.created_at)),
    paidAt: text(row.status) === 'paid' ? text(row.due_date, formatDateCz(row.created_at)) : 'Čeká na úhradu',
    method: text(row.stripe_ready) ? 'Stripe karta' : 'Supabase',
    status: paymentStatusFromDb(row.status),
  };
}

function mapDocumentRow(row: DbRow): ParentDocument {
  return {
    id: text(row.id),
    participantName: text(row.participant_name, 'Účastník'),
    activityTitle: text(row.title, 'Dokument'),
    activityType: activityTypeFromDb(row.activity_type),
    title: text(row.title, 'Dokument'),
    status: documentStatusFromDb(row.status),
    updatedAt: text(row.updated_at_text, formatDateCz(row.updated_at)),
  };
}

function activityTypeFromDb(value: unknown): ActivityType {
  const normalized = text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized.includes('tabor')) return 'Tabor';
  if (normalized.includes('workshop')) return 'Workshop';
  return 'Krouzek';
}

function activityTypeLabel(type: ActivityType) {
  if (type === 'Tabor') return 'Tábor';
  if (type === 'Workshop') return 'Workshop';
  return 'Kroužek';
}

function paymentStatusFromDb(value: unknown): PaymentStatus {
  const status = text(value).toLowerCase();
  if (status === 'paid') return 'paid';
  if (status === 'overdue') return 'overdue';
  return 'due';
}

function paymentStatusFromPurchase(value: unknown): PaymentStatus {
  const normalized = text(value).toLowerCase();
  if (normalized.includes('zaplaceno')) return 'paid';
  if (normalized.includes('selhala') || normalized.includes('overdue')) return 'overdue';
  return 'due';
}

function documentStatusFromDb(value: unknown): DocumentStatus {
  const status = text(value).toLowerCase();
  if (status === 'signed') return 'signed';
  if (status === 'draft') return 'draft';
  return 'missing';
}

function findParticipantNameInText(textValue: string, names: Set<string>) {
  return Array.from(names).find((name) => textValue.includes(name));
}

function formatDateCz(value: unknown) {
  const date = value ? new Date(String(value)) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toLocaleDateString('cs-CZ');
  return date.toLocaleDateString('cs-CZ');
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value: unknown, fallback?: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function typedArray<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? value as T[] : fallback;
}

function stringArray(value: unknown, fallback: string[]) {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  return fallback;
}

function nameFromEmail(email?: string | null) {
  const prefix = email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
  return prefix ? prefix.replace(/\b\w/g, (letter) => letter.toUpperCase()) : '';
}

function isDemoParentName(value?: string | null) {
  const normalized = value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  return normalized === 'david kropac' || normalized === 'testovaci rodic';
}