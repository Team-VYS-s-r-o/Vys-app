'use client';

import { useCallback, useEffect, useState } from 'react';

import { deleteOrgStripeKeys, getOrgStripeStatus, saveOrgStripeKeys, type OrgStripeStatus } from '@/lib/api-client';

// Stripe configuration card for external-org admins.
// Each org provides their own Stripe API keys — no Stripe Connect needed.
// The VYS (platform) org has isVys=true and this card hides itself.
export function OrgStripeConnectCard() {
  const [status, setStatus] = useState<OrgStripeStatus | null>(null);
  const [hidden, setHidden] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageOk, setMessageOk] = useState(false);
  const [copied, setCopied] = useState(false);

  const [secretKey, setSecretKey] = useState('');
  const [publishableKey, setPublishableKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const s = await getOrgStripeStatus();
      if (s.isVys) { setHidden(true); return; }
      setStatus(s);
    } catch (error) {
      const text = error instanceof Error ? error.message : '';
      if (text.includes('Team VYS') || text.includes('TeamVYS')) { setHidden(true); return; }
      setMessage(text || 'Stav Stripe účtu se nepodařilo načíst.');
    }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const result = await saveOrgStripeKeys({
        secretKey: secretKey.trim(),
        publishableKey: publishableKey.trim(),
        ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
      });
      setMessageOk(true);
      setMessage(`Stripe klíče uloženy. Webhook URL: ${result.webhookUrl}`);
      setShowForm(false);
      setSecretKey(''); setPublishableKey(''); setWebhookSecret('');
      await loadStatus();
    } catch (error) {
      setMessageOk(false);
      setMessage(error instanceof Error ? error.message : 'Uložení se nezdařilo.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Opravdu odebrat Stripe klíče? Platby rodičů přestanou fungovat.')) return;
    setDeleting(true);
    setMessage(null);
    try {
      await deleteOrgStripeKeys();
      setMessageOk(false);
      setMessage('Stripe klíče odebrány.');
      await loadStatus();
    } catch (error) {
      setMessageOk(false);
      setMessage(error instanceof Error ? error.message : 'Odebrání se nezdařilo.');
    } finally {
      setDeleting(false);
    }
  }

  async function copyWebhook() {
    const url = status?.webhookUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — user can copy manually */
    }
  }

  if (hidden) return null;

  const ready = status?.configured && status.keyValid;
  const webhookUrl = status?.webhookUrl ?? '';

  return (
    <section
      className="rounded-brand-lg border bg-white p-6 mb-6"
      style={{ borderColor: 'rgba(20,14,38,0.08)', boxShadow: 'var(--shadow-card)' }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg"
            style={{ backgroundColor: ready ? 'rgba(34,197,94,0.12)' : 'rgba(241,43,179,0.10)' }}
          >
            <span>{ready ? '✅' : '💳'}</span>
          </div>
          <div>
            <p className="text-brand-pink text-xs font-black uppercase tracking-[0.16em]">Platby od rodičů</p>
            <h2 className="text-xl font-black text-brand-ink mt-0.5">Peníze chodí přímo vaší organizaci</h2>
            <p className="text-[#5C5474] text-sm leading-6 mt-1 max-w-[560px]">
              {ready
                ? 'Hotovo! Platby rodičů za vaše kroužky, tábory a workshopy chodí přímo na váš Stripe účet. Z něj pak v záložce Finance vyplácíte své trenéry.'
                : 'Propojte svůj Stripe účet — bezpečnou platební bránu. Peníze od rodičů pak chodí rovnou vám a z nich vyplácíte trenéry. Nastavení zabere pár minut a děláte ho jen jednou.'}
            </p>
          </div>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide"
          style={ready
            ? { backgroundColor: 'rgba(34,197,94,0.12)', color: '#15803D' }
            : { backgroundColor: 'rgba(241,43,179,0.10)', color: '#B0157F' }}
        >
          {ready ? 'Aktivní' : 'Nenastaveno'}
        </span>
      </div>

      {/* Active state: money-flow summary + manage buttons */}
      {ready && !showForm && (
        <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: 'rgba(34,197,94,0.25)', backgroundColor: 'rgba(34,197,94,0.05)' }}>
          <p className="text-sm font-bold text-brand-ink">Jak teď peníze tečou</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#3F3A52]">
            <span className="rounded-full bg-white px-3 py-1 font-bold shadow-sm">Rodič zaplatí v appce</span>
            <span className="text-brand-pink font-black">→</span>
            <span className="rounded-full bg-white px-3 py-1 font-bold shadow-sm">Váš Stripe účet</span>
            <span className="text-brand-pink font-black">→</span>
            <span className="rounded-full bg-white px-3 py-1 font-bold shadow-sm">Výplata trenérům (Finance)</span>
          </div>
          {webhookUrl && (
            <p className="text-xs text-[#5C5474] mt-3 break-all">
              Webhook: <code className="bg-white px-1.5 py-0.5 rounded font-mono">{webhookUrl}</code>
              {status?.webhookConfigured ? ' · potvrzený' : ' · doplňte signing secret pro vyšší bezpečnost'}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-full border border-brand-ink/20 px-4 py-2 text-sm font-bold text-brand-ink transition hover:bg-brand-ink/5"
            >
              Upravit klíče
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? 'Odebírám…' : 'Odpojit Stripe'}
            </button>
          </div>
        </div>
      )}

      {/* Not configured: 3-step mini guide */}
      {!ready && !showForm && (
        <>
          <ol className="mt-5 space-y-3">
            <StripeStep n={1} title="Založte si Stripe účet (zdarma)">
              Na{' '}
              <a href="https://dashboard.stripe.com/register" target="_blank" rel="noopener noreferrer" className="font-bold text-brand-ink underline underline-offset-2">stripe.com</a>{' '}
              si vytvořte účet organizace. Stripe je ověřená platební brána, kterou používá i většina e-shopů.
            </StripeStep>
            <StripeStep n={2} title="Zkopírujte 2 API klíče">
              Ve Stripe otevřete{' '}
              <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="font-bold text-brand-ink underline underline-offset-2">Developers → API keys</a>{' '}
              a zkopírujte <b>Secret key</b> (začíná <code className="font-mono text-xs">sk_</code>) a <b>Publishable key</b> (začíná <code className="font-mono text-xs">pk_</code>).
            </StripeStep>
            <StripeStep n={3} title="Přidejte webhook (ať se platby potvrzují)">
              Ve Stripe: <b>Developers → Webhooks → Add endpoint</b>. Vložte tuto adresu a vyberte událost{' '}
              <code className="font-mono text-xs">payment_intent.succeeded</code>:
              {webhookUrl && (
                <span className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="bg-gray-100 px-2 py-1 rounded font-mono text-xs break-all">{webhookUrl}</code>
                  <button
                    type="button"
                    onClick={copyWebhook}
                    className="rounded-full border border-brand-ink/20 px-3 py-1 text-xs font-bold text-brand-ink transition hover:bg-brand-ink/5"
                  >
                    {copied ? 'Zkopírováno ✓' : 'Kopírovat'}
                  </button>
                </span>
              )}
            </StripeStep>
          </ol>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-full bg-brand-ink px-5 py-2.5 text-sm font-black text-white transition hover:opacity-90"
            >
              Mám klíče → vyplnit
            </button>
            <span className="text-xs text-[#5C5474]">Trvá to ~5 minut.</span>
          </div>

          <p className="text-xs text-[#5C5474] mt-4 leading-relaxed">
            <b>Poplatky:</b> Team VYS si z plateb nebere nic navíc — peníze jdou celé vám. Stripe si účtuje jen svůj
            transakční poplatek za zpracování karty (u evropských karet cca 1,5 % + malý fixní poplatek). Ten platí
            u sportovních služeb stejně jako u čehokoli jiného — není to poplatek „za zboží“, ale za platbu kartou.
          </p>
        </>
      )}

      {showForm && (
        <form onSubmit={handleSave} className="mt-6 space-y-4 border-t pt-5" style={{ borderColor: 'rgba(20,14,38,0.08)' }}>
          <p className="text-sm text-[#5C5474] leading-relaxed">
            Klíče najdeš v{' '}
            <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="font-bold text-brand-ink underline underline-offset-2">
              Stripe Dashboard → Developers → API keys
            </a>.
            Použij klíče svého Stripe účtu (ne Team VYS). Platby rodičů poté chodí přímo na tvůj Stripe.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-black text-brand-ink mb-1 uppercase tracking-wide">Secret key <span className="text-brand-pink">*</span></label>
              <input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="sk_live_... nebo sk_test_..."
                required
                className="w-full rounded-xl border border-brand-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-ink/30"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-brand-ink mb-1 uppercase tracking-wide">Publishable key <span className="text-brand-pink">*</span></label>
              <input
                type="text"
                value={publishableKey}
                onChange={(e) => setPublishableKey(e.target.value)}
                placeholder="pk_live_... nebo pk_test_..."
                required
                className="w-full rounded-xl border border-brand-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-ink/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-brand-ink mb-1 uppercase tracking-wide">
              Webhook signing secret <span className="text-[#5C5474] font-normal normal-case">(volitelné, ale doporučené)</span>
            </label>
            <input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="whsec_..."
              className="w-full rounded-xl border border-brand-ink/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-ink/30"
            />
            <p className="text-xs text-[#5C5474] mt-1.5">
              Ve Stripe → Developers → Webhooks přidej endpoint (viz krok 3 výše) a vlož sem jeho{' '}
              <b>Signing secret</b> (začíná <code className="font-mono text-xs">whsec_</code>).
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-brand-ink px-6 py-2.5 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Ukládám a ověřuji…' : 'Uložit klíče'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setMessage(null); }}
              className="rounded-full border border-brand-ink/20 px-5 py-2.5 text-sm font-bold text-brand-ink transition hover:bg-brand-ink/5"
            >
              Zrušit
            </button>
          </div>
        </form>
      )}

      {message ? (
        <p className={`text-sm font-bold mt-3 ${messageOk ? 'text-green-700' : 'text-brand-pink'}`}>{message}</p>
      ) : null}
    </section>
  );
}

// Numbered step used in the Stripe setup mini-guide.
function StripeStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-ink text-xs font-black text-white">{n}</span>
      <div className="min-w-0">
        <p className="text-sm font-black text-brand-ink">{title}</p>
        <p className="text-sm text-[#5C5474] leading-6 mt-0.5">{children}</p>
      </div>
    </li>
  );
}

