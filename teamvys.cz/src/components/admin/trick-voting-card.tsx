'use client';

import { Trophy } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { type TrickVoteResult, getAdminTrickVotes } from '@/lib/api-client';

export function TrickVotingCard() {
  const [results, setResults] = useState<TrickVoteResult[]>([]);
  const [week, setWeek] = useState<string>('');
  const [totalVotes, setTotalVotes] = useState(0);
  const [totalVoters, setTotalVoters] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getAdminTrickVotes();
      setResults(res.results);
      setWeek(res.week);
      setTotalVotes(res.totalVotes);
      setTotalVoters(res.totalVoters);
    } catch {
      setResults([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!loaded) return null;

  const max = results.reduce((m, r) => Math.max(m, r.votes), 0) || 1;
  const weekLabel = week
    ? new Date(week).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' })
    : '';

  return (
    <section className="rounded-brand-lg border bg-white p-6" style={{ borderColor: 'rgba(20,14,38,0.08)', boxShadow: 'var(--shadow-card)' }}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-brand-pink text-xs font-black uppercase tracking-[0.16em]">Hlasování týdne</p>
          <h2 className="text-xl font-black text-brand-ink mt-1">Triky na příští workshop s youtuberem</h2>
          <p className="text-[#5C5474] text-sm leading-6 mt-1 max-w-[620px]">
            Rodiče a účastníci každý týden hlasují, jaké triky by chtěli na workshopu s youtuberem. Podle pořadí
            níže poskládáš náplň dalšího workshopu. {weekLabel ? <>Týden od <strong>{weekLabel}</strong>.</> : null} Každé pondělí se tabulka resetuje.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="rounded-[14px] border border-brand-purple/12 bg-brand-paper px-3 py-2 text-center">
            <p className="text-lg font-black text-brand-ink">{totalVotes}</p>
            <p className="text-[10px] font-black uppercase tracking-wide text-brand-ink-soft">hlasů</p>
          </div>
          <div className="rounded-[14px] border border-brand-purple/12 bg-brand-paper px-3 py-2 text-center">
            <p className="text-lg font-black text-brand-ink">{totalVoters}</p>
            <p className="text-[10px] font-black uppercase tracking-wide text-brand-ink-soft">hlasujících</p>
          </div>
        </div>
      </div>

      {results.length === 0 ? (
        <p className="rounded-[16px] border border-dashed border-brand-purple/20 bg-brand-paper px-4 py-8 text-center text-sm font-bold text-brand-ink-soft">
          Tento týden zatím nikdo nehlasoval. Jakmile rodiče a účastníci v appce zvolí triky, uvidíš tu pořadí.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {results.map((r, i) => (
            <li key={r.trickName} className="flex items-center gap-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] text-sm font-black ${i === 0 ? 'bg-brand-purple text-white' : 'bg-brand-purple/10 text-brand-purple'}`}>
                {i === 0 ? <Trophy size={15} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-black text-brand-ink">{r.trickName}</p>
                  <span className="shrink-0 text-xs font-black text-brand-ink-soft">{r.votes}×</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-brand-purple/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-pink"
                    style={{ width: `${Math.round((r.votes / max) * 100)}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
