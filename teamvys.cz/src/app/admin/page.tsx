import { redirect } from 'next/navigation';

import { AdminDashboard, type AdminFinanceResponse } from '@/components/admin/admin-dashboard';
import { OrgStripeConnectCard } from '@/components/admin/org-stripe-connect-card';
import { DEV_BYPASS_AUTH } from '@/lib/dev-config';
import type { AdminCoachAccessRequest, AdminCoachSummary } from '@/lib/portal-content';
import { createAdminSupabaseClient, hasSupabaseAdminConfig } from '@/lib/supabase/admin';
import { createServerSupabaseClient, hasSupabaseServerConfig } from '@/lib/supabase/server';
import { type FeatureFlags, parseFeatureFlags } from '@shared/feature-flags';

export const metadata = {
  title: 'Admin',
};

export const dynamic = 'force-dynamic';

const VYS_ORG_ID = '00000000-0000-4000-8000-000000000001';

export default async function AdminPage() {
  let showSignOut = false;
  let coachData: { summaries: AdminCoachSummary[] | null; requests: AdminCoachAccessRequest[] | null } = { summaries: [], requests: [] };

  if (!DEV_BYPASS_AUTH) {
    if (!hasSupabaseServerConfig()) return <ConfigMissing />;

    const supabase = await createServerSupabaseClient();
    const { data: sessionResult } = await supabase.auth.getSession();
    const { data: userResult } = await supabase.auth.getUser();
    const user = userResult.user;
    if (!user) redirect('/admin/prihlaseni?next=/admin');

    const { data: profile } = await supabase.from('app_profiles').select('role,name,email,super_admin,org_id').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'admin') redirect('/rodic');
    showSignOut = true;
    const adminOrgId = profile?.org_id || VYS_ORG_ID;
    const { data: orgData } = await supabase.from('organizations').select('name,logo_url').eq('id', adminOrgId).maybeSingle();
    const orgName = orgData?.name ?? null;
    let orgLogoUrl: string | null = null;
    if (orgData?.logo_url) {
      const { data: logoPublicData } = supabase.storage.from('org-assets').getPublicUrl(orgData.logo_url);
      orgLogoUrl = logoPublicData?.publicUrl ?? null;
    }
    const initialFlags = await loadOrgFeatureFlags(hasSupabaseAdminConfig() ? createAdminSupabaseClient() : supabase, adminOrgId);
    coachData = await loadAdminCoachData(hasSupabaseAdminConfig() ? createAdminSupabaseClient() : supabase, adminOrgId);
    const finance = await loadFinance(sessionResult.session?.access_token);

    return (
      <main className="min-h-dvh bg-brand-paper px-4 py-6 text-brand-ink texture-grid md:px-6 md:py-8">
        <div className="mx-auto max-w-[1280px]">
          <OrgStripeConnectCard />
          <AdminDashboard finance={finance.data} financeError={finance.error} showSignOut={showSignOut} devMode={DEV_BYPASS_AUTH} superAdmin={profile?.super_admin === true} initialCoachSummaries={coachData.summaries} initialCoachAccessRequests={coachData.requests} initialFlags={initialFlags.flags} initialFlagsOrgId={initialFlags.orgId} initialFlagsSubscriptionStatus={initialFlags.subscriptionStatus} orgName={orgName} orgLogoUrl={orgLogoUrl} orgId={adminOrgId} />
        </div>
      </main>
    );
  }

  if (hasSupabaseAdminConfig()) {
    coachData = await loadAdminCoachData(createAdminSupabaseClient(), VYS_ORG_ID);
  }

  const finance = await loadFinance();

  return (
    <main className="min-h-dvh bg-brand-paper px-4 py-6 text-brand-ink texture-grid md:px-6 md:py-8">
      <div className="mx-auto max-w-[1280px]">
        <AdminDashboard finance={finance.data} financeError={finance.error} showSignOut={showSignOut} devMode={DEV_BYPASS_AUTH} initialCoachSummaries={coachData.summaries} initialCoachAccessRequests={coachData.requests} />
      </div>
    </main>
  );
}

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>> | ReturnType<typeof createAdminSupabaseClient>;

async function loadOrgFeatureFlags(supabase: SupabaseClient, orgId: string): Promise<{ flags: FeatureFlags; orgId: string; subscriptionStatus: string | null }> {
  const { data } = await supabase
    .from('organizations')
    .select('org_type, feature_flags, subscription_status')
    .eq('id', orgId)
    .maybeSingle();
  const flags = parseFeatureFlags(data?.feature_flags, data?.org_type as string | null | undefined);
  return { flags, orgId, subscriptionStatus: (data?.subscription_status as string | null) ?? null };
}

type CoachProfileRow = {
  id: string;
  level: number | null;
  xp: number | null;
  qr_tricks_approved: number | null;
  attendance_logged: number | null;
  bonus_total: number | null;
  current_location: string | null;
  assigned_courses: string[] | null;
  profile_photo_url: string | null;
  stripe_account_id: string | null;
  approval_status: 'pending' | 'approved' | 'rejected' | 'suspended' | null;
  approval_requested_at: string | null;
  bank_account: string | null;
  iban: string | null;
  payout_account_holder: string | null;
  payout_note: string | null;
};

type AppProfileRow = {
  id: string;
  role: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  created_at: string | null;
};

type CoachPayoutRow = {
  coach_id: string;
  logged_hours: number | null;
  base_amount: number | null;
  approved_bonuses: number | null;
  pending_bonuses: number | null;
  next_payout: string | null;
  status: string | null;
};

type CoachAttendanceRow = {
  coach_id: string;
  date_text: string | null;
  created_at: string | null;
};

async function loadAdminCoachData(supabase: SupabaseClient, orgId: string): Promise<{ summaries: AdminCoachSummary[] | null; requests: AdminCoachAccessRequest[] | null }> {
  const [coachResult, coachProfilesResult] = await Promise.all([
    supabase
      .from('coach_profiles')
      .select('id,level,xp,qr_tricks_approved,attendance_logged,bonus_total,current_location,assigned_courses,profile_photo_url,stripe_account_id,approval_status,approval_requested_at,bank_account,iban,payout_account_holder,payout_note')
      .eq('org_id', orgId)
      .order('approval_requested_at', { ascending: false }),
    supabase
      .from('app_profiles')
      .select('id,role,name,email,phone,bio,created_at')
      .eq('role', 'coach')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false }),
  ]);

  const coachRows = Array.isArray(coachResult.data) ? (coachResult.data as CoachProfileRow[]).filter((row) => !isDemoAdminId(row.id)) : [];
  const profileRows = Array.isArray(coachProfilesResult.data) ? (coachProfilesResult.data as AppProfileRow[]).filter((row) => !isDemoAdminId(row.id, row.name, row.email)) : [];
  if ((coachResult.error || coachProfilesResult.error) && coachRows.length === 0 && profileRows.length === 0) return { summaries: [], requests: [] };

  const coachById = new Map(coachRows.map((row) => [row.id, row]));
  const profiles = new Map(profileRows.map((profile) => [profile.id, profile]));
  const ids = Array.from(new Set([...coachRows.map((row) => row.id), ...profileRows.map((profile) => profile.id)]));
  type AuthMetaRow = { id: string; full_name: string | null; phone: string | null; email: string | null };
  const [profilesResult, payoutsResult, attendanceResult, authMetaResult] = await Promise.all([
    ids.length > 0 ? supabase.from('app_profiles').select('id,role,name,email,phone,bio,created_at').in('id', ids) : Promise.resolve({ data: [] }),
    ids.length > 0 ? supabase.from('coach_payouts').select('coach_id,logged_hours,base_amount,approved_bonuses,pending_bonuses,next_payout,status').in('coach_id', ids) : Promise.resolve({ data: [] }),
    ids.length > 0 ? supabase.from('coach_attendance_records').select('coach_id,date_text,created_at').in('coach_id', ids).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
    ids.length > 0
      ? supabase.rpc('teamvys_get_coach_auth_meta', { p_coach_ids: ids }).returns<AuthMetaRow[]>()
      : Promise.resolve({ data: [] as AuthMetaRow[] }),
  ]);

  // Build a map of auth metadata (name/phone from auth.users)
  const authMeta = new Map<string, AuthMetaRow>();
  for (const row of ((authMetaResult as { data: AuthMetaRow[] | null }).data ?? []) as AuthMetaRow[]) {
    authMeta.set(row.id, row);
  }

  for (const profile of (profilesResult.data ?? []) as AppProfileRow[]) {
    // Enrich with auth metadata when app_profiles name is missing or equals the email
    const meta = authMeta.get(profile.id);
    if (meta) {
      if (!profile.name || profile.name === profile.email) profile.name = meta.full_name ?? profile.name;
      if (!profile.phone) profile.phone = meta.phone;
    }
    profiles.set(profile.id, profile);
  }

  // For coaches that have auth meta but no app_profiles row yet, synthesize one
  for (const [id, meta] of authMeta.entries()) {
    if (!profiles.has(id)) {
      profiles.set(id, { id, role: 'coach', name: meta.full_name, email: meta.email, phone: meta.phone, bio: null, created_at: null });
    }
  }
  const payouts = new Map(((payoutsResult.data ?? []) as CoachPayoutRow[]).map((payout) => [payout.coach_id, payout]));
  const lastAttendance = new Map<string, CoachAttendanceRow>();
  for (const row of (attendanceResult.data ?? []) as CoachAttendanceRow[]) {
    if (!lastAttendance.has(row.coach_id)) lastAttendance.set(row.coach_id, row);
  }

  const orderedIds = ids.sort((a, b) => {
    const aDate = coachById.get(a)?.approval_requested_at || profiles.get(a)?.created_at || '';
    const bDate = coachById.get(b)?.approval_requested_at || profiles.get(b)?.created_at || '';
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  const summaries = orderedIds.map((id) => {
    const row = coachById.get(id);
    const profile = profiles.get(id);
    const payout = payouts.get(id);
    const approvalStatus = normalizeApprovalStatus(row?.approval_status);
    const locations = uniqueStrings([row?.current_location, ...(Array.isArray(row?.assigned_courses) ? row.assigned_courses : [])]);

    return {
      id,
      name: profile?.name || profile?.email || 'Trenér Team VYS',
      email: profile?.email || '',
      phone: profile?.phone || '',
      bankAccount: row?.bank_account || 'není vyplněn',
      iban: row?.iban || undefined,
      payoutAccountHolder: row?.payout_account_holder || undefined,
      payoutNote: row?.payout_note || undefined,
      approvalStatus,
      status: coachStatusFromApproval(approvalStatus),
      level: Number(row?.level ?? 1),
      xp: Number(row?.xp ?? 0),
      locations: locations.length > 0 ? locations : ['Čeká na přiřazení'],
      loggedHours: Number(payout?.logged_hours ?? row?.attendance_logged ?? 0),
      baseAmount: Number(payout?.base_amount ?? 0),
      approvedBonuses: Number(payout?.approved_bonuses ?? row?.bonus_total ?? 0),
      pendingBonuses: Number(payout?.pending_bonuses ?? 0),
      nextPayout: payout?.next_payout ? formatAdminDate(payout.next_payout) : approvalStatus === 'approved' ? 'Po první docházce' : 'Po schválení',
      lastAttendance: lastAttendance.get(id)?.date_text || (lastAttendance.get(id)?.created_at ? formatAdminDate(lastAttendance.get(id)?.created_at ?? '') : 'Zatím bez zápisu'),
      childrenLogged: 0,
      qrTricksApproved: Number(row?.qr_tricks_approved ?? 0),
      profilePhotoUrl: row?.profile_photo_url || '/vys-logo-mark.png',
      stripeAccountId: row?.stripe_account_id || undefined,
    } satisfies AdminCoachSummary;
  });

  const requests = orderedIds
    .filter((id) => normalizeApprovalStatus(coachById.get(id)?.approval_status) === 'pending')
    .map((id) => {
      const row = coachById.get(id);
      const profile = profiles.get(id);
      const locations = uniqueStrings([row?.current_location, ...(Array.isArray(row?.assigned_courses) ? row.assigned_courses : [])]);
      return {
        id: `coach-approval-${id}`,
        coachId: id,
        name: profile?.name || profile?.email || 'Trenér Team VYS',
        email: profile?.email || '',
        phone: profile?.phone || '',
        requestedLocation: locations[0] || 'Čeká na přiřazení',
        requestedAt: formatAdminDate(row?.approval_requested_at || profile?.created_at || ''),
        note: profile?.bio || 'Bez doplňující poznámky.',
        approvalStatus: 'pending',
      } satisfies AdminCoachAccessRequest;
    });

  return { summaries, requests };
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function normalizeApprovalStatus(status: CoachProfileRow['approval_status'] | undefined): NonNullable<CoachProfileRow['approval_status']> {
  return status === 'approved' || status === 'rejected' || status === 'suspended' || status === 'pending' ? status : 'pending';
}

function coachStatusFromApproval(status: CoachProfileRow['approval_status']): AdminCoachSummary['status'] {
  if (status === 'approved') return 'Aktivni';
  if (status === 'rejected' || status === 'suspended') return 'Pozastaveny';
  return 'Ceka na klic';
}

function formatAdminDate(value: string) {
  if (!value) return 'Teď';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

function isDemoAdminId(...values: Array<string | null | undefined>) {
  return values.some((value) => {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === 'coach-demo'
      || normalized === 'parent-demo'
      || normalized === 'participant-demo'
      || normalized === 'admin-demo'
      || normalized.startsWith('demo-')
      || normalized.includes('-demo-')
      || normalized.includes('filip trenér')
      || normalized.includes('filip trener');
  });
}

async function loadFinance(accessToken?: string): Promise<{ data: AdminFinanceResponse | null; error: string | null }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://server-psi-ochre-40.vercel.app';

  try {
    const response = await fetch(`${apiUrl}/api/admin/finance`, {
      cache: 'no-store',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return { data: null, error: payload.error || `HTTP ${response.status}` };
    return { data: payload, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Backend není dostupný.' };
  }
}

function ConfigMissing() {
  return (
    <main className="min-h-dvh bg-brand-paper px-6 py-12">
      <div className="mx-auto max-w-[760px] rounded-brand-lg border bg-white p-7" style={{ borderColor: 'rgba(20,14,38,0.08)', boxShadow: 'var(--shadow-card)' }}>
        <p className="text-brand-pink text-xs font-black uppercase tracking-[0.16em]">Chybí Supabase env</p>
        <h1 className="text-3xl font-black text-brand-ink mt-2">Doplň webové Supabase klíče</h1>
        <p className="text-[#5C5474] leading-7 mt-3">Admin stránka potřebuje NEXT_PUBLIC_SUPABASE_URL a NEXT_PUBLIC_SUPABASE_ANON_KEY ve web/.env.local.</p>
      </div>
    </main>
  );
}