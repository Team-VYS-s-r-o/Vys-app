'use client';

import { Check, Eye, EyeOff, KeyRound, LogIn, MailCheck, Send, UserPlus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { DEV_BYPASS_AUTH } from '@/lib/dev-config';
import { createBrowserSupabaseClient, hasSupabaseBrowserConfig } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';

type AppRole = 'participant' | 'coach';
type AuthMode = 'sign-in' | 'sign-up' | 'forgot-password' | 'reset-password';
type CoachApprovalStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
type FormField =
  | 'credential'
  | 'password'
  | 'confirmPassword'
  | 'name'
  | 'phone'
  | 'parentName'
  | 'parentEmail'
  | 'birthDate'
  | 'emergencyPhone'
  | 'coachMessage';
type AuthIdentity = { kind: 'email'; value: string } | { kind: 'phone'; value: string };

const roleOptions: Array<{ role: AppRole; title: string; subtitle: string; route: string }> = [
  { role: 'participant', title: 'Účastník', subtitle: 'Dítě přes rodičovský telefon', route: '/app/ucastnik' },
  { role: 'coach', title: 'Trenér', subtitle: 'Docházka, QR, přehled práce', route: '/app/trener' },
];

const emptyForm: Record<FormField, string> = {
  credential: '',
  password: '',
  confirmPassword: '',
  name: '',
  phone: '',
  parentName: '',
  parentEmail: '',
  birthDate: '',
  emergencyPhone: '',
  coachMessage: '',
};

function routeForRole(role: AppRole) {
  return roleOptions.find((option) => option.role === role)?.route ?? '/app/ucastnik';
}

function looksLikeEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value.trim());
}

function passwordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-ZÁ-Ž]/.test(password) && /[a-zá-ž]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-zÁ-Žá-ž0-9]/.test(password)) score += 1;
  return score;
}

function passwordStrengthLabel(score: number) {
  if (score >= 4) return 'Silné heslo';
  if (score >= 3) return 'Dobré heslo';
  if (score >= 2) return 'Použitelné heslo';
  return 'Slabé heslo';
}

function normalizePhone(value: string) {
  const compact = value.replace(/[^\d+]/g, '');
  if (compact.startsWith('+')) return compact;
  if (compact.startsWith('420')) return `+${compact}`;
  if (compact.length === 9) return `+420${compact}`;
  return compact;
}

function buildAuthIdentity(role: AppRole, mode: AuthMode, form: Record<FormField, string>): AuthIdentity | null {
  if (mode === 'sign-up' && role === 'participant') {
    if (form.parentEmail.trim()) return { kind: 'email', value: form.parentEmail.trim().toLowerCase() };
    return form.phone.trim() ? { kind: 'phone', value: normalizePhone(form.phone) } : null;
  }

  const credential = form.credential.trim();
  if (!credential) return null;
  if (role === 'participant' && !credential.includes('@')) return { kind: 'phone', value: normalizePhone(credential) };
  return { kind: 'email', value: credential.toLowerCase() };
}

function mapAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Přihlášení se nepovedlo.';
  const lower = message.toLowerCase();

  if (lower.includes('already registered') || lower.includes('already exists')) {
    return 'Tenhle rodičovský kontakt už existuje. Přihlas se s ním, nebo pro účastnický přístup použij telefon rodiče.';
  }

  if (lower.includes('invalid login credentials')) {
    return 'Přihlašovací údaje nesedí.';
  }

  if (lower.includes('email not confirmed')) {
    return 'E-mail ještě není potvrzený. Zkontroluj schránku rodiče.';
  }

  if (lower.includes('phone') && (lower.includes('disabled') || lower.includes('provider'))) {
    return 'Registrace přes telefon není v Supabase zapnutá. Doplň rodičovský e-mail, nebo zapni phone auth.';
  }

  return message;
}

export function AppSignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [role, setRole] = useState<AppRole>('participant');
  const [form, setForm] = useState(emptyForm);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [visibleFields, setVisibleFields] = useState<Partial<Record<FormField, boolean>>>({});

  const configReady = DEV_BYPASS_AUTH || hasSupabaseBrowserConfig();
  const submitLabel = useMemo(() => {
    if (mode === 'forgot-password') return 'Poslat obnovovací e-mail';
    if (mode === 'reset-password') return 'Uložit nové heslo';
    if (mode === 'sign-up' && role === 'coach') return 'Odeslat žádost trenéra';
    if (mode === 'sign-up') return 'Vytvořit přístup účastníka';
    return role === 'participant' ? 'Přihlásit účastníka' : 'Přihlásit trenéra';
  }, [mode, role]);
  const strength = passwordStrength(form.password);

  useEffect(() => {
    if (searchParams.get('mode') === 'reset-password') setMode('reset-password');
  }, [searchParams]);

  useEffect(() => {
    if (DEV_BYPASS_AUTH || !hasSupabaseBrowserConfig()) return;

    const supabase = createBrowserSupabaseClient();
    const code = searchParams.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) setMessage(error.message);
        else {
          setMode('reset-password');
          router.replace('/app/sign-in?mode=reset-password');
        }
      });
    }

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('reset-password');
    });

    return () => data.subscription.unsubscribe();
  }, [router, searchParams]);

  function updateField(field: FormField, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage(null);
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setForm(emptyForm);
    setVisibleFields({});
    setMessage(null);
  }

  function switchRole(nextRole: AppRole) {
    setRole(nextRole);
    setForm(emptyForm);
    setVisibleFields({});
    setMessage(null);
  }

  function toggleFieldVisibility(field: FormField) {
    setVisibleFields((current) => ({ ...current, [field]: !current[field] }));
  }

  function safeNext(fallbackRole: AppRole) {
    const fallback = routeForRole(fallbackRole);
    if (!next || !next.startsWith('/app/') || next.startsWith('//')) return fallback;
    return next;
  }

  function validate() {
    if (!configReady) return 'Doplň NEXT_PUBLIC_SUPABASE_URL a NEXT_PUBLIC_SUPABASE_ANON_KEY.';
    if (DEV_BYPASS_AUTH) return null;

    if (mode === 'forgot-password') {
      if (!looksLikeEmail(form.credential)) return 'Vyplň e-mail účtu, kam pošleme obnovu hesla.';
      return null;
    }

    if (form.password.length < 6) return 'Heslo musí mít alespoň 6 znaků.';

    if (mode === 'reset-password') {
      if (form.password !== form.confirmPassword) return 'Hesla se neshodují.';
      if (passwordStrength(form.password) < 2) return 'Použij silnější heslo: ideálně 8 znaků, číslo a kombinaci malých/velkých písmen.';
      return null;
    }

    if (mode === 'sign-in') {
      if (!form.credential.trim()) return role === 'participant' ? 'Vyplň telefon nebo e-mail rodiče.' : 'Vyplň trenérský e-mail.';
      if (role === 'coach' && !looksLikeEmail(form.credential)) return 'Vyplň platný trenérský e-mail.';
      return null;
    }

    if (form.password !== form.confirmPassword) return 'Hesla se neshodují.';
    if (passwordStrength(form.password) < 2) return 'Použij silnější heslo: ideálně 8 znaků, číslo a kombinaci malých/velkých písmen.';
    if (!form.name.trim()) return role === 'participant' ? 'Vyplň jméno účastníka.' : 'Vyplň jméno trenéra.';

    if (role === 'participant') {
      if (!form.birthDate.trim()) return 'Vyplň datum narození účastníka.';
      if (!form.parentName.trim()) return 'Vyplň jméno rodiče.';
      if (!form.phone.trim()) return 'Vyplň telefon rodiče.';
      if (!form.emergencyPhone.trim()) return 'Vyplň nouzový telefon.';
      if (form.parentEmail.trim() && !looksLikeEmail(form.parentEmail)) return 'E-mail rodiče není ve správném tvaru.';
      return null;
    }

    if (!looksLikeEmail(form.credential)) return 'Vyplň platný trenérský e-mail.';
    if (!form.phone.trim()) return 'Vyplň telefon trenéra.';
    return null;
  }

  async function upsertAppProfile(userId: string, email: string | null, resolvedRole: AppRole) {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.from('app_profiles').upsert(
      {
        id: userId,
        role: resolvedRole,
        name: form.name.trim() || email || (resolvedRole === 'coach' ? 'Trenér Team VYS' : 'Účastník Team VYS'),
        email,
        phone: form.phone.trim() || null,
        bio: resolvedRole === 'coach' ? form.coachMessage.trim() || null : null,
      },
      { onConflict: 'id' }
    );
    if (error) throw error;
  }

  async function upsertRoleProfile(userId: string, resolvedRole: AppRole) {
    const supabase = createBrowserSupabaseClient();

    if (resolvedRole === 'coach') {
      const { error } = await supabase.from('coach_profiles').upsert(
        {
          id: userId,
          level: 1,
          xp: 0,
          next_level_xp: 500,
          qr_tricks_approved: 0,
          attendance_logged: 0,
          bonus_total: 0,
          assigned_courses: [],
        },
        { onConflict: 'id' }
      );
      if (error) throw error;
      return;
    }

    const [firstName, ...restName] = form.name.trim().split(/\s+/).filter(Boolean);
    const { error } = await supabase.from('participants').upsert(
      {
        id: userId,
        first_name: firstName || 'Účastník',
        last_name: restName.join(' ') || 'Team VYS',
        date_of_birth: form.birthDate.trim() || null,
        parent_name: form.parentName.trim() || null,
        parent_phone: form.phone.trim() || null,
        emergency_phone: form.emergencyPhone.trim() || form.phone.trim() || null,
        without_phone: !form.phone.trim(),
        paid_status: 'due',
        active_purchases: [],
      },
      { onConflict: 'id' }
    );
    if (error) throw error;
  }

  async function signIn(identity: AuthIdentity) {
    const supabase = createBrowserSupabaseClient();
    return identity.kind === 'email'
      ? supabase.auth.signInWithPassword({ email: identity.value, password: form.password })
      : supabase.auth.signInWithPassword({ phone: identity.value, password: form.password });
  }

  async function signUp(identity: AuthIdentity) {
    const supabase = createBrowserSupabaseClient();
    const options = {
      data: {
        role,
        name: form.name.trim(),
        phone: form.phone.trim(),
        parentName: form.parentName.trim(),
        parentEmail: form.parentEmail.trim(),
        coachMessage: form.coachMessage.trim(),
      },
    };

    return identity.kind === 'email'
      ? supabase.auth.signUp({ email: identity.value, password: form.password, options })
      : supabase.auth.signUp({ phone: identity.value, password: form.password, options });
  }

  async function sendPasswordReset() {
    const supabase = createBrowserSupabaseClient();
    const redirectTo = `${window.location.origin}/app/sign-in?mode=reset-password`;
    return supabase.auth.resetPasswordForEmail(form.credential.trim().toLowerCase(), { redirectTo });
  }

  async function updatePassword() {
    const supabase = createBrowserSupabaseClient();
    return supabase.auth.updateUser({ password: form.password });
  }

  async function loadCoachApprovalStatus(userId: string): Promise<CoachApprovalStatus> {
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
      .from('coach_profiles')
      .select('approval_status')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    const status = data?.approval_status;
    return status === 'approved' || status === 'rejected' || status === 'suspended' || status === 'pending' ? status : 'pending';
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const validationMessage = validate();
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    if (DEV_BYPASS_AUTH) {
      router.replace(safeNext(role));
      router.refresh();
      return;
    }

    if (mode === 'forgot-password') {
      setPending(true);
      try {
        const { error } = await sendPasswordReset();
        if (error) throw error;
        setMessage('Obnovovací e-mail je odeslaný. Otevři odkaz a nastav nové heslo.');
      } catch (error) {
        setMessage(mapAuthError(error));
      } finally {
        setPending(false);
      }
      return;
    }

    if (mode === 'reset-password') {
      setPending(true);
      try {
        const supabase = createBrowserSupabaseClient();
        const { error } = await updatePassword();
        if (error) throw error;
        await supabase.auth.signOut();
        setForm(emptyForm);
        setMode('sign-in');
        setMessage('Heslo je změněné. Přihlas se novým heslem.');
      } catch (error) {
        setMessage(mapAuthError(error));
      } finally {
        setPending(false);
      }
      return;
    }

    const identity = buildAuthIdentity(role, mode, form);
    if (!identity) {
      setMessage(role === 'participant' ? 'Vyplň rodičovský telefon nebo e-mail.' : 'Vyplň e-mail.');
      return;
    }

    setPending(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const authResult = mode === 'sign-in' ? await signIn(identity) : await signUp(identity);

      if (authResult.error) throw authResult.error;

      const user = authResult.data.user;
      if (!user) {
        setMessage('Zkontroluj SMS nebo e-mail a potvrď registraci.');
        return;
      }

      let resolvedRole = role;
      if (mode === 'sign-in') {
        const { data: profile, error } = await supabase.from('app_profiles').select('role').eq('id', user.id).maybeSingle();
        if (error) throw error;

        if (profile?.role === 'participant' || profile?.role === 'coach') {
          resolvedRole = profile.role;
        } else {
          await supabase.auth.signOut();
          setMessage('Tenhle účet patří na webový profil. Rodič a admin pokračují přes běžný web Team VYS.');
          return;
        }

        // Role mismatch — uživatel se přihlašoval jako jiná role než jakou má účet
        if (resolvedRole !== role) {
          await supabase.auth.signOut();
          if (role === 'coach') {
            setMessage('Tenhle e-mail patří účastnickému účtu, ne trenérskému. Vyber roli Účastník, nebo použij jiný e-mail.');
          } else {
            setMessage('Tenhle kontakt patří trenérskému účtu. Přihlas se jako Trenér, nebo použij jiný kontakt.');
          }
          return;
        }
      } else {
        await upsertAppProfile(user.id, (user.email ?? form.parentEmail.trim()) || null, role);
        await upsertRoleProfile(user.id, role);

        if (role === 'coach') {
          await supabase.auth.signOut();
          setMessage('Žádost trenéra je odeslaná. Admin ji schválí v administraci a potom se sem půjde přihlásit.');
          return;
        }
      }

      if (resolvedRole === 'coach') {
        const approvalStatus = await loadCoachApprovalStatus(user.id);
        if (approvalStatus !== 'approved') {
          await supabase.auth.signOut();
          setMessage(approvalStatus === 'rejected' ? 'Trenérský přístup zatím není schválený. Ozvi se adminovi Team VYS.' : 'Trenérský přístup čeká na schválení adminem.');
          return;
        }
      }

      router.replace(safeNext(resolvedRole));
      router.refresh();
    } catch (error) {
      setMessage(mapAuthError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === 'sign-in' || mode === 'sign-up' ? <div className="grid grid-cols-2 gap-1 rounded-brand bg-brand-paper p-1">
        <button type="button" onClick={() => switchMode('sign-in')} className={cn('rounded-brand px-3 py-3 text-sm font-black transition-colors', mode === 'sign-in' ? 'bg-white text-brand-ink shadow-brand-soft' : 'text-brand-ink-soft')}>Přihlášení</button>
        <button type="button" onClick={() => switchMode('sign-up')} className={cn('rounded-brand px-3 py-3 text-sm font-black transition-colors', mode === 'sign-up' ? 'bg-white text-brand-ink shadow-brand-soft' : 'text-brand-ink-soft')}>Registrace</button>
      </div> : (
        <div className="rounded-brand border border-brand-purple/12 bg-brand-paper p-4">
          <p className="text-sm font-black text-brand-ink">{mode === 'forgot-password' ? 'Obnova hesla' : 'Nové heslo'}</p>
          <p className="mt-1 text-xs font-bold leading-5 text-brand-ink-soft">
            {mode === 'forgot-password' ? 'Pošleme odkaz na e-mail účtu účastníka nebo trenéra.' : 'Nastav nové heslo po otevření odkazu ze Supabase e-mailu.'}
          </p>
        </div>
      )}

      {mode === 'sign-in' || mode === 'sign-up' ? <div className="grid gap-2 sm:grid-cols-2">
        {roleOptions.map((option) => {
          const active = role === option.role;
          return (
            <button key={option.role} type="button" onClick={() => switchRole(option.role)} className={cn('rounded-brand border p-3 text-left transition-colors', active ? 'border-brand-purple bg-brand-purple-light' : 'border-brand-purple/12 bg-white hover:bg-brand-paper')}>
              <span className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-sm font-black text-brand-ink">{option.title}</span>
                  <span className="mt-1 block text-xs font-bold leading-5 text-brand-ink-soft">{option.subtitle}</span>
                </span>
                {active ? <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-brand text-white"><Check size={16} strokeWidth={3} /></span> : null}
              </span>
            </button>
          );
        })}
      </div> : null}

      {mode === 'forgot-password' ? (
        <Field label="E-mail účtu" type="email" value={form.credential} onChange={(value) => updateField('credential', value)} placeholder="rodic@email.cz" />
      ) : mode === 'reset-password' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nové heslo" type={visibleFields.password ? 'text' : 'password'} value={form.password} onChange={(value) => updateField('password', value)} placeholder="Alespoň 6 znaků" onToggleVisibility={() => toggleFieldVisibility('password')} passwordVisible={Boolean(visibleFields.password)} />
            <Field label="Potvrzení hesla" type={visibleFields.confirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={(value) => updateField('confirmPassword', value)} placeholder="Zopakuj heslo" onToggleVisibility={() => toggleFieldVisibility('confirmPassword')} passwordVisible={Boolean(visibleFields.confirmPassword)} />
          </div>
          <PasswordStrength score={strength} />
        </>
      ) : mode === 'sign-in' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={role === 'participant' ? 'Telefon nebo e-mail rodiče' : 'Trenérský e-mail'} type={role === 'coach' ? 'email' : 'text'} value={form.credential} onChange={(value) => updateField('credential', value)} placeholder={role === 'participant' ? '+420 ... nebo rodic@email.cz' : 'trener@teamvys.cz'} />
          <Field label="Heslo" type={visibleFields.password ? 'text' : 'password'} value={form.password} onChange={(value) => updateField('password', value)} placeholder="Alespoň 6 znaků" onToggleVisibility={() => toggleFieldVisibility('password')} passwordVisible={Boolean(visibleFields.password)} />
        </div>
      ) : role === 'participant' ? (
        <>
          <Section title="Účastník">
            <Field label="Jméno a příjmení dítěte" value={form.name} onChange={(value) => updateField('name', value)} placeholder="Eliška Nováková" />
            <Field label="Datum narození" value={form.birthDate} onChange={(value) => updateField('birthDate', value)} placeholder="12. 4. 2014" />
          </Section>

          <Section title="Rodič">
            <Field label="Jméno rodiče" value={form.parentName} onChange={(value) => updateField('parentName', value)} placeholder="Jméno a příjmení rodiče" />
            <Field label="Telefon rodiče" type="tel" value={form.phone} onChange={(value) => updateField('phone', value)} placeholder="+420 ..." />
            <Field label="Nouzový telefon" type="tel" value={form.emergencyPhone} onChange={(value) => updateField('emergencyPhone', value)} placeholder="+420 777 221 904" />
            <Field label="E-mail rodiče (volitelně)" type="email" value={form.parentEmail} onChange={(value) => updateField('parentEmail', value)} placeholder="rodic@email.cz" />
          </Section>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Heslo pro appku" type={visibleFields.password ? 'text' : 'password'} value={form.password} onChange={(value) => updateField('password', value)} placeholder="Alespoň 6 znaků" onToggleVisibility={() => toggleFieldVisibility('password')} passwordVisible={Boolean(visibleFields.password)} />
            <Field label="Potvrzení hesla" type={visibleFields.confirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={(value) => updateField('confirmPassword', value)} placeholder="Zopakuj heslo" onToggleVisibility={() => toggleFieldVisibility('confirmPassword')} passwordVisible={Boolean(visibleFields.confirmPassword)} />
          </div>
          <PasswordStrength score={strength} />
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Jméno trenéra" value={form.name} onChange={(value) => updateField('name', value)} placeholder="Filip Trenér" />
            <Field label="Trenérský e-mail" type="email" value={form.credential} onChange={(value) => updateField('credential', value)} placeholder="trener@teamvys.cz" />
            <Field label="Telefon" type="tel" value={form.phone} onChange={(value) => updateField('phone', value)} placeholder="+420 777 221 904" />
            <Field label="Krátce o sobě" value={form.coachMessage} onChange={(value) => updateField('coachMessage', value)} placeholder="Město, zkušenosti, dostupnost" multiline />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Heslo" type={visibleFields.password ? 'text' : 'password'} value={form.password} onChange={(value) => updateField('password', value)} placeholder="Alespoň 6 znaků" onToggleVisibility={() => toggleFieldVisibility('password')} passwordVisible={Boolean(visibleFields.password)} />
            <Field label="Potvrzení hesla" type={visibleFields.confirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={(value) => updateField('confirmPassword', value)} placeholder="Zopakuj heslo" onToggleVisibility={() => toggleFieldVisibility('confirmPassword')} passwordVisible={Boolean(visibleFields.confirmPassword)} />
          </div>
          <PasswordStrength score={strength} />
        </>
      )}

      {message ? <p className="rounded-brand bg-brand-paper p-3 text-sm font-bold leading-6 text-brand-ink-soft">{message}</p> : null}

      <button type="submit" disabled={pending || !configReady} className="inline-flex w-full items-center justify-center gap-2 rounded-brand bg-gradient-brand px-5 py-4 text-sm font-black text-white shadow-brand-soft transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55">
        {mode === 'forgot-password' ? <MailCheck size={18} /> : mode === 'reset-password' ? <KeyRound size={18} /> : mode === 'sign-in' ? <LogIn size={18} /> : role === 'coach' ? <Send size={18} /> : <UserPlus size={18} />}
        {pending ? 'Pracuji...' : submitLabel}
      </button>

      {!DEV_BYPASS_AUTH && configReady ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-black text-brand-purple">
          {mode === 'sign-in' ? <button type="button" onClick={() => switchMode('forgot-password')} className="hover:text-brand-pink">Zapomenuté heslo</button> : null}
          {mode === 'forgot-password' || mode === 'reset-password' ? <button type="button" onClick={() => switchMode('sign-in')} className="hover:text-brand-pink">Zpět na přihlášení</button> : null}
        </div>
      ) : null}

      {DEV_BYPASS_AUTH ? <p className="text-xs font-bold leading-5 text-brand-ink-soft">Testovací režim je zapnutý, takže appka pustí vybranou roli bez ověření.</p> : null}
      {!DEV_BYPASS_AUTH && !configReady ? <p className="text-xs font-bold leading-5 text-brand-ink-soft">Na Vercelu chybí NEXT_PUBLIC_SUPABASE_URL a NEXT_PUBLIC_SUPABASE_ANON_KEY, proto registrace nejde odeslat.</p> : null}
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-brand border border-brand-purple/12 bg-brand-paper/70 p-3">
      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-brand-purple">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function PasswordStrength({ score }: { score: number }) {
  return (
    <div className="space-y-2">
      <div className="h-2 overflow-hidden rounded-full bg-brand-paper">
        <div className="h-full rounded-full bg-gradient-brand transition-all" style={{ width: `${Math.max(score, 1) * 25}%` }} />
      </div>
      <p className="text-xs font-bold text-brand-ink-soft">{passwordStrengthLabel(score)}</p>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', multiline = false, onToggleVisibility, passwordVisible = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string; multiline?: boolean; onToggleVisibility?: () => void; passwordVisible?: boolean }) {
  return (
    <label className={cn('block space-y-2', multiline ? 'sm:col-span-2' : '')}>
      <span className="text-[11px] font-black uppercase text-brand-ink-soft">{label}</span>
      {multiline ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-[96px] w-full resize-none rounded-brand border border-brand-purple/12 bg-white px-4 py-3 text-brand-ink outline-none transition-colors focus:border-brand-cyan" placeholder={placeholder} />
      ) : (
        <span className="flex rounded-brand border border-brand-purple/12 bg-white transition-colors focus-within:border-brand-cyan">
          <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 rounded-brand bg-transparent px-4 py-3 text-brand-ink outline-none" placeholder={placeholder} />
          {onToggleVisibility ? (
            <button type="button" onClick={onToggleVisibility} className="flex w-12 items-center justify-center text-brand-ink-soft hover:text-brand-ink" aria-label={passwordVisible ? 'Skrýt heslo' : 'Zobrazit heslo'}>
              {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          ) : null}
        </span>
      )}
    </label>
  );
}