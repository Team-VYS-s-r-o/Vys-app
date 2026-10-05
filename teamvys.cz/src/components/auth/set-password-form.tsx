'use client';

import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { createBrowserSupabaseClient, hasSupabaseBrowserConfig } from '@/lib/supabase/browser';

type Phase = 'loading' | 'ready' | 'saving' | 'done' | 'error';

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

export function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>('loading');
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [redirectTarget, setRedirectTarget] = useState('/admin');

  useEffect(() => {
    if (!hasSupabaseBrowserConfig()) {
      setPhase('error');
      setMessage('Chybí konfigurace přihlášení. Kontaktujte podporu Team VYS.');
      return;
    }

    const supabase = createBrowserSupabaseClient();
    let cancelled = false;

    async function resolveSession() {
      // Odkaz z e-mailu může přijít ve dvou podobách: ?code=… (PKCE) nebo
      // #access_token=… (implicitní recovery) — obě cesty vedou k session.
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
      const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');
      if (errorDescription) {
        if (!cancelled) {
          setPhase('error');
          setMessage('Odkaz už není platný nebo byl použitý. Nechte si poslat nový přes „Zapomenuté heslo".');
        }
        return;
      }

      const code = searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error && !cancelled) {
          setPhase('error');
          setMessage('Odkaz se nepodařilo ověřit. Nechte si poslat nový přes „Zapomenuté heslo".');
          return;
        }
      }

      // detectSessionInUrl zpracuje hash tokeny automaticky — počkáme na session.
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          if (!cancelled) {
            setEmail(data.session.user.email ?? null);
            const role = (data.session.user.user_metadata as Record<string, unknown> | undefined)?.role;
            setRedirectTarget(role === 'admin' ? '/admin' : '/rodic');
            setPhase('ready');
          }
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      if (!cancelled) {
        setPhase('error');
        setMessage('Odkaz vypršel nebo už byl použitý. Nechte si poslat nový přes „Zapomenuté heslo".');
      }
    }

    resolveSession();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (password.length < 6) {
      setMessage('Heslo musí mít alespoň 6 znaků.');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('Hesla se neshodují.');
      return;
    }
    if (passwordStrength(password) < 2) {
      setMessage('Použijte silnější heslo: ideálně 8 znaků, číslo a kombinaci malých/velkých písmen.');
      return;
    }

    setPhase('saving');
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPhase('done');
      setTimeout(() => {
        router.replace(redirectTarget);
        router.refresh();
      }, 1500);
    } catch (error) {
      setPhase('ready');
      setMessage(error instanceof Error ? error.message : 'Heslo se nepodařilo uložit.');
    }
  }

  const strength = passwordStrength(password);

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center gap-3 rounded-[28px] border border-brand-purple/12 bg-white p-10 shadow-brand">
        <Loader2 size={20} className="animate-spin text-brand-purple" />
        <p className="text-sm font-bold text-brand-ink-soft">Ověřuji odkaz z e-mailu…</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="rounded-[28px] border border-brand-purple/12 bg-white p-7 shadow-brand">
        <h2 className="text-xl font-black text-brand-ink">Odkaz nefunguje</h2>
        <p className="mt-3 text-sm leading-6 text-brand-ink-soft">{message}</p>
        <Link
          href="/sign-in"
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-[18px] bg-gradient-brand px-6 py-3 text-sm font-black text-white shadow-brand-soft"
        >
          Přejít na přihlášení
        </Link>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="rounded-[28px] border border-brand-purple/12 bg-white p-7 text-center shadow-brand">
        <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
        <h2 className="mt-4 text-xl font-black text-brand-ink">Heslo je nastavené</h2>
        <p className="mt-2 text-sm font-bold text-brand-ink-soft">Přesměrováváme vás do aplikace…</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-[28px] border border-brand-purple/12 bg-white p-6 shadow-brand md:p-7">
      <div className="rounded-[18px] border border-brand-purple/12 bg-brand-paper p-4">
        <p className="text-sm font-black text-brand-ink">Nastavení hesla</p>
        <p className="mt-1 text-xs font-bold leading-5 text-brand-ink-soft">
          {email ? `Účet: ${email}` : 'Zvolte si heslo pro přihlášení do Team VYS.'}
        </p>
      </div>

      <PasswordField
        label="Nové heslo"
        value={password}
        onChange={setPassword}
        visible={showPassword}
        onToggle={() => setShowPassword((value) => !value)}
      />

      <div className="space-y-2">
        <div className="h-2 overflow-hidden rounded-full bg-brand-paper">
          <div className="h-full rounded-full bg-gradient-brand transition-all" style={{ width: `${Math.max(strength, 1) * 25}%` }} />
        </div>
        <p className="text-xs font-bold text-brand-ink-soft">{passwordStrengthLabel(strength)}</p>
      </div>

      <PasswordField
        label="Potvrzení hesla"
        value={confirmPassword}
        onChange={setConfirmPassword}
        visible={showPassword}
        onToggle={() => setShowPassword((value) => !value)}
      />

      {message ? <p className="rounded-[16px] bg-brand-paper p-3 text-sm font-bold text-brand-ink-soft">{message}</p> : null}

      <button
        type="submit"
        disabled={phase === 'saving'}
        className="inline-flex w-full items-center justify-center gap-2 rounded-[18px] bg-gradient-brand px-6 py-4 text-sm font-black text-white shadow-brand-soft transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
      >
        <KeyRound size={18} />
        {phase === 'saving' ? 'Ukládám…' : 'Uložit heslo a přihlásit se'}
      </button>
    </form>
  );
}

function PasswordField({ label, value, onChange, visible, onToggle }: { label: string; value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-black uppercase text-brand-ink-soft">{label}</span>
      <span className="flex rounded-[16px] border border-brand-purple/12 bg-white transition focus-within:border-brand-purple">
        <input
          type={visible ? 'text' : 'password'}
          required
          minLength={6}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 rounded-[16px] bg-transparent px-4 py-3 text-brand-ink outline-none"
          placeholder="Alespoň 6 znaků"
        />
        <button type="button" onClick={onToggle} className="flex w-12 items-center justify-center text-brand-ink-soft hover:text-brand-ink" aria-label={visible ? 'Skrýt heslo' : 'Zobrazit heslo'}>
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}
