import { Bell, Bolt, CalendarCheck, ChartNoAxesColumn, Gift, Medal, QrCode, Route, Ticket } from 'lucide-react';
import { redirect } from 'next/navigation';

import { SignOutButton } from '@/components/auth/sign-out-button';
import { DEV_BYPASS_AUTH } from '@/lib/dev-config';
import { monthlyRewardPath } from '@/lib/monthly-rewards';
import { createServerSupabaseClient, hasSupabaseServerConfig } from '@/lib/supabase/server';

const braceletStages = [
  { id: 'beige', title: 'Béžová', xpRequired: 0, color: '#D8C2A3' },
  { id: 'pink', title: 'Růžová', xpRequired: 600, color: '#F5A7C8' },
  { id: 'purple', title: 'Fialová', xpRequired: 1400, color: '#8A62D6' },
  { id: 'darkPurple', title: 'Tmavě fialová', xpRequired: 2400, color: '#4C2B86' },
  { id: 'black', title: 'Černá', xpRequired: 3800, color: '#16151A' },
] as const;

type ActivePurchase = {
  type?: string;
  title?: string;
  status?: string;
};

type DigitalPassData = {
  title: string;
  location: string;
  nfcChipId: string;
  totalEntries: number;
  usedEntries: number;
  lastScanAt: string | null;
  lastScanPlace: string | null;
};

type ParticipantData = {
  id: string;
  name: string;
  xp: number;
  nextBraceletXp: number;
  level: number;
  activeCourse: string | null;
  nextTraining: string | null;
  qrTricks: number;
  activePurchases: ActivePurchase[];
  digitalPass: DigitalPassData;
};

type AppSession = { participant: ParticipantData } | { redirectTo: string };

export const metadata = {
  title: 'Účastník',
};

export const dynamic = 'force-dynamic';

export default async function AppParticipantPage() {
  const session = await getAppSession();
  if ('redirectTo' in session) redirect(session.redirectTo);

  const participant = session.participant;
  const currentStage = findCurrentStage(participant.xp);
  const nextStage = findNextStage(participant.xp);
  const braceletTarget = nextStage?.xpRequired ?? participant.nextBraceletXp;
  const braceletProgress = percent(participant.xp, braceletTarget);
  const entriesLeft = Math.max(participant.digitalPass.totalEntries - participant.digitalPass.usedEntries, 0);
  const passProgress = percent(participant.digitalPass.usedEntries, participant.digitalPass.totalEntries);
  const nextReward = monthlyRewardPath.find((reward) => participant.xp < reward.xp);
  const nextRewardDistance = Math.max(0, (nextReward?.xp ?? participant.xp) - participant.xp);
  const unlockedRewards = monthlyRewardPath.filter((reward) => participant.xp >= reward.xp);
  const displayPurchases = participant.activePurchases.length > 0 ? participant.activePurchases : defaultPurchases(participant.digitalPass.title);

  return (
    <main className="min-h-dvh bg-brand-paper text-brand-ink texture-grid">
      <div className="mx-auto flex min-h-dvh w-full max-w-[860px] flex-col gap-4 px-4 pb-28 pt-4 sm:px-6 sm:pb-32 sm:pt-6">
        <section className="overflow-hidden rounded-[28px] border border-brand-purple/15 bg-gradient-brand p-5 text-white shadow-brand-float sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div className="rounded-[10px] border border-white/30 bg-white/20 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
              Účastník
            </div>
            <SignOutButton redirectTo="/app/sign-in" />
          </div>

          <div className="mt-6 max-w-[620px]">
            <h1 className="text-[42px] font-black leading-[0.96] tracking-normal text-[#FFF6D8] sm:text-6xl">
              {participant.name}
            </h1>
            <p className="mt-5 max-w-[620px] text-[23px] font-black leading-tight text-white sm:text-3xl">
              Tvůj náramek, permanentka a odměny na jednom místě. Drž se cesty a sbírej XP.
            </p>
          </div>

          <div className="mt-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-2xl font-black leading-none sm:text-4xl">{participant.xp} / {braceletTarget} XP</p>
                <p className="mt-2 text-sm font-black uppercase tracking-[0.14em] text-white sm:text-base">Postup k dalšímu náramku</p>
              </div>
              <div className="rounded-[12px] bg-white/90 px-4 py-3 text-xl font-black text-brand-purple-deep shadow-brand-soft">
                {braceletProgress} %
              </div>
            </div>
            <ProgressBar className="mt-5" value={braceletProgress} fill="bg-brand-purple" track="bg-white/18" />
          </div>

          <div className="mt-7 grid grid-cols-[minmax(92px,140px)_1fr] gap-4">
            <div className="flex min-h-[120px] flex-col items-center justify-center rounded-[22px] bg-brand-ink text-white shadow-brand-soft">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/70">Level</p>
              <p className="mt-2 text-6xl font-black leading-none">{participant.level}</p>
            </div>
            <div className="flex min-h-[120px] items-center gap-4 rounded-[22px] bg-brand-purple-light px-5 py-4 text-brand-ink shadow-brand-soft">
              <span className="h-8 w-8 shrink-0 rounded-full border-[5px] border-white" style={{ backgroundColor: currentStage.color }} />
              <div className="min-w-0">
                <p className="truncate text-2xl font-black leading-tight">{currentStage.title}</p>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-purple-deep">Aktuální náramek</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-3 sm:gap-4">
          <SummaryStat icon={Bolt} value={String(participant.xp)} label="Celkem XP" color="text-brand-purple" soft="bg-brand-purple/10" />
          <SummaryStat icon={Ticket} value={String(entriesLeft)} label="Vstupů zbývá" color="text-[#0E8FB8]" soft="bg-brand-cyan/12" />
          <SummaryStat icon={Gift} value={String(nextRewardDistance)} label="XP k odměně" color="text-brand-orange-deep" soft="bg-brand-orange/14" />
        </section>

        <section className="overflow-hidden rounded-[28px] border border-brand-cyan/25 bg-white p-5 shadow-brand-soft sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#0E8FB8]">Digitální permanentka</p>
              <h2 className="mt-2 text-4xl font-black leading-tight sm:text-5xl">{participant.digitalPass.title}</h2>
              <p className="mt-1 text-lg font-extrabold text-brand-ink-soft">{participant.digitalPass.location}</p>
            </div>
            <div className="rounded-full border border-brand-mint/40 bg-brand-mint/15 px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#0E8FB8]">
              NFC
            </div>
          </div>

          <div className="mt-6 rounded-[20px] bg-brand-mint/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xl font-black">{participant.digitalPass.usedEntries} z {participant.digitalPass.totalEntries} vstupů</p>
              <p className="text-xl font-black text-[#0E8FB8]">{passProgress} %</p>
            </div>
            <ProgressBar className="mt-4" value={passProgress} fill="bg-[#0E8FB8]" track="bg-brand-mint/18" />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <PassStat value={`${participant.digitalPass.usedEntries}x`} label="Využito" />
            <PassStat value={`${entriesLeft}x`} label="Zbývá" highlight />
            <PassStat value={`${participant.digitalPass.totalEntries}x`} label="Celkem" />
          </div>

          <div className="mt-6 border-t border-brand-ink/10 pt-5">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-brand-ink-soft">Poslední načtení</p>
            <p className="mt-1 text-sm font-black text-brand-ink">{participant.digitalPass.lastScanAt ?? 'Zatím bez načtení'}</p>
            <p className="mt-4 text-[11px] font-black uppercase tracking-[0.14em] text-brand-ink-soft">Čip</p>
            <p className="mt-1 text-sm font-black text-brand-ink">{participant.digitalPass.nfcChipId}</p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <AppCard title="Questy" subtitle="co se teď děje" accent="bg-brand-pink">
            <QuestRow icon={Bell} text="Zpráva od trenéra" />
            <QuestRow icon={CalendarCheck} text={participant.nextTraining ? `Další trénink: ${participant.nextTraining}` : 'Další trénink se brzy objeví'} />
            <QuestRow icon={QrCode} text={`${participant.qrTricks} QR triků odemčeno ve skill tree`} />
          </AppCard>

          <div className="overflow-hidden rounded-[24px] bg-gradient-warm p-5 text-white shadow-brand-soft">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white/80">Další odměna</p>
            <h3 className="mt-3 text-2xl font-black leading-tight">{nextReward?.title ?? 'Cesta dokončena'}</h3>
            <p className="mt-2 text-sm font-extrabold text-white/85">
              {nextReward ? `${nextRewardDistance} XP zbývá` : `${unlockedRewards.length} odměn odemčeno`}
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] bg-white p-5 shadow-brand-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-purple">Zakoupeno</p>
              <h2 className="mt-1 text-2xl font-black">Aktivní věci</h2>
            </div>
            <Medal className="text-brand-purple" size={24} />
          </div>
          <div className="mt-4 grid gap-3">
            {displayPurchases.map((purchase, index) => (
              <div key={`${purchase.title}-${index}`} className="flex items-center justify-between gap-3 rounded-[18px] bg-brand-paper px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-brand-ink">{purchase.title}</p>
                  <p className="text-xs font-extrabold text-brand-ink-soft">{purchase.type}</p>
                </div>
                <p className="shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase text-brand-purple shadow-brand-soft">{purchase.status}</p>
              </div>
            ))}
          </div>
        </section>

        <ParticipantTabBar />
      </div>
    </main>
  );
}

function SummaryStat({ icon: Icon, value, label, color, soft }: { icon: typeof Bolt; value: string; label: string; color: string; soft: string }) {
  return (
    <div className="min-h-[112px] rounded-[20px] border border-brand-purple/10 bg-white px-2 py-5 text-center shadow-brand-soft sm:min-h-[132px] sm:px-4">
      <span className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full ${soft}`}>
        <Icon className={color} size={18} />
      </span>
      <p className={`mt-3 text-3xl font-black leading-none sm:text-4xl ${color}`}>{value}</p>
      <p className="mt-2 text-sm font-black leading-tight text-brand-ink-soft">{label}</p>
    </div>
  );
}

function PassStat({ value, label, highlight = false }: { value: string; label: string; highlight?: boolean }) {
  return (
    <div className={`rounded-[18px] p-4 ${highlight ? 'bg-brand-mint/12' : 'bg-brand-surface-alt'}`}>
      <p className={`text-3xl font-black leading-none ${highlight ? 'text-[#0E8FB8]' : 'text-brand-ink'}`}>{value}</p>
      <p className="mt-2 text-sm font-black text-brand-ink-soft">{label}</p>
    </div>
  );
}

function AppCard({ title, subtitle, accent, children }: { title: string; subtitle: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[24px] bg-white p-5 shadow-brand-soft">
      <span className={`absolute bottom-0 left-0 top-0 w-1.5 ${accent}`} />
      <p className="text-xl font-black text-brand-ink">{title}</p>
      <p className="mt-1 text-sm font-extrabold text-brand-ink-soft">{subtitle}</p>
      <div className="mt-4 grid gap-3">{children}</div>
    </div>
  );
}

function QuestRow({ icon: Icon, text }: { icon: typeof Bell; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-pink/14 text-brand-pink">
        <Icon size={15} />
      </span>
      <p className="flex-1 text-sm font-extrabold leading-6 text-brand-ink">{text}</p>
    </div>
  );
}

function ParticipantTabBar() {
  const items = [
    { icon: QrCode, label: 'Přehled', active: true, color: 'from-brand-cyan to-brand-purple' },
    { icon: Gift, label: 'Cesta', active: false, color: 'from-brand-orange to-brand-lime' },
    { icon: Route, label: 'Skill tree', active: false, color: 'from-brand-purple to-brand-pink' },
    { icon: ChartNoAxesColumn, label: 'Žebříček', active: false, color: 'from-brand-pink to-brand-orange' },
  ];

  return (
    <nav className="fixed bottom-4 left-1/2 z-30 grid h-[74px] w-[min(calc(100%-32px),430px)] -translate-x-1/2 grid-cols-4 items-center rounded-[30px] border border-white/80 bg-white/65 px-3 py-2 shadow-brand-float backdrop-blur-xl">
      {items.map((item) => (
        <button key={item.label} type="button" aria-label={item.label} className="flex h-14 items-center justify-center rounded-[22px]">
          <span className={`flex h-12 w-12 items-center justify-center rounded-full ${item.active ? `bg-gradient-to-br ${item.color} text-white shadow-brand-soft` : 'bg-white/70 text-brand-ink-soft ring-1 ring-brand-ink/5'}`}>
            <item.icon size={24} />
          </span>
        </button>
      ))}
    </nav>
  );
}

function ProgressBar({ value, fill, track, className = '' }: { value: number; fill: string; track: string; className?: string }) {
  return (
    <div className={`h-5 overflow-hidden rounded-full ${track} ${className}`}>
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${value}%` }} />
    </div>
  );
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

function findCurrentStage(xp: number) {
  return [...braceletStages].reverse().find((stage) => xp >= stage.xpRequired) ?? braceletStages[0];
}

function findNextStage(xp: number) {
  return braceletStages.find((stage) => xp < stage.xpRequired) ?? null;
}

function defaultPurchases(passTitle: string): ActivePurchase[] {
  return [
    { type: 'Kroužek', title: passTitle, status: 'Aktivní' },
    { type: 'Tábor', title: 'Letní tábor', status: 'Rezervováno' },
    { type: 'Workshop', title: 'Workshop', status: 'Zamčeno' },
  ];
}

function parseActivePurchases(value: unknown): ActivePurchase[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ActivePurchase => typeof item === 'object' && item !== null);
}

async function getAppSession(): Promise<AppSession> {
  if (DEV_BYPASS_AUTH) {
    return {
      participant: {
        id: 'demo-child-1',
        name: 'Eliška Nováková',
        xp: 920,
        nextBraceletXp: 1400,
        level: 7,
        activeCourse: 'Vyškov · ZŠ Nádražní',
        nextTraining: 'Středa 16:30',
        qrTricks: 12,
        activePurchases: defaultPurchases('Permanentka 10 vstupů'),
        digitalPass: {
          title: 'Permanentka 10 vstupů',
          location: 'Vyškov · ZŠ Nádražní',
          nfcChipId: 'NFC-VYS-0428',
          totalEntries: 10,
          usedEntries: 4,
          lastScanAt: 'Středa 24. 4. 2026 · 16:27',
          lastScanPlace: 'Vyškov · ZŠ Nádražní',
        },
      },
    };
  }

  if (!hasSupabaseServerConfig()) return { redirectTo: '/app/sign-in' };

  const supabase = await createServerSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (!user) return { redirectTo: '/app/sign-in?next=/app/ucastnik' };

  const { data: profile } = await supabase
    .from('app_profiles')
    .select('role,name,email')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) return { redirectTo: '/app/sign-in' };
  if (profile.role !== 'participant') {
    return { redirectTo: profile.role === 'coach' ? '/app/trener' : '/sign-in' };
  }

  const { data: participant } = await supabase
    .from('participants')
    .select('id,first_name,last_name,level,xp,next_bracelet_xp,attendance_done,attendance_total,active_course,next_training,active_purchases')
    .eq('id', user.id)
    .maybeSingle();

  const { data: passRows } = await supabase
    .from('digital_passes')
    .select('title,location,nfc_chip_id,total_entries,used_entries,last_scan_at,last_scan_place,created_at')
    .eq('participant_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);

  const { data: ward } = await supabase
    .from('coach_wards')
    .select('completed_trick_ids,level')
    .eq('id', user.id)
    .maybeSingle();

  const pass = Array.isArray(passRows) ? passRows[0] : null;
  const attendanceTotal = Number(participant?.attendance_total ?? 0);
  const attendanceDone = Number(participant?.attendance_done ?? 0);
  const fallbackTotal = attendanceTotal > 0 ? attendanceTotal : 10;
  const fallbackUsed = attendanceTotal > 0 ? Math.min(attendanceDone, fallbackTotal) : 0;
  const name = [participant?.first_name, participant?.last_name].filter(Boolean).join(' ') || profile.name || user.email || 'Účastník';
  const qrTricks = Array.isArray(ward?.completed_trick_ids) ? (ward.completed_trick_ids as unknown[]).length : 0;

  return {
    participant: {
      id: participant?.id ?? user.id,
      name,
      xp: participant?.xp ?? 0,
      nextBraceletXp: participant?.next_bracelet_xp ?? 600,
      level: participant?.level ?? ward?.level ?? 1,
      activeCourse: participant?.active_course ?? null,
      nextTraining: participant?.next_training ?? null,
      qrTricks,
      activePurchases: parseActivePurchases(participant?.active_purchases),
      digitalPass: {
        title: pass?.title ?? 'Permanentka 10 vstupů',
        location: pass?.location ?? participant?.active_course ?? 'Team VYS',
        nfcChipId: pass?.nfc_chip_id ?? 'NFC zatím nepřiřazen',
        totalEntries: pass?.total_entries ?? fallbackTotal,
        usedEntries: pass?.used_entries ?? fallbackUsed,
        lastScanAt: pass?.last_scan_at ?? null,
        lastScanPlace: pass?.last_scan_place ?? null,
      },
    },
  };
}