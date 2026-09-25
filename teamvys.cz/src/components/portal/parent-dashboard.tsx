'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
    AlertTriangle,
    ArrowRight,
    BadgePercent,
    Bell,
    Building2,
    Camera,
    Check,
    CheckCircle2,
    ChevronDown,
    CreditCard,
    FileCheck2,
    FileDown,
    History,
    LayoutDashboard,
    MapPin,
    MessageSquareText,
    PackageCheck,
    Phone,
    Plus,
    QrCode,
    RefreshCw,
    Search,
    ShieldCheck,
    Star,
    UserPlus,
    Users,
    WalletCards,
    X,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { EmbeddedPaymentForm } from '@/components/checkout/embedded-payment-form';
import { useAdminCreatedProducts } from '@/lib/admin-created-products';
import { confirmEmbeddedPaymentIntent, createEmbeddedPaymentIntent, createManualParticipantProfile, joinParentOrganization, leaveParentOrganization, linkParticipantByClaimCode, registerWorkshopInterest, saveCourseDocuments } from '@/lib/api-client';
import {
    applyRewardDiscount,
    findRewardDiscountByCode,
    markRewardDiscountUsed,
    readUsedRewardDiscountIds,
    rewardDiscountCodesForParticipant,
    rewardDiscountCodesForParticipants,
    type RewardDiscountCode,
} from '@/lib/monthly-rewards';
import {
    activityLabel,
    adminCoachSummaries,
    coachReviews,
    linkedParticipants,
    parentAttendanceHistory,
    parentDigitalPasses,
    parentDocuments,
    parentNotifications,
    parentPayments,
    parentProducts,
    paymentStatusLabel,
    requiredDocumentsForProduct,
    trainersForProduct,
    type ActivityType,
    type DocumentStatus,
    type ParentDocument,
    type ParentOrganizations,
    type ParentParticipant,
    type ParentPayment,
    type ParentProduct,
    type ParentProductTrainer,
    type RequiredDocumentTemplate,
} from '@/lib/portal-content';
import { parseScheduleDays, parseScheduleTime } from '@/lib/schedule-days';
import { createBrowserSupabaseClient, hasSupabaseBrowserConfig } from '@/lib/supabase/browser';
import { useFeatureFlags } from '@/lib/use-feature-flags';

type SectionKey = 'overview' | 'participants' | 'payments' | 'organizations' | 'documents' | 'profile';
const VYS_ORG_ID = '00000000-0000-4000-8000-000000000001';

type ProductGroup = {
  id: string;
  type: ActivityType;
  title: string;
  city: string;
  place: string;
  venue: string;
  primaryMeta: string;
  secondaryMeta: string;
  description: string;
  badge: string;
  heroImage: string;
  gallery: string[];
  capacityTotal: number;
  capacityCurrent: number;
  interestCount: number;
  canPurchase?: boolean;
  importantInfo: ParentProduct['importantInfo'];
  trainingFocus: string[];
  trainers: ParentProductTrainer[];
  variants: ParentProduct[];
  orgId?: string;
  orgName?: string;
};

type DocumentFormValues = {
  parentName: string;
  emergencyPhone: string;
  emergencyPhone2Name: string;
  emergencyPhone2: string;
  insuranceCompany: string;
  insuranceNumber: string;
  chronicDiseases: string;
  healthLimits: string;
  allergies: string;
  medication: string;
  medicationSchedule: string;
  canSwim: string;
  tetanus: string;
  pickupPeople: string;
  notes: string;
  gdprConsent: boolean;
  guardianConsent: boolean;
  healthAccuracy: boolean;
  departureConsent: boolean;
  infectionFree: boolean;
  packingConfirmed: boolean;
  photoConsent: boolean;
  workshopTermsAccepted: boolean;
};

type PurchaseFlow = {
  mode: 'purchase' | 'documents';
  group: ProductGroup;
  selectedProductId: string;
  participantId: string;
  trainingDays: string[];
  discountCode: string;
  documentValues: DocumentFormValues;
  paymentClientSecret?: string;
  paymentIntentId?: string;
  paymentAmountLabel?: string;
  appliedRewardCodeId?: string;
  isSubmitting: boolean;
  message: string | null;
};

type ParentPortalDashboardProps = {
  displayName: string;
  displayEmail: string;
  parentProfileId?: string;
  initialData?: ParentPortalData | null;
};

export type ParentPortalData = {
  participants: ParentParticipant[];
  organizations: ParentOrganizations;
  products: ParentProduct[];
  payments: ParentPayment[];
  documents: ParentDocument[];
  digitalPasses: typeof parentDigitalPasses;
  notifications: typeof parentNotifications;
  attendanceHistory: typeof parentAttendanceHistory;
  coachReviews: typeof coachReviews;
  coaches: ParentProductTrainer[];
};

export const fallbackParentPortalData: ParentPortalData = {
  participants: linkedParticipants,
  organizations: { joined: [], available: [] },
  products: parentProducts,
  payments: parentPayments,
  documents: parentDocuments,
  digitalPasses: parentDigitalPasses,
  notifications: parentNotifications,
  attendanceHistory: parentAttendanceHistory,
  coachReviews,
  coaches: adminCoachSummaries.map((coach) => ({
    id: coach.id,
    name: coach.name,
    email: coach.email,
    phone: coach.phone,
    locations: coach.locations,
    qrTricksApproved: coach.qrTricksApproved,
    profilePhotoUrl: coach.profilePhotoUrl ?? '/vys-logo-mark.png',
  })),
};

const ParentPortalDataContext = createContext<ParentPortalData>(fallbackParentPortalData);

function useParentPortalData() {
  return useContext(ParentPortalDataContext);
}

const sections: Array<{ key: SectionKey; label: string; icon: React.ReactNode; description: string }> = [
  { key: 'overview', label: 'Přehled', icon: <LayoutDashboard size={18} />, description: 'stav rodiny' },
  { key: 'participants', label: 'Účastníci', icon: <Users size={18} />, description: 'děti a docházka' },
  { key: 'payments', label: 'Platby', icon: <WalletCards size={18} />, description: 'kroužky, tábory, workshopy' },
  { key: 'organizations', label: 'Organizace', icon: <Building2 size={18} />, description: 'tvé kluby a jejich nabídka' },
  { key: 'profile', label: 'Profil', icon: <UserPlus size={18} />, description: 'rodič a hodnocení' },
];

const paymentTypes: Array<{ key: ActivityType; label: string }> = [
  { key: 'Krouzek', label: 'Kroužky' },
  { key: 'Tabor', label: 'Tábory' },
  { key: 'Workshop', label: 'Workshopy' },
];
const WORKSHOP_INTEREST_THRESHOLD = 9;
const WORKSHOP_PAYMENT_OPEN_DAYS = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const BRAND_GRADIENT = 'bg-[linear-gradient(135deg,#6b3df5_0%,#e84cc4_55%,#ff8a3d_100%)]';

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function ParentPortalDashboard({ displayName, displayEmail, parentProfileId, initialData }: ParentPortalDashboardProps) {
  const basePortalData = initialData ?? fallbackParentPortalData;
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<SectionKey>('overview');
  const [selectedParticipantId, setSelectedParticipantId] = useState(basePortalData.participants[0]?.id ?? '');
  const [activeProductType, setActiveProductType] = useState<ActivityType>('Krouzek')
  const joinedOrgs = basePortalData.organizations?.joined ?? []
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(joinedOrgs[0]?.id ?? null);
  const [profileEmail, setProfileEmail] = useState(displayEmail);
  const [purchaseFlow, setPurchaseFlow] = useState<PurchaseFlow | null>(null);
  const [usedRewardCodeIds, setUsedRewardCodeIds] = useState<string[]>(readUsedRewardDiscountIds);
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);
  const [interestOverrides, setInterestOverrides] = useState<Record<string, number>>({});
  const [registeredInterestProductIds, setRegisteredInterestProductIds] = useState<Set<string>>(new Set());
  const { products: adminCreatedProducts } = useAdminCreatedProducts('parent');

  const portalData = useMemo<ParentPortalData>(() => ({
    ...basePortalData,
    products: mergeProducts(basePortalData.products, adminCreatedProducts).map((product) => {
      const overriddenInterestCount = interestOverrides[product.id];
      return product.type === 'Workshop' && typeof overriddenInterestCount === 'number'
        ? { ...product, interestCount: overriddenInterestCount }
        : product;
    }),
  }), [basePortalData, adminCreatedProducts, interestOverrides]);
  const participants = portalData.participants;
  const availableProducts = portalData.products;
  const productGroups = useMemo(() => {
    const filtered = selectedOrgId && joinedOrgs.length > 1
      ? portalData.products.filter((p) => p.orgId === selectedOrgId)
      : portalData.products
    return buildProductGroups(filtered, portalData.coaches)
  }, [portalData.products, portalData.coaches, selectedOrgId, joinedOrgs.length]);
  const earnedRewardCodes = useMemo(() => rewardDiscountCodesForParticipants(participants, usedRewardCodeIds), [participants, usedRewardCodeIds]);
  const selectedParticipant = participants.find((participant) => participant.id === selectedParticipantId) ?? participants[0];
  const activeParticipantName = selectedParticipant ? `${selectedParticipant.firstName} ${selectedParticipant.lastName}` : 'účastník';

  function markCodeUsed(codeId: string) {
    setUsedRewardCodeIds(markRewardDiscountUsed(codeId));
  }

  function openPurchaseFlow(group: ProductGroup) {
    const defaultProduct = group.variants.find((variant) => variant.entriesTotal === 10) ?? group.variants[0];
    const defaultParticipant = selectedParticipant?.id ?? participants[0]?.id ?? '';

    setPurchaseFlow({
      mode: 'purchase',
      group,
      selectedProductId: defaultProduct.id,
      participantId: defaultParticipant,
      trainingDays: [],
      discountCode: '',
      documentValues: defaultDocumentValues(displayName),
      isSubmitting: false,
      message: null,
    });
  }

  async function handleWorkshopInterest(group: ProductGroup) {
    const selectedProduct = group.variants[0];
    if (!selectedProduct) return;

    if (!selectedParticipant) {
      setCatalogMessage('Nejdřív přidej nebo vyber účastníka, za kterého chceš dát zájem o workshop.');
      return;
    }

    try {
      setCatalogMessage(null);
      const result = await registerWorkshopInterest({
        parentProfileId,
        productId: selectedProduct.id,
        participantId: selectedParticipant.id,
        participantName: `${selectedParticipant.firstName} ${selectedParticipant.lastName}`,
      });
      setInterestOverrides((current) => ({ ...current, [selectedProduct.id]: result.interestCount }));
      setRegisteredInterestProductIds((current) => new Set([...current, selectedProduct.id]));

      if (result.canPurchase) {
        setCatalogMessage(`Zájem je uložený. Workshop má ${result.interestCount} zájemců, takže už jde zaplatit.`);
        openPurchaseFlow({
          ...group,
          interestCount: result.interestCount,
          canPurchase: true,
          variants: group.variants.map((variant) => variant.id === selectedProduct.id ? { ...variant, interestCount: result.interestCount, canPurchase: true } : variant),
        });
        return;
      }

      setCatalogMessage(`Zájem je uložený. U tohoto workshopu je teď ${result.interestCount}/${result.threshold} zájemců; platba se otevře 2 dny před termínem nebo při ${result.threshold} zájemcích.`);
    } catch (error) {
      setCatalogMessage(error instanceof Error ? error.message : 'Zájem se nepodařilo uložit.');
    }
  }

  async function handleCheckout() {
    if (!purchaseFlow) return;

    const selectedProduct = purchaseFlow.group.variants.find((variant) => variant.id === purchaseFlow.selectedProductId);
    const participant = participants.find((item) => item.id === purchaseFlow.participantId);

    if (!selectedProduct || !participant) {
      setPurchaseFlow({ ...purchaseFlow, message: 'Vyber prosím variantu i účastníka.' });
      return;
    }

    const requiredDocuments = requiredDocumentsForProduct(selectedProduct);
    const documentError = validateRequiredDocuments(selectedProduct, purchaseFlow.documentValues, requiredDocuments);
    if (documentError) {
      setPurchaseFlow({ ...purchaseFlow, message: documentError });
      return;
    }

    const appliedDiscount = purchaseFlow.discountCode.trim()
      ? findRewardDiscountByCode(purchaseFlow.discountCode, selectedProduct.type, participant, usedRewardCodeIds)
      : null;

    if (purchaseFlow.discountCode.trim() && !appliedDiscount) {
      setPurchaseFlow({ ...purchaseFlow, message: 'Tenhle slevový kód nejde použít pro vybraný produkt nebo už byl použitý.' });
      return;
    }

    const scheduleDays = selectedProduct.type === 'Krouzek' ? parseScheduleDays(selectedProduct.primaryMeta) : [];
    const hasDayChoice = scheduleDays.length >= 2;
    if (hasDayChoice && purchaseFlow.trainingDays.length === 0) {
      setPurchaseFlow({ ...purchaseFlow, message: `Vyber prosím tréninkové dny — ${scheduleDays.join(', ')} nebo oba. Cena je stejná.` });
      return;
    }

    setPurchaseFlow({ ...purchaseFlow, isSubmitting: true, message: null });

    try {
      await saveRequiredDocuments(selectedProduct, participant, purchaseFlow.documentValues, requiredDocuments, parentProfileId);

      if (purchaseFlow.mode === 'documents') {
        setPurchaseFlow({
          ...purchaseFlow,
          isSubmitting: false,
          message: 'Dokumenty jsou uložené. Po napojení na živá data se stav rovnou propíše v seznamu.',
        });
        return;
      }

      const paymentIntent = await createEmbeddedPaymentIntent({
        parentProfileId,
        productId: selectedProduct.id,
        participantId: participant.id,
        participantName: `${participant.firstName} ${participant.lastName}`,
        receiptEmail: profileEmail,
        discountCode: appliedDiscount?.code,
        trainingDays: hasDayChoice ? purchaseFlow.trainingDays : undefined,
      });

      setPurchaseFlow({
        ...purchaseFlow,
        isSubmitting: false,
        paymentClientSecret: paymentIntent.clientSecret,
        paymentIntentId: paymentIntent.paymentIntentId,
        paymentAmountLabel: formatCurrency(paymentIntent.amount),
        appliedRewardCodeId: appliedDiscount?.id,
        message: 'Dokumenty jsou uložené. Teď potvrď kartu přímo tady na webu.',
      });
    } catch (error) {
      setPurchaseFlow({
        ...purchaseFlow,
        isSubmitting: false,
        message: error instanceof Error ? friendlyBackendError(error.message) : 'Platbu se nepodařilo připravit.',
      });
    }
  }

  async function handleEmbeddedPaymentPaid(paymentIntentId: string) {
    const result = await confirmEmbeddedPaymentIntent(paymentIntentId);
    setPurchaseFlow((current) => current ? {
      ...current,
      isSubmitting: false,
      paymentClientSecret: undefined,
      paymentIntentId: undefined,
      appliedRewardCodeId: undefined,
      message: `${result.purchase.title} pro ${result.purchase.participantName} je zaplacené a uložené v Supabase.`,
    } : current);
    if (purchaseFlow?.appliedRewardCodeId) markCodeUsed(purchaseFlow.appliedRewardCodeId);
    // Refresh the server-rendered portal data WITHOUT a full document reload so
    // the Supabase auth session/cookies are preserved (a hard reload was
    // logging the parent out right after paying).
    router.refresh();
  }

  return (
    <ParentPortalDataContext.Provider value={portalData}>
    <div className="grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
      <section className="fixed inset-x-2 bottom-2 z-50 self-start rounded-[22px] border border-neutral-200 bg-white p-1.5 shadow-md xl:sticky xl:inset-x-auto xl:bottom-auto xl:top-3 xl:rounded-2xl xl:border xl:border-neutral-200 xl:bg-white xl:p-4 xl:shadow-[0_4px_20px_rgba(0,0,0,0.08)] xl:overflow-hidden xl:self-start">
        <div className="flex items-center gap-2 xl:block">
          <div className="hidden xl:flex items-center gap-3 pb-4 border-b border-neutral-100">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-white shadow-[0_4px_10px_rgba(232,76,196,0.25)] ${BRAND_GRADIENT}`}>
              {initialsFromName(displayName)}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-600">Rodičovský portál</p>
              <p className="mt-0.5 text-[14px] font-semibold text-neutral-900 truncate">{displayName}</p>
            </div>
          </div>

          <nav className="grid min-w-0 flex-1 grid-cols-4 gap-1 xl:mt-3 xl:grid-cols-1 xl:gap-0.5">
          {sections.map((section) => {
            const isActive = activeSection === section.key;
            return (
              <button
                key={section.key}
                type="button"
                aria-label={section.label}
                title={section.label}
                onClick={() => setActiveSection(section.key)}
                className={`flex h-10 min-w-0 items-center justify-center gap-2 rounded-[12px] px-2 text-left transition-all sm:h-11 sm:px-3 xl:h-10 xl:justify-start xl:px-3 ${
                  isActive
                    ? 'bg-violet-600 font-semibold text-white shadow-[0_4px_12px_rgba(107,61,245,0.28)]'
                    : 'text-neutral-500 hover:bg-violet-50 hover:text-violet-700'
                }`}
              >
                <span className={`shrink-0 ${isActive ? 'text-white' : 'text-neutral-400'}`}>{section.icon}</span>
                <span className="hidden min-w-0 sm:block">
                  <span className="block truncate text-[11px] sm:text-xs xl:text-[13px]">{section.label}</span>
                </span>
              </button>
            );
          })}
          </nav>
        </div>
      </section>

      <main className="min-w-0 space-y-4 pb-36 xl:pb-0">
        <Header activeSection={activeSection} />

        {activeSection === 'overview' ? <OverviewSection rewardDiscounts={earnedRewardCodes} onNavigate={setActiveSection} /> : null}
        {activeSection === 'participants' ? (
          <ParticipantsSection
            selectedParticipantId={selectedParticipantId}
            displayName={displayName}
            parentProfileId={parentProfileId}
            availableProducts={availableProducts}
            onSelectParticipant={setSelectedParticipantId}
          />
        ) : null}
        {activeSection === 'payments' ? (
          <PaymentsSection
            activeProductType={activeProductType}
            productGroups={productGroups}
            selectedParticipant={selectedParticipant}
            rewardDiscounts={earnedRewardCodes}
            catalogMessage={catalogMessage}
            onProductTypeChange={setActiveProductType}
            onStartPurchase={openPurchaseFlow}
            onRegisterInterest={handleWorkshopInterest}
            registeredInterestProductIds={registeredInterestProductIds}
            organizations={joinedOrgs}
            selectedOrgId={selectedOrgId}
            onSelectOrg={setSelectedOrgId}
          />
        ) : null}
        {activeSection === 'profile' ? <ProfileSection displayName={displayName} displayEmail={profileEmail} parentProfileId={parentProfileId} participantName={activeParticipantName} onEmailChange={setProfileEmail} /> : null}
        {activeSection === 'organizations' ? (
          <OrganizationsSection organizations={portalData.organizations} parentProfileId={parentProfileId} onChanged={() => router.refresh()} />
        ) : null}
      </main>

      {purchaseFlow ? (
        <PurchaseWizard
          flow={purchaseFlow}
          usedRewardCodeIds={usedRewardCodeIds}
          onChange={setPurchaseFlow}
          onClose={() => setPurchaseFlow(null)}
          onCheckout={handleCheckout}
          onPaymentPaid={handleEmbeddedPaymentPaid}
        />
      ) : null}
    </div>
    </ParentPortalDataContext.Provider>
  );
}

function Header({ activeSection }: { activeSection: SectionKey }) {
  const { participants, digitalPasses } = useParentPortalData();
  const attendanceDone = participants.reduce((sum, participant) => sum + participant.attendanceDone, 0);
  const attendanceTotal = participants.reduce((sum, participant) => sum + participant.attendanceTotal, 0);
  const activePasses = digitalPasses.length;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-100 bg-[linear-gradient(135deg,#f3eeff_0%,#fff5f0_100%)] px-6 py-6 shadow-sm sm:px-8 sm:py-7">
      <div className={`pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full opacity-10 blur-xl ${BRAND_GRADIENT}`} />
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-violet-600">Rodičovský portál</p>
        <h1 className="mt-1.5 text-[26px] font-bold leading-tight tracking-tight text-neutral-900 sm:text-[30px]">{headlineForSection(activeSection)}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/70 bg-white/70 px-3 py-1 text-[13px] font-semibold text-neutral-700">
            <Users size={14} className="text-violet-600" />
            {participants.length} {participants.length === 1 ? 'dítě' : 'děti'}
          </span>
          {activePasses > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/70 bg-white/70 px-3 py-1 text-[13px] font-semibold text-neutral-700">
              <QrCode size={14} className="text-violet-600" />
              {activePasses} {activePasses === 1 ? 'pass' : 'passy'}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/70 bg-white/70 px-3 py-1 text-[13px] font-semibold text-neutral-700">
            Docházka rodiny <b className="font-bold text-violet-600">{attendanceDone}/{attendanceTotal}</b>
          </span>
        </div>
      </div>
    </div>
  );
}

function OverviewSection({ rewardDiscounts, onNavigate }: { rewardDiscounts: RewardDiscountCode[]; onNavigate: (section: SectionKey) => void }) {
  const { participants, notifications } = useParentPortalData();
  const { flags } = useFeatureFlags();

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <Panel className="p-5">
          <h2 className="text-[15px] font-medium text-neutral-900">Co řešit nejdřív</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <ActionTile icon={<Users size={18} />} label="Účastníci" value={`${participants.length} ${participants.length === 1 ? 'profil' : 'profily'}`} onClick={() => onNavigate('participants')} />
            <ActionTile icon={<WalletCards size={18} />} label="Platby" value="historie + nový nákup" onClick={() => onNavigate('payments')} />
            <ActionTile icon={<MessageSquareText size={18} />} label="Hodnocení" value="hvězdičky a zpětná vazba" onClick={() => onNavigate('profile')} />
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle icon={<Users size={18} />} title="Děti v rodině" subtitle="rychlý stav produktů, QR a docházky" />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {participants.map((participant) => (
              <div key={participant.id} className="rounded-xl border border-neutral-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(107,61,245,0.10)]">
                <div className="flex items-start gap-3">
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-base font-bold text-white ${BRAND_GRADIENT}`}>
                    {participant.firstName.charAt(0)}{participant.lastName.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[16px] font-semibold text-neutral-900">{participant.firstName} {participant.lastName}</h3>
                    <p className="mt-0.5 text-[13px] text-neutral-400 truncate">{participant.activeCourse}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700">Level {participant.level}</span>
                </div>
                <ProgressBar value={participant.xp} max={participant.nextBraceletXp} />
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  {flags.participant_wristbands ? <InfoPill label="Náramek" value={participant.bracelet} /> : null}
                  <InfoPill label="Docházka" value={`${participant.attendanceDone}/${participant.attendanceTotal}`} />
                </div>
              </div>
            ))}
            {participants.length === 0 ? (
              <div className="md:col-span-2 flex flex-col items-center gap-3 rounded-xl border border-dashed border-violet-200 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(243,238,255,0.7)_0%,rgba(255,255,255,0)_60%)] px-6 py-10 text-center">
                <span className={`grid h-16 w-16 place-items-center rounded-2xl text-white shadow-[0_10px_28px_rgba(232,76,196,0.3)] ${BRAND_GRADIENT}`}>
                  <UserPlus size={28} />
                </span>
                <h3 className="text-[18px] font-bold text-neutral-900">Začni přidáním dítěte</h3>
                <p className="max-w-sm text-sm text-neutral-500">Připoj svoje dítě a hned uvidíš jeho kurzy, docházku, QR průkazku a postup v levelech.</p>
                <button type="button" onClick={() => onNavigate('participants')} className="mt-1 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(107,61,245,0.3)] transition hover:-translate-y-0.5 hover:bg-violet-700">
                  <Plus size={18} /> Přidat dítě
                </button>
              </div>
            ) : null}
          </div>
        </Panel>
      </div>

      <div className="space-y-4">
        <RewardCodesPanel discounts={rewardDiscounts} />

        <Panel className="p-5">
          <SectionTitle icon={<Bell size={18} />} title="Upozornění" subtitle="poslední příchody zapsané přes NFC" />
          <div className="mt-4 space-y-2">
            {notifications.map((notification) => (
              <div key={notification.id} className="rounded-lg border border-neutral-200 p-4">
                <p className="text-sm text-neutral-900 leading-6">{notification.text}</p>
                <p className="mt-1 text-[12px] font-normal text-neutral-400">{notification.createdAt} · {notification.method}</p>
              </div>
            ))}
            {notifications.length === 0 ? <EmptyState text="Zatím tu nejsou žádná upozornění z docházky." /> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ParticipantsSection({
  selectedParticipantId,
  displayName,
  parentProfileId,
  availableProducts,
  onSelectParticipant,
}: {
  selectedParticipantId: string;
  displayName: string;
  parentProfileId?: string;
  availableProducts: ParentProduct[];
  onSelectParticipant: (id: string) => void;
}) {
  const { participants, payments, digitalPasses, attendanceHistory } = useParentPortalData();
  const participant = participants.find((item) => item.id === selectedParticipantId) ?? participants[0];

  if (!participant) {
    return (
      <div className="space-y-5">
        <AddParticipantPanel displayName={displayName} parentProfileId={parentProfileId} products={availableProducts} />
        <Panel className="p-5">
          <EmptyState text="Zatím tu není žádný účastník. Přidej dítě ručně nebo ho připoj k rodičovskému účtu." />
        </Panel>
      </div>
    );
  }

  const participantName = `${participant.firstName} ${participant.lastName}`;
  const normalizedParticipantName = normalizePersonName(participantName);
  const participantPayments = payments.filter((payment) => normalizePersonName(payment.participantName) === normalizedParticipantName);
  const participantPasses = digitalPasses.filter((pass) => pass.participantId === participant.id);
  const participantAttendance = attendanceHistory.filter((record) => normalizePersonName(record.participantName) === normalizedParticipantName);

  return (
    <div className="space-y-5">
      <AddParticipantPanel displayName={displayName} parentProfileId={parentProfileId} products={availableProducts} />

      <div className="grid items-stretch gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Panel className="p-4">
          <SectionTitle icon={<Users size={18} />} title="Účastník" subtitle="vyber dítě" />
          <div className="mt-4 grid gap-2">
            {participants.map((item) => {
              const active = item.id === participant.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectParticipant(item.id)}
                  className={`rounded-xl border p-3 text-left transition-colors ${active ? 'border-violet-300 bg-violet-50 text-violet-800' : 'border-transparent text-neutral-600 hover:bg-neutral-50'}`}
                >
                  <span className={`block text-sm ${active ? 'font-medium' : ''}`}>{item.firstName} {item.lastName}</span>
                  <span className={`mt-0.5 block text-xs ${active ? 'text-violet-600' : 'text-neutral-400'}`}>{item.activeCourse}</span>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] text-neutral-400">{participant.claimCode}</p>
              <h2 className="mt-1 text-2xl font-semibold text-neutral-900">{participant.firstName} {participant.lastName}</h2>
              <p className="mt-1.5 text-sm text-neutral-500">Další trénink: {participant.nextTraining}</p>
            </div>
            <div className="grid min-w-[220px] grid-cols-2 gap-2">
              <Metric value={`${participant.level}`} label="level" />
              <Metric value={participant.bracelet} label="náramek" />
            </div>
          </div>
          <ProgressBar value={participant.xp} max={participant.nextBraceletXp} />
        </Panel>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <AccordionPanel icon={<PackageCheck size={18} />} title="Aktivní produkty" count={participant.activePurchases.length}>
            {participant.activePurchases.length > 0
              ? participant.activePurchases.map((purchase) => (
                  <Row key={`${purchase.type}-${purchase.title}`} label={purchase.title} value={purchase.status} tone={purchase.status === 'Aktivní' || purchase.status === 'Zaplaceno' ? 'green' : 'purple'} />
                ))
              : <EmptyState text="Žádný aktivní produkt. Novou registraci spustíš v sekci Platby a zaplatíš ji rovnou." />}
          </AccordionPanel>
          <AccordionPanel icon={<WalletCards size={18} />} title="Platby" count={participantPayments.length}>
            {participantPayments.map((payment) => (
              <Row key={payment.id} label={payment.title} value={`${formatCurrency(payment.amount)} · ${payment.dueDate}`} tone={payment.status === 'paid' ? 'green' : 'pink'} />
            ))}
          </AccordionPanel>
        </div>

        <div className="space-y-5">
          <AccordionPanel icon={<QrCode size={18} />} title="Digitální passy" count={participantPasses.length}>
            {participantPasses.map((pass) => (
              <Row key={pass.id} label={pass.title} value={`${pass.usedEntries}/${pass.totalEntries} vstupů`} tone="cyan" />
            ))}
          </AccordionPanel>
        </div>
      </div>

      <Panel className="p-5">
        <SectionTitle icon={<History size={18} />} title="Docházka" subtitle="záznamy seřazené po měsíciích" />
        <div className="mt-4 grid gap-4">
          {groupByMonthWeb(participantAttendance, (r) => r.date).map(({ label, items }) => (
            <div key={label}>
              <p className="mb-2 border-b border-neutral-200 pb-1 text-xs font-medium text-neutral-400">{label}</p>
              <div className="grid gap-2">
                {items.map((record) => (
                  <div key={record.id} className="grid gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-sm md:grid-cols-[1fr_auto_auto] md:items-center">
                    <span className="text-neutral-800">{record.location}</span>
                    <span className="text-neutral-400">{record.date} · {record.time}</span>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">{record.method}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {participantAttendance.length === 0 && <p className="text-sm text-neutral-500">Zatím žádné záznamy docházky.</p>}
        </div>
      </Panel>
    </div>
  );
}

function AddParticipantPanel({ displayName, parentProfileId, products }: { displayName: string; parentProfileId?: string; products: ParentProduct[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'link' | 'manual'>('link');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [claimCode, setClaimCode] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [schoolYear, setSchoolYear] = useState('');
  const courseOptions = useMemo(() => Array.from(new Set(products.filter((product) => product.type === 'Krouzek').map((product) => product.place))), [products]);
  const [preferredCourse, setPreferredCourse] = useState(courseOptions[0] ?? '');
  const [parentName, setParentName] = useState(displayName);
  const [parentPhone, setParentPhone] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [address, setAddress] = useState('');
  const [departureMode, setDepartureMode] = useState('parent');
  const [authorizedPeople, setAuthorizedPeople] = useState('');
  const [allergies, setAllergies] = useState('Bez známých alergií');
  const [healthLimits, setHealthLimits] = useState('Bez omezení');
  const [medicationNote, setMedicationNote] = useState('Bez pravidelných léků');
  const [coachNote, setCoachNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function lookupParticipant() {
    if (!claimCode.trim()) {
      setMessage('Zadej propojovací kód účastníka.');
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const result = await linkParticipantByClaimCode({ parentProfileId, claimCode });
      setMessage(`${result.participant.first_name} ${result.participant.last_name} je připojený k rodičovskému účtu. Obnovuji přehled, aby šly rovnou nakupovat produkty na jeho profil.`);
      if (typeof window !== 'undefined') window.setTimeout(() => window.location.reload(), 900);
      return;
    } catch (error) {
      const backendMessage = error instanceof Error ? friendlyBackendError(error.message) : 'Účastníka se nepodařilo připojit.';
      setMessage(backendMessage);
    } finally {
      setSaving(false);
    }
  }

  async function submitManualParticipant() {
    const requiredFields: Array<[string, string]> = [
      ['jméno', firstName],
      ['příjmení', lastName],
      ['datum narození', dateOfBirth],
      ['školní ročník', schoolYear],
      ['jméno rodiče', parentName],
      ['telefon rodiče', parentPhone],
      ['nouzový telefon', emergencyPhone],
      ['adresa', address],
      ['preferovaná lokalita', preferredCourse],
      ['zdravotní omezení', healthLimits],
      ['alergie', allergies],
      ['léky', medicationNote],
    ];
    if (departureMode === 'authorized') requiredFields.push(['pověřené osoby', authorizedPeople]);

    const missing = requiredFields.filter(([, value]) => value.trim().length === 0).map(([label]) => label);
    if (missing.length > 0) {
      setMessage(`Doplň prosím údaje pro profil bez telefonu: ${missing.join(', ')}.`);
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const result = await createManualParticipantProfile({
        parentProfileId,
        firstName,
        lastName,
        dateOfBirth,
        schoolYear,
        parentName,
        parentPhone,
        emergencyPhone,
        address,
        preferredCourse,
        departureMode,
        authorizedPeople,
        allergies,
        healthLimits,
        medicationNote,
        coachNote,
      });
      setMessage(`${result.participant.first_name} ${result.participant.last_name} je uložený jako profil bez telefonu pro ${result.participant.active_course}.`);
    } catch (error) {
      setMessage(error instanceof Error ? friendlyBackendError(error.message) : 'Profil bez telefonu se nepodařilo uložit.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel className="overflow-hidden p-3 transition-all duration-300">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 rounded-xl bg-neutral-50 p-2.5 text-left transition hover:bg-neutral-100"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors ${isOpen ? 'bg-violet-600 text-white' : 'bg-neutral-100 text-neutral-600'}`}>
            <Plus size={24} className={`transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`} />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-semibold text-neutral-900 sm:text-lg">Přidat účastníka</span>
            <span className="hidden truncate text-xs text-neutral-500 sm:block">Propojit dítě z aplikace nebo vytvořit profil bez telefonu</span>
          </span>
        </span>
        <span className="hidden rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700 sm:inline-flex">
          {isOpen ? 'Skrýt' : 'Otevřít'}
        </span>
      </button>

      <CollapsibleContent open={isOpen} className="pt-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div>
          <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1">
            <button type="button" onClick={() => { setMode('link'); setMessage(null); }} className={`rounded-md px-3 py-2 text-xs font-medium transition ${mode === 'link' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}>
              Propojit účet z aplikace
            </button>
            <button type="button" onClick={() => { setMode('manual'); setMessage(null); }} className={`rounded-md px-3 py-2 text-xs font-medium transition ${mode === 'manual' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}>
              Vytvořit bez telefonu
            </button>
          </div>

          {mode === 'link' ? (
            <div className="mt-4">
              <label className="grid gap-2 text-sm font-medium text-neutral-900">
                Propojovací kód účastníka
                <input
                  type="text"
                  value={claimCode}
                  onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
                  placeholder="ABCD-1234"
                  maxLength={9}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 font-mono text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500"
                />
              </label>
            </div>
          ) : null}

          {mode === 'manual' ? (
            <div className="mt-4 space-y-6">
              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Základní informace</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <MiniInput label="Jméno" value={firstName} onChange={setFirstName} placeholder="Eliška" />
                  <MiniInput label="Příjmení" value={lastName} onChange={setLastName} placeholder="Nováková" />
                  <MiniInput label="Datum narození" type="date" value={dateOfBirth} onChange={setDateOfBirth} placeholder="" />
                  <MiniInput label="Školní ročník" value={schoolYear} onChange={setSchoolYear} placeholder="5. třída" />
                </div>
              </div>

              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Kontakt a lokalita</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <MiniSelect label="Preferovaná lokalita" value={preferredCourse} onChange={setPreferredCourse} options={courseOptions.map((course) => ({ value: course, label: course }))} />
                  <MiniInput label="Jméno rodiče" value={parentName} onChange={setParentName} placeholder="Jméno a příjmení rodiče" />
                  <MiniInput label="Telefon rodiče" type="tel" value={parentPhone} onChange={setParentPhone} placeholder="+420 ..." />
                  <MiniInput label="Nouzový telefon" type="tel" value={emergencyPhone} onChange={setEmergencyPhone} placeholder="+420 ..." />
                  <MiniInput label="Adresa" value={address} onChange={setAddress} placeholder="Ulice, město" />
                </div>
              </div>

              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Odchod po tréninku</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <MiniSelect label="Odchod po tréninku" value={departureMode} onChange={setDepartureMode} options={[{ value: 'parent', label: 'Pouze s rodičem' }, { value: 'alone', label: 'Může odejít samo' }, { value: 'authorized', label: 'Jen s pověřenou osobou' }]} />
                  {departureMode === 'authorized' ? <MiniInput label="Pověřené osoby" value={authorizedPeople} onChange={setAuthorizedPeople} placeholder="Jména a telefon" /> : null}
                </div>
              </div>

              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Zdraví a poznámky</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <MiniTextarea label="Zdravotní omezení" value={healthLimits} onChange={setHealthLimits} />
                  <MiniTextarea label="Alergie" value={allergies} onChange={setAllergies} />
                  <MiniTextarea label="Léky" value={medicationNote} onChange={setMedicationNote} />
                  <MiniTextarea label="Poznámka pro trenéra" value={coachNote} onChange={setCoachNote} placeholder="Na co si dát pozor, motivace, zkušenosti..." />
                </div>
              </div>
            </div>
          ) : null}

          <button type="button" disabled={saving} onClick={mode === 'link' ? lookupParticipant : submitManualParticipant} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
            {mode === 'link' ? <Search size={17} /> : <UserPlus size={17} />}
            {mode === 'link' ? (saving ? 'Připojuji účastníka...' : 'Připojit účastníka') : saving ? 'Ukládám profil...' : 'Uložit profil bez telefonu'}
          </button>
          {message ? <p className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm leading-6 text-neutral-500">{message}</p> : null}
        </div>

        {mode === 'link' ? (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-xs font-medium text-neutral-400">Jak to funguje</p>
            <h3 className="mt-2 text-base font-semibold text-neutral-900">Propojovací kód z profilu dítěte</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-500">Každý účastník má unikátní kód zobrazený v aplikaci nebo přidělený trenérem při registraci. Zadej kód a dítě se automaticky propojí s tvým rodičovským účtem.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-xs font-medium text-neutral-400">Profil bez telefonu</p>
            <h3 className="mt-2 text-base font-semibold text-neutral-900">Potřebujeme údaje pro trenéra i dokumenty</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-500">Bez dětského app účtu se progres a QR triky nebudou zapisovat automaticky, ale trenér pořád potřebuje bezpečnostní, zdravotní a kontaktní údaje.</p>
            <div className="mt-4 grid gap-2 text-sm leading-6 text-neutral-500">
              <span>Datum narození a školní ročník</span>
              <span>Rodič, telefon a nouzový kontakt</span>
              <span>Zdraví, alergie, léky a odchod z tréninku</span>
              <span>Poznámka pro trenéra před první lekcí</span>
            </div>
          </div>
        )}
      </div>
      </CollapsibleContent>
    </Panel>
  );
}

function PaymentsSection({
  activeProductType,
  productGroups,
  selectedParticipant,
  rewardDiscounts,
  catalogMessage,
  onProductTypeChange,
  onStartPurchase,
  onRegisterInterest,
  registeredInterestProductIds,
  organizations,
  selectedOrgId,
  onSelectOrg,
}: {
  activeProductType: ActivityType;
  productGroups: ProductGroup[];
  selectedParticipant?: ParentParticipant;
  rewardDiscounts: RewardDiscountCode[];
  catalogMessage: string | null;
  onProductTypeChange: (type: ActivityType) => void;
  onStartPurchase: (group: ProductGroup) => void;
  onRegisterInterest: (group: ProductGroup) => void;
  registeredInterestProductIds: Set<string>;
  organizations?: Array<{ id: string; name: string; orgType: string }>;
  selectedOrgId?: string | null;
  onSelectOrg?: (id: string) => void;
}) {
  const { payments } = useParentPortalData();
  const { flags } = useFeatureFlags();
  const visiblePaymentTypes = paymentTypes.filter((type) => (type.key === 'Tabor' ? flags.trainer_camps : type.key === 'Workshop' ? flags.trainer_workshop_registration : true));
  const visibleGroups = productGroups
    .filter((group) => group.type === activeProductType)
    .sort((a, b) => productSortScore(a, selectedParticipant) - productSortScore(b, selectedParticipant) || a.place.localeCompare(b.place, 'cs'));
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <div className="space-y-5">
      <Panel className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <SectionTitle icon={<WalletCards size={18} />} title="Platby a nové produkty" subtitle="aktuální nabídka, lokality a varianty permanentek" />
          <div className={`grid rounded-lg border border-neutral-200 bg-neutral-50 p-1 ${visiblePaymentTypes.length === 3 ? 'grid-cols-3' : visiblePaymentTypes.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {visiblePaymentTypes.map((type) => (
              <button
                key={type.key}
                type="button"
                onClick={() => onProductTypeChange(type.key)}
                className={`rounded-md px-3 py-2 text-xs font-medium transition ${activeProductType === type.key ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {organizations && organizations.length > 1 && onSelectOrg ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-neutral-400">Organizace:</span>
            {organizations.map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => onSelectOrg(org.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  selectedOrgId === org.id
                    ? 'bg-neutral-900 text-white'
                    : 'border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'
                }`}
              >
                {org.name}
              </button>
            ))}
          </div>
        ) : null}
      </Panel>

      <RewardCodesPanel discounts={rewardDiscounts} compact />
      {catalogMessage ? <p className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500">{catalogMessage}</p> : null}

      <div className="grid items-start gap-4 xl:grid-cols-2">
        {visibleGroups.map((group) => (
          <ProductGroupCard key={group.id} group={group} selectedParticipant={selectedParticipant} onStartPurchase={() => onStartPurchase(group)} onRegisterInterest={() => onRegisterInterest(group)} parentHasInterest={registeredInterestProductIds.has(group.id)} />
        ))}
      </div>

      <PaymentHistoryPanel totalPaid={totalPaid} />
    </div>
  );
}

function RewardCodesPanel({ discounts, compact = false }: { discounts: RewardDiscountCode[]; compact?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Panel className={compact ? 'px-4 py-3' : 'px-4 py-0'}>
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 border-b border-neutral-200 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <BadgePercent size={15} className="shrink-0 text-neutral-400" />
          <span className="text-sm text-neutral-900">Slevové kódy</span>
          {discounts.length > 0 && (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] text-violet-700">{discounts.length}</span>
          )}
        </div>
        <ChevronDown className={`text-neutral-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} size={15} />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="reward-codes-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="mt-2 flex flex-col gap-1.5">
              {discounts.length > 0 ? discounts.map((discount) => (
                <div key={discount.id} className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2">
                  <div className="min-w-0">
                    <span className="text-[11px] font-medium text-neutral-900">{discount.participantName}</span>
                    <span className="mx-1.5 text-neutral-300">·</span>
                    <span className="text-xs text-neutral-500">{discount.title}</span>
                    <code className="ml-2 font-mono text-xs text-neutral-700">{discount.code}</code>
                  </div>
                  <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700">-{discount.percent} %</span>
                </div>
              )) : (
                <p className="py-1 text-xs text-neutral-500">Zatím žádný aktivní kód.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}

function PaymentHistoryPanel({ totalPaid }: { totalPaid: number }) {
  const { payments } = useParentPortalData();
  const [isOpen, setIsOpen] = useState(true);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 transition-all duration-300">
      <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)} className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-4 rounded-lg text-left transition-colors hover:bg-neutral-50">
        <SectionTitle icon={<History size={18} />} title="Historie plateb" subtitle="úplně dole, můžeš ji kdykoliv skrýt" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700">{payments.length} platby</span>
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700">{formatCurrency(totalPaid)}</span>
          <ChevronDown className={`text-neutral-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} size={19} />
        </div>
      </button>
      <CollapsibleContent open={isOpen} className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-start">
        <div className="grid gap-2">
          {payments.map((payment) => (
            <PaymentHistoryRow key={payment.id} payment={payment} />
          ))}
          {payments.length === 0 ? <EmptyState text="Zatím tu není žádná uložená platba." /> : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <Metric value={`${payments.length}`} label="zaplacené platby" />
          <Metric value={formatCurrency(totalPaid)} label="celkem uhrazeno" />
        </div>
      </CollapsibleContent>
    </section>
  );
}

function groupByMonthWeb<T>(items: T[], getDate: (item: T) => string): { label: string; items: T[] }[] {
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

function PaymentHistoryRow({ payment }: { payment: ParentPayment }) {
  return (
    <div className="grid gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-sm transition-all duration-300 hover:bg-neutral-50 md:grid-cols-[minmax(0,1fr)_140px_120px_110px] md:items-center">
      <div className="min-w-0">
        <p className="truncate font-medium text-neutral-900">{payment.title}</p>
        <p className="mt-1 text-xs text-neutral-500">{payment.participantName} · {payment.method}</p>
        {payment.trainingDays && payment.trainingDays.length > 0 ? (
          <p className="mt-1 inline-flex rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700">Tréninkové dny: {payment.trainingDays.join(' + ')}</p>
        ) : null}
      </div>
      <span className="font-medium text-neutral-900">{formatCurrency(payment.amount)}</span>
      <span className="text-xs text-neutral-500">{payment.paidAt}</span>
      <span className="inline-flex justify-center rounded-full bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{paymentStatusLabel(payment.status)}</span>
    </div>
  );
}

function DocumentsSection({ onOpenDocument, onGoToPayments }: { onOpenDocument: (document: ParentDocument) => void; onGoToPayments: () => void }) {
  const { documents } = useParentPortalData();
  const { flags } = useFeatureFlags();
  const missingDocuments = documents.filter((document) => document.status !== 'signed');

  return (
    <div className="grid items-start gap-5">
      <Panel className="p-5">
        <SectionTitle icon={<ShieldCheck size={18} />} title="Co je nutné vyplnit" subtitle={flags.trainer_camps ? 'kroužek a tábor mají odlišný balíček dokumentů' : 'dokumenty ke kroužku'} />
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <DocumentChecklist title="Kroužek" productType="Krouzek" />
          {flags.trainer_camps ? <DocumentChecklist title="Tábor" productType="Tabor" /> : null}
        </div>
        {missingDocuments.length > 0 ? (
          <button type="button" onClick={() => onOpenDocument(missingDocuments[0])} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-medium text-white transition hover:bg-violet-700">
            Vyplnit chybějící dokumenty
            <ArrowRight size={17} />
          </button>
        ) : (
          <button type="button" onClick={onGoToPayments} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50">
            Přejít na nabídku aktivit
            <ArrowRight size={17} />
          </button>
        )}
      </Panel>
    </div>
  );
}

function ProfileSection({ displayName, displayEmail, parentProfileId, participantName, onEmailChange }: { displayName: string; displayEmail: string; parentProfileId?: string; participantName: string; onEmailChange: (email: string) => void }) {
  const { coachReviews: reviews, coaches: portalCoaches, products } = useParentPortalData();
  const [emailDraft, setEmailDraft] = useState(displayEmail);
  const [profileSaving, setProfileSaving] = useState(false);
  const [selectedCoachId, setSelectedCoachId] = useState(reviews[0]?.coachId ?? '');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const reviewableCoaches = useMemo(() => {
    if (portalCoaches.length === 0) return [];
    const byId = new Map(portalCoaches.map((coach) => [coach.id, coach]));
    const referencedIds = new Set(products.flatMap((product) => product.coachIds ?? []));
    const linked = Array.from(referencedIds)
      .map((id) => byId.get(id))
      .filter((coach): coach is ParentProductTrainer => Boolean(coach));
    return linked.length > 0 ? linked : portalCoaches;
  }, [portalCoaches, products]);
  const selectedCoach = reviewableCoaches.find((coach) => coach.id === selectedCoachId) ?? reviewableCoaches[0];

  useEffect(() => {
    if (!selectedCoachId && reviewableCoaches[0]?.id) {
      setSelectedCoachId(reviewableCoaches[0].id);
      return;
    }
    if (selectedCoachId && !reviewableCoaches.some((coach) => coach.id === selectedCoachId)) {
      setSelectedCoachId(reviewableCoaches[0]?.id ?? '');
    }
  }, [selectedCoachId, reviewableCoaches]);

  async function saveProfileEmail() {
    const nextEmail = emailDraft.trim().toLowerCase();
    if (!looksLikeEmail(nextEmail)) {
      setMessage('Vyplň platný e-mail pro potvrzení plateb.');
      return;
    }

    setProfileSaving(true);
    setMessage(null);

    try {
      if (hasSupabaseBrowserConfig() && parentProfileId) {
        const supabase = createBrowserSupabaseClient();
        const { error } = await supabase.from('app_profiles').update({ email: nextEmail }).eq('id', parentProfileId);
        if (error) throw error;
        setMessage('E-mail pro potvrzení plateb je uložený.');
      } else {
        setMessage('Demo režim: e-mail je změněný jen v aktuálním zobrazení.');
      }
      onEmailChange(nextEmail);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'E-mail se nepodařilo uložit.');
    } finally {
      setProfileSaving(false);
    }
  }

  async function submitReview() {
    if (!selectedCoach) return;
    setSaving(true);
    setMessage(null);

    try {
      if (hasSupabaseBrowserConfig()) {
        const supabase = createBrowserSupabaseClient();
        const { error } = await supabase.from('coach_reviews').insert({
          id: `web-review-${selectedCoach.id}-${Date.now()}`,
          coach_id: selectedCoach.id,
          coach_name: selectedCoach.name,
          parent_id: parentIdFromEmail(displayEmail),
          parent_name: displayName,
          participant_name: participantName,
          rating,
          comment: comment.trim() || `Hodnocení ${rating}/5 z rodičovského portálu.`,
          created_at_text: new Date().toLocaleString('cs-CZ'),
        });
        if (error) throw error;
        setMessage('Hodnocení trenéra je uložené v databázi.');
      } else {
        setMessage('Demo režim: hvězdičkové hodnocení je připravené, po doplnění Supabase env se zapíše do databáze.');
      }
      setComment('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Hodnocení se nepodařilo uložit.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel className="p-5">
        <SectionTitle icon={<UserPlus size={18} />} title="Profil rodiče" subtitle="kontaktní údaje pro platby a dokumenty" />
        <div className="mt-5 space-y-3">
          <ProfileRow label="Jméno" value={displayName} />
          <label className="grid gap-2 text-sm font-medium text-neutral-900">
            E-mail pro potvrzení plateb
            <input value={emailDraft} onChange={(event) => setEmailDraft(event.target.value)} type="email" className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500" placeholder="rodic@example.cz" />
          </label>
          <button type="button" disabled={profileSaving || emailDraft.trim().toLowerCase() === displayEmail.toLowerCase()} onClick={saveProfileEmail} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60">
            <Check size={17} />
            {profileSaving ? 'Ukládám...' : 'Uložit e-mail'}
          </button>
          <ProfileRow label="Telefon" value="Doplní se z přihlášky účastníka" />
          <ProfileRow label="Adresa" value="Doplní se z přihlášky účastníka" />
        </div>
      </Panel>

      <Panel className="p-5">
        <SectionTitle icon={<MessageSquareText size={18} />} title="Hodnocení trenéra" subtitle="klikni na hvězdičky a odešli zpětnou vazbu" />
        <div className="mt-5 grid gap-4">
          {reviewableCoaches.length > 0 ? (
            <>
              <label className="grid gap-2 text-sm font-medium text-neutral-900">
                Trenér
                <select value={selectedCoachId} onChange={(event) => setSelectedCoachId(event.target.value)} className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500">
                  {reviewableCoaches.map((coach) => (
                    <option key={coach.id} value={coach.id}>{coach.name}</option>
                  ))}
                </select>
              </label>
              {selectedCoach ? <CoachReviewProfile coach={selectedCoach} /> : null}
            </>
          ) : (
            <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">Pro tvoje produkty zatím není přiřazený žádný trenér k hodnocení.</p>
          )}
          <StarRating value={rating} onChange={setRating} />
          <label className="grid gap-2 text-sm font-medium text-neutral-900">
            Poznámka
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500" placeholder="Co se trenérovi povedlo, co zlepšit..." />
          </label>
          <button type="button" disabled={saving || !selectedCoach} onClick={submitReview} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60">
            <Star size={17} fill="currentColor" />
            {saving ? 'Ukládám...' : 'Uložit hodnocení'}
          </button>
          {message ? <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">{message}</p> : null}
        </div>
      </Panel>
    </div>
  );
}

function ProductGroupCard({ group, selectedParticipant, onStartPurchase, onRegisterInterest, parentHasInterest }: { group: ProductGroup; selectedParticipant?: ParentParticipant; onStartPurchase: () => void; onRegisterInterest: () => void; parentHasInterest?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);
  const prevHasInterest = useRef(false);
  const firstVariant = group.variants[0];
  const priceLabel = group.type === 'Tabor' && group.variants.length > 1
    ? `Turnusy od ${formatCurrency(Math.min(...group.variants.map((variant) => variant.price)))}`
    : group.variants.length > 1
      ? `${formatCurrency(Math.min(...group.variants.map((variant) => variant.price)))} - ${formatCurrency(Math.max(...group.variants.map((variant) => variant.price)))}`
      : firstVariant.priceLabel;
  const remainingSeats = Math.max(group.capacityTotal - group.capacityCurrent, 0);
  const capacityPercent = Math.min(100, Math.round((group.capacityCurrent / group.capacityTotal) * 100));
  const workshopGate = workshopPurchaseGate(group);
  const isWorkshopInterestMode = group.type === 'Workshop' && !workshopGate.canPurchase;
  const primaryAction = isWorkshopInterestMode && !parentHasInterest ? onRegisterInterest : onStartPurchase;
  const primaryDisabled = isWorkshopInterestMode && !parentHasInterest && !selectedParticipant;
  const interestPercent = Math.min(100, Math.round((group.interestCount / WORKSHOP_INTEREST_THRESHOLD) * 100));
  const scheduleDays = group.type === 'Krouzek' ? parseScheduleDays(group.primaryMeta) : [];
  const scheduleTime = parseScheduleTime(group.primaryMeta);
  const multiDay = scheduleDays.length >= 2;

  useEffect(() => {
    if (parentHasInterest && !prevHasInterest.current) {
      setJustRegistered(true);
      const t = setTimeout(() => setJustRegistered(false), 1800);
      return () => clearTimeout(t);
    }
    prevHasInterest.current = parentHasInterest ?? false;
  }, [parentHasInterest]);

  return (
    <section className="scroll-mt-6 self-start [perspective:1800px]">
      <div className={`relative transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d] [will-change:transform] ${expanded ? '[transform:rotateY(180deg)]' : ''}`}>
        <div className={`overflow-hidden rounded-xl border border-neutral-200 bg-white [backface-visibility:hidden] ${expanded ? 'pointer-events-none' : ''}`} aria-hidden={expanded}>
          <div className="relative aspect-video bg-neutral-100">
            <Image src={group.heroImage} alt={group.title} fill className="object-cover" sizes="(min-width: 1280px) 38vw, 100vw" />
            <div className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm">{activityLabel(group.type)}</div>
          </div>
          <div className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-neutral-900">{group.title}</h3>
                <p className="mt-1 flex items-center gap-2 text-sm text-neutral-400"><MapPin size={14} /> {group.place}</p>
              </div>
              <p className="shrink-0 text-right text-[15px] font-semibold text-neutral-900">{priceLabel}</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-neutral-500">{group.description}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <InfoPill label="Termín" value={multiDay && scheduleTime ? `${scheduleDays.join(' a ')} · ${scheduleTime}` : group.primaryMeta} />
              <InfoPill label="Kapacita" value={`${group.capacityCurrent}/${group.capacityTotal} dětí`} />
              {multiDay ? (
                <p className="col-span-full rounded-lg bg-violet-50 px-3 py-2 text-xs leading-5 text-violet-700">
                  Při přihlášce si vybereš {scheduleDays.join(', ')}, nebo oba dny — cena je stejná.
                </p>
              ) : null}
              {group.type === 'Workshop' && !workshopGate.canPurchase ? (
                <div className="col-span-2 mt-1 grid gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">Zájemci: {group.interestCount}/{WORKSHOP_INTEREST_THRESHOLD}</span>
                    <span className={interestPercent >= 100 ? 'text-emerald-600' : 'text-violet-600'}>{interestPercent >= 100 ? 'Plno – otevírá se platba' : `ještě ${WORKSHOP_INTEREST_THRESHOLD - group.interestCount} do otevření`}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200">
                    <div
                      className="h-full rounded-full bg-violet-500 transition-all duration-700"
                      style={{ width: `${interestPercent}%` }}
                    />
                  </div>
                </div>
              ) : null}
              {group.type === 'Workshop' && workshopGate.canPurchase ? <InfoPill label="Prodej" value="Otevřeno" /> : null}
            </div>
            <CapacityBar current={group.capacityCurrent} total={group.capacityTotal} />
            <div className="mt-4 flex flex-wrap gap-2">
              {group.trainingFocus.slice(0, 4).map((focus) => (
                <span key={focus} className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600">{focus}</span>
              ))}
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <button type="button" onClick={() => setExpanded(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50">
                <Camera size={17} />
                Fotky, info a trenéři
                <RefreshCw size={16} />
              </button>
              {isWorkshopInterestMode && parentHasInterest ? (
                <motion.button
                  type="button"
                  onClick={onStartPurchase}
                  disabled
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-medium text-white"
                  animate={justRegistered ? { scale: [1, 1.08, 0.97, 1.03, 1] } : { scale: 1 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                >
                  <Check size={17} />
                  Zájem uložen
                  {justRegistered ? <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="text-emerald-100">✓</motion.span> : null}
                </motion.button>
              ) : (
                <button type="button" disabled={primaryDisabled} onClick={primaryAction} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {isWorkshopInterestMode ? 'Mám zájem' : 'Zaplatit'}
                  <ArrowRight size={17} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={`absolute inset-0 flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white [backface-visibility:hidden] [transform:rotateY(180deg)] ${expanded ? '' : 'pointer-events-none'}`} aria-hidden={!expanded}>
          <div className="relative h-32 shrink-0 overflow-hidden bg-neutral-100">
            <div className="grid h-full grid-cols-3 gap-1.5 p-1.5">
              {group.gallery.slice(0, 3).map((photo, index) => (
                <div key={`${photo}-${index}`} className="relative overflow-hidden rounded-xl bg-white">
                  <Image src={photo} alt={`${group.title} ${index + 1}`} fill className="object-cover" sizes="(min-width: 1280px) 12vw, 33vw" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-neutral-200 bg-white p-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-neutral-400">Fotky, info a trenéři</p>
              <h3 className="truncate text-base font-semibold text-neutral-900">{group.title}</h3>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500"><MapPin size={13} /> {group.place}</p>
              <p className="mt-0.5 truncate text-[11px] text-neutral-500">{group.primaryMeta} · {priceLabel}</p>
            </div>
            <button type="button" onClick={() => setExpanded(false)} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50">
              <RefreshCw size={14} />
              Zpět
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
              <div>
                <h4 className="text-[11px] font-medium text-neutral-400">Důležité informace</h4>
                <div className="mt-2 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                  {group.importantInfo.map((item) => (
                    <DetailInfoCard key={`${item.label}-${item.value}`} label={item.label} value={item.value} />
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-[11px] font-medium text-neutral-400">Trenéři na místě</h4>
                <div className="mt-2 grid gap-2">
                  {group.trainers.length > 0 ? group.trainers.map((trainer) => <TrainerRow key={trainer.id} trainer={trainer} />) : <p className="rounded-lg border border-neutral-200 bg-white p-3 text-xs leading-5 text-neutral-500">Trenér se doplní automaticky po registraci a výběru lokality.</p>}
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {group.trainingFocus.slice(0, 4).map((focus) => (
                <span key={focus} className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] text-neutral-600">{focus}</span>
              ))}
            </div>
          </div>

          <div className="shrink-0 border-t border-neutral-200 bg-white/95 p-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-neutral-500">Aktuálně {group.capacityCurrent}/{group.capacityTotal} dětí</span>
              <span className="text-neutral-400">{group.type === 'Workshop' ? `${group.interestCount} zájemců` : `${remainingSeats} volných míst`}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full rounded-full bg-violet-500" style={{ width: `${capacityPercent}%` }} />
            </div>
            {isWorkshopInterestMode && parentHasInterest ? (
              <motion.button
                type="button"
                onClick={onStartPurchase}
                disabled
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-medium text-white"
                animate={justRegistered ? { scale: [1, 1.06, 0.98, 1.02, 1] } : { scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              >
                <Check size={17} />
                Zájem uložen
              </motion.button>
            ) : (
              <button type="button" disabled={primaryDisabled} onClick={primaryAction} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60">
                {isWorkshopInterestMode ? 'Mám zájem' : 'Zaplatit'}
                <ArrowRight size={17} />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function PurchaseWizard({ flow, usedRewardCodeIds, onChange, onClose, onCheckout, onPaymentPaid }: { flow: PurchaseFlow; usedRewardCodeIds: string[]; onChange: (flow: PurchaseFlow) => void; onClose: () => void; onCheckout: () => void; onPaymentPaid: (paymentIntentId: string) => Promise<void> }) {
  const { participants } = useParentPortalData();
  const selectedProduct = flow.group.variants.find((variant) => variant.id === flow.selectedProductId) ?? flow.group.variants[0];
  const participant = participants.find((item) => item.id === flow.participantId) ?? participants[0];
  const requiredDocuments = requiredDocumentsForProduct(selectedProduct);
  const isDocumentOnly = flow.mode === 'documents';
  const appliedDiscount = participant ? findRewardDiscountByCode(flow.discountCode, selectedProduct.type, participant, usedRewardCodeIds) : null;
  const discountPreview = applyRewardDiscount(selectedProduct.price, appliedDiscount);
  const [savedForLater, setSavedForLater] = useState(false);
  const scheduleDays = !isDocumentOnly && flow.group.type === 'Krouzek' ? parseScheduleDays(flow.group.primaryMeta) : [];
  const scheduleTime = parseScheduleTime(flow.group.primaryMeta);
  const hasDayChoice = scheduleDays.length >= 2;

  function toggleTrainingDay(day: string) {
    const next = flow.trainingDays.includes(day)
      ? flow.trainingDays.filter((item) => item !== day)
      : scheduleDays.filter((item) => flow.trainingDays.includes(item) || item === day);
    onChange({ ...flow, trainingDays: next, message: null });
  }

  function saveDocumentsForLater() {
    persistDocumentDefaults(flow.documentValues);
    setSavedForLater(true);
    window.setTimeout(() => setSavedForLater(false), 2500);
  }

  function updateDocuments(values: Partial<DocumentFormValues>) {
    onChange({ ...flow, documentValues: { ...flow.documentValues, ...values }, message: null });
  }

  function docBlockCompleted(kind: string): boolean {
    const v = flow.documentValues;
    const filled = (s: string) => s.trim().length > 0;
    switch (kind) {
      case 'gdpr': return v.gdprConsent;
      case 'guardian-consent': return filled(v.parentName) && filled(v.emergencyPhone) && v.guardianConsent; // druhý nouzový kontakt je volitelný
      case 'health': return filled(v.insuranceCompany) && filled(v.allergies) && filled(v.medication) && filled(v.healthLimits) && v.healthAccuracy;
      case 'departure': return filled(v.pickupPeople) && v.departureConsent;
      case 'infection-free': return v.infectionFree;
      case 'packing': return v.packingConfirmed;
      case 'workshop-terms': return filled(v.parentName) && filled(v.emergencyPhone) && v.workshopTermsAccepted && v.photoConsent;
      default: return false;
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm">
      <div className="mx-auto flex max-h-[calc(100dvh-48px)] max-w-5xl flex-col rounded-xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 p-5">
          <div>
            <p className="text-xs font-medium text-neutral-400">{isDocumentOnly ? 'Doplnění dokumentů' : 'Průvodce platbou'}</p>
            <h2 className="mt-1 text-2xl font-semibold text-neutral-900">{flow.group.title}</h2>
            <p className="mt-1 text-sm text-neutral-500">{flow.group.place}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700" aria-label="Zavřít">
            <X size={22} />
          </button>
        </div>

        <div className="grid gap-5 overflow-y-auto p-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            {isDocumentOnly ? (
              <WizardBlock number="1" title="Aktivita" completed>
                <div className="rounded-lg border border-neutral-200 bg-white p-4">
                  <p className="text-sm font-medium text-neutral-900">{selectedProduct.title}</p>
                  <p className="mt-1 text-xs text-neutral-500">{selectedProduct.place} · {selectedProduct.priceLabel}</p>
                </div>
              </WizardBlock>
            ) : (
              <WizardBlock number="1" title="Varianta" completed={!!flow.selectedProductId}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {flow.group.variants.map((variant) => {
                    const selected = variant.id === flow.selectedProductId;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => onChange({ ...flow, selectedProductId: variant.id, message: null })}
                        className={`rounded-xl border p-4 text-left transition ${selected ? 'border-violet-600 bg-violet-600 text-white' : 'border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50'}`}
                      >
                        <span className="block text-sm font-medium">{variant.priceLabel}</span>
                        <span className={`mt-1 block text-xs ${selected ? 'text-white/80' : 'text-neutral-500'}`}>{variant.secondaryMeta}</span>
                      </button>
                    );
                  })}
                </div>
              </WizardBlock>
            )}

            <WizardBlock number="2" title="Účastník" completed={!!flow.participantId}>
              <div className="grid gap-3 sm:grid-cols-2">
                {participants.map((item) => {
                  const selected = item.id === flow.participantId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onChange({ ...flow, participantId: item.id, message: null })}
                      className={`rounded-xl border p-4 text-left transition ${selected ? 'border-violet-600 bg-violet-600 text-white' : 'border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50'}`}
                    >
                      <span className="block text-sm font-medium">{item.firstName} {item.lastName}</span>
                      <span className={`mt-1 block text-xs ${selected ? 'text-white/80' : 'text-neutral-500'}`}>{item.activeCourse}</span>
                    </button>
                  );
                })}
                {participants.length === 0 ? <EmptyState text="Nejdřív přidej účastníka v sekci Účastníci." /> : null}
              </div>
            </WizardBlock>

            {hasDayChoice ? (
              <WizardBlock number="3" title="Tréninkové dny" completed={flow.trainingDays.length > 0}>
                <div className="space-y-3">
                  <p className="text-sm leading-6 text-neutral-500">
                    Kroužek běží {scheduleDays.join(' i ')}{scheduleTime ? ` (${scheduleTime})` : ''}. Vyber, kdy bude dítě chodit — jeden den, nebo klidně oba. <span className="font-medium text-neutral-900">Cena je stejná</span> a jedna permanentka platí na všechny vybrané dny.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {scheduleDays.map((day) => {
                      const selected = flow.trainingDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleTrainingDay(day)}
                          className={`rounded-xl border p-4 text-left transition ${selected ? 'border-violet-600 bg-violet-600 text-white' : 'border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50'}`}
                        >
                          <span className="block text-sm font-medium">{day}</span>
                          <span className={`mt-1 block text-xs ${selected ? 'text-white/80' : 'text-neutral-500'}`}>{scheduleTime || 'trénink'}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-neutral-500">
                    {flow.trainingDays.length === 0
                      ? 'Zaškrtni alespoň jeden den.'
                      : flow.trainingDays.length === scheduleDays.length
                        ? 'Super — dítě bude chodit oba dny za stejnou cenu.'
                        : `Dítě bude chodit každý týden v den: ${flow.trainingDays.join(', ')}. Kdykoli později to můžeme změnit.`}
                  </p>
                </div>
              </WizardBlock>
            ) : null}

            {!isDocumentOnly && flow.group.orgId === VYS_ORG_ID ? (
              <WizardBlock number={hasDayChoice ? '4' : '3'} title="Slevový kód" completed={!!appliedDiscount}>
                <RewardDiscountPicker
                  product={selectedProduct}
                  participant={participant}
                  code={flow.discountCode}
                  usedRewardCodeIds={usedRewardCodeIds}
                  onCodeChange={(discountCode) => onChange({ ...flow, discountCode, message: null })}
                />
              </WizardBlock>
            ) : null}

            {requiredDocuments.length > 0 ? requiredDocuments.map((doc, idx) => {
              const blockNum = String((isDocumentOnly ? 3 : (flow.group.orgId === VYS_ORG_ID ? 4 : 3)) + (hasDayChoice ? 1 : 0) + idx);
              return (
                <CollapsibleDocBlock key={doc.kind} number={blockNum} title={doc.title} physicalOnly={doc.physicalOnly} completed={docBlockCompleted(doc.kind)} defaultOpen={idx === 0}>
                  {doc.kind === 'gdpr' && (
                    <div className="space-y-3">
                      <p className="rounded-lg border border-neutral-200 bg-white p-4 text-sm leading-6 text-neutral-500">
                        Správce osobních údajů: <span className="font-medium text-neutral-900">{flow.group.orgName ?? 'organizace'}</span>. Zpracováváme jméno, datum narození, zdravotní informace a kontaktní údaje dítěte a zákonného zástupce za účelem organizace sportovní aktivity, vedení docházky a zajištění bezpečnosti. Uchování: po dobu aktivity a 1 rok poté. Máte právo na přístup, opravu a výmaz dle nařízení GDPR (EU) 2016/679.
                      </p>
                      <CheckboxRow label="Souhlasím se zpracováním osobních údajů dítěte a zákonného zástupce dle výše uvedených podmínek." checked={flow.documentValues.gdprConsent} onChange={(checked) => updateDocuments({ gdprConsent: checked })} />
                    </div>
                  )}
                  {doc.kind === 'guardian-consent' && (
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <TextField label="Jméno zákonného zástupce" value={flow.documentValues.parentName} onChange={(value) => updateDocuments({ parentName: value })} />
                        <TextField label="Telefon zákonného zástupce" type="tel" value={flow.documentValues.emergencyPhone} onChange={(value) => updateDocuments({ emergencyPhone: value })} placeholder="+420 ..." />
                        <TextField label="Druhý nouzový kontakt – jméno" value={flow.documentValues.emergencyPhone2Name} onChange={(value) => updateDocuments({ emergencyPhone2Name: value })} placeholder="Jméno a příjmení" />
                        <TextField label="Druhý nouzový kontakt – telefon" type="tel" value={flow.documentValues.emergencyPhone2} onChange={(value) => updateDocuments({ emergencyPhone2: value })} placeholder="+420 ..." />
                      </div>
                      <CheckboxRow label={`Potvrzuji jako zákonný zástupce účast dítěte na aktivitě ${flow.group.orgName ?? 'organizace'}, souhlasím s řádem a přijímám zodpovědnost za správnost údajů uvedených v přihlášce.`} checked={flow.documentValues.guardianConsent} onChange={(checked) => updateDocuments({ guardianConsent: checked })} />
                    </div>
                  )}
                  {doc.kind === 'health' && (
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <TextField label="Zdravotní pojišťovna" value={flow.documentValues.insuranceCompany} onChange={(value) => updateDocuments({ insuranceCompany: value })} placeholder="např. VZP, ČPZP, OZP" />
                        <TextField label="Číslo pojistky" value={flow.documentValues.insuranceNumber} onChange={(value) => updateDocuments({ insuranceNumber: value })} placeholder="123 456 7890" />
                      </div>
                      <TextareaField label="Chronická onemocnění (epilepsie, astma, diabetes, jiné)" value={flow.documentValues.chronicDiseases} onChange={(value) => updateDocuments({ chronicDiseases: value })} placeholder="Žádná / uveďte konkrétně" rows={2} />
                      <div className="grid gap-3 md:grid-cols-2">
                        <TextField label="Alergie (léky, potraviny, prostředí)" value={flow.documentValues.allergies} onChange={(value) => updateDocuments({ allergies: value })} placeholder="Žádné / uveďte konkrétně" />
                        <TextField label="Pravidelné léky – název a dávka" value={flow.documentValues.medication} onChange={(value) => updateDocuments({ medication: value })} placeholder="Bez pravidelných léků" />
                      </div>
                      {flow.documentValues.medication.trim() !== '' && flow.documentValues.medication !== 'Bez pravidelných léků' && (
                        <TextField label="Kdy a jak léky podávat" value={flow.documentValues.medicationSchedule} onChange={(value) => updateDocuments({ medicationSchedule: value })} placeholder="např. 1 tableta ráno po snídani" />
                      )}
                      <TextareaField label="Zdravotní omezení pro pohybovou aktivitu" value={flow.documentValues.healthLimits} onChange={(value) => updateDocuments({ healthLimits: value })} placeholder="Bez omezení / uveďte konkrétně" rows={2} />
                      {selectedProduct.type === 'Tabor' && (
                        <div className="grid gap-3 md:grid-cols-2">
                          <TextField label="Plavecká způsobilost" value={flow.documentValues.canSwim} onChange={(value) => updateDocuments({ canSwim: value })} placeholder="Ano / Ne / Pouze s dohledem" />
                          <TextField label="Tetanus – rok přeočkování" value={flow.documentValues.tetanus} onChange={(value) => updateDocuments({ tetanus: value })} placeholder="např. 2022 nebo Nevím" />
                        </div>
                      )}
                      {!requiredDocuments.some((d) => d.kind === 'guardian-consent') && (
                        <div className="grid gap-3 md:grid-cols-2">
                          <TextField label="Jméno zákonného zástupce" value={flow.documentValues.parentName} onChange={(value) => updateDocuments({ parentName: value })} />
                          <TextField label="Nouzový telefon" type="tel" value={flow.documentValues.emergencyPhone} onChange={(value) => updateDocuments({ emergencyPhone: value })} placeholder="+420 ..." />
                        </div>
                      )}
                      <TextareaField label="Poznámka pro organizátory" value={flow.documentValues.notes} onChange={(value) => updateDocuments({ notes: value })} placeholder="Libovolné informace navíc..." rows={2} />
                      <CheckboxRow label="Potvrzuji, že veškeré zdravotní informace, alergie, léky a nouzové kontakty jsou pravdivé a aktuální." checked={flow.documentValues.healthAccuracy} onChange={(checked) => updateDocuments({ healthAccuracy: checked })} />
                    </div>
                  )}
                  {doc.kind === 'departure' && (
                    <div className="space-y-4">
                      <TextareaField label="Osoby oprávněné k vyzvednutí (jméno, příjmení, vztah k dítěti)" value={flow.documentValues.pickupPeople} onChange={(value) => updateDocuments({ pickupPeople: value })} placeholder="např. Jana Nováková (matka), Pavel Novák (otec)" rows={2} />
                      <CheckboxRow label="Souhlasím s pravidly vyzvedávání a s případným samostatným odchodem dítěte po skončení aktivity." checked={flow.documentValues.departureConsent} onChange={(checked) => updateDocuments({ departureConsent: checked })} />
                    </div>
                  )}
                  {doc.kind === 'infection-free' && (
                    <div className="space-y-3">
                      <div className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6">
                        <p className="font-bold text-amber-800">⚠️ Tento dokument se nevyplňuje online – přineste ho první den tábora.</p>
                        <p className="text-amber-700">Na dokumentu musí být <strong>datum dne odjezdu</strong> (max. 1 den předem). Starší datum je neplatné.</p>
                        <a href="/bezinfekcnost-vzor.html" target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-amber-600">
                          <FileDown size={14} /> Stáhnout vzor / tisknout
                        </a>
                      </div>
                      <CheckboxRow label="Beru na vědomí, že první den tábora přinesu podepsané prohlášení o bezinfekčnosti s datumem dne odjezdu." checked={flow.documentValues.infectionFree} onChange={(checked) => updateDocuments({ infectionFree: checked })} />
                    </div>
                  )}
                  {doc.kind === 'packing' && (
                    <div className="space-y-4">
                      <ul className="rounded-lg border border-neutral-200 bg-white p-4 space-y-1.5 text-sm text-neutral-500">
                        <li>• Oblečení na pohyb (min. 3 sady), náhradní obuv</li>
                        <li>• Pyžamo, ručník, hygienické potřeby</li>
                        <li>• Spací pytel nebo deka a polštář</li>
                        <li>• Láhev na vodu (min. 0,5 l)</li>
                        <li>• Kartička zdravotní pojišťovny</li>
                        <li>• Léky v originálním balení s návodem k podávání</li>
                        <li>• Kapesné dle vlastního uvážení</li>
                      </ul>
                      <CheckboxRow label="Potvrzuji, že jsem se seznámil/a s táborovým řádem, dítě má potřebné vybavení, kartičku pojišťovny a případné léky v originálním balení s pokyny k podávání." checked={flow.documentValues.packingConfirmed} onChange={(checked) => updateDocuments({ packingConfirmed: checked })} />
                    </div>
                  )}
                  {doc.kind === 'workshop-terms' && (
                    <div className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <TextField label="Jméno zákonného zástupce" value={flow.documentValues.parentName} onChange={(value) => updateDocuments({ parentName: value })} />
                        <TextField label="Nouzový telefon" type="tel" value={flow.documentValues.emergencyPhone} onChange={(value) => updateDocuments({ emergencyPhone: value })} placeholder="+420 ..." />
                      </div>
                      <p className="rounded-lg border border-neutral-200 bg-white p-4 text-sm leading-6 text-neutral-500">
                        <span className="font-medium text-neutral-900">Storno podmínky: </span>Více než 14 dní před zahájením – plná náhrada. 7–14 dní – 50 % ceny. Méně než 7 dní nebo nenastoupení – bez náhrady.
                      </p>
                      <CheckboxRow label={`Jako zákonný zástupce souhlasím s účastí dítěte na fyzicky náročné aktivitě, s řádem ${flow.group.orgName ?? 'organizace'} a storno podmínkami.`} checked={flow.documentValues.workshopTermsAccepted} onChange={(checked) => updateDocuments({ workshopTermsAccepted: checked })} />
                      <CheckboxRow label={`Souhlasím se zveřejněním fotografií a videozáznamů dítěte z aktivit na webu a v propagačních materiálech ${flow.group.orgName ?? 'organizace'}.`} checked={flow.documentValues.photoConsent} onChange={(checked) => updateDocuments({ photoConsent: checked })} />
                    </div>
                  )}
                </CollapsibleDocBlock>
              );
            }) : (
              <WizardBlock number={String(isDocumentOnly ? 3 : (flow.group.orgId === VYS_ORG_ID ? 4 : 3))} title="Dokumenty">
                <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">Tento produkt nemá před platbou povinný dokumentový balíček. Po zaplacení se vytvoří QR ticket.</p>
              </WizardBlock>
            )}

            {requiredDocuments.some((doc) => !doc.physicalOnly) ? (
              <button
                type="button"
                onClick={saveDocumentsForLater}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                {savedForLater ? <Check size={17} /> : <RefreshCw size={17} />}
                {savedForLater ? 'Uloženo – příště se předvyplní' : 'Uložit údaje pro příště'}
              </button>
            ) : null}
          </div>

          <aside className="self-start rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <h3 className="text-sm font-medium text-neutral-400">Souhrn</h3>
            <div className="mt-4 space-y-3">
              <SummaryRow label="Produkt" value={selectedProduct.title} />
              <SummaryRow label="Varianta" value={selectedProduct.priceLabel} />
              <SummaryRow label="Účastník" value={participant ? `${participant.firstName} ${participant.lastName}` : 'Nezvolen'} />
              <SummaryRow label="Dokumenty" value={requiredDocuments.length ? `${requiredDocuments.length} povinné` : 'bez povinných'} />
              {appliedDiscount ? <SummaryRow label="Sleva" value={`-${appliedDiscount.percent} % · ${appliedDiscount.code}`} /> : null}
              {!isDocumentOnly ? <SummaryRow label="K zaplacení" value={formatCurrency(discountPreview.finalAmount)} /> : null}
            </div>
            {requiredDocuments.length > 0 ? (
              <div className="mt-5 space-y-2">
                {requiredDocuments.map((document) => (
                  document.physicalOnly ? (
                    <div key={document.kind} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <AlertTriangle className="mt-0.5 shrink-0 text-amber-500" size={16} />
                      <div>
                        <p className="text-xs font-medium text-neutral-900">{document.title}</p>
                        <p className="mt-1 text-[11px] leading-4 text-amber-700">{document.physicalNote ?? document.description}</p>
                      </div>
                    </div>
                  ) : (
                    <div key={document.kind} className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-white p-3">
                      <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-500" size={17} />
                      <div>
                        <p className="text-xs font-medium text-neutral-900">{document.title}</p>
                        <p className="mt-1 text-[11px] leading-4 text-neutral-500">{document.description}</p>
                      </div>
                    </div>
                  )
                ))}
              </div>
            ) : null}
            {flow.message ? <p className="mt-4 rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-500">{flow.message}</p> : null}
            {flow.paymentClientSecret && flow.paymentIntentId && !isDocumentOnly ? (
              <div className="mt-5">
                <EmbeddedPaymentForm
                  clientSecret={flow.paymentClientSecret}
                  amountLabel={flow.paymentAmountLabel ?? formatCurrency(discountPreview.finalAmount)}
                  submitLabel="Potvrdit platbu"
                  onPaid={() => onPaymentPaid(flow.paymentIntentId as string)}
                  onError={(message) => onChange({ ...flow, message })}
                />
              </div>
            ) : (
              <button type="button" disabled={flow.isSubmitting} onClick={onCheckout} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
                {isDocumentOnly ? <FileCheck2 size={17} /> : <CreditCard size={17} />}
                {flow.isSubmitting ? (isDocumentOnly ? 'Ukládám dokumenty...' : 'Připravuji platbu...') : (isDocumentOnly ? 'Uložit dokumenty' : `Uložit dokumenty a zaplatit ${formatCurrency(discountPreview.finalAmount)}`)}
              </button>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function RewardDiscountPicker({
  product,
  participant,
  code,
  usedRewardCodeIds,
  onCodeChange,
}: {
  product: ParentProduct;
  participant?: ParentParticipant;
  code: string;
  usedRewardCodeIds: string[];
  onCodeChange: (code: string) => void;
}) {
  const eligibleDiscounts = rewardDiscountCodesForParticipant(participant, usedRewardCodeIds).filter((discount) => discount.appliesTo === product.type);
  const appliedDiscount = findRewardDiscountByCode(code, product.type, participant, usedRewardCodeIds);
  const discountPreview = applyRewardDiscount(product.price, appliedDiscount);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          value={code}
          onChange={(event) => onCodeChange(event.target.value.toUpperCase())}
          className="rounded-lg border border-neutral-200 bg-white px-4 py-3 font-mono text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500"
          placeholder="Např. ELISKA-KROUZEK-5"
        />
        <button
          type="button"
          disabled={eligibleDiscounts.length === 0}
          onClick={() => onCodeChange(eligibleDiscounts[0]?.code ?? code)}
          className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-55"
        >
          Vložit dosažený
        </button>
      </div>
      {eligibleDiscounts.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {eligibleDiscounts.map((discount) => (
            <button key={discount.id} type="button" onClick={() => onCodeChange(discount.code)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700 transition hover:bg-neutral-50">
              {discount.code} · {discount.percent} %
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-neutral-200 bg-white p-3 text-xs leading-5 text-neutral-500">Pro tenhle typ produktu zatím dítě nemá aktivní slevu. Slevy se odemykají v měsíční cestě podle XP.</p>
      )}
      {appliedDiscount ? (
        <div className="grid gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-neutral-900 sm:grid-cols-2">
          <span>Sleva {appliedDiscount.percent} %: <span className="text-emerald-600">-{formatCurrency(discountPreview.discountAmount)}</span></span>
          <span className="sm:text-right">K zaplacení: {formatCurrency(discountPreview.finalAmount)}</span>
        </div>
      ) : code.trim() ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-600">Kód nejde použít pro vybraný produkt nebo už byl použitý.</p>
      ) : null}
    </div>
  );
}

function OrganizationsSection({ organizations, parentProfileId, onChanged }: { organizations: ParentOrganizations; parentProfileId?: string; onChanged: () => void }) {
  const [selectedOrgId, setSelectedOrgId] = useState(organizations.available[0]?.id ?? '');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const joined = organizations.joined;
  const available = organizations.available;

  async function handleJoin() {
    if (!selectedOrgId) return;
    setBusyId('join');
    setMessage(null);
    try {
      const result = await joinParentOrganization(selectedOrgId, parentProfileId);
      setMessage(`Přidali jsme tě do organizace ${result.name}. Načítáme její nabídku…`);
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Organizaci se nepodařilo přidat.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleLeave(orgId: string, name: string) {
    setBusyId(orgId);
    setMessage(null);
    try {
      await leaveParentOrganization(orgId, parentProfileId);
      setMessage(`Opustil jsi organizaci ${name}.`);
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Organizaci se nepodařilo opustit.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <Panel className="p-5">
        <SectionTitle icon={<Building2 size={18} />} title="Moje organizace" subtitle="kluby, jejichž kroužky, tábory a workshopy vidíš" />
      </Panel>

      {message ? <p className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">{message}</p> : null}

      <div className="grid items-start gap-4 xl:grid-cols-2">
        {joined.map((org) => (
          <div key={org.id} className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-brand-purple-light text-brand-purple">
                  <Building2 size={20} />
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-neutral-900">{org.name}</p>
                  <p className="mt-0.5 text-[12px] text-neutral-400">
                    {org.orgType === 'vys' ? 'TeamVYS' : 'Sportovní organizace'} · {org.productCount} {productCountLabel(org.productCount)}
                  </p>
                </div>
              </div>
              {org.orgType === 'vys' || joined.length <= 1 ? (
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-400">hlavní</span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleLeave(org.id, org.name)}
                  disabled={busyId === org.id}
                  className="rounded-lg border border-neutral-200 px-3 py-1.5 text-[12px] font-medium text-neutral-500 transition hover:border-red-200 hover:text-red-500 disabled:opacity-50"
                >
                  {busyId === org.id ? 'Odebírám…' : 'Opustit'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {available.length > 0 ? (
        <Panel className="p-5">
          <div className="flex flex-col gap-3">
            <SectionTitle icon={<Plus size={18} />} title="Přidat organizaci" subtitle="vyber klub a uvidíš jeho nabídku v Platbách" />
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <select
                  value={selectedOrgId}
                  onChange={(event) => setSelectedOrgId(event.target.value)}
                  className="w-full appearance-none rounded-lg border border-neutral-200 bg-white px-3 py-2.5 pr-9 text-sm text-neutral-900 focus:border-brand-purple focus:outline-none"
                >
                  {available.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              </div>
              <button
                type="button"
                onClick={handleJoin}
                disabled={!selectedOrgId || busyId === 'join'}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 ${BRAND_GRADIENT}`}
              >
                <Plus size={16} />
                {busyId === 'join' ? 'Přidávám…' : 'Přidat'}
              </button>
            </div>
          </div>
        </Panel>
      ) : (
        <p className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-400">
          Jsi členem všech dostupných organizací.
        </p>
      )}
    </div>
  );
}

function productCountLabel(count: number): string {
  if (count === 1) return 'aktivita';
  if (count >= 2 && count <= 4) return 'aktivity';
  return 'aktivit';
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`self-start rounded-xl border border-neutral-200 bg-white ${className}`}>{children}</section>;
}

function SectionTitle({ icon: _icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <>
      <div>
        <h2 className="text-[15px] font-medium text-neutral-900">{title}</h2>
        <p className="mt-0.5 text-[13px] text-neutral-400">{subtitle}</p>
      </div>
    </>
  )
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-3">
      <p className="text-base font-semibold text-neutral-900">{value}</p>
      <p className="mt-1 text-[11px] text-neutral-400">{label}</p>
    </div>
  );
}

function HeroSignal({ value, label, tone }: { value: string; label: string; tone: 'cyan' | 'mint' | 'orange' | 'purple' }) {
  const toneClass = {
    cyan: 'text-brand-cyan',
    mint: 'text-brand-mint',
    orange: 'text-brand-orange',
    purple: 'text-brand-purple-light',
  }[tone];

  return (
    <div className="min-w-[68px] rounded-[14px] bg-white/10 px-2.5 py-2 ring-1 ring-white/10">
      <p className={`text-sm font-black leading-none ${toneClass}`}>{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase text-white/60">{label}</p>
    </div>
  );
}

function ActionTile({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex flex-col items-start gap-4 rounded-2xl border border-neutral-200 bg-white p-5 text-left transition-all hover:-translate-y-1 hover:border-violet-200 hover:shadow-[0_8px_28px_rgba(107,61,245,0.14)]">
      <span className={`grid h-12 w-12 place-items-center rounded-full text-white shadow-[0_6px_14px_rgba(232,76,196,0.28)] ${BRAND_GRADIENT}`}>{icon}</span>
      <span className="min-w-0 w-full">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-bold text-neutral-900">{label}</span>
          <ArrowRight size={15} className="shrink-0 text-neutral-300 transition-all group-hover:translate-x-0.5 group-hover:text-violet-500" />
        </span>
        <span className="mt-1.5 block text-[13px] leading-relaxed text-neutral-500">{value}</span>
      </span>
    </button>
  );
}

function MiniInput({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }) {
  function handleChange(raw: string) {
    onChange(type === 'tel' ? filterPhone(raw) : raw);
  }
  return (
    <label className="grid gap-2 text-sm font-medium text-neutral-900">
      {label}
      <input type={type} value={value} onChange={(event) => handleChange(event.target.value)} placeholder={placeholder} inputMode={type === 'tel' ? 'tel' : undefined} className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500" />
    </label>
  );
}

function MiniSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-neutral-900">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function MiniTextarea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-neutral-900">
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500" />
    </label>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5">
      <p className="text-[11px] font-medium text-neutral-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-neutral-800">{value}</p>
    </div>
  );
}

function CapacityBar({ current, total }: { current: number; total: number }) {
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const remaining = Math.max(0, total - current);

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-neutral-500">Aktuálně {current}/{total} dětí</span>
        <span className="text-neutral-400">{remaining} volných míst</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200">
        <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function DetailInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-[72px] rounded-lg border border-neutral-200 bg-white p-3">
      <p className="text-[10px] font-medium text-neutral-400">{label}</p>
      <p className="mt-1 text-[13px] font-medium leading-5 text-neutral-900">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-lg border border-neutral-200 bg-white p-3 text-sm leading-6 text-neutral-500">{text}</p>;
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const width = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="mt-4">
      <div className="flex justify-between text-xs text-neutral-400">
        <span>XP {value}</span>
        <span>{max}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-neutral-100">
        <div className={`h-full rounded-full ${BRAND_GRADIENT}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function AccordionPanel({ icon: _icon, title, count, children }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <section className="self-start rounded-xl border border-neutral-200 bg-white p-5">
      <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)} className="flex w-full cursor-pointer items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-medium text-neutral-900">{title}</span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">{count}</span>
        </div>
        <ChevronDown className={`shrink-0 text-neutral-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} size={16} />
      </button>
      <CollapsibleContent open={isOpen} className="mt-4 space-y-2">{children}</CollapsibleContent>
    </section>
  );
}

function CollapsibleContent({ open, children, className = '' }: { open: boolean; children: React.ReactNode; className?: string }) {
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
          <motion.div
            initial={{ scale: 0.985 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.985 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className={className}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone: 'green' | 'pink' | 'purple' | 'cyan' }) {
  const toneClass = {
    green: 'bg-emerald-100 text-emerald-700',
    pink: 'bg-red-50 text-red-600',
    purple: 'bg-neutral-100 text-neutral-600',
    cyan: 'bg-neutral-100 text-neutral-600',
  }[tone];

  return (
    <div className="grid gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
      <span className="text-neutral-800">{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs ${toneClass}`}>{value}</span>
    </div>
  );
}

function ParticipantDocumentRow({ document, onOpenDocument }: { document: ParentDocument; onOpenDocument: (document: ParentDocument) => void }) {
  const isSigned = document.status === 'signed';
  const toneClass = isSigned ? 'bg-emerald-50 text-emerald-700' : document.status === 'draft' ? 'bg-red-50 text-red-600' : 'bg-red-50 text-red-600';
  const content = (
    <>
      <span className="font-medium text-neutral-900">{document.title}</span>
      <span className="flex flex-wrap items-center gap-2 sm:justify-end">
        <span className={`rounded-full px-3 py-1 text-xs ${toneClass}`}>{documentStatusLabel(document.status)}</span>
        {!isSigned ? <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">Doplnit</span> : null}
      </span>
    </>
  );

  if (isSigned) {
    return (
      <div className="grid gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-sm transition-all duration-300 sm:grid-cols-[1fr_auto] sm:items-center">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpenDocument(document)}
      className="grid w-full gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-left text-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-300 hover:bg-neutral-50 sm:grid-cols-[1fr_auto] sm:items-center"
    >
      {content}
    </button>
  );
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  const classes = status === 'signed'
    ? 'bg-emerald-50 text-emerald-700'
    : status === 'draft'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-red-50 text-red-600';
  return <span className={`inline-flex items-center justify-center rounded-full px-3 py-2 text-xs ${classes}`}>{documentStatusLabel(status)}</span>;
}

function DocumentChecklist({ title, productType }: { title: string; productType: ActivityType }) {
  const { products } = useParentPortalData();
  const sampleProduct = products.find((product) => product.type === productType);
  const documents = sampleProduct ? requiredDocumentsForProduct(sampleProduct) : [];

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h3 className="text-sm font-medium text-neutral-900">{title}</h3>
      <div className="mt-3 grid gap-2">
        {documents.map((document) => (
          document.physicalOnly ? (
            <div key={document.kind} className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5">
              <div className="flex gap-2">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                <div>
                  <strong className="text-neutral-900">{document.title}</strong>
                  <span className="text-neutral-500"> · {document.description}</span>
                </div>
              </div>
              {document.physicalNote ? (
                <p className="ml-[23px] text-[11px] font-bold leading-4 text-amber-700">{document.physicalNote}</p>
              ) : null}
              {document.pdfUrl ? (
                <a
                  href={document.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-[23px] inline-flex w-fit items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-amber-600"
                >
                  <FileDown size={13} />
                  Stáhnout vzor / tisknout
                </a>
              ) : null}
            </div>
          ) : (
            <div key={document.kind} className="flex gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs leading-5 text-neutral-500">
              <Check size={15} className="mt-0.5 shrink-0 text-emerald-500" />
              <span><strong className="text-neutral-900">{document.title}</strong><span className="text-neutral-500"> · {document.description}</span></span>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

function TrainerRow({ trainer }: { trainer: ParentProductTrainer }) {
  return (
    <div className="grid items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 sm:grid-cols-[42px_minmax(0,1fr)_auto]">
      <Image src={trainer.profilePhotoUrl} alt={trainer.name} width={42} height={42} className="h-[42px] w-[42px] rounded-xl bg-neutral-100 object-contain p-1.5" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-5 text-neutral-900">{trainer.name}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-neutral-500"><Phone size={13} /> <span className="truncate">{trainer.phone}</span></p>
      </div>
      <div className="w-full rounded-lg bg-neutral-100 px-3 py-2 text-left sm:w-auto sm:min-w-[82px] sm:text-center">
        <p className="text-sm font-semibold text-neutral-900">{trainer.qrTricksApproved}</p>
        <p className="text-[9px] text-neutral-400">QR triků</p>
      </div>
    </div>
  );
}

function CoachReviewProfile({ coach }: { coach: ParentProductTrainer }) {
  return (
    <div className="grid items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-[64px_minmax(0,1fr)_auto]">
      <Image src={coach.profilePhotoUrl} alt={coach.name} width={64} height={64} className="h-16 w-16 rounded-xl border border-neutral-200 bg-white object-contain p-2" />
      <div className="min-w-0">
        <p className="text-base font-semibold text-neutral-900">{coach.name}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-neutral-500"><Phone size={13} /> <span>{coach.phone}</span></p>
        <p className="mt-1 truncate text-xs text-neutral-500">{coach.locations.join(' · ')}</p>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left sm:text-center">
        <p className="text-sm font-semibold text-neutral-900">{coach.qrTricksApproved}</p>
        <p className="text-[9px] text-neutral-400">QR triků</p>
      </div>
    </div>
  );
}

function WizardBlock({ number, title, completed = false, children }: { number: string; title: string; completed?: boolean; children: React.ReactNode }) {
  return (
    <section className={`rounded-xl border bg-white transition-colors ${completed ? 'border-emerald-300' : 'border-neutral-200'}`}>
      <div className="mb-3 flex items-center gap-2 p-4 pb-0">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium text-white transition-colors ${completed ? 'bg-emerald-500' : 'bg-violet-600'}`}>{completed ? <Check size={13} /> : number}</span>
        <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
      </div>
      <div className="p-4 pt-3">{children}</div>
    </section>
  );
}

function CollapsibleDocBlock({ number, title, physicalOnly, completed = false, defaultOpen = false, children }: { number: string; title: string; physicalOnly?: boolean; completed?: boolean; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const badgeBg = completed ? 'bg-emerald-500' : physicalOnly ? 'bg-amber-500' : 'bg-violet-600';
  const borderCls = completed ? 'border-emerald-300' : physicalOnly ? 'border-amber-200' : 'border-neutral-200';
  return (
    <section className={`rounded-xl border bg-white transition-colors ${borderCls}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white transition-colors ${badgeBg}`}>
          {completed ? <Check size={13} /> : number}
        </span>
        <span className="flex-1 text-base font-medium text-neutral-900">{title}</span>
        {!completed && physicalOnly ? <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">Přinest fyzicky</span> : null}
        {completed ? <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">Hotovo</span> : null}
        <ChevronDown size={17} className={`shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <div className="space-y-4 border-t border-neutral-200 p-4">{children}</div> : null}
    </section>
  );
}

function filterPhone(raw: string): string {
  // allow leading +, then only digits and spaces
  const stripped = raw.replace(/[^\d+\s]/g, '');
  // ensure + only at the start
  return stripped.startsWith('+') ? '+' + stripped.slice(1).replace(/\+/g, '') : stripped.replace(/\+/g, '');
}

function TextField({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  function handleChange(raw: string) {
    onChange(type === 'tel' ? filterPhone(raw) : raw);
  }
  return (
    <label className="grid gap-2 text-sm font-medium text-neutral-900">
      {label}
      <input type={type} value={value} onChange={(event) => handleChange(event.target.value)} placeholder={placeholder} inputMode={type === 'tel' ? 'tel' : undefined} className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500" />
    </label>
  );
}

function TextareaField({ label, value, onChange, placeholder, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; rows?: number }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-neutral-900">
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} placeholder={placeholder} className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500" />
    </label>
  );
}

function CheckboxRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 accent-violet-600" />
      <span>{label}</span>
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-neutral-200 pb-3 last:border-b-0 last:pb-0">
      <span className="text-xs font-medium text-neutral-400">{label}</span>
      <span className="text-right text-sm font-medium text-neutral-900">{value}</span>
    </div>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-sm font-medium text-neutral-900">Hodnocení</p>
      <div className="mt-3 flex gap-2">
        {[1, 2, 3, 4, 5].map((item) => (
          <button key={item} type="button" onClick={() => onChange(item)} className="rounded-lg bg-neutral-50 p-2 text-violet-500 transition hover:scale-105" aria-label={`${item} hvězdiček`}>
            <Star size={28} fill={item <= value ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-xs font-medium text-neutral-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-neutral-900">{value}</p>
    </div>
  );
}

function mergeProducts(baseProducts: ParentProduct[], extraProducts: ParentProduct[]) {
  const products = new Map<string, ParentProduct>();
  for (const product of baseProducts) products.set(product.id, product);
  for (const product of extraProducts) {
    const existing = products.get(product.id);
    if (!existing) {
      products.set(product.id, product);
      continue;
    }
    // Keep org fields from server rows when client rows are missing them.
    products.set(product.id, {
      ...existing,
      ...product,
      orgId: product.orgId ?? existing.orgId,
      orgName: product.orgName ?? existing.orgName,
    });
  }
  return Array.from(products.values());
}

function buildProductGroups(products: ParentProduct[], coaches: ParentProductTrainer[] = []): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();
  const coachById = new Map(coaches.map((coach) => [coach.id, coach]));

  for (const product of products) {
    const id = product.type === 'Krouzek'
      ? product.id.replace(/-15$/, '')
      : product.type === 'Tabor'
        ? product.id.replace(/-t\d+$/, '')
        : product.id;
    const existing = groups.get(id);
    const resolvedTrainers = (product.coachIds ?? [])
      .map((coachId) => coachById.get(coachId))
      .filter((coach): coach is ParentProductTrainer => Boolean(coach));
    const fallbackTrainers = coachById.size === 0 ? trainersForProduct(product) : [];
    const productTrainers = resolvedTrainers.length > 0 ? resolvedTrainers : fallbackTrainers;

    if (existing) {
      existing.variants.push(product);
      existing.gallery = Array.from(new Set([...existing.gallery, ...product.gallery]));
      if (productTrainers.length > 0) {
        const existingIds = new Set(existing.trainers.map((trainer) => trainer.id));
        for (const trainer of productTrainers) {
          if (!existingIds.has(trainer.id)) existing.trainers.push(trainer);
        }
      }
      continue;
    }

    groups.set(id, {
      id,
      type: product.type,
      title: product.type === 'Krouzek' ? `${product.title} · ${product.venue}` : product.title,
      city: product.city,
      place: product.place,
      venue: product.venue,
      primaryMeta: product.primaryMeta,
      secondaryMeta: product.secondaryMeta,
      description: product.description,
      badge: product.badge,
      heroImage: product.heroImage,
      gallery: product.gallery.length ? product.gallery : [product.heroImage],
      capacityTotal: product.capacityTotal,
      capacityCurrent: product.capacityCurrent,
      interestCount: product.interestCount ?? 0,
      canPurchase: product.canPurchase,
      importantInfo: product.importantInfo,
      trainingFocus: product.trainingFocus,
      trainers: productTrainers,
      variants: [product],
      orgId: product.orgId,
      orgName: product.orgName,
    });
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    variants: group.variants.sort((a, b) => (a.entriesTotal ?? a.price) - (b.entriesTotal ?? b.price)),
  }));
}

function productSortScore(group: ProductGroup, participant?: ParentParticipant) {
  if (!participant) return group.type === 'Krouzek' && normalizeLocation(group.city) === 'vyskov' ? 1 : 2;

  const participantCourse = normalizeLocation(participant.activeCourse);
  const groupPlace = normalizeLocation(group.place);
  const groupCity = normalizeLocation(group.city);

  if (participantCourse && groupPlace === participantCourse) return 0;
  if (participantCourse && participantCourse.includes(groupCity)) return 1;
  if (groupCity === 'vyskov') return 2;
  return 3;
}

function workshopPurchaseGate(group: ProductGroup) {
  if (group.type !== 'Workshop') return { canPurchase: true };
  if (group.canPurchase === true) return { canPurchase: true };
  if (group.interestCount >= WORKSHOP_INTEREST_THRESHOLD) return { canPurchase: true };

  const eventDate = parseProductDate(group.primaryMeta);
  if (!eventDate) return { canPurchase: true };

  return { canPurchase: Date.now() >= eventDate.getTime() - WORKSHOP_PAYMENT_OPEN_DAYS * MS_PER_DAY };
}

function parseProductDate(value: string) {
  const isoMatch = /(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (isoMatch) return new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])));

  const czechMatch = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(value);
  if (czechMatch) return new Date(Date.UTC(Number(czechMatch[3]), Number(czechMatch[2]) - 1, Number(czechMatch[1])));

  return null;
}

function findDocumentTarget(document: ParentDocument, groups: ProductGroup[], participants: ParentParticipant[]) {
  const participant = participants.find((item) => normalizePersonName(`${item.firstName} ${item.lastName}`) === normalizePersonName(document.participantName)) ?? participants[0];
  if (!participant) return null;
  const participantCourse = normalizeLocation(participant.activeCourse);
  const activityTitle = normalizeLocation(document.activityTitle);

  const matchingGroup = groups.find((group) => {
    if (group.type !== document.activityType) return false;
    const groupPlace = normalizeLocation(group.place);
    const groupTitle = normalizeLocation(group.title);
    const groupCity = normalizeLocation(group.city);

    if (document.activityType === 'Krouzek' && participantCourse && groupPlace === participantCourse) return true;
    return activityTitle.includes(groupCity) || groupTitle.includes(activityTitle) || activityTitle.includes(groupTitle);
  }) ?? groups.find((group) => group.type === document.activityType);

  if (!matchingGroup || !participant) return null;

  const product = matchingGroup.variants.find((variant) => {
    if (document.activityType === 'Krouzek') return variant.entriesTotal === 10;
    return true;
  }) ?? matchingGroup.variants[0];

  return { group: matchingGroup, product, participant };
}

async function saveRequiredDocuments(product: ParentProduct, participant: ParentParticipant, values: DocumentFormValues, documents: RequiredDocumentTemplate[], parentProfileId?: string) {
  if (documents.length === 0) return;

  const participantName = `${participant.firstName} ${participant.lastName}`;
  await saveCourseDocuments({
    parentProfileId,
    productId: product.id,
    participantId: participant.id,
    participantName,
    participantFirstName: participant.firstName,
    participantLastName: participant.lastName,
    documents: documents.map((document) => ({
      kind: document.kind,
      title: document.title,
      parentName: values.parentName,
      payload: documentPayload(document, product, participantName, values),
    })),
  });
}

function validateRequiredDocuments(product: ParentProduct, values: DocumentFormValues, documents: RequiredDocumentTemplate[]) {
  if (documents.length === 0) return null;

  const isWorkshop = product.type === 'Workshop';
  const requiredFields: Array<[string, string]> = isWorkshop
    ? [
        ['jméno rodiče', values.parentName],
        ['nouzový telefon', values.emergencyPhone],
        ['alergie', values.allergies],
        ['léky', values.medication],
        ['zdravotní omezení', values.healthLimits],
      ]
    : [
        ['jméno rodiče', values.parentName],
        ['nouzový telefon', values.emergencyPhone],
        ['zdravotní pojišťovna', values.insuranceCompany],
        ['alergie', values.allergies],
        ['léky', values.medication],
        ['zdravotní omezení', values.healthLimits],
        ['vyzvedávání a odchod', values.pickupPeople],
      ];
  const missing = requiredFields.filter(([, value]) => value.trim().length === 0).map(([label]) => label);
  if (missing.length > 0) return `Vyplň prosím všechny dokumenty: ${missing.join(', ')}.`;

  const requiredKinds = new Set(documents.map((document) => document.kind));
  if (requiredKinds.has('gdpr') && !values.gdprConsent) return 'Potvrď prosím GDPR souhlas.';
  if (requiredKinds.has('guardian-consent') && !values.guardianConsent) return 'Potvrď prosím souhlas zákonného zástupce.';
  if (requiredKinds.has('health') && !values.healthAccuracy) return 'Potvrď prosím pravdivost zdravotních informací.';
  if (requiredKinds.has('departure') && !values.departureConsent) return 'Potvrď prosím pravidla vyzvedávání a odchodu.';
  if (product.type === 'Tabor' && requiredKinds.has('infection-free') && !values.infectionFree) return 'U tábora je potřeba potvrdit bezinfekčnost.';
  if (product.type === 'Tabor' && requiredKinds.has('packing') && !values.packingConfirmed) return 'U tábora je potřeba potvrdit věci s sebou a pokyny.';
  if (isWorkshop && requiredKinds.has('workshop-terms') && !values.workshopTermsAccepted) return 'Potvrď prosím přihlášku a podmínky workshopu.';
  if (isWorkshop && requiredKinds.has('workshop-terms') && !values.photoConsent) return 'Potvrď prosím souhlas s focením a natáčením.';

  return null;
}

function documentPayload(document: RequiredDocumentTemplate, product: ParentProduct, participantName: string, values: DocumentFormValues) {
  const common = {
    documentKind: document.kind,
    documentTitle: document.title,
    productId: product.id,
    productTitle: product.title,
    activityType: product.type,
    productPlace: product.place,
    participantName,
    parentName: values.parentName,
    emergencyPhone: values.emergencyPhone,
    notes: values.notes,
  };

  if (document.kind === 'gdpr') {
    return {
      ...common,
      dataProcessingConsent: values.gdprConsent,
      scope: `osobní údaje dítěte a zákonného zástupce pro aktivitu ${product.orgName || 'organizace'}`,
    };
  }

  if (document.kind === 'guardian-consent') {
    return {
      ...common,
      emergencyPhone2Name: values.emergencyPhone2Name,
      emergencyPhone2: values.emergencyPhone2,
      guardianConsent: values.guardianConsent,
      rulesAccepted: values.guardianConsent,
      activityConsent: values.guardianConsent,
    };
  }

  if (document.kind === 'health') {
    return {
      ...common,
      insuranceCompany: values.insuranceCompany,
      insuranceNumber: values.insuranceNumber,
      chronicDiseases: values.chronicDiseases,
      healthLimits: values.healthLimits,
      allergies: values.allergies,
      medication: values.medication,
      medicationSchedule: values.medicationSchedule,
      canSwim: values.canSwim,
      tetanus: values.tetanus,
      healthAccuracy: values.healthAccuracy,
    };
  }

  if (document.kind === 'departure') {
    return {
      ...common,
      pickupPeople: values.pickupPeople,
      departureConsent: values.departureConsent,
    };
  }

  if (document.kind === 'infection-free') {
    return {
      ...common,
      infectionFree: values.infectionFree,
      declaredFor: product.title,
    };
  }

  if (document.kind === 'packing') {
    return {
      ...common,
      packingConfirmed: values.packingConfirmed,
      medication: values.medication,
      medicationSchedule: values.medicationSchedule,
      insuranceCompany: values.insuranceCompany,
      insuranceNumber: values.insuranceNumber,
    };
  }

  if (document.kind === 'workshop-terms') {
    return {
      ...common,
      workshopTermsAccepted: values.workshopTermsAccepted,
      photoConsent: values.photoConsent,
      guardianConsent: values.workshopTermsAccepted,
      stornoConditions: `Storno podmínky ${product.orgName || 'organizace'} · bez nároku na náhradu při odhlašování do 48 h před začátkem.`,
    };
  }

  return common;
}

// Reusable document fields the parent can save and have auto-prefilled next
// time. Consent checkboxes are intentionally NOT persisted — they must be
// actively confirmed for every purchase.
const SAVED_DOC_DEFAULTS_KEY = 'teamvys-doc-defaults';

type SavedDocumentDefaults = Pick<
  DocumentFormValues,
  | 'parentName'
  | 'emergencyPhone'
  | 'emergencyPhone2Name'
  | 'emergencyPhone2'
  | 'insuranceCompany'
  | 'insuranceNumber'
  | 'chronicDiseases'
  | 'healthLimits'
  | 'allergies'
  | 'medication'
  | 'medicationSchedule'
  | 'canSwim'
  | 'tetanus'
  | 'pickupPeople'
>;

function readSavedDocumentDefaults(): Partial<SavedDocumentDefaults> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SAVED_DOC_DEFAULTS_KEY);
    return raw ? (JSON.parse(raw) as Partial<SavedDocumentDefaults>) : {};
  } catch {
    return {};
  }
}

function persistDocumentDefaults(values: DocumentFormValues) {
  if (typeof window === 'undefined') return;
  const toSave: SavedDocumentDefaults = {
    parentName: values.parentName,
    emergencyPhone: values.emergencyPhone,
    emergencyPhone2Name: values.emergencyPhone2Name,
    emergencyPhone2: values.emergencyPhone2,
    insuranceCompany: values.insuranceCompany,
    insuranceNumber: values.insuranceNumber,
    chronicDiseases: values.chronicDiseases,
    healthLimits: values.healthLimits,
    allergies: values.allergies,
    medication: values.medication,
    medicationSchedule: values.medicationSchedule,
    canSwim: values.canSwim,
    tetanus: values.tetanus,
    pickupPeople: values.pickupPeople,
  };
  try {
    window.localStorage.setItem(SAVED_DOC_DEFAULTS_KEY, JSON.stringify(toSave));
  } catch {
    // Ignore storage failures (private mode, quota) — saving is best-effort.
  }
}

function defaultDocumentValues(displayName: string): DocumentFormValues {
  const saved = readSavedDocumentDefaults();
  return {
    parentName: saved.parentName || displayName,
    emergencyPhone: saved.emergencyPhone || '',
    emergencyPhone2Name: saved.emergencyPhone2Name || '',
    emergencyPhone2: saved.emergencyPhone2 || '',
    insuranceCompany: saved.insuranceCompany || '',
    insuranceNumber: saved.insuranceNumber || '',
    chronicDiseases: saved.chronicDiseases || 'Žádná',
    healthLimits: saved.healthLimits || 'Bez omezení',
    allergies: saved.allergies || 'Žádné',
    medication: saved.medication || 'Bez pravidelných léků',
    medicationSchedule: saved.medicationSchedule || '',
    canSwim: saved.canSwim || '',
    tetanus: saved.tetanus || '',
    pickupPeople: saved.pickupPeople || displayName,
    notes: '',
    gdprConsent: false,
    guardianConsent: false,
    healthAccuracy: false,
    departureConsent: false,
    infectionFree: false,
    packingConfirmed: false,
    photoConsent: false,
    workshopTermsAccepted: false,
  };
}

function uniqueCoachesFromProducts(products: ParentProduct[]) {
  const coaches = new Map<string, ParentProductTrainer>();
  for (const product of products) {
    for (const trainer of trainersForProduct(product)) coaches.set(trainer.id, trainer);
  }
  return Array.from(coaches.values());
}

function parentIdFromEmail(email: string) {
  return `web-parent-${email.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'demo'}`;
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function friendlyBackendError(message: string) {
  if (message.includes('Missing SUPABASE_URL') || message.includes('SUPABASE_SERVICE_ROLE_KEY') || message.includes('Missing Supabase URL')) {
    return 'Backend nemá nastavené Supabase klíče, takže zápis do databáze teď nejde dokončit.';
  }

  if (message.includes('Missing STRIPE_SECRET_KEY')) {
    return 'Backend nemá nastavený Stripe secret key, takže po uložení dokumentů nejde vytvořit platební checkout.';
  }

  return message;
}

function normalizeLocation(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/zs/g, 'zs')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizePersonName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(value);
}

function documentStatusLabel(status: DocumentStatus) {
  if (status === 'signed') return 'Podepsáno';
  if (status === 'draft') return 'Rozepsáno';
  return 'Chybí';
}

function headlineForSection(section: SectionKey) {
  switch (section) {
    case 'participants':
      return 'Účastníci, docházka a aktivní produkty';
    case 'payments':
      return 'Platby rozdělené podle typu produktu';
    case 'documents':
      return 'Dokumenty, které musí být v pořádku';
    case 'profile':
      return 'Profil rodiče a hodnocení trenérů';
    default:
      return 'Rodinný přehled TeamVYS';
  }
}

function subheadlineForSection(section: SectionKey, participantName: string) {
  switch (section) {
    case 'participants':
      return `${participantName}: aktivní permanentky, dokumenty, passy a poslední docházka bez dlouhé jedné stránky.`;
    case 'payments':
      return 'Kroužky, tábory a workshopy jsou oddělené do přehledných nabídek s dokumenty a platbou v návaznosti.';
    case 'documents':
      return 'Povinné souhlasy a zdravotní údaje jsou svázané s konkrétním dítětem i aktivitou.';
    case 'profile':
      return 'Rodič může upravit kontakty a ohodnotit trenéra hvězdičkami.';
    default:
      return 'Krátké akce, upozornění a stav všech dětí na jednom místě.';
  }
}
