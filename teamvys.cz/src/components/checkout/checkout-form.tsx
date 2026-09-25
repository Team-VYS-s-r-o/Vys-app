'use client';

import { BadgePercent, CalendarDays, CreditCard, ShieldCheck } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

import { EmbeddedPaymentForm } from '@/components/checkout/embedded-payment-form';
import { confirmEmbeddedPaymentIntent, createEmbeddedPaymentIntent, saveCourseDocuments } from '@/lib/api-client';
import { parseScheduleDays, parseScheduleTime } from '@/lib/schedule-days';
import {
    applyRewardDiscount,
    findRewardDiscountByCode,
    markRewardDiscountUsed,
    normalizeRewardProductType,
    readUsedRewardDiscountIds,
    rewardDiscountCodesForParticipant,
} from '@/lib/monthly-rewards';
import { requiredDocumentTemplates, type ActivityType } from '@/lib/portal-content';
import type { WebProduct } from '@/lib/products';

type Props = {
  product: WebProduct;
  userId: string;
  userEmail: string;
  parentProfileId?: string;
  defaultName: string;
};

type EmbeddedPaymentState = {
  clientSecret: string;
  paymentIntentId: string;
  amountLabel: string;
  rewardCodeId?: string;
};

type CheckoutDocumentValues = {
  parentName: string;
  emergencyPhone: string;
  insuranceCompany: string;
  healthLimits: string;
  allergies: string;
  medication: string;
  pickupPeople: string;
  gdprConsent: boolean;
  guardianConsent: boolean;
  healthAccuracy: boolean;
  departureConsent: boolean;
  infectionFree: boolean;
  packingConfirmed: boolean;
  photoConsent: boolean;
  workshopTermsAccepted: boolean;
};

export function CheckoutForm({ product, userId, userEmail, parentProfileId, defaultName }: Props) {
  const [participantName, setParticipantName] = useState(defaultName);
  const [documents, setDocuments] = useState<CheckoutDocumentValues>(() => defaultCheckoutDocuments(defaultName));
  const [discountCode, setDiscountCode] = useState('');
  const [usedRewardCodeIds, setUsedRewardCodeIds] = useState<string[]>(readUsedRewardDiscountIds);
  const [embeddedPayment, setEmbeddedPayment] = useState<EmbeddedPaymentState | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const participantId = useMemo(() => `web-${userId.slice(0, 12)}`, [userId]);
  const activityType = normalizeCheckoutActivityType(product.type);
  const scheduleDays = useMemo(() => (product.type === 'Kroužek' ? parseScheduleDays(product.meta) : []), [product.type, product.meta]);
  const scheduleTime = useMemo(() => parseScheduleTime(product.meta), [product.meta]);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const hasDayChoice = scheduleDays.length >= 2;
  const requiredDocuments = useMemo(() => requiredDocumentTemplates.filter((document) => document.requiredFor.includes(activityType)), [activityType]);
  const rewardParticipant = useMemo(() => {
    const parts = participantName.trim().split(/\s+/).filter(Boolean);
    const normalizedName = participantName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    return {
      id: normalizedName === 'eliska novakova' ? 'demo-child-1' : participantId,
      firstName: parts[0] || 'Eliška',
      lastName: parts.slice(1).join(' ') || 'Nováková',
      xp: 920,
    };
  }, [participantId, participantName]);
  const eligibleDiscounts = useMemo(() => {
    const target = normalizeRewardProductType(product.type);
    return rewardDiscountCodesForParticipant(rewardParticipant, usedRewardCodeIds).filter((discount) => discount.appliesTo === target);
  }, [product.type, rewardParticipant, usedRewardCodeIds]);
  const appliedDiscount = useMemo(
    () => findRewardDiscountByCode(discountCode, product.type, rewardParticipant, usedRewardCodeIds),
    [discountCode, product.type, rewardParticipant, usedRewardCodeIds],
  );
  const discountPreview = applyRewardDiscount(product.priceAmount, appliedDiscount);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!participantName.trim()) {
      setMessage('Doplň jméno dítěte nebo účastníka.');
      return;
    }

    if (hasDayChoice && selectedDays.length === 0) {
      setMessage(`Vyber prosím tréninkové dny — ${scheduleDays.join(', ')} nebo oba. Cena je stejná.`);
      return;
    }

    const selectedDiscount = discountCode.trim()
      ? findRewardDiscountByCode(discountCode, product.type, rewardParticipant, usedRewardCodeIds)
      : null;

    if (discountCode.trim() && !selectedDiscount) {
      setMessage('Tenhle slevový kód nejde použít pro vybraný produkt nebo už byl použitý.');
      return;
    }

    const documentError = validateCheckoutDocuments(activityType, documents, requiredDocuments.map((document) => document.kind));
    if (documentError) {
      setMessage(documentError);
      return;
    }

    setPending(true);
    try {
      await saveCheckoutDocuments({
        product,
        activityType,
        participantId,
        participantName: participantName.trim(),
        parentProfileId,
        values: documents,
        documentKinds: requiredDocuments,
      });

      const paymentIntent = await createEmbeddedPaymentIntent({
        parentProfileId,
        productId: product.id,
        participantId,
        participantName: participantName.trim(),
        receiptEmail: userEmail,
        discountCode: selectedDiscount?.code,
        trainingDays: hasDayChoice ? selectedDays : undefined,
      });

      setEmbeddedPayment({
        clientSecret: paymentIntent.clientSecret,
        paymentIntentId: paymentIntent.paymentIntentId,
        amountLabel: formatCurrency(paymentIntent.amount),
        rewardCodeId: selectedDiscount?.id,
      });
      setMessage('Dokumenty jsou uložené. Teď potvrď kartu přímo na webu.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Platbu se nepovedlo připravit.');
    } finally {
      setPending(false);
    }
  }

  async function onEmbeddedPaymentPaid(paymentIntentId: string) {
    const result = await confirmEmbeddedPaymentIntent(paymentIntentId);
    if (embeddedPayment?.rewardCodeId) setUsedRewardCodeIds(markRewardDiscountUsed(embeddedPayment.rewardCodeId));
    setEmbeddedPayment(null);
    setMessage(`${result.purchase.title} pro ${result.purchase.participantName} je zaplacené a uložené v Supabase.`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-brand border border-black/10 bg-white p-6 shadow-brand">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-brand bg-gradient-brand text-white">
          <CreditCard size={20} />
        </span>
        <div>
          <h2 className="text-2xl font-black text-brand-ink">Platba kartou</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Nejdřív uložíme povinné dokumenty do Supabase, pak se karta zadá přímo na webu přes Stripe.</p>
        </div>
      </div>

      <label className="block space-y-2">
        <span className="text-xs font-black uppercase text-slate-500">Jméno dítěte / účastníka</span>
        <input
          required
          value={participantName}
          onChange={(event) => setParticipantName(event.target.value)}
          className="w-full rounded-brand border border-black/10 bg-white px-4 py-3 text-brand-ink outline-none focus:border-brand-cyan"
          placeholder="Např. Eliška Nováková"
        />
      </label>

      {hasDayChoice ? (
        <div className="rounded-brand border border-brand-purple/15 bg-brand-paper p-4">
          <div className="flex items-start gap-2">
            <CalendarDays size={18} className="mt-0.5 shrink-0 text-brand-purple" />
            <div>
              <p className="text-xs font-black uppercase text-brand-purple">Tréninkové dny</p>
              <p className="mt-1 text-sm font-bold leading-6 text-slate-600">
                Kroužek běží {scheduleDays.join(' i ')}{scheduleTime ? ` (${scheduleTime})` : ''}. Vyber, kdy bude dítě chodit —
                jeden den, nebo klidně oba. <span className="font-black text-brand-ink">Cena je stejná</span> a jedna permanentka
                platí na všechny vybrané dny.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {scheduleDays.map((day) => {
              const checked = selectedDays.includes(day);
              return (
                <label
                  key={day}
                  className={`flex cursor-pointer items-center gap-3 rounded-brand border p-3 text-sm font-black transition ${
                    checked ? 'border-brand-purple bg-white text-brand-purple' : 'border-black/10 bg-white text-brand-ink hover:border-brand-purple/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      setSelectedDays((current) =>
                        event.target.checked
                          ? scheduleDays.filter((item) => current.includes(item) || item === day)
                          : current.filter((item) => item !== day),
                      )
                    }
                    className="h-4 w-4 accent-brand-purple"
                  />
                  <span>{day}{scheduleTime ? ` · ${scheduleTime}` : ''}</span>
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs font-bold text-slate-500">
            {selectedDays.length === 0
              ? 'Zaškrtni alespoň jeden den.'
              : selectedDays.length === scheduleDays.length
                ? 'Super — dítě bude chodit oba dny za stejnou cenu.'
                : `Dítě bude chodit každý týden v den: ${selectedDays.join(', ')}. Kdykoli později to můžeme změnit.`}
          </p>
        </div>
      ) : null}

      <div className="rounded-brand bg-brand-paper p-4">
        <p className="text-xs font-black uppercase text-slate-400">Přihlášený účet</p>
        <p className="mt-1 text-sm font-black text-brand-ink">{userEmail}</p>
      </div>

      {requiredDocuments.length > 0 ? (
        <div className="rounded-brand border border-brand-purple/10 bg-brand-paper p-4">
          <p className="text-xs font-black uppercase text-brand-purple">Dokumenty před platbou</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {requiredDocuments.map((document) => (
              <div key={document.kind} className="rounded-brand bg-white p-3">
                <p className="text-xs font-black text-brand-ink">{document.title}</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-600">{document.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <CheckoutTextInput label="Jméno rodiče" value={documents.parentName} onChange={(parentName) => setDocuments((current) => ({ ...current, parentName }))} />
            <CheckoutTextInput label="Nouzový telefon" value={documents.emergencyPhone} onChange={(emergencyPhone) => setDocuments((current) => ({ ...current, emergencyPhone }))} />
            {activityType !== 'Workshop' ? <CheckoutTextInput label="Zdravotní pojišťovna" value={documents.insuranceCompany} onChange={(insuranceCompany) => setDocuments((current) => ({ ...current, insuranceCompany }))} /> : null}
            <CheckoutTextInput label="Alergie" value={documents.allergies} onChange={(allergies) => setDocuments((current) => ({ ...current, allergies }))} />
            <CheckoutTextInput label="Léky" value={documents.medication} onChange={(medication) => setDocuments((current) => ({ ...current, medication }))} />
          </div>
          <div className="mt-3 grid gap-3">
            <CheckoutTextarea label="Zdravotní omezení" value={documents.healthLimits} onChange={(healthLimits) => setDocuments((current) => ({ ...current, healthLimits }))} />
            {activityType !== 'Workshop' ? <CheckoutTextarea label="Vyzvedávání / odchod" value={documents.pickupPeople} onChange={(pickupPeople) => setDocuments((current) => ({ ...current, pickupPeople }))} /> : null}
            <CheckoutCheckbox label="Potvrzuji GDPR souhlas." checked={documents.gdprConsent} onChange={(gdprConsent) => setDocuments((current) => ({ ...current, gdprConsent }))} />
            {activityType !== 'Workshop' ? <CheckoutCheckbox label="Souhlasím jako zákonný zástupce s pravidly a účastí dítěte." checked={documents.guardianConsent} onChange={(guardianConsent) => setDocuments((current) => ({ ...current, guardianConsent }))} /> : null}
            <CheckoutCheckbox label="Potvrzuji pravdivost zdravotních informací." checked={documents.healthAccuracy} onChange={(healthAccuracy) => setDocuments((current) => ({ ...current, healthAccuracy }))} />
            {activityType !== 'Workshop' ? <CheckoutCheckbox label="Potvrzuji pravidla vyzvedávání a odchodu." checked={documents.departureConsent} onChange={(departureConsent) => setDocuments((current) => ({ ...current, departureConsent }))} /> : null}
            {activityType === 'Tabor' ? <CheckoutCheckbox label="Potvrzuji bezinfekčnost pro tábor." checked={documents.infectionFree} onChange={(infectionFree) => setDocuments((current) => ({ ...current, infectionFree }))} /> : null}
            {activityType === 'Tabor' ? <CheckoutCheckbox label="Potvrzuji věci s sebou a táborové pokyny." checked={documents.packingConfirmed} onChange={(packingConfirmed) => setDocuments((current) => ({ ...current, packingConfirmed }))} /> : null}
            {activityType === 'Workshop' ? <CheckoutCheckbox label="Souhlasím s účastí na workshopu, pravidly a storno podmínkami." checked={documents.workshopTermsAccepted} onChange={(workshopTermsAccepted) => setDocuments((current) => ({ ...current, workshopTermsAccepted }))} /> : null}
            {activityType === 'Workshop' ? <CheckoutCheckbox label="Souhlasím s focením a natáčením na workshopu." checked={documents.photoConsent} onChange={(photoConsent) => setDocuments((current) => ({ ...current, photoConsent }))} /> : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-brand border border-brand-purple/10 bg-brand-paper p-4">
        <div className="flex items-start gap-2">
          <BadgePercent size={18} className="mt-0.5 shrink-0 text-brand-purple" />
          <div>
            <p className="text-xs font-black uppercase text-brand-purple">Slevový kód z dětské cesty</p>
            <p className="mt-1 text-sm font-bold leading-6 text-slate-600">Kód se po použití schová z rodičovského přehledu.</p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            value={discountCode}
            onChange={(event) => setDiscountCode(event.target.value.toUpperCase())}
            className="w-full rounded-brand border border-black/10 bg-white px-4 py-3 text-brand-ink outline-none focus:border-brand-purple"
            placeholder="Např. ELISKA-WORKSHOP-10"
          />
          <button
            type="button"
            onClick={() => setDiscountCode(eligibleDiscounts[0]?.code ?? discountCode)}
            disabled={eligibleDiscounts.length === 0}
            className="rounded-brand bg-white px-4 py-3 text-sm font-black text-brand-purple shadow-sm transition hover:bg-brand-purple-light disabled:cursor-not-allowed disabled:opacity-55"
          >
            Vložit dosažený
          </button>
        </div>
        {eligibleDiscounts.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {eligibleDiscounts.map((discount) => (
              <button key={discount.id} type="button" onClick={() => setDiscountCode(discount.code)} className="rounded-full bg-white px-3 py-2 text-xs font-black text-brand-ink shadow-sm transition hover:text-brand-purple">
                {discount.code} · {discount.percent} %
              </button>
            ))}
          </div>
        ) : null}
        {appliedDiscount ? (
          <div className="mt-3 rounded-brand bg-white p-3 text-sm font-black text-brand-ink">
            <div className="flex justify-between gap-3"><span>Sleva</span><span className="text-brand-purple">-{formatCurrency(discountPreview.discountAmount)}</span></div>
            <div className="mt-1 flex justify-between gap-3"><span>K zaplacení</span><span>{formatCurrency(discountPreview.finalAmount)}</span></div>
          </div>
        ) : null}
      </div>

      <div className="flex items-start gap-2 rounded-brand bg-brand-lime/24 p-4 text-brand-ink">
        <ShieldCheck size={19} className="mt-0.5 shrink-0" />
        <p className="text-sm font-bold leading-6">Stripe tajný klíč zůstává jen na Express serveru. Web posílá pouze produkt, dokumenty a identifikaci účastníka.</p>
      </div>

      {embeddedPayment ? (
        <EmbeddedPaymentForm
          clientSecret={embeddedPayment.clientSecret}
          amountLabel={embeddedPayment.amountLabel}
          onPaid={onEmbeddedPaymentPaid}
          onError={setMessage}
        />
      ) : null}

      {message ? <p className="rounded-brand bg-brand-paper p-3 text-sm font-bold text-slate-600">{message}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-brand bg-gradient-brand px-6 py-4 text-sm font-black text-white shadow-brand-soft transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
      >
        <CreditCard size={18} />
        {pending ? 'Připravuji platbu...' : `Uložit dokumenty a připravit platbu ${appliedDiscount ? formatCurrency(discountPreview.finalAmount) : product.priceLabel}`}
      </button>
    </form>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(value);
}

function normalizeCheckoutActivityType(type: WebProduct['type']): ActivityType {
  if (type === 'Kroužek') return 'Krouzek';
  if (type === 'Tábor') return 'Tabor';
  return 'Workshop';
}

function defaultCheckoutDocuments(defaultName: string): CheckoutDocumentValues {
  return {
    parentName: defaultName || '',
    emergencyPhone: '',
    insuranceCompany: '',
    healthLimits: 'Bez omezení',
    allergies: 'Žádné známé alergie',
    medication: 'Bez pravidelných léků',
    pickupPeople: defaultName || '',
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

function validateCheckoutDocuments(activityType: ActivityType, values: CheckoutDocumentValues, documentKinds: string[]) {
  if (documentKinds.length === 0) return null;

  const missingFields = [
    ['jméno rodiče', values.parentName],
    ['nouzový telefon', values.emergencyPhone],
    ['alergie', values.allergies],
    ['léky', values.medication],
    ['zdravotní omezení', values.healthLimits],
    ...(activityType !== 'Workshop' ? [
      ['zdravotní pojišťovna', values.insuranceCompany],
      ['vyzvedávání / odchod', values.pickupPeople],
    ] as Array<[string, string]> : []),
  ].filter(([, value]) => value.trim().length === 0).map(([label]) => label);

  if (missingFields.length > 0) return `Vyplň prosím dokumenty: ${missingFields.join(', ')}.`;
  if (documentKinds.includes('gdpr') && !values.gdprConsent) return 'Potvrď prosím GDPR souhlas.';
  if (documentKinds.includes('guardian-consent') && !values.guardianConsent) return 'Potvrď prosím souhlas zákonného zástupce.';
  if (documentKinds.includes('health') && !values.healthAccuracy) return 'Potvrď prosím pravdivost zdravotních informací.';
  if (documentKinds.includes('departure') && !values.departureConsent) return 'Potvrď prosím pravidla vyzvedávání a odchodu.';
  if (activityType === 'Tabor' && documentKinds.includes('infection-free') && !values.infectionFree) return 'U tábora potvrď prosím bezinfekčnost.';
  if (activityType === 'Tabor' && documentKinds.includes('packing') && !values.packingConfirmed) return 'U tábora potvrď prosím věci s sebou a pokyny.';
  if (activityType === 'Workshop' && documentKinds.includes('workshop-terms') && !values.workshopTermsAccepted) return 'U workshopu potvrď prosím pravidla a storno podmínky.';
  if (activityType === 'Workshop' && documentKinds.includes('workshop-terms') && !values.photoConsent) return 'U workshopu potvrď prosím souhlas s focením a natáčením.';

  return null;
}

async function saveCheckoutDocuments({ product, activityType, participantId, participantName, parentProfileId, values, documentKinds }: {
  product: WebProduct;
  activityType: ActivityType;
  participantId: string;
  participantName: string;
  parentProfileId?: string;
  values: CheckoutDocumentValues;
  documentKinds: typeof requiredDocumentTemplates;
}) {
  if (documentKinds.length === 0) return;

  const [firstName = participantName, ...lastNameParts] = participantName.split(/\s+/).filter(Boolean);
  const lastName = lastNameParts.join(' ') || '-';

  await saveCourseDocuments({
    parentProfileId,
    productId: product.id,
    participantId,
    participantName,
    participantFirstName: firstName,
    participantLastName: lastName,
    documents: documentKinds.map((document) => ({
      kind: document.kind,
      title: document.title,
      parentName: values.parentName,
      payload: {
        documentKind: document.kind,
        documentTitle: document.title,
        productId: product.id,
        productTitle: product.title,
        activityType,
        productPlace: product.place,
        productMeta: product.meta,
        participantName,
        parentName: values.parentName,
        emergencyPhone: values.emergencyPhone,
        insuranceCompany: values.insuranceCompany,
        healthLimits: values.healthLimits,
        allergies: values.allergies,
        medication: values.medication,
        pickupPeople: values.pickupPeople,
        gdprConsent: values.gdprConsent,
        guardianConsent: values.guardianConsent || values.workshopTermsAccepted,
        healthAccuracy: values.healthAccuracy,
        departureConsent: values.departureConsent,
        infectionFree: values.infectionFree,
        packingConfirmed: values.packingConfirmed,
        photoConsent: values.photoConsent,
        workshopTermsAccepted: values.workshopTermsAccepted,
      },
    })),
  });
}

function CheckoutTextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-black uppercase text-slate-500">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-brand border border-black/10 bg-white px-4 py-3 text-brand-ink outline-none focus:border-brand-purple" />
    </label>
  );
}

function CheckoutTextarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-black uppercase text-slate-500">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="w-full rounded-brand border border-black/10 bg-white px-4 py-3 text-brand-ink outline-none focus:border-brand-purple" />
    </label>
  );
}

function CheckoutCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 rounded-brand bg-white p-3 text-sm font-bold leading-6 text-slate-600">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 accent-brand-purple" />
      <span>{label}</span>
    </label>
  );
}