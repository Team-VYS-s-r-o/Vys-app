'use client';

import { Building2, CheckCircle2, FileBadge, Loader2, Lock, Mail, MapPin, User } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { finalizeOrganizationRegistration, registerOrganization } from '@/lib/api-client';

const SPORT_TYPES = ['Parkour', 'Gymnastika', 'Tanec', 'Bojové sporty', 'Atletika', 'Florbal', 'Fotbal', 'Jiný sport'];

const inputClass = 'w-full rounded-[16px] border border-brand-purple/12 bg-white px-4 py-3 text-brand-ink outline-none transition focus:border-brand-purple';

export function OrgRegistrationForm() {
  const searchParams = useSearchParams();
  const flowState = searchParams.get('stav');
  const checkoutSessionId = searchParams.get('session');

  const [orgName, setOrgName] = useState('');
  const [sportType, setSportType] = useState('');
  const [city, setCity] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [ico, setIco] = useState('');
  const [aresName, setAresName] = useState<string | null>(null);
  const [aresChecking, setAresChecking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalizeState, setFinalizeState] = useState<'pending' | 'done' | 'failed'>('pending');
  const [finalizedOrgName, setFinalizedOrgName] = useState<string | null>(null);

  // Dokončení registrace přímo ze success stránky — server si session ověří
  // u Stripe, takže registrace funguje i bez Stripe webhooku.
  useEffect(() => {
    if (flowState !== 'uspech' || !checkoutSessionId) return;
    let cancelled = false;
    finalizeOrganizationRegistration(checkoutSessionId)
      .then((result) => {
        if (cancelled) return;
        setFinalizedOrgName(result.orgName);
        setFinalizeState('done');
      })
      .catch(() => {
        if (!cancelled) setFinalizeState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [flowState, checkoutSessionId]);

  async function lookupAres(value: string) {
    const normalized = value.replace(/\s+/g, '');
    setAresName(null);
    if (!/^\d{8}$/.test(normalized)) return;
    setAresChecking(true);
    try {
      const response = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${normalized}`, { headers: { accept: 'application/json' } });
      if (response.ok) {
        const subject = await response.json();
        setAresName(subject?.obchodniJmeno || null);
      } else if (response.status === 404) {
        setError('Organizace s tímto IČO nebyla nalezena v registru ARES.');
      }
    } catch {
      // ARES nedostupný — ověří se při odeslání na serveru.
    } finally {
      setAresChecking(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Heslo musí mít alespoň 8 znaků.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Hesla se neshodují.');
      return;
    }

    setPending(true);

    try {
      const base = `${window.location.origin}/registrace-organizace`;
      const { url } = await registerOrganization({
        orgName: orgName.trim(),
        contactEmail: contactEmail.trim(),
        adminFirstName: adminFirstName.trim(),
        adminLastName: adminLastName.trim(),
        password,
        ico: ico.replace(/\s+/g, ''),
        sportType: sportType || undefined,
        city: city.trim() || undefined,
        successUrl: `${base}?stav=uspech&session={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${base}?stav=zruseno`,
      });

      if (!url) throw new Error('Platební brána nevrátila odkaz. Zkuste to prosím znovu.');
      window.location.assign(url);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Registraci se nepodařilo odeslat.');
      setPending(false);
    }
  }

  if (flowState === 'uspech') {
    return (
      <div className="rounded-brand border border-brand-purple/12 bg-white p-6 shadow-brand md:p-7">
        {checkoutSessionId && finalizeState === 'pending' ? (
          <>
            <h2 className="flex items-center gap-2 text-2xl font-black text-brand-ink"><Loader2 size={22} className="animate-spin text-brand-purple" /> Zakládáme organizaci…</h2>
            <p className="mt-3 text-sm text-brand-ink/80">Platba proběhla, ještě chvilku — připravujeme váš účet.</p>
          </>
        ) : finalizeState === 'failed' ? (
          <>
            <h2 className="text-2xl font-black text-brand-ink">Platba proběhla ✅</h2>
            <p className="mt-3 text-sm text-brand-ink/80">
              Registraci dokončíme automaticky během chvilky. Vaše organizace teď čeká na schválení.
              Jakmile ji schválíme, dorazí vám e-mail a budete se moci přihlásit do administrace.
              Pokud potřebujete pomoct, napište nám na info@teamvys.cz.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-black text-brand-ink">Registrace dokončena 🎉</h2>
            <p className="mt-3 text-sm text-brand-ink/80">
              {finalizedOrgName ? `Organizace ${finalizedOrgName} je založená.` : 'Organizace je založená.'}{' '}
              Vaše registrace teď čeká na schválení. Jakmile ji schválíme, dorazí vám e-mail
              a budete se moci přihlásit do administrace heslem, které jste si zvolili při registraci.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-brand border border-brand-purple/12 bg-white p-6 shadow-brand md:p-7">
      {flowState === 'zruseno' ? (
        <p className="mb-4 rounded-brand bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
          Platba byla zrušena. Registraci můžete kdykoli dokončit znovu.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Název organizace" icon={<Building2 size={16} />} className="sm:col-span-2">
          <input
            required
            value={orgName}
            onChange={(event) => setOrgName(event.target.value)}
            placeholder="Např. Parkour klub Brno"
            className={inputClass}
          />
        </Field>

        <Field label="IČO" icon={<FileBadge size={16} />} className="sm:col-span-2">
          <input
            required
            inputMode="numeric"
            pattern="\d{8}"
            maxLength={8}
            value={ico}
            onChange={(event) => { setIco(event.target.value.replace(/[^\d]/g, '')); setAresName(null); }}
            onBlur={(event) => lookupAres(event.target.value)}
            placeholder="12345678"
            className={inputClass}
          />
          {aresChecking ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-ink/60"><Loader2 size={13} className="animate-spin" /> Ověřuji v registru ARES…</span>
          ) : aresName ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600"><CheckCircle2 size={13} /> Nalezeno v ARES: {aresName}</span>
          ) : (
            <span className="text-xs text-brand-ink/50">Existenci organizace ověřujeme v registru ARES.</span>
          )}
        </Field>

        <Field label="Sport">
          <select value={sportType} onChange={(event) => setSportType(event.target.value)} className={inputClass}>
            <option value="">Vyberte sport (volitelné)</option>
            {SPORT_TYPES.map((sport) => (
              <option key={sport} value={sport}>{sport}</option>
            ))}
          </select>
        </Field>

        <Field label="Město" icon={<MapPin size={16} />}>
          <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Brno" className={inputClass} />
        </Field>

        <Field label="Jméno správce" icon={<User size={16} />}>
          <input
            required
            value={adminFirstName}
            onChange={(event) => setAdminFirstName(event.target.value)}
            placeholder="Jana"
            className={inputClass}
          />
        </Field>

        <Field label="Příjmení správce">
          <input
            required
            value={adminLastName}
            onChange={(event) => setAdminLastName(event.target.value)}
            placeholder="Nováková"
            className={inputClass}
          />
        </Field>

        <Field label="Kontaktní e-mail" icon={<Mail size={16} />} className="sm:col-span-2">
          <input
            required
            type="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            placeholder="jana@vasklub.cz"
            className={inputClass}
          />
        </Field>

        <Field label="Heslo do administrace" icon={<Lock size={16} />}>
          <input
            required
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Alespoň 8 znaků"
            className={inputClass}
          />
        </Field>

        <Field label="Heslo znovu" icon={<Lock size={16} />}>
          <input
            required
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            placeholder="Zopakujte heslo"
            className={inputClass}
          />
        </Field>
      </div>

      {error ? <p className="mt-4 rounded-brand bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-brand bg-brand-purple px-6 py-3.5 text-sm font-black text-white shadow-brand transition hover:bg-brand-purple-deep disabled:opacity-60"
      >
        {pending ? <Loader2 size={18} className="animate-spin" /> : null}
        {pending ? 'Přesměrování na platbu…' : 'Začít 30 dní zdarma'}
      </button>

      <p className="mt-3 text-center text-xs text-brand-ink/60">
        Po zkušebním období 790 Kč měsíčně. Předplatné lze kdykoli zrušit.
      </p>
    </form>
  );
}

function Field({ label, icon, className, children }: { label: string; icon?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <label className={`grid gap-1.5 ${className ?? ''}`}>
      <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-brand-purple-deep">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}
