'use client';

import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Banknote,
    BarChart2,
    Bell,
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    ClipboardList,
    Download,
    Eye,
    FileCheck2,
    FileDown,
    FileText,
    FileUp,
    Film,
    Gauge,
    History,
    ImagePlus,
    LayoutDashboard,
    ListChecks,
    Mail,
    MapPin,
    Megaphone,
    Menu,
    PackagePlus,
    PenLine,
    Pencil,
    Phone,
    Plus,
    Receipt,
    Search,
    Send,
    ShieldCheck,
    Trash2,
    TrendingDown,
    TrendingUp,
    Trophy,
    UserCheck,
    Users,
    X
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { AdminBroadcastsSection } from '@/components/admin/admin-broadcasts';
import { CoachDocumentAssignCard } from '@/components/admin/coach-document-assign-card';
import { LocationPickerMap, type LocationPickerMapHandle } from '@/components/admin/location-picker-map';
import { OrgDocumentTemplatesCard } from '@/components/admin/org-document-templates-card';
import { OrgDppTemplateCard } from '@/components/admin/org-dpp-template-card';
import { ProductDocumentSlotsCard } from '@/components/admin/product-document-slots-card';
import { TrickVotingCard } from '@/components/admin/trick-voting-card';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { TeamVysLogo } from '@/components/brand/team-vys-logo';
import { useAdminCreatedProducts, type AdminProductInput, type TurnusInput } from '@/lib/admin-created-products';
import { createAdminInvoice, createAdminInvoiceUploadUrl, createCoachStripeOnboarding, createProductVideoUploadUrl, deleteAdminInvoice, getOrgDppTemplate, loadAdminInvoices, saveCoachAttendance, sendTrainerPayout, updateAdminInvoicePayment, type AdminInvoiceInput, type AdminInvoiceRow, type OrgDppTemplate, type TrainerPayoutTransfer } from '@/lib/api-client';
import {
    CAMP_DAILY_RATE,
    CAMP_MAX_COACHES,
    WORKSHOP_HOURLY_RATE,
    WORKSHOP_MAX_COACHES,
    activityLabel,
    adminActivityRows,
    currency,
    documentStatusLabel,
    requiredDocumentsForProduct,
    type ActivityType,
    type AdminCoachAccessRequest,
    type AdminCoachDppDocument,
    type AdminCoachSummary,
    type CampTurnus,
    type CoachDppStatus,
    type DocumentStatus,
    type ParentDocument,
    type ParentParticipant,
    type ParentProduct,
    type SharedTrainingSlot,
    type WorkshopAttendanceRecord,
    type WorkshopCity,
    type WorkshopSlot
} from '@/lib/portal-content';
import { normalizeDayName, parseScheduleDays } from '@/lib/schedule-days';
import { createBrowserSupabaseClient, hasSupabaseBrowserConfig } from '@/lib/supabase/browser';
import { seedFeatureFlags, useFeatureFlags } from '@/lib/use-feature-flags';
import { WORKSHOP_TRICK_LEVELS } from '@/lib/workshop-tricks';
import type { FeatureFlags } from '@shared/feature-flags';

export type AdminFinanceResponse = {
  purchases?: Array<{ id: string; type: string; title: string; participant_name: string; amount: number; status: string; paid_at: string }>;
  payoutTransfers?: AdminFinanceTransfer[];
  coaches?: Array<{ id: string; level: number; xp: number; qr_tricks_approved: number; stripe_account_id: string | null }>;
};

type AdminFinanceTransfer = {
  id: string;
  coach_id?: string;
  coach_name: string;
  amount: number;
  period_key: string;
  status: string;
  created_at_text?: string;
  stripe_transfer_id?: string | null;
};

type AdminParticipantRow = {
  id: string;
  parent_profile_id: string | null;
  first_name: string | null;
  last_name: string | null;
  claim_code: string | null;
  level: number | null;
  xp: number | null;
  next_bracelet_xp: number | null;
  attendance_done: number | null;
  attendance_total: number | null;
  active_course: string | null;
  next_training: string | null;
  active_purchases: Array<{ type?: ActivityType | string; title?: string; status?: string }> | null;
  bracelet: string | null;
  bracelet_color: string | null;
  paid_status: string | null;
  extra_courses: string[] | null;
};

type AdminPurchaseRow = {
  id: string;
  parent_profile_id?: string | null;
  product_id: string;
  participant_id: string;
  participant_name: string;
  type: string;
  title: string;
  amount?: number;
  status: string;
  expires_at?: string | null;
  training_days?: string[] | null;
};

type AdminParentProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

type AdminParticipant = ParentParticipant & {
  parentProfileId?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  extraCourses?: string[];
  passRemainingEntries?: number;
  passTotalEntries?: number;
  passUsedEntries?: number;
  courseExpiresAt?: string | null;
};

type AdminDocument = ParentDocument & {
  participantId: string;
  productId: string;
  purchaseId: string;
  kind: string;
  coursePlace: string;
  scanPath?: string | null;
  scanFilename?: string | null;
};

type AdminDocumentRow = {
  id: string;
  participant_id: string;
  participant_name: string | null;
  purchase_id: string | null;
  product_id: string | null;
  activity_type: string | null;
  kind: string | null;
  title: string | null;
  status: string | null;
  course_place: string | null;
  scan_path: string | null;
  scan_filename: string | null;
  updated_at_text: string | null;
  updated_at: string | null;
};

type AdminDashboardProps = {
  finance: AdminFinanceResponse | null;
  financeError: string | null;
  showSignOut: boolean;
  devMode: boolean;
  superAdmin?: boolean;
  initialCoachSummaries?: AdminCoachSummary[] | null;
  initialCoachAccessRequests?: AdminCoachAccessRequest[] | null;
  initialFlags?: FeatureFlags;
  initialFlagsOrgId?: string | null;
  initialFlagsSubscriptionStatus?: string | null;
  orgName?: string | null;
  orgLogoUrl?: string | null;
  orgId?: string | null;
};

type SectionKey = 'overview' | 'attendance' | 'participants' | 'registry' | 'products' | 'documents' | 'messages' | 'voting' | 'coaches' | 'payouts' | 'invoices' | 'finance';

type Invoice = {
  id: string;
  supplier: string;
  description: string;
  amount: number;
  issuedDate: string;
  dueDate: string;
  paid: boolean;
  paidDate?: string;
  category: string;
  fileUrl?: string;
  coachId?: string;
  source?: string;
};

type AdminPaymentRow = {
  id: string;
  type: string;
  title: string;
  participantName: string;
  amount: number;
  status: string;
  dueDate: string;
};

type CoachAttendanceRecord = {
  id: string;
  coachId?: string;
  coachName: string;
  sessionTitle: string;
  date: string;
  present?: string;
  durationHours: number;
  amount: number;
  reason: string;
  source: 'coach' | 'admin';
};

type ManualCoachAttendanceInput = {
  coachId: string;
  coachName: string;
  sessionTitle: string;
  date: string;
  present?: string;
  durationHours: number;
  hourlyRate: number;
  reason: string;
};

type ChildAttendanceRecord = {
  id: string;
  sessionId: string | null;
  dateKey: string;
  location: string;
  attendees: { name: string; time?: string; method?: string }[];
};

type ParticipantGroup = {
  key: string;
  type: ActivityType;
  title: string;
  place: string;
  product: ParentProduct;
  participants: ParentParticipant[];
};

type ParticipantCityGroup = {
  key: string;
  city: string;
  groups: ParticipantGroup[];
  participantCount: number;
  missingDocuments: number;
};

type ParticipantTermGroup = {
  key: string;
  term: string;
  groups: ParticipantGroup[];
  participantCount: number;
  missingDocuments: number;
};

type ParticipantDetailState = {
  participant: ParentParticipant;
  activityType: ActivityType;
  place: string;
};

type ParticipantDetailTab = 'documents' | 'attendance' | 'skills' | 'contacts' | 'products';
type CoachDetailTab = 'overview' | 'finance' | 'assignment' | 'attendance';

type ActivityParticipantRecord = {
  id: string;
  name: string;
  subtitle: string;
  level: string;
  attendance: string;
  documents: string;
  parentContact: string;
  participant?: ParentParticipant;
};

type ActivityCoachPresence = {
  id: string;
  name: string;
  detail: string;
  source: 'attendance' | 'assigned';
};

type CoachPlacementGroup = {
  key: string;
  type: ActivityType;
  title: string;
  place: string;
  primaryMeta: string;
  coaches: AdminCoachSummary[];
};

const VYS_ORG_ID = '00000000-0000-4000-8000-000000000001';

const sections: Array<{ key: SectionKey; label: string; description: string; icon: ReactNode }> = [
  { key: 'overview', label: 'Přehled', description: 'co hoří', icon: <LayoutDashboard size={18} /> },
  { key: 'attendance', label: 'Docházka', description: 'kroužky a děti', icon: <ClipboardList size={18} /> },
  { key: 'participants', label: 'Účastníci', description: 'celý seznam', icon: <Users size={18} /> },
  { key: 'registry', label: 'Registr', description: 'všichni ever', icon: <ListChecks size={18} /> },
  { key: 'products', label: 'Produkty', description: 'nabídka webu', icon: <PackagePlus size={18} /> },
  { key: 'documents', label: 'Dokumenty', description: 'šablony k produktům', icon: <FileText size={18} /> },
  { key: 'messages', label: 'Zprávy', description: 'oznámení rodičům', icon: <Megaphone size={18} /> },
  { key: 'voting', label: 'Hlasování', description: 'triky týdne', icon: <Trophy size={18} /> },
  { key: 'coaches', label: 'Trenéři', description: 'data a výkon', icon: <UserCheck size={18} /> },
  { key: 'payouts', label: 'Výplaty', description: 'Stripe výplaty', icon: <Banknote size={18} /> },
  { key: 'invoices', label: 'Faktury', description: 'výdaje a platby', icon: <Receipt size={18} /> },
  { key: 'finance', label: 'Finance', description: 'cash flow přehled', icon: <TrendingUp size={18} /> },
];

const CZECH_MONTHS = ['leden','únor','březen','duben','květen','červen','červenec','srpen','září','říjen','listopad','prosinec'];

function computePayoutPeriod(offsetFromPrevMonth: number) {
  const now = new Date();
  // offset 0 = last completed month (default)
  const t = new Date(now.getFullYear(), now.getMonth() - 1 + offsetFromPrevMonth, 1);
  const y = t.getFullYear();
  const m = t.getMonth() + 1; // 1-12
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = new Date(y, m, 0).getDate();
  return {
    key: `${y}-${pad(m)}`,
    label: `${CZECH_MONTHS[m - 1]} ${y}`,
    periodStart: `${y}-${pad(m)}-01`,
    periodEnd: `${y}-${pad(m)}-${pad(lastDay)}`,
  };
}

export function AdminDashboard({ finance, financeError, showSignOut, devMode, superAdmin = false, initialCoachSummaries, initialCoachAccessRequests, initialFlags, initialFlagsOrgId = null, initialFlagsSubscriptionStatus = null, orgName, orgLogoUrl, orgId }: AdminDashboardProps) {
  // Seed feature flags synchronously from server-rendered values so nested
  // components never fall back to the VYS defaults when the client-side RLS
  // embed fails for external orgs. Runs once, before children render.
  useState(() => {
    if (initialFlags) seedFeatureFlags(initialFlags, initialFlagsOrgId, initialFlagsSubscriptionStatus);
    return null;
  });
  const [activeSection, setActiveSection] = useState<SectionKey>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(orgLogoUrl ?? null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  async function handleLogoUpload(file: File) {
    if (!hasSupabaseBrowserConfig()) return;
    setLogoUploading(true);
    setLogoError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setLogoError('Nejsi přihlášený.'); return; }

      const form = new FormData();
      form.append('file', file);

      const res = await fetch('/api/admin/org-logo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json().catch(() => ({})) as { publicUrl?: string; error?: string };
      if (!res.ok || !json.publicUrl) {
        setLogoError(json.error ?? 'Nepodařilo se nahrát logo.');
        return;
      }
      setLogoUrl(json.publicUrl);
    } catch (e) {
      setLogoError(e instanceof Error ? e.message : 'Chyba při nahrávání.');
    } finally {
      setLogoUploading(false);
    }
  }
  const [attendanceQuery, setAttendanceQuery] = useState('');
  const [payoutMessage, setPayoutMessage] = useState<string | null>(null);
  const [payingCoachId, setPayingCoachId] = useState<string | null>(null);
  const [payoutPeriodOffset, setPayoutPeriodOffset] = useState(0); // 0 = last completed month
  const payoutPeriod = useMemo(() => computePayoutPeriod(payoutPeriodOffset), [payoutPeriodOffset]);
  const [transfers, setTransfers] = useState<TrainerPayoutTransfer[]>(() => normalizeFinanceTransfers(finance?.payoutTransfers ?? []));
  const [onboardingLinks, setOnboardingLinks] = useState<Record<string, string>>({});
  const [generatingOnboarding, setGeneratingOnboarding] = useState<string | null>(null);
  const [coachAttendanceRecords, setCoachAttendanceRecords] = useState<CoachAttendanceRecord[]>(() => buildInitialCoachAttendanceRecords());
  const [childAttendanceRecords, setChildAttendanceRecords] = useState<ChildAttendanceRecord[]>([]);
  const [coachDppDocuments, setCoachDppDocuments] = useState<AdminCoachDppDocument[]>([]);
  const [orgDppTemplate, setOrgDppTemplate] = useState<OrgDppTemplate | null>(null);
  const [keyRequests, setKeyRequests] = useState<AdminCoachAccessRequest[]>(() => initialCoachAccessRequests ?? []);
  const [liveCoachSummaries, setLiveCoachSummaries] = useState<AdminCoachSummary[] | null>(() => initialCoachSummaries ?? []);
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(null);
  const [selectedActivityDetail, setSelectedActivityDetail] = useState<ReturnType<typeof adminActivityRows>[number] | null>(null);
  const [selectedParticipantDetail, setSelectedParticipantDetail] = useState<ParticipantDetailState | null>(null);
  const { products: adminCreatedProducts, loading: productsLoading, error: productsError, addProduct: addAdminCreatedProduct, removeProduct: removeAdminCreatedProduct, updateProduct: updateAdminProduct } = useAdminCreatedProducts('admin');
  const [liveParticipants, setLiveParticipants] = useState<AdminParticipant[]>([]);
  const [liveDocuments, setLiveDocuments] = useState<AdminDocument[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceMessage, setInvoiceMessage] = useState<string | null>(null);

  useEffect(() => {
    getOrgDppTemplate().then(setOrgDppTemplate).catch(() => {});
  }, []);

  const allProducts = useMemo(() => adminCreatedProducts, [adminCreatedProducts]);
  const paymentRows = useMemo(() => buildPaymentRows(finance), [finance]);
  const activityRows = useMemo(() => buildLiveActivityRows(allProducts, liveParticipants, paymentRows), [allProducts, liveParticipants, paymentRows]);
  const coaches = useMemo(() => mergeCoachData(finance, liveCoachSummaries), [finance, liveCoachSummaries]);
  const sharedTrainingSlots = useMemo(() => buildSharedTrainingSlots(allProducts, coaches), [allProducts, coaches]);
  const workshopSlots = useMemo(() => buildWorkshopSlots(allProducts, coaches), [allProducts, coaches]);
  const campTurnusyState = useMemo(() => buildCampTurnusy(allProducts, coaches), [allProducts, coaches]);
  const workshopAttendanceRecords = useMemo(() => buildWorkshopAttendanceRecords(workshopSlots, allProducts, liveParticipants), [workshopSlots, allProducts, liveParticipants]);
  const totals = useMemo(() => buildTotals(paymentRows, activityRows, coaches, transfers, coachAttendanceRecords, liveParticipants, liveDocuments), [paymentRows, activityRows, coaches, transfers, coachAttendanceRecords, liveParticipants, liveDocuments]);
  const currentSection = sections.find((section) => section.key === activeSection) ?? sections[0];
  const isVysOrg = !orgId || orgId === VYS_ORG_ID;
  const visibleSections = isVysOrg ? sections : sections.filter((section) => section.key !== 'voting');

  useEffect(() => {
    let cancelled = false;
    void loadAdminParticipants(allProducts).then((participants) => {
      if (!cancelled) setLiveParticipants(participants);
    });
    return () => { cancelled = true; };
  }, [allProducts]);

  useEffect(() => {
    let cancelled = false;
    void loadChildAttendanceRecords().then((records) => {
      if (!cancelled) setChildAttendanceRecords(records);
    }).catch(() => {
      if (!cancelled) setChildAttendanceRecords([]);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadAdminParticipantDocuments().then((documents) => {
      if (!cancelled) setLiveDocuments(documents);
    }).catch(() => {
      if (!cancelled) setLiveDocuments([]);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadAdminInvoices().then((rows) => {
      if (!cancelled) setInvoices(rows.map(mapAdminInvoiceRow));
    }).catch((error) => {
      if (!cancelled) {
        setInvoices([]);
        setInvoiceMessage(error instanceof Error ? error.message : 'Faktury se nepodařilo načíst.');
      }
    });
    return () => { cancelled = true; };
  }, []);

  function selectSection(section: SectionKey) {
    setActiveSection(section);
    setMobileMenuOpen(false);
  }

  function handleAddCoachAttendance(input: ManualCoachAttendanceInput) {
    const record: CoachAttendanceRecord = {
      id: `admin-att-${input.coachId}-${Date.now()}`,
      coachId: input.coachId,
      coachName: input.coachName,
      sessionTitle: input.sessionTitle,
      date: input.date,
      present: input.present,
      durationHours: input.durationHours,
      amount: Math.round(input.durationHours * input.hourlyRate),
      reason: input.reason || 'Doplněno administrátorem po zapomenutém zápisu trenéra.',
      source: 'admin',
    };

    setCoachAttendanceRecords((current) => [record, ...current]);
    return record;
  }

  function handleCoachLocationSaved(coachId: string, location: string) {
    setLiveCoachSummaries((current) => (current ?? []).map((coach) => {
      if (coach.id !== coachId) return coach;
      return { ...coach, locations: Array.from(new Set([location, ...coach.locations.filter((item) => item !== 'Čeká na přiřazení')])) };
    }));
  }

  function handleCreateCoachDpp(coach: AdminCoachSummary) {
    const existing = coachDppDocuments.find((document) => document.coachId === coach.id);
    const document = existing ? { ...existing, status: 'sent' as const, updatedAt: '1. 5. 2026', digitalEnvelopeId: existing.digitalEnvelopeId ?? `DPP-VYS-2026-${coach.id.toUpperCase()}` } : buildCoachDppDocument(coach, 'sent');

    setCoachDppDocuments((current) => [document, ...current.filter((item) => item.coachId !== coach.id)]);
    return document;
  }

  function handleMarkCoachDppSigned(coachId: string) {
    setCoachDppDocuments((current) => current.map((document) => document.coachId === coachId ? { ...document, status: 'signed', signedAt: '1. 5. 2026 · digitálně', updatedAt: '1. 5. 2026' } : document));
  }

  function handleMarkCoachDppPhysical(coachId: string) {
    const today = new Date().toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
    setCoachDppDocuments((current) => current.map((document) => document.coachId === coachId ? { ...document, status: 'physical' as const, signedAt: `${today} · fyzicky`, updatedAt: today } : document));
  }

  async function handleReleaseSharedTraining(slot: SharedTrainingSlot, position: 'first' | 'second' = 'first') {
    const product = allProducts.find((item) => item.id === slot.id);
    const coachId = position === 'second' ? slot.secondCoachId : (slot.assignedCoachId ?? slot.regularCoachId);
    if (!product || !coachId) return;
    await handleProductCoachIdsChange(product, (product.coachIds ?? []).filter((id) => id !== coachId));
  }

  async function handleAssignSharedTraining(slot: SharedTrainingSlot, coach: AdminCoachSummary) {
    const product = allProducts.find((item) => item.id === slot.id);
    if (!product || (product.coachIds ?? []).includes(coach.id)) return;
    await handleProductCoachIdsChange(product, [...(product.coachIds ?? []), coach.id]);
  }

  async function handleAddWorkshopCoach(slot: WorkshopSlot, coach: AdminCoachSummary) {
    if (slot.coaches.length >= slot.maxCoaches) return;
    if (slot.coaches.some((c) => c.coachId === coach.id)) return;
    const product = allProducts.find((item) => item.id === slot.id);
    if (!product) return;
    await handleProductCoachIdsChange(product, [...(product.coachIds ?? []), coach.id]);
  }
  async function handleRemoveWorkshopCoach(slot: WorkshopSlot, coachId: string) {
    const product = allProducts.find((item) => item.id === slot.id);
    if (!product) return;
    await handleProductCoachIdsChange(product, (product.coachIds ?? []).filter((id) => id !== coachId));
  }
  async function handleAddWorkshopSlot(date: string, city: WorkshopCity) {
    await addAdminCreatedProduct({
      type: 'Workshop',
      title: `Workshop ${city} ${formatIsoDateForDisplay(date)}`,
      city,
      venue: `${city} centrum`,
      primaryMeta: `${formatIsoDateForDisplay(date)} · 10:00 - 17:00`,
      price: 890,
      capacityTotal: 40,
      capacityCurrent: 0,
      description: `Workshop v lokalitě ${city}.`,
      trainingFocus: 'workshop, technika, QR ticket',
    });
  }

  async function handleAddCampCoach(turnus: CampTurnus, coach: AdminCoachSummary) {
    if (turnus.coaches.length >= turnus.maxCoaches) return;
    if (turnus.coaches.some((c) => c.coachId === coach.id)) return;
    const product = allProducts.find((item) => item.id === turnus.id);
    if (!product) return;
    await handleProductCoachIdsChange(product, [...(product.coachIds ?? []), coach.id]);
  }
  async function handleRemoveCampCoach(turnus: CampTurnus, coachId: string) {
    const product = allProducts.find((item) => item.id === turnus.id);
    if (!product) return;
    await handleProductCoachIdsChange(product, (product.coachIds ?? []).filter((id) => id !== coachId));
  }

  async function handleProductCoachIdsChange(product: ParentProduct, coachIds: string[]) {
    const nextCoachIds = Array.from(new Set(coachIds));
    const nextProduct = { ...product, coachIds: nextCoachIds };
    await updateAdminProduct(nextProduct);

    if (product.type === 'Krouzek') {
      await persistCourseCoachAssignments(product, product.coachIds ?? [], nextCoachIds);
    }

    setLiveCoachSummaries((current) => current ? current.map((coach) => {
      if (!nextCoachIds.includes(coach.id) && !(product.coachIds ?? []).includes(coach.id)) return coach;
      const withoutPlace = coach.locations.filter((location) => location !== product.place && location !== 'Čeká na přiřazení');
      return nextCoachIds.includes(coach.id)
        ? { ...coach, locations: Array.from(new Set([product.place, ...withoutPlace])) }
        : { ...coach, locations: withoutPlace.length > 0 ? withoutPlace : ['Čeká na přiřazení'] };
    }) : current);
  }

  function openParticipantDetail(participant: ParentParticipant, activityType: ActivityType = 'Krouzek', place = participant.activeCourse) {
    setSelectedActivityDetail(null);
    setSelectedParticipantDetail({ participant, activityType, place });
    setActiveSection('participants');
  }

  async function handlePayout(coach: AdminCoachSummary) {
    const amount = payoutAmountForCoach(coach, coachAttendanceRecords);
    const stripeAccountId = coach.stripeAccountId?.trim() ?? '';

    if (!stripeAccountId.startsWith('acct_')) {
      setPayoutMessage(`${coach.name} ještě nemá dokončený Stripe onboarding.`);
      return;
    }

    if (amount <= 0) {
      setPayoutMessage(`${coach.name} nemá za ${payoutPeriod.label} nic k výplatě.`);
      return;
    }

    const confirmed = window.confirm(`Odeslat Stripe transfer ${currency(amount)} pro ${coach.name} za ${payoutPeriod.label}?`);
    if (!confirmed) return;

    setPayingCoachId(coach.id);
    setPayoutMessage(null);

    try {
      const result = await sendTrainerPayout({
        coachId: coach.id,
        coachName: coach.name,
        periodKey: payoutPeriod.key,
        periodStart: payoutPeriod.periodStart,
        periodEnd: payoutPeriod.periodEnd,
        stripeAccountId,
        amount,
      });

      setTransfers((current) => [
        result.transfer,
        ...current.filter((transfer) => !(transfer.coachId === coach.id && transfer.periodKey === payoutPeriod.key)),
      ]);
      setPayoutMessage(`Výplata pro ${coach.name} za ${payoutPeriod.label} je odeslaná.`);
    } catch (error) {
      setPayoutMessage(friendlyPayoutError(error instanceof Error ? error.message : 'Výplatu se nepodařilo odeslat.'));
    } finally {
      setPayingCoachId(null);
    }
  }

  async function handleStartOnboarding(coach: AdminCoachSummary) {
    setGeneratingOnboarding(coach.id);
    setPayoutMessage(null);
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      const result = await createCoachStripeOnboarding(
        coach.id,
        `${base}/admin?onboarding=complete&coach=${coach.id}`,
        `${base}/admin?onboarding=refresh&coach=${coach.id}`,
      );
      setOnboardingLinks((current) => ({ ...current, [coach.id]: result.onboardingUrl }));
    } catch (error) {
      setPayoutMessage(error instanceof Error ? error.message : 'Nepodařilo se vygenerovat onboarding odkaz.');
    } finally {
      setGeneratingOnboarding(null);
    }
  }

  async function handleCoachRequestDecision(request: AdminCoachAccessRequest, action: 'approve' | 'reject') {
    const coachId = request.coachId ?? request.id;
    setApprovalMessage(null);

    if (!request.coachId) {
      setKeyRequests((current) => current.filter((item) => item.id !== request.id));
      setApprovalMessage(action === 'approve' ? `${request.name} je označený jako schválený.` : `${request.name} je zamítnutý.`);
      return;
    }

    setApprovingRequestId(`${action}:${request.id}`);

    try {
      await updateCoachApproval(coachId, action);

      setKeyRequests((current) => current.filter((item) => item.id !== request.id));
      setLiveCoachSummaries((current) => current ? current.map((coach) => coach.id === coachId ? { ...coach, approvalStatus: action === 'approve' ? 'approved' : 'rejected', status: action === 'approve' ? 'Aktivni' : 'Pozastaveny' } : coach) : current);
      setApprovalMessage(action === 'approve' ? `${request.name} má schválený trenérský přístup.` : `${request.name} je zamítnutý.`);
    } catch (error) {
      setApprovalMessage(error instanceof Error ? error.message : 'Žádost se nepodařilo zpracovat.');
    } finally {
      setApprovingRequestId(null);
    }
  }

  async function handleToggleInvoicePaid(id: string) {
    const invoice = invoices.find((item) => item.id === id);
    if (!invoice) return;

    setInvoiceMessage(null);
    const previousInvoices = invoices;
    const nextPaid = !invoice.paid;
    setInvoices((current) => current.map((item) => item.id === id ? { ...item, paid: nextPaid, paidDate: nextPaid ? new Date().toISOString().slice(0, 10) : undefined } : item));

    try {
      const row = await updateAdminInvoicePayment(id, nextPaid);
      setInvoices((current) => current.map((item) => item.id === id ? mapAdminInvoiceRow(row) : item));
    } catch (error) {
      setInvoices(previousInvoices);
      setInvoiceMessage(error instanceof Error ? error.message : 'Fakturu se nepodařilo upravit.');
    }
  }

  async function handleAddInvoice(invoice: Invoice) {
    const payload: AdminInvoiceInput = {
      supplier: invoice.supplier,
      description: invoice.description,
      amount: invoice.amount,
      issuedDate: invoice.issuedDate,
      dueDate: invoice.dueDate,
      paid: invoice.paid,
      paidDate: invoice.paidDate,
      category: invoice.category,
      fileUrl: invoice.fileUrl,
    };

    setInvoiceMessage(null);
    try {
      const row = await createAdminInvoice(payload);
      setInvoices((current) => [mapAdminInvoiceRow(row), ...current]);
    } catch (error) {
      setInvoiceMessage(error instanceof Error ? error.message : 'Fakturu se nepodařilo uložit.');
    }
  }

  async function handleDeleteInvoice(id: string) {
    const previousInvoices = invoices;
    setInvoiceMessage(null);
    setInvoices((current) => current.filter((invoice) => invoice.id !== id));

    try {
      await deleteAdminInvoice(id);
    } catch (error) {
      setInvoices(previousInvoices);
      setInvoiceMessage(error instanceof Error ? error.message : 'Fakturu se nepodařilo smazat.');
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[232px_minmax(0,1fr)]">
      <button
        type="button"
        aria-label="Otevřít menu administrace"
        aria-expanded={mobileMenuOpen}
        onClick={() => setMobileMenuOpen(true)}
        className="fixed right-3 top-3 z-50 inline-flex h-12 w-12 items-center justify-center rounded-[16px] border border-white/20 bg-[#2B1247]/86 text-brand-cyan shadow-brand ring-1 ring-white/10 backdrop-blur-xl lg:hidden"
      >
        <Menu size={22} />
      </button>

      <AnimatePresence>
        {mobileMenuOpen ? (
          <motion.div
            className="fixed inset-0 z-[80] overflow-y-auto bg-[#1D0D31] px-5 py-5 text-white shadow-[inset_0_0_120px_rgba(86,33,140,0.34)] backdrop-blur-xl lg:hidden"
            style={{ background: 'linear-gradient(180deg, #241039 0%, #2D144A 46%, #180A28 100%)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="mx-auto flex min-h-full max-w-[420px] flex-col justify-center py-8">
              <div className="flex items-center justify-between gap-4 rounded-[22px] border border-white/14 bg-[#442160]/82 p-4 shadow-[0_18px_50px_rgba(10,5,22,0.34)] backdrop-blur-xl">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="relative shrink-0 cursor-pointer rounded-[12px] ring-2 ring-white/20 hover:ring-brand-purple transition"
                    title="Klikni pro nahrání loga"
                  >
                    {logoUrl ? (
                      <img src={logoUrl} alt="logo" className="h-[42px] w-[42px] rounded-[12px] object-contain bg-white/10" />
                    ) : (
                      <TeamVysLogo size={42} priority />
                    )}
                    <span className="absolute -bottom-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full bg-brand-purple ring-2 ring-[#2D144A]">
                      {logoUploading ? <span className="text-[7px] text-white font-black">...</span> : <ImagePlus size={10} className="text-white" />}
                    </span>
                  </button>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-brand-cyan">Admin centrum</p>
                    <p className="mt-0.5 text-base font-black leading-tight text-white">{orgName ?? 'Admin centrum'}</p>
                    {logoError ? <p className="mt-0.5 text-[9px] font-bold text-red-300">{logoError}</p> : null}
                  </div>
                </div>
                <button type="button" aria-label="Zavřít menu" onClick={() => setMobileMenuOpen(false)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-white/14 text-white transition hover:bg-white/24">
                  <X size={21} />
                </button>
              </div>

              <nav className="mt-4 grid gap-2">
                {visibleSections.map((section, index) => {
                  const isActive = activeSection === section.key;
                  return (
                    <motion.button
                      key={section.key}
                      type="button"
                      onClick={() => selectSection(section.key)}
                      className={`grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded-[20px] border px-4 py-3 text-left shadow-brand-soft backdrop-blur-xl transition ${
                        isActive
                          ? 'border-brand-purple bg-brand-purple text-white'
                          : 'border-white/14 bg-[#3A1A56]/86 text-white/92 hover:border-white/24 hover:bg-[#4A2370]'
                      }`}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: index * 0.025 }}
                    >
                      <span className={`flex h-12 w-12 items-center justify-center rounded-[16px] ${isActive ? 'bg-white/16 text-white' : 'bg-white/10 text-brand-cyan'}`}>{section.icon}</span>
                      <span className="min-w-0">
                        <span className="block text-base font-black leading-tight">{section.label}</span>
                        <span className={`mt-0.5 block text-xs font-bold ${isActive ? 'text-white/72' : 'text-white/68'}`}>{section.description}</span>
                      </span>
                        <ChevronDown className={`-rotate-90 ${isActive ? 'text-white/72' : 'text-white/58'}`} size={18} />
                    </motion.button>
                  );
                })}
              </nav>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="hidden p-2 lg:sticky lg:top-3 lg:block lg:self-start rounded-[22px] border border-brand-purple/20 bg-[#2B1247]/95 shadow-brand ring-1 ring-brand-purple/20 backdrop-blur-2xl">
        <div className="flex min-w-0 items-center gap-2 lg:block">
          <div className="hidden h-16 w-full shrink-0 items-center gap-3 rounded-[18px] bg-white/10 px-3 ring-1 ring-white/10 lg:flex">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="relative shrink-0 cursor-pointer rounded-[10px] ring-2 ring-white/20 hover:ring-brand-purple transition"
              title="Klikni pro nahrání loga"
            >
              {logoUrl ? (
                <img src={logoUrl} alt="logo" className="h-9 w-9 rounded-[10px] object-contain bg-white/10" />
              ) : (
                <TeamVysLogo size={36} priority />
              )}
              <span className="absolute -bottom-1 -right-1 h-4 w-4 flex items-center justify-center rounded-full bg-brand-purple ring-2 ring-[#2B1247]">
                {logoUploading ? <span className="text-[6px] text-white font-black">...</span> : <ImagePlus size={8} className="text-white" />}
              </span>
            </button>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleLogoUpload(f); e.currentTarget.value = ''; }} />
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase leading-none text-brand-cyan">Admin centrum</p>
              <p className="mt-0.5 text-[13px] font-black leading-tight text-white">{orgName ?? 'Admin centrum'}</p>
              {logoError ? <p className="mt-0.5 text-[9px] font-bold text-red-300 leading-tight">{logoError}</p> : null}
            </div>
          </div>

          <nav className="grid w-full min-w-0 flex-1 grid-cols-4 gap-1.5 md:grid-cols-7 lg:mt-2 lg:grid-cols-1">
            {visibleSections.map((section) => {
              const isActive = activeSection === section.key;
              return (
                <button
                  key={section.key}
                  type="button"
                  aria-label={section.label}
                  title={section.label}
                  onClick={() => selectSection(section.key)}
                  className={`flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[14px] border px-1 text-center transition-all duration-300 md:h-14 lg:h-11 lg:flex-row lg:justify-start lg:gap-2 lg:px-3 lg:text-left ${
                    isActive
                      ? 'border-brand-purple bg-brand-purple text-white shadow-brand'
                      : 'border-brand-purple/20 bg-white/10 text-white/80 hover:border-brand-purple/30 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  <span className={`shrink-0 ${isActive ? 'text-white' : 'text-brand-cyan'}`}>{section.icon}</span>
                  <span className="min-w-0">
                    <span className="block max-w-full text-[10px] font-black leading-tight sm:text-xs md:text-[11px] lg:whitespace-nowrap lg:text-[13px]">{section.label}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-3 hidden flex-col gap-1 border-t border-white/10 px-2 pt-3 lg:flex">
          <p className="px-1 text-[9px] font-black uppercase tracking-wide text-white/35">Právní</p>
          <a href="https://aplikacevys-web.vercel.app/ochrana-osobnich-udaju" target="_blank" rel="noreferrer" className="rounded-[10px] px-2 py-1.5 text-[11px] font-bold text-white/55 transition hover:bg-white/10 hover:text-white">
            Ochrana osobních údajů
          </a>
          <a href="https://aplikacevys-web.vercel.app/obchodni-podminky" target="_blank" rel="noreferrer" className="rounded-[10px] px-2 py-1.5 text-[11px] font-bold text-white/55 transition hover:bg-white/10 hover:text-white">
            Obchodní podmínky
          </a>
          <a href="https://aplikacevys-web.vercel.app/zpracovatelska-smlouva" target="_blank" rel="noreferrer" className="rounded-[10px] px-2 py-1.5 text-[11px] font-bold text-white/55 transition hover:bg-white/10 hover:text-white">
            Zpracovatelská smlouva
          </a>
        </div>
      </div>

      <main className="min-w-0 space-y-5 pb-8 lg:pb-0">
        <AdminHeader activeSection={currentSection} devMode={devMode} showSignOut={showSignOut} superAdmin={superAdmin} totals={totals} />

        {financeError ? <BackendNotice title="Backend finance teď neodpověděl" error={financeError} /> : null}
        {productsError ? <BackendNotice title="Produkty se nenačetly" error={productsError} /> : null}
        {productsLoading && allProducts.length === 0 ? <Panel className="p-4"><p className="text-sm font-black text-brand-ink-soft">Načítám produkty z databáze...</p></Panel> : null}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeSection === 'overview' ? <OverviewSection totals={totals} coaches={coaches} coachAttendanceRecords={coachAttendanceRecords} dppDocuments={coachDppDocuments} keyRequests={keyRequests} approvalMessage={approvalMessage} approvingRequestId={approvingRequestId} onApproveKeyRequest={(request) => handleCoachRequestDecision(request, 'approve')} onRejectKeyRequest={(request) => handleCoachRequestDecision(request, 'reject')} onNavigate={setActiveSection} products={allProducts} /> : null}
            {activeSection === 'attendance' ? <AttendanceSection query={attendanceQuery} onQueryChange={setAttendanceQuery} activityRows={activityRows} campTurnusy={campTurnusyState} workshopSlots={workshopSlots} workshopAttendanceRecords={workshopAttendanceRecords} coaches={coaches} coachAttendanceRecords={coachAttendanceRecords} childAttendanceRecords={childAttendanceRecords} onAddCoachAttendance={handleAddCoachAttendance} onOpenActivityDetail={setSelectedActivityDetail} onOpenParticipantDetail={openParticipantDetail} participants={liveParticipants} products={allProducts} /> : null}
            {activeSection === 'participants' ? <ParticipantsSection products={allProducts} participants={liveParticipants} campTurnusy={campTurnusyState} workshopSlots={workshopSlots} workshopAttendanceRecords={workshopAttendanceRecords} onOpenParticipantDetail={openParticipantDetail} /> : null}
            {activeSection === 'registry' ? <RegistrySection participants={liveParticipants} paymentRows={paymentRows} onOpenParticipantDetail={openParticipantDetail} /> : null}
            {activeSection === 'products' ? <ProductsSection products={allProducts} coaches={coaches} onAddProduct={addAdminCreatedProduct} onRemoveProduct={removeAdminCreatedProduct} onUpdateProduct={updateAdminProduct} onProductCoachIdsChange={handleProductCoachIdsChange} /> : null}
            {activeSection === 'documents' ? (
              <div className="space-y-5">
                <OrgDocumentTemplatesCard />
                <CoachDocumentAssignCard coaches={coaches} />
                <CollapsiblePanel icon={<FileText size={18} />} title="Šablona DPP smlouvy" subtitle="klauzule a texty pro všechny trenéry organizace" defaultOpen={false}>
                  <OrgDppTemplateCard />
                </CollapsiblePanel>
              </div>
            ) : null}
            {activeSection === 'messages' ? <AdminBroadcastsSection participants={liveParticipants} /> : null}
            {activeSection === 'voting' && isVysOrg ? <TrickVotingCard /> : null}
            {activeSection === 'coaches' ? <CoachesSection products={allProducts} coaches={coaches} coachAttendanceRecords={coachAttendanceRecords} dppDocuments={coachDppDocuments} orgDppTemplate={orgDppTemplate} orgId={orgId} sharedTrainingSlots={sharedTrainingSlots} workshopSlots={workshopSlots} campTurnusy={campTurnusyState} onAddCoachAttendance={handleAddCoachAttendance} onCreateCoachDpp={handleCreateCoachDpp} onMarkCoachDppSigned={handleMarkCoachDppSigned} onMarkCoachDppPhysical={handleMarkCoachDppPhysical} onCoachLocationSaved={handleCoachLocationSaved} onReleaseSharedTraining={(slot, pos) => handleReleaseSharedTraining(slot, pos)} onAssignSharedTraining={handleAssignSharedTraining} onAddWorkshopCoach={handleAddWorkshopCoach} onRemoveWorkshopCoach={handleRemoveWorkshopCoach} onAddWorkshopSlot={handleAddWorkshopSlot} onAddCampCoach={handleAddCampCoach} onRemoveCampCoach={handleRemoveCampCoach} /> : null}
            {activeSection === 'payouts' ? (
              <PayoutsSection
                coaches={coaches}
                transfers={transfers}
                coachAttendanceRecords={coachAttendanceRecords}
                invoices={invoices}
                payoutPeriod={payoutPeriod}
                onPrevPeriod={() => setPayoutPeriodOffset((n) => n - 1)}
                onNextPeriod={() => setPayoutPeriodOffset((n) => n + 1)}
                message={payoutMessage}
                payingCoachId={payingCoachId}
                onboardingLinks={onboardingLinks}
                generatingOnboarding={generatingOnboarding}
                onStartOnboarding={handleStartOnboarding}
                onPayout={handlePayout}
              />
            ) : null}
            {activeSection === 'invoices' ? <InvoicesSection invoices={invoices} coaches={coaches} message={invoiceMessage} onTogglePaid={handleToggleInvoicePaid} onAddInvoice={handleAddInvoice} onDeleteInvoice={handleDeleteInvoice} /> : null}
            {activeSection === 'finance' ? <FinanceOverviewSection totals={totals} invoices={invoices} paymentRows={paymentRows} coaches={coaches} coachAttendanceRecords={coachAttendanceRecords} products={allProducts} onNavigate={setActiveSection} isVysOrg={isVysOrg} /> : null}
          </motion.div>
        </AnimatePresence>
      </main>
      {selectedActivityDetail ? (
        <ActivityDetailModal
          activity={selectedActivityDetail}
          products={allProducts}
          participants={liveParticipants}
          documents={liveDocuments}
          coaches={coaches}
          coachAttendanceRecords={coachAttendanceRecords}
          childAttendanceRecords={childAttendanceRecords}
          onClose={() => setSelectedActivityDetail(null)}
          onOpenParticipant={(participant) => openParticipantDetail(participant, selectedActivityDetail.type, selectedActivityDetail.place)}
        />
      ) : null}
      {selectedParticipantDetail ? (
        <ParticipantDetailModal detail={selectedParticipantDetail} documents={liveDocuments} onClose={() => setSelectedParticipantDetail(null)} />
      ) : null}
    </div>
  );
}

function AdminHeader({ activeSection, devMode, showSignOut, superAdmin, totals }: { activeSection: (typeof sections)[number]; devMode: boolean; showSignOut: boolean; superAdmin: boolean; totals: AdminTotals }) {
  return (
    <div className="relative overflow-hidden rounded-[22px] border border-brand-purple/20 bg-gradient-to-br from-[#331650] via-[#27113D] to-[#4A1D78] px-4 py-4 text-white shadow-brand sm:px-5">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-brand" />
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-white/10 text-brand-cyan ring-1 ring-white/10">
            {activeSection.icon}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-brand-cyan">{activeSection.label}</p>
            <h1 className="mt-0.5 text-lg font-black leading-tight md:text-xl">{headlineForSection(activeSection.key)}</h1>
            {devMode ? <p className="mt-1 text-[11px] font-black uppercase text-brand-lime">Testovací režim bez přihlášení</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label={`${totals.missingDocuments} dokumentů chybí`} tone={totals.missingDocuments > 0 ? 'orange' : 'mint'} />
          {superAdmin ? (
            <a href="/admin/organizace" className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-brand-cyan ring-1 ring-white/15 transition hover:bg-white/20">
              Organizace
            </a>
          ) : null}
          {showSignOut ? <SignOutButton /> : null}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        <AdminSignal value={`${totals.participantCount}`} label="účastníci" tone="cyan" />
        <AdminSignal value={`${totals.coachCount}`} label="trenéři" tone="purple" />
        <AdminSignal value={currency(totals.payoutTotal)} label="k výplatě" tone="orange" />
        <AdminSignal value={currency(totals.paidTotal)} label="zaplaceno" tone="mint" />
      </div>
    </div>
  );
}

function BackendNotice({ title, error }: { title: string; error: string }) {
  return (
    <Panel className="border-brand-orange/30 bg-brand-orange/10 p-4">
      <div className="flex items-start gap-3">
        <Bell className="mt-1 shrink-0 text-brand-orange-deep" size={20} />
        <div>
          <p className="font-black text-brand-ink">{title}</p>
          <p className="mt-1 text-sm font-bold leading-6 text-brand-ink-soft">{error}. Zkontroluj API/Supabase připojení; admin teď nezobrazuje lokální náhradní data.</p>
        </div>
      </div>
    </Panel>
  );
}

function OverviewSection({ totals, coaches, coachAttendanceRecords, dppDocuments, keyRequests, approvalMessage, approvingRequestId, onApproveKeyRequest, onRejectKeyRequest, onNavigate, products }: { totals: AdminTotals; coaches: AdminCoachSummary[]; coachAttendanceRecords: CoachAttendanceRecord[]; dppDocuments: AdminCoachDppDocument[]; keyRequests: AdminCoachAccessRequest[]; approvalMessage: string | null; approvingRequestId: string | null; onApproveKeyRequest: (request: AdminCoachAccessRequest) => void; onRejectKeyRequest: (request: AdminCoachAccessRequest) => void; onNavigate: (section: SectionKey) => void; products: ParentProduct[] }) {
  const { flags } = useFeatureFlags();
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const unsignedDpp = coaches.filter((coach) => { const s = dppStatusForCoach(coach.id, dppDocuments); return s !== 'signed' && s !== 'physical'; });
  const adminAttendanceCount = coachAttendanceRecords.filter((record) => record.source === 'admin').length;
  const paidShare = totals.paidTotal + totals.pendingTotal > 0 ? Math.round((totals.paidTotal / (totals.paidTotal + totals.pendingTotal)) * 100) : 100;
  const readyForPayoutCount = coaches.filter((coach) => payoutAmountForCoach(coach, coachAttendanceRecords) > 0).length;
  const gymContacts = products.filter((product) => (product.gymContact ?? '').trim().length > 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <OverviewFocusCard icon={<Receipt size={18} />} label="Čekající platby" value={currency(totals.pendingTotal)} detail={totals.pendingTotal > 0 ? 'Rodičovské platby k dořešení.' : 'Všechny evidované platby jsou zaplacené.'} tone={totals.pendingTotal > 0 ? 'orange' : 'mint'} onClick={() => onNavigate('finance')} />
        <OverviewFocusCard icon={<FileText size={18} />} label="Chybějící dokumenty" value={`${totals.missingDocuments}`} detail={totals.missingDocuments > 0 ? 'Souhlasy a dokumenty před akcemi.' : 'Dokumenty jsou v pořádku.'} tone={totals.missingDocuments > 0 ? 'pink' : 'mint'} onClick={() => onNavigate('participants')} />
        <OverviewFocusCard icon={<FileCheck2 size={18} />} label="DPP trenérů" value={`${unsignedDpp.length}`} detail={unsignedDpp.length ? unsignedDpp.map((coach) => coach.name).join(', ') : 'Všichni trenéři mají podepsáno.'} tone={unsignedDpp.length ? 'orange' : 'mint'} onClick={() => onNavigate('coaches')} />
        <OverviewFocusCard icon={<Banknote size={18} />} label="K výplatě" value={currency(totals.payoutTotal)} detail={readyForPayoutCount ? `${readyForPayoutCount} trenérů má částku k výplatě.` : 'Teď není co vyplácet.'} tone={totals.payoutTotal > 0 ? 'purple' : 'mint'} onClick={() => onNavigate('payouts')} />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel className="p-5">
          <SectionTitle icon={<Gauge size={18} />} title="Dnes řešit" subtitle="jen věci s dopadem na rodiče, trenéry nebo peníze" />
          <div className="mt-4 grid gap-3">
            <PriorityRow title="Žádosti o trenérský klíč" value={`${keyRequests.length}`} detail={keyRequests.length ? `${keyRequests.length} čeká na schválení — zkontroluj osobní údaje a vydej klíč.` : 'Právě žádná nová žádost.'} tone={keyRequests.length ? 'pink' : 'mint'} />
            {keyRequests.length > 0 ? (
              <div className="grid gap-2">
                {keyRequests.map((request) => (
                  <div key={request.id} className="rounded-[14px] border border-brand-purple/10 bg-white">
                    <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => setExpandedRequestId(expandedRequestId === request.id ? null : request.id)}>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-brand-ink">{request.name}</p>
                        <p className="mt-0.5 text-xs font-bold text-brand-ink-soft">{request.requestedLocation} · {request.requestedAt}</p>
                      </div>
                      <ChevronDown size={16} className={`shrink-0 text-brand-purple transition-transform ${expandedRequestId === request.id ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedRequestId === request.id ? (
                      <div className="border-t border-brand-purple/8 px-4 pb-4 pt-3">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <InfoBlock label="Jméno" value={request.name} />
                          <InfoBlock label="E-mail" value={request.email} />
                          <InfoBlock label="Telefon" value={request.phone} />
                          <InfoBlock label="Požadovaná lokalita" value={request.requestedLocation} />
                          <InfoBlock label="Čas žádosti" value={request.requestedAt} />
                        </div>
                        {request.note ? <p className="mt-3 rounded-[12px] bg-brand-paper px-3 py-2 text-sm font-bold text-brand-ink-soft">{request.note}</p> : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={approvingRequestId === `approve:${request.id}`}
                            onClick={() => { onApproveKeyRequest(request); setExpandedRequestId(null); }}
                            className="inline-flex items-center gap-2 rounded-[14px] bg-brand-purple px-4 py-2.5 text-sm font-black text-white shadow-brand transition hover:bg-brand-purple-deep disabled:cursor-not-allowed disabled:opacity-55"
                          >
                            <CheckCircle2 size={16} /> {approvingRequestId === `approve:${request.id}` ? 'Schvaluji...' : 'Schválit trenéra'}
                          </button>
                          <button
                            type="button"
                            disabled={approvingRequestId === `reject:${request.id}`}
                            onClick={() => { onRejectKeyRequest(request); setExpandedRequestId(null); }}
                            className="inline-flex items-center gap-2 rounded-[14px] border border-brand-purple/15 bg-white px-4 py-2.5 text-sm font-black text-brand-ink transition hover:bg-brand-paper disabled:cursor-not-allowed disabled:opacity-55"
                          >
                            <X size={16} /> {approvingRequestId === `reject:${request.id}` ? 'Zamítám...' : 'Zamítnout'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            {approvalMessage ? <p className="rounded-[12px] bg-brand-paper px-3 py-2 text-sm font-bold text-brand-ink-soft">{approvalMessage}</p> : null}
            <PriorityRow title="Nepodepsané DPP" value={`${unsignedDpp.length}`} detail={unsignedDpp.length ? unsignedDpp.map((coach) => coach.name).join(', ') : 'Všichni trenéři mají DPP podepsané.'} tone={unsignedDpp.length ? 'orange' : 'mint'} />
            <PriorityRow title="Chybějící dokumenty dětí" value={`${totals.missingDocuments}`} detail={totals.missingDocuments ? `Doplň před další lekcí${flags.trainer_camps ? ', táborem' : ''}${flags.trainer_workshop_registration ? ' nebo workshopem' : ''}.` : 'Nic neblokuje účast.'} tone={totals.missingDocuments ? 'pink' : 'mint'} />
            <PriorityRow title="Zpětně doplněná docházka" value={`${adminAttendanceCount}`} detail={adminAttendanceCount ? 'Zkontroluj před výplatami, aby seděly hodiny.' : 'Bez ručních zásahů v docházce.'} tone={adminAttendanceCount ? 'purple' : 'mint'} />
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel className="p-5">
            <SectionTitle icon={<ListChecks size={18} />} title="Stav provozu" subtitle="rychlé potvrzení, že nic zásadního nechybí" />
            <div className="mt-4 grid gap-2">
              <HealthRow label="Platby" value={totals.pendingTotal > 0 ? currency(totals.pendingTotal) : 'OK'} tone={totals.pendingTotal > 0 ? 'orange' : 'mint'} />
              <HealthRow label="Dokumenty" value={totals.missingDocuments > 0 ? `${totals.missingDocuments} chybí` : 'OK'} tone={totals.missingDocuments > 0 ? 'pink' : 'mint'} />
              <HealthRow label="DPP" value={unsignedDpp.length > 0 ? `${unsignedDpp.length} nepodepsáno` : 'OK'} tone={unsignedDpp.length > 0 ? 'orange' : 'mint'} />
              <HealthRow label="Výplaty" value={totals.payoutTotal > 0 ? currency(totals.payoutTotal) : 'OK'} tone={totals.payoutTotal > 0 ? 'purple' : 'mint'} />
            </div>
          </Panel>

          <Panel className="p-5">
            <SectionTitle icon={<Phone size={18} />} title="Kontakty na tělocvičny" subtitle="jen pro tebe · doplní je koordinátor v aplikaci nebo ty při tvorbě/úpravě produktu" />
            <div className="mt-4 grid gap-2">
              {gymContacts.length === 0 ? (
                <p className="rounded-[12px] bg-brand-paper px-3 py-2 text-sm font-bold text-brand-ink-soft">Zatím žádný kontakt není vyplněný.</p>
              ) : (
                gymContacts.map((product) => (
                  <div key={product.id} className="rounded-[14px] border border-brand-purple/10 bg-white px-4 py-3">
                    <p className="text-sm font-black text-brand-ink">{product.title}</p>
                    <p className="mt-0.5 text-xs font-bold text-brand-ink-soft">{[product.city, product.place, product.venue].filter(Boolean).join(' · ')}</p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm font-bold text-brand-ink">{product.gymContact}</p>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function AttendanceSection({ query, onQueryChange, activityRows, campTurnusy, workshopSlots, workshopAttendanceRecords, coaches, coachAttendanceRecords, childAttendanceRecords, onAddCoachAttendance, onOpenActivityDetail, onOpenParticipantDetail, participants, products }: { query: string; onQueryChange: (value: string) => void; activityRows: ReturnType<typeof adminActivityRows>; campTurnusy: CampTurnus[]; workshopSlots: WorkshopSlot[]; workshopAttendanceRecords: WorkshopAttendanceRecord[]; coaches: AdminCoachSummary[]; coachAttendanceRecords: CoachAttendanceRecord[]; childAttendanceRecords: ChildAttendanceRecord[]; onAddCoachAttendance: (input: ManualCoachAttendanceInput) => CoachAttendanceRecord; onOpenActivityDetail: (activity: ReturnType<typeof adminActivityRows>[number]) => void; onOpenParticipantDetail: (participant: ParentParticipant, activityType: ActivityType, place: string) => void; participants: ParentParticipant[]; products: ParentProduct[] }) {
  const { flags } = useFeatureFlags();
  const visibleActivities = filterActivityRows(activityRows, query);
  const visibleCoaches = coaches.filter((coach) => matchesQuery(`${coach.name} ${coach.locations.join(' ')}`, query) || recordsForCoach(coach, coachAttendanceRecords).some((record) => matchesQuery(`${record.coachName} ${record.sessionTitle} ${record.date}`, query)));
  const courseStats = buildCourseLocationStats(visibleActivities, childAttendanceRecords);
  const eventActivities = visibleActivities.filter((activity) => activity.type !== 'Krouzek');
  const workshopActivities = eventActivities.filter((activity) => activity.type === 'Workshop');
  const todayKey = new Date().toISOString().slice(0, 10);
  const pastCampTurnusy = campTurnusy.filter((t) => t.dateTo < todayKey);
  const pastWsSlots = workshopSlots.filter((s) => s.date < todayKey).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-5">
      <Panel className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <SectionTitle icon={<ClipboardList size={18} />} title="Docházka aktivit" subtitle={`proběhlé${flags.trainer_camps ? ' tábory' : ''}${flags.trainer_camps && flags.trainer_workshop_registration ? ' a' : ''}${flags.trainer_workshop_registration ? ' workshopy' : ''} · kroužky · filtruj podle místa, trenéra nebo data`} />
          <SearchField value={query} onChange={onQueryChange} placeholder="Hledat Vyškov, Alex, Filip..." />
        </div>
      </Panel>

      <Panel className="p-5">
        <SectionTitle icon={<Gauge size={18} />} title="Statistika kroužků podle města" subtitle="kolik dětí bylo na lekcích v čase" />
        <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {courseStats.map((stat) => <CourseLocationStatCard key={stat.key} stat={stat} onOpenDetail={() => onOpenActivityDetail(stat.activity)} />)}
        </div>
        {courseStats.length === 0 ? <EmptyState text="Pro zadaný filtr není žádný kroužek." /> : null}
      </Panel>

      <div className={`grid gap-4${flags.trainer_camps && flags.trainer_workshop_registration ? ' xl:grid-cols-2' : ''}`}>
        {flags.trainer_camps ? <CampTurnusModalPanel campTurnusy={pastCampTurnusy} activities={activityRows.filter((a) => a.type === 'Tabor')} onOpenActivityDetail={onOpenActivityDetail} participants={participants} products={products} /> : null}
        {flags.trainer_workshop_registration ? <WorkshopCalendarAttendancePanel slots={pastWsSlots} allSlots={workshopSlots} activities={workshopActivities} attendanceRecords={workshopAttendanceRecords} /> : null}
      </div>

      <CollapsiblePanel icon={<Banknote size={18} />} title="Trenérská docházka podle trenéra" subtitle="celý záznam trenéra včetně admin doplnění" count={`${visibleCoaches.length} trenérů`} defaultOpen={false}>
        <div className="grid gap-3 lg:grid-cols-2">
          {visibleCoaches.map((coach) => (
            <CoachAttendancePanel key={coach.id} coach={coach} records={coachAttendanceRecords} onAdd={onAddCoachAttendance} compact />
          ))}
          {visibleCoaches.length === 0 ? <EmptyState text="Pro zadaný filtr není žádná trenérská docházka." /> : null}
        </div>
      </CollapsiblePanel>

      <ManualAttendancePanel coaches={coaches} onAdd={onAddCoachAttendance} />
    </div>
  );
}

function CampTurnusModalPanel({ campTurnusy, activities, onOpenActivityDetail, participants, products }: { campTurnusy: CampTurnus[]; activities: ReturnType<typeof adminActivityRows>; onOpenActivityDetail: (activity: ReturnType<typeof adminActivityRows>[number]) => void; participants: ParentParticipant[]; products: ParentProduct[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const closeModal = () => { setIsOpen(false); setSelectedId(null); };

  const incompleteCount = campTurnusy.filter((t) => t.coaches.length < t.maxCoaches).length;
  const hasCamps = campTurnusy.length > 0;

  // Extract unique years and default to the latest
  const years = useMemo(() => {
    const set = new Set(campTurnusy.map((t) => t.dateFrom.slice(0, 4)));
    return Array.from(set).sort();
  }, [campTurnusy]);
  const [selectedYear, setSelectedYear] = useState<string>(() => {
    const all = Array.from(new Set(campTurnusy.map((t) => t.dateFrom.slice(0, 4)))).sort();
    return all[all.length - 1] ?? new Date().getFullYear().toString();
  });
  const activeYear = years.includes(selectedYear) ? selectedYear : (years[years.length - 1] ?? selectedYear);
  const yearIdx = years.indexOf(activeYear);

  const turnusyForYear = useMemo(
    () => campTurnusy.filter((t) => t.dateFrom.startsWith(activeYear)),
    [campTurnusy, activeYear],
  );

  // Group turnusy by campId (within selected year)
  const campGroups = useMemo(() => {
    const map = new Map<string, { campTitle: string; city: string; turnusy: CampTurnus[] }>();
    for (const t of turnusyForYear) {
      const existing = map.get(t.campId);
      if (existing) { existing.turnusy.push(t); } else { map.set(t.campId, { campTitle: t.campTitle, city: t.city, turnusy: [t] }); }
    }
    return Array.from(map.values());
  }, [turnusyForYear]);

  const selectedTurnus = selectedId ? campTurnusy.find((t) => t.id === selectedId) ?? null : null;
  const selectedActivity = selectedTurnus ? activities.find((a) => a.id === selectedTurnus.campId) ?? null : null;

  function fmtDate(iso: string) {
    const [y, m, d] = iso.split('-').map(Number);
    return `${d}. ${m}. ${y}`;
  }

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="flex w-full flex-col items-center justify-center gap-3 rounded-[22px] border border-brand-purple/10 bg-white p-6 shadow-sm transition hover:border-brand-purple/25 hover:shadow-brand-soft">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-purple/10 text-brand-purple"><CalendarDays size={22} /></span>
        <span className="text-base font-black text-brand-ink">Tábory</span>
        <span className={`text-2xl font-black ${!hasCamps ? 'text-brand-ink-soft' : incompleteCount > 0 ? 'text-brand-pink' : 'text-[#1FB37A]'}`}>{!hasCamps ? '–' : incompleteCount > 0 ? incompleteCount : '✓'}</span>
        <span className="text-xs font-bold text-brand-ink-soft">{!hasCamps ? 'žádné tábory' : incompleteCount > 0 ? 'neúplných' : 'vše obsazeno'}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div key="camp-backdrop" className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
              onClick={closeModal} />
            <motion.div key="camp-modal"
              className="fixed inset-x-4 top-[3vh] z-50 mx-auto flex max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" style={{ maxHeight: '94vh' }}
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}>
              {/* Modal header */}
              <div className="flex flex-shrink-0 items-center justify-between border-b border-brand-purple/8 bg-white px-6 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-purple/10 text-brand-purple"><CalendarDays size={16} /></span>
                  <span className="text-base font-black text-brand-ink">Tábory</span>
                  <StatusPill label={`${turnusyForYear.length} turnusů`} tone="purple" />
                  <StatusPill label={!hasCamps ? 'Žádné tábory' : incompleteCount > 0 ? `${incompleteCount} neúplných` : 'Vše obsazeno'} tone={!hasCamps ? 'purple' : incompleteCount > 0 ? 'pink' : 'mint'} />
                  {years.length > 1 && (
                    <div className="flex items-center gap-1 rounded-[11px] border border-brand-purple/20 bg-white px-1 py-0.5">
                      <button type="button" disabled={yearIdx <= 0} onClick={() => { setSelectedYear(years[yearIdx - 1]); setSelectedId(null); }} className="flex h-6 w-6 items-center justify-center rounded-lg text-brand-purple transition hover:bg-brand-purple/8 disabled:opacity-25">
                        <ChevronDown size={12} className="rotate-90" />
                      </button>
                      <span className="min-w-[36px] text-center text-xs font-black text-brand-purple">{activeYear}</span>
                      <button type="button" disabled={yearIdx >= years.length - 1} onClick={() => { setSelectedYear(years[yearIdx + 1]); setSelectedId(null); }} className="flex h-6 w-6 items-center justify-center rounded-lg text-brand-purple transition hover:bg-brand-purple/8 disabled:opacity-25">
                        <ChevronDown size={12} className="-rotate-90" />
                      </button>
                    </div>
                  )}
                </div>
                <button type="button" onClick={closeModal} className="ml-4 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-paper text-brand-ink-soft transition hover:bg-brand-purple/10 hover:text-brand-purple">
                  <ChevronDown size={16} className="rotate-180" />
                </button>
              </div>
              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-6 pb-8 pt-5">
                <div className="space-y-4">
                  {campGroups.map((group) => (
                    <div key={group.campTitle}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-purple/10 text-brand-purple"><ShieldCheck size={13} /></span>
                        <p className="text-sm font-black text-brand-ink">{group.campTitle}</p>
                        <span className="text-xs font-bold text-brand-ink-soft">{group.city}</span>
                      </div>
                      <div className="grid gap-2">
                        {group.turnusy.map((turnus, tIdx) => {
                          const isFull = turnus.coaches.length >= turnus.maxCoaches;
                          const hasNone = turnus.coaches.length === 0;
                          const isSelected = selectedId === turnus.id;
                          return (
                            <button key={turnus.id} type="button"
                              onClick={() => setSelectedId(isSelected ? null : turnus.id)}
                              className={`w-full rounded-[16px] p-3 text-left transition ${isSelected ? 'border border-brand-purple/30 bg-brand-purple-light shadow-sm' : 'border border-brand-purple/10 bg-brand-paper hover:border-brand-purple/25 hover:bg-white'}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="mb-0.5 text-[10px] font-black uppercase tracking-wide text-brand-purple">{tIdx + 1}. turnus</p>
                                  <p className="text-xs font-black text-brand-ink">{fmtDate(turnus.dateFrom)} – {fmtDate(turnus.dateTo)}</p>
                                  <p className="mt-0.5 text-[11px] font-bold text-brand-ink-soft">{turnus.venue} · {turnus.durationDays} dní</p>
                                </div>
                                <div className="text-right">
                                  <div className="flex items-center gap-1">
                                    {Array.from({ length: turnus.maxCoaches }).map((_, i) => (
                                      <span key={i} className={`inline-block h-2 w-2 rounded-full ${i < turnus.coaches.length ? 'bg-[#1FB37A]' : hasNone ? 'bg-[#F0445B]/50' : 'bg-brand-ink/15'}`} />
                                    ))}
                                  </div>
                                  <p className={`mt-1 text-[10px] font-black ${isFull ? 'text-[#1FB37A]' : hasNone ? 'text-[#F0445B]' : 'text-[#FFB21A]'}`}>
                                    {isFull ? 'Obsazeno' : hasNone ? 'Bez trenérů' : `${turnus.coaches.length}/${turnus.maxCoaches}`}
                                  </p>
                                </div>
                              </div>
                              {turnus.coaches.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {turnus.coaches.map((c) => (
                                    <span key={c.coachId} className="rounded-[8px] bg-brand-ink px-2 py-0.5 text-[10px] font-black text-white">{c.coachName.split(' ')[0]}</span>
                                  ))}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {campGroups.length === 0 && <EmptyState text="Žádné tábory v databázi." />}
                </div>

                {/* Selected turnus detail */}
                {selectedTurnus && (() => {
                  const turnusProduct = products.find((p) => p.id === selectedTurnus.id);
                  const turnusParticipants = turnusProduct ? participants.filter((participant) => participantBelongsToProduct(participant, turnusProduct)) : [];
                  return (
                  <div className="mt-5 rounded-2xl border border-brand-purple/12 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-black text-brand-ink">{selectedTurnus.campTitle}</p>
                        <p className="mt-0.5 text-sm font-bold text-brand-purple-deep">{fmtDate(selectedTurnus.dateFrom)} – {fmtDate(selectedTurnus.dateTo)}</p>
                        <p className="mt-0.5 text-xs font-bold text-brand-ink-soft">{selectedTurnus.venue} · {selectedTurnus.durationDays} dní</p>
                      </div>
                      <div className="flex gap-2">
                        {selectedActivity && (
                          <button type="button" onClick={() => { onOpenActivityDetail(selectedActivity); closeModal(); }}
                            className="rounded-xl border border-brand-purple/20 bg-brand-paper px-3 py-1.5 text-xs font-black text-brand-purple hover:bg-brand-purple/5">
                            Detail produktu
                          </button>
                        )}
                        <button type="button" onClick={() => setSelectedId(null)}
                          className="rounded-xl border border-brand-purple/15 bg-brand-paper px-3 py-1.5 text-xs font-black text-brand-purple-deep hover:bg-brand-purple/5">
                          Zavřít
                        </button>
                      </div>
                    </div>
                    {/* Coaches */}
                    <div className="mt-4">
                      <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-brand-ink-soft">Trenéři · {selectedTurnus.coaches.length}/{selectedTurnus.maxCoaches}</p>
                      {selectedTurnus.coaches.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedTurnus.coaches.map((c) => (
                            <span key={c.coachId} className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-ink px-2.5 py-1.5 text-xs font-black text-white">{c.coachName}</span>
                          ))}
                          {Array.from({ length: selectedTurnus.maxCoaches - selectedTurnus.coaches.length }).map((_, i) => (
                            <span key={i} className="inline-flex items-center gap-1.5 rounded-[10px] border border-dashed border-brand-purple/20 px-2.5 py-1.5 text-xs font-bold text-brand-ink-soft/40">Volné místo</span>
                          ))}
                        </div>
                      ) : <p className="text-xs text-brand-ink-soft/50">Bez přiřazených trenérů.</p>}
                    </div>
                    {/* Participants */}
                    <div className="mt-4">
                      <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-brand-ink-soft">
                        Účastníci · {turnusParticipants.length}{selectedActivity ? `/${selectedActivity.capacityTotal}` : ''}
                      </p>
                      {turnusParticipants.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {turnusParticipants.map((p) => (
                            <span key={p.id} className="rounded-[8px] bg-brand-purple/10 px-2 py-1 text-[11px] font-black text-brand-purple">
                              {p.firstName} {p.lastName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-brand-ink-soft/50">
                          {turnusProduct ? 'Žádní přihlášení účastníci.' : 'Účastníci se načítají…'}
                        </p>
                      )}
                    </div>
                  </div>
                  );
                })()}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function CollapsibleEventAttendancePanel({ title, subtitle, countLabel, activities, emptyText, isOpen, onToggle, onOpenActivityDetail }: { title: string; subtitle: string; countLabel: string; activities: ReturnType<typeof adminActivityRows>; emptyText: string; isOpen: boolean; onToggle: () => void; onOpenActivityDetail: (activity: ReturnType<typeof adminActivityRows>[number]) => void }) {
  return (
    <Panel className="overflow-hidden p-5">
      <button type="button" onClick={onToggle} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-4 text-left">
        <SectionTitle icon={<CalendarDays size={18} />} title={title} subtitle={`${subtitle} · ${activities.length} ${countLabel}`} />
        <span className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-[13px] border border-brand-purple/20 bg-white px-3 py-2 text-xs font-black text-brand-purple transition ${isOpen ? 'bg-brand-purple/5' : 'hover:bg-brand-purple/5'}`}>
          <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          {isOpen ? 'Skrýt' : 'Zobrazit'}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            key={`${title}-attendance-body`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-4 grid gap-3">
              {activities.map((activity) => <ActivityAttendanceRow key={activity.id} activity={activity} onOpenDetail={() => onOpenActivityDetail(activity)} />)}
              {activities.length === 0 ? <EmptyState text={emptyText} /> : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Panel>
  );
}

function WorkshopCalendarAttendancePanel({ slots, allSlots, activities, attendanceRecords }: { slots: WorkshopSlot[]; allSlots: WorkshopSlot[]; activities: ReturnType<typeof adminActivityRows>; attendanceRecords: WorkshopAttendanceRecord[] }) {
  const now = new Date();
  const initialMonthWeb = initialSeasonMonthWeb(now);
  const [isOpen, setIsOpen] = useState(false);
  const [calYear, setCalYear] = useState(initialMonthWeb.year);
  const [calMonth, setCalMonth] = useState(initialMonthWeb.month);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const grid = useMemo(() => getMonthGridWeb(calYear, calMonth), [calYear, calMonth]);
  const ymVal = (y: number, m: number) => y * 12 + m;
  const canGoPrev = ymVal(calYear, calMonth) > ymVal(SEASON_START_WEB.year, SEASON_START_WEB.month);
  const canGoNext = ymVal(calYear, calMonth) < ymVal(SEASON_END_WEB.year, SEASON_END_WEB.month);
  function goPrev() { if (!canGoPrev) return; setSelectedId(null); if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); } else setCalMonth((m) => m - 1); }
  function goNext() { if (!canGoNext) return; setSelectedId(null); if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); } else setCalMonth((m) => m + 1); }

  const CITY_CHIP: Record<WorkshopCity, string> = { Brno: 'bg-[#8B1DFF] text-white hover:bg-[#7a18e0]', Praha: 'bg-[#1FB37A] text-white hover:bg-[#1a9a6c]', Ostrava: 'bg-[#FFB21A] text-brand-ink hover:bg-[#e6a000]' };
  const openCount = slots.filter((s) => s.coaches.length < s.maxCoaches).length;
  const hasSlots = slots.length > 0;
  const selectedSlot = selectedId ? slots.find((s) => s.id === selectedId) ?? null : null;
  const closeModal = () => { setIsOpen(false); setSelectedId(null); };

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="flex w-full flex-col items-center justify-center gap-3 rounded-[22px] border border-brand-purple/10 bg-white p-6 shadow-sm transition hover:border-brand-purple/25 hover:shadow-brand-soft">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-purple/10 text-brand-purple"><CalendarDays size={22} /></span>
        <span className="text-base font-black text-brand-ink">Workshopy</span>
        <span className={`text-2xl font-black ${!hasSlots ? 'text-brand-ink-soft' : openCount > 0 ? 'text-brand-pink' : 'text-[#1FB37A]'}`}>{!hasSlots ? '–' : openCount > 0 ? openCount : '✓'}</span>
        <span className="text-xs font-bold text-brand-ink-soft">{!hasSlots ? 'žádné workshopy' : openCount > 0 ? 'neúplných' : 'vše obsazeno'}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div key="wsatt-backdrop" className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
              onClick={closeModal} />
            <motion.div key="wsatt-modal"
              className="fixed inset-x-4 top-[3vh] z-50 mx-auto flex max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" style={{ maxHeight: '94vh' }}
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}>
              {/* Modal header */}
              <div className="flex flex-shrink-0 items-center justify-between border-b border-brand-purple/8 bg-white px-6 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-purple/10 text-brand-purple"><CalendarDays size={16} /></span>
                  <span className="text-base font-black text-brand-ink">Workshopy</span>
                  <StatusPill label={`${slots.length} termínů`} tone="purple" />
                  <StatusPill label={!hasSlots ? 'Žádné workshopy' : openCount > 0 ? `${openCount} neúplných` : 'Vše obsazeno'} tone={!hasSlots ? 'purple' : openCount > 0 ? 'pink' : 'mint'} />
                </div>
                <button type="button" onClick={closeModal} className="ml-4 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-paper text-brand-ink-soft transition hover:bg-brand-purple/10 hover:text-brand-purple">
                  <ChevronDown size={16} className="rotate-180" />
                </button>
              </div>
              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-6 pb-8 pt-5">
                {/* Month nav */}
                <div className="flex items-center justify-between">
                  <button type="button" disabled={!canGoPrev} onClick={goPrev}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-purple/20 bg-white text-brand-purple transition hover:bg-brand-purple/5 disabled:opacity-30">
                    <ChevronDown size={14} className="rotate-90" />
                  </button>
                  <p className="text-sm font-black text-brand-purple-deep">{CZECH_MONTH_NAMES_WEB[calMonth]} {calYear}</p>
                  <button type="button" disabled={!canGoNext} onClick={goNext}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-purple/20 bg-white text-brand-purple transition hover:bg-brand-purple/5 disabled:opacity-30">
                    <ChevronDown size={14} className="-rotate-90" />
                  </button>
                </div>

                {/* Legend */}
                <div className="mt-3 flex flex-wrap gap-4 text-xs font-bold text-brand-ink-soft">
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#8B1DFF]" />Brno</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#1FB37A]" />Praha</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#FFB21A]" />Ostrava</span>
                </div>

                {/* Day headers */}
                <div className="mt-4 grid grid-cols-7 gap-1">
                  {WEEK_DAY_ABBR_WEB.map((abbr) => (
                    <div key={abbr} className="pb-1 text-center text-[11px] font-black uppercase text-brand-purple-deep">{abbr}</div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {grid.flat().map((date, idx) => {
                    if (!date) return <div key={`wsatt-empty-${idx}`} className="min-h-[68px]" />;
                    const dk = dateKeyWeb(date);
                    const daySlots = slots.filter((s) => s.date === dk);
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const isToday = date.getTime() === today.getTime();
                    const isPast = date < today;
                    return (
                      <div key={dk} className={`min-h-[68px] rounded-xl p-1.5 ${daySlots.length > 0 ? 'border border-brand-purple/10 bg-white' : 'bg-brand-paper/40'}`}>
                        <p className={`mb-1 text-right text-[11px] font-black ${isToday ? 'text-brand-purple' : isPast ? 'text-brand-ink-soft/35' : 'text-brand-ink-soft'}`}>{date.getDate()}</p>
                        <div className="flex flex-col gap-0.5">
                          {daySlots.map((slot) => {
                            const activity = activities.find((a) => a.id === slot.id);
                            const attendance = attendanceRecords.find((r) => r.slotId === slot.id);
                            const isSelected = selectedId === slot.id;
                            return (
                              <button key={slot.id} type="button"
                                onClick={() => setSelectedId(isSelected ? null : slot.id)}
                                className={`w-full rounded-[5px] px-1 py-0.5 text-left transition ${isSelected ? 'ring-1 ring-offset-1 ring-brand-ink' : ''} ${CITY_CHIP[slot.city]}`}>
                                <p className="truncate text-[9px] font-black leading-tight">{activity?.title ?? slot.city}</p>
                                <p className="text-[8px] font-bold opacity-70">{attendance ? `${attendance.attendees} účast.` : slot.coaches.length > 0 ? `${slot.coaches.length} trenér` : '—'}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected slot detail */}
                {selectedSlot && (() => {
                  const activity = activities.find((a) => a.id === selectedSlot.id);
                  const attendance = attendanceRecords.find((r) => r.slotId === selectedSlot.id);
                  return (
                    <div className="mt-4 rounded-2xl border border-brand-purple/12 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          {activity && <p className="text-base font-black text-brand-ink">{activity.title}</p>}
                          <p className="mt-0.5 text-sm font-bold text-brand-purple-deep">{selectedSlot.date} · {selectedSlot.time}</p>
                          <p className="mt-0.5 text-xs font-bold text-brand-ink-soft">{selectedSlot.venue}</p>
                        </div>
                        <button type="button" onClick={() => setSelectedId(null)}
                          className="rounded-xl border border-brand-purple/15 bg-brand-paper px-3 py-1.5 text-xs font-black text-brand-purple-deep hover:bg-brand-purple/5">
                          Zavřít
                        </button>
                      </div>

                      {/* Coaches */}
                      <div className="mt-4">
                        <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-brand-ink-soft">Trenéři · {selectedSlot.coaches.length}/{selectedSlot.maxCoaches}</p>
                        {selectedSlot.coaches.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {selectedSlot.coaches.map((c) => {
                              const tricks = attendance?.coachTrickCounts.find((tc) => tc.coachId === c.coachId)?.count;
                              return (
                                <span key={c.coachId} className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-ink px-2.5 py-1.5 text-xs font-black text-white">
                                  {c.coachName}
                                  {tricks != null && <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[9px]">{tricks} triků</span>}
                                </span>
                              );
                            })}
                          </div>
                        ) : <p className="text-xs text-brand-ink-soft/50">Bez přiřazených trenérů.</p>}
                      </div>

                      {/* Participants */}
                      <div className="mt-4">
                        <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-brand-ink-soft">
                          Účastníci · {attendance ? attendance.attendees : (activity?.registered ?? 0)}
                          {activity && <span className="ml-1 font-bold text-brand-ink-soft/50">/ {activity.capacityTotal}</span>}
                        </p>
                        {attendance?.participants && attendance.participants.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {attendance.participants.map((name) => (
                              <span key={name} className="rounded-[999px] bg-brand-purple/10 px-2.5 py-1 text-xs font-bold text-brand-purple-deep">{name}</span>
                            ))}
                          </div>
                        ) : <p className="text-xs text-brand-ink-soft/50">Žádná evidovaná docházka účastníků.</p>}
                      </div>
                    </div>
                  );
                })()}

                {/* Stats */}
                <div className="mt-6 border-t border-brand-purple/8 pt-6">
                  <WorkshopStatsPanel allSlots={allSlots} attendanceRecords={attendanceRecords} />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function ParticipantsSection({ products, participants, campTurnusy, workshopSlots, workshopAttendanceRecords, onOpenParticipantDetail }: { products: ParentProduct[]; participants: ParentParticipant[]; campTurnusy: CampTurnus[]; workshopSlots: WorkshopSlot[]; workshopAttendanceRecords: WorkshopAttendanceRecord[]; onOpenParticipantDetail: (participant: ParentParticipant, activityType: ActivityType, place: string) => void }) {
  const [query, setQuery] = useState('');
  const [activeParticipantType, setActiveParticipantType] = useState<ActivityType>('Krouzek');
  const participantGroups = useMemo(() => buildParticipantGroups(query, products, participants), [query, products, participants]);
  const taborGroups = useMemo(() => buildTaborGroupsFromTurnusy(campTurnusy, participants, query), [campTurnusy, participants, query]);
  const todayKey = new Date().toISOString().slice(0, 10);
  const upcomingWsSlots = useMemo(() => workshopSlots.filter((s) => s.date >= todayKey).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 24), [workshopSlots, todayKey]);
  const participantSubtitle = activeParticipantType === 'Tabor'
    ? 'nadcházející tábory · přihlášení na daný turnus'
    : activeParticipantType === 'Workshop'
    ? 'nadcházející termíny · přihlášení podle data'
    : 'přepni typ aktivity nahoře, města zůstávají jako hlavní rozbalení';
  const groupsByType = {
    Krouzek: participantGroups.filter((group) => group.type === 'Krouzek'),
    Tabor: taborGroups,
    Workshop: participantGroups.filter((group) => group.type === 'Workshop'),
  };
  const activeGroups = groupsByType[activeParticipantType];

  return (
    <div className="space-y-5">
      <Panel className="p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
          <div className="space-y-4">
            <SectionTitle icon={<Users size={18} />} title="Účastníci podle místa" subtitle={participantSubtitle} />
            <ParticipantTypeSwitch activeType={activeParticipantType} groupsByType={groupsByType} workshopUpcomingCount={upcomingWsSlots.length} onChange={setActiveParticipantType} />
          </div>
          <SearchField value={query} onChange={setQuery} placeholder="Hledat účastníka nebo lokalitu..." />
        </div>
      </Panel>

      {activeParticipantType === 'Workshop'
        ? <WorkshopUpcomingPanel slots={upcomingWsSlots} products={products} participants={participants} attendanceRecords={workshopAttendanceRecords} onOpenParticipant={(p, place) => onOpenParticipantDetail(p, 'Workshop', place)} />
        : <>
            <ActivityParticipantTypeSection type={activeParticipantType} groups={activeGroups} onOpenParticipantDetail={onOpenParticipantDetail} />
            {participantGroups.length === 0 ? <EmptyState text="Žádná lokalita ani účastník neodpovídá filtru." /> : null}
          </>
      }
    </div>
  );
}

// ─── Registry Section ──────────────────────────────────────────────────────────

type RegistryView = 'all' | 'active' | 'alumni';
type RegistryChartBucket = { month: string; label: string; krouzek: number; tabor: number; workshop: number };

function buildRegistryChartData(paymentRows: AdminPaymentRow[]): RegistryChartBucket[] {
  const today = new Date();
  const buckets: RegistryChartBucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('cs-CZ', { month: 'short', year: '2-digit' });
    buckets.push({ month: key, label, krouzek: 0, tabor: 0, workshop: 0 });
  }
  for (const row of paymentRows) {
    if (!row.dueDate) continue;
    const monthKey = row.dueDate.slice(0, 7);
    const bucket = buckets.find((b) => b.month === monthKey);
    if (!bucket) continue;
    const t = (row.title ?? '').toLowerCase();
    if (t.includes('tábor') || t.includes('tabor')) bucket.tabor++;
    else if (t.includes('workshop')) bucket.workshop++;
    else bucket.krouzek++;
  }
  return buckets;
}

function RegistrySection({ participants, paymentRows, onOpenParticipantDetail }: { participants: AdminParticipant[]; paymentRows: AdminPaymentRow[]; onOpenParticipantDetail: (p: ParentParticipant, type: ActivityType, place: string) => void }) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<RegistryView>('all');
  const today = new Date().toISOString().slice(0, 10);
  const chartData = useMemo(() => buildRegistryChartData(paymentRows), [paymentRows]);

  const alumniParticipants = useMemo(() => participants.filter((p) => {
    const a = p as AdminParticipant;
    return a.courseExpiresAt !== undefined && a.courseExpiresAt !== null && a.courseExpiresAt < today;
  }), [participants, today]);

  const activeParticipants = useMemo(() => participants.filter((p) => {
    const a = p as AdminParticipant;
    const hasValidCourse = a.courseExpiresAt === null || (a.courseExpiresAt !== undefined && a.courseExpiresAt >= today);
    const hasAnyPurchase = p.activePurchases.length > 0;
    return hasValidCourse || hasAnyPurchase;
  }), [participants, today]);

  const displayList = useMemo(() => {
    const base = view === 'alumni' ? alumniParticipants : view === 'active' ? activeParticipants : participants;
    if (!query.trim()) return base;
    return base.filter((p) => matchesQuery(`${p.firstName} ${p.lastName} ${p.activeCourse} ${(p as AdminParticipant).parentName ?? ''} ${(p as AdminParticipant).parentEmail ?? ''}`, query));
  }, [view, query, participants, activeParticipants, alumniParticipants]);

  const totalAttendance = participants.reduce((sum, p) => sum + p.attendanceDone, 0);
  const avgLevel = participants.length > 0 ? (participants.reduce((sum, p) => sum + p.level, 0) / participants.length).toFixed(1) : '–';

  return (
    <div className="space-y-5">
      {/* Summary metrics */}
      <Panel className="p-5">
        <SectionTitle icon={<ListChecks size={18} />} title="Registr všech účastníků" subtitle="kompletní přehled od spuštění · aktivní, absolventi a statistiky docházky" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric value={String(participants.length)} label="celkem přihlášených" />
          <Metric value={String(activeParticipants.length)} label="aktivních" />
          <Metric value={String(alumniParticipants.length)} label="absolventů" />
          <Metric value={String(totalAttendance)} label="docházek dohromady" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric value={avgLevel} label="průměrný level" />
          <Metric value={String(participants.filter((p) => p.xp > 0).length)} label="s XP" />
          <Metric value={String(participants.filter((p) => (p as AdminParticipant).parentEmail).length)} label="s kontaktem rodiče" />
          <Metric value={String(paymentRows.length)} label="zaplacených nákupů" />
        </div>
      </Panel>

      {/* Chart */}
      <RegistryChart data={chartData} />

      {/* Activity type breakdown */}
      <RegistryActivityBreakdown participants={participants} />

      {/* Participants list */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {([
              { key: 'all' as const, label: 'Všichni', count: participants.length },
              { key: 'active' as const, label: 'Aktivní', count: activeParticipants.length },
              { key: 'alumni' as const, label: 'Absolventi', count: alumniParticipants.length },
            ]).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setView(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-[13px] px-3.5 py-2 text-xs font-black transition ${view === tab.key ? 'bg-brand-purple text-white shadow-brand' : 'border border-brand-purple/15 bg-white text-brand-ink-soft hover:bg-brand-purple/5 hover:text-brand-purple'}`}
              >
                {tab.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${view === tab.key ? 'bg-white/20 text-white' : 'bg-brand-paper text-brand-ink-soft'}`}>{tab.count}</span>
              </button>
            ))}
          </div>
          <SearchField value={query} onChange={setQuery} placeholder="Hledat jméno, rodiče, lokalitu..." />
      </div>

      {view === 'alumni' ? (
        <Panel className="p-4">
          <div className="mb-4 flex items-start gap-3 rounded-[14px] border border-amber-200 bg-amber-50 p-3">
            <History size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-black text-amber-800">Absolventi s vypršenou permicí</p>
              <p className="mt-0.5 text-xs font-bold text-amber-700">Tito účastníci měli v minulosti aktivní kroužek, ale jejich poslední permice vypršela. Nemají žádnou aktivní aktivitu.</p>
            </div>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {displayList.map((p) => (
          <RegistryParticipantCard
            key={p.id}
            participant={p as AdminParticipant}
            today={today}
            onOpen={() => {
              const type: ActivityType = p.activePurchases[0]?.type ?? 'Krouzek';
              const place = (p as AdminParticipant).activeCourse || '';
              onOpenParticipantDetail(p, type, place);
            }}
          />
        ))}
      </div>
      {displayList.length === 0 ? <EmptyState text="Žádný účastník neodpovídá filtru." /> : null}
    </div>
  );
}

function RegistryChart({ data }: { data: RegistryChartBucket[] }) {
  const { flags } = useFeatureFlags();
  const totalOf = (d: RegistryChartBucket) => d.krouzek + (flags.trainer_camps ? d.tabor : 0) + (flags.trainer_workshop_registration ? d.workshop : 0);
  const maxVal = Math.max(...data.map((d) => totalOf(d)), 1);
  const totalPurchases = data.reduce((sum, d) => sum + totalOf(d), 0);

  return (
    <Panel className="p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <SectionTitle icon={<BarChart2 size={18} />} title="Nákupy po měsících" subtitle="počet zaplacených registrací za posledních 12 měsíců · rozděleno podle typu aktivity" />
        <div className="shrink-0">
          <Metric value={String(totalPurchases)} label="nákupů v období" />
        </div>
      </div>
      <div className="mt-5 flex items-end gap-1 overflow-x-auto pb-1" style={{ height: 160 }}>
        {data.map((d) => {
          const total = totalOf(d);
          const totalH = Math.max(total > 0 ? 8 : 2, Math.round((total / maxVal) * 120));
          const krouzekH = total > 0 ? Math.round((d.krouzek / total) * totalH) : 0;
          const taborH = total > 0 && flags.trainer_camps ? Math.round((d.tabor / total) * totalH) : 0;
          const workshopH = flags.trainer_workshop_registration ? totalH - krouzekH - taborH : 0;
          const titleParts = [`${d.krouzek} kroužek`, flags.trainer_camps ? `${d.tabor} tábor` : null, flags.trainer_workshop_registration ? `${d.workshop} workshop` : null].filter(Boolean).join(', ');
          return (
            <div key={d.month} className="group flex flex-1 min-w-[36px] flex-col items-center gap-1" title={`${d.label}: ${total} nákupů (${titleParts})`}>
              <span className="text-[10px] font-black text-brand-ink-soft">{total > 0 ? total : ''}</span>
              <div className="flex w-full flex-1 flex-col-reverse items-stretch justify-start overflow-hidden rounded-t-[5px]">
                {krouzekH > 0 ? <div className="w-full shrink-0 bg-brand-purple/85" style={{ height: krouzekH }} /> : null}
                {taborH > 0 ? <div className="w-full shrink-0 bg-brand-cyan/85" style={{ height: taborH }} /> : null}
                {workshopH > 0 ? <div className="w-full shrink-0 bg-brand-orange/80" style={{ height: workshopH }} /> : null}
                {total === 0 ? <div className="w-full shrink-0 bg-brand-purple/10 rounded-t-[5px]" style={{ height: 4 }} /> : null}
              </div>
              <span className="text-[9px] font-bold text-brand-ink-soft truncate w-full text-center">{d.label}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {([
          { color: 'bg-brand-purple/85', label: 'Kroužek', show: true },
          { color: 'bg-brand-cyan/85', label: 'Tábor', show: flags.trainer_camps },
          { color: 'bg-brand-orange/80', label: 'Workshop', show: flags.trainer_workshop_registration },
        ]).filter((item) => item.show).map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-ink-soft">
            <span className={`h-2.5 w-2.5 rounded-[3px] ${item.color}`} />
            {item.label}
          </span>
        ))}
      </div>
    </Panel>
  );
}

function RegistryActivityBreakdown({ participants }: { participants: AdminParticipant[] }) {
  const { flags } = useFeatureFlags();
  const krouzekCount = participants.filter((p) => p.activePurchases.some((pur) => pur.type === 'Krouzek')).length;
  const taborCount = participants.filter((p) => p.activePurchases.some((pur) => pur.type === 'Tabor')).length;
  const workshopCount = participants.filter((p) => p.activePurchases.some((pur) => pur.type === 'Workshop')).length;
  const total = participants.length || 1;

  const rows = [
    { label: 'Kroužek', count: krouzekCount, color: 'bg-brand-purple', pct: Math.round((krouzekCount / total) * 100) },
    ...(flags.trainer_camps ? [{ label: 'Tábor', count: taborCount, color: 'bg-brand-cyan', pct: Math.round((taborCount / total) * 100) }] : []),
    ...(flags.trainer_workshop_registration ? [{ label: 'Workshop', count: workshopCount, color: 'bg-brand-orange', pct: Math.round((workshopCount / total) * 100) }] : []),
  ];

  const totalAttWithCourse = participants.filter((p) => p.attendanceTotal > 0);
  const avgAttPct = totalAttWithCourse.length > 0
    ? Math.round(totalAttWithCourse.reduce((sum, p) => sum + Math.round((p.attendanceDone / p.attendanceTotal) * 100), 0) / totalAttWithCourse.length)
    : 0;

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Panel className="p-5">
        <SectionTitle icon={<Users size={18} />} title="Rozdělení podle aktivity" subtitle="kolik účastníků má daný typ aktivit v nákupní historii" />
        <div className="mt-4 space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-xs font-bold text-brand-ink-soft">{row.label}</span>
              <div className="min-w-0 flex-1 h-2 overflow-hidden rounded-full bg-brand-paper">
                <div className={`h-full rounded-full transition-all ${row.color}`} style={{ width: `${Math.max(row.pct, row.count > 0 ? 4 : 0)}%` }} />
              </div>
              <span className="w-16 shrink-0 text-right text-xs font-bold text-brand-ink">{row.count} <span className="font-normal text-brand-ink-soft">({row.pct} %)</span></span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel className="p-5">
        <SectionTitle icon={<History size={18} />} title="Průměrná docházka" subtitle="procento odchozených lekcí z celku u kroužků" />
        <div className="mt-4 flex flex-col items-center justify-center gap-3" style={{ minHeight: 100 }}>
          {totalAttWithCourse.length === 0 ? (
            <p className="text-sm font-bold text-brand-ink-soft">Zatím nemáme data o docházce.</p>
          ) : (
            <>
              <span className="text-5xl font-black text-brand-purple">{avgAttPct} %</span>
              <p className="text-sm font-bold text-brand-ink-soft">z {totalAttWithCourse.length} účastníků s kroužkem</p>
              <div className="w-full">
                <div className="h-3 overflow-hidden rounded-full bg-brand-paper">
                  <div className="h-full rounded-full bg-brand-purple transition-all" style={{ width: `${avgAttPct}%` }} />
                </div>
              </div>
              <div className="grid w-full grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-base font-black text-brand-ink">{participants.filter((p) => p.attendanceTotal > 0 && Math.round((p.attendanceDone / p.attendanceTotal) * 100) >= 80).length}</p>
                  <p className="text-[10px] font-bold text-brand-ink-soft">≥ 80 %</p>
                </div>
                <div>
                  <p className="text-base font-black text-brand-ink">{participants.filter((p) => p.attendanceTotal > 0 && Math.round((p.attendanceDone / p.attendanceTotal) * 100) >= 50 && Math.round((p.attendanceDone / p.attendanceTotal) * 100) < 80).length}</p>
                  <p className="text-[10px] font-bold text-brand-ink-soft">50–79 %</p>
                </div>
                <div>
                  <p className="text-base font-black text-brand-ink">{participants.filter((p) => p.attendanceTotal > 0 && Math.round((p.attendanceDone / p.attendanceTotal) * 100) < 50).length}</p>
                  <p className="text-[10px] font-bold text-brand-ink-soft">&lt; 50 %</p>
                </div>
              </div>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}

function RegistryParticipantCard({ participant, today, onOpen }: { participant: AdminParticipant; today: string; onOpen: () => void }) {
  const isAlumni = participant.courseExpiresAt !== undefined && participant.courseExpiresAt !== null && participant.courseExpiresAt < today;
  const hasActivePermice = participant.courseExpiresAt === null || (participant.courseExpiresAt !== undefined && participant.courseExpiresAt >= today) || participant.activePurchases.length > 0;
  const status = isAlumni
    ? { label: 'Absolvent', tone: 'orange' as const }
    : hasActivePermice
      ? { label: 'Aktivní', tone: 'mint' as const }
      : { label: 'Bez permice', tone: 'neutral' as const };
  const activityTypes = [...new Set(participant.activePurchases.map((pur) => activityLabel(pur.type)))];
  const contact = participant.parentPhone || participant.parentEmail || '';

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group w-full rounded-[16px] border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-brand-soft ${isAlumni ? 'border-brand-purple/10 bg-brand-paper' : 'border-brand-purple/10 bg-white'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-black text-brand-ink">{participant.firstName} {participant.lastName}</p>
          {participant.activeCourse ? <p className="mt-0.5 truncate text-xs font-bold text-brand-ink-soft">{participant.activeCourse}</p> : null}
        </div>
        <StatusPill label={status.label} tone={status.tone} />
      </div>
      <div className="mt-3 text-xs font-bold text-brand-ink-soft">
        Docházka <span className="font-black text-brand-ink">{participant.attendanceTotal > 0 ? `${participant.attendanceDone}/${participant.attendanceTotal} lekcí` : 'zatím žádná'}</span>
      </div>
      {activityTypes.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {activityTypes.map((type) => (
            <span key={type} className="rounded-full bg-brand-purple/10 px-2 py-0.5 text-[10px] font-black text-brand-purple">{type}</span>
          ))}
        </div>
      ) : null}
      {contact ? <p className="mt-2 truncate text-[11px] font-bold text-brand-ink-soft">{participant.parentName ? `${participant.parentName} · ` : ''}{contact}</p> : null}
      {participant.courseExpiresAt ? (
        <p className={`mt-1 text-[11px] font-bold ${isAlumni ? 'text-brand-pink' : 'text-emerald-600'}`}>
          {isAlumni ? 'Permice vypršela' : 'Platná do'}: {new Date(participant.courseExpiresAt).toLocaleDateString('cs-CZ')}
        </p>
      ) : participant.courseExpiresAt === null ? (
        <p className="mt-1 text-[11px] font-bold text-emerald-600">Permice bez omezení</p>
      ) : null}
    </button>
  );
}

// ─── End of Registry Section ───────────────────────────────────────────────────

function CoachesSection({ products, coaches, coachAttendanceRecords, dppDocuments, orgDppTemplate, orgId, sharedTrainingSlots, workshopSlots, campTurnusy, onAddCoachAttendance, onCreateCoachDpp, onMarkCoachDppSigned, onMarkCoachDppPhysical, onCoachLocationSaved, onReleaseSharedTraining, onAssignSharedTraining, onAddWorkshopCoach, onRemoveWorkshopCoach, onAddWorkshopSlot, onAddCampCoach, onRemoveCampCoach }: { products: ParentProduct[]; coaches: AdminCoachSummary[]; coachAttendanceRecords: CoachAttendanceRecord[]; dppDocuments: AdminCoachDppDocument[]; orgDppTemplate: OrgDppTemplate | null; orgId?: string | null; sharedTrainingSlots: SharedTrainingSlot[]; workshopSlots: WorkshopSlot[]; campTurnusy: CampTurnus[]; onAddCoachAttendance: (input: ManualCoachAttendanceInput) => CoachAttendanceRecord; onCreateCoachDpp: (coach: AdminCoachSummary) => AdminCoachDppDocument; onMarkCoachDppSigned: (coachId: string) => void; onMarkCoachDppPhysical: (coachId: string) => void; onCoachLocationSaved: (coachId: string, location: string) => void; onReleaseSharedTraining: (slot: SharedTrainingSlot, position?: 'first' | 'second') => void; onAssignSharedTraining: (slot: SharedTrainingSlot, coach: AdminCoachSummary) => void; onAddWorkshopCoach: (slot: WorkshopSlot, coach: AdminCoachSummary) => void; onRemoveWorkshopCoach: (slot: WorkshopSlot, coachId: string) => void; onAddWorkshopSlot: (date: string, city: WorkshopCity) => void; onAddCampCoach: (turnus: CampTurnus, coach: AdminCoachSummary) => void; onRemoveCampCoach: (turnus: CampTurnus, coachId: string) => void }) {
  const { flags } = useFeatureFlags();
  const [query, setQuery] = useState('');
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'placements' | 'leaderboard'>('placements');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Krouzek' | 'Tabor' | 'Workshop'>('all');
  const placementGroups = useMemo(() => buildCoachPlacementGroups(coaches, products, query), [coaches, products, query]);
  const xpCoachCount = coaches.filter((coach) => coach.xp > 0).length;
  const courseGroups = placementGroups.filter((group) => group.type === 'Krouzek');
  const campGroups = placementGroups.filter((group) => group.type === 'Tabor');
  const workshopGroups = placementGroups.filter((group) => group.type === 'Workshop');
  const signedCount = coaches.filter((coach) => { const s = dppStatusForCoach(coach.id, dppDocuments); return s === 'signed' || s === 'physical'; }).length;
  const selectedCoach = selectedCoachId ? coaches.find((coach) => coach.id === selectedCoachId) : null;
  const assignedCoachIds = useMemo(() => {
    const ids = new Set<string>();
    for (const product of products) {
      for (const id of product.coachIds ?? []) ids.add(id);
    }
    return ids;
  }, [products]);
  const unassignedCoaches = useMemo(() => {
    const base = coaches.filter((coach) => !assignedCoachIds.has(coach.id));
    if (!query) return base;
    return base.filter((coach) => matchesQuery(`${coach.name} ${coach.email} ${coach.phone} ${coach.locations.join(' ')}`, query));
  }, [coaches, assignedCoachIds, query]);

  const TYPE_TABS: { key: 'all' | 'Krouzek' | 'Tabor' | 'Workshop'; label: string; count: number }[] = [
    { key: 'all', label: 'Vše', count: placementGroups.length },
    { key: 'Krouzek', label: 'Kroužky', count: courseGroups.length },
    { key: 'Tabor', label: 'Tábory', count: campGroups.length },
    ...(flags.trainer_workshop_registration ? [{ key: 'Workshop' as const, label: 'Workshopy', count: workshopGroups.length }] : []),
  ];

  return (
    <div className="space-y-5">
      <Panel className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <SectionTitle icon={<UserCheck size={18} />} title="Trenéři podle míst" subtitle={`krátký přehled po lokalitách, detail se otevře v modalu · ${signedCount}/${coaches.length} DPP podepsáno`} />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
            <div className="inline-flex rounded-[16px] border border-brand-purple/15 bg-white p-1 shadow-brand-soft">
              {[
                { key: 'placements' as const, label: 'Lokality' },
                { key: 'leaderboard' as const, label: `Nejlepší XP · ${xpCoachCount}` },
              ].map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setViewMode(mode.key)}
                  className={`rounded-[12px] px-3.5 py-2 text-xs font-black transition ${viewMode === mode.key ? 'bg-brand-purple text-white shadow-brand' : 'text-brand-ink-soft hover:bg-brand-purple/5 hover:text-brand-purple'}`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <SearchField value={query} onChange={setQuery} placeholder="Hledat trenéra, lokalitu..." />
          </div>
        </div>
      </Panel>

      {viewMode === 'leaderboard' ? (
        <CoachXpLeaderboardPanel products={products} coaches={coaches} coachAttendanceRecords={coachAttendanceRecords} query={query} onOpenCoach={setSelectedCoachId} />
      ) : (
        <>
          <div className={`grid gap-5${flags.trainer_workshop_registration ? ' xl:grid-cols-2' : ''}`}>
            <SharedTrainerCalendarPanel slots={sharedTrainingSlots} coaches={coaches} onRelease={onReleaseSharedTraining} onAssign={onAssignSharedTraining} />
            {flags.trainer_workshop_registration ? <WorkshopCalendarPanel slots={workshopSlots} products={products} coaches={coaches} onAddCoach={onAddWorkshopCoach} onRemoveCoach={onRemoveWorkshopCoach} onAddSlot={onAddWorkshopSlot} /> : null}
          </div>

          {unassignedCoaches.length > 0 && (
            <Panel className="p-5">
              <SectionTitle icon={<Users size={18} />} title="Nepřiřazení trenéři" subtitle={`${unassignedCoaches.length} trenér${unassignedCoaches.length === 1 ? '' : 'ů'} je registrováno, zatím bez přiřazeného produktu`} />
              <div className="mt-4 grid gap-2">
                {unassignedCoaches.map((coach) => {
                  const dppDoc = documentForCoach(coach, dppDocuments);
                  return (
                    <button
                      key={coach.id}
                      type="button"
                      onClick={() => setSelectedCoachId(coach.id)}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[15px] border border-brand-purple/10 bg-white px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-brand-purple/30 hover:shadow-brand-soft"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-brand-purple-light text-sm font-black text-brand-purple-deep">{initialsForName(coach.name)}</span>
                        <span className="min-w-0">
                          <span className="block text-sm font-black leading-tight text-brand-ink">{coach.name}</span>
                          <span className="mt-1 block text-xs font-bold leading-tight text-brand-ink-soft">{coach.email}</span>
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <StatusPill label={coachStatusLabel(coach.status)} tone={coach.status === 'Aktivni' ? 'mint' : 'orange'} />
                        <StatusPill label={coachDppStatusLabel(dppDoc.status)} tone={coachDppStatusTone(dppDoc.status)} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </Panel>
          )}

          <Panel className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              {TYPE_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setTypeFilter(tab.key)}
                  className={`inline-flex items-center gap-1.5 rounded-[13px] px-3.5 py-2 text-xs font-black transition ${
                    typeFilter === tab.key
                      ? 'bg-brand-purple text-white shadow-brand'
                      : 'border border-brand-purple/15 bg-white text-brand-ink-soft hover:bg-brand-purple/5 hover:text-brand-purple'
                  }`}
                >
                  {tab.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${typeFilter === tab.key ? 'bg-white/20 text-white' : 'bg-brand-paper text-brand-ink-soft'}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </Panel>

          {(typeFilter === 'all' || typeFilter === 'Krouzek') && (typeFilter === 'Krouzek') && (
            <CoachPlacementSection title="Kroužky podle míst" subtitle="lokalita, den a přiřazený trenér" groups={courseGroups} emptyText="Pro zadaný filtr není žádný kroužek ani trenér." dppDocuments={dppDocuments} coachAttendanceRecords={coachAttendanceRecords} onOpenCoach={setSelectedCoachId} />
          )}
          {typeFilter === 'Tabor' && (
            <CoachPlacementSection title="Tábory" subtitle="turnusy a táboroví trenéři" groups={campGroups} emptyText="Pro zadaný filtr není žádný táborový trenér." dppDocuments={dppDocuments} coachAttendanceRecords={coachAttendanceRecords} onOpenCoach={setSelectedCoachId} />
          )}
          {typeFilter === 'Workshop' && flags.trainer_workshop_registration && (
            <WorkshopCityCoachSection groups={workshopGroups} dppDocuments={dppDocuments} coachAttendanceRecords={coachAttendanceRecords} onOpenCoach={setSelectedCoachId} />
          )}
          {typeFilter === 'all' && (
            <div className="grid items-start gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <CoachPlacementSection title="Kroužky podle míst" subtitle="lokalita, den a přiřazený trenér" groups={courseGroups} emptyText="Pro zadaný filtr není žádný kroužek ani trenér." dppDocuments={dppDocuments} coachAttendanceRecords={coachAttendanceRecords} onOpenCoach={setSelectedCoachId} />
              <div className="space-y-5">
                <CoachPlacementSection title="Tábory" subtitle="turnusy a táboroví trenéři" groups={campGroups} emptyText="Pro zadaný filtr není žádný táborový trenér." dppDocuments={dppDocuments} coachAttendanceRecords={coachAttendanceRecords} onOpenCoach={setSelectedCoachId} compact />
                {flags.trainer_workshop_registration ? <WorkshopCityCoachSection groups={workshopGroups} dppDocuments={dppDocuments} coachAttendanceRecords={coachAttendanceRecords} onOpenCoach={setSelectedCoachId} /> : null}
              </div>
            </div>
          )}
        </>
      )}
      {selectedCoach ? (
        <DetailModal title={selectedCoach.name} subtitle={`${coachStatusLabel(selectedCoach.status)} · ${selectedCoach.locations.join(' · ')}`} onClose={() => setSelectedCoachId(null)}>
          <CoachDetailCard products={products} coach={selectedCoach} coachAttendanceRecords={coachAttendanceRecords} dppDocument={documentForCoach(selectedCoach, dppDocuments, orgDppTemplate)} onAddCoachAttendance={onAddCoachAttendance} onCreateCoachDpp={onCreateCoachDpp} onMarkCoachDppSigned={onMarkCoachDppSigned} onMarkCoachDppPhysical={onMarkCoachDppPhysical} onCoachLocationSaved={onCoachLocationSaved} />
        </DetailModal>
      ) : null}
    </div>
  );
}

function CoachXpLeaderboardPanel({ products, coaches, coachAttendanceRecords, query, onOpenCoach }: { products: ParentProduct[]; coaches: AdminCoachSummary[]; coachAttendanceRecords: CoachAttendanceRecord[]; query: string; onOpenCoach: (coachId: string) => void }) {
  const rows = buildCoachXpLeaderboard(coaches, products, coachAttendanceRecords)
    .filter((row) => matchesQuery(`${row.coach.name} ${row.coach.email} ${row.coach.locations.join(' ')} ${row.assignedProducts.map((product) => `${product.title} ${product.place}`).join(' ')}`, query));
  const maxXp = Math.max(...rows.map((row) => row.xp), 1);
  const totalXp = rows.reduce((sum, row) => sum + row.xp, 0);
  const activeRows = rows.filter((row) => row.xp > 0);
  const leader = rows[0];

  return (
    <Panel className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionTitle icon={<Trophy size={18} />} title="Nejlepší trenéři podle XP" subtitle={`${activeRows.length}/${coaches.length} trenérů má XP · skutečný stav z trenérských profilů`} />
        <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
          <Metric value={leader ? `${leader.xp.toLocaleString('cs-CZ')}` : '0'} label="nejvíc XP" />
          <Metric value={`${totalXp.toLocaleString('cs-CZ')}`} label="XP celkem" />
          <Metric value={leader ? `Lv ${leader.level}` : 'Lv 0'} label="top level" />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState text="Žádný trenér neodpovídá filtru." />
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {rows.map((row) => {
            const progress = Math.max(4, Math.round((row.xp / maxXp) * 100));
            const assignedPreview = row.assignedProducts.length > 0
              ? row.assignedProducts.map((product) => product.place).slice(0, 2).join(' · ')
              : row.coach.locations.slice(0, 2).join(' · ');
            const podiumTone = row.rank === 1 ? 'from-brand-orange/24 to-brand-purple/14' : row.rank === 2 ? 'from-brand-cyan/18 to-brand-purple/10' : row.rank === 3 ? 'from-brand-pink/16 to-brand-orange/12' : 'from-white to-brand-paper';

            return (
              <button
                key={row.coach.id}
                type="button"
                onClick={() => onOpenCoach(row.coach.id)}
                className={`group w-full rounded-[18px] border border-brand-purple/10 bg-gradient-to-br ${podiumTone} p-4 text-left shadow-brand-soft transition hover:-translate-y-0.5 hover:border-brand-purple/28 hover:shadow-brand`}
              >
                <div className="grid gap-4 lg:grid-cols-[64px_minmax(0,1fr)_360px] lg:items-center">
                  <div className="flex items-center gap-3 lg:block lg:text-center">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-[16px] bg-brand-purple text-lg font-black text-white shadow-brand">{row.rank}</span>
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-[16px] bg-white text-sm font-black text-brand-purple-deep shadow-sm lg:mt-2">{initialsForName(row.coach.name)}</span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black leading-tight text-brand-ink">{row.coach.name}</h3>
                      <StatusPill label={`Level ${row.level}`} tone={row.xp > 0 ? 'purple' : 'orange'} />
                      <StatusPill label={coachStatusLabel(row.coach.status)} tone={row.coach.status === 'Aktivni' ? 'mint' : 'orange'} />
                    </div>
                    <p className="mt-1 truncate text-sm font-bold text-brand-ink-soft">{assignedPreview || 'Zatím bez přiřazení'}</p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80 ring-1 ring-brand-purple/10">
                      <div className="h-full rounded-full bg-brand-purple transition-all group-hover:bg-brand-purple-deep" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:text-center">
                    <Metric value={row.xp.toLocaleString('cs-CZ')} label="XP" />
                    <Metric value={`${row.coach.qrTricksApproved}`} label="QR triky" />
                    <Metric value={`${row.coach.childrenLogged}`} label="děti" />
                    <Metric value={`${row.assignedProducts.length}`} label="produkty" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

const WEEK_DAY_NAMES_WEB = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];
const WEEK_DAY_ABBR_WEB = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
const CZECH_MONTH_NAMES_WEB = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
// Season runs October (month 9) through June (month 5) of the following year.
// Computed from the current date so the calendar always tracks the live season
// (Jul–Dec => this year's October start; Jan–Jun => last year's October start)
// instead of a hardcoded year that silently goes stale each summer.
function currentSeasonBoundsWeb(reference: Date = new Date()): { start: { year: number; month: number }; end: { year: number; month: number } } {
  const startYear = reference.getMonth() >= 6 ? reference.getFullYear() : reference.getFullYear() - 1;
  return { start: { year: startYear, month: 9 }, end: { year: startYear + 1, month: 5 } };
}
const SEASON_BOUNDS_WEB = currentSeasonBoundsWeb();
const SEASON_START_WEB = SEASON_BOUNDS_WEB.start;
const SEASON_END_WEB = SEASON_BOUNDS_WEB.end;

// Initial calendar month: clamp "now" into the season so the calendar always
// opens on a real season month (and both arrows work), even during the summer
// gap between seasons.
function initialSeasonMonthWeb(reference: Date = new Date()): { year: number; month: number } {
  const value = reference.getFullYear() * 12 + reference.getMonth();
  const startValue = SEASON_START_WEB.year * 12 + SEASON_START_WEB.month;
  const endValue = SEASON_END_WEB.year * 12 + SEASON_END_WEB.month;
  const clamped = Math.min(Math.max(value, startValue), endValue);
  return { year: Math.floor(clamped / 12), month: clamped % 12 };
}

function slotDayIndicesWeb(dayStr: string): number[] {
  return dayStr.split(/\s*\/\s*/).map((d) => WEEK_DAY_NAMES_WEB.indexOf(d.trim())).filter((i) => i >= 0);
}
function slotCoachCountWeb(slot: { assignedCoachId?: string; secondCoachId?: string }): number {
  return (slot.assignedCoachId ? 1 : 0) + (slot.secondCoachId ? 1 : 0);
}
function computeEasterWeb(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
function czechHolidaySetWeb(startYear: number): Set<string> {
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const y0 = startYear, y1 = startYear + 1;
  const s = new Set<string>([
    `${y0}-10-28`, `${y0}-11-17`, `${y0}-12-24`, `${y0}-12-25`, `${y0}-12-26`,
    `${y1}-01-01`, `${y1}-05-01`, `${y1}-05-08`,
  ]);
  const easter = computeEasterWeb(y1);
  const gf = new Date(easter); gf.setDate(gf.getDate() - 2);
  const em = new Date(easter); em.setDate(em.getDate() + 1);
  s.add(fmt(gf)); s.add(fmt(em));
  return s;
}
function getMonthGridWeb(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const firstDow = (first.getDay() + 6) % 7;
  const grid: (Date | null)[][] = [];
  let row: (Date | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= last.getDate(); d++) {
    row.push(new Date(year, month, d));
    if (row.length === 7) { grid.push(row); row = []; }
  }
  if (row.length > 0) { while (row.length < 7) row.push(null); grid.push(row); }
  return grid;
}
function dateKeyWeb(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type SharedTrainingOverrideRow = { id: string; product_id: string; occurrence_date: string; coach_id: string; action: 'add' | 'remove' };
type SharedTrainingOverride = { id: string; productId: string; occurrenceDate: string; coachId: string; action: 'add' | 'remove' };

function SharedTrainerCalendarPanel({ slots, coaches, onRelease, onAssign }: { slots: SharedTrainingSlot[]; coaches: AdminCoachSummary[]; onRelease: (slot: SharedTrainingSlot, position?: 'first' | 'second') => void; onAssign: (slot: SharedTrainingSlot, coach: AdminCoachSummary) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const now = new Date();
  const initialMonthWeb = initialSeasonMonthWeb(now);
  const [calYear, setCalYear] = useState(initialMonthWeb.year);
  const [calMonth, setCalMonth] = useState(initialMonthWeb.month);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // Default scope is "just this day" — per-date overrides never touch the
  // regular weekly roster. Switching to "všechny termíny" replicates the old
  // behavior of writing straight to products.coach_ids (every occurrence).
  const [scope, setScope] = useState<'day' | 'all'>('day');
  const [overrides, setOverrides] = useState<SharedTrainingOverride[]>([]);
  const [savingOverride, setSavingOverride] = useState(false);

  const incompleteCount = slots.filter((s) => slotCoachCountWeb(s) < 2).length;
  const hasSlots = slots.length > 0;
  const activeCoaches = coaches.filter((c) => c.status === 'Aktivni' || c.status === 'Ceka na klic');
  const coachById = useMemo(() => new Map(coaches.map((c) => [c.id, c])), [coaches]);
  const holidays = useMemo(() => czechHolidaySetWeb(SEASON_START_WEB.year), []);
  const grid = useMemo(() => getMonthGridWeb(calYear, calMonth), [calYear, calMonth]);

  const loadOverrides = useCallback(async () => {
    if (!hasSupabaseBrowserConfig() || slots.length === 0) return;
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase
      .from('shared_training_overrides')
      .select('id,product_id,occurrence_date,coach_id,action')
      .in('product_id', slots.map((s) => s.id));
    setOverrides(((data ?? []) as SharedTrainingOverrideRow[]).map((row) => ({
      id: row.id,
      productId: row.product_id,
      occurrenceDate: row.occurrence_date,
      coachId: row.coach_id,
      action: row.action,
    })));
  }, [slots]);

  useEffect(() => {
    if (isOpen) void loadOverrides();
  }, [isOpen, loadOverrides]);

  const ymVal = (y: number, m: number) => y * 12 + m;
  const canGoPrev = ymVal(calYear, calMonth) > ymVal(SEASON_START_WEB.year, SEASON_START_WEB.month);
  const canGoNext = ymVal(calYear, calMonth) < ymVal(SEASON_END_WEB.year, SEASON_END_WEB.month);

  function goPrev() {
    if (!canGoPrev) return;
    setSelectedKey(null);
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); } else setCalMonth((m) => m - 1);
  }
  function goNext() {
    if (!canGoNext) return;
    setSelectedKey(null);
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); } else setCalMonth((m) => m + 1);
  }

  const selectedSlotId = selectedKey ? selectedKey.split('|')[0] : null;
  const selectedDateKey = selectedKey ? selectedKey.split('|')[1] : null;
  const selectedSlot = selectedSlotId ? slots.find((s) => s.id === selectedSlotId) ?? null : null;

  // Merge the slot's permanent weekly roster with any per-date overrides for
  // the selected date, so a single substitute/absence never touches the
  // regular weekly assignment.
  const effectiveCoaches = useMemo(() => {
    if (!selectedSlot || !selectedDateKey) return [] as Array<{ id: string; name: string; isBase: boolean }>;
    const dateOverrides = overrides.filter((o) => o.productId === selectedSlot.id && o.occurrenceDate === selectedDateKey);
    const removedIds = new Set(dateOverrides.filter((o) => o.action === 'remove').map((o) => o.coachId));
    const addedOverrides = dateOverrides.filter((o) => o.action === 'add');

    const result: Array<{ id: string; name: string; isBase: boolean }> = [];
    if (selectedSlot.assignedCoachId && !removedIds.has(selectedSlot.assignedCoachId)) {
      result.push({ id: selectedSlot.assignedCoachId, name: selectedSlot.assignedCoachName ?? '—', isBase: true });
    }
    if (selectedSlot.secondCoachId && !removedIds.has(selectedSlot.secondCoachId)) {
      result.push({ id: selectedSlot.secondCoachId, name: selectedSlot.secondCoachName ?? '—', isBase: true });
    }
    for (const o of addedOverrides) {
      if (result.some((r) => r.id === o.coachId)) continue;
      result.push({ id: o.coachId, name: coachById.get(o.coachId)?.name ?? 'Trenér', isBase: false });
    }
    return result.slice(0, 2);
  }, [selectedSlot, selectedDateKey, overrides, coachById]);

  async function upsertDateOverride(coachId: string, action: 'add' | 'remove') {
    if (!selectedSlot || !selectedDateKey || !hasSupabaseBrowserConfig()) return;
    setSavingOverride(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const orgId = await currentAdminOrgId(supabase);
      await supabase.from('shared_training_overrides').upsert(
        { org_id: orgId, product_id: selectedSlot.id, occurrence_date: selectedDateKey, coach_id: coachId, action },
        { onConflict: 'product_id,occurrence_date,coach_id' },
      );
      await loadOverrides();
    } finally {
      setSavingOverride(false);
    }
  }

  async function clearDateOverride(coachId: string) {
    if (!selectedSlot || !selectedDateKey || !hasSupabaseBrowserConfig()) return;
    setSavingOverride(true);
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.from('shared_training_overrides').delete()
        .eq('product_id', selectedSlot.id).eq('occurrence_date', selectedDateKey).eq('coach_id', coachId);
      await loadOverrides();
    } finally {
      setSavingOverride(false);
    }
  }

  async function handleReleaseClick(coach: { id: string; isBase: boolean }, position: 'first' | 'second') {
    if (!selectedSlot) return;
    if (scope === 'all') {
      if (coach.isBase) onRelease(selectedSlot, position);
      return;
    }
    // "Jen tento den": a base coach gets a per-date 'remove' override; a
    // substitute added only for this date is simply un-added again.
    if (coach.isBase) await upsertDateOverride(coach.id, 'remove');
    else await clearDateOverride(coach.id);
  }

  async function handleAssignClick(coach: AdminCoachSummary) {
    if (!selectedSlot) return;
    if (scope === 'all') {
      onAssign(selectedSlot, coach);
      return;
    }
    const isBaseCoach = coach.id === selectedSlot.assignedCoachId || coach.id === selectedSlot.secondCoachId;
    // "Jen tento den": if they're already the regular coach (just previously
    // removed for this date), undo that; otherwise add them as a substitute
    // for just this date.
    if (isBaseCoach) await clearDateOverride(coach.id);
    else await upsertDateOverride(coach.id, 'add');
  }

  const closeModal = () => { setIsOpen(false); setSelectedKey(null); };

  return (
    <>
    <button type="button" onClick={() => setIsOpen(true)} className="flex w-full flex-col items-center justify-center gap-3 rounded-[22px] border border-brand-purple/10 bg-white p-6 shadow-sm transition hover:border-brand-purple/25 hover:shadow-brand-soft">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-purple/10 text-brand-purple"><CalendarDays size={22} /></span>
      <span className="text-base font-black text-brand-ink">Kroužky</span>
      <span className={`text-2xl font-black ${!hasSlots ? 'text-brand-ink-soft' : incompleteCount > 0 ? 'text-brand-pink' : 'text-[#1FB37A]'}`}>{!hasSlots ? '–' : incompleteCount > 0 ? incompleteCount : '✓'}</span>
      <span className="text-xs font-bold text-brand-ink-soft">{!hasSlots ? 'žádné kroužky' : incompleteCount > 0 ? 'neúplných' : 'vše obsazeno'}</span>
    </button>

    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="shared-backdrop"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={closeModal}
          />
          {/* Modal */}
          <motion.div
            key="shared-modal"
            className="fixed inset-x-4 top-[3vh] z-50 mx-auto flex max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" style={{ maxHeight: '94vh' }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            {/* Modal header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-brand-purple/8 bg-white px-6 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <SectionTitle icon={<CalendarDays size={18} />} title="Sdílený kalendář tréninků" subtitle="říjen – červen · 2 trenéři na trénink · svátky = volno" />
                <div className="flex flex-wrap gap-2">
                  <StatusPill label={`${slots.length} vzorů`} tone="purple" />
                  <StatusPill label={!hasSlots ? 'Žádné kroužky' : incompleteCount > 0 ? `${incompleteCount} neúplných` : 'Vše obsazeno'} tone={!hasSlots ? 'purple' : incompleteCount > 0 ? 'pink' : 'mint'} />
                </div>
              </div>
              <button type="button" onClick={closeModal} className="ml-4 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-paper text-brand-ink-soft transition hover:bg-brand-purple/10 hover:text-brand-purple">
                <ChevronDown size={16} className="rotate-180" />
              </button>
            </div>
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 pb-8 pt-5">
          <>
          {/* Month navigation */}
          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              disabled={!canGoPrev}
              onClick={goPrev}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-purple/20 bg-white text-brand-purple transition hover:bg-brand-purple/5 disabled:opacity-30"
            >
              <ChevronDown size={14} className="rotate-90" />
            </button>
            <div className="text-center">
              <p className="text-sm font-black text-brand-purple-deep">{CZECH_MONTH_NAMES_WEB[calMonth]} {calYear}</p>
              <p className="text-[11px] text-brand-ink-soft">sezóna říjen {SEASON_START_WEB.year} – červen {SEASON_END_WEB.year}</p>
            </div>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={goNext}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-purple/20 bg-white text-brand-purple transition hover:bg-brand-purple/5 disabled:opacity-30"
            >
              <ChevronDown size={14} className="-rotate-90" />
            </button>
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-4 text-xs font-bold text-brand-ink-soft">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#1FB37A]" />Obsazeno</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#FFB21A]" />Potřeba 2. trenéra</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#F0445B]" />Bez trenéra</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-ink-soft/20" />Svátek</span>
          </div>

          {/* Day-of-week headers */}
          <div className="mt-4 grid grid-cols-7 gap-1">
            {WEEK_DAY_ABBR_WEB.map((abbr) => (
              <div key={abbr} className="pb-1 text-center text-[11px] font-black uppercase text-brand-purple-deep">{abbr}</div>
            ))}
          </div>

          {/* Calendar date grid */}
          <div className="grid grid-cols-7 gap-1">
            {grid.flat().map((date, idx) => {
              if (!date) return <div key={`empty-${idx}`} className="min-h-[56px]" />;
              const key = dateKeyWeb(date);
              const isHoliday = holidays.has(key);
              const czechIdx = (date.getDay() + 6) % 7;
              const daySlots = isHoliday ? [] : slots.filter((s) => slotDayIndicesWeb(s.day).includes(czechIdx));
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const isToday = date.getTime() === today.getTime();
              const isPast = date < today;
              return (
                <div
                  key={key}
                  className={`min-h-[56px] rounded-xl p-1.5 transition ${
                    isHoliday
                      ? 'bg-brand-paper/70'
                      : daySlots.length > 0
                        ? 'border border-brand-purple/8 bg-white'
                        : 'bg-transparent'
                  }`}
                >
                  <div className={`mb-1 flex items-center justify-end`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black ${
                      isToday ? 'bg-brand-purple text-white' : isPast ? 'text-brand-ink-soft/40' : isHoliday ? 'text-brand-ink-soft/30' : 'text-brand-ink'
                    }`}>
                      {date.getDate()}
                    </span>
                  </div>
                  {isHoliday && <div className="text-center text-[9px] font-bold text-brand-ink-soft/40">svátek</div>}
                  <div className="flex flex-col gap-0.5">
                    {daySlots.map((slot) => {
                      const count = slotCoachCountWeb(slot);
                      const isSelected = selectedKey === `${slot.id}|${key}`;
                      const bg = count === 0 ? 'bg-[#F0445B]' : count === 1 ? 'bg-[#FFB21A]' : 'bg-[#1FB37A]';
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setSelectedKey(isSelected ? null : `${slot.id}|${key}`)}
                          className={`w-full rounded-[5px] px-1 py-0.5 text-left text-[9px] font-black text-white transition hover:opacity-80 ${bg} ${isSelected ? 'ring-2 ring-brand-purple ring-offset-1' : ''}`}
                          title={`${slot.time} · ${slot.place}`}
                        >
                          {slot.time.split(' - ')[0]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected slot detail */}
          {selectedSlot ? (
            <div className="mt-4 rounded-2xl border border-brand-purple/12 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-brand-purple-deep">{selectedSlot.time}</p>
                  <p className="mt-0.5 text-xs font-bold text-brand-ink">{selectedSlot.place}</p>
                  <p className="text-[11px] text-brand-ink-soft">{selectedSlot.group} · {selectedSlot.activityType}</p>
                  {selectedDateKey ? (() => {
                    const [y, m, d] = selectedDateKey.split('-');
                    return <p className="mt-0.5 text-[11px] font-black text-brand-purple">{`${Number(d)}. ${Number(m)}. ${y}`}</p>;
                  })() : null}
                </div>
                <button type="button" onClick={() => setSelectedKey(null)} className="rounded-xl border border-brand-purple/15 bg-brand-paper px-3 py-1.5 text-xs font-black text-brand-purple-deep transition hover:bg-brand-purple/5">
                  Zavřít
                </button>
              </div>

              {/* Scope toggle: does add/remove apply only to this date, or every occurrence of this weekly slot? */}
              <div className="mt-3 grid grid-cols-2 gap-1 rounded-[12px] border border-brand-purple/15 bg-brand-paper p-1">
                <button type="button" onClick={() => setScope('day')} className={`rounded-[9px] px-2 py-1.5 text-[11px] font-black transition ${scope === 'day' ? 'bg-brand-purple text-white' : 'text-brand-purple-deep hover:bg-brand-purple/8'}`}>
                  Jen tento den
                </button>
                <button type="button" onClick={() => setScope('all')} className={`rounded-[9px] px-2 py-1.5 text-[11px] font-black transition ${scope === 'all' ? 'bg-brand-purple text-white' : 'text-brand-purple-deep hover:bg-brand-purple/8'}`}>
                  Všechny termíny
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className={`rounded-xl p-2.5 ${effectiveCoaches[0] ? 'bg-brand-paper' : 'bg-[#F0445B]/8 border border-[#F0445B]/20'}`}>
                  <p className="text-[10px] font-black uppercase text-brand-ink-soft/60">1. Trenér</p>
                  <p className={`mt-0.5 text-xs font-black ${effectiveCoaches[0] ? 'text-brand-ink' : 'text-[#F0445B]'}`}>
                    {effectiveCoaches[0]?.name ?? '—'}
                    {effectiveCoaches[0] && !effectiveCoaches[0].isBase ? <span className="ml-1 rounded-full bg-brand-purple/10 px-1.5 py-0.5 text-[9px] text-brand-purple">jen dnes</span> : null}
                  </p>
                  {effectiveCoaches[0] && (
                    <button type="button" disabled={savingOverride} onClick={() => void handleReleaseClick(effectiveCoaches[0], 'first')} className="mt-1.5 w-full rounded-[8px] border border-[#F0445B]/20 px-2 py-1 text-[10px] font-black text-[#F0445B] transition hover:bg-[#F0445B]/8 disabled:opacity-50">
                      {scope === 'all' && effectiveCoaches[0].isBase ? 'Odebrat ze všech' : 'Uvolnit'}
                    </button>
                  )}
                </div>
                <div className={`rounded-xl p-2.5 ${effectiveCoaches[1] ? 'bg-brand-paper' : 'bg-[#FFB21A]/8 border border-[#FFB21A]/25'}`}>
                  <p className="text-[10px] font-black uppercase text-brand-ink-soft/60">2. Trenér</p>
                  <p className={`mt-0.5 text-xs font-black ${effectiveCoaches[1] ? 'text-brand-ink' : 'text-[#b37200]'}`}>
                    {effectiveCoaches[1]?.name ?? '—'}
                    {effectiveCoaches[1] && !effectiveCoaches[1].isBase ? <span className="ml-1 rounded-full bg-brand-purple/10 px-1.5 py-0.5 text-[9px] text-brand-purple">jen dnes</span> : null}
                  </p>
                  {effectiveCoaches[1] && (
                    <button type="button" disabled={savingOverride} onClick={() => void handleReleaseClick(effectiveCoaches[1], 'second')} className="mt-1.5 w-full rounded-[8px] border border-[#FFB21A]/30 px-2 py-1 text-[10px] font-black text-[#b37200] transition hover:bg-[#FFB21A]/10 disabled:opacity-50">
                      {scope === 'all' && effectiveCoaches[1].isBase ? 'Odebrat ze všech' : 'Uvolnit'}
                    </button>
                  )}
                </div>
              </div>
              {effectiveCoaches.length < 2 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[10px] font-black uppercase text-brand-ink-soft/60">
                    {effectiveCoaches.length > 0 ? 'Přiřadit 2. trenéra' : 'Přiřadit trenéra'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {activeCoaches.filter((c) => !effectiveCoaches.some((e) => e.id === c.id)).map((coach) => (
                      <button
                        key={coach.id}
                        type="button"
                        disabled={savingOverride}
                        onClick={() => void handleAssignClick(coach)}
                        className="rounded-[10px] bg-brand-purple px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-brand-purple-deep disabled:opacity-50"
                      >
                        + {coach.name.split(' ')[0]}{scope === 'day' ? ' (jen dnes)' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-center text-xs text-brand-ink-soft/50">Klikni na trénink v kalendáři pro správu trenérů.</p>
          )}
            </>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}

function WorkshopCalendarPanel({ slots, products, coaches, onAddCoach, onRemoveCoach, onAddSlot }: { slots: WorkshopSlot[]; products: ParentProduct[]; coaches: AdminCoachSummary[]; onAddCoach: (slot: WorkshopSlot, coach: AdminCoachSummary) => void; onRemoveCoach: (slot: WorkshopSlot, coachId: string) => void; onAddSlot: (date: string, city: WorkshopCity) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [cityFilter, setCityFilter] = useState<WorkshopCity>('Brno');
  const now = new Date();
  const initialMonthWeb = initialSeasonMonthWeb(now);
  const [calYear, setCalYear] = useState(initialMonthWeb.year);
  const [calMonth, setCalMonth] = useState(initialMonthWeb.month);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addingSlotDate, setAddingSlotDate] = useState<string | null>(null);
  const [addingSlotCity, setAddingSlotCity] = useState<WorkshopCity>('Brno');

  const ymVal = (y: number, m: number) => y * 12 + m;
  const canGoPrev = ymVal(calYear, calMonth) > ymVal(SEASON_START_WEB.year, SEASON_START_WEB.month);
  const canGoNext = ymVal(calYear, calMonth) < ymVal(SEASON_END_WEB.year, SEASON_END_WEB.month);
  function goPrev() { if (!canGoPrev) return; setSelectedId(null); if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); } else setCalMonth((m) => m - 1); }
  function goNext() { if (!canGoNext) return; setSelectedId(null); if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); } else setCalMonth((m) => m + 1); }
  const grid = useMemo(() => getMonthGridWeb(calYear, calMonth), [calYear, calMonth]);
  const activeCoaches = coaches.filter((c) => c.status === 'Aktivni' || c.status === 'Ceka na klic');
  const filteredSlots = slots.filter((s) => s.city === cityFilter);
  const openCount = filteredSlots.filter((s) => s.coaches.length < s.maxCoaches).length;
  const hasSlots = filteredSlots.length > 0;
  const selectedSlot = selectedId ? slots.find((s) => s.id === selectedId) ?? null : null;

  const CITY_COLORS: Record<WorkshopCity, string> = {
    Brno: 'bg-[#8B1DFF]',
    Praha: 'bg-[#1FB37A]',
    Ostrava: 'bg-[#FFB21A]',
  };
  const CITY_BORDER_COLORS: Record<WorkshopCity, string> = {
    Brno: 'border-[#8B1DFF]/30 bg-[#8B1DFF]/6',
    Praha: 'border-[#1FB37A]/30 bg-[#1FB37A]/6',
    Ostrava: 'border-[#FFB21A]/40 bg-[#FFB21A]/8',
  };

  const closeWsModal = () => { setIsOpen(false); setSelectedId(null); setAddingSlotDate(null); };

  return (
    <>
    <button type="button" onClick={() => setIsOpen(true)} className="flex w-full flex-col items-center justify-center gap-3 rounded-[22px] border border-brand-purple/10 bg-white p-6 shadow-sm transition hover:border-brand-purple/25 hover:shadow-brand-soft">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-purple/10 text-brand-purple"><CalendarDays size={22} /></span>
      <span className="text-base font-black text-brand-ink">Workshopy</span>
      <span className={`text-2xl font-black ${!hasSlots ? 'text-brand-ink-soft' : openCount > 0 ? 'text-brand-pink' : 'text-[#1FB37A]'}`}>{!hasSlots ? '–' : openCount > 0 ? openCount : '✓'}</span>
      <span className="text-xs font-bold text-brand-ink-soft">{!hasSlots ? 'žádné workshopy' : openCount > 0 ? 'neúplných' : 'vše obsazeno'}</span>
    </button>

    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="ws-backdrop"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={closeWsModal}
          />
          <motion.div
            key="ws-modal"
            className="fixed inset-x-4 top-[3vh] z-50 mx-auto flex max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" style={{ maxHeight: '94vh' }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-brand-purple/8 bg-white px-6 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <SectionTitle icon={<CalendarDays size={18} />} title="Sdílený kalendář workshopů" subtitle={`Brno · Praha · Ostrava · ${WORKSHOP_HOURLY_RATE} Kč/h`} />
                <div className="flex flex-wrap gap-2">
                  <StatusPill label={`${slots.length} workshopů`} tone="purple" />
                  <StatusPill label={!hasSlots ? 'Žádné workshopy' : openCount > 0 ? `${openCount} neúplných` : 'Vše obsazeno'} tone={!hasSlots ? 'purple' : openCount > 0 ? 'pink' : 'mint'} />
                </div>
              </div>
              <button type="button" onClick={closeWsModal} className="ml-4 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-paper text-brand-ink-soft transition hover:bg-brand-purple/10 hover:text-brand-purple">
                <ChevronDown size={16} className="rotate-180" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-8 pt-5">
          <>
          {/* City filter */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {(['Brno', 'Praha', 'Ostrava'] as const).map((city) => (
              <button key={city} type="button"
                onClick={() => { setCityFilter(city); setSelectedId(null); }}
                className={`rounded-[11px] px-3 py-1.5 text-xs font-black transition ${cityFilter === city ? 'bg-brand-purple text-white' : 'border border-brand-purple/20 bg-white text-brand-purple hover:bg-brand-purple/5'}`}>
                {city}
              </button>
            ))}
          </div>

          {/* Month nav */}
          <div className="mt-4 flex items-center justify-between">
            <button type="button" disabled={!canGoPrev} onClick={goPrev}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-purple/20 bg-white text-brand-purple transition hover:bg-brand-purple/5 disabled:opacity-30">
              <ChevronDown size={14} className="rotate-90" />
            </button>
            <div className="text-center">
              <p className="text-sm font-black text-brand-purple-deep">{CZECH_MONTH_NAMES_WEB[calMonth]} {calYear}</p>
              <p className="text-[11px] text-brand-ink-soft">klikni na datum pro správu · prázdná data = přidat workshop</p>
            </div>
            <button type="button" disabled={!canGoNext} onClick={goNext}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-purple/20 bg-white text-brand-purple transition hover:bg-brand-purple/5 disabled:opacity-30">
              <ChevronDown size={14} className="-rotate-90" />
            </button>
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-4 text-xs font-bold text-brand-ink-soft">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#8B1DFF]" />Brno</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#1FB37A]" />Praha</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#FFB21A]" />Ostrava</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full border border-brand-purple/20 bg-transparent" />Obsazeno</span>
          </div>

          {/* Day headers */}
          <div className="mt-4 grid grid-cols-7 gap-1">
            {WEEK_DAY_ABBR_WEB.map((abbr) => (
              <div key={abbr} className="pb-1 text-center text-[11px] font-black uppercase text-brand-purple-deep">{abbr}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {grid.flat().map((date, idx) => {
              if (!date) return <div key={`empty-${idx}`} className="min-h-[52px]" />;
              const key = dateKeyWeb(date);
              const daySlots = filteredSlots.filter((s) => s.date === key || s.dateTo === key);
              const todayD = new Date(); todayD.setHours(0, 0, 0, 0);
              const isToday = date.getTime() === todayD.getTime();
              const isPast = date < todayD;
              const isSelected = daySlots.some((s) => s.id === selectedId);
              return (
                <div key={key}
                  className={`min-h-[52px] cursor-pointer rounded-xl p-1.5 transition ${isSelected ? 'ring-2 ring-brand-purple ring-offset-1 bg-brand-purple/5' : daySlots.length > 0 ? 'hover:bg-brand-paper' : 'hover:bg-brand-paper/50'}`}
                  onClick={() => {
                    if (daySlots.length > 0) {
                      // Cycle through slots on this day
                      const currentIdx = daySlots.findIndex((s) => s.id === selectedId);
                      const nextIdx = (currentIdx + 1) % (daySlots.length + 1);
                      if (nextIdx === daySlots.length) { setSelectedId(null); } else { setSelectedId(daySlots[nextIdx].id); }
                      setAddingSlotDate(null);
                    } else if (!isPast) { setAddingSlotDate(addingSlotDate === key ? null : key); setSelectedId(null); }
                  }}
                >
                  <div className="flex justify-end">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black ${isToday ? 'bg-brand-purple text-white' : isPast ? 'text-brand-ink-soft/40' : 'text-brand-ink'}`}>
                      {date.getDate()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {daySlots.map((slot) => {
                      const isFull = slot.coaches.length >= slot.maxCoaches;
                      const hasNone = slot.coaches.length === 0;
                      const cityBg = CITY_COLORS[slot.city];
                      return (
                        <div key={slot.id} className="rounded-[4px] px-1 py-0.5">
                          <div className="flex items-center gap-0.5">
                            <span className={`inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${cityBg}`} />
                            <span className="truncate text-[9px] font-black text-brand-ink">{slot.time.split(' ')[0]}</span>
                          </div>
                          <div className="mt-0.5 flex gap-0.5">
                            {Array.from({ length: slot.maxCoaches }).map((_, i) => (
                              <span
                                key={i}
                                title={slot.coaches[i]?.coachName}
                                className={`inline-block h-1.5 w-1.5 rounded-full ${i < slot.coaches.length ? 'bg-[#1FB37A]' : hasNone ? 'bg-[#F0445B]/60' : 'bg-brand-ink/15'}`}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {daySlots.length === 0 && !isPast && addingSlotDate !== key && (
                      <div className="mt-0.5 text-center text-[9px] text-brand-ink-soft/30">+</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add slot form */}
          {addingSlotDate && (
            <div className="mt-4 rounded-2xl border border-dashed border-brand-purple/30 bg-brand-paper/60 p-4">
              <p className="mb-3 text-xs font-black text-brand-purple-deep">Přidat workshop: {addingSlotDate}</p>
              <div className="flex flex-wrap gap-2">
                {(['Brno', 'Praha', 'Ostrava'] as WorkshopCity[]).map((city) => (
                  <button key={city} type="button"
                    onClick={() => setAddingSlotCity(city)}
                    className={`rounded-[10px] px-3 py-1.5 text-xs font-black transition ${addingSlotCity === city ? 'bg-brand-purple text-white' : 'border border-brand-purple/20 bg-white text-brand-purple'}`}>
                    {city}
                  </button>
                ))}
                <button type="button"
                  onClick={() => { onAddSlot(addingSlotDate, addingSlotCity); setAddingSlotDate(null); }}
                  className="rounded-[10px] bg-brand-purple px-4 py-1.5 text-xs font-black text-white transition hover:bg-brand-purple-deep">
                  Vytvořit
                </button>
                <button type="button" onClick={() => setAddingSlotDate(null)}
                  className="rounded-[10px] border border-brand-purple/15 bg-white px-3 py-1.5 text-xs font-black text-brand-purple-deep">
                  Zrušit
                </button>
              </div>
            </div>
          )}

          {/* Selected slot detail */}
          {selectedSlot ? (
            <div className="mt-4 rounded-2xl border border-brand-purple/12 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className={`mb-1 inline-block rounded-lg px-2 py-0.5 text-xs font-black text-white ${CITY_COLORS[selectedSlot.city]}`}>{selectedSlot.city}</div>
                  {(() => {
                    const product = products.find((p) => p.id === selectedSlot.id);
                    return product ? <p className="text-base font-black text-brand-ink">{product.title}</p> : null;
                  })()}
                  <p className="text-sm font-black text-brand-purple-deep">{selectedSlot.date} · {selectedSlot.time}</p>
                  <p className="mt-0.5 text-xs font-bold text-brand-ink">{selectedSlot.venue}</p>
                  {selectedSlot.notes && <p className="mt-1 text-[11px] italic text-brand-ink-soft">{selectedSlot.notes}</p>}
                  <p className="mt-1 text-[11px] text-brand-ink-soft">{WORKSHOP_HOURLY_RATE} Kč/h · 4 h = {WORKSHOP_HOURLY_RATE * 4} Kč / trenér</p>
                  {/* Show other cities running same day */}
                  {(() => {
                    const sameDaySlots = slots.filter((s) => s.id !== selectedSlot.id && s.date === selectedSlot.date);
                    if (sameDaySlots.length === 0) return null;
                    return (
                      <p className="mt-1.5 text-[11px] font-bold text-[#FFB21A]">
                        ⚠ Tento den probíhá také: {sameDaySlots.map((s) => s.city).join(', ')} — trenér nemůže být na obou místech najednou.
                      </p>
                    );
                  })()}
                </div>
                <button type="button" onClick={() => setSelectedId(null)} className="rounded-xl border border-brand-purple/15 bg-brand-paper px-3 py-1.5 text-xs font-black text-brand-purple-deep hover:bg-brand-purple/5">
                  Zavřít
                </button>
              </div>
              {/* Coach status summary */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {selectedSlot.coaches.length === 0 ? (
                  <span className="rounded-[10px] border border-[#F0445B]/25 bg-[#F0445B]/8 px-2.5 py-1 text-xs font-black text-[#F0445B]">Bez trenérů</span>
                ) : selectedSlot.coaches.length < selectedSlot.maxCoaches ? (
                  <span className="rounded-[10px] border border-[#FFB21A]/30 bg-[#FFB21A]/10 px-2.5 py-1 text-xs font-black text-[#b37200]">{selectedSlot.coaches.length}/{selectedSlot.maxCoaches} trenérů — potřeba doplnit</span>
                ) : (
                  <span className="rounded-[10px] border border-[#1FB37A]/25 bg-[#1FB37A]/10 px-2.5 py-1 text-xs font-black text-[#1FB37A]">Obsazeno {selectedSlot.maxCoaches}/{selectedSlot.maxCoaches}</span>
                )}
                {selectedSlot.coaches.map((c) => (
                  <span key={c.coachId} className="rounded-[10px] bg-brand-purple-light px-2.5 py-1 text-xs font-black text-brand-purple-deep">{c.coachName.split(' ')[0]}</span>
                ))}
              </div>
              {/* 4 coach slots */}
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Array.from({ length: selectedSlot.maxCoaches }).map((_, i) => {
                  const coach = selectedSlot.coaches[i];
                  return (
                    <div key={i} className={`rounded-xl p-2.5 ${coach ? 'bg-brand-paper' : `border border-dashed border-brand-purple/20 bg-transparent`}`}>
                      <p className="text-[9px] font-black uppercase text-brand-ink-soft/60">{i + 1}. trenér</p>
                      {coach ? (
                        <>
                          <p className="mt-0.5 truncate text-xs font-black text-brand-ink">{coach.coachName}</p>
                          <button type="button" onClick={() => onRemoveCoach(selectedSlot, coach.coachId)}
                            className="mt-1 w-full rounded-[7px] border border-[#F0445B]/20 px-1 py-0.5 text-[9px] font-black text-[#F0445B] hover:bg-[#F0445B]/8">
                            Odebrat
                          </button>
                        </>
                      ) : (
                        <p className="mt-0.5 text-[10px] text-brand-ink-soft/40">Volné místo</p>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Assign coach */}
              {selectedSlot.coaches.length < selectedSlot.maxCoaches && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[10px] font-black uppercase text-brand-ink-soft/60">Přiřadit trenéra</p>
                  <div className="flex flex-wrap gap-1.5">
                    {activeCoaches
                      .filter((c) => !selectedSlot.coaches.some((sc) => sc.coachId === c.id))
                      .map((coach) => {
                        const conflictSlot = slots.find((s) => s.id !== selectedSlot.id && s.date === selectedSlot.date && s.coaches.some((sc) => sc.coachId === coach.id));
                        return (
                          <button key={coach.id} type="button"
                            disabled={!!conflictSlot}
                            title={conflictSlot ? `${coach.name.split(' ')[0]} je ten den v ${conflictSlot.city}` : undefined}
                            onClick={() => !conflictSlot && onAddCoach(selectedSlot, coach)}
                            className={`rounded-[10px] px-3 py-1.5 text-[11px] font-black transition ${conflictSlot ? 'cursor-not-allowed border border-brand-purple/15 bg-brand-paper text-brand-ink-soft/40 line-through' : 'bg-brand-purple text-white hover:bg-brand-purple-deep'}`}>
                            {conflictSlot ? `${coach.name.split(' ')[0]} (${conflictSlot.city})` : `+ ${coach.name.split(' ')[0]}`}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          ) : !addingSlotDate && (
            <p className="mt-4 text-center text-xs text-brand-ink-soft/50">Klikni na datum pro správu workshopu · prázdné datum = přidat nový termín.</p>
          )}
            </>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}

function CampCalendarPanel({ turnusy, coaches, onAddCoach, onRemoveCoach }: { turnusy: CampTurnus[]; coaches: AdminCoachSummary[]; onAddCoach: (turnus: CampTurnus, coach: AdminCoachSummary) => void; onRemoveCoach: (turnus: CampTurnus, coachId: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeCoaches = coaches.filter((c) => c.status === 'Aktivni' || c.status === 'Ceka na klic');
  const selectedTurnus = selectedId ? turnusy.find((t) => t.id === selectedId) ?? null : null;
  const totalAssigned = turnusy.reduce((sum, t) => sum + t.coaches.length, 0);
  const openCount = turnusy.filter((t) => t.coaches.length < t.maxCoaches).length;
  const hasTurnusy = turnusy.length > 0;

  const closeCampModal = () => { setIsOpen(false); setSelectedId(null); };

  const formatDate = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}. ${m}. ${y}`;
  };

  return (
    <>
    <Panel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SectionTitle icon={<CalendarDays size={18} />} title="Tábory" subtitle={`turnusy · ${CAMP_DAILY_RATE} Kč/den/trenér · ${CAMP_MAX_COACHES} trenéři na turnus`} />
          <div className="flex flex-wrap gap-2">
            <StatusPill label={`${turnusy.length} turnusů`} tone="purple" />
            <StatusPill label={!hasTurnusy ? 'Žádné tábory' : openCount > 0 ? `${openCount} neúplných` : 'Vše obsazeno'} tone={!hasTurnusy ? 'purple' : openCount > 0 ? 'pink' : 'mint'} />
            <StatusPill label={`${totalAssigned} přiřazených`} />
          </div>
        </div>
        <button type="button" onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 rounded-[13px] border border-brand-purple/20 bg-white px-3 py-2 text-xs font-black text-brand-purple transition hover:bg-brand-purple/5">
          <ChevronDown size={14} />
          Zobrazit
        </button>
      </div>
    </Panel>

    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="camp-backdrop"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={closeCampModal}
          />
          <motion.div
            key="camp-modal"
            className="fixed inset-x-4 top-[3vh] z-50 mx-auto flex max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" style={{ maxHeight: '94vh' }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-brand-purple/8 bg-white px-6 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <SectionTitle icon={<CalendarDays size={18} />} title="Tábory – přiřazení trenérů" subtitle={`${CAMP_DAILY_RATE} Kč/den · ${CAMP_MAX_COACHES} trenéři na turnus`} />
                <div className="flex flex-wrap gap-2">
                  <StatusPill label={`${turnusy.length} turnusů`} tone="purple" />
                  <StatusPill label={!hasTurnusy ? 'Žádné tábory' : openCount > 0 ? `${openCount} neúplných` : 'Vše obsazeno'} tone={!hasTurnusy ? 'purple' : openCount > 0 ? 'pink' : 'mint'} />
                </div>
              </div>
              <button type="button" onClick={closeCampModal} className="ml-4 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-paper text-brand-ink-soft transition hover:bg-brand-purple/10 hover:text-brand-purple">
                <ChevronDown size={16} className="rotate-180" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-8 pt-5">
              <div className="space-y-3">
                {turnusy.map((turnus) => {
                  const isSelected = turnus.id === selectedId;
                  const isFull = turnus.coaches.length >= turnus.maxCoaches;
                  const payout = turnus.durationDays * CAMP_DAILY_RATE;
                  return (
                    <div key={turnus.id}
                      className={`rounded-2xl border p-4 transition cursor-pointer ${isSelected ? 'border-brand-purple/40 bg-brand-purple/5 ring-2 ring-brand-purple ring-offset-1' : 'border-brand-purple/12 bg-white hover:bg-brand-paper/60'}`}
                      onClick={() => setSelectedId(isSelected ? null : turnus.id)}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-lg bg-brand-purple px-2 py-0.5 text-[11px] font-black text-white">{turnus.city}</span>
                            <span className={`rounded-lg px-2 py-0.5 text-[11px] font-black ${isFull ? 'bg-[#1FB37A]/12 text-[#1FB37A]' : 'bg-[#F0445B]/10 text-[#F0445B]'}`}>{isFull ? 'Obsazeno' : `${turnus.coaches.length}/${turnus.maxCoaches} trenérů`}</span>
                          </div>
                          <p className="mt-1 text-sm font-black text-brand-purple-deep">{turnus.campTitle}</p>
                          <p className="text-xs font-bold text-brand-ink">{turnus.venue}</p>
                          <p className="mt-0.5 text-[11px] text-brand-ink-soft">{formatDate(turnus.dateFrom)} – {formatDate(turnus.dateTo)} · {turnus.durationDays} dní · {payout} Kč/trenér</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {turnus.coaches.map((c) => (
                            <span key={c.coachId} className="rounded-full bg-brand-paper px-2 py-0.5 text-[11px] font-black text-brand-ink">{c.coachName.split(' ')[0]}</span>
                          ))}
                        </div>
                      </div>

                      {isSelected && (
                        <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                          {/* Coach slots */}
                          <div className="grid grid-cols-3 gap-2">
                            {Array.from({ length: turnus.maxCoaches }).map((_, i) => {
                              const coach = turnus.coaches[i];
                              return (
                                <div key={i} className={`rounded-xl p-2.5 ${coach ? 'bg-brand-paper' : 'border border-dashed border-brand-purple/20 bg-transparent'}`}>
                                  <p className="text-[9px] font-black uppercase text-brand-ink-soft/60">{i + 1}. trenér</p>
                                  {coach ? (
                                    <>
                                      <p className="mt-0.5 truncate text-xs font-black text-brand-ink">{coach.coachName}</p>
                                      <button type="button" onClick={() => onRemoveCoach(turnus, coach.coachId)}
                                        className="mt-1 w-full rounded-[7px] border border-[#F0445B]/20 px-1 py-0.5 text-[9px] font-black text-[#F0445B] hover:bg-[#F0445B]/8">
                                        Odebrat
                                      </button>
                                    </>
                                  ) : (
                                    <p className="mt-0.5 text-[10px] text-brand-ink-soft/40">Volné místo</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Assign coach */}
                          {turnus.coaches.length < turnus.maxCoaches && (
                            <div className="mt-3">
                              <p className="mb-1.5 text-[10px] font-black uppercase text-brand-ink-soft/60">Přiřadit trenéra</p>
                              <div className="flex flex-wrap gap-1.5">
                                {activeCoaches.filter((c) => !turnus.coaches.some((tc) => tc.coachId === c.id)).map((coach) => (
                                  <button key={coach.id} type="button" onClick={() => onAddCoach(turnus, coach)}
                                    className="rounded-[10px] bg-brand-purple px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-brand-purple-deep">
                                    + {coach.name.split(' ')[0]}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {!selectedTurnus && (
                <p className="mt-4 text-center text-xs text-brand-ink-soft/50">Klikni na turnus pro správu přiřazení trenérů.</p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}

function PayoutsSection({
  coaches,
  transfers,
  coachAttendanceRecords,
  invoices,
  payoutPeriod,
  onPrevPeriod,
  onNextPeriod,
  message,
  payingCoachId,
  onboardingLinks,
  generatingOnboarding,
  onStartOnboarding,
  onPayout,
}: {
  coaches: AdminCoachSummary[];
  transfers: TrainerPayoutTransfer[];
  coachAttendanceRecords: CoachAttendanceRecord[];
  invoices: Invoice[];
  payoutPeriod: { key: string; label: string; periodStart: string; periodEnd: string };
  onPrevPeriod: () => void;
  onNextPeriod: () => void;
  message: string | null;
  payingCoachId: string | null;
  onboardingLinks: Record<string, string>;
  generatingOnboarding: string | null;
  onStartOnboarding: (coach: AdminCoachSummary) => void;
  onPayout: (coach: AdminCoachSummary) => void;
}) {
  const total = coaches.reduce((sum, coach) => sum + payoutAmountForCoach(coach, coachAttendanceRecords), 0);
  const readyCoaches = coaches.filter((coach) => {
    const amount = payoutAmountForCoach(coach, coachAttendanceRecords);
    return coach.stripeAccountId?.startsWith('acct_') && amount > 0;
  }).length;
  const missingOnboarding = coaches.filter((coach) => !coach.stripeAccountId?.startsWith('acct_')).length;

  return (
    <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <Panel className="p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <SectionTitle icon={<Banknote size={18} />} title="Výplaty trenérům" subtitle="uzavřený měsíc, základ + schválené bonusy" />
            <div className="grid gap-2 rounded-[18px] bg-brand-paper p-2 sm:grid-cols-3 lg:min-w-[420px]">
              <div className="rounded-[14px] bg-white px-4 py-3">
                <p className="text-[11px] font-black uppercase text-brand-ink-soft">Období</p>
                <div className="mt-1 flex items-center gap-2">
                  <button type="button" onClick={onPrevPeriod} className="rounded-[8px] p-0.5 text-brand-ink-soft transition hover:bg-brand-paper hover:text-brand-ink" aria-label="Předchozí měsíc">‹</button>
                  <p className="flex-1 text-center text-sm font-black text-brand-ink">{payoutPeriod.label}</p>
                  <button type="button" onClick={onNextPeriod} className="rounded-[8px] p-0.5 text-brand-ink-soft transition hover:bg-brand-paper hover:text-brand-ink" aria-label="Další měsíc">›</button>
                </div>
              </div>
              <div className="rounded-[14px] bg-white px-4 py-3">
                <p className="text-[11px] font-black uppercase text-brand-ink-soft">Připraveno</p>
                <p className="mt-1 text-sm font-black text-brand-ink">{readyCoaches}/{coaches.length}</p>
              </div>
              <div className="rounded-[14px] bg-brand-ink px-4 py-3 text-white">
                <p className="text-[11px] font-black uppercase text-white/60">Celkem</p>
                <p className="mt-1 text-lg font-black">{currency(total)}</p>
              </div>
            </div>
          </div>
          {missingOnboarding > 0 ? <p className="mt-4 rounded-[16px] bg-brand-orange/12 px-4 py-3 text-sm font-bold leading-6 text-brand-orange-deep">{missingOnboarding} {missingOnboarding === 1 ? 'trenér ještě nemá' : 'trenéři ještě nemají'} dokončený Stripe Connect onboarding.</p> : null}
          {message ? <p className="mt-4 rounded-[16px] bg-brand-purple-light px-4 py-3 text-sm font-bold leading-6 text-brand-ink-soft">{message}</p> : null}
        </Panel>

        <div className="grid gap-4">
          {coaches.map((coach) => {
            const amount = payoutAmountForCoach(coach, coachAttendanceRecords);
            const hasConnect = coach.stripeAccountId?.startsWith('acct_');
            const hasBankDetails = Boolean(coach.iban || (coach.bankAccount && coach.bankAccount !== 'není vyplněn'));
            const ready = !!hasConnect && amount > 0;
            const onboardingUrl = onboardingLinks[coach.id];
            const coachInvoices = invoices.filter((inv) => inv.coachId === coach.id);
            const invoicedTotal = coachInvoices.reduce((sum, inv) => sum + inv.amount, 0);
            const invoicedUnpaid = coachInvoices.filter((inv) => !inv.paid).reduce((sum, inv) => sum + inv.amount, 0);
            const expectedFromAttendance = coach.baseAmount;
            const invoiceDiff = invoicedTotal - expectedFromAttendance;
            const invoiceMatches = Math.abs(invoiceDiff) < 1;
            return (
              <Panel key={coach.id} className="overflow-hidden p-0">
                <div className={`h-1.5 ${ready ? 'bg-brand-purple' : 'bg-brand-orange'}`} />
                <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-stretch">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-black leading-tight text-brand-ink">{coach.name}</h3>
                        <p className="mt-1 text-sm font-bold text-brand-ink-soft">{coach.locations.slice(0, 2).join(' · ')}</p>
                      </div>
                      <StatusPill label={ready ? 'Připraveno' : hasConnect ? 'Čeká na docházku' : hasBankDetails ? 'Bankovní údaje' : 'Onboarding chybí'} tone={ready ? 'mint' : hasConnect ? 'purple' : hasBankDetails ? 'purple' : 'orange'} />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <Metric value={`${coach.loggedHours} h`} label="hodiny" />
                      <Metric value={currency(coach.baseAmount)} label="základ" />
                      <Metric value={currency(coach.approvedBonuses)} label="bonus" />
                    </div>

                    {coachInvoices.length > 0 ? (
                      <div className={`rounded-[16px] border p-4 ${invoiceMatches ? 'border-emerald-200 bg-emerald-50/60' : 'border-brand-orange/25 bg-brand-orange/6'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-black uppercase text-brand-ink-soft">Kontrola faktury vs. docházka</p>
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${invoiceMatches ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {invoiceMatches ? 'Sedí' : invoiceDiff > 0 ? `Faktura o ${currency(invoiceDiff)} víc` : `Faktura o ${currency(Math.abs(invoiceDiff))} míň`}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <Metric value={`${coach.loggedHours} h`} label="odtrénováno" />
                          <Metric value={currency(expectedFromAttendance)} label="dle docházky" />
                          <Metric value={currency(invoicedTotal)} label="fakturováno" />
                        </div>
                        <p className="mt-2 text-xs font-bold text-brand-ink-soft">
                          {coachInvoices.length} {coachInvoices.length === 1 ? 'faktura' : coachInvoices.length < 5 ? 'faktury' : 'faktur'} od trenéra{invoicedUnpaid > 0 ? ` · ${currency(invoicedUnpaid)} neuhrazeno` : ' · vše uhrazeno'}. Detail a označení „uhrazeno" v sekci Faktury.
                        </p>
                      </div>
                    ) : null}

                    {hasConnect ? (
                      <div className="flex items-center gap-3 rounded-[16px] border border-brand-purple/10 bg-brand-paper px-4 py-3">
                        <CheckCircle2 size={17} className="shrink-0 text-brand-purple" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase text-brand-ink-soft">Stripe Connect</p>
                          <p className="mt-0.5 break-all font-mono text-xs font-black text-brand-ink">{coach.stripeAccountId}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-[16px] border border-brand-orange/20 bg-brand-orange/6 p-4">
                        <p className="text-sm font-bold text-brand-orange-deep">Trenér ještě nespojil svůj účet se Stripe. Můžeš mu vygenerovat onboarding, nebo použít bankovní údaje níže pro ruční platbu.</p>
                        {hasBankDetails ? (
                          <div className="mt-3 grid gap-2 rounded-[14px] border border-brand-purple/12 bg-white p-3">
                            <InfoBlock label="Majitel účtu" value={coach.payoutAccountHolder ?? coach.name} />
                            <InfoBlock label="Číslo účtu" value={coach.bankAccount || 'není vyplněn'} />
                            <InfoBlock label="IBAN" value={coach.iban ?? 'není vyplněn'} />
                            {coach.payoutNote ? <InfoBlock label="Poznámka" value={coach.payoutNote} /> : null}
                          </div>
                        ) : null}
                        {onboardingUrl ? (
                          <div className="mt-3 grid gap-2">
                            <p className="text-[11px] font-black uppercase text-brand-ink-soft">Odkaz pro trenéra (platný ~5 min)</p>
                            <div className="flex items-center gap-2 overflow-hidden rounded-[14px] border border-brand-purple/15 bg-white px-3 py-2">
                              <span className="min-w-0 flex-1 break-all font-mono text-xs text-brand-ink-soft">{onboardingUrl}</span>
                              <button type="button" onClick={() => navigator.clipboard.writeText(onboardingUrl)} className="shrink-0 rounded-[10px] bg-brand-purple px-2 py-1 text-[10px] font-black text-white transition hover:bg-brand-purple-deep">Kopírovat</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={generatingOnboarding === coach.id}
                            onClick={() => onStartOnboarding(coach)}
                            className="mt-3 inline-flex items-center gap-2 rounded-[14px] bg-brand-orange px-4 py-2 text-sm font-black text-white transition hover:bg-brand-orange-deep disabled:opacity-55"
                          >
                            {generatingOnboarding === coach.id ? 'Generuji...' : 'Zahájit Stripe onboarding'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={`flex flex-col justify-between rounded-[20px] border p-4 ${ready ? 'border-brand-purple bg-brand-purple text-white shadow-brand-soft' : 'border-brand-purple/10 bg-brand-paper text-brand-ink'}`}>
                    <div>
                      <p className={`text-xs font-black uppercase ${ready ? 'text-white/70' : 'text-brand-ink-soft'}`}>K výplatě</p>
                      <p className="mt-1 text-3xl font-black leading-tight">{currency(amount)}</p>
                      <p className={`mt-2 text-xs font-black uppercase ${ready ? 'text-white/62' : 'text-brand-ink-soft'}`}>{payoutPeriod.label}</p>
                    </div>
                    <button
                      type="button"
                      disabled={!ready || payingCoachId === coach.id}
                      onClick={() => onPayout(coach)}
                      aria-label={`Vyplatit ${payoutPeriod.label} pro ${coach.name}`}
                      className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[16px] px-4 py-3 text-sm font-black shadow-brand transition disabled:cursor-not-allowed disabled:opacity-55 ${ready ? 'bg-white text-brand-purple hover:bg-brand-paper' : 'bg-white text-brand-ink-soft'}`}
                    >
                      <Send size={17} />
                      {payingCoachId === coach.id ? 'Odesílám...' : 'Vyplatit'}
                    </button>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      </div>

      <Panel className="p-5 2xl:sticky 2xl:top-3">
        <SectionTitle icon={<History size={18} />} title="Historie výplat" subtitle="Stripe transfery uložené v Supabase" />
        <div className="mt-4 grid gap-2">
          {transfers.map((transfer) => (
            <MiniRow key={transfer.id} label={transfer.coachName} meta={`${transfer.periodKey} · ${transfer.status}${transfer.stripeTransferId ? ` · ${transfer.stripeTransferId}` : ''}`} value={currency(transfer.amount)} />
          ))}
          {transfers.length === 0 ? <EmptyState text="Po první výplatě se tady objeví transfer historie." /> : null}
        </div>
      </Panel>
    </div>
  );
}

function InvoicesSection({ invoices, coaches, message, onTogglePaid, onAddInvoice, onDeleteInvoice }: {
  invoices: Invoice[];
  coaches: AdminCoachSummary[];
  message: string | null;
  onTogglePaid: (id: string) => void | Promise<void>;
  onAddInvoice: (invoice: Invoice) => void | Promise<void>;
  onDeleteInvoice: (id: string) => void | Promise<void>;
}) {
  const [filterCategory, setFilterCategory] = useState<string>('Vše');
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [filterCoach, setFilterCoach] = useState<string>('Vše');

  const coachNameById = useMemo(() => new Map(coaches.map((c) => [c.id, c.name])), [coaches]);
  // Coaches that actually have at least one invoice → drive the coach filter.
  const invoicingCoaches = useMemo(() => {
    const ids = [...new Set(invoices.map((inv) => inv.coachId).filter((id): id is string => Boolean(id)))];
    return ids.map((id) => ({ id, name: coachNameById.get(id) ?? 'Trenér' })).sort((a, b) => a.name.localeCompare(b.name));
  }, [invoices, coachNameById]);

  // PDF upload state
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadPath, setUploadPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Form state (shown after PDF is dropped)
  const [formSupplier, setFormSupplier] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formCategory, setFormCategory] = useState<string>('');
  const [formNewCategory, setFormNewCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic categories derived from existing invoices
  const existingCategories = useMemo(() => [...new Set(invoices.map((inv) => inv.category).filter(Boolean))].sort(), [invoices]);

  const visible = invoices.filter((inv) => {
    if (filterCategory !== 'Vše' && inv.category !== filterCategory) return false;
    if (filterPaid === 'paid' && !inv.paid) return false;
    if (filterPaid === 'unpaid' && inv.paid) return false;
    if (filterCoach === 'Trenéři' && !inv.coachId) return false;
    if (filterCoach !== 'Vše' && filterCoach !== 'Trenéři' && inv.coachId !== filterCoach) return false;
    return true;
  });

  const totalUnpaid = invoices.filter((inv) => !inv.paid).reduce((sum, inv) => sum + inv.amount, 0);
  const totalPaid = invoices.filter((inv) => inv.paid).reduce((sum, inv) => sum + inv.amount, 0);
  const totalAll = invoices.reduce((sum, inv) => sum + inv.amount, 0);

  async function uploadFile(file: File): Promise<string | null> {
    try {
      const { signedUrl, path } = await createAdminInvoiceUploadUrl(file.name);
      const res = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      return path;
    } catch {
      return null;
    }
  }

  async function handleFilePick(file: File) {
    setUploadError(null);
    const name = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
    setFormSupplier(name);
    setPendingFile(file);
    setUploading(true);
    const path = await uploadFile(file);
    setUploading(false);
    if (path) {
      setUploadPath(path);
    } else {
      setUploadError('Nepodařilo se nahrát soubor. Zkontrolujte připojení.');
    }
  }

  function handleDropZoneDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFilePick(file);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFilePick(file);
  }

  function clearForm() {
    setPendingFile(null);
    setUploadPath(null);
    setFormSupplier('');
    setFormAmount('');
    setFormNote('');
    setFormCategory('');
    setFormNewCategory('');
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amount = Number(formAmount.replace(/\s/g, '').replace(',', '.'));
    if (!formSupplier.trim() || !amount || amount <= 0) return;
    setSubmitting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const newInvoice: Invoice = {
        id: `inv-${Date.now()}`,
        supplier: formSupplier.trim(),
        description: formNote.trim(),
        amount,
        issuedDate: today,
        dueDate: today,
        paid: false,
        category: formNewCategory.trim() || formCategory || 'Ostatní',
        fileUrl: uploadPath || undefined,
      };
      await onAddInvoice(newInvoice);
      clearForm();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <div className="space-y-5">
        <Panel className="p-5">
          <SectionTitle icon={<Receipt size={18} />} title="Přehled výdajů" subtitle="faktury a platby" />
          {message ? <p className="mt-3 rounded-[14px] bg-brand-purple-light px-3 py-2 text-sm font-bold leading-6 text-brand-ink-soft">{message}</p> : null}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Metric value={`${totalAll.toLocaleString('cs-CZ')} Kč`} label="celkem" />
            <Metric value={`${totalPaid.toLocaleString('cs-CZ')} Kč`} label="uhrazeno" />
            <Metric value={`${totalUnpaid.toLocaleString('cs-CZ')} Kč`} label="k úhradě" />
            <Metric value={String(invoices.filter((inv) => !inv.paid).length)} label="neuhrazených" />
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs font-black uppercase text-brand-ink-soft">Podle kategorie</p>
            <div className="grid gap-1.5">
              {existingCategories.map((cat) => {
                const catTotal = invoices.filter((inv) => inv.category === cat).reduce((sum, inv) => sum + inv.amount, 0);
                const catPaid = invoices.filter((inv) => inv.category === cat && inv.paid).reduce((sum, inv) => sum + inv.amount, 0);
                if (catTotal === 0) return null;
                return (
                  <div key={cat} className="flex items-center justify-between rounded-[12px] bg-brand-paper px-3 py-2">
                    <p className="text-sm font-bold text-brand-ink">{cat}</p>
                    <div className="text-right">
                      <p className="text-sm font-black text-brand-ink">{catTotal.toLocaleString('cs-CZ')} Kč</p>
                      <p className="text-[11px] font-bold text-brand-ink-soft">{catPaid.toLocaleString('cs-CZ')} Kč uhrazeno</p>
                    </div>
                  </div>
                );
              })}
              {existingCategories.length === 0 ? (
                <p className="text-sm font-bold text-brand-ink-soft">Zatím žádné faktury.</p>
              ) : null}
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle icon={<Plus size={18} />} title="Přidat fakturu" subtitle="přetáhni PDF nebo klikni" />
          {!pendingFile ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDropZoneDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[18px] border-2 border-dashed p-8 text-center transition ${dragOver ? 'border-brand-purple bg-brand-purple/5' : 'border-brand-purple/20 bg-white hover:border-brand-purple/40 hover:bg-brand-paper'}`}
            >
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-[14px] transition ${dragOver ? 'bg-brand-purple text-white' : 'bg-brand-paper text-brand-purple'}`}>
                <FileDown size={22} />
              </div>
              <div>
                <p className="text-sm font-black text-brand-ink">Přetáhni PDF fakturu</p>
                <p className="mt-0.5 text-xs font-bold text-brand-ink-soft">nebo klikni pro výběr souboru</p>
              </div>
              <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleFileInputChange} />
            </div>
          ) : (
            <form className="mt-4 space-y-3" onSubmit={(e) => void handleSubmit(e)}>
              {/* PDF file indicator */}
              <div className="flex items-center gap-2 rounded-[12px] bg-brand-paper px-3 py-2.5">
                <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-brand-purple text-white">
                  <FileDown size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-brand-ink">{pendingFile.name}</p>
                  {uploading ? (
                    <p className="text-[11px] font-bold text-brand-purple">Nahrávám…</p>
                  ) : uploadPath ? (
                    <p className="text-[11px] font-bold text-emerald-600">Soubor uložen ✓</p>
                  ) : (
                    <p className="text-[11px] font-bold text-brand-pink">{uploadError ?? 'Chyba nahrávání'}</p>
                  )}
                </div>
                <button type="button" onClick={clearForm} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-brand-ink-soft hover:text-brand-pink">
                  <X size={14} />
                </button>
              </div>
              <TextInput label="Dodavatel" value={formSupplier} onChange={setFormSupplier} />
              <TextInput label="Částka (Kč)" value={formAmount} onChange={setFormAmount} inputMode="numeric" />
              <TextInput label="Poznámka (volitelné)" value={formNote} onChange={setFormNote} />
              <div>
                <p className="mb-2 text-sm font-black text-brand-ink">Štítek</p>
                {existingCategories.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {existingCategories.map((cat) => {
                      const isActive = formCategory === cat && !formNewCategory.trim();
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => { setFormCategory(cat); setFormNewCategory(''); }}
                          className={`rounded-[12px] border px-3 py-1.5 text-xs font-black transition ${isActive ? 'border-brand-purple bg-brand-purple text-white' : 'border-brand-purple/15 bg-brand-paper text-brand-ink-soft hover:border-brand-purple/40 hover:text-brand-purple'}`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                )}
                <input
                  type="text"
                  value={formNewCategory}
                  onChange={(e) => { setFormNewCategory(e.target.value); if (e.target.value) setFormCategory(''); }}
                  placeholder="Nebo napiš nový štítek…"
                  className="w-full rounded-[12px] border border-brand-purple/15 bg-white px-3 py-2 text-sm font-bold text-brand-ink placeholder:text-brand-ink-soft/60 focus:border-brand-purple focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || uploading}
                className="w-full rounded-[16px] bg-brand-purple py-3 text-sm font-black text-white transition hover:opacity-80 disabled:opacity-50"
              >
                {submitting ? 'Ukládám…' : 'Uložit fakturu'}
              </button>
            </form>
          )}
        </Panel>
      </div>

      <div>
        <Panel className="p-5">
          <SectionTitle icon={<ListChecks size={18} />} title="Seznam faktur" subtitle={`${visible.length} záznamů`} />
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="grid grid-cols-3 gap-1 rounded-[14px] border border-brand-purple/10 bg-brand-paper p-1">
              {(['all', 'unpaid', 'paid'] as const).map((st) => (
                <button key={st} type="button" onClick={() => setFilterPaid(st)} className={`rounded-[10px] px-3 py-1.5 text-xs font-black transition ${filterPaid === st ? 'bg-brand-purple text-white shadow-sm' : 'text-brand-ink-soft hover:text-brand-purple'}`}>
                  {st === 'all' ? 'Vše' : st === 'paid' ? 'Uhrazeno' : 'K úhradě'}
                </button>
              ))}
            </div>
            {existingCategories.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {['Vše', ...existingCategories].map((cat) => (
                  <button key={cat} type="button" onClick={() => setFilterCategory(cat)} className={`rounded-[10px] px-3 py-1.5 text-xs font-black transition ${filterCategory === cat ? 'bg-brand-purple/10 text-brand-purple ring-1 ring-brand-purple/30' : 'bg-brand-paper text-brand-ink-soft hover:text-brand-purple'}`}>
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
          {invoicingCoaches.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[11px] font-black uppercase text-brand-ink-soft">Trenér:</span>
              {[{ id: 'Vše', name: 'Vše' }, { id: 'Trenéři', name: 'Všichni trenéři' }, ...invoicingCoaches].map((c) => (
                <button key={c.id} type="button" onClick={() => setFilterCoach(c.id)} className={`rounded-[10px] px-3 py-1.5 text-xs font-black transition ${filterCoach === c.id ? 'bg-brand-purple/10 text-brand-purple ring-1 ring-brand-purple/30' : 'bg-brand-paper text-brand-ink-soft hover:text-brand-purple'}`}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 grid gap-2">
            {visible.map((inv) => (
              <InvoiceCard key={inv.id} inv={inv} coachName={inv.coachId ? coachNameById.get(inv.coachId) ?? 'Trenér' : undefined} onTogglePaid={onTogglePaid} onDelete={onDeleteInvoice} />
            ))}
            {visible.length === 0 ? <EmptyState text="Žádné faktury pro vybraný filtr." /> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function InvoiceCard({ inv, coachName, onTogglePaid, onDelete }: { inv: Invoice; coachName?: string; onTogglePaid: (id: string) => void | Promise<void>; onDelete: (id: string) => void | Promise<void> }) {
  const [loadingPdf, setLoadingPdf] = useState(false);

  async function openPdf() {
    if (!inv.fileUrl) return;
    setLoadingPdf(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.storage.from('invoices').createSignedUrl(inv.fileUrl, 120);
      if (error || !data?.signedUrl) return;
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setLoadingPdf(false);
    }
  }

  return (
    <div className={`rounded-[16px] border p-4 transition ${inv.paid ? 'border-emerald-200 bg-emerald-50/60' : 'border-brand-purple/10 bg-brand-paper'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-brand-ink">{inv.supplier}</p>
            <span className="rounded-full bg-brand-purple/10 px-2 py-0.5 text-[10px] font-black text-brand-purple">{inv.category}</span>
            {coachName ? <span className="rounded-full bg-brand-orange/12 px-2 py-0.5 text-[10px] font-black text-brand-orange-deep">Trenér · {coachName}</span> : null}
          </div>
          {inv.description ? <p className="mt-0.5 text-xs font-bold text-brand-ink-soft">{inv.description}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-base font-black text-brand-ink">{inv.amount.toLocaleString('cs-CZ')} Kč</span>
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${inv.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {inv.paid ? `Uhrazeno${inv.paidDate ? ` ${inv.paidDate}` : ''}` : 'Neuhrazeno'}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void onTogglePaid(inv.id)}
          className={`flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-black transition ${inv.paid ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-brand-purple text-white hover:opacity-80'}`}
        >
          <CheckCircle2 size={13} />
          {inv.paid ? 'Zrušit úhradu' : 'Označit uhrazeno'}
        </button>
        {inv.fileUrl ? (
          <button
            type="button"
            onClick={() => void openPdf()}
            disabled={loadingPdf}
            className="flex items-center gap-1.5 rounded-[10px] bg-white px-3 py-1.5 text-xs font-black text-brand-purple transition hover:bg-brand-purple/10 disabled:opacity-50"
          >
            <FileDown size={13} />
            {loadingPdf ? 'Otevírám…' : 'Zobrazit PDF'}
          </button>
        ) : null}
        <div className="flex-1" />
        <button type="button" onClick={() => void onDelete(inv.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-white text-brand-pink transition hover:bg-brand-pink hover:text-white">
          <Trash2 size={14} />
        </button>
      </div>
      <p className="mt-2 text-[11px] font-bold text-brand-ink-soft">Přidáno: {inv.issuedDate}</p>
    </div>
  );
}


function DocumentsSection({ activityRows, products }: { activityRows: ReturnType<typeof adminActivityRows>; products: ParentProduct[] }) {
  const [filter, setFilter] = useState<'all' | DocumentStatus>('all');
  const documents: ParentDocument[] = [];
  const visibleDocuments = filter === 'all' ? documents : documents.filter((document) => document.status === filter);
  const stats = documentStatsFor(documents);

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <Panel className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionTitle icon={<FileCheck2 size={18} />} title="Dokumenty účastníků" subtitle={`${stats.signed}/${stats.total} podepsáno`} />
          <div className="grid grid-cols-4 rounded-[16px] border border-brand-purple/10 bg-brand-paper p-1">
            {(['all', 'signed', 'draft', 'missing'] as const).map((status) => (
              <button key={status} type="button" onClick={() => setFilter(status)} className={`rounded-[7px] px-2 py-2 text-[11px] font-black transition ${filter === status ? 'bg-brand-purple text-white shadow-sm' : 'text-brand-ink-soft hover:text-brand-purple'}`}>
                {status === 'all' ? 'Vše' : documentStatusLabel(status)}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          {visibleDocuments.map((document) => <DocumentRow key={document.id} document={document} />)}
          {visibleDocuments.length === 0 ? <EmptyState text="Pro vybraný stav nejsou žádné dokumenty." /> : null}
        </div>
      </Panel>

      <div className="space-y-5">
        <Panel className="p-5">
          <SectionTitle icon={<ShieldCheck size={18} />} title="Kompletace produktů" subtitle="u kroužků a táborů sleduj povinné dokumenty" />
          <div className="mt-4 grid gap-2">
            {activityRows.filter((activity) => activity.type !== 'Workshop').slice(0, 10).map((activity) => {
              const missingDocuments = 0;
              return <MiniRow key={activity.id} label={activity.title} meta={`${activity.place} · ${activity.registered}/${activity.capacityTotal} účastníků`} value={missingDocuments > 0 ? `${missingDocuments} chybí` : 'OK'} />;
            })}
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle icon={<ListChecks size={18} />} title="Povinné balíčky" subtitle="podle typu produktu" />
          <div className="mt-4 space-y-3">
            <RequiredDocumentsPreview type="Krouzek" title="Kroužek" products={products} />
            <RequiredDocumentsPreview type="Tabor" title="Tábor" products={products} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

type ProductEdits = Partial<Pick<ParentProduct, 'title' | 'place' | 'gymContact' | 'primaryMeta' | 'capacityTotal' | 'price' | 'priceLabel' | 'heroImage' | 'gallery' | 'mapQuery' | 'latitude' | 'longitude' | 'importantInfo'>>;

function groupCourseProducts(courses: ParentProduct[]): Array<{ baseId: string; base: ParentProduct; variant15: ParentProduct | null }> {
  const baseProducts = courses.filter((product) => !product.id.endsWith('-15'));
  return baseProducts.map((base) => ({
    baseId: base.id,
    base,
    variant15: courses.find((product) => product.id === `${base.id}-15`) ?? null,
  }));
}

function groupCampProducts(camps: ParentProduct[]): Array<{ baseId: string; first: ParentProduct; turnusy: ParentProduct[] }> {
  const groups = new Map<string, ParentProduct[]>();
  for (const camp of camps) {
    const baseId = camp.id.replace(/-t\d+$/, '');
    const existing = groups.get(baseId);
    if (existing) { existing.push(camp); } else { groups.set(baseId, [camp]); }
  }
  return Array.from(groups.entries()).map(([baseId, turnusy]) => ({ baseId, first: turnusy[0], turnusy }));
}

function ProductsSection({ products, coaches, onAddProduct, onRemoveProduct, onUpdateProduct, onProductCoachIdsChange }: { products: ParentProduct[]; coaches: AdminCoachSummary[]; onAddProduct: (input: AdminProductInput) => Promise<ParentProduct>; onRemoveProduct: (productId: string) => Promise<void>; onUpdateProduct: (product: ParentProduct) => Promise<ParentProduct>; onProductCoachIdsChange: (product: ParentProduct, coachIds: string[]) => Promise<void> }) {
  const { flags } = useFeatureFlags();
  const [activeTab, setActiveTab] = useState<ActivityType>('Krouzek');
  const [removedBaseIds, setRemovedBaseIds] = useState<Set<string>>(new Set());
  const [editedProducts, setEditedProducts] = useState<Map<string, ProductEdits>>(new Map());
  const [message, setMessage] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  async function handleEdit(product: ParentProduct, edits: ProductEdits) {
    setEditedProducts((prev) => new Map(prev).set(product.id, { ...prev.get(product.id), ...edits }));
    try {
      const nextProduct = { ...product, ...edits };
      await onUpdateProduct(nextProduct);
      // Pokud se změnila adresa/místo u kroužku s trenéry, přegeokóduj GPS na jejich sessions.
      const locationChanged = ['mapQuery', 'latitude', 'longitude', 'venue', 'city', 'place'].some(
        (key) => key in edits && (edits as Record<string, unknown>)[key] !== (product as Record<string, unknown>)[key],
      );
      if (nextProduct.type === 'Krouzek' && locationChanged && (nextProduct.coachIds ?? []).length > 0) {
        await refreshCourseSessionLocations(nextProduct);
      }
      setMessage('Produkt je uložený v databázi.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Produkt se nepodařilo uložit.');
    }
  }

  function applyEdits(product: ParentProduct): ParentProduct {
    const edits = editedProducts.get(product.id);
    return edits ? { ...product, ...edits } : product;
  }

  async function handleRemove(product: ParentProduct) {
    const label = product.type === 'Tabor' ? 'turnus' : product.type === 'Workshop' ? 'workshop' : 'kroužek';
    if (!window.confirm(`Opravdu chceš smazat ${label} „${product.title}"? Tuto akci nelze vrátit zpět.`)) return;
    try {
      await onRemoveProduct(product.id);
      setRemovedBaseIds((prev) => new Set([...prev, product.id, `${product.id}-15`]));
      setMessage('Produkt je smazaný z databáze.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Produkt se nepodařilo smazat.');
    }
  }

  async function handleRemoveCampGroup(group: { baseId: string; first: ParentProduct; turnusy: ParentProduct[] }) {
    if (!window.confirm(`Opravdu chceš smazat celý tábor „${group.first.title}" včetně všech ${group.turnusy.length} turnusů? Tuto akci nelze vrátit zpět.`)) return;
    try {
      for (const turnus of group.turnusy) {
        await onRemoveProduct(turnus.id);
      }
      setRemovedBaseIds((prev) => new Set([...prev, group.baseId, ...group.turnusy.map((t) => t.id)]));
      setMessage('Tábor je smazaný z databáze.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Tábor se nepodařilo smazat.');
    }
  }

  const visibleProducts = products.filter((product) => product.type === activeTab && !removedBaseIds.has(product.id)).map(applyEdits);
  const courses = visibleProducts.filter((product) => product.type === 'Krouzek');
  const courseGroups = groupCourseProducts(courses);
  const campGroups = groupCampProducts(visibleProducts.filter((product) => product.type === 'Tabor'));
  const nonCourses = visibleProducts.filter((product) => product.type === 'Workshop');

  const courseGroupCount = groupCourseProducts(products.filter((product) => product.type === 'Krouzek' && !removedBaseIds.has(product.id))).length;
  const campCount = groupCampProducts(products.filter((product) => product.type === 'Tabor' && !removedBaseIds.has(product.id))).length;
  const workshopCount = products.filter((product) => product.type === 'Workshop' && !removedBaseIds.has(product.id)).length;

  return (
    <>
      <div className="space-y-5">
        {message ? <Panel className="p-4"><p className="text-sm font-black text-brand-ink-soft">{message}</p></Panel> : null}
        <Panel className="p-5">
          <div className="flex items-start justify-between gap-3">
            <SectionTitle icon={<PackagePlus size={18} />} title="Nabídka produktů" subtitle="po vytvoření se propíše na web i do rodičovského portálu" />
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-[14px] bg-brand-purple px-4 py-2.5 text-sm font-black text-white shadow-brand transition hover:bg-brand-purple-deep"
            >
              <Plus size={16} />
              Přidat produkt
            </button>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <Metric value={`${courseGroupCount + campCount + workshopCount}`} label="celkem" />
            <Metric value={`${courseGroupCount}`} label="kroužky" />
            <Metric value={`${campCount}`} label="tábory" />
            <Metric value={`${workshopCount}`} label="workshopy" />
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle icon={<ListChecks size={18} />} title="Produkty na webu" subtitle={`${activeTab === 'Krouzek' ? courseGroupCount : activeTab === 'Tabor' ? campCount : workshopCount} v kategorii`} />
          <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-[16px] border border-brand-purple/10 bg-brand-paper p-1">
            {([['Krouzek', 'Kroužky', courseGroupCount], ['Tabor', 'Tábory', campCount], ['Workshop', 'Workshopy', workshopCount]] as const)
              .filter(([type]) => (type === 'Tabor' ? flags.trainer_camps : type === 'Workshop' ? flags.trainer_workshop_registration : true))
              .map(([type, label, count]) => (
              <button key={type} type="button" onClick={() => setActiveTab(type)} className={`flex items-center justify-center gap-1.5 rounded-[12px] px-3 py-2 text-sm font-black transition ${activeTab === type ? 'bg-brand-purple text-white shadow-brand' : 'text-brand-ink-soft hover:text-brand-ink'}`}>
                {label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${activeTab === type ? 'bg-white/20 text-white' : 'bg-brand-purple/10 text-brand-purple'}`}>{count}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3">
            {activeTab === 'Krouzek'
              ? courseGroups.map((group) => (
                  <GroupedCourseCard key={group.baseId} group={group} coaches={coaches} isCreated={group.base.id.startsWith('admin-created-')} onRemove={() => void handleRemove(group.base)} onEdit={(edits) => handleEdit(group.base, edits)} onEditVariant15={group.variant15 ? (edits) => handleEdit(group.variant15!, edits) : undefined} onCoachIdsChange={(coachIds) => onProductCoachIdsChange(group.base, coachIds)} />
                ))
              : activeTab === 'Tabor'
                ? campGroups.map((group) => (
                    <GroupedCampCard
                      key={group.baseId}
                      group={group}
                      coaches={coaches}
                      onRemoveAll={() => void handleRemoveCampGroup(group)}
                      onRemoveTurnus={(turnus) => void handleRemove(turnus)}
                      onCoachIdsChange={async (coachIds) => { for (const turnus of group.turnusy) { await onProductCoachIdsChange(turnus, coachIds); } }}
                    />
                  ))
                : nonCourses.map((product) => (
                    <AdminProductCard key={product.id} product={product} coaches={coaches} isCreated={product.id.startsWith('admin-created-')} onRemove={() => void handleRemove(product)} onEdit={(edits) => handleEdit(product, edits)} onCoachIdsChange={(coachIds) => onProductCoachIdsChange(product, coachIds)} />
                  ))}
            {(activeTab === 'Krouzek' ? courseGroups.length : activeTab === 'Tabor' ? campGroups.length : nonCourses.length) === 0 ? <EmptyState text="V této kategorii zatím není žádný produkt." /> : null}
          </div>
        </Panel>
      </div>

      {/* Add Product Modal */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div
              key="add-product-backdrop"
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={() => setShowAddModal(false)}
            />
            <motion.div
              key="add-product-modal"
              className="fixed inset-x-4 top-[3vh] z-50 mx-auto flex max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" style={{ maxHeight: '94vh' }}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            >
              <div className="flex flex-shrink-0 items-center justify-between border-b border-brand-purple/8 bg-white px-6 py-4">
                <SectionTitle icon={<Plus size={18} />} title="Přidat produkt" subtitle={`kroužek${flags.trainer_camps ? ', tábor' : ''}${flags.trainer_workshop_registration ? ' nebo workshop' : ''}`} />
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="ml-4 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-paper text-brand-ink-soft transition hover:bg-brand-purple/10 hover:text-brand-purple"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-8 pt-5">
                <ProductCreateForm coaches={coaches} onAddProduct={onAddProduct} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function ProductCreateForm({ coaches, onAddProduct }: { coaches: AdminCoachSummary[]; onAddProduct: (input: AdminProductInput) => Promise<ParentProduct> }) {
  const { flags } = useFeatureFlags();
  const [type, setType] = useState<ActivityType>('Krouzek');
  const availableCoaches = useMemo(() => coaches.filter((coach) => coach.status !== 'Pozastaveny'), [coaches]);
  const [title, setTitle] = useState('');
  const [city, setCity] = useState('');
  const [venue, setVenue] = useState('');
  const [gymContact, setGymContact] = useState('');
  const [primaryMeta, setPrimaryMeta] = useState('');
  // Workshop – datum a čas (separátní pole)
  const [wsDate, setWsDate] = useState('');
  const [wsTimeFrom, setWsTimeFrom] = useState('10:00');
  const [wsTimeTo, setWsTimeTo] = useState('17:00');
  const [price, setPrice] = useState('1790');
  const [price15, setPrice15] = useState('2590');
  const [capacityTotal, setCapacityTotal] = useState('25');
  const [capacityCurrent, setCapacityCurrent] = useState('0');
  const [selectedCoachIds, setSelectedCoachIds] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [trainingFocus, setTrainingFocus] = useState('bezpečné dopady, přeskoky, skill tree, NFC docházka');
  const [skillCategory, setSkillCategory] = useState('smisene');
  const [mapQuery, setMapQuery] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const mapRef = useRef<LocationPickerMapHandle>(null);
  // Workshop – triky
  const [trick1, setTrick1] = useState('');
  const [trick2, setTrick2] = useState('');
  const [trick1VideoFile, setTrick1VideoFile] = useState('');
  const [trick2VideoFile, setTrick2VideoFile] = useState('');
  // Fotky (kroužek / tábor)
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoCount, setPhotoCount] = useState(0);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Turnusy pro tábor
  const [newTurnusy, setNewTurnusy] = useState<Array<{ dateFrom: string; dateTo: string; priceOverride: string }>>([]);

  // Pro workshop: sestavit primaryMeta automaticky z data a času
  const workshopPrimaryMeta = useMemo(() => {
    if (!wsDate) return '';
    const [year, month, day] = wsDate.split('-').map(Number);
    if (!year || !month || !day) return '';
    const dateLabel = `${day}. ${month}. ${year}`;
    const timeRange = wsTimeFrom && wsTimeTo ? `${wsTimeFrom} - ${wsTimeTo}` : wsTimeFrom || '';
    return timeRange ? `${dateLabel} · ${timeRange}` : dateLabel;
  }, [wsDate, wsTimeFrom, wsTimeTo]);

  // Auto-vyplnit název workshopu z triků
  useEffect(() => {
    if (type !== 'Workshop') return;
    const t1 = trick1.trim();
    const t2 = trick2.trim();
    if (t1 && t2) setTitle(`Workshop: ${t1} + ${t2}`);
    else if (t1) setTitle(`Workshop: ${t1}`);
  }, [type, trick1, trick2]);

  useEffect(() => {
    if (availableCoaches.length === 0) {
      setSelectedCoachIds([]);
      return;
    }
    // Odstraň IDs které už nejsou dostupné
    setSelectedCoachIds((prev) => prev.filter((id) => availableCoaches.some((c) => c.id === id)));
  }, [availableCoaches]);

  function selectType(nextType: ActivityType) {
    const defaults = productDefaults(nextType);
    setType(nextType);
    setTitle('');
    setCity(defaults.city);
    setVenue(defaults.venue);
    setGymContact('');
    setPrimaryMeta(defaults.primaryMeta);
    setWsDate('');
    setWsTimeFrom('10:00');
    setWsTimeTo('17:00');
    setPrice(defaults.price);
    setPrice15('2590');
    setCapacityTotal(defaults.capacityTotal);
    setCapacityCurrent('0');
    setSelectedCoachIds([]);
    setDescription('');
    setTrainingFocus(defaults.trainingFocus);
    setSkillCategory('smisene');
    setTrick1('');
    setTrick2('');
    setTrick1VideoFile('');
    setTrick2VideoFile('');
    setPhotos([]);
    setPhotoCount(0);
    setLatitude(undefined);
    setLongitude(undefined);
    setMessage(null);
    setNewTurnusy([]);
  }

  async function handlePhotoFiles(files: FileList) {
    const results: string[] = [];
    for (const file of Array.from(files)) {
      results.push(await fileToProductPhoto(file));
    }
    setPhotos(results);
    setPhotoCount(results.length);
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const effectivePrimaryMeta = type === 'Workshop' ? workshopPrimaryMeta : primaryMeta;
    if (type === 'Workshop' && !wsDate) {
      setMessage('Vyber datum workshopu.');
      return;
    }
    const requiredFields = [city, venue, effectivePrimaryMeta, price, capacityTotal];
    if (requiredFields.some((value) => value.trim().length === 0)) {
      setMessage('Doplň město, místo, termín, cenu a kapacitu.');
      return;
    }

    setMessage('Ukládám produkt do databáze...');
    try {
      const turnusyInput: TurnusInput[] | undefined = type === 'Tabor' && newTurnusy.length > 0
        ? newTurnusy.filter((t) => t.dateFrom && t.dateTo).map((t) => ({
            dateFrom: t.dateFrom,
            dateTo: t.dateTo,
            price: t.priceOverride ? Number(t.priceOverride) : undefined,
          }))
        : undefined;
      const product = await onAddProduct({
        type,
        title,
        city,
        venue,
        gymContact: gymContact.trim() || undefined,
        primaryMeta: effectivePrimaryMeta,
        price: Number(price),
        price15: type === 'Krouzek' && price15.trim() ? Number(price15) : undefined,
        capacityTotal: Number(capacityTotal),
        capacityCurrent: Number(capacityCurrent),
        coachIds: selectedCoachIds,
        description,
        trainingFocus,
        skillCategory: type === 'Krouzek' ? skillCategory : undefined,
        photos: photos.length > 0 ? photos : undefined,
        workshopTrick1: trick1.trim() || undefined,
        workshopTrick2: trick2.trim() || undefined,
        workshopTrick1VideoFile: trick1VideoFile || undefined,
        workshopTrick2VideoFile: trick2VideoFile || undefined,
        mapQuery: mapQuery.trim() || undefined,
        latitude,
        longitude,
        turnusy: turnusyInput,
      });
      // U kroužku rovnou založ coach_sessions (s GPS z adresy) pro vybrané trenéry,
      // aby kontrola docházky podle polohy fungovala hned po vytvoření.
      if (type === 'Krouzek' && selectedCoachIds.length > 0) {
        await persistCourseCoachAssignments(product, [], selectedCoachIds);
      }
      const turnusCount = turnusyInput ? turnusyInput.length : 0;
      setMessage(turnusCount > 0 ? `${product.title} s ${turnusCount} turnusy je vytvořený.` : `${product.title} je vytvořený a uložený v databázi.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Produkt se nepodařilo uložit.');
    }
  }

  return (
    <form onSubmit={submitProduct} className="grid gap-3">
        <div className="grid grid-cols-3 rounded-[16px] border border-brand-purple/10 bg-brand-paper p-1">
          {(['Krouzek', 'Tabor', 'Workshop'] as const)
            .filter((item) => (item === 'Tabor' ? flags.trainer_camps : item === 'Workshop' ? flags.trainer_workshop_registration : true))
            .map((item) => (
            <button key={item} type="button" onClick={() => selectType(item)} className={`rounded-[12px] px-3 py-2 text-xs font-black transition ${type === item ? 'bg-brand-purple text-white shadow-sm' : 'text-brand-ink-soft hover:text-brand-purple'}`}>
              {activityLabel(item)}
            </button>
          ))}
        </div>

        {/* Workshop: triky a videa */}
        {type === 'Workshop' ? (
          <div className="grid gap-3 rounded-[16px] border border-brand-purple/15 bg-brand-paper p-4">
            <p className="text-xs font-black uppercase text-brand-purple">Triky workshopu</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="grid gap-2 text-xs font-black text-brand-ink-soft">
                  Trik 1 – název
                  <select value={trick1} onChange={(event) => setTrick1(event.target.value)} className="rounded-[14px] border border-brand-purple/15 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-brand-purple">
                    <option value="">— vyber trik —</option>
                    {WORKSHOP_TRICK_LEVELS.map((lvl) => (
                      <optgroup key={lvl.level} label={`${lvl.level}. ${lvl.title} · náramek ${lvl.bracelet}`}>
                        {lvl.tricks.map((t) => <option key={t} value={t}>{t}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-xs font-black text-brand-ink-soft">
                  Video triku 1
                  <div className="flex items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-[14px] border border-brand-purple/20 bg-white px-3 py-2 text-xs font-black text-brand-purple transition hover:bg-brand-purple-light">
                      <Film size={15} />
                      Nahrát video
                      <input
                        type="file"
                        accept="video/*"
                        className="sr-only"
                        onChange={(event) => setTrick1VideoFile(event.target.files?.[0]?.name ?? '')}
                      />
                    </label>
                    {trick1VideoFile ? <span className="truncate text-xs font-bold text-brand-ink-soft">{trick1VideoFile}</span> : null}
                  </div>
                </label>
              </div>
              <div className="grid gap-2">
                <label className="grid gap-2 text-xs font-black text-brand-ink-soft">
                  Trik 2 – název
                  <select value={trick2} onChange={(event) => setTrick2(event.target.value)} className="rounded-[14px] border border-brand-purple/15 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-brand-purple">
                    <option value="">— vyber trik —</option>
                    {WORKSHOP_TRICK_LEVELS.map((lvl) => (
                      <optgroup key={lvl.level} label={`${lvl.level}. ${lvl.title} · náramek ${lvl.bracelet}`}>
                        {lvl.tricks.map((t) => <option key={t} value={t}>{t}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-xs font-black text-brand-ink-soft">
                  Video triku 2
                  <div className="flex items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-[14px] border border-brand-purple/20 bg-white px-3 py-2 text-xs font-black text-brand-purple transition hover:bg-brand-purple-light">
                      <Film size={15} />
                      Nahrát video
                      <input
                        type="file"
                        accept="video/*"
                        className="sr-only"
                        onChange={(event) => setTrick2VideoFile(event.target.files?.[0]?.name ?? '')}
                      />
                    </label>
                    {trick2VideoFile ? <span className="truncate text-xs font-bold text-brand-ink-soft">{trick2VideoFile}</span> : null}
                  </div>
                </label>
              </div>
            </div>
          </div>
        ) : null}

        {/* Kroužek: kategorie úrovně */}
        {type === 'Krouzek' ? (
          <label className="grid gap-2 text-sm font-black text-brand-ink">
            Úroveň kroužku
            <select value={skillCategory} onChange={(event) => setSkillCategory(event.target.value)} className="rounded-[16px] border border-brand-purple/15 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-brand-purple">
              <option value="smisene">Všechny úrovně (bez rozdílu)</option>
              <option value="zacatecnici">Začátečníci</option>
              <option value="pokrocili">Pokročilí</option>
            </select>
          </label>
        ) : null}

        <label className="grid gap-2 text-sm font-black text-brand-ink">
          {type === 'Workshop' ? 'Název (automaticky z triků)' : 'Název'}
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nech prázdné pro automatický název" className="rounded-[16px] border border-brand-purple/15 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-brand-purple" />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <TextInput label="Město" value={city} onChange={setCity} />
          <TextInput label="Místo / sportoviště" value={venue} onChange={setVenue} />
          <TextInput label="Kontakt na tělocvičnu (nepovinné)" value={gymContact} onChange={setGymContact} />
          {/* Workshop: separátní datum + čas místo volného textového pole */}
          {type === 'Workshop' ? (
            <>
              <label className="grid gap-2 text-sm font-black text-brand-ink">
                Datum workshopu
                <input
                  type="date"
                  value={wsDate}
                  onChange={(e) => setWsDate(e.target.value)}
                  className="rounded-[16px] border border-brand-purple/15 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-brand-purple"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-2 text-sm font-black text-brand-ink">
                  Začátek
                  <input
                    type="time"
                    value={wsTimeFrom}
                    onChange={(e) => setWsTimeFrom(e.target.value)}
                    className="rounded-[16px] border border-brand-purple/15 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-brand-purple"
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-brand-ink">
                  Konec
                  <input
                    type="time"
                    value={wsTimeTo}
                    onChange={(e) => setWsTimeTo(e.target.value)}
                    className="rounded-[16px] border border-brand-purple/15 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-brand-purple"
                  />
                </label>
              </div>
            </>
          ) : (
            <TextInput label={type === 'Krouzek' ? 'Den a čas' : 'Termín'} value={primaryMeta} onChange={setPrimaryMeta} />
          )}
          <TextInput label={type === 'Krouzek' ? 'Cena 10 vstupů (Kč)' : 'Cena v Kč'} value={price} onChange={setPrice} inputMode="numeric" />
          {type === 'Krouzek' ? (
            <TextInput label="Cena 15 vstupů (Kč)" value={price15} onChange={setPrice15} inputMode="numeric" />
          ) : null}
          <label className="grid gap-2 text-sm font-black text-brand-ink">
            Kapacita
            <input type="number" min={1} step={1} value={capacityTotal} onChange={(event) => setCapacityTotal(event.target.value)} className="rounded-[16px] border border-brand-purple/15 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-brand-purple" />
          </label>
        </div>

        {/* Turnusy pro tábor */}
        {type === 'Tabor' ? (
          <div className="grid gap-3 rounded-[16px] border border-brand-purple/15 bg-brand-paper p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase text-brand-purple">Turnusy</p>
              <button
                type="button"
                onClick={() => setNewTurnusy((prev) => [...prev, { dateFrom: '', dateTo: '', priceOverride: '' }])}
                className="inline-flex items-center gap-1.5 rounded-[12px] bg-brand-purple/10 px-3 py-1.5 text-xs font-black text-brand-purple transition hover:bg-brand-purple/20"
              >
                <Plus size={13} />
                Přidat turnus
              </button>
            </div>
            {newTurnusy.length === 0 ? (
              <p className="text-xs font-bold text-brand-ink-soft">Bez turnusů — tábor se uloží jako jeden produkt s hodnotou Termín výše.</p>
            ) : (
              newTurnusy.map((turnus, index) => (
                <div key={index} className="grid gap-2 rounded-[14px] border border-brand-purple/10 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-brand-purple">{index + 1}. turnus</p>
                    <button
                      type="button"
                      onClick={() => setNewTurnusy((prev) => prev.filter((_, i) => i !== index))}
                      className="text-xs font-bold text-brand-pink hover:underline"
                    >
                      Odebrat
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="grid gap-1 text-xs font-black text-brand-ink-soft">
                      Datum od
                      <input
                        type="date"
                        value={turnus.dateFrom}
                        onChange={(e) => setNewTurnusy((prev) => prev.map((t, i) => i === index ? { ...t, dateFrom: e.target.value } : t))}
                        className="rounded-[12px] border border-brand-purple/15 bg-brand-paper px-3 py-2 text-sm font-bold outline-none focus:border-brand-purple"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-black text-brand-ink-soft">
                      Datum do
                      <input
                        type="date"
                        value={turnus.dateTo}
                        onChange={(e) => setNewTurnusy((prev) => prev.map((t, i) => i === index ? { ...t, dateTo: e.target.value } : t))}
                        className="rounded-[12px] border border-brand-purple/15 bg-brand-paper px-3 py-2 text-sm font-bold outline-none focus:border-brand-purple"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-black text-brand-ink-soft">
                      Cena Kč (volitelně)
                      <input
                        type="number"
                        value={turnus.priceOverride}
                        onChange={(e) => setNewTurnusy((prev) => prev.map((t, i) => i === index ? { ...t, priceOverride: e.target.value } : t))}
                        placeholder={price}
                        className="rounded-[12px] border border-brand-purple/15 bg-brand-paper px-3 py-2 text-sm font-bold outline-none focus:border-brand-purple"
                      />
                    </label>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}

        <div className="grid gap-2">
          <p className="text-sm font-black text-brand-ink">Trenéři produktu</p>
          {availableCoaches.length === 0 ? (
            <p className="rounded-[14px] bg-brand-paper px-3 py-2.5 text-xs font-bold text-brand-ink-soft">Nejprve přidej trenéry v sekci Trenéři.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableCoaches.map((coach) => {
                const checked = selectedCoachIds.includes(coach.id);
                return (
                  <button
                    key={coach.id}
                    type="button"
                    onClick={() => setSelectedCoachIds((prev) => checked ? prev.filter((id) => id !== coach.id) : [...prev, coach.id])}
                    className={`inline-flex items-center gap-1.5 rounded-[12px] border px-3 py-2 text-xs font-black transition ${
                      checked ? 'border-brand-purple bg-brand-purple text-white' : 'border-brand-purple/15 bg-brand-paper text-brand-ink-soft hover:border-brand-purple/35 hover:text-brand-purple'
                    }`}
                  >
                    <CheckCircle2 size={13} />
                    {coach.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <label className="grid gap-2 text-sm font-black text-brand-ink">
          Popis
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Krátký popis pro web a rodiče" className="rounded-[16px] border border-brand-purple/15 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-brand-purple" />
        </label>

        <TextInput label="Adresa pro mapu (např. ZŠ Purkyňova Vyškov)" value={mapQuery} onChange={setMapQuery} />

        {type === 'Krouzek' || type === 'Workshop' ? (
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black text-brand-ink">{type === 'Workshop' ? 'Přesná poloha workshopu (uvidí ji rodiče na mapě)' : 'Přesná poloha tělocvičny (pro ověření docházky trenéra)'}</p>
              <button
                type="button"
                onClick={() => void mapRef.current?.searchAddress(mapQuery.trim() || [venue, city].filter(Boolean).join(', '))}
                className="shrink-0 rounded-[12px] bg-brand-purple px-3 py-2 text-xs font-black text-white transition hover:opacity-90"
              >
                Najít na mapě
              </button>
            </div>
            <LocationPickerMap
              ref={mapRef}
              latitude={latitude}
              longitude={longitude}
              onChange={(coords) => { setLatitude(coords.latitude); setLongitude(coords.longitude); }}
            />
          </div>
        ) : null}

        <div className="grid gap-2 rounded-[16px] border border-brand-purple/15 bg-brand-paper p-4">
          <p className="text-xs font-black uppercase text-brand-purple">Fotky produktu</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-[14px] border border-brand-purple/20 bg-white px-3 py-2.5 text-sm font-black text-brand-purple transition hover:bg-brand-purple-light">
              <ImagePlus size={17} />
              Přiložit fotky
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(event) => { if (event.target.files) void handlePhotoFiles(event.target.files); }}
              />
            </label>
            {photoCount > 0 ? (
              <span className="rounded-[14px] bg-brand-purple-light px-3 py-2 text-xs font-black text-brand-purple">{photoCount} {photoCount === 1 ? 'fotka' : photoCount < 5 ? 'fotky' : 'fotek'} připraveno</span>
            ) : (
              <span className="text-xs font-bold text-brand-ink-soft">První fotka bude hlavní obrázek, další se objeví v galerii detailu.</span>
            )}
          </div>
          {photos.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {photos.map((src, index) => (
                <img key={index} src={src} alt={`Náhled ${index + 1}`} className="h-16 w-16 rounded-[12px] object-cover shadow-sm" />
              ))}
            </div>
          ) : null}
        </div>

        <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-[16px] bg-brand-purple px-4 py-3 text-sm font-black text-white shadow-brand transition hover:bg-brand-purple-deep">
          <Plus size={17} />
          Vytvořit a publikovat
        </button>
        {message ? <p className="rounded-[16px] bg-brand-purple-light p-3 text-sm font-bold leading-6 text-brand-ink-soft">{message}</p> : null}
    </form>
  );
}

async function fileToProductPhoto(file: File) {
  if (!file.type.startsWith('image/')) return readFileAsDataUrl(file);

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = objectUrl;
    });
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) return readFileAsDataUrl(file);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return readFileAsDataUrl(file);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

function productCoachNames(product: ParentProduct, coaches: AdminCoachSummary[]) {
  return (product.coachIds ?? [])
    .map((coachId) => coaches.find((coach) => coach.id === coachId)?.name)
    .filter(Boolean)
    .join(', ');
}

function ProductCoachAssignment({ product, coaches, onChange }: { product: ParentProduct; coaches: AdminCoachSummary[]; onChange: (coachIds: string[]) => Promise<void> }) {
  const [savingCoachId, setSavingCoachId] = useState<string | null>(null);
  const activeCoaches = coaches.filter((coach) => coach.status !== 'Pozastaveny');
  const coachIds = product.coachIds ?? [];

  async function toggleCoach(coachId: string) {
    const nextCoachIds = coachIds.includes(coachId) ? coachIds.filter((id) => id !== coachId) : [...coachIds, coachId];
    setSavingCoachId(coachId);
    try {
      await onChange(nextCoachIds);
    } finally {
      setSavingCoachId(null);
    }
  }

  return (
    <div className="mt-3 rounded-[14px] border border-brand-purple/10 bg-white p-3">
      <p className="text-xs font-black uppercase text-brand-purple">Trenéři</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {activeCoaches.map((coach) => {
          const selected = coachIds.includes(coach.id);
          const saving = savingCoachId === coach.id;
          return (
            <button
              key={coach.id}
              type="button"
              onClick={() => toggleCoach(coach.id)}
              disabled={saving}
              className={`inline-flex items-center gap-1.5 rounded-[12px] border px-3 py-2 text-xs font-black transition ${selected ? 'border-brand-purple bg-brand-purple text-white' : 'border-brand-purple/15 bg-brand-paper text-brand-ink-soft hover:border-brand-purple/35 hover:text-brand-purple'}`}
            >
              <CheckCircle2 size={13} />
              {saving ? 'Ukládám...' : coach.name}
            </button>
          );
        })}
        {activeCoaches.length === 0 ? <span className="text-xs font-bold text-brand-ink-soft">Žádný aktivní trenér.</span> : null}
      </div>
    </div>
  );
}

function GroupedCampCard({ group, coaches, onRemoveAll, onRemoveTurnus, onCoachIdsChange }: { group: { baseId: string; first: ParentProduct; turnusy: ParentProduct[] }; coaches: AdminCoachSummary[]; onRemoveAll: () => void; onRemoveTurnus: (turnus: ParentProduct) => void; onCoachIdsChange: (coachIds: string[]) => Promise<void> }) {
  const { first, turnusy } = group;
  const coachNames = productCoachNames(first, coaches);
  const isCreated = first.id.startsWith('admin-created-');

  return (
    <div className="rounded-[18px] border border-brand-purple/12 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label="Tábor" tone="orange" />
          {isCreated ? <StatusPill label="Z adminu" tone="purple" /> : <StatusPill label="Na webu" tone="mint" />}
        </div>
        <button type="button" onClick={onRemoveAll} className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-brand-paper text-brand-pink transition hover:bg-brand-pink hover:text-white" aria-label="Smazat tábor">
          <Trash2 size={17} />
        </button>
      </div>
      <h3 className="mt-3 text-lg font-black text-brand-ink">{first.title}</h3>
      <p className="mt-1 text-sm font-bold text-brand-ink-soft">{first.place}</p>
      {coachNames ? <p className="mt-1 text-sm font-black text-brand-purple">Trenér: {coachNames}</p> : null}
      <div className="mt-3 grid gap-1.5">
        {turnusy.map((turnus) => (
          <div key={turnus.id} className="flex items-center justify-between rounded-[12px] bg-brand-paper px-3 py-2">
            <p className="text-sm font-bold text-brand-ink">{turnus.primaryMeta}</p>
            <div className="flex items-center gap-3">
              <p className="shrink-0 text-sm font-black text-brand-purple">{turnus.price.toLocaleString('cs-CZ')} Kč</p>
              <button type="button" onClick={() => onRemoveTurnus(turnus)} className="text-brand-pink transition hover:opacity-70" aria-label="Smazat turnus">
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <Metric value={`${first.capacityCurrent}/${first.capacityTotal}`} label="kapacita / turnus" />
        <Metric value={`${turnusy.length}`} label={turnusy.length === 1 ? 'turnus' : turnusy.length < 5 ? 'turnusy' : 'turnusů'} />
      </div>
      <ProductCoachAssignment product={first} coaches={coaches} onChange={onCoachIdsChange} />
      <ProductDocumentSlotsCard productId={first.id} activityType="Tábor" />
    </div>
  );
}

function CourseDayCounts({ product }: { product: ParentProduct }) {
  const scheduleDays = useMemo(() => (product.type === 'Krouzek' ? parseScheduleDays(product.primaryMeta) : []), [product.type, product.primaryMeta]);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (scheduleDays.length < 2 || !hasSupabaseBrowserConfig()) return;
    let cancelled = false;
    const supabase = createBrowserSupabaseClient();
    void supabase
      .from('parent_purchases')
      .select('id,parent_profile_id,participant_id,participant_name,training_days,status')
      .in('product_id', [product.id, `${product.id}-15`])
      .then(({ data }) => {
        if (cancelled || !data) return;
        const rows = (data as Array<{ id: string; parent_profile_id?: string | null; participant_id?: string | null; participant_name?: string | null; training_days?: string[] | null; status?: string | null }>)
          .filter((row) => String(row.status || '') === 'Zaplaceno' && !isDemoAdminRecord(row.id, row.parent_profile_id, row.participant_id, row.participant_name));
        const next: Record<string, number> = {};
        for (const day of scheduleDays) {
          const participants = new Set<string>();
          for (const row of rows) {
            const days = Array.isArray(row.training_days) ? row.training_days : [];
            const attendsDay = days.length === 0 || days.some((item) => normalizeDayName(String(item)) === normalizeDayName(day));
            if (attendsDay) participants.add(String(row.participant_id || row.id));
          }
          next[day] = participants.size;
        }
        setCounts(next);
      });
    return () => { cancelled = true; };
  }, [product.id, scheduleDays]);

  if (scheduleDays.length < 2 || !counts) return null;
  return (
    <div className="mt-2 grid grid-cols-2 gap-2 text-center">
      {scheduleDays.map((day) => (
        <Metric key={day} value={`${counts[day] ?? 0} dětí`} label={day} />
      ))}
    </div>
  );
}

function GroupedCourseCard({ group, coaches, isCreated, onRemove, onEdit, onEditVariant15, onCoachIdsChange }: { group: { baseId: string; base: ParentProduct; variant15: ParentProduct | null }; coaches: AdminCoachSummary[]; isCreated: boolean; onRemove: () => void; onEdit: (edits: ProductEdits) => void; onEditVariant15?: (edits: ProductEdits) => void; onCoachIdsChange: (coachIds: string[]) => Promise<void> }) {
  const { base, variant15 } = group;
  const coachNames = productCoachNames(base, coaches);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(base.title);
  const [place, setPlace] = useState(base.place);
  const [gymContact, setGymContact] = useState(base.gymContact ?? '');
  const [primaryMeta, setPrimaryMeta] = useState(base.primaryMeta);
  const [capacityTotal, setCapacityTotal] = useState(String(base.capacityTotal));
  const [price, setPrice] = useState(String(base.price));
  const [price15, setPrice15] = useState(variant15 ? String(variant15.price) : '');
  const [mapQuery, setMapQuery] = useState(base.mapQuery ?? '');
  const [latitude, setLatitude] = useState<number | undefined>(base.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(base.longitude);
  const mapRef = useRef<LocationPickerMapHandle>(null);
  const existingGallery = base.gallery ?? (base.heroImage ? [base.heroImage] : []);
  const initialHeroIdx = Math.max(0, existingGallery.indexOf(base.heroImage ?? ''));
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoCount, setPhotoCount] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const [existingHeroIndex, setExistingHeroIndex] = useState(initialHeroIdx);
  const photoInputRef = useRef<HTMLInputElement>(null);

  async function handlePhotoFiles(files: FileList) {
    const results: string[] = [];
    for (const file of Array.from(files)) {
      results.push(await fileToProductPhoto(file));
    }
    setPhotos(results);
    setPhotoCount(results.length);
    setHeroIndex(0);
  }

  function handleSave() {
    const priceValue = Number(price);
    const edits: ProductEdits = { title, place, gymContact: gymContact.trim() || undefined, primaryMeta, capacityTotal: Number(capacityTotal), mapQuery: mapQuery.trim() || undefined, latitude, longitude };
    if (Number.isFinite(priceValue) && priceValue > 0) {
      edits.price = priceValue;
      edits.priceLabel = `10 vstupů · ${priceValue.toLocaleString('cs-CZ')} Kč`;
    }
    if (photos.length > 0) {
      edits.heroImage = photos[heroIndex] ?? photos[0];
      edits.gallery = photos;
    } else if (existingGallery.length > 0) {
      edits.heroImage = existingGallery[existingHeroIndex] ?? existingGallery[0];
    }
    onEdit(edits);
    const price15Value = Number(price15);
    if (onEditVariant15 && variant15 && Number.isFinite(price15Value) && price15Value > 0) {
      onEditVariant15({ price: price15Value, priceLabel: `15 vstupů · ${price15Value.toLocaleString('cs-CZ')} Kč` });
    }
    setEditing(false);
  }

  return (
    <>
      <div className="rounded-[18px] border border-brand-purple/12 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label="Kroužek" tone="mint" />
            {isCreated ? <StatusPill label="Z adminu" tone="purple" /> : <StatusPill label="Na webu" tone="mint" />}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(true)} className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-brand-paper text-brand-ink-soft transition hover:bg-brand-purple/10 hover:text-brand-purple" aria-label="Upravit produkt">
              <Pencil size={16} />
            </button>
            <button type="button" onClick={onRemove} className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-brand-paper text-brand-pink transition hover:bg-brand-pink hover:text-white" aria-label="Smazat produkt">
              <Trash2 size={17} />
            </button>
          </div>
        </div>
        <h3 className="mt-3 text-lg font-black text-brand-ink">{base.title}</h3>
        <p className="mt-1 text-sm font-bold text-brand-ink-soft">{base.place} · {base.primaryMeta}</p>
        {coachNames ? <p className="mt-1 text-sm font-black text-brand-purple">Trenér: {coachNames}</p> : null}
        <div className="mt-3 grid gap-1.5">
          {[base, ...(variant15 ? [variant15] : [])].map((variant) => (
            <div key={variant.id} className="flex items-center justify-between rounded-[12px] bg-brand-paper px-3 py-2">
              <p className="text-sm font-bold text-brand-ink">{variant.priceLabel}</p>
              <p className="text-sm font-black text-brand-purple">{variant.price.toLocaleString('cs-CZ')} Kč</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <Metric value={`${base.capacityCurrent}/${base.capacityTotal}`} label="kapacita" />
          <Metric value={isCreated ? 'Přidáno' : 'Vestavěný'} label="původ" />
        </div>
        <CourseDayCounts product={base} />
        <ProductCoachAssignment product={base} coaches={coaches} onChange={onCoachIdsChange} />
      </div>

      <AnimatePresence>
        {editing && (
          <>
            <motion.div key="course-edit-backdrop" className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
              onClick={() => setEditing(false)} />
            <motion.div key="course-edit-modal"
              className="fixed inset-x-4 top-[3vh] z-50 mx-auto flex max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" style={{ maxHeight: '94vh' }}
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}>
              <div className="flex flex-shrink-0 items-center justify-between border-b border-brand-purple/8 px-6 py-4">
                <div>
                  <p className="text-base font-black text-brand-ink">Upravit kroužek</p>
                  <p className="text-xs font-bold text-brand-ink-soft">{base.title}</p>
                </div>
                <button type="button" onClick={() => setEditing(false)} className="ml-4 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-paper text-brand-ink-soft transition hover:bg-brand-purple/10 hover:text-brand-purple">
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-8 pt-5">
                <div className="grid gap-3">
                  <TextInput label="Název" value={title} onChange={setTitle} />
                  <TextInput label="Místo" value={place} onChange={setPlace} />
                  <TextInput label="Kontakt na tělocvičnu (nepovinné)" value={gymContact} onChange={setGymContact} />
                  <TextInput label="Čas / rozvrh" value={primaryMeta} onChange={setPrimaryMeta} />
                  <TextInput label="Kapacita" value={capacityTotal} onChange={setCapacityTotal} inputMode="numeric" />
                  <div className="grid grid-cols-2 gap-3">
                    <TextInput label="Cena 10 vstupů (Kč)" value={price} onChange={setPrice} inputMode="numeric" />
                    {variant15 ? <TextInput label="Cena 15 vstupů (Kč)" value={price15} onChange={setPrice15} inputMode="numeric" /> : null}
                  </div>
                  <TextInput label="Adresa pro mapu (např. ZŠ Purkyňova Vyškov)" value={mapQuery} onChange={setMapQuery} />
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-brand-ink">Přesná poloha tělocvičny (pro ověření docházky trenéra)</p>
                      <button
                        type="button"
                        onClick={() => void mapRef.current?.searchAddress(mapQuery.trim() || place)}
                        className="shrink-0 rounded-[12px] bg-brand-purple px-3 py-2 text-xs font-black text-white transition hover:opacity-90"
                      >
                        Najít na mapě
                      </button>
                    </div>
                    <LocationPickerMap
                      ref={mapRef}
                      latitude={latitude}
                      longitude={longitude}
                      onChange={(coords) => { setLatitude(coords.latitude); setLongitude(coords.longitude); }}
                    />
                  </div>
                  <ProductDocumentSlotsCard productId={base.id} activityType="Kroužek" />
                  <div className="grid gap-2 rounded-[16px] border border-brand-purple/15 bg-brand-paper p-3">
                    <p className="text-xs font-black uppercase text-brand-purple">Fotky produktu</p>
                    {photos.length === 0 && existingGallery.length > 0 ? (
                      <>
                        <p className="text-[10px] font-bold text-brand-ink-soft">Klikni na fotku pro výběr hlavní fotky webu.</p>
                        <div className="flex flex-wrap gap-2">
                          {existingGallery.map((src, index) => (
                            <button key={index} type="button" onClick={() => setExistingHeroIndex(index)}
                              className={`relative h-14 w-14 rounded-[10px] overflow-hidden shadow-sm ring-2 transition ${
                                existingHeroIndex === index ? 'ring-brand-purple' : 'ring-transparent hover:ring-brand-purple/40'
                              }`}>
                              <img src={src} alt={`Fotka ${index + 1}`} className="h-full w-full object-cover" />
                              {existingHeroIndex === index && (
                                <span className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-purple text-white text-[9px] font-black">✓</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-[14px] border border-brand-purple/20 bg-white px-3 py-2 text-xs font-black text-brand-purple transition hover:bg-brand-purple-light">
                      <ImagePlus size={15} />
                      {photoCount > 0 ? `${photoCount} ${photoCount === 1 ? 'fotka' : photoCount < 5 ? 'fotky' : 'fotek'} vybrány` : 'Přidat / nahradit fotky'}
                      <input ref={photoInputRef} type="file" accept="image/*" multiple className="sr-only"
                        onChange={(event) => { if (event.target.files) void handlePhotoFiles(event.target.files); }} />
                    </label>
                    {photos.length > 0 ? (
                      <>
                        <p className="text-[10px] font-bold text-brand-ink-soft">Klikni na fotku pro výběr hlavní fotky webu.</p>
                        <div className="flex flex-wrap gap-2">
                          {photos.map((src, index) => (
                            <button key={index} type="button" onClick={() => setHeroIndex(index)}
                              className={`relative h-14 w-14 rounded-[10px] overflow-hidden shadow-sm ring-2 transition ${
                                heroIndex === index ? 'ring-brand-purple' : 'ring-transparent hover:ring-brand-purple/40'
                              }`}>
                              <img src={src} alt={`Náhled ${index + 1}`} className="h-full w-full object-cover" />
                              {heroIndex === index && (
                                <span className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-purple text-white text-[9px] font-black">✓</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleSave} className="flex-1 rounded-[14px] bg-brand-purple py-2.5 text-sm font-black text-white transition hover:opacity-80">Uložit</button>
                    <button type="button" onClick={() => setEditing(false)} className="flex-1 rounded-[14px] bg-brand-paper py-2.5 text-sm font-black text-brand-ink-soft transition hover:text-brand-ink">Zrušit</button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function AdminProductCard({ product, coaches, isCreated, onRemove, onEdit, onCoachIdsChange }: { product: ParentProduct; coaches: AdminCoachSummary[]; isCreated: boolean; onRemove: () => void; onEdit: (edits: ProductEdits) => void; onCoachIdsChange: (coachIds: string[]) => Promise<void> }) {
  const coachNames = productCoachNames(product, coaches);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(product.title);
  const [place, setPlace] = useState(product.place);
  const [gymContact, setGymContact] = useState(product.gymContact ?? '');
  const [primaryMeta, setPrimaryMeta] = useState(product.primaryMeta);
  const [price, setPrice] = useState(String(product.price));
  const [capacityTotal, setCapacityTotal] = useState(String(product.capacityTotal));
  const [mapQuery, setMapQuery] = useState(product.mapQuery ?? '');
  const existingGallery = product.gallery ?? (product.heroImage ? [product.heroImage] : []);
  const initialHeroIdx = Math.max(0, existingGallery.indexOf(product.heroImage ?? ''));
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoCount, setPhotoCount] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const [existingHeroIndex, setExistingHeroIndex] = useState(initialHeroIdx);
  const [clearImage, setClearImage] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  // Workshop video state
  const [trick1VideoUrl, setTrick1VideoUrl] = useState(() => product.importantInfo.find((i) => i.label === 'Video trik 1')?.value ?? '');
  const [trick2VideoUrl, setTrick2VideoUrl] = useState(() => product.importantInfo.find((i) => i.label === 'Video trik 2')?.value ?? '');
  const [videoUploading, setVideoUploading] = useState(false);

  async function handlePhotoFiles(files: FileList) {
    const results: string[] = [];
    for (const file of Array.from(files)) {
      results.push(await fileToProductPhoto(file));
    }
    setPhotos(results);
    setPhotoCount(results.length);
    setHeroIndex(0);
    setClearImage(false);
  }

  async function handleVideoUpload(file: File, setUrl: (url: string) => void) {
    setVideoUploading(true);
    try {
      const { signedUrl, path } = await createProductVideoUploadUrl(file.name);
      await fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'video/mp4' } });
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
      setUrl(`${supabaseUrl}/storage/v1/object/public/product-videos/${path}`);
    } catch {
      // keep existing url on error
    } finally {
      setVideoUploading(false);
    }
  }

  function handleSave() {
    const priceNum = Number(price);
    const edits: ProductEdits = { title, place, gymContact: gymContact.trim() || undefined, primaryMeta, price: priceNum, priceLabel: `${priceNum.toLocaleString('cs-CZ')} Kč`, capacityTotal: Number(capacityTotal), mapQuery: mapQuery.trim() || undefined };
    if (product.type === 'Workshop') {
      const baseInfo = product.importantInfo.filter((i) => i.label !== 'Video trik 1' && i.label !== 'Video trik 2');
      const videoInfo: typeof product.importantInfo = [];
      if (trick1VideoUrl) videoInfo.push({ label: 'Video trik 1', value: trick1VideoUrl });
      if (trick2VideoUrl) videoInfo.push({ label: 'Video trik 2', value: trick2VideoUrl });
      edits.importantInfo = [...baseInfo, ...videoInfo];
    }
    if (photos.length > 0) {
      edits.heroImage = photos[heroIndex] ?? photos[0];
      edits.gallery = photos;
    } else if (clearImage) {
      edits.heroImage = '';
      edits.gallery = [];
    } else if (existingGallery.length > 0) {
      edits.heroImage = existingGallery[existingHeroIndex] ?? existingGallery[0];
    }
    onEdit(edits);
    setEditing(false);
  }

  return (
    <>
      <div className="rounded-[18px] border border-brand-purple/12 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={activityLabel(product.type)} tone={product.type === 'Workshop' ? 'purple' : product.type === 'Tabor' ? 'orange' : 'mint'} />
            {isCreated ? <StatusPill label="Z adminu" tone="purple" /> : <StatusPill label="Na webu" tone="mint" />}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(true)} className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-brand-paper text-brand-ink-soft transition hover:bg-brand-purple/10 hover:text-brand-purple" aria-label="Upravit produkt">
              <Pencil size={16} />
            </button>
            <button type="button" onClick={onRemove} className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-brand-paper text-brand-pink transition hover:bg-brand-pink hover:text-white" aria-label="Smazat produkt">
              <Trash2 size={17} />
            </button>
          </div>
        </div>
        <h3 className="mt-3 text-lg font-black text-brand-ink">{product.title}</h3>
        <p className="mt-1 text-sm font-bold text-brand-ink-soft">{product.place} · {product.primaryMeta}</p>
        {coachNames ? <p className="mt-1 text-sm font-black text-brand-purple">Trenér: {coachNames}</p> : null}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Metric value={product.priceLabel} label="cena" />
          <Metric value={`${product.capacityCurrent}/${product.capacityTotal}`} label="kapacita" />
          <Metric value={isCreated ? 'Přidáno' : 'Vestavěný'} label="původ" />
        </div>
        <ProductCoachAssignment product={product} coaches={coaches} onChange={onCoachIdsChange} />
        {product.description ? <p className="mt-3 text-sm font-bold leading-6 text-brand-ink-soft">{product.description}</p> : null}
      </div>

      <AnimatePresence>
        {editing && (
          <>
            <motion.div key="product-edit-backdrop" className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
              onClick={() => setEditing(false)} />
            <motion.div key="product-edit-modal"
              className="fixed inset-x-4 top-[3vh] z-50 mx-auto flex max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" style={{ maxHeight: '94vh' }}
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}>
              <div className="flex flex-shrink-0 items-center justify-between border-b border-brand-purple/8 px-6 py-4">
                <div>
                  <p className="text-base font-black text-brand-ink">Upravit produkt</p>
                  <p className="text-xs font-bold text-brand-ink-soft">{product.title}</p>
                </div>
                <button type="button" onClick={() => setEditing(false)} className="ml-4 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-paper text-brand-ink-soft transition hover:bg-brand-purple/10 hover:text-brand-purple">
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-8 pt-5">
                <div className="grid gap-3">
                  <TextInput label="Název" value={title} onChange={setTitle} />
                  <TextInput label="Místo" value={place} onChange={setPlace} />
                  <TextInput label="Kontakt na tělocvičnu (nepovinné)" value={gymContact} onChange={setGymContact} />
                  <TextInput label="Datum / čas" value={primaryMeta} onChange={setPrimaryMeta} />
                  <TextInput label="Cena (Kč)" value={price} onChange={setPrice} inputMode="numeric" />
                  <TextInput label="Kapacita" value={capacityTotal} onChange={setCapacityTotal} inputMode="numeric" />
                  <TextInput label="Adresa pro mapu (např. ZŠ Purkyňova Vyškov)" value={mapQuery} onChange={setMapQuery} />
                  <ProductDocumentSlotsCard productId={product.id} activityType={product.type === 'Tabor' ? 'Tábor' : product.type === 'Workshop' ? 'Workshop' : 'Kroužek'} />
                  {product.type === 'Workshop' ? (
                    <div className="grid gap-3 rounded-[16px] border border-brand-purple/15 bg-brand-paper p-4">
                      <p className="text-xs font-black uppercase text-brand-purple">Videa triků</p>
                      {videoUploading ? <p className="text-xs font-bold text-brand-purple">Nahrávám video…</p> : null}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                          <p className="text-xs font-black text-brand-ink-soft">Video trik 1</p>
                          {trick1VideoUrl ? (
                            <video src={trick1VideoUrl} controls className="w-full rounded-[12px] bg-black" style={{ maxHeight: 120 }} playsInline />
                          ) : null}
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-[14px] border border-brand-purple/20 bg-white px-3 py-2 text-xs font-black text-brand-purple transition hover:bg-brand-purple-light">
                            <Film size={14} />
                            {trick1VideoUrl ? 'Nahradit video' : 'Nahrát video'}
                            <input type="file" accept="video/*" className="sr-only"
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleVideoUpload(f, setTrick1VideoUrl); }} />
                          </label>
                          {trick1VideoUrl ? (
                            <button type="button" onClick={() => setTrick1VideoUrl('')} className="text-xs font-black text-brand-pink hover:underline">Odebrat video</button>
                          ) : null}
                        </div>
                        <div className="grid gap-1.5">
                          <p className="text-xs font-black text-brand-ink-soft">Video trik 2</p>
                          {trick2VideoUrl ? (
                            <video src={trick2VideoUrl} controls className="w-full rounded-[12px] bg-black" style={{ maxHeight: 120 }} playsInline />
                          ) : null}
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-[14px] border border-brand-purple/20 bg-white px-3 py-2 text-xs font-black text-brand-purple transition hover:bg-brand-purple-light">
                            <Film size={14} />
                            {trick2VideoUrl ? 'Nahradit video' : 'Nahrát video'}
                            <input type="file" accept="video/*" className="sr-only"
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleVideoUpload(f, setTrick2VideoUrl); }} />
                          </label>
                          {trick2VideoUrl ? (
                            <button type="button" onClick={() => setTrick2VideoUrl('')} className="text-xs font-black text-brand-pink hover:underline">Odebrat video</button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="grid gap-2 rounded-[16px] border border-brand-purple/15 bg-brand-paper p-3">
                    <p className="text-xs font-black uppercase text-brand-purple">Fotky produktu</p>
                    {photos.length === 0 && existingGallery.length > 0 && !clearImage ? (
                      <>
                        <p className="text-[10px] font-bold text-brand-ink-soft">Klikni na fotku pro výběr hlavní fotky webu.</p>
                        <div className="flex flex-wrap gap-2">
                          {existingGallery.map((src, index) => (
                            <button key={index} type="button" onClick={() => setExistingHeroIndex(index)}
                              className={`relative h-14 w-14 rounded-[10px] overflow-hidden shadow-sm ring-2 transition ${
                                existingHeroIndex === index ? 'ring-brand-purple' : 'ring-transparent hover:ring-brand-purple/40'
                              }`}>
                              <img src={src} alt={`Fotka ${index + 1}`} className="h-full w-full object-cover" />
                              {existingHeroIndex === index && (
                                <span className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-purple text-white text-[9px] font-black">✓</span>
                              )}
                            </button>
                          ))}
                        </div>
                        <button type="button" onClick={() => setClearImage(true)} className="inline-flex w-fit items-center gap-1.5 rounded-[10px] bg-brand-pink/10 px-2.5 py-1 text-xs font-black text-brand-pink transition hover:bg-brand-pink/20">
                          <Trash2 size={12} /> Smazat všechny fotky
                        </button>
                      </>
                    ) : clearImage ? (
                      <div className="flex items-center gap-2 rounded-[10px] bg-brand-pink/10 px-3 py-2">
                        <span className="flex-1 text-xs font-bold text-brand-pink">Fotky budou smazány po uložení.</span>
                        <button type="button" onClick={() => setClearImage(false)} className="text-xs font-black text-brand-ink-soft hover:text-brand-ink">Zpět</button>
                      </div>
                    ) : null}
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-[14px] border border-brand-purple/20 bg-white px-3 py-2 text-xs font-black text-brand-purple transition hover:bg-brand-purple-light">
                      <ImagePlus size={15} />
                      {photoCount > 0 ? `${photoCount} ${photoCount === 1 ? 'fotka' : photoCount < 5 ? 'fotky' : 'fotek'} vybrány` : 'Přidat / nahradit fotky'}
                      <input ref={photoInputRef} type="file" accept="image/*" multiple className="sr-only"
                        onChange={(event) => { if (event.target.files) void handlePhotoFiles(event.target.files); }} />
                    </label>
                    {photos.length > 0 ? (
                      <>
                        <p className="text-[10px] font-bold text-brand-ink-soft">Klikni na fotku pro výběr hlavní fotky webu.</p>
                        <div className="flex flex-wrap gap-2">
                          {photos.map((src, index) => (
                            <button key={index} type="button" onClick={() => setHeroIndex(index)}
                              className={`relative h-14 w-14 rounded-[10px] overflow-hidden shadow-sm ring-2 transition ${
                                heroIndex === index ? 'ring-brand-purple' : 'ring-transparent hover:ring-brand-purple/40'
                              }`}>
                              <img src={src} alt={`Náhled ${index + 1}`} className="h-full w-full object-cover" />
                              {heroIndex === index && (
                                <span className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-purple text-white text-[9px] font-black">✓</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleSave} className="flex-1 rounded-[14px] bg-brand-purple py-2.5 text-sm font-black text-white transition hover:opacity-80">Uložit</button>
                    <button type="button" onClick={() => setEditing(false)} className="flex-1 rounded-[14px] bg-brand-paper py-2.5 text-sm font-black text-brand-ink-soft transition hover:text-brand-ink">Zrušit</button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function TextInput({ label, value, onChange, inputMode }: { label: string; value: string; onChange: (value: string) => void; inputMode?: 'numeric' | 'decimal' }) {
  return (
    <label className="grid gap-2 text-sm font-black text-brand-ink">
      {label}
      <input value={value} inputMode={inputMode} onChange={(event) => onChange(event.target.value)} className="rounded-[16px] border border-brand-purple/15 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-brand-purple" />
    </label>
  );
}

function productDefaults(type: ActivityType) {
  void type;
  return { city: '', venue: '', primaryMeta: '', price: '', capacityTotal: '', trainingFocus: '' };
}

function PastSessionRow({ rec, slotTricks, cityBadge, cityText, fmtDate }: {
  rec: WorkshopAttendanceRecord & { slot: WorkshopSlot };
  slotTricks: number;
  cityBadge: string;
  cityText: string;
  fmtDate: (iso: string) => string;
}) {
  return (
    <div className="rounded-[14px] bg-brand-paper px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`shrink-0 rounded-[8px] px-2 py-0.5 text-xs font-black ${cityBadge}`}>{rec.slot.city}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-brand-ink leading-tight">{fmtDate(rec.slot.date)}</p>
          <p className="text-[11px] text-brand-ink-soft">{rec.slot.venue} · {rec.slot.time}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-black text-brand-ink leading-tight">{rec.attendees}</p>
            <p className="text-[9px] font-bold uppercase text-brand-ink-soft">účastníků</p>
          </div>
          <div className="text-right">
            <p className={`text-sm font-black leading-tight ${cityText}`}>{slotTricks}</p>
            <p className="text-[9px] font-bold uppercase text-brand-ink-soft">triků</p>
          </div>
        </div>
      </div>
      {rec.coachTrickCounts.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {rec.coachTrickCounts.map((ct) => (
            <span key={ct.coachId} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-brand-ink shadow-sm">
              {ct.coachName.split(' ')[0]} · {ct.count} triků
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkshopStatsPanel({ allSlots, attendanceRecords, onOpenParticipant }: { allSlots: WorkshopSlot[]; attendanceRecords: WorkshopAttendanceRecord[]; onOpenParticipant?: (participant: ParentParticipant, place: string) => void }) {
  const CITY_BADGE: Record<WorkshopCity, string> = { Brno: 'bg-[#8B1DFF] text-white', Praha: 'bg-[#1FB37A] text-white', Ostrava: 'bg-[#FFB21A] text-brand-ink' };
  const CITY_TEXT: Record<WorkshopCity, string> = { Brno: 'text-[#8B1DFF]', Praha: 'text-[#1FB37A]', Ostrava: 'text-[#FFB21A]' };
  const CITY_BG: Record<WorkshopCity, string> = { Brno: 'bg-[#8B1DFF]/10', Praha: 'bg-[#1FB37A]/10', Ostrava: 'bg-[#FFB21A]/15' };
  const [monthIdx, setMonthIdx] = useState(0);

  const allRecords = attendanceRecords.map((rec) => {
    const slot = allSlots.find((s) => s.id === rec.slotId);
    return { ...rec, slot };
  }).filter((r): r is WorkshopAttendanceRecord & { slot: WorkshopSlot } => !!r.slot);

  // Group by month (newest first)
  const groups: { key: string; label: string; items: typeof allRecords }[] = [];
  for (const rec of [...allRecords].sort((a, b) => b.slot.date.localeCompare(a.slot.date))) {
    const [y, m] = rec.slot.date.split('-');
    const key = `${y}-${m}`;
    const label = new Date(Number(y), Number(m) - 1, 1).toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });
    const existing = groups.find((g) => g.key === key);
    if (existing) { existing.items.push(rec); } else { groups.push({ key, label, items: [rec] }); }
  }

  const safeIdx = groups.length > 0 ? Math.min(monthIdx, groups.length - 1) : 0;
  const records = groups.length > 0 ? groups[safeIdx].items : allRecords;
  const currentLabel = groups[safeIdx]?.label;

  const totalAttendees = records.reduce((s, r) => s + r.attendees, 0);
  const totalTricks = records.reduce((s, r) => s + r.coachTrickCounts.reduce((a, c) => a + c.count, 0), 0);

  const cities: WorkshopCity[] = ['Brno', 'Praha', 'Ostrava'];
  const cityStats = cities.map((city) => {
    const cityRecs = records.filter((r) => r.slot.city === city);
    return { city, count: cityRecs.length, attendees: cityRecs.reduce((s, r) => s + r.attendees, 0), tricks: cityRecs.reduce((s, r) => s + r.coachTrickCounts.reduce((a, c) => a + c.count, 0), 0) };
  });

  const coachMap = new Map<string, { name: string; tricks: number; workshops: number }>();
  for (const rec of records) {
    for (const ct of rec.coachTrickCounts) {
      const existing = coachMap.get(ct.coachId);
      if (existing) { existing.tricks += ct.count; existing.workshops++; }
      else { coachMap.set(ct.coachId, { name: ct.coachName, tricks: ct.count, workshops: 1 }); }
    }
  }
  const coachLeaderboard = [...coachMap.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.tricks - a.tricks);
  const maxTricks = coachLeaderboard[0]?.tricks ?? 1;

  return (
    <article className="rounded-[18px] border border-brand-purple/10 bg-white p-5 shadow-brand-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle icon={<BarChart2 size={18} />} title="Statistiky proběhlých workshopů" subtitle={`${allRecords.length} workshopů · sezóna 2025/2026`} />
        {groups.length > 1 && (
          <div className="flex items-center gap-1">
            <button type="button" disabled={safeIdx >= groups.length - 1} onClick={() => setMonthIdx(safeIdx + 1)} className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand-paper text-brand-purple transition hover:bg-brand-purple/10 disabled:cursor-default disabled:opacity-30">
              <ChevronDown size={15} className="rotate-90" />
            </button>
            <span className="min-w-[124px] text-center text-xs font-black uppercase tracking-wide text-brand-purple">{currentLabel}</span>
            <button type="button" disabled={safeIdx === 0} onClick={() => setMonthIdx(safeIdx - 1)} className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand-paper text-brand-purple transition hover:bg-brand-purple/10 disabled:cursor-default disabled:opacity-30">
              <ChevronDown size={15} className="-rotate-90" />
            </button>
          </div>
        )}
      </div>

      {/* Summary row */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          { label: 'workshopů', value: records.length },
          { label: 'účastníků', value: totalAttendees },
          { label: 'triků rozdáno', value: totalTricks },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-[14px] bg-brand-paper px-3 py-3 text-center">
            <p className="text-2xl font-black text-brand-purple">{value}</p>
            <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-brand-ink-soft">{label}</p>
          </div>
        ))}
      </div>

      {/* City breakdown */}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {cityStats.map(({ city, count, attendees, tricks }) => (
          <div key={city} className={`rounded-[14px] px-4 py-3 ${CITY_BG[city]}`}>
            <div className="flex items-center justify-between">
              <span className={`rounded-[8px] px-2 py-0.5 text-xs font-black ${CITY_BADGE[city]}`}>{city}</span>
              <span className={`text-xs font-black ${CITY_TEXT[city]}`}>{count}×</span>
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <div>
                <p className="text-lg font-black text-brand-ink leading-none">{attendees}</p>
                <p className="text-[10px] font-bold text-brand-ink-soft uppercase tracking-wide">účastníků</p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-black leading-none ${CITY_TEXT[city]}`}>{tricks}</p>
                <p className="text-[10px] font-bold text-brand-ink-soft uppercase tracking-wide">triků</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Coach leaderboard */}
      {coachLeaderboard.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-brand-ink-soft">Trenéři · triky rozdáné na workshopech</p>
          <div className="space-y-1.5">
            {coachLeaderboard.map((coach, i) => (
              <div key={coach.id} className="flex items-center gap-3">
                <span className="w-4 shrink-0 text-center text-xs font-black text-brand-ink-soft">{i + 1}</span>
                <span className="w-28 shrink-0 truncate text-sm font-bold text-brand-ink">{coach.name}</span>
                <div className="flex-1 overflow-hidden rounded-full bg-brand-purple/10">
                  <div className="h-2 rounded-full bg-brand-purple transition-all" style={{ width: `${Math.round((coach.tricks / maxTricks) * 100)}%` }} />
                </div>
                <span className="w-10 shrink-0 text-right text-sm font-black text-brand-purple">{coach.tricks}</span>
                <span className="w-16 shrink-0 text-right text-[10px] font-bold text-brand-ink-soft">{coach.workshops} WS</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </article>
  );
}

function WorkshopUpcomingPanel({ slots, products, participants, attendanceRecords = [], onOpenParticipant }: { slots: WorkshopSlot[]; products: ParentProduct[]; participants: ParentParticipant[]; attendanceRecords?: WorkshopAttendanceRecord[]; onOpenParticipant?: (participant: ParentParticipant, place: string) => void }) {
  const WS_CAPACITY = 40;
  const CITY_BADGE: Record<WorkshopCity, string> = { Brno: 'bg-[#8B1DFF] text-white', Praha: 'bg-[#1FB37A] text-white', Ostrava: 'bg-[#FFB21A] text-brand-ink' };
  const CITY_BAR: Record<WorkshopCity, string> = { Brno: 'bg-[#8B1DFF]', Praha: 'bg-[#1FB37A]', Ostrava: 'bg-[#FFB21A]' };
  const DOW_CS = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
  const [monthIdx, setMonthIdx] = useState(0);
  const [openSlotId, setOpenSlotId] = useState<string | null>(null);

  function fmtDate(iso: string) {
    const [y, m, d] = iso.split('-').map(Number);
    const dow = DOW_CS[new Date(y, m - 1, d).getDay()];
    return `${dow} ${d}. ${m}. ${y}`;
  }

  const groups: { key: string; label: string; items: WorkshopSlot[] }[] = [];
  for (const slot of slots) {
    const [y, m] = slot.date.split('-');
    const key = `${y}-${m}`;
    const label = new Date(Number(y), Number(m) - 1, 1).toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });
    const existing = groups.find((g) => g.key === key);
    if (existing) { existing.items.push(slot); } else { groups.push({ key, label, items: [slot] }); }
  }

  const safeIdx = Math.min(monthIdx, Math.max(0, groups.length - 1));
  const currentGroup = groups[safeIdx];

  return (
    <article className="rounded-[18px] border border-brand-purple/10 bg-white p-5 shadow-brand-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle icon={<ListChecks size={18} />} title="Nadcházející workshopy" subtitle={`${slots.length} termínů · přihlášení na každý termín`} />
        {groups.length > 1 && (
          <div className="flex items-center gap-1">
            <button type="button" disabled={safeIdx === 0} onClick={() => { setMonthIdx(safeIdx - 1); setOpenSlotId(null); }} className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand-paper text-brand-purple transition hover:bg-brand-purple/10 disabled:cursor-default disabled:opacity-30">
              <ChevronDown size={15} className="rotate-90" />
            </button>
            <span className="min-w-[124px] text-center text-xs font-black uppercase tracking-wide text-brand-purple">{currentGroup?.label}</span>
            <button type="button" disabled={safeIdx >= groups.length - 1} onClick={() => { setMonthIdx(safeIdx + 1); setOpenSlotId(null); }} className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand-paper text-brand-purple transition hover:bg-brand-purple/10 disabled:cursor-default disabled:opacity-30">
              <ChevronDown size={15} className="-rotate-90" />
            </button>
          </div>
        )}
      </div>
      {groups.length === 0 ? <div className="mt-4"><EmptyState text="Žádné nadcházející workshopy." /></div> : null}
      {currentGroup && (
        <div className="mt-4 grid gap-2">
          {currentGroup.items.map((slot) => {
            const slotProduct = products.find((product) => product.id === slot.id);
            const slotParticipants = participantsForWorkshopSlot(slot, products, participants);
            const registered = slotParticipants.length;
            const capacity = slotProduct?.capacityTotal ?? WS_CAPACITY;
            const pct = capacity > 0 ? Math.min(100, Math.round((registered / capacity) * 100)) : 0;
            const isFull = registered >= capacity;
            const isAlmostFull = pct >= 80;
            const isOpen = openSlotId === slot.id;
            const attendance = attendanceRecords.find((r) => r.slotId === slot.id);
            return (
              <div key={slot.id} className="overflow-hidden rounded-[14px] bg-brand-paper">
                <button
                  type="button"
                  onClick={() => setOpenSlotId(isOpen ? null : slot.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-brand-purple/5"
                >
                  <span className={`shrink-0 rounded-[9px] px-2.5 py-1.5 text-xs font-black ${CITY_BADGE[slot.city]}`}>{slot.city}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-brand-ink">{fmtDate(slot.date)}{slot.dateTo ? ` – ${fmtDate(slot.dateTo)}` : ''}</p>
                    <p className="mt-0.5 truncate text-xs font-bold text-brand-ink-soft">{slot.venue} · {slot.time}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="min-w-[72px] text-right">
                      <p className={`text-sm font-black ${isFull ? 'text-[#F0445B]' : isAlmostFull ? 'text-[#FFB21A]' : 'text-brand-ink'}`}>
                        {registered}/{capacity}
                      </p>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-brand-purple/10">
                        <div className={`h-full rounded-full transition-all ${isFull ? 'bg-[#F0445B]' : isAlmostFull ? 'bg-[#FFB21A]' : CITY_BAR[slot.city]}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <ChevronDown size={14} className={`shrink-0 text-brand-ink-soft transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-brand-purple/10 px-4 py-3">
                    <p className="mb-2 text-xs font-black uppercase tracking-wide text-brand-ink-soft">Přihlášeni · {attendance?.attendees ?? registered} z {capacity}</p>
                    {slotParticipants.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {slotParticipants.map((participant) => {
                          const name = participantDisplayName(participant);
                          return onOpenParticipant ? (
                            <button key={participant.id} type="button" onClick={() => onOpenParticipant(participant, slot.venue)} className="rounded-[999px] bg-brand-purple/10 px-2.5 py-1 text-xs font-black text-brand-purple-deep transition hover:bg-brand-purple hover:text-white">
                              {name}
                            </button>
                          ) : (
                            <span key={participant.id} className="rounded-[999px] bg-brand-purple/10 px-2.5 py-1 text-xs font-bold text-brand-ink-soft">{name}</span>
                          );
                        })}
                      </div>
                    ) : <EmptyState text="Na tento workshop zatím není v databázi žádný účastník." />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function ParticipantTypeSwitch({ activeType, groupsByType, workshopUpcomingCount, onChange }: { activeType: ActivityType; groupsByType: Record<ActivityType, ParticipantGroup[]>; workshopUpcomingCount: number; onChange: (type: ActivityType) => void }) {
  const { flags } = useFeatureFlags();
  const typeOptions: Array<{ type: ActivityType; label: string; sublabel: string; icon: ReactNode; count: number }> = [
    { type: 'Krouzek', label: 'Kroužky', sublabel: `${groupsByType.Krouzek.length} lokalit`, icon: <MapPin size={17} />, count: countUniqueParticipants(groupsByType.Krouzek) },
    ...(flags.trainer_camps ? [{ type: 'Tabor' as ActivityType, label: 'Tábory', sublabel: `${groupsByType.Tabor.length} turnusů`, icon: <ShieldCheck size={17} />, count: countUniqueParticipants(groupsByType.Tabor) }] : []),
    ...(flags.trainer_workshop_registration ? [{ type: 'Workshop' as ActivityType, label: 'Workshopy', sublabel: 'nadcházející termíny', icon: <ListChecks size={17} />, count: workshopUpcomingCount }] : []),
  ];

  return (
    <div className={`grid gap-2 rounded-[18px] border border-brand-purple/10 bg-brand-paper p-1.5 ${typeOptions.length === 3 ? 'sm:grid-cols-3' : typeOptions.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
      {typeOptions.map((option) => {
        const active = activeType === option.type;
        return (
          <button key={option.type} type="button" onClick={() => onChange(option.type)} className={`flex min-w-0 items-center justify-between gap-3 rounded-[14px] px-3 py-3 text-left transition ${active ? 'bg-brand-purple text-white shadow-brand-soft' : 'bg-white text-brand-ink hover:bg-brand-purple-light'}`}>
            <span className="flex min-w-0 items-center gap-2">
              <span className={active ? 'text-white' : 'text-brand-purple'}>{option.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-black leading-tight">{option.label}</span>
                <span className={`mt-0.5 block text-[10px] font-black uppercase ${active ? 'text-white/72' : 'text-brand-ink-soft'}`}>{option.sublabel}</span>
              </span>
            </span>
            <span className={`shrink-0 rounded-[999px] px-2.5 py-1 text-xs font-black ${active ? 'bg-white/18 text-white' : 'bg-brand-purple-light text-brand-purple-deep'}`}>{option.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function ActivityParticipantTypeSection({ type, groups, onOpenParticipantDetail }: { type: ActivityType; groups: ParticipantGroup[]; onOpenParticipantDetail: (participant: ParentParticipant, activityType: ActivityType, place: string) => void }) {
  const totalParticipants = countUniqueParticipants(groups);
  const cityGroups = groupParticipantGroupsByCity(groups);
  const termGroups = type === 'Tabor' ? groupParticipantGroupsByTerm(groups) : [];
  const subtitle = type === 'Tabor'
    ? `léto 2026 · ${cityGroups.length} měst · ${groups.length} turnusů · ${totalParticipants} účastníků`
    : `${cityGroups.length} měst · ${groups.length} lokalit · ${totalParticipants} účastníků`;

  return (
    <article className="rounded-[18px] border border-brand-purple/10 bg-white p-5 shadow-brand-soft">
      <SectionTitle icon={type === 'Krouzek' ? <MapPin size={18} /> : type === 'Tabor' ? <ShieldCheck size={18} /> : <ListChecks size={18} />} title={activityLabel(type)} subtitle={subtitle} />
      <div className="mt-4 space-y-3">
        {cityGroups.map((cityGroup) => <ParticipantCityDropdown key={cityGroup.key} cityGroup={cityGroup} onOpenParticipantDetail={onOpenParticipantDetail} />)}
        {groups.length === 0 ? <EmptyState text={`Pro ${activityLabel(type).toLowerCase()} není žádná odpovídající lokalita.`} /> : null}
      </div>
    </article>
  );
}

function ParticipantCityDropdown({ cityGroup, onOpenParticipantDetail }: { cityGroup: ParticipantCityGroup; onOpenParticipantDetail: (participant: ParentParticipant, activityType: ActivityType, place: string) => void }) {
  const isCampGroup = cityGroup.groups[0]?.type === 'Tabor';
  const subtitle = isCampGroup
    ? `${cityGroup.groups.length} turnusů · ${cityGroup.participantCount} účastníků`
    : `${cityGroup.groups.length} lokalit · ${cityGroup.participantCount} účastníků`;

  return (
    <CollapsiblePanel icon={<MapPin size={18} />} title={cityGroup.city} subtitle={subtitle} count={cityGroup.missingDocuments > 0 ? `${cityGroup.missingDocuments} dok. chybí` : 'Dokumenty OK'} defaultOpen={false}>
      <div className="grid gap-3">
        {cityGroup.groups.map((group) => <ParticipantLocationCard key={group.key} group={group} onOpenParticipantDetail={onOpenParticipantDetail} />)}
      </div>
    </CollapsiblePanel>
  );
}

function ParticipantTermDropdown({ termGroup, onOpenParticipantDetail }: { termGroup: ParticipantTermGroup; onOpenParticipantDetail: (participant: ParentParticipant, activityType: ActivityType, place: string) => void }) {
  const cityGroups = groupParticipantGroupsByCity(termGroup.groups);

  return (
    <CollapsiblePanel icon={<CalendarDays size={18} />} title={termGroup.term} subtitle={`${cityGroups.length} měst · ${termGroup.groups.length} lokalit · ${termGroup.participantCount} účastníků`} count={termGroup.missingDocuments > 0 ? `${termGroup.missingDocuments} dok. chybí` : 'Dokumenty OK'} defaultOpen>
      <div className="grid gap-3">
        {cityGroups.map((cityGroup) => <ParticipantCityDropdown key={`${termGroup.key}-${cityGroup.key}`} cityGroup={cityGroup} onOpenParticipantDetail={onOpenParticipantDetail} />)}
      </div>
    </CollapsiblePanel>
  );
}

function ParticipantLocationCard({ group, onOpenParticipantDetail }: { group: ParticipantGroup; onOpenParticipantDetail: (participant: ParentParticipant, activityType: ActivityType, place: string) => void }) {
  const missingDocuments = 0;

  return (
    <div className="rounded-[18px] border border-brand-purple/10 bg-white p-4 shadow-brand-soft">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[16px] bg-brand-paper px-4 py-3">
        <div className="min-w-0">
          <p className="font-black leading-tight text-brand-ink">{group.place}</p>
          <p className="mt-1 text-sm font-bold text-brand-ink-soft">{group.product.primaryMeta}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill label={`${group.participants.length} účastníků`} tone="purple" />
          <StatusPill label={missingDocuments > 0 ? `${missingDocuments} dok. chybí` : 'Dokumenty OK'} tone={missingDocuments > 0 ? 'orange' : 'mint'} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {group.participants.map((participant) => <ParticipantCompactRow key={`${group.key}-${participant.id}`} participant={participant} activityType={group.type} place={group.place} onOpen={() => onOpenParticipantDetail(participant, group.type, group.place)} />)}
      </div>
      {group.participants.length === 0 ? <p className="mt-3 rounded-[16px] bg-white p-3 text-sm font-bold leading-6 text-brand-ink-soft">Zatím tady není přiřazený žádný účastník.</p> : null}
    </div>
  );
}

function ManualAttendancePanel({ coaches, onAdd }: { coaches: AdminCoachSummary[]; onAdd: (input: ManualCoachAttendanceInput) => CoachAttendanceRecord }) {
  return (
    <CollapsiblePanel icon={<ClipboardList size={18} />} title="Doplnit docházku ručně" subtitle="když trenér zapomene zapsat lekci" count="admin" defaultOpen={false}>
      <ManualCoachAttendanceForm coaches={coaches} onAdd={onAdd} />
    </CollapsiblePanel>
  );
}

function ParticipantCompactRow({ participant, activityType, place, onOpen }: { participant: ParentParticipant; activityType: ActivityType; place: string; onOpen: () => void }) {
  const participantName = `${participant.firstName} ${participant.lastName}`;
  const missingDocuments = 0;
  const statusValue = activityType === 'Krouzek' ? `${participant.attendanceDone}/${participant.attendanceTotal}` : activityType === 'Tabor' ? 'Registrován' : 'Ticket';

  return (
    <button type="button" onClick={onOpen} className="flex items-center justify-between gap-3 rounded-[14px] border border-brand-purple/10 bg-white px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-brand-purple/24 hover:shadow-brand-soft">
      <div className="min-w-0 flex-1">
        <p className="truncate font-black leading-snug text-brand-ink">{participantName}</p>
        <p className="mt-0.5 text-xs font-bold text-brand-ink-soft">{statusValue} · L{participant.level}</p>
      </div>
      <StatusPill label={missingDocuments > 0 ? `${missingDocuments} chybí` : 'OK'} tone={missingDocuments > 0 ? 'orange' : 'mint'} />
    </button>
  );
}

function CoachPlacementSection({ title, subtitle, groups, emptyText, dppDocuments, coachAttendanceRecords, onOpenCoach, compact = false }: { title: string; subtitle: string; groups: CoachPlacementGroup[]; emptyText: string; dppDocuments: AdminCoachDppDocument[]; coachAttendanceRecords: CoachAttendanceRecord[]; onOpenCoach: (coachId: string) => void; compact?: boolean }) {
  const assignedGroups = groups.filter((group) => group.coaches.length > 0);
  return (
    <Panel className="p-5">
      <SectionTitle icon={<MapPin size={18} />} title={title} subtitle={subtitle} />
      <div className="mt-4 grid gap-3">
        {assignedGroups.map((group) => <CoachPlacementGroupCard key={group.key} group={group} dppDocuments={dppDocuments} coachAttendanceRecords={coachAttendanceRecords} onOpenCoach={onOpenCoach} compact={compact} />)}
        {assignedGroups.length === 0 ? <EmptyState text={emptyText} /> : null}
      </div>
    </Panel>
  );
}

function WorkshopCityCoachSection({ groups, dppDocuments, coachAttendanceRecords, onOpenCoach }: { groups: CoachPlacementGroup[]; dppDocuments: AdminCoachDppDocument[]; coachAttendanceRecords: CoachAttendanceRecord[]; onOpenCoach: (coachId: string) => void }) {
  const cityOrder = ['Praha', 'Brno', 'Ostrava'];
  const cityMap = new Map<string, AdminCoachSummary[]>();

  for (const group of groups) {
    const city = group.place.split(' · ')[0].trim();
    if (!cityMap.has(city)) cityMap.set(city, []);
    const existing = cityMap.get(city)!;
    for (const coach of group.coaches) {
      if (!existing.some((c) => c.id === coach.id)) existing.push(coach);
    }
  }

  const cities = [...cityMap.keys()].sort((a, b) => {
    const ai = cityOrder.indexOf(a);
    const bi = cityOrder.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b, 'cs');
  });

  return (
    <Panel className="p-5">
      <SectionTitle icon={<MapPin size={18} />} title="Workshopy" subtitle="přihlášení trenéři podle lokace" />
      <div className="mt-4 grid gap-3">
        {cities.length === 0 ? <EmptyState text="Pro zadaný filtr není žádný workshopový trenér." /> : null}
        {cities.map((city) => {
          const coaches = cityMap.get(city)!;
          return (
            <div key={city} className="rounded-[18px] border border-brand-purple/10 bg-white p-3 shadow-brand-soft">
              <div className="flex items-center justify-between rounded-[14px] bg-brand-paper px-3 py-2.5">
                <p className="text-sm font-black text-brand-ink">{city}</p>
                <StatusPill label={`${coaches.length} trenér${coaches.length === 1 ? '' : 'ů'}`} tone={coaches.length > 0 ? 'purple' : 'orange'} />
              </div>
              <div className="mt-3 grid gap-2">
                {coaches.length === 0
                  ? <p className="rounded-[14px] bg-white p-3 text-xs font-bold leading-5 text-brand-ink-soft">Zatím bez přiřazeného trenéra.</p>
                  : coaches.map((coach) => {
                      const firstGroup = groups.find((g) => g.coaches.some((c) => c.id === coach.id))!;
                      return <CoachLocationRow key={`ws-city-${city}-${coach.id}`} coach={coach} group={firstGroup} dppDocument={documentForCoach(coach, dppDocuments)} coachAttendanceRecords={coachAttendanceRecords} onOpen={() => onOpenCoach(coach.id)} />;
                    })
                }
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function CoachPlacementGroupCard({ group, dppDocuments, coachAttendanceRecords, onOpenCoach }: { group: CoachPlacementGroup; dppDocuments: AdminCoachDppDocument[]; coachAttendanceRecords: CoachAttendanceRecord[]; onOpenCoach: (coachId: string) => void; compact: boolean }) {
  return (
    <div className="rounded-[18px] border border-brand-purple/10 bg-white p-3 shadow-brand-soft">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[14px] bg-brand-paper px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-black leading-tight text-brand-ink">{group.place}</p>
          <p className="mt-1 text-xs font-bold text-brand-ink-soft">{activityLabel(group.type)} · {group.primaryMeta}</p>
        </div>
        <StatusPill label={`${group.coaches.length} trenér${group.coaches.length === 1 ? '' : 'ů'}`} tone={group.coaches.length > 0 ? 'purple' : 'orange'} />
      </div>
      <div className="mt-3 grid gap-2">
        {group.coaches.map((coach) => <CoachLocationRow key={`${group.key}-${coach.id}`} coach={coach} group={group} dppDocument={documentForCoach(coach, dppDocuments)} coachAttendanceRecords={coachAttendanceRecords} onOpen={() => onOpenCoach(coach.id)} />)}
      </div>
    </div>
  );
}

function CoachLocationRow({ coach, group, dppDocument, coachAttendanceRecords, onOpen }: { coach: AdminCoachSummary; group: CoachPlacementGroup; dppDocument: AdminCoachDppDocument; coachAttendanceRecords: CoachAttendanceRecord[]; onOpen: () => void }) {
  const coachRecords = recordsForCoach(coach, coachAttendanceRecords);

  return (
    <button type="button" onClick={onOpen} className="flex flex-wrap items-center justify-between gap-3 rounded-[15px] border border-brand-purple/10 bg-white px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-brand-purple/30 hover:shadow-brand-soft">
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-brand-purple-light text-sm font-black text-brand-purple-deep">{initialsForName(coach.name)}</span>
        <span className="min-w-0">
          <span className="block text-sm font-black leading-tight text-brand-ink">{coach.name}</span>
          <span className="mt-1 flex min-w-0 items-center gap-1 text-xs font-bold leading-tight text-brand-ink-soft"><Banknote size={13} /> {coach.bankAccount}</span>
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-2 sm:justify-end">
        <StatusPill label={coachStatusLabel(coach.status)} tone={coach.status === 'Aktivni' ? 'mint' : 'orange'} />
        <span className="rounded-[999px] bg-brand-paper px-3 py-2 text-xs font-black uppercase text-brand-ink-soft">{coachRecords.length} záp.</span>
        <StatusPill label={coachDppStatusLabel(dppDocument.status)} tone={coachDppStatusTone(dppDocument.status)} />
      </span>
    </button>
  );
}

function CoachSummaryCard({ coach, coachAttendanceRecords, dppDocument, onOpen }: { coach: AdminCoachSummary; coachAttendanceRecords: CoachAttendanceRecord[]; dppDocument: AdminCoachDppDocument; onOpen: () => void }) {
  const coachRecords = recordsForCoach(coach, coachAttendanceRecords);

  return (
    <button type="button" onClick={onOpen} className="rounded-[18px] border border-brand-purple/10 bg-white p-5 text-left shadow-brand-soft transition hover:-translate-y-0.5 hover:border-brand-purple/24 hover:shadow-brand">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <StatusPill label={coachStatusLabel(coach.status)} tone={coach.status === 'Aktivni' ? 'mint' : 'orange'} />
          <h3 className="mt-3 text-xl font-black text-brand-ink">{coach.name}</h3>
          <p className="mt-1 text-sm font-bold text-brand-ink-soft">{coach.locations.slice(0, 2).join(' · ')}</p>
        </div>
        <StatusPill label={coachDppStatusLabel(dppDocument.status)} tone={coachDppStatusTone(dppDocument.status)} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Metric value={`${coach.loggedHours}`} label="hodin" />
        <Metric value={`${coach.childrenLogged}`} label="děti" />
        <Metric value={currency(payoutAmountForCoach(coach, coachAttendanceRecords))} label="výplata" />
      </div>
      <p className="mt-3 text-sm font-bold leading-6 text-brand-ink-soft">{coach.locations.length} lokality · {coachRecords.length} záznamů docházky · {coach.stripeAccountId ? 'Stripe aktivní' : 'Stripe chybí'}</p>
    </button>
  );
}

function CoachDetailCard({ products, coach, coachAttendanceRecords, dppDocument, onAddCoachAttendance, onCreateCoachDpp, onMarkCoachDppSigned, onMarkCoachDppPhysical, onCoachLocationSaved }: { products: ParentProduct[]; coach: AdminCoachSummary; coachAttendanceRecords: CoachAttendanceRecord[]; dppDocument: AdminCoachDppDocument; onAddCoachAttendance: (input: ManualCoachAttendanceInput) => CoachAttendanceRecord; onCreateCoachDpp: (coach: AdminCoachSummary) => AdminCoachDppDocument; onMarkCoachDppSigned: (coachId: string) => void; onMarkCoachDppPhysical: (coachId: string) => void; onCoachLocationSaved: (coachId: string, location: string) => void }) {
  const trainerProducts = products.filter((product) => (product.coachIds ?? []).includes(coach.id));
  const [locationForm, setLocationForm] = useState({ city: '', venue: '', day: 'Pondělí', time: '', group: '', latitude: '', longitude: '', radius: '300' });
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [activeTab, setActiveTab] = useState<CoachDetailTab>('overview');

  // Per-coach hourly rate
  const [rateValue, setRateValue] = useState('500');
  const [rateSaving, setRateSaving] = useState(false);
  const [rateMessage, setRateMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseBrowserConfig()) return;
    createBrowserSupabaseClient()
      .from('coach_payouts').select('hourly_rate').eq('coach_id', coach.id).maybeSingle()
      .then(({ data }) => { if (data?.hourly_rate) setRateValue(String(data.hourly_rate)); });
  }, [coach.id]);

  async function saveRate() {
    const rate = Math.round(Number(rateValue));
    if (!rate || rate <= 0) { setRateMessage('Zadej platnou sazbu.'); return; }
    if (!hasSupabaseBrowserConfig()) return;
    setRateSaving(true); setRateMessage(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.from('coach_payouts')
        .upsert({ coach_id: coach.id, hourly_rate: rate }, { onConflict: 'coach_id' });
      if (error) throw error;
      setRateMessage('Sazba uložena ✓');
    } catch (e) { setRateMessage(e instanceof Error ? e.message : 'Chyba.'); }
    finally { setRateSaving(false); }
  }

  async function saveAdminCoachLocation() {
    const latitude = Number(locationForm.latitude.replace(',', '.'));
    const longitude = Number(locationForm.longitude.replace(',', '.'));
    const radius = Number(locationForm.radius.replace(',', '.')) || 300;
    if (!locationForm.city.trim() || !locationForm.venue.trim() || !locationForm.time.trim() || !locationForm.group.trim()) {
      setLocationMessage('Vyplň město, místo, čas a skupinu.');
      return;
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setLocationMessage('Doplň GPS souřadnice pro docházku.');
      return;
    }
    if (!hasSupabaseBrowserConfig()) {
      setLocationMessage('Supabase není nakonfigurovaný.');
      return;
    }

    setSavingLocation(true);
    setLocationMessage(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const id = `admin-session-${coach.id}-${Date.now()}`;
      const location = `${locationForm.city.trim()} · ${locationForm.venue.trim()}`;
      const assignedCourses = Array.from(new Set([location, ...coach.locations.filter((item) => item !== 'Čeká na přiřazení')]));
      const orgId = await currentAdminOrgId(supabase);

      const { error } = await supabase.from('coach_sessions').upsert({
        id,
        coach_id: coach.id,
        city: locationForm.city.trim(),
        venue: locationForm.venue.trim(),
        day: locationForm.day,
        time: locationForm.time.trim(),
        group_name: locationForm.group.trim(),
        enrolled: 0,
        present: 0,
        duration_hours: 1,
        hourly_rate: 500,
        latitude,
        longitude,
        check_in_radius_meters: Math.max(50, Math.round(radius)),
        ...(orgId ? { org_id: orgId } : {}),
      });
      if (error) throw error;

      await supabase.from('coach_profiles').upsert({ id: coach.id, current_location: location, assigned_courses: assignedCourses });
      onCoachLocationSaved(coach.id, location);
      setLocationForm({ city: '', venue: '', day: locationForm.day, time: '', group: '', latitude: '', longitude: '', radius: '300' });
      setLocationMessage('Lokace je uložená u trenéra.');
    } catch (error) {
      setLocationMessage(error instanceof Error ? error.message : 'Lokaci se nepodařilo uložit.');
    } finally {
      setSavingLocation(false);
    }
  }

  return (
    <>
      {/* Metrics row — always visible */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Metric value={`${coach.loggedHours}`} label="hodin" />
        <Metric value={`${coach.childrenLogged}`} label="zapsání dětí" />
        <Metric value={currency(payoutAmountForCoach(coach, coachAttendanceRecords))} label="k výplatě" />
        <Metric value={coach.stripeAccountId ? 'aktivní' : 'chybí'} label="Stripe" />
        <Metric value={coachDppStatusLabel(dppDocument.status)} label="DPP" />
      </div>

      {/* Tab bar */}
      <div className="mt-5 grid grid-cols-4 gap-2 rounded-[18px] border border-brand-purple/10 bg-brand-paper p-1">
        <ParticipantDetailTabButton active={activeTab === 'overview'} icon={<UserCheck size={16} />} label="Přehled" onClick={() => setActiveTab('overview')} />
        <ParticipantDetailTabButton active={activeTab === 'finance'} icon={<Banknote size={16} />} label="Finance" onClick={() => setActiveTab('finance')} />
        <ParticipantDetailTabButton active={activeTab === 'assignment'} icon={<MapPin size={16} />} label="Přiřazení" onClick={() => setActiveTab('assignment')} />
        <ParticipantDetailTabButton active={activeTab === 'attendance'} icon={<History size={16} />} label="Docházka" onClick={() => setActiveTab('attendance')} />
      </div>

      {/* Přehled */}
      {activeTab === 'overview' ? (
        <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="rounded-[18px] border border-brand-purple/10 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <StatusPill label={coachStatusLabel(coach.status)} tone={coach.status === 'Aktivni' ? 'mint' : 'orange'} />
                <h3 className="mt-3 text-xl font-black text-brand-ink">{coach.name}</h3>
                <p className="mt-1 text-sm font-bold text-brand-ink-soft">{coach.locations.length} lokality · poslední zápis {coach.lastAttendance}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-brand-purple-light text-base font-black text-brand-purple-deep">{initialsForName(coach.name)}</div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <InfoBlock icon={<Mail size={16} />} label="E-mail" value={coach.email} />
              <InfoBlock icon={<Phone size={16} />} label="Telefon" value={coach.phone} />
            </div>
          </div>
          <div className="rounded-[18px] bg-brand-ink p-4 text-white shadow-brand-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-white/60">K výplatě</p>
                <p className="mt-1 text-2xl font-black">{currency(payoutAmountForCoach(coach, coachAttendanceRecords))}</p>
              </div>
              <span className="rounded-[14px] bg-white/10 p-2"><Banknote size={18} /></span>
            </div>
            <div className="mt-4 grid gap-2 text-sm font-bold leading-6 text-white/78">
              <p><span className="text-[11px] font-black uppercase text-white/48">Bankovní účet</span><br />{coach.bankAccount}</p>
              <p><span className="text-[11px] font-black uppercase text-white/48">IBAN</span><br />{coach.iban ?? 'není vyplněn'}</p>
              <p><span className="text-[11px] font-black uppercase text-white/48">Majitel účtu</span><br />{coach.payoutAccountHolder ?? coach.name}</p>
            </div>
          </div>
        </section>
      ) : null}

      {/* Finance */}
      {activeTab === 'finance' ? (
        <section className="mt-5 space-y-4">
          <div className="rounded-[18px] border border-brand-purple/10 bg-brand-paper p-4">
            <p className="text-xs font-black uppercase text-brand-purple">Platební informace</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <InfoBlock label="Bankovní účet" value={coach.bankAccount} />
              <InfoBlock label="IBAN" value={coach.iban ?? 'není vyplněn'} />
              <InfoBlock label="Majitel účtu" value={coach.payoutAccountHolder ?? coach.name} />
              <InfoBlock label="Stripe Connect" value={coach.stripeAccountId ?? 'čeká na doplnění'} />
              {coach.payoutNote ? <InfoBlock label="Poznámka" value={coach.payoutNote} /> : null}
            </div>
          </div>
          <div className="rounded-[18px] border border-brand-purple/10 bg-brand-paper p-4">
            <p className="text-xs font-black uppercase text-brand-purple">Hodinová sazba</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="number"
                min="1"
                value={rateValue}
                onChange={(e) => setRateValue(e.target.value)}
                className="w-28 rounded-[12px] border border-brand-purple/15 bg-white px-3 py-2 text-sm font-black text-brand-ink focus:border-brand-purple focus:outline-none"
                placeholder="500"
              />
              <p className="text-sm font-bold text-brand-ink-soft">Kč / hod</p>
              <button
                type="button"
                onClick={() => void saveRate()}
                disabled={rateSaving}
                className="rounded-[12px] bg-brand-purple px-4 py-2 text-xs font-black text-white transition hover:opacity-80 disabled:opacity-50"
              >
                {rateSaving ? 'Ukládám…' : 'Uložit sazbu'}
              </button>
            </div>
            {rateMessage ? <p className={`mt-2 text-xs font-bold ${rateMessage.includes('✓') ? 'text-emerald-600' : 'text-brand-pink'}`}>{rateMessage}</p> : null}
          </div>
          <CoachDppPanel coach={coach} document={dppDocument} onCreate={onCreateCoachDpp} onMarkSigned={onMarkCoachDppSigned} onMarkPhysical={onMarkCoachDppPhysical} />
        </section>
      ) : null}

      {/* Přiřazení */}
      {activeTab === 'assignment' ? (
        <section className="mt-5 space-y-4">
          <div className="rounded-[18px] border border-brand-purple/10 bg-brand-paper p-4">
            <p className="text-xs font-black uppercase text-brand-purple">Přiřazení produktů</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <InfoBlock label="Produkty" value={trainerProducts.length ? trainerProducts.map((product) => product.title).slice(0, 3).join(' · ') : 'Zatím bez přiřazeného produktu'} />
              <InfoBlock label="QR triky" value={`${coach.qrTricksApproved} schváleno`} />
            </div>
            {trainerProducts.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {trainerProducts.map((product) => <span key={product.id} className="rounded-[14px] bg-brand-purple-light px-3 py-2 text-xs font-black text-brand-purple-deep">{product.title}</span>)}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Docházka */}
      {activeTab === 'attendance' ? (
        <section className="mt-5">
          <CoachAttendancePanel coach={coach} records={coachAttendanceRecords} onAdd={onAddCoachAttendance} />
        </section>
      ) : null}
    </>
  );
}

function CoachDppPanel({ coach, document, onCreate, onMarkSigned, onMarkPhysical }: { coach: AdminCoachSummary; document: AdminCoachDppDocument; onCreate: (coach: AdminCoachSummary) => AdminCoachDppDocument; onMarkSigned: (coachId: string) => void; onMarkPhysical: (coachId: string) => void }) {
  const [message, setMessage] = useState<string | null>(null);
  const isSigned = document.status === 'signed' || document.status === 'physical';
  const year = new Date().getFullYear();

  type DppFile = { id?: string; original_path: string | null; original_filename: string | null; signed_path: string | null; signed_filename: string | null };
  const [dppFile, setDppFile] = useState<DppFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void loadDppFile(); }, [coach.id]);

  async function loadDppFile() {
    if (!hasSupabaseBrowserConfig()) return;
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.from('coach_dpp_files')
      .select('id,original_path,original_filename,signed_path,signed_filename')
      .eq('coach_id', coach.id).eq('year', year).maybeSingle();
    setDppFile(data ?? null);
  }

  async function uploadOriginal(file: File) {
    if (!hasSupabaseBrowserConfig()) return;
    setUploading(true); setMessage(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const ext = file.name.split('.').pop() ?? 'pdf';
      const path = `${coach.id}/original-${year}.${ext}`;
      const { error: upErr } = await supabase.storage.from('dpp-files').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from('coach_dpp_files').upsert(
        { coach_id: coach.id, year, original_path: path, original_filename: file.name, original_uploaded_at: new Date().toISOString() },
        { onConflict: 'coach_id,year' },
      );
      if (dbErr) throw dbErr;
      setMessage('PDF nahráno. Trenér ho nyní uvidí ke stažení a podpisu.');
      void loadDppFile();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Nahrávání selhalo.'); }
    finally { setUploading(false); }
  }

  async function openFile(path: string) {
    if (!hasSupabaseBrowserConfig()) return;
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.storage.from('dpp-files').createSignedUrl(path, 300);
    if (error || !data) { setMessage('Soubor nelze otevřít.'); return; }
    window.open(data.signedUrl, '_blank');
  }

  function markSigned() { onMarkSigned(coach.id); setMessage('DPP označena jako digitálně podepsaná.'); }
  function markPhysical() { onMarkPhysical(coach.id); setMessage('Fyzická smlouva označena jako podepsaná a archivovaná.'); }
  function createDigital() { onCreate(coach); setMessage('Digitální DPP vytvořena — trenér ji uvidí k podpisu v aplikaci.'); }

  const hasDigital = document.status !== 'missing';
  const hasFile = Boolean(dppFile?.original_path);
  const showChooser = !hasDigital && !hasFile;

  return (
    <CollapsiblePanel icon={<FileText size={18} />} title="DPP dokument" subtitle={`${document.title} · ${coachDppStatusLabel(document.status)}`} count={coachDppStatusLabel(document.status)} defaultOpen={!isSigned}>
      <div className="grid gap-3 md:grid-cols-3">
        <InfoBlock label="Platnost" value={`${document.validFrom} - ${document.validTo}`} />
        <InfoBlock label="Sazba" value={`${currency(document.hourlyRate)} / hod`} />
        <InfoBlock label="Envelope" value={document.digitalEnvelopeId ?? 'čeká na vytvoření'} />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <InfoBlock label="Účet pro výplatu" value={coach.bankAccount} />
        <InfoBlock label="IBAN" value={coach.iban ?? 'není vyplněn'} />
        <InfoBlock label="Majitel účtu" value={coach.payoutAccountHolder ?? coach.name} />
      </div>

      <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadOriginal(f); e.target.value = ''; }} />

      {showChooser ? (
        <div className="mt-3 rounded-[16px] border border-brand-purple/10 bg-white p-4">
          <p className="text-xs font-black uppercase text-brand-purple">Založení DPP</p>
          <p className="mt-1 text-sm font-bold leading-6 text-brand-ink-soft">Vyber, jak chceš smlouvu pro trenéra založit — buď digitální dokument k podpisu v aplikaci, nebo nahraješ vlastní PDF.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={createDigital}
              className="inline-flex items-center justify-center gap-2 rounded-[16px] bg-gradient-brand px-5 py-3 text-sm font-black text-white transition hover:opacity-90">
              <PenLine size={15} />
              Vytvořit digitální DPP
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="inline-flex items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-brand-purple/20 bg-white px-5 py-3 text-sm font-black text-brand-ink-soft transition hover:border-brand-purple/50 disabled:opacity-50">
              <FileUp size={15} />
              {uploading ? 'Nahrávám…' : 'Nahrát PDF soubor'}
            </button>
          </div>
        </div>
      ) : null}

      {hasDigital ? (
      <div className="mt-3 rounded-[16px] border border-brand-purple/10 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-brand-purple">Dohoda o provedení práce</p>
            <h4 className="mt-1 text-base font-black text-brand-ink">{document.title}</h4>
            <p className="mt-1 text-sm font-bold text-brand-ink-soft">{document.role} · {document.workplace}</p>
          </div>
          <StatusPill label={coachDppStatusLabel(document.status)} tone={coachDppStatusTone(document.status)} />
        </div>
        <p className="mt-3 text-sm font-bold leading-6 text-brand-ink-soft">{document.scope}</p>
        <div className="mt-3 grid gap-2">
          {document.clauses.map((clause, index) => (
            <div key={clause} className="rounded-[14px] bg-brand-paper px-3 py-2 text-xs font-bold leading-5 text-brand-ink-soft">
              <span className="font-black text-brand-ink">{index + 1}. </span>{clause}
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <InfoBlock label="Poslední změna" value={document.updatedAt} />
          <InfoBlock label="Podepsáno" value={document.signedAt ?? (document.status === 'physical' ? 'fyzicky archivováno' : 'čeká na podpis')} />
        </div>
      </div>
      ) : null}

      {/* ── File attachments ── */}
      {!showChooser ? (
      <div className="mt-4 rounded-[16px] border border-brand-purple/10 bg-brand-paper p-4">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-brand-purple">Soubory</p>

        {/* Original upload (admin side) */}
        <div className="mt-3">
          <p className="mb-2 text-xs font-black text-brand-ink">Originál k podpisu</p>
          {dppFile?.original_path ? (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void openFile(dppFile.original_path!)}
                className="inline-flex items-center gap-2 rounded-[14px] bg-brand-purple-light px-3 py-2 text-xs font-black text-brand-purple-deep transition hover:bg-brand-purple/20">
                <Download size={13} />
                {dppFile.original_filename ?? 'original.pdf'}
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="rounded-[14px] border border-brand-purple/10 bg-white px-3 py-2 text-xs font-bold text-brand-ink-soft transition hover:bg-white/80 disabled:opacity-50">
                {uploading ? 'Nahrávám…' : 'Nahradit soubor'}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="inline-flex items-center gap-2 rounded-[16px] border-2 border-dashed border-brand-purple/20 bg-white px-5 py-3 text-sm font-black text-brand-ink-soft transition hover:border-brand-purple/50 disabled:opacity-50">
              <FileUp size={15} />
              {uploading ? 'Nahrávám…' : 'Přiložit PDF smlouvy pro trenéra'}
            </button>
          )}
        </div>

        {/* Signed version from coach */}
        <div className="mt-4 border-t border-brand-purple/10 pt-4">
          <p className="mb-2 text-xs font-black text-brand-ink">Podepsaná verze od trenéra</p>
          {dppFile?.signed_path ? (
            <button type="button" onClick={() => void openFile(dppFile.signed_path!)}
              className="inline-flex items-center gap-2 rounded-[14px] bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100">
              <Download size={13} />
              {dppFile.signed_filename ?? 'podepsano.pdf'}
            </button>
          ) : (
            <p className="text-xs font-bold text-brand-ink-soft opacity-60">
              {dppFile?.original_path ? 'Čeká na nahrání od trenéra.' : 'Nejdříve nahraj originál výše.'}
            </p>
          )}
        </div>
      </div>
      ) : null}

      {!showChooser ? (
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={markSigned} disabled={isSigned} className="inline-flex items-center justify-center gap-2 rounded-[16px] border border-brand-purple/15 bg-white px-4 py-3 text-sm font-black text-brand-ink transition hover:bg-brand-paper disabled:cursor-not-allowed disabled:opacity-55">
          <CheckCircle2 size={17} />
          Digitálně podepsáno
        </button>
        <button type="button" onClick={markPhysical} disabled={isSigned} className="inline-flex items-center justify-center gap-2 rounded-[16px] border border-brand-purple/15 bg-white px-4 py-3 text-sm font-black text-brand-ink transition hover:bg-brand-paper disabled:cursor-not-allowed disabled:opacity-55">
          <PenLine size={17} />
          Fyzická smlouva ✓
        </button>
      </div>
      ) : null}
      {message ? <p className="mt-3 rounded-[16px] bg-white p-3 text-sm font-bold leading-6 text-brand-ink-soft">{message}</p> : null}
    </CollapsiblePanel>
  );
}

function CoachCompactRow({ coach, coachAttendanceRecords }: { coach: AdminCoachSummary; coachAttendanceRecords: CoachAttendanceRecord[] }) {
  return (
    <div className="rounded-[16px] border border-brand-purple/10 bg-brand-paper p-4 transition hover:-translate-y-0.5 hover:border-brand-purple/24 hover:bg-white hover:shadow-brand-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black text-brand-ink">{coach.name}</p>
          <p className="mt-1 text-sm font-bold text-brand-ink-soft">{coach.locations.slice(0, 2).join(' · ')}</p>
        </div>
        <p className="font-black text-brand-purple">{currency(payoutAmountForCoach(coach, coachAttendanceRecords))}</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Metric value={`${coach.loggedHours}`} label="hod" />
        <Metric value={`${coach.childrenLogged}`} label="děti" />
        <Metric value={`${coach.qrTricksApproved}`} label="QR" />
      </div>
    </div>
  );
}

function CourseLocationStatCard({ stat, onOpenDetail }: { stat: ReturnType<typeof buildCourseLocationStats>[number]; onOpenDetail: () => void }) {
  const maxPresent = Math.max(...stat.sessions.map((session) => session.present), 1);

  return (
    <button type="button" onClick={onOpenDetail} className="rounded-[18px] border border-brand-purple/10 bg-brand-paper p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-purple/24 hover:bg-white hover:shadow-brand-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black text-brand-ink">{stat.activity.title}</p>
          <p className="text-xs font-bold text-brand-ink-soft">{stat.place}</p>
          <p className="mt-1 text-sm font-bold text-brand-ink-soft">průměr {stat.averagePresent} dětí · max {stat.maxPresent} · <span className="text-brand-purple">{stat.enrolledCount} přihlášeno</span></p>
        </div>
        <StatusPill label={`${stat.lastPresent}/${stat.capacityTotal}`} tone="purple" />
      </div>
      <div className="mt-4 flex h-24 items-end gap-2 rounded-[16px] bg-white px-3 py-3">
        {stat.sessions.length === 0 ? (
          <p className="w-full self-center text-center text-xs font-bold text-brand-ink-soft">Zatím žádná zaznamenaná lekce.</p>
        ) : null}
        {stat.sessions.map((session) => (
          <div key={`${stat.key}-${session.date}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="w-full rounded-t-[8px] bg-brand-cyan" style={{ height: `${Math.max(12, Math.round((session.present / maxPresent) * 68))}px` }} />
            <span className="text-[9px] font-black text-brand-ink-soft">{session.shortDate}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

function ActivityAttendanceRow({ activity, onOpenDetail }: { activity: ReturnType<typeof adminActivityRows>[number]; onOpenDetail: () => void }) {
  const percent = activity.capacityTotal > 0 ? Math.min(100, Math.round((activity.registered / activity.capacityTotal) * 100)) : 0;
  const activityMeta = activity.type === 'Tabor' ? `${activity.registered}/${activity.capacityTotal} registrováno` : activity.type === 'Workshop' ? `${activity.registered}/${activity.capacityTotal} ticketů` : `${activity.visits} návštěv`;
  const capacityLabel = activity.type === 'Tabor' ? 'registrováno' : activity.type === 'Workshop' ? 'tickety' : 'obsazeno';
  return (
    <button type="button" onClick={onOpenDetail} className="rounded-[16px] border border-brand-purple/10 bg-brand-paper p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-purple/24 hover:bg-white hover:shadow-brand-soft">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px] md:items-center">
        <div className="min-w-0">
          <p className="font-black leading-tight text-brand-ink">{activity.title}</p>
          <p className="mt-1 text-sm font-bold text-brand-ink-soft">{activity.place} · {activityLabel(activity.type)} · {activityMeta}</p>
        </div>
        <div className="text-left md:text-right">
          <p className="font-black text-brand-ink">{activity.registered}/{activity.capacityTotal}</p>
          <p className="text-xs font-black uppercase text-brand-ink-soft">{capacityLabel}</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-brand-cyan" style={{ width: `${percent}%` }} />
      </div>
    </button>
  );
}

function ActivityDetailModal({ activity, products, participants, documents, coaches, coachAttendanceRecords, childAttendanceRecords, onClose, onOpenParticipant }: { activity: ReturnType<typeof adminActivityRows>[number]; products: ParentProduct[]; participants: ParentParticipant[]; documents: AdminDocument[]; coaches: AdminCoachSummary[]; coachAttendanceRecords: CoachAttendanceRecord[]; childAttendanceRecords: ChildAttendanceRecord[]; onClose: () => void; onOpenParticipant: (participant: ParentParticipant) => void }) {
  const [selectedSessionDate, setSelectedSessionDate] = useState<string | null>(null);
  const monthGroups = buildActivitySessions(activity, childAttendanceRecords);
  const [monthIdx, setMonthIdx] = useState(() => Math.max(0, monthGroups.length - 1));
  useEffect(() => {
    setMonthIdx(Math.max(0, monthGroups.length - 1));
  }, [monthGroups.length]);
  const safeMonthIdx = Math.max(0, Math.min(monthIdx, monthGroups.length - 1));
  const currentMonthGroup = monthGroups[safeMonthIdx] ?? { month: '', sessions: [] };
  const sessions = currentMonthGroup.sessions;
  const registeredParticipants = registeredParticipantsForActivity(activity, products, participants, documents);
  const maxPresent = Math.max(...sessions.map((session) => session.present), 1);
  const missingDocuments = missingDocumentsForActivity(activity, products, participants, documents);
  const showLessonRecords = activity.type === 'Krouzek';
  const activityVolume = activity.type === 'Krouzek' ? { value: `${activity.visits}`, label: 'návštěvy' } : activity.type === 'Tabor' ? { value: `${activity.registered}`, label: 'registrováno' } : { value: `${activity.registered}`, label: 'ticketů' };
  const selectedSession = sessions.find((session) => session.date === selectedSessionDate) ?? null;
  const visibleSessions = selectedSession ? [selectedSession] : sessions;
  const activityCoachPresence = buildActivityCoachPresence(activity, products, coaches, coachAttendanceRecords, selectedSession?.date);

  return (
    <DetailModal title={activity.title} subtitle={`${activity.place} · ${activityLabel(activity.type)}`} onClose={onClose}>
      <div className="grid gap-3 md:grid-cols-4">
        <Metric value={`${activity.registered}/${activity.capacityTotal}`} label="kapacita" />
        <Metric value={activityVolume.value} label={activityVolume.label} />
        <Metric value={currency(activity.revenue)} label="tržby" />
        <Metric value={missingDocuments.length > 0 ? `${missingDocuments.length}` : 'OK'} label="dokumenty" />
      </div>

      {showLessonRecords ? (
        <section className="mt-5 rounded-[18px] border border-brand-purple/10 bg-brand-paper p-4">
          <SectionTitle icon={<Gauge size={18} />} title="Časový graf docházky" subtitle={selectedSession ? `vybraný den ${selectedSession.date} · klikni na jiný sloupec pro změnu` : 'každý sloupec je jeden trénink · klikni na sloupec a dole uvidíš děti z konkrétní lekce'} />
          {monthGroups.length > 0 && (
            <div className="mt-3 flex items-center gap-1">
              <button type="button" disabled={safeMonthIdx === 0} onClick={() => { setMonthIdx(safeMonthIdx - 1); setSelectedSessionDate(null); }} className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-white text-brand-purple transition hover:bg-brand-purple/10 disabled:cursor-default disabled:opacity-30">
                <ChevronDown size={13} className="rotate-90" />
              </button>
              <span className="min-w-[112px] text-center text-xs font-black uppercase tracking-wide text-brand-purple">{currentMonthGroup.month}</span>
              <button type="button" disabled={safeMonthIdx >= monthGroups.length - 1} onClick={() => { setMonthIdx(safeMonthIdx + 1); setSelectedSessionDate(null); }} className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-white text-brand-purple transition hover:bg-brand-purple/10 disabled:cursor-default disabled:opacity-30">
                <ChevronDown size={13} className="-rotate-90" />
              </button>
            </div>
          )}
          {sessions.length === 0 ? (
            <p className="mt-4 rounded-[16px] bg-white px-4 py-6 text-center text-sm font-bold text-brand-ink-soft">Zatím tu není žádná zaznamenaná lekce — sloupce s jednotlivými dny se objeví po prvním zapsání docházky (NFC sken nebo ruční zápis trenéra).</p>
          ) : (
          <div className="mt-4 flex h-36 items-end gap-2 rounded-[16px] bg-white px-3 py-4">
            {sessions.map((session) => {
              const active = selectedSessionDate === session.date;
              return (
                <button key={session.date} type="button" aria-pressed={active} onClick={() => setSelectedSessionDate(session.date)} className={`group flex min-w-0 flex-1 flex-col items-center gap-2 rounded-[12px] px-1 py-1 transition hover:bg-brand-purple-light/60 focus:outline-none focus:ring-2 focus:ring-brand-purple/30 ${active ? 'bg-brand-purple-light shadow-sm' : ''}`}>
                  <span className="flex w-full items-end rounded-t-[10px] bg-brand-cyan/20" style={{ height: '96px' }}>
                    <span className={`w-full rounded-t-[10px] transition ${active ? 'bg-brand-purple' : 'bg-brand-cyan group-hover:bg-brand-purple'}`} style={{ height: `${Math.max(14, Math.round((session.present / maxPresent) * 96))}px` }} />
                  </span>
                  <div className="text-center">
                    <p className={`text-xs font-black ${active ? 'text-brand-purple-deep' : 'text-brand-ink'}`}>{session.present}</p>
                    <p className="text-[9px] font-black text-brand-ink-soft">{session.shortDate}</p>
                  </div>
                </button>
              );
            })}
          </div>
          )}
        </section>
      ) : null}

      <ActivityCoachPresencePanel coaches={activityCoachPresence} activityType={activity.type} selectedDate={selectedSession?.date ?? null} />

      {showLessonRecords ? (
        <section className="mt-5 rounded-[18px] border border-brand-purple/10 bg-brand-paper p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <SectionTitle icon={<History size={18} />} title={selectedSession ? `Účastníci ${selectedSession.date}` : 'Přesné záznamy lekcí'} subtitle={selectedSession ? 'děti z vybraného sloupce grafu, účastníka můžeš rozkliknout' : `${currentMonthGroup.month || 'zatím bez lekcí'} · kliknutím na den v grafu vyfiltrujete`} />
            {selectedSession ? (
              <button type="button" onClick={() => setSelectedSessionDate(null)} className="inline-flex items-center justify-center rounded-[14px] bg-white px-4 py-3 text-xs font-black text-brand-purple transition hover:bg-brand-purple hover:text-white">
                Zobrazit všechny dny
              </button>
            ) : null}
          </div>
          <div className="mt-4 grid gap-2">
            {visibleSessions.length === 0 ? (
              <p className="rounded-[16px] bg-white px-4 py-4 text-sm font-bold text-brand-ink-soft">Zatím žádné zaznamenané lekce.</p>
            ) : null}
            {visibleSessions.map((session) => {
              const sessionParticipants = sessionParticipantsForActivity(activity, session.presentNames, products, participants, documents);
              const matchedNames = new Set(sessionParticipants.map((record) => normalizeText(record.name)));
              const unmatchedNames = session.presentNames.filter((name) => !matchedNames.has(normalizeText(name)));
              const sessionCoaches = buildActivityCoachPresence(activity, products, coaches, coachAttendanceRecords, session.date);
              return (
                <div key={`session-${session.date}`} className="rounded-[16px] bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-black text-brand-ink">{session.date}</p>
                      <p className="mt-1 text-xs font-bold text-brand-ink-soft">{session.absent} omluveno / chybělo · {session.capacityTotal} kapacita</p>
                      <p className="mt-1 text-xs font-bold text-brand-purple">Trenér: {sessionCoaches.length > 0 ? sessionCoaches.map((coach) => coach.name).join(', ') : 'zatím nepřiřazen'}</p>
                    </div>
                    <StatusPill label={`${session.present} dětí`} tone="mint" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sessionParticipants.map((participant) => <ActivityParticipantChip key={`${session.date}-${participant.id}`} participant={participant} onOpenParticipant={onOpenParticipant} />)}
                    {unmatchedNames.map((name) => (
                      <span key={`${session.date}-${name}`} className="inline-flex items-center rounded-[12px] bg-brand-paper px-3 py-2 text-xs font-black text-brand-ink-soft">{name}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <RegisteredParticipantsSection activity={activity} participants={registeredParticipants} documents={documents} onOpenParticipant={onOpenParticipant} />
      )}
    </DetailModal>
  );
}

function ParticipantProductDocGroups({ participant, allDocuments }: { participant: ParentParticipant; allDocuments: AdminDocument[] }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Group all participant docs by productId (or fallback key)
  const participantDocs = documentsForParticipant(participant, allDocuments);
  const byKey = new Map<string, AdminDocument[]>();
  for (const doc of participantDocs) {
    const key = doc.productId || `${doc.activityType}-${doc.coursePlace}`;
    const arr = byKey.get(key) ?? [];
    arr.push(doc);
    byKey.set(key, arr);
  }

  // Match doc groups to activePurchases by activityType to get the product title
  const usedPurchaseKeys = new Set<string>();
  const groups: Array<{ key: string; label: string; type: ActivityType; status?: string; docs: AdminDocument[] }> = [];

  for (const [key, docs] of byKey) {
    const docType = docs[0].activityType;
    const coursePlace = docs[0].coursePlace;
    const matching = participant.activePurchases.filter((p) => p.type === docType && !usedPurchaseKeys.has(`${p.type}-${p.title}`));
    const purchase = matching[0];
    const label = purchase?.title || `${activityLabel(docType)}${coursePlace ? ` · ${coursePlace}` : ''}`;
    if (purchase) usedPurchaseKeys.add(`${purchase.type}-${purchase.title}`);
    groups.push({ key, label, type: docType, status: purchase?.status, docs });
  }

  // Add purchases with no matching document group
  for (const purchase of participant.activePurchases) {
    const pk = `${purchase.type}-${purchase.title}`;
    if (!usedPurchaseKeys.has(pk)) {
      groups.push({ key: `nopurchase-${pk}`, label: purchase.title || activityLabel(purchase.type), type: purchase.type, status: purchase.status, docs: [] });
    }
  }

  if (groups.length === 0) {
    return <EmptyState text="Účastník zatím nemá žádný dokument v evidenci." />;
  }

  return (
    <>
      {groups.map((group) => {
        const missing = group.docs.filter((d) => d.status !== 'signed').length;
        const isOpen = expandedKey === group.key;
        const allOk = group.docs.length > 0 && missing === 0;
        return (
          <div key={group.key} className={`rounded-[16px] border transition ${allOk ? 'border-emerald-200' : missing > 0 ? 'border-amber-200' : 'border-brand-purple/10'} bg-white`}>
            <button
              type="button"
              onClick={() => setExpandedKey(isOpen ? null : group.key)}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              <div className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] ${allOk ? 'bg-emerald-100 text-emerald-700' : missing > 0 ? 'bg-amber-100 text-amber-700' : 'bg-brand-paper text-brand-purple'}`}>
                <PackagePlus size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-brand-ink">{group.label}</p>
                <p className="mt-0.5 text-xs font-bold text-brand-ink-soft">
                  {activityLabel(group.type)}{group.docs.length > 0 ? ` · ${group.docs.length} dokument${group.docs.length === 1 ? '' : 'ů'}` : ' · žádné dokumenty'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {allOk ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-700">OK</span>
                ) : missing > 0 ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black text-amber-700">Chybí {missing}</span>
                ) : null}
                <ChevronDown size={16} className={`text-brand-ink-soft transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>
            {isOpen ? (
              <div className="border-t border-brand-purple/8 px-4 pb-4 pt-3">
                {group.docs.length > 0 ? (
                  <div className="grid gap-2">
                    {group.docs.map((doc) => <DocumentRow key={doc.id} document={doc} />)}
                  </div>
                ) : (
                  <p className="text-sm font-bold text-brand-ink-soft">K tomuto produktu zatím nejsou uložené žádné dokumenty.</p>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function ParticipantDetailModal({ detail, documents: allDocuments, onClose }: { detail: ParticipantDetailState; documents: AdminDocument[]; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<ParticipantDetailTab>('documents');
  const { participant, activityType, place } = detail;
  const { flags } = useFeatureFlags();
  const allParticipantDocs = documentsForParticipant(participant, allDocuments);
  const missingDocuments = allParticipantDocs.filter((document) => document.status !== 'signed');
  const attendanceRows = activityType === 'Krouzek' ? buildCompleteCourseAttendance(participant, place) : [];
  const participantName = `${participant.firstName} ${participant.lastName}`;
  const adminParticipant = participant as AdminParticipant;
  const hasPass = typeof adminParticipant.passTotalEntries === 'number' && (adminParticipant.passTotalEntries ?? 0) > 0;
  const activityStatus = activityType === 'Krouzek'
    ? (hasPass ? `${adminParticipant.passUsedEntries ?? 0}/${adminParticipant.passTotalEntries}` : `${participant.attendanceDone}/${participant.attendanceTotal}`)
    : activityType === 'Tabor' ? 'Registrován' : 'Ticket';
  const activityStatusLabel = activityType === 'Krouzek' ? (hasPass ? 'permanentka · prochozeno' : 'docházka') : 'stav';

  return (
    <DetailModal title={participantName} subtitle={`${activityLabel(activityType)} · ${place}`} onClose={onClose}>
      <div className="grid gap-3 md:grid-cols-4">
        {flags.participant_wristbands ? <Metric value={`${participant.level}`} label="level" /> : null}
        {flags.participant_wristbands ? <Metric value={participant.bracelet} label="náramek" /> : null}
        <Metric value={activityStatus} label={activityStatusLabel} />
        <Metric value={missingDocuments.length > 0 ? `${missingDocuments.length}` : 'OK'} label="dokumenty" />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 rounded-[18px] border border-brand-purple/10 bg-brand-paper p-1 sm:grid-cols-5">
        <ParticipantDetailTabButton active={activeTab === 'documents'} icon={<FileCheck2 size={16} />} label="Dokumenty" onClick={() => setActiveTab('documents')} />
        {activityType === 'Krouzek' ? <ParticipantDetailTabButton active={activeTab === 'attendance'} icon={<History size={16} />} label="Docházka" onClick={() => setActiveTab('attendance')} /> : null}
        {flags.participant_wristbands && flags.participant_trick_xp ? <ParticipantDetailTabButton active={activeTab === 'skills'} icon={<Trophy size={16} />} label="Skill tree" onClick={() => setActiveTab('skills')} /> : null}
        <ParticipantDetailTabButton active={activeTab === 'products'} icon={<PackagePlus size={16} />} label="Produkty" onClick={() => setActiveTab('products')} />
        <ParticipantDetailTabButton active={activeTab === 'contacts'} icon={<Phone size={16} />} label="Kontakty" onClick={() => setActiveTab('contacts')} />
      </div>

      {activeTab === 'documents' ? (
        <section className="mt-5 rounded-[18px] border border-brand-purple/10 bg-brand-paper p-4">
          <SectionTitle icon={<FileCheck2 size={18} />} title="Dokumenty účastníka" subtitle="rozdělené podle produktu" />
          <div className="mt-4 grid gap-3">
            <ParticipantProductDocGroups participant={participant} allDocuments={allDocuments} />
          </div>
        </section>
      ) : null}

      {activeTab === 'attendance' ? (
        <section className="mt-5 rounded-[18px] border border-brand-purple/10 bg-brand-paper p-4">
          <SectionTitle icon={<History size={18} />} title={activityType === 'Krouzek' ? 'Kompletní docházka kroužku' : 'Účast na produktu'} subtitle={place} />
          <div className="mt-4">
            {activityType === 'Krouzek' ? <CourseAttendanceList rows={attendanceRows} /> : <ParticipantActivityList participant={participant} activityType={activityType} />}
          </div>
        </section>
      ) : null}

      {activeTab === 'skills' && flags.participant_wristbands && flags.participant_trick_xp ? (
        <section className="mt-5 rounded-[18px] border border-brand-purple/10 bg-brand-paper p-4">
          <SectionTitle icon={<Trophy size={18} />} title="Skill tree" subtitle={`${participant.xp} XP · ${participant.bracelet} náramek`} />
          <div className="mt-4">
            <ParticipantSkillTree participant={participant} />
          </div>
        </section>
      ) : null}

      {activeTab === 'products' ? (
        <section className="mt-5 rounded-[18px] border border-brand-purple/10 bg-brand-paper p-4">
          <SectionTitle icon={<PackagePlus size={18} />} title="Zakoupené produkty" subtitle="všechny aktivní nákupy tohoto účastníka" />
          <div className="mt-4 grid gap-2">
            {participant.activePurchases.length > 0
              ? participant.activePurchases.map((purchase) => (
                  <div key={`${purchase.type}-${purchase.title}`} className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-white px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-brand-ink">{purchase.title}</p>
                      <p className="mt-0.5 text-xs font-bold text-brand-ink-soft">{activityLabel(purchase.type)}{purchase.trainingDays && purchase.trainingDays.length > 0 ? ` · Dny: ${purchase.trainingDays.join(' + ')}` : ''}</p>
                    </div>
                    <StatusPill label={purchase.status} tone={purchase.status === 'Aktivní' ? 'mint' : purchase.status === 'Zaplaceno' ? 'orange' : 'purple'} />
                  </div>
                ))
              : <EmptyState text="Účastník nemá žádné aktivní nákupy." />}
          </div>
        </section>
      ) : null}

      {activeTab === 'contacts' ? (
        <section className="mt-5 rounded-[18px] border border-brand-purple/10 bg-brand-paper p-4">
          <SectionTitle icon={<Phone size={18} />} title="Kontakty rodiče" subtitle="rychlé provozní spojení k účastníkovi" />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <InfoBlock label="Rodič" value={adminParticipant.parentName ?? 'Kontakt není evidovaný'} />
            <InfoBlock label="Účastník" value={participantName} />
            <ContactBlock icon={<Phone size={17} />} label="Telefon" value={adminParticipant.parentPhone ?? 'Telefon není evidovaný'} />
            <ContactBlock icon={<Mail size={17} />} label="E-mail" value={adminParticipant.parentEmail ?? 'E-mail není evidovaný'} />
          </div>
        </section>
      ) : null}
    </DetailModal>
  );
}

function RegisteredParticipantsSection({ activity, participants, documents, onOpenParticipant }: { activity: ReturnType<typeof adminActivityRows>[number]; participants: ActivityParticipantRecord[]; documents: AdminDocument[]; onOpenParticipant: (participant: ParentParticipant) => void }) {
  const showDocuments = activity.type !== 'Workshop';

  return (
    <section className="mt-3 rounded-[18px] border border-brand-purple/10 bg-brand-paper p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-purple/10 text-brand-purple"><Users size={16} /></span>
        <div>
          <p className="text-sm font-black text-brand-ink">{activity.type === 'Tabor' ? 'Registrovaní účastníci tábora' : 'Registrovaní účastníci'}</p>
          <p className="text-[11px] font-bold text-brand-ink-soft">{showDocuments ? `${participants.length}/${activity.registered} zobrazeno · dokumenty jsou přímo u účastníků` : `${participants.length}/${activity.registered} zobrazeno v administraci`}</p>
        </div>
      </div>
      <div className={showDocuments ? 'mt-4 grid gap-3' : 'mt-4 grid gap-2 md:grid-cols-2'}>
        {participants.map((participant) => <RegisteredParticipantCard key={participant.id} activity={activity} participant={participant} documents={documents} onOpenParticipant={onOpenParticipant} />)}
      </div>
      {participants.length === 0 ? <EmptyState text="Zatím tady nejsou registrovaní účastníci." /> : null}
    </section>
  );
}

function ActivityCoachPresencePanel({ coaches, activityType, selectedDate }: { coaches: ActivityCoachPresence[]; activityType: ActivityType; selectedDate: string | null }) {
  const title = activityType === 'Krouzek' ? 'Trenéři na lekci' : activityType === 'Tabor' ? 'Trenéři na táboře' : 'Trenéři na workshopu';
  const subtitle = selectedDate
    ? `${selectedDate} · ze zápisů trenérské docházky`
    : 'ze zápisů trenérské docházky';

  return (
    <section className="mt-5 rounded-[18px] bg-brand-ink p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white"><UserCheck size={16} /></span>
        <div>
          <p className="text-sm font-black text-white">{title}</p>
          <p className="text-[11px] font-bold text-white/50">{subtitle}</p>
        </div>
      </div>
      {coaches.length > 0 ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {coaches.map((coach) => (
            <div key={coach.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-white/8 p-3">
              <div className="min-w-0">
                <p className="font-black text-white">{coach.name}</p>
                <p className="mt-1 text-xs font-bold text-white/50">{coach.detail}</p>
              </div>
              <StatusPill label="zapsán" tone="mint" />
            </div>
          ))}
        </div>
      ) : <div className="mt-4"><p className="text-sm font-bold text-white/40">Trenéři se zobrazí po zápisu docházky. Zatím nebyla zapsána žádná trenérská docházka k této aktivitě.</p></div>}
    </section>
  );
}

function RegisteredParticipantCard({ activity, participant, documents, onOpenParticipant }: { activity: ReturnType<typeof adminActivityRows>[number]; participant: ActivityParticipantRecord; documents: AdminDocument[]; onOpenParticipant: (participant: ParentParticipant) => void }) {
  const linkedParticipant = participant.participant;
  const participantDocuments = linkedParticipant ? activityDocumentsForParticipant(linkedParticipant, activity, documents) : [];
  const activityMetricLabel = activity.type === 'Krouzek' ? 'docházka' : 'stav';
  const missingDocs = participantDocuments.filter((d) => d.status !== 'signed').length;
  const [docsOpen, setDocsOpen] = useState(false);

  const content = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-black text-brand-ink">{participant.name}</p>
          <p className="mt-1 text-xs font-bold text-brand-ink-soft">{participant.subtitle}</p>
        </div>
        <StatusPill label={participant.documents} tone={participant.documents === 'Dokumenty OK' || participant.documents === 'QR ticket' ? 'mint' : 'orange'} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric value={participant.level} label="level" />
        <Metric value={participant.attendance} label={activityMetricLabel} />
      </div>
      <p className="mt-3 text-xs font-bold leading-5 text-brand-ink-soft">{participant.parentContact}</p>
    </>
  );

  return (
    <div className="rounded-[16px] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-brand-soft">
      {linkedParticipant ? (
        <button type="button" onClick={() => onOpenParticipant(linkedParticipant)} className="block w-full rounded-[14px] text-left transition hover:bg-brand-paper/60">
          {content}
        </button>
      ) : content}

      {participantDocuments.length > 0 ? (
        <div className="mt-3 border-t border-brand-purple/10 pt-3">
          <button
            type="button"
            onClick={() => setDocsOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-xs font-black text-brand-ink-soft transition hover:text-brand-purple"
          >
            <span className="inline-flex items-center gap-1.5">
              <FileCheck2 size={13} />
              {participantDocuments.length} dokumentů
              {missingDocs > 0 && <span className="ml-1 rounded-full bg-[#F0445B]/12 px-1.5 py-0.5 text-[10px] font-black text-[#F0445B]">{missingDocs} chybí</span>}
            </span>
            <ChevronDown size={13} className={`transition-transform ${docsOpen ? 'rotate-180' : ''}`} />
          </button>
          <CollapsibleContent open={docsOpen} className="pt-3">
            <div className="grid gap-2">
              {participantDocuments.map((document) => <DocumentRow key={document.id} document={document} />)}
            </div>
          </CollapsibleContent>
        </div>
      ) : null}
    </div>
  );
}

function ActivityParticipantChip({ participant, onOpenParticipant }: { participant: ActivityParticipantRecord; onOpenParticipant: (participant: ParentParticipant) => void }) {
  if (participant.participant) {
    return (
      <button type="button" onClick={() => onOpenParticipant(participant.participant as ParentParticipant)} className="rounded-[999px] bg-brand-purple-light px-3 py-2 text-xs font-black text-brand-purple transition hover:bg-brand-purple hover:text-white">
        {participant.name}
      </button>
    );
  }

  return <span className="rounded-[999px] bg-brand-paper px-3 py-2 text-xs font-black text-brand-ink-soft">{participant.name}</span>;
}

function ParticipantDetailTabButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-[14px] px-3 py-3 text-xs font-black transition ${active ? 'bg-brand-purple text-white shadow-brand-soft' : 'text-brand-ink-soft hover:bg-white hover:text-brand-purple'}`}>
      {icon}
      {label}
    </button>
  );
}

function ParticipantActivityList({ participant, activityType }: { participant: ParentParticipant; activityType: ActivityType }) {
  const purchases = participant.activePurchases.filter((purchase) => purchase.type === activityType);

  return (
    <div className="grid gap-2">
      {purchases.map((purchase) => <MiniRow key={`${purchase.type}-${purchase.title}`} label={purchase.title} meta={activityLabel(purchase.type)} value={purchase.status} />)}
      {purchases.length === 0 ? <EmptyState text="Účastník nemá v databázi detail pro tento typ aktivity." /> : null}
    </div>
  );
}

function ContactBlock({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[16px] bg-white p-4">
      <span className="rounded-[14px] bg-brand-purple-light p-2 text-brand-purple">{icon}</span>
      <div>
        <p className="text-[11px] font-black uppercase text-brand-ink-soft">{label}</p>
        <p className="mt-1 text-sm font-black text-brand-ink">{value}</p>
      </div>
    </div>
  );
}

function DocumentRow({ document }: { document: ParentDocument & { scanPath?: string | null; scanFilename?: string | null } }) {
  const [open, setOpen] = useState(false);
  const scanPath = document.scanPath;

  async function openScan() {
    if (!scanPath || !hasSupabaseBrowserConfig()) return;
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.storage.from('participant-docs').createSignedUrl(scanPath, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  return (
    <div className="rounded-[16px] border border-brand-purple/10 bg-brand-paper p-4 transition hover:-translate-y-0.5 hover:border-brand-purple/24 hover:bg-white hover:shadow-brand-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-brand-purple">{document.id}</p>
          <p className="mt-1 font-black text-brand-ink">{document.title} · {document.participantName}</p>
          <p className="mt-1 text-sm font-bold text-brand-ink-soft">{document.activityTitle} · {activityLabel(document.activityType)} · {document.updatedAt}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DocumentPill status={document.status} />
          {scanPath ? (
            <button type="button" onClick={openScan} className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-white px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-600 hover:text-white">
              <FileText size={15} /> Naskenované PDF
            </button>
          ) : null}
          <button type="button" onClick={() => setOpen((current) => !current)} className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-white px-3 py-2 text-xs font-black text-brand-purple transition hover:bg-brand-purple hover:text-white">
            <Eye size={15} />
            {open ? 'Skrýt' : 'Zobrazit'}
          </button>
        </div>
      </div>
      <CollapsibleContent open={open} className="pt-4">
        <DocumentPreview document={document} />
      </CollapsibleContent>
    </div>
  );
}

function DocumentPreview({ document }: { document: ParentDocument }) {
  const previewRows = documentPreviewRows(document);
  const content = documentPreviewContent(document);

  return (
    <div className="rounded-[18px] border border-brand-purple/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-brand-purple/10 pb-4">
        <div>
          <p className="text-xs font-black uppercase text-brand-purple">Náhled dokumentu</p>
          <h4 className="mt-1 text-lg font-black text-brand-ink">{document.title}</h4>
          <p className="mt-1 text-sm font-bold text-brand-ink-soft">{document.participantName} · {document.activityTitle}</p>
        </div>
        <DocumentPill status={document.status} />
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {previewRows.map((row) => <InfoBlock key={row.label} label={row.label} value={row.value} />)}
      </div>

      <div className="mt-4 rounded-[16px] bg-brand-paper p-4">
        <p className="text-[11px] font-black uppercase text-brand-ink-soft">Souhlas / prohlášení</p>
        <h5 className="mt-1 text-base font-black text-brand-ink">{content.heading}</h5>
        <div className="mt-3 grid gap-2">
          {content.paragraphs.map((paragraph) => <p key={paragraph} className="text-sm font-bold leading-6 text-brand-ink-soft">{paragraph}</p>)}
        </div>
        <div className="mt-3 grid gap-2">
          {content.clauses.map((clause, index) => (
            <div key={clause} className="rounded-[14px] bg-white px-3 py-2 text-xs font-bold leading-5 text-brand-ink-soft">
              <span className="font-black text-brand-purple">{index + 1}. </span>{clause}
            </div>
          ))}
        </div>
        <p className="mt-3 rounded-[14px] border border-brand-purple/10 bg-white px-3 py-2 text-xs font-black leading-5 text-brand-ink">{content.confirmation}</p>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <InfoBlock label="Zástupce" value="Zákonný zástupce účastníka" />
        <InfoBlock label="Zdroj" value="Evidence dokumentů" />
        <InfoBlock label="Aktualizace" value={document.updatedAt} />
      </div>
    </div>
  );
}

function documentPreviewRows(document: ParentDocument) {
  return [
    { label: 'Účastník', value: document.participantName },
    { label: 'Aktivita', value: `${document.activityTitle} · ${activityLabel(document.activityType)}` },
    { label: 'Stav', value: documentStatusLabel(document.status) },
    { label: 'Poslední změna', value: document.updatedAt },
    { label: 'Typ dokumentu', value: documentKindLabel(documentKindForTitle(document.title)) },
    { label: 'Evidence', value: document.id },
  ];
}

function documentPreviewContent(document: ParentDocument) {
  const kind = documentKindForTitle(document.title);
  const activity = `${document.activityTitle} (${activityLabel(document.activityType)})`;
  const signer = 'zákonný zástupce';
  const confirmation = document.status === 'signed'
    ? `Digitálně potvrzeno zákonným zástupcem ${signer}. Stav dokumentu: ${documentStatusLabel(document.status)} · ${document.updatedAt}.`
    : `Dokument čeká na doplnění zákonným zástupcem ${signer}. Stav dokumentu: ${documentStatusLabel(document.status)}.`;

  if (kind === 'gdpr') return {
    heading: 'Souhlas se zpracováním osobních údajů',
    paragraphs: [
      `Zákonný zástupce ${signer} uděluje TeamVYS souhlas se zpracováním osobních údajů účastníka ${document.participantName} pro aktivitu ${activity}.`,
      'Údaje slouží pouze k provozu přihlášky, komunikaci s rodičem, bezpečné organizaci aktivity, platební evidenci a interní administraci.'
    ],
    clauses: [
      'TeamVYS může evidovat jméno dítěte, kontakt na rodiče, stav dokumentů, platby a při kroužcích také docházku evidovanou přes NFC.',
      'Nezbytné údaje mohou vidět pouze administrátoři a trenéři, kteří danou aktivitu reálně zajišťují.',
      'Zákonný zástupce může požádat o opravu údajů, omezení zpracování nebo výmaz v rozsahu povoleném zákonnými povinnostmi.',
      'Souhlas se nevztahuje na marketingové zveřejnění fotografií ani videí, pokud není udělen samostatně.'
    ],
    confirmation,
  };
  if (kind === 'guardian-consent') return {
    heading: 'Souhlas zákonného zástupce s účastí',
    paragraphs: [
      `Zákonný zástupce ${signer} souhlasí s účastí dítěte ${document.participantName} na aktivitě ${activity}.`,
      'Rodič potvrzuje, že se seznámil s provozními pokyny, časem konání, místem předání dítěte a pravidly bezpečného chování při tréninku nebo táborovém programu.'
    ],
    clauses: [
      'Účastník se řídí pokyny trenérů, dodržuje bezpečnostní pravidla a nepouští se do prvků, které mu trenér nepovolil.',
      'Rodič potvrzuje, že dítě je schopné běžné sportovní zátěže odpovídající věku a charakteru aktivity.',
      'TeamVYS může v nezbytné situaci kontaktovat rodiče, přerušit účast dítěte nebo zajistit první pomoc.',
      'Rodič bere na vědomí, že pozdní vyzvednutí, zdravotní změny nebo jiné provozní změny musí nahlásit administraci předem.'
    ],
    confirmation,
  };
  if (kind === 'health') return {
    heading: 'Anamnéza, alergie a zdravotní omezení',
    paragraphs: [
      `Zákonný zástupce ${signer} potvrzuje zdravotní informace pro účastníka ${document.participantName} u aktivity ${activity}.`,
      'Dokument slouží trenérům k bezpečnému vedení programu a administraci k rychlému dohledání nouzových údajů.'
    ],
    clauses: [
      'Rodič uvádí alergie, pravidelně užívané léky, zdravotní omezení, pojišťovnu a kontakt pro mimořádnou situaci.',
      'Pokud dítě potřebuje léky během dne, rodič předá přesné dávkování a informaci, kdo smí lék podat.',
      'TeamVYS použije zdravotní údaje jen pro bezpečnost dítěte, první pomoc a komunikaci se zákonným zástupcem.',
      'Rodič se zavazuje neprodleně aktualizovat údaje, pokud se zdravotní stav dítěte změní před aktivitou nebo během ní.'
    ],
    confirmation,
  };
  if (kind === 'departure') return {
    heading: 'Souhlas se samostatným odchodem dítěte',
    paragraphs: [
      `Zákonný zástupce ${signer} výslovně souhlasí, aby účastník ${document.participantName} po skončení aktivity ${activity} odešel samostatně bez vyzvednutí dospělou osobou.`,
      'Cílem dokumentu je, aby trenér věděl, že dítě po ukončení programu nemusí předávat rodiči ani jiné pověřené osobě a může ho pustit samostatně domů.'
    ],
    clauses: [
      'Rodič potvrzuje, že dítě zná cestu z místa konání a může po skončení programu odejít bez doprovodu.',
      'Trenér dítě uvolní až po ukončení aktivity a běžné kontrole, že dítě odchází v dohodnutém čase.',
      'Odpovědnost za cestu dítěte po opuštění místa konání přebírá zákonný zástupce v rozsahu tohoto souhlasu.',
      'Pokud má dítě v konkrétní den čekat na rodiče nebo jinou osobu, rodič tuto změnu nahlásí administraci nebo trenérovi před koncem programu.'
    ],
    confirmation,
  };
  if (kind === 'infection-free') return {
    heading: 'Čestné prohlášení o bezinfekčnosti',
    paragraphs: [
      `Zákonný zástupce ${signer} prohlašuje, že účastník ${document.participantName} může nastoupit na táborovou aktivitu ${activity}.`,
      'Prohlášení je určeno pro táborový režim, společný program, stravování a delší pobyt dítěte ve skupině.'
    ],
    clauses: [
      'Dítě nejeví příznaky akutního infekčního onemocnění a nebylo mu nařízeno karanténní opatření.',
      'Rodič nezatajil okolnosti, které by mohly ohrozit ostatní účastníky nebo trenéry.',
      'Při změně zdravotního stavu před nástupem rodič informuje TeamVYS a dítě na aktivitu nepřivede.',
      'TeamVYS může při podezření na infekční onemocnění kontaktovat rodiče a účast dítěte přerušit.'
    ],
    confirmation,
  };
  if (kind === 'packing') return {
    heading: 'Potvrzení táborových pokynů a vybavení',
    paragraphs: [
      `Zákonný zástupce ${signer} potvrzuje, že převzal pokyny k vybavení pro ${document.participantName} na aktivitu ${activity}.`,
      'Dokument sjednocuje informace o věcech s sebou, lécích, kartičce pojišťovny a praktickém režimu dne.'
    ],
    clauses: [
      'Dítě bude mít sportovní oblečení, pevnou obuv, lahev na pití, náhradní tričko a vybavení podle pokynů pořadatele.',
      'Léky musí být předané v označeném obalu společně s dávkováním a kontaktem na rodiče.',
      'Rodič bere na vědomí, že cennosti a elektronika nejsou pro program potřeba a dítě je nosí na vlastní odpovědnost.',
      'Rodič potvrzuje, že zná čas příchodu, vyzvednutí, místo srazu a způsob komunikace při mimořádné situaci.'
    ],
    confirmation,
  };
  return {
    heading: 'Administrativní potvrzení účasti',
    paragraphs: [`Dokument se vztahuje k účastníkovi ${document.participantName} a aktivitě ${activity}.`],
    clauses: ['Dokument je uložený v administraci TeamVYS a slouží ke kontrole kompletnosti přihlášky.'],
    confirmation,
  };
}

function documentKindLabel(kind: string) {
  if (kind === 'gdpr') return 'GDPR souhlas';
  if (kind === 'guardian-consent') return 'Souhlas zákonného zástupce';
  if (kind === 'health') return 'Zdravotní informace';
  if (kind === 'departure') return 'Samostatný odchod dítěte';
  if (kind === 'infection-free') return 'Bezinfekčnost';
  if (kind === 'packing') return 'Věci s sebou';
  return kind;
}

function RequiredDocumentsPreview({ type, title, products }: { type: Exclude<ActivityType, 'Workshop'>; title: string; products: ParentProduct[] }) {
  const product = products.find((item) => item.type === type);
  const documents = product ? requiredDocumentsForProduct(product) : [];
  return (
    <div className="rounded-[16px] border border-brand-purple/10 bg-white p-4">
      <h3 className="text-sm font-black text-brand-ink">{title}</h3>
      <div className="mt-3 grid gap-2">
        {documents.map((document) => (
          <div key={document.kind} className="flex gap-2 rounded-[14px] bg-brand-paper px-3 py-2 text-xs leading-5 text-brand-ink-soft">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-brand-cyan" />
            <span><strong className="text-brand-ink">{document.title}</strong> · {document.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailModal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) {
  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-brand-ink/30 p-3 backdrop-blur-md sm:p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <motion.div
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-5xl flex-col overflow-hidden rounded-[24px] border border-white/70 bg-white shadow-[0_28px_80px_rgba(47,25,82,0.28)] sm:max-h-[calc(100dvh-40px)]"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-brand-purple/10 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-brand-purple">Detail administrace</p>
            <h2 className="mt-1 text-xl font-black text-brand-ink sm:text-2xl">{title}</h2>
            <p className="mt-1 text-sm font-bold text-brand-ink-soft">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-brand-paper text-brand-purple transition hover:bg-brand-purple hover:text-white" aria-label="Zavřít detail">
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('self-start rounded-[14px] border border-black/[0.07] bg-white shadow-sm', className)}>{children}</section>;
}

function SectionTitle({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="rounded-[9px] bg-black/[0.04] p-2 text-brand-ink-soft">{icon}</span>
      <div>
        <h2 className="text-base font-black text-brand-ink">{title}</h2>
        <p className="mt-0.5 text-[13px] font-semibold text-brand-ink-soft">{subtitle}</p>
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[11px] border border-black/[0.05] bg-slate-50/70 px-3 py-2.5">
      <p className="text-base font-black text-brand-ink">{value}</p>
      <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-ink-soft">{label}</p>
    </div>
  );
}

function AdminSignal({ value, label, tone }: { value: string; label: string; tone: 'cyan' | 'mint' | 'orange' | 'purple' }) {
  const toneClass = {
    cyan: 'text-brand-cyan',
    mint: 'text-brand-mint',
    orange: 'text-brand-orange',
    purple: 'text-brand-purple-light',
  }[tone];

  return (
    <div className="rounded-[16px] bg-white/10 px-3 py-3 ring-1 ring-white/10">
      <p className={`text-base font-black leading-tight ${toneClass}`}>{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase text-white/60">{label}</p>
    </div>
  );
}

function OverviewFocusCard({ icon, label, value, detail, tone, onClick }: { icon: ReactNode; label: string; value: string; detail: string; tone: 'purple' | 'pink' | 'orange' | 'mint'; onClick: () => void }) {
  const toneClass = {
    purple: 'border-brand-purple/20 bg-brand-purple/5 text-brand-purple',
    pink: 'border-brand-pink/25 bg-brand-pink/5 text-brand-pink',
    orange: 'border-brand-orange/30 bg-brand-orange/10 text-brand-orange-deep',
    mint: 'border-emerald-200 bg-emerald-50 text-emerald-600',
  }[tone];

  return (
    <button type="button" onClick={onClick} className="rounded-[22px] border border-brand-purple/10 bg-white p-4 text-left shadow-brand transition hover:-translate-y-0.5 hover:border-brand-purple/24 hover:shadow-brand-soft">
      <div className="flex items-start justify-between gap-3">
        <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border ${toneClass}`}>{icon}</span>
        <span className="rounded-full bg-brand-paper px-2.5 py-1 text-[10px] font-black uppercase text-brand-ink-soft">{label}</span>
      </div>
      <p className="mt-4 text-2xl font-black leading-tight text-brand-ink">{value}</p>
      <p className="mt-1 text-sm font-bold leading-5 text-brand-ink-soft">{detail}</p>
    </button>
  );
}

function ActionTile({ icon, label, value, onClick }: { icon: ReactNode; label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="grid min-h-[86px] grid-cols-[44px_minmax(0,1fr)] items-center gap-3 rounded-[16px] border border-white/10 bg-white/10 p-3 text-left text-white transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/16 hover:shadow-brand-soft">
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white/10 text-brand-cyan shadow-sm ring-1 ring-white/10">{icon}</span>
      <span className="min-w-0">
        <span className="block break-words text-[15px] font-black leading-tight sm:text-base">{label}</span>
        <span className="mt-1 block break-words text-sm font-bold leading-tight text-white/64">{value}</span>
      </span>
    </button>
  );
}

function HealthRow({ label, value, tone }: { label: string; value: string; tone: 'purple' | 'pink' | 'orange' | 'mint' }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] bg-brand-paper px-3 py-3">
      <p className="text-sm font-black text-brand-ink">{label}</p>
      <StatusPill label={value} tone={tone} />
    </div>
  );
}

function PriorityRow({ title, value, detail, tone }: { title: string; value: string; detail: string; tone: 'purple' | 'pink' | 'orange' | 'mint' }) {
  return (
    <div className="rounded-[16px] border border-brand-purple/10 bg-brand-paper p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-black text-brand-ink">{title}</p>
          <p className="mt-1 text-sm font-bold leading-6 text-brand-ink-soft">{detail}</p>
        </div>
        <StatusPill label={value} tone={tone} />
      </div>
    </div>
  );
}

function Suggestion({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[16px] border border-brand-purple/10 bg-brand-paper p-4">
      <p className="font-black text-brand-ink">{title}</p>
      <p className="mt-1 text-sm font-bold leading-6 text-brand-ink-soft">{text}</p>
    </div>
  );
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="relative block w-full lg:max-w-[360px]">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink-soft" size={17} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-[16px] border border-brand-purple/15 bg-white py-3 pl-10 pr-4 text-sm font-bold text-brand-ink outline-none transition focus:border-brand-purple" />
    </label>
  );
}

function MiniRow({ label, meta, value }: { label: string; meta: string; value: string }) {
  return (
    <div className="grid gap-2 rounded-[16px] border border-brand-purple/10 bg-brand-paper p-3 text-sm transition hover:-translate-y-0.5 hover:border-brand-purple/24 hover:bg-white hover:shadow-brand-soft md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <p className="font-black leading-tight text-brand-ink">{label}</p>
        <p className="mt-1 text-xs font-bold leading-5 text-brand-ink-soft">{meta}</p>
      </div>
      <span className="font-black leading-tight text-brand-purple md:text-right">{value}</span>
    </div>
  );
}

function InfoBlock({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-[16px] bg-brand-paper px-3 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-black uppercase text-brand-ink-soft">{icon ? <span className="text-brand-purple">{icon}</span> : null}{label}</p>
      <p className="mt-1 text-sm font-black leading-5 text-brand-ink">{value}</p>
    </div>
  );
}

function CollapsiblePanel({ icon, title, subtitle, count, defaultOpen = false, children }: { icon: ReactNode; title: string; subtitle?: string; count?: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-[18px] border border-brand-purple/10 bg-brand-paper/70 p-2">
      <button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 rounded-[14px] px-2 py-2 text-left transition hover:bg-white/70">
        <span className="flex min-w-0 items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] transition-colors ${open ? 'bg-brand-purple text-white' : 'bg-white text-brand-purple shadow-sm'}`}>
            {icon}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-black leading-tight text-brand-ink">{title}</span>
            {subtitle ? <span className="mt-0.5 block text-xs font-bold leading-5 text-brand-ink-soft">{subtitle}</span> : null}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {count ? <span className="rounded-[999px] bg-white px-2.5 py-1 text-[10px] font-black uppercase text-brand-purple shadow-sm">{count}</span> : null}
          <ChevronDown className={`text-brand-purple transition-transform duration-300 ${open ? 'rotate-180' : ''}`} size={18} />
        </span>
      </button>
      <CollapsibleContent open={open} className="px-2 pb-2 pt-3">
        {children}
      </CollapsibleContent>
    </div>
  );
}

function ManualCoachAttendanceForm({ coaches, lockedCoach, onAdd }: { coaches: AdminCoachSummary[]; lockedCoach?: AdminCoachSummary; onAdd: (input: ManualCoachAttendanceInput) => CoachAttendanceRecord }) {
  const [coachId, setCoachId] = useState(lockedCoach?.id ?? coaches[0]?.id ?? '');
  const selectedCoach = lockedCoach ?? coaches.find((coach) => coach.id === coachId) ?? coaches[0];

  const deriveRate = (coach: AdminCoachSummary) =>
    coach.loggedHours > 0 ? Math.round(coach.baseAmount / coach.loggedHours) : 500;

  const [sessionTitle, setSessionTitle] = useState(selectedCoach?.locations[0] ?? '');
  const [time, setTime] = useState('16:00');
  const [date, setDate] = useState('30. 4. 2026');
  const [durationHours, setDurationHours] = useState('1');
  const [hourlyRate, setHourlyRate] = useState(String(deriveRate(selectedCoach ?? coaches[0])));
  const [reason, setReason] = useState('Trenér zapomněl zapsat docházku po lekci.');
  const [message, setMessage] = useState<string | null>(null);
  const amount = Math.round(Number(durationHours || 0) * Number(hourlyRate || 0));

  const TIME_OPTIONS = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'];

  function onCoachChange(id: string) {
    setCoachId(id);
    const coach = coaches.find((c) => c.id === id);
    if (coach) {
      setSessionTitle(coach.locations[0] ?? '');
      setHourlyRate(String(deriveRate(coach)));
    }
  }

  function onLocationChange(loc: string) {
    setSessionTitle(loc);
  }

  async function submitManualAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCoach) return;

    const place = sessionTitle || selectedCoach.locations[0] || 'Lekce bez lokace';
    const sessionLabel = `${place} · ${time}`;
    const record = onAdd({
      coachId: selectedCoach.id,
      coachName: selectedCoach.name,
      sessionTitle: sessionLabel,
      date,
      durationHours: Number(durationHours || 0),
      hourlyRate: Number(hourlyRate || 0),
      reason,
    });

    try {
      await saveCoachAttendance({
        coachId: selectedCoach.id,
        sessionId: slugForId(place),
        place,
        present: '',
        durationHours: Number(durationHours || 0),
        hourlyRate: Number(hourlyRate || 0),
      });
      setMessage(`Uloženo do backendu a přidáno ke kontrole: ${record.coachName} · ${record.sessionTitle} · ${currency(record.amount)}.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'backend neodpověděl';
      setMessage(`Přidáno lokálně ke kontrole, ale backend zápis se nepovedl: ${errorMessage}.`);
    }
  }

  return (
    <form onSubmit={submitManualAttendance} className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        {lockedCoach ? (
          <InfoBlock label="Trenér" value={lockedCoach.name} />
        ) : (
          <label className="grid gap-2 text-sm font-black text-brand-ink">
            Trenér
            <select value={coachId} onChange={(event) => onCoachChange(event.target.value)} className="rounded-[16px] border border-brand-purple/15 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-brand-purple">
              {coaches.map((coach) => <option key={coach.id} value={coach.id}>{coach.name}</option>)}
            </select>
          </label>
        )}
        <label className="grid gap-2 text-sm font-black text-brand-ink">
          Lekce / místo
          <select value={sessionTitle} onChange={(event) => onLocationChange(event.target.value)} className="rounded-[16px] border border-brand-purple/15 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-brand-purple">
            {(selectedCoach?.locations ?? []).map((loc) => <option key={loc} value={loc}>{loc}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-black text-brand-ink">
          Datum
          <input value={date} onChange={(event) => setDate(event.target.value)} className="rounded-[16px] border border-brand-purple/15 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-brand-purple" />
        </label>
        <label className="grid gap-2 text-sm font-black text-brand-ink">
          Čas lekce
          <select value={time} onChange={(event) => setTime(event.target.value)} className="rounded-[16px] border border-brand-purple/15 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-brand-purple">
            {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-black text-brand-ink">
          Hodiny
          <input inputMode="decimal" value={durationHours} onChange={(event) => setDurationHours(event.target.value)} className="rounded-[16px] border border-brand-purple/15 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-brand-purple" />
        </label>
        <div className="grid gap-2 text-sm font-black text-brand-ink">
          Sazba / hod
          <div className="flex items-center rounded-[16px] border border-brand-purple/10 bg-brand-paper px-3 py-2.5 text-sm font-bold text-brand-ink-soft">
            {hourlyRate} Kč
          </div>
        </div>
      </div>
      <label className="grid gap-2 text-sm font-black text-brand-ink">
        Poznámka
        <input value={reason} onChange={(event) => setReason(event.target.value)} className="rounded-[16px] border border-brand-purple/15 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-brand-purple" />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-white p-3">
        <div>
          <p className="text-xs font-black uppercase text-brand-ink-soft">Částka ke kontrole</p>
          <p className="text-lg font-black text-brand-ink">{currency(amount)}</p>
        </div>
        <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-[16px] bg-brand-purple px-4 py-3 text-sm font-black text-white shadow-brand transition hover:bg-brand-purple-deep">
          <CheckCircle2 size={17} />
          Doplnit záznam
        </button>
      </div>
      {message ? <p className="rounded-[16px] bg-white p-3 text-sm font-bold leading-6 text-brand-ink-soft">{message}</p> : null}
    </form>
  );
}

function CoachAttendancePanel({ coach, records, onAdd, compact = false }: { coach: AdminCoachSummary; records: CoachAttendanceRecord[]; onAdd: (input: ManualCoachAttendanceInput) => CoachAttendanceRecord; compact?: boolean }) {
  const coachRecords = recordsForCoach(coach, records);
  const totalHours = coachRecords.reduce((sum, record) => sum + record.durationHours, 0);

  return (
    <CollapsiblePanel icon={<History size={18} />} title="Celá docházka trenéra" subtitle={`${totalHours} h · ${coach.name}`} count={`${coachRecords.length}`} defaultOpen={!compact}>
      <div className="grid gap-4">
        {groupByMonthAdmin(coachRecords, (r) => r.date).map(({ label, items }) => (
          <div key={label}>
            <p className="mb-2 border-b border-brand-purple/10 pb-1 text-xs font-black uppercase tracking-wide text-brand-purple">{label}</p>
            <div className="grid gap-2">
              {items.map((record) => (
                <MiniRow key={record.id} label={record.present ? `${record.sessionTitle} · ${record.present}` : record.sessionTitle} meta={`${record.date} · ${record.durationHours} h · ${record.reason}`} value={record.source === 'admin' ? `Admin · ${currency(record.amount)}` : currency(record.amount)} />
              ))}
            </div>
          </div>
        ))}
        {coachRecords.length === 0 ? <EmptyState text="Tento trenér zatím nemá žádnou docházku." /> : null}
      </div>
      <div className="mt-3">
        <CollapsiblePanel icon={<ClipboardList size={18} />} title="Doplnit zapomenutý zápis" subtitle="přidá se do výplat ke kontrole" count="ručně">
          <ManualCoachAttendanceForm coaches={[coach]} lockedCoach={coach} onAdd={onAdd} />
        </CollapsiblePanel>
      </div>
    </CollapsiblePanel>
  );
}

function CourseAttendanceList({ rows }: { rows: ReturnType<typeof buildCompleteCourseAttendance> }) {
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div key={row.id} className="grid gap-2 rounded-[14px] border border-brand-purple/10 bg-white p-3 text-sm md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
          <span className="font-black text-brand-ink">{row.label}</span>
          <span className="font-bold text-brand-ink-soft">{row.date} · {row.time}</span>
          <StatusPill label={row.status} tone={row.status === 'Přítomen' ? 'mint' : 'purple'} />
        </div>
      ))}
    </div>
  );
}

function ParticipantSkillTree({ participant }: { participant: ParentParticipant }) {
  const skills = buildSkillTree(participant);
  const percent = participant.nextBraceletXp > 0 ? Math.min(100, Math.round((participant.xp / participant.nextBraceletXp) * 100)) : 0;

  return (
    <div>
      <div className="rounded-[16px] bg-white p-3">
        <div className="flex items-center justify-between gap-3 text-xs font-black">
          <span className="text-brand-ink">{participant.xp}/{participant.nextBraceletXp} XP</span>
          <span className="text-brand-purple">{percent}% k dalšímu náramku</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-paper">
          <div className="h-full rounded-full bg-brand-purple" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {skills.map((skill) => (
          <div key={skill.title} className="grid gap-2 rounded-[14px] border border-brand-purple/10 bg-white p-3 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div>
              <p className="font-black text-brand-ink">{skill.title}</p>
              <p className="mt-1 text-xs font-bold text-brand-ink-soft">{skill.description}</p>
            </div>
            <StatusPill label={skill.status} tone={skill.status === 'Hotovo' ? 'mint' : 'purple'} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CollapsibleContent({ open, children, className = '' }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="content"
          initial={{ height: 0, opacity: 0, y: -8 }}
          animate={{ height: 'auto', opacity: 1, y: 0 }}
          exit={{ height: 0, opacity: 0, y: -8 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          <motion.div initial={{ scale: 0.985 }} animate={{ scale: 1 }} exit={{ scale: 0.985 }} transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }} className={className}>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function DocumentPill({ status }: { status: DocumentStatus }) {
  const tone = status === 'signed' ? 'mint' : status === 'draft' ? 'orange' : 'pink';
  return <StatusPill label={documentStatusLabel(status)} tone={tone} />;
}

function StatusPill({ label, tone = 'purple' }: { label: string; tone?: 'purple' | 'pink' | 'orange' | 'mint' | 'neutral' }) {
  const toneClass = tone === 'purple' ? 'bg-brand-purple-light text-brand-purple-deep' : tone === 'pink' ? 'bg-brand-pink/10 text-brand-pink' : tone === 'orange' ? 'bg-brand-orange/18 text-brand-orange-deep' : tone === 'neutral' ? 'bg-slate-100 text-slate-500' : 'bg-brand-mint/14 text-emerald-700';
  return <span className={`inline-flex w-max items-center justify-center rounded-[999px] px-3 py-2 text-xs font-black uppercase ${toneClass}`}>{label}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-[16px] border border-brand-purple/10 bg-white p-3 text-sm font-bold leading-6 text-brand-ink-soft">{text}</p>;
}

type AdminTotals = {
  paidTotal: number;
  pendingTotal: number;
  payoutTotal: number;
  coachCount: number;
  participantCount: number;
  missingDocuments: number;
  courseCount: number;
  transferCount: number;
};

function buildTotals(paymentRows: AdminPaymentRow[], activityRows: ReturnType<typeof adminActivityRows>, coaches: AdminCoachSummary[], transfers: TrainerPayoutTransfer[], coachAttendanceRecords: CoachAttendanceRecord[], participants: ParentParticipant[], documents: AdminDocument[]): AdminTotals {
  return {
    paidTotal: paymentRows.filter((payment) => isPaidStatus(payment.status)).reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    pendingTotal: paymentRows.filter((payment) => !isPaidStatus(payment.status)).reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    payoutTotal: coaches.reduce((sum, coach) => sum + payoutAmountForCoach(coach, coachAttendanceRecords), 0),
    coachCount: coaches.length,
    participantCount: participants.length,
    missingDocuments: documents.filter((document) => document.status !== 'signed').length,
    courseCount: activityRows.length,
    transferCount: transfers.length,
  };
}

function buildPaymentRows(finance: AdminFinanceResponse | null): AdminPaymentRow[] {
  const purchases = finance?.purchases ?? [];
  if (purchases.length === 0) return [];

  return purchases.map((purchase) => ({
    id: purchase.id,
    type: purchase.type || '',
    title: purchase.title,
    participantName: purchase.participant_name,
    amount: purchase.amount,
    status: purchase.status || 'Zaplaceno',
    dueDate: purchase.paid_at,
  }));
}

function mapAdminInvoiceRow(row: AdminInvoiceRow): Invoice {
  const issuedDate = row.datum_vystaveni || row.created_at?.slice(0, 10) || '';
  const description = row.popis?.trim() || row.cislo_faktury?.trim() || '';
  const supplier = row.dodavatel?.trim() || 'Dodavatel není vyplněný';

  return {
    id: String(row.id),
    supplier,
    description,
    amount: parseInvoiceAmount(row.castka),
    issuedDate,
    dueDate: row.datum_splatnosti || issuedDate,
    paid: Boolean(row.zaplaceno),
    paidDate: row.datum_zaplaceni || undefined,
    category: (row.kategorie as Invoice['category']) || categorizeInvoice(`${supplier} ${description}`),
    fileUrl: row.file_url || undefined,
    coachId: row.coach_id || undefined,
    source: row.zdroj || undefined,
  };
}

function parseInvoiceAmount(value: string | null | undefined) {
  if (!value) return 0;
  const normalized = value.replace(/\s+/g, '').replace(',', '.');
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function categorizeInvoice(text: string): string {
  const normalized = normalizeText(text);
  if (/telocvic|hala|pronajem|skola|zs|zš|orel/.test(normalized)) return 'Tělocvična';
  if (/matrac|prekaz|prekaž|vybaven|sportovni sklad/.test(normalized)) return 'Vybavení';
  if (/marketing|reklam|meta|facebook|instagram|letak/.test(normalized)) return 'Marketing';
  if (/trener|kouč|kouc|lektor|mzda|odmena|dpp|smlouva/.test(normalized)) return 'Trenéři';
  return 'Ostatní';
}

function buildLiveActivityRows(products: ParentProduct[], participants: ParentParticipant[], paymentRows: AdminPaymentRow[]): ReturnType<typeof adminActivityRows> {
  return products.map((product) => {
    const productParticipants = participants.filter((participant) => participantBelongsToProduct(participant, product));
    const productPayments = paymentRows.filter((payment) => paymentBelongsToProduct(payment, product));
    const revenue = productPayments.filter((payment) => isPaidStatus(payment.status)).reduce((sum, payment) => sum + payment.amount, 0);
    const pendingRevenue = productPayments.filter((payment) => !isPaidStatus(payment.status)).reduce((sum, payment) => sum + payment.amount, 0);

    return {
      id: product.id,
      type: product.type,
      title: product.title,
      place: product.place,
      capacityTotal: product.capacityTotal,
      registered: productParticipants.length,
      visits: product.type === 'Krouzek' ? productParticipants.reduce((sum, participant) => sum + participant.attendanceDone, 0) : productParticipants.length,
      revenue,
      pendingRevenue,
      documentsMissing: 0,
    };
  });
}

function paymentBelongsToProduct(payment: AdminPaymentRow, product: ParentProduct) {
  const paymentText = normalizeText(`${payment.title} ${payment.participantName}`);
  const title = normalizeText(product.title);
  const place = normalizeText(product.place);
  const city = normalizeText(product.city);

  return Boolean(title && paymentText.includes(title)) || Boolean(place && paymentText.includes(place)) || Boolean(city && paymentText.includes(city));
}

async function loadAdminParticipants(products: ParentProduct[]): Promise<AdminParticipant[]> {
  if (!hasSupabaseBrowserConfig()) return [];

  const supabase = createBrowserSupabaseClient();
  const [{ data: participantRows, error: participantError }, { data: purchaseRows, error: purchaseError }, { data: passRows }] = await Promise.all([
    supabase
      .from('participants')
      .select('id,parent_profile_id,first_name,last_name,claim_code,level,xp,next_bracelet_xp,attendance_done,attendance_total,active_course,next_training,active_purchases,bracelet,bracelet_color,paid_status,extra_courses'),
    supabase
      .from('parent_purchases')
      .select('id,parent_profile_id,product_id,participant_id,participant_name,type,title,amount,status,expires_at,training_days'),
    supabase
      .from('digital_passes')
      .select('participant_id,total_entries,used_entries'),
  ]);

  if (participantError || purchaseError) return [];

  const participantRowsList = ((participantRows ?? []) as AdminParticipantRow[]).filter((row) => !isDemoAdminRecord(row.id, row.parent_profile_id, row.first_name, row.last_name));
  const purchases = ((purchaseRows ?? []) as AdminPurchaseRow[]).filter((purchase) => !isDemoAdminRecord(purchase.id, purchase.parent_profile_id, purchase.participant_id, purchase.participant_name));
  const parentIds = Array.from(new Set([
    ...participantRowsList.map((row) => row.parent_profile_id).filter(Boolean),
    ...purchases.map((purchase) => purchase.parent_profile_id).filter(Boolean),
  ])) as string[];
  const parentsById = new Map<string, AdminParentProfileRow>();

  if (parentIds.length > 0) {
    const { data: parentRows } = await supabase
      .from('app_profiles')
      .select('id,name,email,phone')
      .in('id', parentIds);

    for (const parent of (parentRows ?? []) as AdminParentProfileRow[]) parentsById.set(parent.id, parent);
  }

  const productById = new Map(products.map((product) => [product.id, product]));
  const purchasesByParticipant = new Map<string, AdminPurchaseRow[]>();

  for (const purchase of purchases) {
    if (!purchase.participant_id) continue;
    const current = purchasesByParticipant.get(purchase.participant_id) ?? [];
    current.push(purchase);
    purchasesByParticipant.set(purchase.participant_id, current);
  }

  const participants = participantRowsList.map((row) => participantFromRows(row, purchasesByParticipant.get(row.id) ?? [], productById, row.parent_profile_id ? parentsById.get(row.parent_profile_id) : undefined));
  const knownIds = new Set(participants.map((participant) => participant.id));

  for (const purchase of purchases) {
    if (!purchase.participant_id || knownIds.has(purchase.participant_id)) continue;
    knownIds.add(purchase.participant_id);
    participants.push(participantFromPurchase(purchase, productById.get(purchase.product_id), purchase.parent_profile_id ? parentsById.get(purchase.parent_profile_id) : undefined));
  }

  // Build maps of digital-pass entries per participant (remaining, total, used)
  const passRemainingByParticipant = new Map<string, number>();
  const passTotalByParticipant = new Map<string, number>();
  const passUsedByParticipant = new Map<string, number>();
  for (const pass of (passRows ?? []) as Array<{ participant_id: string; total_entries: number; used_entries: number }>) {
    const total = pass.total_entries ?? 0;
    const used = pass.used_entries ?? 0;
    passRemainingByParticipant.set(pass.participant_id, (passRemainingByParticipant.get(pass.participant_id) ?? 0) + Math.max(0, total - used));
    passTotalByParticipant.set(pass.participant_id, (passTotalByParticipant.get(pass.participant_id) ?? 0) + total);
    passUsedByParticipant.set(pass.participant_id, (passUsedByParticipant.get(pass.participant_id) ?? 0) + used);
  }

  // Build map of latest Kroužek purchase expiry per participant (null = no expiry)
  const courseExpiresAtByParticipant = new Map<string, string | null>();
  for (const purchase of purchases) {
    if (dbActivityType(purchase.type) !== 'Krouzek') continue;
    if (!purchase.participant_id) continue;
    const existing = courseExpiresAtByParticipant.get(purchase.participant_id);
    if (existing === null) continue; // null = never expires, keep
    if (!purchase.expires_at) {
      courseExpiresAtByParticipant.set(purchase.participant_id, null);
    } else if (!existing || purchase.expires_at > existing) {
      courseExpiresAtByParticipant.set(purchase.participant_id, purchase.expires_at);
    }
  }

  // Attach pass validity data to each participant
  for (const p of participants) {
    const admin = p as AdminParticipant;
    if (passRemainingByParticipant.has(p.id)) admin.passRemainingEntries = passRemainingByParticipant.get(p.id);
    if (passTotalByParticipant.has(p.id)) admin.passTotalEntries = passTotalByParticipant.get(p.id);
    if (passUsedByParticipant.has(p.id)) admin.passUsedEntries = passUsedByParticipant.get(p.id);
    if (courseExpiresAtByParticipant.has(p.id)) admin.courseExpiresAt = courseExpiresAtByParticipant.get(p.id);
  }

  return participants.sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'cs'));
}

function participantFromRows(row: AdminParticipantRow, purchases: AdminPurchaseRow[], productById: Map<string, ParentProduct>, parent?: AdminParentProfileRow): AdminParticipant {
  const dbPurchases = purchases.map((purchase) => purchaseToActivePurchase(purchase, productById.get(purchase.product_id)));
  const storedPurchases = Array.isArray(row.active_purchases) ? row.active_purchases.map((purchase) => ({
    type: dbActivityType(purchase.type),
    title: purchase.title || '',
    status: purchase.status || 'Zaplaceno',
  })).filter((purchase) => purchase.title.length > 0) : [];
  const activePurchases = dedupePurchases([...dbPurchases, ...storedPurchases]);
  const coursePurchase = purchases.find((purchase) => dbActivityType(purchase.type) === 'Krouzek');
  const courseProduct = coursePurchase ? productById.get(coursePurchase.product_id) : undefined;

  return {
    id: row.id,
    firstName: row.first_name || 'Účastník',
    lastName: row.last_name || '',
    claimCode: row.claim_code || '',
    activeCourse: row.active_course || courseProduct?.place || '',
    nextTraining: row.next_training || courseProduct?.primaryMeta || '',
    attendanceDone: row.attendance_done ?? 0,
    attendanceTotal: row.attendance_total ?? 0,
    xp: row.xp ?? 0,
    level: row.level ?? 1,
    bracelet: row.bracelet || 'Začátečník',
    braceletColor: row.bracelet_color || '#7E4AF2',
    nextBraceletXp: row.next_bracelet_xp ?? 100,
    activePurchases,
    parentProfileId: row.parent_profile_id ?? undefined,
    parentName: parent?.name ?? undefined,
    parentEmail: parent?.email ?? undefined,
    parentPhone: parent?.phone ?? undefined,
    extraCourses: Array.isArray(row.extra_courses) ? row.extra_courses.filter(Boolean) : [],
  };
}

function participantFromPurchase(purchase: AdminPurchaseRow, product?: ParentProduct, parent?: AdminParentProfileRow): AdminParticipant {
  const name = purchase.participant_name?.trim() || 'Účastník';
  const [firstName, ...lastNameParts] = name.split(/\s+/);
  return {
    id: purchase.participant_id,
    firstName: firstName || 'Účastník',
    lastName: lastNameParts.join(' '),
    claimCode: '',
    activeCourse: product?.type === 'Krouzek' ? product.place : '',
    nextTraining: product?.type === 'Krouzek' ? product.primaryMeta : '',
    attendanceDone: 0,
    attendanceTotal: 0,
    xp: 0,
    level: 1,
    bracelet: 'Začátečník',
    braceletColor: '#7E4AF2',
    nextBraceletXp: 100,
    activePurchases: [purchaseToActivePurchase(purchase, product)],
    parentProfileId: purchase.parent_profile_id ?? undefined,
    parentName: parent?.name ?? undefined,
    parentEmail: parent?.email ?? undefined,
    parentPhone: parent?.phone ?? undefined,
    extraCourses: [],
  };
}

function purchaseToActivePurchase(purchase: AdminPurchaseRow, product?: ParentProduct) {
  return {
    type: product?.type ?? dbActivityType(purchase.type),
    title: product?.title || purchase.title || product?.place || '',
    status: purchase.status || 'Zaplaceno',
    trainingDays: Array.isArray(purchase.training_days) && purchase.training_days.length > 0 ? purchase.training_days : undefined,
  };
}

function dedupePurchases(purchases: Array<{ type: ActivityType; title: string; status: string; trainingDays?: string[] }>) {
  const map = new Map<string, { type: ActivityType; title: string; status: string; trainingDays?: string[] }>();
  for (const purchase of purchases) {
    const key = `${purchase.type}-${normalizeText(purchase.title)}`;
    if (!map.has(key)) map.set(key, purchase);
  }
  return Array.from(map.values());
}

function dbActivityType(value?: string): ActivityType {
  const normalized = normalizeText(value ?? '');
  if (normalized.includes('tabor')) return 'Tabor';
  if (normalized.includes('workshop')) return 'Workshop';
  return 'Krouzek';
}

async function loadAdminParticipantDocuments(): Promise<AdminDocument[]> {
  if (!hasSupabaseBrowserConfig()) return [];

  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from('course_documents')
    .select('id,participant_id,participant_name,purchase_id,product_id,activity_type,kind,title,status,course_place,scan_path,scan_filename,updated_at_text,updated_at')
    .order('updated_at', { ascending: false });

  if (error) return [];
  return ((data ?? []) as AdminDocumentRow[]).map(mapAdminDocumentRow);
}

function mapAdminDocumentRow(row: AdminDocumentRow): AdminDocument {
  return {
    id: row.id,
    participantId: row.participant_id,
    participantName: row.participant_name || '',
    productId: row.product_id || '',
    purchaseId: row.purchase_id || '',
    kind: row.kind || '',
    coursePlace: row.course_place || '',
    activityTitle: row.course_place || row.title || 'Aktivita',
    activityType: dbActivityType(row.activity_type || ''),
    title: row.title || 'Dokument',
    status: dbDocumentStatus(row.status),
    scanPath: row.scan_path,
    scanFilename: row.scan_filename,
    updatedAt: row.updated_at_text || (row.updated_at ? new Date(row.updated_at).toLocaleDateString('cs-CZ') : 'Evidováno'),
  };
}

function dbDocumentStatus(value?: string | null): DocumentStatus {
  const normalized = normalizeText(value ?? '');
  if (normalized === 'signed' || normalized === 'podepsano' || normalized === 'podepsany') return 'signed';
  if (normalized === 'draft' || normalized === 'navrh') return 'draft';
  return 'missing';
}

async function persistCourseCoachAssignments(product: ParentProduct, previousCoachIds: string[], nextCoachIds: string[]) {
  if (!hasSupabaseBrowserConfig()) return;

  const supabase = createBrowserSupabaseClient();
  const previous = new Set(previousCoachIds);
  const next = new Set(nextCoachIds);
  const added = nextCoachIds.filter((coachId) => !previous.has(coachId));
  const removed = previousCoachIds.filter((coachId) => !next.has(coachId));

  if (removed.length > 0) {
    await supabase.from('coach_sessions').delete().in('id', removed.map((coachId) => courseSessionId(product, coachId)));
  }

  if (added.length > 0) {
    // Geocode the product address once so the coach attendance GPS check works.
    const coords = await geocodeProductLocation(product);
    const orgId = await currentAdminOrgId(supabase);
    const rows = added.map((coachId) => courseSessionRow(product, coachId, coords, orgId));
    await supabase.from('coach_sessions').upsert(rows, { onConflict: 'id' });
  }

  await Promise.all([...added, ...removed].map((coachId) => syncCoachAssignedCourses(supabase, coachId, product.place, next.has(coachId))));
}

function courseSessionId(product: ParentProduct, coachId: string) {
  return `coach-session-${coachId}-${product.id}`;
}

// Resolve the org_id of the currently signed-in admin so coach_sessions are
// scoped to the correct organization (otherwise the DB default files them under VYS).
async function currentAdminOrgId(supabase: ReturnType<typeof createBrowserSupabaseClient>): Promise<string | null> {
  const { data: userResult } = await supabase.auth.getUser();
  const userId = userResult?.user?.id;
  if (!userId) return null;
  const { data } = await supabase.from('app_profiles').select('org_id').eq('id', userId).maybeSingle();
  return (data?.org_id as string | null) ?? null;
}

// Resolve GPS coordinates for the product's location, used to enforce the
// coach attendance location check. Prefers the EXACT pin the admin placed on
// the map (product.latitude/longitude) — that's precise and admin-verified.
// Falls back to geocoding the free-text address (or city + venue) via
// OpenStreetMap Nominatim only when no pin was ever set, so older products
// (created before the map picker existed) keep working. Returns null only if
// every attempt fails, so attendance still works (GPS check skipped).
async function geocodeProductLocation(product: ParentProduct): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof product.latitude === 'number' && typeof product.longitude === 'number') {
    return { latitude: product.latitude, longitude: product.longitude };
  }

  const candidates = [
    product.mapQuery?.trim(),
    [product.venue, product.city].filter(Boolean).join(', ').trim(),
    [product.place, product.city].filter(Boolean).join(', ').trim(),
  ].filter((value): value is string => Boolean(value));

  for (const query of candidates) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cz&q=${encodeURIComponent(query)}`;
      const response = await fetch(url, { headers: { 'Accept-Language': 'cs' } });
      if (!response.ok) continue;
      const results = (await response.json()) as Array<{ lat: string; lon: string }>;
      if (results.length > 0) {
        const latitude = Number(results[0].lat);
        const longitude = Number(results[0].lon);
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          return { latitude, longitude };
        }
      }
    } catch {
      // ignore and try next candidate
    }
  }
  return null;
}

// Re-geocode the product address and update GPS on the coaches' existing sessions
// (used when the org edits the gym address after coaches are already assigned).
async function refreshCourseSessionLocations(product: ParentProduct) {
  if (!hasSupabaseBrowserConfig()) return;
  const coachIds = product.coachIds ?? [];
  if (coachIds.length === 0) return;
  const coords = await geocodeProductLocation(product);
  if (!coords) return;
  const supabase = createBrowserSupabaseClient();
  await supabase
    .from('coach_sessions')
    .update({ latitude: coords.latitude, longitude: coords.longitude, check_in_radius_meters: 300 })
    .in('id', coachIds.map((coachId) => courseSessionId(product, coachId)));
}

function courseSessionRow(product: ParentProduct, coachId: string, coords?: { latitude: number; longitude: number } | null, orgId?: string | null) {
  const { day, time, durationHours } = parseCoursePrimaryMeta(product.primaryMeta);
  return {
    id: courseSessionId(product, coachId),
    coach_id: coachId,
    city: product.city,
    venue: product.venue || product.place,
    group_name: product.title || product.place,
    day,
    time,
    enrolled: product.capacityCurrent,
    present: 0,
    duration_hours: durationHours,
    hourly_rate: 500,
    ...(orgId ? { org_id: orgId } : {}),
    ...(coords ? { latitude: coords.latitude, longitude: coords.longitude, check_in_radius_meters: 300 } : {}),
  };
}

function parseCoursePrimaryMeta(primaryMeta: string) {
  const normalized = normalizeText(primaryMeta);
  const day = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'].find((item) => normalized.includes(normalizeText(item))) ?? 'Pondělí';
  const timeMatch = primaryMeta.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  const time = timeMatch ? `${timeMatch[1]} - ${timeMatch[2]}` : primaryMeta;
  const durationHours = timeMatch ? Math.max(1, hourValue(timeMatch[2]) - hourValue(timeMatch[1])) : 1;
  return { day, time, durationHours };
}

function hourValue(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours + (minutes || 0) / 60;
}

async function syncCoachAssignedCourses(supabase: ReturnType<typeof createBrowserSupabaseClient>, coachId: string, place: string, shouldHaveCourse: boolean) {
  const { data } = await supabase.from('coach_profiles').select('assigned_courses').eq('id', coachId).maybeSingle();
  const assignedCourses = Array.isArray(data?.assigned_courses) ? data.assigned_courses.filter((course): course is string => typeof course === 'string') : [];
  const nextCourses = shouldHaveCourse
    ? Array.from(new Set([place, ...assignedCourses]))
    : assignedCourses.filter((course) => course !== place);
  await supabase.from('coach_profiles').upsert({ id: coachId, assigned_courses: nextCourses }, { onConflict: 'id' });
}

function mergeCoachData(finance: AdminFinanceResponse | null, liveCoaches: AdminCoachSummary[] | null): AdminCoachSummary[] {
  const sourceCoaches = liveCoaches ?? [];

  return sourceCoaches.map((coach) => {
    const apiCoach = finance?.coaches?.find((item) => item.id === coach.id);
    return {
      ...coach,
      stripeAccountId: apiCoach?.stripe_account_id || coach.stripeAccountId,
      level: apiCoach?.level ?? coach.level,
      xp: apiCoach?.xp ?? coach.xp,
      qrTricksApproved: apiCoach?.qr_tricks_approved ?? coach.qrTricksApproved,
    };
  });
}

async function updateCoachApproval(coachId: string, action: 'approve' | 'reject') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (hasSupabaseBrowserConfig()) {
    const supabase = createBrowserSupabaseClient();
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  }

  const response = await fetch('/api/admin/coaches/approval', {
    method: 'POST',
    headers,
    body: JSON.stringify({ coachId, action }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
}

function documentForCoach(coach: AdminCoachSummary, documents: AdminCoachDppDocument[], template?: OrgDppTemplate | null) {
  return documents.find((document) => document.coachId === coach.id) ?? buildCoachDppDocument(coach, 'missing', template);
}

function dppStatusForCoach(coachId: string, documents: AdminCoachDppDocument[]) {
  return documents.find((document) => document.coachId === coachId)?.status ?? 'missing';
}

const DEFAULT_DPP_CLAUSES = [
  'Trenér zajišťuje vedení lekcí, přípravu prostoru, evidenci docházky a bezpečné předání informací administrátorovi.',
  'Rozsah práce se řídí domluveným rozpisem lekcí a nepřekročí zákonný limit pro DPP v daném kalendářním roce.',
  'Odměna se počítá podle schválené hodinové sazby a potvrzené docházky v administraci.',
  'Trenér potvrzuje mlčenlivost o osobních údajích dětí, rodičů a interních provozních informacích.',
  'Digitální podpis trenéra a zástupce organizace je považovaný za potvrzení vyplněných údajů a uložení dokumentu do evidence.',
];

function buildCoachDppDocument(coach: AdminCoachSummary, status: CoachDppStatus, template?: OrgDppTemplate | null): AdminCoachDppDocument {
  const defaultRole = coach.status === 'Ceka na klic' ? 'Trenér / asistent po aktivaci' : 'Trenér sportovních lekcí';
  return {
    id: `dpp-${coach.id}-2026`,
    coachId: coach.id,
    coachName: coach.name,
    title: `DPP 2026 · ${coach.name}`,
    status,
    validFrom: '1. 5. 2026',
    validTo: '31. 12. 2026',
    hourlyRate: coach.baseAmount > 0 && coach.loggedHours > 0 ? Math.round(coach.baseAmount / coach.loggedHours) : 500,
    role: template?.dppRole ?? defaultRole,
    workplace: coach.locations.join(' · '),
    scope: template?.dppScope ?? 'Vedení lekcí, evidence docházky, bezpečnostní dohled a potvrzování progresu účastníků v administraci.',
    digitalEnvelopeId: status === 'missing' ? undefined : `DPP-2026-${coach.id.toUpperCase()}`,
    updatedAt: status === 'missing' ? 'Čeká na vytvoření' : '1. 5. 2026',
    clauses: (template?.dppClauses && template.dppClauses.length > 0) ? template.dppClauses : DEFAULT_DPP_CLAUSES,
  };
}

function coachDppStatusLabel(status: CoachDppStatus) {
  if (status === 'signed') return 'Digitálně podepsáno';
  if (status === 'physical') return 'Fyzicky podepsáno';
  if (status === 'sent') return 'Odesláno';
  if (status === 'draft') return 'Návrh';
  return 'Chybí';
}

function coachDppStatusTone(status: CoachDppStatus): 'purple' | 'pink' | 'orange' | 'mint' {
  if (status === 'signed' || status === 'physical') return 'mint';
  if (status === 'sent') return 'purple';
  if (status === 'draft') return 'orange';
  return 'pink';
}

function normalizeFinanceTransfers(transfers: AdminFinanceTransfer[]): TrainerPayoutTransfer[] {
  return transfers.map((transfer) => ({
    id: transfer.id,
    coachId: transfer.coach_id ?? transfer.id,
    coachName: transfer.coach_name,
    periodKey: transfer.period_key,
    amount: Number(transfer.amount || 0),
    status: transfer.status,
    createdAt: transfer.created_at_text,
    stripeTransferId: transfer.stripe_transfer_id ?? undefined,
  }));
}

function buildInitialCoachAttendanceRecords(): CoachAttendanceRecord[] {
  return [];
}

type ChildAttendanceRow = { id: string; session_id: string | null; date_text: string; location: string; attendees: unknown };

async function loadChildAttendanceRecords(): Promise<ChildAttendanceRecord[]> {
  if (!hasSupabaseBrowserConfig()) return [];

  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from('child_attendance_records')
    .select('id,session_id,date_text,location,attendees');
  if (error || !data) return [];

  return (data as ChildAttendanceRow[]).map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    dateKey: childAttendanceDateKey(row.id, row.date_text),
    location: row.location,
    attendees: Array.isArray(row.attendees)
      ? (row.attendees as { name?: string; time?: string; method?: string }[])
          .filter((attendee) => typeof attendee?.name === 'string' && attendee.name.trim().length > 0)
          .map((attendee) => ({ name: (attendee.name as string).trim(), time: attendee.time, method: attendee.method }))
      : [],
  }));
}

function childAttendanceDateKey(id: string, dateText: string) {
  const fromId = id.match(/(\d{4}-\d{2}-\d{2})$/);
  if (fromId) return fromId[1];
  return czechDateKey(dateText) ?? '';
}

function recordsForCoach(coach: AdminCoachSummary, records: CoachAttendanceRecord[]) {
  return records.filter((record) => record.coachId === coach.id || normalizeText(record.coachName) === normalizeText(coach.name));
}

function buildCoachXpLeaderboard(coaches: AdminCoachSummary[], products: ParentProduct[], coachAttendanceRecords: CoachAttendanceRecord[]) {
  return coaches
    .map((coach) => {
      const assignedProducts = uniqueParticipantProducts(products).filter((product) => (product.coachIds ?? []).includes(coach.id));
      const attendanceRecords = recordsForCoach(coach, coachAttendanceRecords);
      return {
        coach,
        xp: Math.max(0, coach.xp),
        level: Math.max(1, coach.level),
        assignedProducts,
        attendanceRecords,
      };
    })
    .sort((a, b) => b.xp - a.xp || b.coach.qrTricksApproved - a.coach.qrTricksApproved || b.coach.childrenLogged - a.coach.childrenLogged || b.attendanceRecords.length - a.attendanceRecords.length || a.coach.name.localeCompare(b.coach.name, 'cs-CZ'))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function groupByMonthAdmin<T>(items: T[], getDate: (item: T) => string): { label: string; items: T[] }[] {
  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const m = getDate(item).match(/(\d{1,2})\.(\s*)(\d{1,2})\.(\s*)(\d{4})/);
    const key = m ? `${m[5]}-${m[3].padStart(2, '0')}` : 'unknown';
    const label = m
      ? new Date(Number(m[5]), Number(m[3]) - 1, 1).toLocaleString('cs-CZ', { month: 'long', year: 'numeric' })
      : 'Neznámé datum';
    const existing = groups.find((g) => g.key === key);
    if (existing) { existing.items.push(item); }
    else { groups.push({ key, label, items: [item] }); }
  }
  return groups;
}

function buildSharedTrainingSlots(products: ParentProduct[], coaches: AdminCoachSummary[]): SharedTrainingSlot[] {
  const coachById = new Map(coaches.map((coach) => [coach.id, coach]));

  return uniqueParticipantProducts(products)
    .filter((product) => product.type === 'Krouzek')
    .map((product) => {
      const schedule = parseCourseSchedule(product.primaryMeta);
      const coachIds = product.coachIds ?? [];
      const firstCoach = coachById.get(coachIds[0] ?? '');
      const secondCoach = coachById.get(coachIds[1] ?? '');

      return {
        id: product.id,
        activityType: product.type,
        day: schedule.day,
        time: schedule.time,
        place: product.place,
        group: product.title,
        regularCoachId: firstCoach?.id ?? '',
        regularCoachName: firstCoach?.name ?? 'Bez trenéra',
        assignedCoachId: firstCoach?.id,
        assignedCoachName: firstCoach?.name,
        secondCoachId: secondCoach?.id,
        secondCoachName: secondCoach?.name,
        updatedAt: 'z databáze',
      };
    });
}

function buildWorkshopSlots(products: ParentProduct[], coaches: AdminCoachSummary[]): WorkshopSlot[] {
  const coachById = new Map(coaches.map((coach) => [coach.id, coach]));

  return products
    .filter((product) => product.type === 'Workshop')
    .map((product) => {
      const range = parseProductDateRange(product.primaryMeta);
      return {
        id: product.id,
        date: range.dateFrom,
        dateTo: range.dateTo,
        time: range.time,
        city: workshopCityForProduct(product.city),
        venue: product.venue || product.place,
        coaches: (product.coachIds ?? [])
          .map((coachId) => coachById.get(coachId))
          .filter((coach): coach is AdminCoachSummary => Boolean(coach))
          .map((coach) => ({ coachId: coach.id, coachName: coach.name })),
        maxCoaches: WORKSHOP_MAX_COACHES,
        updatedAt: 'z databáze',
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildCampTurnusy(products: ParentProduct[], coaches: AdminCoachSummary[]): CampTurnus[] {
  const coachById = new Map(coaches.map((coach) => [coach.id, coach]));

  return products
    .filter((product) => product.type === 'Tabor')
    .map((product) => {
      const range = parseProductDateRange(product.primaryMeta);
      return {
        id: product.id,
        campId: product.id.replace(/-t\d+$/, ''),
        campTitle: product.title,
        city: product.city,
        venue: product.venue || product.place,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        durationDays: durationDays(range.dateFrom, range.dateTo),
        coaches: (product.coachIds ?? [])
          .map((coachId) => coachById.get(coachId))
          .filter((coach): coach is AdminCoachSummary => Boolean(coach))
          .map((coach) => ({ coachId: coach.id, coachName: coach.name })),
        maxCoaches: CAMP_MAX_COACHES,
      };
    })
    .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom));
}

function buildWorkshopAttendanceRecords(slots: WorkshopSlot[], products: ParentProduct[], participants: ParentParticipant[]): WorkshopAttendanceRecord[] {
  return slots.map((slot) => {
    const slotParticipants = participantsForWorkshopSlot(slot, products, participants);
    return {
      slotId: slot.id,
      attendees: slotParticipants.length,
      participants: slotParticipants.map(participantDisplayName),
      coachTrickCounts: slot.coaches.map((coach) => ({ coachId: coach.coachId, coachName: coach.coachName, count: 0 })),
    };
  });
}

function payoutAmountForCoach(coach: AdminCoachSummary, coachAttendanceRecords: CoachAttendanceRecord[] = buildInitialCoachAttendanceRecords()) {
  const adjustmentAmount = recordsForCoach(coach, coachAttendanceRecords)
    .filter((record) => record.source === 'admin')
    .reduce((sum, record) => sum + record.amount, 0);
  return coach.baseAmount + coach.approvedBonuses + adjustmentAmount;
}

function buildCoachPlacementGroups(coaches: AdminCoachSummary[], products: ParentProduct[], query: string): CoachPlacementGroup[] {
  const coachById = new Map(coaches.map((coach) => [coach.id, coach]));
  const uniqueProducts = uniqueParticipantProducts(products);

  return uniqueProducts
    .map((product) => {
      const productCoaches = (product.coachIds ?? [])
        .map((coachId) => coachById.get(coachId))
        .filter((coach): coach is AdminCoachSummary => Boolean(coach));
      const productMatchesQuery = matchesQuery(`${activityLabel(product.type)} ${product.title} ${product.place} ${product.primaryMeta}`, query);
      const coachesForGroup = query && !productMatchesQuery
        ? productCoaches.filter((coach) => matchesQuery(`${coach.name} ${coach.email} ${coach.phone} ${coach.locations.join(' ')}`, query))
        : productCoaches;

      if (query && !productMatchesQuery && coachesForGroup.length === 0) return null;

      return {
        key: participantProductGroupKey(product),
        type: product.type,
        title: product.title,
        place: product.place,
        primaryMeta: product.primaryMeta,
        coaches: coachesForGroup,
      };
    })
    .filter((group): group is CoachPlacementGroup => Boolean(group));
}

function isParticipantPassActive(participant: ParentParticipant, todayKey: string): boolean {
  const admin = participant as AdminParticipant;
  // Static/demo participants have no pass data — always show
  if (admin.passRemainingEntries === undefined && admin.courseExpiresAt === undefined) return true;
  // Has digital pass records — check if any entries remain
  if (admin.passRemainingEntries !== undefined && admin.passRemainingEntries <= 0) return false;
  // Check date-based expiry (null = no expiry)
  if (admin.courseExpiresAt !== undefined && admin.courseExpiresAt !== null && admin.courseExpiresAt < todayKey) return false;
  return true;
}

function formatTurnusDates(dateFrom: string, dateTo: string): string {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  return `${from.getDate()}.\u2013${to.getDate()}. ${to.getMonth() + 1}. ${to.getFullYear()}`;
}

function buildTaborGroupsFromTurnusy(campTurnusy: CampTurnus[], participants: ParentParticipant[], query: string): ParticipantGroup[] {
  const todayKey = new Date().toISOString().slice(0, 10);
  const campTurnusMap = new Map<string, CampTurnus[]>();
  for (const t of campTurnusy) {
    const arr = campTurnusMap.get(t.campId) ?? [];
    arr.push(t);
    campTurnusMap.set(t.campId, arr);
  }

  return campTurnusy
    .filter((t) => t.dateTo >= todayKey)
    .map((turnus) => {
      const siblings = (campTurnusMap.get(turnus.campId) ?? [turnus]).sort((a, b) => a.dateFrom.localeCompare(b.dateFrom));
      const turnusNumber = siblings.findIndex((t) => t.id === turnus.id) + 1;
      const primaryMeta = `${turnusNumber}. turnus \u00b7 ${formatTurnusDates(turnus.dateFrom, turnus.dateTo)}`;
      const place = `${turnus.city} \u00b7 ${turnus.venue}`;

      const syntheticProduct: ParentProduct = {
        id: turnus.id,
        type: 'Tabor',
        title: turnus.campTitle,
        city: turnus.city,
        place,
        venue: turnus.venue,
        price: 0,
        priceLabel: '',
        capacityTotal: 30,
        capacityCurrent: 0,
        primaryMeta,
        secondaryMeta: '',
        description: '',
        badge: '',
        heroImage: '',
        gallery: [],
        importantInfo: [],
        trainingFocus: [],
      };

      const groupParticipants = participants.filter((participant) => {
        // Only real Tábor purchases count — a Kroužek purchase whose title contains
        // the city name (e.g. "Kroužek Vyškov") must NOT match the Vyškov tábor.
        const purchases = (participant.activePurchases ?? []).filter((purchase) => purchase.type === 'Tabor');
        if (purchases.length === 0) return false;
        const campMatch = purchases.some((purchase) => {
          const pt = normalizeText(purchase.title);
          return pt.includes(normalizeText(turnus.campTitle)) || pt.includes(normalizeText(turnus.city));
        });
        if (!campMatch) return false;
        const hasTurnusNumber = purchases.some((purchase) => {
          const pt = normalizeText(purchase.title);
          return pt.includes('1 turnus') || pt.includes('2 turnus') || pt.includes('turnus 1') || pt.includes('turnus 2');
        });
        if (!hasTurnusNumber) return true;
        return purchases.some((purchase) => {
          const pt = normalizeText(purchase.title);
          return pt.includes(`${turnusNumber} turnus`) || pt.includes(`turnus ${turnusNumber}`);
        });
      });

      return {
        key: `Tabor-${turnus.id}`,
        type: 'Tabor' as ActivityType,
        title: turnus.campTitle,
        place,
        product: syntheticProduct,
        participants: groupParticipants,
      };
    })
    .filter((group) => !query || matchesQuery(`${group.title} ${group.place} ${group.product.primaryMeta}`, query) || group.participants.length > 0);
}

function buildParticipantGroups(query: string, products: ParentProduct[], participants: ParentParticipant[]): ParticipantGroup[] {
  const normalizedQuery = normalizeText(query);
  const todayKey = new Date().toISOString().slice(0, 10);

  return uniqueParticipantProducts(products)
    .map((product) => {
      const groupMatchesQuery = matchesQuery(`${activityLabel(product.type)} ${product.title} ${product.place} ${product.primaryMeta}`, query);
      const relatedParticipants = participants
        .filter((participant) => participantBelongsToProduct(participant, product))
        .filter((participant) => product.type !== 'Krouzek' || isParticipantPassActive(participant, todayKey));
      const groupParticipants = normalizedQuery && !groupMatchesQuery
        ? relatedParticipants.filter((participant) => matchesQuery(`${participant.firstName} ${participant.lastName} ${participant.activeCourse} ${participant.activePurchases.map((purchase) => purchase.title).join(' ')}`, query))
        : relatedParticipants;

      return {
        key: `${product.type}-${normalizeText(product.place)}`,
        type: product.type,
        title: product.title,
        place: product.place,
        product,
        participants: groupParticipants,
      };
    })
    .filter((group) => !normalizedQuery || matchesQuery(`${group.title} ${group.place}`, query) || group.participants.length > 0);
}

function groupParticipantGroupsByCity(groups: ParticipantGroup[]): ParticipantCityGroup[] {
  const cityMap = new Map<string, ParticipantCityGroup>();

  for (const group of groups) {
    const city = participantGroupCity(group);
    const key = normalizeText(city);
    const current = cityMap.get(key) ?? {
      key,
      city,
      groups: [],
      participantCount: 0,
      missingDocuments: 0,
    };

    current.groups.push(group);
    current.missingDocuments = 0;
    cityMap.set(key, current);
  }

  // Participant totals are computed AFTER all groups for a city are collected,
  // deduped by participant id — several product records can share the exact
  // same place text (e.g. duplicate/renamed krožky at one address), and
  // participantBelongsToProduct() matches by place TEXT, so the same physical
  // participant can otherwise get matched to more than one product card and be
  // summed twice.
  for (const cityGroup of cityMap.values()) {
    cityGroup.participantCount = countUniqueParticipants(cityGroup.groups);
  }

  return Array.from(cityMap.values()).sort((a, b) => a.city.localeCompare(b.city, 'cs'));
}

function countUniqueParticipants(groups: ParticipantGroup[]): number {
  const ids = new Set<string>();
  for (const group of groups) {
    for (const participant of group.participants) ids.add(participant.id);
  }
  return ids.size;
}

function groupParticipantGroupsByTerm(groups: ParticipantGroup[]): ParticipantTermGroup[] {
  const termMap = new Map<string, ParticipantTermGroup>();

  for (const group of groups) {
    const term = participantGroupTerm(group);
    const key = normalizeText(term);
    const current = termMap.get(key) ?? {
      key,
      term,
      groups: [],
      participantCount: 0,
      missingDocuments: 0,
    };

    current.groups.push(group);
    current.missingDocuments = 0;
    termMap.set(key, current);
  }

  for (const termGroup of termMap.values()) {
    termGroup.participantCount = countUniqueParticipants(termGroup.groups);
  }

  return Array.from(termMap.values()).sort((a, b) => a.term.localeCompare(b.term, 'cs'));
}

function participantGroupTerm(group: ParticipantGroup) {
  return group.product.primaryMeta?.trim() || 'Termín není vyplněný';
}

function participantGroupCity(group: ParticipantGroup) {
  const city = group.product.city?.trim();
  if (city) return city;
  return group.place.split('·')[0]?.trim() || group.place;
}

function uniqueParticipantProducts(products: ParentProduct[]) {
  const productsByPlace = new Map<string, ParentProduct>();

  for (const product of products) {
    const key = participantProductGroupKey(product);
    if (!productsByPlace.has(key)) productsByPlace.set(key, product);
  }

  return Array.from(productsByPlace.values());
}

function participantProductGroupKey(product: ParentProduct) {
  // Each tábor product IS its own turnus — keep them all, never deduplicate
  if (product.type === 'Tabor') return product.id;
  // Dedupe by product id (not by place text!) — grouping by place used to
  // silently merge two DIFFERENT kroužky/workshopy that just happen to share
  // the same gym address, dropping the second one's card and its coaches
  // entirely, and making the "Trenéři podle míst" counts wrong. A Krouzek's
  // base product and its "-15" (15 lekcí) price variant are still the same
  // course, so those two rows are merged.
  if (product.type === 'Krouzek') return product.id.endsWith('-15') ? product.id.slice(0, -3) : product.id;
  return product.id;
}

function participantBelongsToProduct(participant: ParentParticipant, product: ParentProduct) {
  const activeCourse = normalizeText(participant.activeCourse);
  const productPlace = normalizeText(product.place);
  const productCity = normalizeText(product.city);

  if (product.type === 'Krouzek') {
    // A child with ONE permanentka may attend more schools in the same city
    // (extraCourses). Match the primary active_course OR any extra course.
    const extraCourses = ((participant as { extraCourses?: string[] }).extraCourses ?? [])
      .map((c) => normalizeText(c))
      .filter(Boolean);
    const matchesPlace = (place: string) => place === productPlace || place.includes(productPlace) || productPlace.includes(place);
    if (activeCourse || extraCourses.length > 0) {
      return (activeCourse ? matchesPlace(activeCourse) : false) || extraCourses.some(matchesPlace);
    }
  }

  return participant.activePurchases.some((purchase) => {
    if (purchase.type !== product.type) return false;
    const purchaseTitle = normalizeText(purchase.title);
    const productTitle = normalizeText(product.title);
    const cityOrPlaceMatch = purchaseTitle.includes(productCity) || purchaseTitle.includes(productPlace) || purchaseTitle.includes(productTitle) || productPlace.includes(purchaseTitle) || productTitle.includes(purchaseTitle);
    if (!cityOrPlaceMatch) return false;
    if (product.type === 'Tabor') {
      const primaryMetaNorm = normalizeText(product.primaryMeta);
      const purchaseHas1 = purchaseTitle.includes('1 turnus');
      const purchaseHas2 = purchaseTitle.includes('2 turnus');
      // If we can identify a clear conflict, exclude
      if (purchaseHas1 && primaryMetaNorm.includes('2 turnus')) return false;
      if (purchaseHas2 && primaryMetaNorm.includes('1 turnus')) return false;
    }
    return true;
  });
}

function participantsForWorkshopSlot(slot: WorkshopSlot, products: ParentProduct[], participants: ParentParticipant[]) {
  const product = products.find((item) => item.id === slot.id);
  if (!product) return [];
  return participants.filter((participant) => participantBelongsToProduct(participant, product));
}

function participantDisplayName(participant: ParentParticipant) {
  return `${participant.firstName} ${participant.lastName}`.trim();
}

function parseCourseSchedule(primaryMeta: string) {
  const cleaned = primaryMeta.trim();
  // Match ALL day tokens — a kroužek can run on multiple days (e.g.
  // "Úterý / Čtvrtek"). The calendar splits slot.day on " / " to place the slot
  // on every matching weekday, so we must preserve them all here instead of
  // grabbing only the first match (which silently dropped the 2nd day).
  const dayMatches = cleaned.match(/(pondělí|pondeli|úterý|utery|středa|streda|čtvrtek|ctvrtek|pátek|patek|sobota|neděle|nedele)/gi);
  const timeMatch = cleaned.match(/\d{1,2}:\d{2}\s*(?:[-–]\s*\d{1,2}:\d{2})?/);
  const days = dayMatches ? Array.from(new Set(dayMatches.map((day) => capitalizeCzechDay(day)))) : [];
  return {
    day: days.length > 0 ? days.join(' / ') : 'Den není vyplněný',
    time: timeMatch?.[0]?.replace(/\s*[-–]\s*/, ' - ') ?? 'Čas není vyplněný',
  };
}

function capitalizeCzechDay(day: string) {
  const normalized = normalizeText(day);
  if (normalized === 'pondeli') return 'Pondělí';
  if (normalized === 'utery') return 'Úterý';
  if (normalized === 'streda') return 'Středa';
  if (normalized === 'ctvrtek') return 'Čtvrtek';
  if (normalized === 'patek') return 'Pátek';
  if (normalized === 'sobota') return 'Sobota';
  if (normalized === 'nedele') return 'Neděle';
  return day;
}

function workshopCityForProduct(city: string): WorkshopCity {
  if (city === 'Praha' || city === 'Ostrava' || city === 'Brno') return city;
  return 'Brno';
}

function parseProductDateRange(primaryMeta: string) {
  const nowIso = new Date().toISOString().slice(0, 10);
  const isoDates = primaryMeta.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  const czechDates = Array.from(primaryMeta.matchAll(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})?/g)).map((match) => {
    const year = match[3] ? Number(match[3]) : new Date().getFullYear();
    return isoDate(year, Number(match[2]), Number(match[1]));
  });
  const dateFrom = isoDates[0] ?? czechDates[0] ?? nowIso;
  const dateTo = isoDates[1] ?? czechDates[1] ?? dateFrom;
  const timeMatch = primaryMeta.match(/\d{1,2}:\d{2}\s*(?:[-–]\s*\d{1,2}:\d{2})?/);
  return {
    dateFrom,
    dateTo,
    time: timeMatch?.[0]?.replace(/\s*[-–]\s*/, ' - ') ?? 'čas není vyplněný',
  };
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function durationDays(dateFrom: string, dateTo: string) {
  const from = new Date(`${dateFrom}T00:00:00`);
  const to = new Date(`${dateTo}T00:00:00`);
  const diff = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  return Number.isFinite(diff) && diff > 0 ? diff : 1;
}

function formatIsoDateForDisplay(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  return `${day}. ${month}. ${year}`;
}

function documentsForParticipant(participant: ParentParticipant, documents: AdminDocument[]): AdminDocument[] {
  const participantName = `${participant.firstName} ${participant.lastName}`;
  const normalizedName = normalizeText(participantName);
  return documents.filter((document) => document.participantId === participant.id || normalizeText(document.participantName) === normalizedName);
}

function documentsForActivityParticipant(participant: ParentParticipant, activityType: ActivityType, documents: AdminDocument[]): AdminDocument[] {
  return documentsForParticipant(participant, documents).filter((document) => document.activityType === activityType);
}

function allParticipantDocuments(participants: ParentParticipant[], documents: AdminDocument[]) {
  const documentsByKey = new Map<string, AdminDocument>();

  for (const participant of participants) {
    for (const document of documentsForParticipant(participant, documents)) {
      const key = `${normalizeText(document.participantName)}-${document.activityType}-${documentKindForTitle(document.title)}`;
      const current = documentsByKey.get(key);
      if (!current || document.status === 'signed') documentsByKey.set(key, document);
    }
  }

  return Array.from(documentsByKey.values());
}

function documentStatsFor(documents: ParentDocument[]) {
  const signed = documents.filter((document) => document.status === 'signed').length;
  const missing = documents.filter((document) => document.status !== 'signed').length;
  return { signed, missing, total: documents.length };
}

function markDocumentComplete(document: ParentDocument): ParentDocument {
  return document.status === 'signed' ? document : { ...document, status: 'signed', updatedAt: 'Vyplněno při platbě' };
}

function missingDocumentsForActivity(activity: ReturnType<typeof adminActivityRows>[number], products: ParentProduct[], participants: ParentParticipant[], documents: AdminDocument[]) {
  return participantsForActivity(activity, products, participants).flatMap((participant) => documentsForActivityParticipant(participant, activity.type, documents).filter((document) => document.status !== 'signed'));
}

function missingDocumentLabel(document: ParentDocument) {
  return `${document.title} (${activityLabel(document.activityType)})`;
}

function documentKindForTitle(title: string) {
  const normalizedTitle = normalizeText(title);
  if (normalizedTitle.includes('gdpr')) return 'gdpr';
  if (normalizedTitle.includes('souhlas')) return 'guardian-consent';
  if (normalizedTitle.includes('zdravotni') || normalizedTitle.includes('anamneza') || normalizedTitle.includes('alergie')) return 'health';
  if (normalizedTitle.includes('vyzvedavani') || normalizedTitle.includes('odchod')) return 'departure';
  if (normalizedTitle.includes('bezinfekcnost')) return 'infection-free';
  if (normalizedTitle.includes('veci') || normalizedTitle.includes('sebou')) return 'packing';
  if (normalizedTitle.includes('prihlaška') || normalizedTitle.includes('podminky')) return 'workshop-terms';
  return normalizedTitle;
}

function buildCourseLocationStats(activityRows: ReturnType<typeof adminActivityRows>, childAttendanceRecords: ChildAttendanceRecord[]) {
  const courseActivities = activityRows.filter((activity) => activity.type === 'Krouzek');
  const uniqueActivities = new Map<string, (typeof courseActivities)[number]>();

  for (const activity of courseActivities) {
    // Key by place + title so two courses at the SAME school (e.g. Prostějov
    // začátečníci vs pokročilí) each get their own card, while 10/15 variants
    // of the same course still merge.
    const key = `${normalizeText(activity.place)}||${normalizeText(activity.title)}`;
    if (!uniqueActivities.has(key)) uniqueActivities.set(key, activity);
  }

  return Array.from(uniqueActivities.entries()).map(([key, activity]) => {
    const monthGroups = buildActivitySessions(activity, childAttendanceRecords);
    const sessions = monthGroups.flatMap((g) => g.sessions);
    const presentCounts = sessions.map((s) => s.present);
    const averagePresent = Math.round(presentCounts.reduce((sum, value) => sum + value, 0) / Math.max(1, presentCounts.length));
    return {
      key,
      activity,
      place: activity.place,
      sessions,
      capacityTotal: activity.capacityTotal,
      averagePresent,
      maxPresent: Math.max(...presentCounts, 0),
      lastPresent: presentCounts[presentCounts.length - 1] ?? 0,
      enrolledCount: activity.registered,
    };
  });
}

const CZECH_MONTH_NAMES = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];

function czechDateKey(value: string) {
  const match = value.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : null;
}

function childRecordProductId(record: ChildAttendanceRecord) {
  // id format: children-coach-session-<coach uuid>-<product id>-<YYYY-MM-DD>
  const match = record.id.match(/^children-coach-session-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)-\d{4}-\d{2}-\d{2}$/i);
  return match ? match[1] : null;
}

function childRecordsForActivity(activity: ReturnType<typeof adminActivityRows>[number], records: ChildAttendanceRecord[]) {
  const activityBase = activity.id.replace(/-15$/, '');
  const placeNeedle = normalizeText(activity.place);

  return records.filter((record) => {
    const productId = childRecordProductId(record);
    if (productId) return productId.replace(/-15$/, '') === activityBase;
    const location = normalizeText(record.location);
    return Boolean(placeNeedle && location && (location.includes(placeNeedle) || placeNeedle.includes(location)));
  });
}

function buildActivitySessions(activity: ReturnType<typeof adminActivityRows>[number], childAttendanceRecords: ChildAttendanceRecord[]) {
  const namesByDate = new Map<string, Set<string>>();

  for (const record of childRecordsForActivity(activity, childAttendanceRecords)) {
    if (!record.dateKey) continue;
    const names = namesByDate.get(record.dateKey) ?? new Set<string>();
    for (const attendee of record.attendees) names.add(attendee.name);
    namesByDate.set(record.dateKey, names);
  }

  const sessions = Array.from(namesByDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dateKey, names]) => {
      const [year, month, day] = dateKey.split('-').map(Number);
      return {
        monthKey: dateKey.slice(0, 7),
        monthLabel: `${CZECH_MONTH_NAMES[month - 1]} ${year}`,
        date: `${day}. ${month}. ${year}`,
        shortDate: `${day}. ${month}.`,
        present: names.size,
        presentNames: Array.from(names),
        absent: Math.max(0, activity.capacityTotal - names.size),
        capacityTotal: activity.capacityTotal,
      };
    });

  const groups = new Map<string, { month: string; sessions: typeof sessions }>();
  for (const session of sessions) {
    const group = groups.get(session.monthKey);
    if (group) group.sessions.push(session);
    else groups.set(session.monthKey, { month: session.monthLabel, sessions: [session] });
  }
  return Array.from(groups.values());
}

function productForActivity(activity: ReturnType<typeof adminActivityRows>[number], products: ParentProduct[]) {
  return products.find((item) => item.id === activity.id)
    ?? products.find((item) => item.type === activity.type && normalizeText(item.place) === normalizeText(activity.place))
    ?? null;
}

function buildActivityCoachPresence(activity: ReturnType<typeof adminActivityRows>[number], products: ParentProduct[], coaches: AdminCoachSummary[], coachAttendanceRecords: CoachAttendanceRecord[], selectedDate?: string | null): ActivityCoachPresence[] {
  const product = productForActivity(activity, products);
  const presence = new Map<string, ActivityCoachPresence>();

  for (const record of coachAttendanceRecordsForActivity(activity, product, coachAttendanceRecords, selectedDate)) {
    const key = record.coachId ?? normalizeText(record.coachName);
    if (!key || presence.has(key)) continue;

    presence.set(key, {
      id: key,
      name: record.coachName,
      detail: `${record.date} · ${record.present ? `${record.present} · ` : ''}${record.durationHours} h${record.source === 'admin' ? ' · doplněno adminem' : ''}`,
      source: 'attendance',
    });
  }

  return Array.from(presence.values()).sort((a, b) => a.name.localeCompare(b.name, 'cs'));
}

function coachAttendanceRecordsForActivity(activity: ReturnType<typeof adminActivityRows>[number], product: ParentProduct | null, records: CoachAttendanceRecord[], selectedDate?: string | null) {
  const needles = Array.from(new Set([
    activity.title,
    activity.place,
    product?.title,
    product?.place,
    product?.venue,
  ].map((value) => normalizeText(value ?? '')).filter(Boolean)));
  const selectedKey = selectedDate ? czechDateKey(selectedDate) : null;

  return records.filter((record) => {
    const recordText = normalizeText(`${record.sessionTitle} ${record.reason}`);
    const matchesActivity = needles.some((needle) => recordText.includes(needle) || (recordText.length > 0 && needle.includes(recordText)));
    if (!matchesActivity) return false;
    if (!selectedDate) return true;
    const recordKey = czechDateKey(record.date);
    if (selectedKey && recordKey) return selectedKey === recordKey;
    return normalizeText(record.date) === normalizeText(selectedDate);
  });
}

function assignedCoachDetail(activityType: ActivityType, product: ParentProduct | null) {
  const meta = product?.primaryMeta ? ` · ${product.primaryMeta}` : '';
  if (activityType === 'Tabor') return `Přiřazený k táboru${meta}`;
  if (activityType === 'Workshop') return `Přiřazený k workshopu${meta}`;
  return `Přiřazený ke kroužku${meta}`;
}

function participantsForActivity(activity: ReturnType<typeof adminActivityRows>[number], products: ParentProduct[], participants: ParentParticipant[]) {
  const product = productForActivity(activity, products);
  if (!product) return [];
  return participants.filter((participant) => participantBelongsToProduct(participant, product));
}

function registeredParticipantsForActivity(activity: ReturnType<typeof adminActivityRows>[number], products: ParentProduct[], participants: ParentParticipant[], documents: AdminDocument[]): ActivityParticipantRecord[] {
  return participantsForActivity(activity, products, participants).map((participant) => participantRecordForLinkedParticipant(participant, activity, documents));
}

function sessionParticipantsForActivity(activity: ReturnType<typeof adminActivityRows>[number], presentNames: string[], products: ParentProduct[], participants: ParentParticipant[], documents: AdminDocument[]) {
  const needles = presentNames.map((name) => normalizeText(name)).filter(Boolean);
  return registeredParticipantsForActivity(activity, products, participants, documents).filter((record) => needles.includes(normalizeText(record.name)));
}

function participantRecordForLinkedParticipant(participant: ParentParticipant, activity: ReturnType<typeof adminActivityRows>[number], documents: AdminDocument[]): ActivityParticipantRecord {
  const participantDocuments = activityDocumentsForParticipant(participant, activity, documents);
  const missing = participantDocuments.filter((document) => document.status !== 'signed').length;

  return {
    id: participant.id,
    name: `${participant.firstName} ${participant.lastName}`,
    subtitle: `${activityLabel(activity.type)} · ${activity.place}`,
    level: `${participant.level}`,
    attendance: activity.type === 'Krouzek' ? `${participant.attendanceDone}/${participant.attendanceTotal}` : activity.type === 'Workshop' ? 'Ticket' : 'Registrován',
    documents: participantDocuments.length === 0 ? 'Bez dokumentů' : missing > 0 ? `${missing} dok. chybí` : 'Dokumenty OK',
    parentContact: parentContactLabel(participant),
    participant,
  };
}

function activityDocumentsForParticipant(participant: ParentParticipant, activity: ReturnType<typeof adminActivityRows>[number], documents: AdminDocument[]) {
  return documentsForActivityParticipant(participant, activity.type, documents);
}

function parentContactLabel(participant: ParentParticipant) {
  const adminParticipant = participant as AdminParticipant;
  const parts = [adminParticipant.parentName, adminParticipant.parentPhone || adminParticipant.parentEmail].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Kontakt není evidovaný';
}

function buildCompleteCourseAttendance(participant: ParentParticipant, place: string) {
  const remaining = Math.max(0, participant.attendanceTotal - participant.attendanceDone);
  return [
    {
      id: `${participant.id}-attendance-used`,
      label: 'Využité vstupy',
      date: place,
      time: `${participant.attendanceDone}/${participant.attendanceTotal}`,
      method: 'Profil účastníka',
      status: 'Přítomen' as const,
    },
    ...(remaining > 0 ? [{
      id: `${participant.id}-attendance-remaining`,
      label: 'Zbývá vstupů',
      date: participant.nextTraining || 'Další termín není evidovaný',
      time: `${remaining}`,
      method: 'Permanentka',
      status: 'Zbývá' as const,
    }] : []),
  ];
}

function buildSkillTree(participant: ParentParticipant) {
  const skills = [
    { title: 'Bezpečný dopad', xp: 100, description: 'Měkké přistání, kontrola kolen a práce s rukama.' },
    { title: 'Parakotoul', xp: 240, description: 'Plynulý přechod z dopadu do kotoulu bez ztráty směru.' },
    { title: 'Precision jump', xp: 390, description: 'Přesný odraz a dopad na vyznačený cíl.' },
    { title: 'Lazy vault', xp: 560, description: 'Základní přeskok přes překážku s oporou ruky.' },
    { title: 'Kong vault', xp: 760, description: 'Dynamický přeskok s bezpečnou přípravou na vyšší překážku.' },
    { title: 'Wall run', xp: 980, description: 'Náběh na stěnu a kontrolovaný návrat zpět.' },
    { title: 'Flow link', xp: 1220, description: 'Spojení více prvků do krátké trasy bez zastavení.' },
    { title: 'Master challenge', xp: 1450, description: 'Kombinace techniky, odvahy a čistého provedení.' },
  ];
  const firstLockedIndex = skills.findIndex((skill) => participant.xp < skill.xp);

  return skills.map((skill, index) => ({
    ...skill,
    status: participant.xp >= skill.xp ? 'Hotovo' as const : 'Zamčeno' as const,
  }));
}

function filterActivityRows(activityRows: ReturnType<typeof adminActivityRows>, query: string) {
  return activityRows.filter((activity) => matchesQuery(`${activity.title} ${activity.place} ${activity.type}`, query));
}

function matchesQuery(value: string, query: string) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return true;
  return normalizeText(value).includes(normalizedQuery);
}

function isDemoAdminRecord(...values: Array<string | null | undefined>) {
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

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slugForId(value: string) {
  return normalizeText(value).replace(/\s+/g, '-');
}

function isPaidStatus(status: string) {
  return normalizeText(status) === 'zaplaceno' || normalizeText(status) === 'paid';
}

function coachStatusLabel(status: AdminCoachSummary['status']) {
  if (status === 'Aktivni') return 'Aktivní';
  if (status === 'Ceka na klic') return 'Čeká na klíč';
  return 'Pozastavený';
}

function initialsForName(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function friendlyPayoutError(message: string) {
  if (message.includes('Missing STRIPE_SECRET_KEY')) return 'Backend nemá nastavený Stripe secret key. Doplň STRIPE_SECRET_KEY pro výplaty.';
  if (message.includes('Missing SUPABASE_URL') || message.includes('SUPABASE_SERVICE_ROLE_KEY')) return 'Backend nemá Supabase service role klíč, takže výplatu nejde uložit do historie.';
  return message;
}

function paymentDateToIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const match = trimmed.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return null;
}

function PaymentHistorySection({ paymentRows, isVysOrg }: { paymentRows: AdminPaymentRow[]; isVysOrg: boolean }) {
  const [nameQuery, setNameQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Kroužek' | 'Tábor' | 'Workshop'>('all');

  const filtered = useMemo(() => {
    const q = normalizeText(nameQuery.trim());
    return paymentRows
      .filter((row) => {
        if (q && !normalizeText(`${row.participantName} ${row.title}`).includes(q)) return false;
        if (statusFilter === 'paid' && !isPaidStatus(row.status)) return false;
        if (statusFilter === 'pending' && isPaidStatus(row.status)) return false;
        if (typeFilter !== 'all' && normalizeText(row.type) !== normalizeText(typeFilter)) return false;
        const iso = paymentDateToIso(row.dueDate);
        if (fromDate && (!iso || iso < fromDate)) return false;
        if (toDate && (!iso || iso > toDate)) return false;
        return true;
      })
      .sort((a, b) => (paymentDateToIso(b.dueDate) ?? '').localeCompare(paymentDateToIso(a.dueDate) ?? ''));
  }, [paymentRows, nameQuery, fromDate, toDate, statusFilter, typeFilter]);

  const paidTotal = filtered.filter((r) => isPaidStatus(r.status)).reduce((s, r) => s + Number(r.amount || 0), 0);
  const pendingTotal = filtered.filter((r) => !isPaidStatus(r.status)).reduce((s, r) => s + Number(r.amount || 0), 0);
  const hasActiveFilters = Boolean(nameQuery || fromDate || toDate || statusFilter !== 'all' || typeFilter !== 'all');

  return (
    <div className="space-y-5">
      <Panel className="p-5">
        <SectionTitle icon={<History size={18} />} title="Historie plateb" subtitle="všechny platby rodičů na jednom místě" />

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-black uppercase tracking-wide text-brand-ink-soft">Jméno / položka</span>
            <div className="flex items-center gap-2 rounded-[12px] border border-brand-purple/15 bg-brand-paper px-3 py-2">
              <Search size={15} className="shrink-0 text-brand-ink-soft" />
              <input
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
                placeholder="Hledat jméno…"
                className="w-full bg-transparent text-sm font-bold text-brand-ink outline-none placeholder:text-brand-ink-soft/60"
              />
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-black uppercase tracking-wide text-brand-ink-soft">Od data</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-[12px] border border-brand-purple/15 bg-brand-paper px-3 py-2 text-sm font-bold text-brand-ink outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-black uppercase tracking-wide text-brand-ink-soft">Do data</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-[12px] border border-brand-purple/15 bg-brand-paper px-3 py-2 text-sm font-bold text-brand-ink outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-black uppercase tracking-wide text-brand-ink-soft">Stav</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'paid' | 'pending')} className="rounded-[12px] border border-brand-purple/15 bg-brand-paper px-3 py-2 text-sm font-bold text-brand-ink outline-none">
              <option value="all">Vše</option>
              <option value="paid">Zaplaceno</option>
              <option value="pending">Čeká na platbu</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-black uppercase tracking-wide text-brand-ink-soft">Typ</span>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | 'Kroužek' | 'Tábor' | 'Workshop')} className="rounded-[12px] border border-brand-purple/15 bg-brand-paper px-3 py-2 text-sm font-bold text-brand-ink outline-none">
              <option value="all">Vše</option>
              <option value="Kroužek">Kroužky</option>
              <option value="Tábor">Tábory</option>
              {isVysOrg ? <option value="Workshop">Workshopy</option> : null}
            </select>
          </label>
        </div>

        {hasActiveFilters ? (
          <button type="button" onClick={() => { setNameQuery(''); setFromDate(''); setToDate(''); setStatusFilter('all'); setTypeFilter('all'); }} className="mt-3 text-xs font-black text-brand-purple hover:underline">
            Zrušit filtry
          </button>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[14px] border border-brand-purple/15 bg-brand-purple/5 px-4 py-3">
            <p className="text-[11px] font-black uppercase tracking-wide text-brand-ink-soft">Záznamů</p>
            <p className="mt-0.5 text-lg font-black text-brand-ink">{filtered.length}</p>
          </div>
          <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-[11px] font-black uppercase tracking-wide text-brand-ink-soft">Zaplaceno</p>
            <p className="mt-0.5 text-lg font-black text-emerald-600">{currency(paidTotal)}</p>
          </div>
          <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-[11px] font-black uppercase tracking-wide text-brand-ink-soft">Čeká</p>
            <p className="mt-0.5 text-lg font-black text-amber-700">{currency(pendingTotal)}</p>
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden p-0">
        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm font-bold text-brand-ink-soft">
            Žádné platby neodpovídají filtru.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-brand-purple/10 bg-brand-paper">
                  <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wide text-brand-ink-soft">Datum</th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wide text-brand-ink-soft">Účastník</th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wide text-brand-ink-soft">Položka</th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wide text-brand-ink-soft">Typ</th>
                  <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wide text-brand-ink-soft">Částka</th>
                  <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wide text-brand-ink-soft">Stav</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const paid = isPaidStatus(row.status);
                  return (
                    <tr key={row.id} className="border-b border-brand-purple/5 last:border-0">
                      <td className="px-4 py-3 text-xs font-bold text-brand-ink-soft">{row.dueDate || '—'}</td>
                      <td className="px-4 py-3 text-sm font-black text-brand-ink">{row.participantName}</td>
                      <td className="px-4 py-3 text-sm font-bold text-brand-ink-soft">{row.title}</td>
                      <td className="px-4 py-3 text-xs font-bold text-brand-ink-soft">{row.type || '—'}</td>
                      <td className="px-4 py-3 text-right text-sm font-black text-brand-ink">{Number(row.amount || 0).toLocaleString('cs-CZ')} Kč</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${paid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {paid ? 'Zaplaceno' : (row.status || 'Čeká')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function FinanceOverviewSection({ totals, invoices, paymentRows, coaches, coachAttendanceRecords, products, onNavigate, isVysOrg }: {
  totals: AdminTotals;
  invoices: Invoice[];
  paymentRows: AdminPaymentRow[];
  coaches: AdminCoachSummary[];
  coachAttendanceRecords: CoachAttendanceRecord[];
  products: ParentProduct[];
  onNavigate: (section: SectionKey) => void;
  isVysOrg: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  // ── Období (přepínání měsíc / rok / celkově) ─────────────────────────────
  const CZECH_MONTH_ABBR = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];
  type FinancePeriodMode = 'all' | 'month' | 'range';
  const [periodMode, setPeriodMode] = useState<FinancePeriodMode>('month');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | null>(null); // null = celý rok
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [gymRates, setGymRates] = useState<Record<string, number>>({});
  const [rentDraft, setRentDraft] = useState<Record<string, string>>({});
  const [rentStatus, setRentStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const allTime = periodMode === 'all';

  useEffect(() => {
    if (!hasSupabaseBrowserConfig()) return;
    let cancelled = false;
    void (async () => {
      const supabase = createBrowserSupabaseClient();
      const orgId = await currentAdminOrgId(supabase);
      const { data } = orgId
        ? await supabase.from('gym_rents').select('location_key,hourly_rate').eq('org_id', orgId)
        : await supabase.from('gym_rents').select('location_key,hourly_rate');
      if (cancelled || !data) return;
      const rates: Record<string, number> = {};
      const draft: Record<string, string> = {};
      for (const row of data as { location_key: string; hourly_rate: number }[]) {
        const value = Number(row.hourly_rate) || 0;
        rates[row.location_key] = value;
        draft[row.location_key] = value ? String(value) : '';
      }
      setGymRates(rates);
      setRentDraft(draft);
    })();
    return () => { cancelled = true; };
  }, []);

  async function saveAllGymRates() {
    if (!hasSupabaseBrowserConfig()) { setRentStatus('saved'); setTimeout(() => setRentStatus('idle'), 2000); return; }
    setRentStatus('saving');
    try {
      const supabase = createBrowserSupabaseClient();
      const orgId = await currentAdminOrgId(supabase);
      const nextRates: Record<string, number> = {};
      const nowIso = new Date().toISOString();
      const rows = rentLocations.map((loc) => {
        const rate = Math.max(0, Number((rentDraft[loc.key] || '').replace(',', '.')) || 0);
        nextRates[loc.key] = rate;
        return { org_id: orgId as string, location_key: loc.key, label: loc.label, hourly_rate: rate, updated_at: nowIso };
      });
      setGymRates((prev) => ({ ...prev, ...nextRates }));
      if (orgId && rows.length) await supabase.from('gym_rents').upsert(rows, { onConflict: 'org_id,location_key' });
      setRentStatus('saved');
      setTimeout(() => setRentStatus('idle'), 2500);
    } catch {
      setRentStatus('idle');
    }
  }

  const isoOf = (dateStr?: string): string | null => {
    if (!dateStr) return null;
    const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const cz = dateStr.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
    if (cz) return `${cz[3]}-${String(Number(cz[2])).padStart(2, '0')}-${String(Number(cz[1])).padStart(2, '0')}`;
    return null;
  };
  const inPeriod = (dateStr?: string): boolean => {
    if (periodMode === 'all') return true;
    const iso = isoOf(dateStr);
    if (!iso) return false;
    if (periodMode === 'range') {
      if (rangeFrom && iso < rangeFrom) return false;
      if (rangeTo && iso > rangeTo) return false;
      return true;
    }
    const rowYear = Number(iso.slice(0, 4));
    const rowMonth = Number(iso.slice(5, 7));
    if (rowYear !== year) return false;
    return month === null ? true : rowMonth === month + 1;
  };
  const fmtCz = (iso: string) => { const p = iso.split('-'); return p.length === 3 ? `${Number(p[2])}. ${Number(p[1])}. ${p[0]}` : iso; };
  const periodLabel =
    periodMode === 'all' ? 'Celkově'
    : periodMode === 'range'
      ? (rangeFrom || rangeTo ? `${rangeFrom ? fmtCz(rangeFrom) : '…'} – ${rangeTo ? fmtCz(rangeTo) : '…'}` : 'Zvol rozsah')
      : month === null ? `Celý rok ${year}` : `${CZECH_MONTH_NAMES_WEB[month]} ${year}`;

  const filteredPaymentRows = allTime ? paymentRows : paymentRows.filter((r) => inPeriod(r.dueDate));
  const filteredInvoices = allTime ? invoices : invoices.filter((inv) => inPeriod(inv.issuedDate || inv.dueDate));
  const filteredCoachAttendance = allTime ? coachAttendanceRecords : coachAttendanceRecords.filter((a) => inPeriod(a.date));

  // Příjmy (v období)
  const paidRows = filteredPaymentRows.filter((r) => isPaidStatus(r.status));
  const revenueTotal = paidRows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const paidCount = paidRows.length;
  const revenuePending = filteredPaymentRows.filter((r) => !isPaidStatus(r.status)).reduce((s, r) => s + Number(r.amount || 0), 0);

  // Náklady na trenéry v období (ze zapsané docházky — má datum i částku)
  const coachCostPeriod = filteredCoachAttendance.reduce((s, a) => s + Number(a.amount || 0), 0);

  // Výdaje (faktury v období)
  const expensesTotal = filteredInvoices.reduce((s, inv) => s + inv.amount, 0);
  const expensesPaid = filteredInvoices.filter((inv) => inv.paid).reduce((s, inv) => s + inv.amount, 0);
  const expensesOverdue = filteredInvoices.filter((inv) => !inv.paid && inv.dueDate < today);

  // Výplaty trenérů (celkový odhad — base+bonusy, nejsou vázané na datum)
  const coachPayoutTotal = coaches.reduce((s, c) => s + payoutAmountForCoach(c, coachAttendanceRecords), 0);
  const periodCoachPayout = allTime ? coachPayoutTotal : coachCostPeriod;

  // Nájem tělocvičen: klíč lokality = město bez diakritiky (sjednocuje platby
  // "Kroužek Vyškov", docházku "Vyškov · ZŠ …" i produkty). Nájem = konané
  // tréninky v období × délka lekce × sazba Kč/h dané lokality (odhad dle rozvrhu).
  const cityLabelOf = (title: string): string => {
    const t = (title || '').trim();
    if (!t) return '—';
    if (t.includes('·')) return (t.split('·')[0] || t).trim();
    const m = t.match(/^(?:Krou[žz]ek|T[áa]bor|Workshop)\s+(.+)$/i);
    return ((m ? m[1] : t).split(/\s[–-]\s/)[0] || t).trim();
  };
  const cityKeyOf = (title: string): string => normalizeText(cityLabelOf(title));

  const krouzky = uniqueParticipantProducts(products).filter((p) => p.type === 'Krouzek');
  const labelByKey = new Map<string, string>();
  const venueLabelByKey = new Map<string, string>();
  for (const p of krouzky) {
    const ck = normalizeText(p.city); if (ck && !labelByKey.has(ck)) labelByKey.set(ck, p.city);
    const vk = normalizeText(p.place || p.venue || p.city); if (vk && !venueLabelByKey.has(vk)) venueLabelByKey.set(vk, p.place || p.venue || p.city);
  }

  const sessionHours = (primaryMeta: string): number => {
    const m = primaryMeta.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
    if (!m) return 1;
    const diff = (Number(m[3]) * 60 + Number(m[4]) - Number(m[1]) * 60 - Number(m[2])) / 60;
    return diff > 0 ? diff : 1;
  };
  const rentBounds = (() => {
    const todayD = new Date(); todayD.setHours(0, 0, 0, 0);
    const clampEnd = (d: Date) => (d > todayD ? todayD : d);
    if (periodMode === 'month') {
      if (month === null) return { start: new Date(year, 0, 1), end: clampEnd(new Date(year, 11, 31)) };
      return { start: new Date(year, month, 1), end: clampEnd(new Date(year, month + 1, 0)) };
    }
    if (periodMode === 'range') {
      if (!rangeFrom && !rangeTo) return null;
      return { start: rangeFrom ? new Date(rangeFrom) : new Date(2020, 0, 1), end: clampEnd(rangeTo ? new Date(rangeTo) : todayD) };
    }
    const dates = [...paidRows.map((r) => isoOf(r.dueDate)), ...coachAttendanceRecords.map((a) => isoOf(a.date))].filter(Boolean) as string[];
    const earliest = dates.length ? dates.slice().sort()[0] : todayD.toISOString().slice(0, 10);
    return { start: new Date(earliest), end: todayD };
  })();
  const rentByLocation = (() => {
    const map = new Map<string, number>();
    if (!rentBounds) return map;
    const start = new Date(rentBounds.start); start.setHours(0, 0, 0, 0);
    const end = new Date(rentBounds.end); end.setHours(0, 0, 0, 0);
    if (end < start) return map;
    const holidays = new Set<string>();
    for (let y = start.getFullYear() - 1; y <= end.getFullYear(); y++) for (const d of czechHolidaySetWeb(y)) holidays.add(d);
    for (const p of krouzky) {
      const cityKey = normalizeText(p.city);
      const venueKey = normalizeText(p.place || p.venue || p.city);
      const rate = gymRates[venueKey] ?? 0;
      if (!rate) continue;
      const weekdays = slotDayIndicesWeb(parseCourseSchedule(p.primaryMeta).day);
      if (weekdays.length === 0) continue;
      const hours = sessionHours(p.primaryMeta);
      let occ = 0;
      const d = new Date(start); let guard = 0;
      while (d <= end && guard < 4000) {
        const czIdx = (d.getDay() + 6) % 7;
        if (weekdays.includes(czIdx) && !holidays.has(dateKeyWeb(d))) occ++;
        d.setDate(d.getDate() + 1); guard++;
      }
      map.set(cityKey, (map.get(cityKey) ?? 0) + occ * hours * rate);
    }
    return map;
  })();
  const totalRent = Array.from(rentByLocation.values()).reduce((s, v) => s + v, 0);

  // Výdaje celkem = faktury + náklady na trenéry + nájem tělocvičen
  const totalExpenses = expensesTotal + periodCoachPayout + totalRent;
  const invoiceCategoryTotals = [...new Set(filteredInvoices.map((inv) => inv.category).filter(Boolean))]
    .map((cat) => ({ label: cat, value: filteredInvoices.filter((inv) => inv.category === cat).reduce((s, inv) => s + inv.amount, 0) }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
  const expenseBreakdown = [
    ...invoiceCategoryTotals,
    ...(periodCoachPayout > 0 ? [{ label: 'Výplaty trenérů', value: periodCoachPayout }] : []),
    ...(totalRent > 0 ? [{ label: 'Nájem tělocvičen', value: totalRent }] : []),
  ];

  // Čistý zisk = příjmy − (zaplacené faktury + náklady na trenéry + nájem)
  const cashFlow = revenueTotal - expensesPaid - periodCoachPayout - totalRent;

  // Top 5 nezaplacených od rodičů (v období)
  const unpaidParents = filteredPaymentRows.filter((r) => !isPaidStatus(r.status)).slice(0, 5);

  // Finance podle lokality (příjmy, trenéři, nájem, čistý zisk)
  const locationPnL = (() => {
    const map = new Map<string, { key: string; location: string; income: number; coachCost: number; rent: number; count: number }>();
    const ensure = (key: string, label: string) => {
      let e = map.get(key);
      if (!e) { e = { key, location: labelByKey.get(key) || label, income: 0, coachCost: 0, rent: 0, count: 0 }; map.set(key, e); }
      return e;
    };
    for (const r of paidRows) { const e = ensure(cityKeyOf(r.title), cityLabelOf(r.title)); e.income += Number(r.amount || 0); e.count += 1; }
    for (const a of filteredCoachAttendance) { const e = ensure(cityKeyOf(a.sessionTitle), cityLabelOf(a.sessionTitle)); e.coachCost += Number(a.amount || 0); }
    for (const [key, rent] of rentByLocation) { const e = ensure(key, labelByKey.get(key) || key); e.rent += rent; }
    return Array.from(map.values()).map((e) => ({ ...e, net: e.income - e.coachCost - e.rent })).sort((a, b) => b.net - a.net);
  })();
  const topLocation = locationPnL[0] ?? null;
  const maxLocationValue = Math.max(1, ...locationPnL.map((l) => Math.max(l.income, Math.abs(l.net))));
  const rentLocations = Array.from(venueLabelByKey.entries()).map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label, 'cs'));

  return (
    <div className="space-y-5">
      {/* Přepínání období */}
      <Panel className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wide text-brand-ink-soft">Období</span>
            {([
              { key: 'month', label: 'Podle měsíce' },
              { key: 'range', label: 'Rozsah od–do' },
              { key: 'all', label: 'Celkově' },
            ] as { key: FinancePeriodMode; label: string }[]).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPeriodMode(opt.key)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-black transition ${periodMode === opt.key ? 'bg-brand-purple text-white shadow-sm' : 'bg-brand-paper text-brand-purple hover:bg-brand-purple/10'}`}
              >
                {opt.label}
              </button>
            ))}
            <span className="ml-auto rounded-full bg-brand-purple/5 px-3 py-1.5 text-[11px] font-black text-brand-purple-deep">{periodLabel}</span>
          </div>

          {periodMode === 'month' ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-full bg-brand-paper px-1 py-0.5">
                <button type="button" onClick={() => setYear((y) => y - 1)} className="flex h-7 w-7 items-center justify-center rounded-full text-brand-purple transition hover:bg-brand-purple/10" aria-label="Předchozí rok">
                  <ChevronDown size={14} className="rotate-90" />
                </button>
                <span className="min-w-[48px] text-center text-sm font-black text-brand-purple-deep">{year}</span>
                <button type="button" onClick={() => setYear((y) => y + 1)} className="flex h-7 w-7 items-center justify-center rounded-full text-brand-purple transition hover:bg-brand-purple/10" aria-label="Další rok">
                  <ChevronDown size={14} className="-rotate-90" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setMonth(null)}
                className={`rounded-full px-3 py-1.5 text-xs font-black transition ${month === null ? 'bg-brand-purple text-white' : 'bg-brand-paper text-brand-purple hover:bg-brand-purple/10'}`}
              >
                Celý rok
              </button>
              <div className="flex flex-wrap gap-1">
                {CZECH_MONTH_ABBR.map((abbr, idx) => (
                  <button
                    key={abbr}
                    type="button"
                    onClick={() => setMonth(idx)}
                    className={`rounded-full px-2.5 py-1.5 text-xs font-black transition ${month === idx ? 'bg-brand-purple text-white' : 'bg-brand-paper text-brand-ink-soft hover:bg-brand-purple/10 hover:text-brand-purple'}`}
                  >
                    {abbr}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {periodMode === 'range' ? (
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-black uppercase tracking-wide text-brand-ink-soft">Od</span>
                <input type="date" value={rangeFrom} max={rangeTo || undefined} onChange={(e) => setRangeFrom(e.target.value)} className="rounded-[12px] border border-brand-purple/20 bg-white px-3 py-2 text-sm font-bold text-brand-ink outline-none focus:border-brand-purple" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-black uppercase tracking-wide text-brand-ink-soft">Do</span>
                <input type="date" value={rangeTo} min={rangeFrom || undefined} onChange={(e) => setRangeTo(e.target.value)} className="rounded-[12px] border border-brand-purple/20 bg-white px-3 py-2 text-sm font-bold text-brand-ink outline-none focus:border-brand-purple" />
              </label>
              {(rangeFrom || rangeTo) ? (
                <button type="button" onClick={() => { setRangeFrom(''); setRangeTo(''); }} className="rounded-full bg-brand-paper px-3 py-1.5 text-xs font-black text-brand-purple transition hover:bg-brand-purple/10">Vymazat</button>
              ) : null}
            </div>
          ) : null}
        </div>
      </Panel>

      {/* Hlavní metriky */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Příjmy celkem',
            value: `${revenueTotal.toLocaleString('cs-CZ')} Kč`,
            sub: `${paidCount}× zaplaceno · ${periodLabel}`,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
            icon: <TrendingUp size={20} className="text-emerald-600" />,
            onClick: () => onNavigate('payouts'),
          },
          {
            label: 'Čekající platby',
            value: `${revenuePending.toLocaleString('cs-CZ')} Kč`,
            sub: `${paymentRows.filter((r) => !isPaidStatus(r.status)).length} nezaplacených`,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            icon: <Banknote size={20} className="text-amber-600" />,
            onClick: () => onNavigate('payouts'),
          },
          {
            label: 'Výdaje celkem',
            value: `${totalExpenses.toLocaleString('cs-CZ')} Kč`,
            sub: `${expensesTotal.toLocaleString('cs-CZ')} Kč faktury · ${periodCoachPayout.toLocaleString('cs-CZ')} Kč trenéři`,
            color: 'text-brand-pink',
            bg: 'bg-brand-pink/5',
            border: 'border-brand-pink/20',
            icon: <TrendingDown size={20} className="text-brand-pink" />,
            onClick: () => onNavigate('invoices'),
          },
          {
            label: 'Odhadovaný zůstatek',
            value: `${cashFlow.toLocaleString('cs-CZ')} Kč`,
            sub: `po výdajích a výplatách`,
            color: cashFlow >= 0 ? 'text-brand-purple-deep' : 'text-brand-pink',
            bg: cashFlow >= 0 ? 'bg-brand-purple/5' : 'bg-brand-pink/5',
            border: cashFlow >= 0 ? 'border-brand-purple/15' : 'border-brand-pink/20',
            icon: <BarChart2 size={20} className={cashFlow >= 0 ? 'text-brand-purple' : 'text-brand-pink'} />,
            onClick: undefined,
          },
        ].map((card) => (
          <div key={card.label} role={card.onClick ? 'button' : undefined} tabIndex={card.onClick ? 0 : undefined} onClick={card.onClick} onKeyDown={card.onClick ? (e) => { if (e.key === 'Enter') card.onClick?.(); } : undefined} className={`cursor-default ${card.onClick ? 'cursor-pointer' : ''}`}>
            <Panel className={`h-full p-5 transition ${card.onClick ? 'hover:shadow-md' : ''}`}>
            <div className="flex items-center justify-between gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-[12px] border ${card.border} ${card.bg}`}>
                {card.icon}
              </div>
              <p className="text-right text-[11px] font-bold text-brand-ink-soft">{card.label}</p>
            </div>
            <p className={`mt-3 text-2xl font-black ${card.color}`}>{card.value}</p>
            <p className="mt-0.5 text-xs font-bold text-brand-ink-soft">{card.sub}</p>
          </Panel>
          </div>
        ))}
      </div>

      {/* Nájem tělocvičen */}
      <Panel className="p-5">
        <SectionTitle icon={<Banknote size={18} />} title="Nájem tělocvičen" subtitle="kolik platíš za hodinu — odečte se z každého konaného tréninku" />
        {rentLocations.length === 0 ? (
          <EmptyState text="Zatím žádné kroužky s lokalitou." />
        ) : (
          <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {rentLocations.map((loc) => (
              <div key={loc.key} className="flex items-center justify-between gap-3 rounded-[14px] border border-brand-purple/10 bg-white px-4 py-2.5">
                <span className="min-w-0 truncate text-sm font-black text-brand-ink">{loc.label}</span>
                <div className="flex items-center gap-1.5">
                  <input
                    inputMode="numeric"
                    value={rentDraft[loc.key] ?? ''}
                    placeholder="0"
                    onChange={(e) => setRentDraft((prev) => ({ ...prev, [loc.key]: e.target.value.replace(/[^0-9]/g, '') }))}
                    className="w-24 rounded-[10px] border border-brand-purple/20 bg-white px-2.5 py-1.5 text-right text-sm font-bold text-brand-ink outline-none focus:border-brand-purple"
                  />
                  <span className="text-xs font-bold text-brand-ink-soft">Kč/h</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] font-bold text-brand-ink-soft">Nájem = počet konaných tréninků v období × délka lekce × sazba. Zadej jen čísla (Kč/h) a ulož.</p>
            <div className="flex items-center gap-3">
              {rentStatus === 'saved' ? <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-600"><CheckCircle2 size={15} /> Uloženo</span> : null}
              <button type="button" onClick={saveAllGymRates} disabled={rentStatus === 'saving'} className="rounded-[14px] bg-brand-purple px-5 py-2.5 text-sm font-black text-white transition hover:bg-brand-purple-deep disabled:opacity-60">
                {rentStatus === 'saving' ? 'Ukládám…' : 'Uložit sazby'}
              </button>
            </div>
          </div>
          </>
        )}
      </Panel>

      {/* Finance podle lokality */}
      <Panel className="p-5">
        <SectionTitle icon={<MapPin size={18} />} title="Finance podle lokality" subtitle="příjmy, trenéři, nájem a čistý zisk za zvolené období" />
        {locationPnL.length === 0 ? (
          <EmptyState text="Zatím žádná data pro toto období." />
        ) : (
          <div className="mt-4 space-y-4">
            {topLocation ? (
              <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-wide text-emerald-600">Nejvyšší čistý zisk</p>
                <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-lg font-black text-brand-ink">{topLocation.location}</p>
                  <p className="text-2xl font-black text-emerald-600">{topLocation.net.toLocaleString('cs-CZ')} Kč</p>
                </div>
                <p className="mt-0.5 text-xs font-bold text-brand-ink-soft">příjmy {topLocation.income.toLocaleString('cs-CZ')} Kč · trenéři {topLocation.coachCost.toLocaleString('cs-CZ')} Kč · nájem {topLocation.rent.toLocaleString('cs-CZ')} Kč</p>
              </div>
            ) : null}
            <div className="space-y-3">
              {locationPnL.map((loc) => {
                const pct = Math.round((Math.max(loc.net, 0) / maxLocationValue) * 100);
                return (
                  <div key={loc.key} className="rounded-[16px] border border-brand-purple/10 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-black text-brand-ink">{loc.location}</span>
                      <span className="shrink-0 text-xs font-bold text-brand-ink-soft">{loc.count}× platba</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-[10px] bg-emerald-50 px-2.5 py-1.5">
                        <p className="text-[10px] font-black uppercase text-emerald-600">Příjmy</p>
                        <p className="text-sm font-black text-emerald-700">{loc.income.toLocaleString('cs-CZ')} Kč</p>
                      </div>
                      <div className="rounded-[10px] bg-brand-pink/5 px-2.5 py-1.5">
                        <p className="text-[10px] font-black uppercase text-brand-pink">Trenéři</p>
                        <p className="text-sm font-black text-brand-pink">{loc.coachCost.toLocaleString('cs-CZ')} Kč</p>
                      </div>
                      <div className="rounded-[10px] bg-amber-50 px-2.5 py-1.5">
                        <p className="text-[10px] font-black uppercase text-amber-600">Nájem</p>
                        <p className="text-sm font-black text-amber-700">{loc.rent.toLocaleString('cs-CZ')} Kč</p>
                      </div>
                      <div className={`rounded-[10px] px-2.5 py-1.5 ${loc.net >= 0 ? 'bg-brand-purple/5' : 'bg-brand-pink/10'}`}>
                        <p className="text-[10px] font-black uppercase text-brand-purple-deep">Čistý zisk</p>
                        <p className={`text-sm font-black ${loc.net >= 0 ? 'text-brand-purple-deep' : 'text-brand-pink'}`}>{loc.net.toLocaleString('cs-CZ')} Kč</p>
                      </div>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-paper">
                      <div className="h-full rounded-full bg-brand-purple transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] font-bold text-brand-ink-soft">Trenéři = zapsaná docházka trenérů. Nájem = odhad podle konaných tréninků v rozvrhu × sazba tělocvičny. Faktury (ostatní provozní náklady) najdeš v celkových výdajích.</p>
          </div>
        )}
      </Panel>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Příjmy – rozpad */}
        <Panel className="flex flex-col p-5 self-stretch">
          <SectionTitle icon={<TrendingUp size={18} />} title="Příjmy" subtitle="platby od rodičů" />
          <div className="mt-4 flex-1 space-y-2">
            {[
              { label: 'Zaplaceno', value: revenueTotal, color: 'bg-emerald-500' },
              { label: 'Čekající', value: revenuePending, color: 'bg-amber-400' },
            ].map((row) => {
              const pct = revenueTotal + revenuePending > 0 ? (row.value / (revenueTotal + revenuePending)) * 100 : 0;
              return (
                <div key={row.label}>
                  <div className="mb-1 flex justify-between text-xs font-bold text-brand-ink">
                    <span>{row.label}</span>
                    <span>{row.value.toLocaleString('cs-CZ')} Kč</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-brand-paper">
                    <div className={`h-full rounded-full ${row.color} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => onNavigate('payouts')} className="mt-4 w-full rounded-[14px] bg-brand-paper py-2 text-xs font-black text-brand-purple transition hover:bg-brand-purple hover:text-white">
            Detail plateb →
          </button>
        </Panel>

        {/* Výdaje – rozpad */}
        <Panel className="flex flex-col p-5 self-stretch">
          <SectionTitle icon={<Receipt size={18} />} title="Výdaje" subtitle="faktury a výplaty trenérů" />
          <div className="mt-4 flex-1 space-y-2">
            {expenseBreakdown.map((row, i) => {
              const palette = ['bg-brand-purple', 'bg-brand-cyan', 'bg-brand-pink', 'bg-brand-ink-soft'];
              const color = row.label === 'Výplaty trenérů' ? 'bg-brand-purple-deep' : palette[i % palette.length];
              const pct = totalExpenses > 0 ? (row.value / totalExpenses) * 100 : 0;
              return (
                <div key={row.label}>
                  <div className="mb-1 flex justify-between text-xs font-bold text-brand-ink">
                    <span>{row.label}</span>
                    <span>{row.value.toLocaleString('cs-CZ')} Kč</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-brand-paper">
                    <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {expenseBreakdown.length === 0 ? <p className="text-xs font-bold text-brand-ink-soft">Zatím žádné výdaje.</p> : null}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-[12px] border border-brand-pink/20 bg-brand-pink/5 px-3 py-2.5">
            <p className="text-sm font-black text-brand-ink">Výdaje celkem</p>
            <p className="text-sm font-black text-brand-pink">{totalExpenses.toLocaleString('cs-CZ')} Kč</p>
          </div>
          {expensesOverdue.length > 0 ? (
            <div className="mt-4 rounded-[12px] border border-brand-pink/25 bg-brand-pink/5 px-3 py-2">
              <p className="text-xs font-black text-brand-pink">{expensesOverdue.length}× faktura po splatnosti</p>
              <p className="text-[11px] font-bold text-brand-ink-soft">{expensesOverdue.map((inv) => inv.supplier).join(', ')}</p>
            </div>
          ) : (
            <div className="mt-4 rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-xs font-black text-emerald-600">Žádné faktury po splatnosti ✓</p>
            </div>
          )}
          <button type="button" onClick={() => onNavigate('invoices')} className="mt-3 w-full rounded-[14px] bg-brand-paper py-2 text-xs font-black text-brand-purple transition hover:bg-brand-purple hover:text-white">
            Detail faktur →
          </button>
        </Panel>

        {/* Výplaty trenérů */}
        <Panel className="flex flex-col p-5 self-stretch">
          <SectionTitle icon={<Banknote size={18} />} title="Výplaty trenérů" subtitle="odhad za aktuální období" />
          <div className="mt-4 flex-1 space-y-2">
            {coaches.slice(0, 6).map((coach) => {
              const amount = payoutAmountForCoach(coach, coachAttendanceRecords);
              return (
                <div key={coach.id} className="flex items-center justify-between rounded-[10px] bg-brand-paper px-3 py-2">
                  <p className="text-sm font-bold text-brand-ink">{coach.name}</p>
                  <p className="text-sm font-black text-brand-ink">{amount.toLocaleString('cs-CZ')} Kč</p>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-[12px] border border-brand-purple/15 bg-brand-purple/5 px-3 py-2.5">
            <p className="text-sm font-black text-brand-ink">Celkem trenéři</p>
            <p className="text-sm font-black text-brand-purple-deep">{coachPayoutTotal.toLocaleString('cs-CZ')} Kč</p>
          </div>
          <button type="button" onClick={() => onNavigate('payouts')} className="mt-3 w-full rounded-[14px] bg-brand-paper py-2 text-xs font-black text-brand-purple transition hover:bg-brand-purple hover:text-white">
            Spravovat výplaty →
          </button>
        </Panel>
      </div>

      {/* Nezaplacení rodiče */}
      {unpaidParents.length > 0 ? (
        <Panel className="p-5">
          <SectionTitle icon={<ListChecks size={18} />} title="Čekající platby rodičů" subtitle="nejbližší nezaplacené položky" />
          <div className="mt-4 grid gap-2">
            {unpaidParents.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-amber-200 bg-amber-50/60 px-4 py-3">
                <div>
                  <p className="text-sm font-black text-brand-ink">{row.participantName}</p>
                  <p className="text-xs font-bold text-brand-ink-soft">{row.title}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-amber-700">{Number(row.amount).toLocaleString('cs-CZ')} Kč</p>
                  {row.dueDate ? <p className="text-[11px] font-bold text-brand-ink-soft">splatnost: {row.dueDate}</p> : null}
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => onNavigate('payouts')} className="mt-3 w-full rounded-[14px] bg-brand-paper py-2 text-xs font-black text-brand-purple transition hover:bg-brand-purple hover:text-white">
            Zobrazit všechny platby →
          </button>
        </Panel>
      ) : null}

      {/* Historie plateb (sbalitelná, má vlastní filtr nezávislý na období výše) */}
      <div>
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="flex w-full items-center justify-between rounded-[16px] border border-brand-purple/10 bg-white px-5 py-3 text-sm font-black text-brand-purple transition hover:bg-brand-purple/5"
        >
          <span className="flex items-center gap-2"><History size={16} /> {showHistory ? 'Skrýt historii plateb' : 'Zobrazit historii plateb'}</span>
          <ChevronDown size={16} className={`transition-transform duration-300 ${showHistory ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence initial={false}>
          {showHistory ? (
            <motion.div
              key="payment-history"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div className="mt-4">
                <PaymentHistorySection paymentRows={paymentRows} isVysOrg={isVysOrg} />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function headlineForSection(section: SectionKey) {
  switch (section) {
    case 'attendance':
      return 'Docházka všech kroužků a účastníků';
    case 'participants':
      return 'Celý seznam dětí, nákupů a dokumentů';
    case 'products':
      return 'Produkty pro web a rodiče';
    case 'coaches':
      return 'Trenéři, lokality a výkon';
    case 'payouts':
      return 'Výplaty za měsíc přes Stripe';
    case 'finance':
      return 'Cash flow, příjmy, výdaje a výplaty na jednom místě';
    case 'registry':
      return 'Registr všech účastníků od spštení';
    default:
      return 'Provozní přehled bez zbytečností';
  }
}