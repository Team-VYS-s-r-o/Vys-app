'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Gift, Loader2 } from 'lucide-react';
import { useState } from 'react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://server-psi-ochre-40.vercel.app';

const OPTIONS = [
  { entries: 10, amount: 2190, note: 'nejčastější volba' },
  { entries: 15, amount: 3190, note: 'výhodnější za vstup' },
];

export function GiftVoucherPurchase() {
  const [entries, setEntries] = useState(10);
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = OPTIONS.find((o) => o.entries === entries) ?? OPTIONS[0];

  async function handleBuy() {
    if (sending) return;
    if (!buyerEmail.includes('@')) {
      setError('Zadejte e-mail, na který máme poukaz poslat.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const origin = window.location.origin;
      const response = await fetch(`${apiUrl}/api/gift-vouchers/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries,
          buyerEmail: buyerEmail.trim(),
          buyerName: buyerName.trim(),
          recipientName: recipientName.trim(),
          giftMessage: giftMessage.trim(),
          successUrl: `${origin}/darkovy-poukaz?stav=hotovo`,
          cancelUrl: `${origin}/darkovy-poukaz`,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data?.error || 'Platbu se nepodařilo spustit.');
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Platbu se nepodařilo spustit.');
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 rounded-[28px] border border-white/10 bg-white/[0.04] p-6 md:grid-cols-[1.1fr_1fr] md:p-8">
      <div>
        <h2 className="text-2xl font-black md:text-3xl">Vyberte poukaz</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-white/60">
          Cena permanentky je ve všech našich městech stejná, takže poukaz platí kdekoliv.
        </p>

        <div className="mt-5 grid gap-3">
          {OPTIONS.map((option) => {
            const active = option.entries === entries;
            return (
              <button
                key={option.entries}
                type="button"
                onClick={() => setEntries(option.entries)}
                className={`flex items-center justify-between rounded-[18px] border-2 p-4 text-left transition ${
                  active ? 'border-[#B23BFF] bg-[#B23BFF]/10' : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                }`}
              >
                <span>
                  <span className="block text-lg font-black">Permanentka na {option.entries} vstupů</span>
                  <span className="mt-0.5 block text-xs font-bold uppercase tracking-wide text-white/45">{option.note}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-xl font-black">{option.amount.toLocaleString('cs-CZ')} Kč</span>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${active ? 'border-[#B23BFF] bg-[#B23BFF]' : 'border-white/25'}`}>
                    {active ? <Check size={14} /> : null}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
          <Gift size={18} className="mt-0.5 shrink-0 text-[#D9A6FF]" />
          <p className="text-sm font-semibold leading-6 text-white/60">
            Poukaz dorazí jako PDF k vytištění. Obdarovaný ho uplatní jednorázově v aplikaci —
            město, termín i dítě si vybere sám.
          </p>
        </div>
      </div>

      <div className="grid content-start gap-3">
        <label className="grid gap-1.5 text-sm font-black">
          Váš e-mail <span className="font-semibold text-white/45">— sem pošleme poukaz</span>
          <input
            type="email"
            value={buyerEmail}
            onChange={(e) => setBuyerEmail(e.target.value)}
            placeholder="vas@email.cz"
            className="rounded-[14px] border border-white/15 bg-[#14141C] px-4 py-3 text-sm font-semibold outline-none focus:border-[#B23BFF]"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-black">
          Vaše jméno <span className="font-semibold text-white/45">— nepovinné</span>
          <input
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            placeholder="Babička Jana"
            className="rounded-[14px] border border-white/15 bg-[#14141C] px-4 py-3 text-sm font-semibold outline-none focus:border-[#B23BFF]"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-black">
          Pro koho je dárek <span className="font-semibold text-white/45">— nepovinné</span>
          <input
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Pro Honzíka"
            className="rounded-[14px] border border-white/15 bg-[#14141C] px-4 py-3 text-sm font-semibold outline-none focus:border-[#B23BFF]"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-black">
          Vzkaz na poukaz <span className="font-semibold text-white/45">— nepovinné</span>
          <textarea
            value={giftMessage}
            onChange={(e) => setGiftMessage(e.target.value.slice(0, 200))}
            rows={3}
            placeholder="Ať se ti daří skákat!"
            className="resize-none rounded-[14px] border border-white/15 bg-[#14141C] px-4 py-3 text-sm font-semibold outline-none focus:border-[#B23BFF]"
          />
        </label>

        <AnimatePresence initial={false}>
          {error ? (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-sm font-bold text-[#FF8FB1]"
            >
              {error}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => void handleBuy()}
          disabled={sending}
          className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#8B1DFF] to-[#FF2BB3] px-6 py-4 text-base font-black transition hover:opacity-90 disabled:opacity-60"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Gift size={18} />}
          {sending ? 'Otevírám platbu…' : `Koupit za ${selected.amount.toLocaleString('cs-CZ')} Kč`}
        </button>
        <p className="text-center text-xs font-semibold text-white/40">Platba kartou přes Stripe · poukaz dorazí ihned po zaplacení</p>
      </div>
    </div>
  );
}
