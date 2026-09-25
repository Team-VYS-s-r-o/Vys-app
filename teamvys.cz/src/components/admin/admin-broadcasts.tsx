'use client';

import { Check, MapPin, Maximize2, MessageSquarePlus, Minimize2, Search, Send, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { type AdminBroadcast, listBroadcasts, sendBroadcast } from '@/lib/api-client';

// Structurally satisfied by the admin dashboard's AdminParticipant.
type BroadcastParticipant = {
  parentProfileId?: string;
  parentName?: string;
  firstName: string;
  lastName: string;
  activeCourse: string;
};

type ParentRecipient = {
  parentProfileId: string;
  parentName: string;
  children: Array<{ name: string; course: string }>;
};

function buildParents(participants: BroadcastParticipant[]): ParentRecipient[] {
  const map = new Map<string, ParentRecipient>();
  for (const p of participants) {
    if (!p.parentProfileId) continue;
    const entry = map.get(p.parentProfileId) ?? {
      parentProfileId: p.parentProfileId,
      parentName: p.parentName?.trim() || 'Rodič',
      children: [],
    };
    const name = `${p.firstName} ${p.lastName}`.trim();
    if (name && !entry.children.some((c) => c.name === name)) entry.children.push({ name, course: p.activeCourse || '' });
    map.set(p.parentProfileId, entry);
  }
  return Array.from(map.values()).sort((a, b) => a.parentName.localeCompare(b.parentName, 'cs'));
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function AdminBroadcastsSection({ participants }: { participants: BroadcastParticipant[] }) {
  const parents = useMemo(() => buildParents(participants), [participants]);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'selected' | 'location'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageOk, setMessageOk] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<AdminBroadcast[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const { broadcasts } = await listBroadcasts();
      setHistory(broadcasts);
    } catch {
      setHistory([]);
    }
  }, []);
  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const filteredParents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return parents;
    return parents.filter(
      (p) =>
        p.parentName.toLowerCase().includes(q) ||
        p.children.some((c) => c.name.toLowerCase().includes(q) || c.course.toLowerCase().includes(q)),
    );
  }, [parents, search]);

  const locations = useMemo(() => {
    const set = new Set<string>();
    for (const p of parents) for (const c of p.children) if (c.course && c.course.trim()) set.add(c.course.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'cs'));
  }, [parents]);

  const recipientIds = audience === 'all'
    ? parents.map((p) => p.parentProfileId)
    : audience === 'location'
      ? parents.filter((p) => p.children.some((c) => selectedLocations.has(c.course.trim()))).map((p) => p.parentProfileId)
      : Array.from(selected);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleLocation(loc: string) {
    setSelectedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(loc)) next.delete(loc);
      else next.add(loc);
      return next;
    });
  }

  async function handleSend() {
    if (!title.trim()) {
      setMessageOk(false);
      setMessage('Vyplň předmět zprávy.');
      return;
    }
    if (!body.trim()) {
      setMessageOk(false);
      setMessage('Napiš text zprávy.');
      return;
    }
    if (recipientIds.length === 0) {
      setMessageOk(false);
      setMessage('Vyber aspoň jednoho příjemce.');
      return;
    }
    setSending(true);
    setMessage(null);
    try {
      const result = await sendBroadcast({ title: title.trim(), body: body.trim(), audience: audience === 'all' ? 'all' : 'selected', parentProfileIds: recipientIds });
      setMessageOk(true);
      setMessage(
        `Zpráva odeslána ${result.recipients} rodičům${result.pushed ? ` · ${result.pushed}× push oznámení` : ''}${result.skipped ? ` · ${result.skipped} příjemců přeskočeno (nepatří k tvé organizaci)` : ''}.`,
      );
      setTitle('');
      setBody('');
      setSelected(new Set());
      setSelectedLocations(new Set());
      setAudience('all');
      await loadHistory();
    } catch (err) {
      setMessageOk(false);
      setMessage(err instanceof Error ? err.message : 'Zprávu se nepodařilo odeslat.');
    } finally {
      setSending(false);
    }
  }

  const inputClass =
    'w-full rounded-[14px] border border-brand-purple/15 bg-brand-paper px-3 py-2.5 text-sm font-bold text-brand-ink outline-none focus:border-brand-purple';

  return (
    <div className="space-y-5">
      <section className="rounded-brand-lg border bg-white p-6" style={{ borderColor: 'rgba(20,14,38,0.08)', boxShadow: 'var(--shadow-card)' }}>
        <div className="mb-4">
          <p className="text-brand-pink text-xs font-black uppercase tracking-[0.16em]">Hromadná zpráva</p>
          <h2 className="text-xl font-black text-brand-ink mt-1">Poslat oznámení rodičům</h2>
          <p className="text-[#5C5474] text-sm leading-6 mt-1 max-w-[640px]">
            Napiš zprávu, vyber komu ji poslat, a rodičům se objeví v centru oznámení v aplikaci (a jako push notifikace na telefon). U každého rodiče vidíš jeho dítě, ať se snadno zorientuješ.
          </p>
        </div>

        <div className={`grid gap-3 transition-[width] duration-[650ms] ease-[cubic-bezier(0.65,0,0.35,1)] ${expanded ? 'w-full' : 'w-[68%] min-w-[320px]'}`}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Předmět (např. Zítřejší trénink odpadá)" className={inputClass} />
          <div className="relative">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Text zprávy pro rodiče…"
              className={`${inputClass} resize-none overflow-auto pr-12 transition-[height] duration-[650ms] ease-[cubic-bezier(0.65,0,0.35,1)]`}
              style={{ height: expanded ? '58vh' : '116px' }}
            />
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-pressed={expanded}
              title={expanded ? 'Zmenšit pole' : 'Zvětšit pole'}
              className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-[10px] border border-brand-purple/15 bg-white/90 text-brand-purple shadow-sm backdrop-blur transition hover:bg-brand-purple/10 active:scale-95"
            >
              {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-purple mb-2">Komu poslat</p>
          <div className="grid grid-cols-3 gap-1 rounded-[14px] border border-brand-purple/15 bg-brand-paper p-1 max-w-[560px]">
            <button
              type="button"
              onClick={() => setAudience('all')}
              className={`rounded-[10px] px-3 py-2 text-sm font-black transition ${audience === 'all' ? 'bg-brand-purple text-white shadow-brand' : 'text-brand-purple hover:bg-brand-purple/10'}`}
            >
              Všem rodičům ({parents.length})
            </button>
            <button
              type="button"
              onClick={() => setAudience('location')}
              className={`rounded-[10px] px-3 py-2 text-sm font-black transition ${audience === 'location' ? 'bg-brand-purple text-white shadow-brand' : 'text-brand-purple hover:bg-brand-purple/10'}`}
            >
              Podle lokality
            </button>
            <button
              type="button"
              onClick={() => setAudience('selected')}
              className={`rounded-[10px] px-3 py-2 text-sm font-black transition ${audience === 'selected' ? 'bg-brand-purple text-white shadow-brand' : 'text-brand-purple hover:bg-brand-purple/10'}`}
            >
              Vybrat konkrétní
            </button>
          </div>
        </div>

        {audience === 'location' ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-brand-purple">Vyber lokality</p>
            {locations.length === 0 ? (
              <p className="text-sm font-bold text-brand-ink-soft">Zatím žádné lokality.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {locations.map((loc) => {
                  const on = selectedLocations.has(loc);
                  const count = parents.filter((p) => p.children.some((c) => c.course.trim() === loc)).length;
                  return (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => toggleLocation(loc)}
                      className={`inline-flex items-center gap-1.5 rounded-[12px] px-3 py-1.5 text-sm font-black transition ${on ? 'bg-brand-purple text-white' : 'bg-brand-paper text-brand-purple hover:bg-brand-purple/10'}`}
                    >
                      {on ? <Check size={13} /> : <MapPin size={13} />} {loc} <span className="opacity-70">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {audience === 'selected' ? (
          <div className="mt-4">
            <div className="relative mb-2">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink-soft" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hledat rodiče, dítě nebo lokalitu…" className={`${inputClass} pl-9`} />
            </div>
            <div className="max-h-[320px] overflow-y-auto rounded-[16px] border border-brand-purple/12">
              {filteredParents.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm font-bold text-brand-ink-soft">Žádný rodič neodpovídá hledání.</p>
              ) : (
                <ul>
                  {filteredParents.map((parent) => {
                    const isOn = selected.has(parent.parentProfileId);
                    return (
                      <li key={parent.parentProfileId} className="border-b border-brand-purple/8 last:border-b-0">
                        <button type="button" onClick={() => toggle(parent.parentProfileId)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition hover:bg-brand-purple/5">
                          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[7px] border-2 transition ${isOn ? 'border-brand-purple bg-brand-purple text-white' : 'border-brand-purple/25 bg-white'}`}>
                            {isOn ? <Check size={13} /> : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-black text-brand-ink">{parent.parentName}</span>
                            <span className="block text-[12px] font-bold text-brand-ink-soft">
                              {parent.children.map((c) => (c.course ? `${c.name} · ${c.course}` : c.name)).join(' • ')}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="inline-flex items-center gap-2 text-sm font-black text-brand-ink">
            <Users size={16} className="text-brand-purple" />
            Příjemců: {recipientIds.length}
          </p>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-[14px] bg-brand-purple px-5 py-2.5 text-sm font-black text-white shadow-brand transition hover:bg-brand-purple/90 disabled:opacity-50"
          >
            <Send size={16} />
            {sending ? 'Odesílám…' : 'Odeslat zprávu'}
          </button>
        </div>

        {message ? (
          <p className={`mt-3 rounded-[12px] px-3 py-2 text-sm font-bold ${messageOk ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{message}</p>
        ) : null}
      </section>

      <section className="rounded-brand-lg border bg-white p-6" style={{ borderColor: 'rgba(20,14,38,0.08)', boxShadow: 'var(--shadow-card)' }}>
        <div className="mb-4 flex items-center gap-2">
          <MessageSquarePlus size={18} className="text-brand-purple" />
          <h2 className="text-lg font-black text-brand-ink">Odeslané zprávy</h2>
        </div>
        {history.length === 0 ? (
          <p className="rounded-[12px] border border-dashed border-brand-purple/20 bg-brand-paper px-3 py-6 text-center text-sm font-bold text-brand-ink-soft">
            Zatím jsi neposlal žádnou hromadnou zprávu.
          </p>
        ) : (
          <ul className="space-y-2">
            {history.map((b) => (
              <li key={b.id} className="rounded-[14px] border border-brand-purple/10 bg-white px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black text-brand-ink">{b.title}</p>
                  <span className="rounded-full bg-brand-purple/10 px-2.5 py-0.5 text-[11px] font-black text-brand-purple">
                    {b.recipient_count} {b.audience === 'all' ? 'všem' : 'vybraným'}
                  </span>
                </div>
                <p className="mt-1 text-[13px] font-bold leading-5 text-brand-ink-soft">{b.body}</p>
                <p className="mt-1 text-[11px] font-bold text-brand-ink-soft">{formatDate(b.created_at)} · {b.sender_name}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
