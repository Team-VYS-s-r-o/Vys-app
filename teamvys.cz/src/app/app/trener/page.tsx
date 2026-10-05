import { Bell, CalendarDays, CheckCircle2, Clock, MapPin, QrCode, Sparkles, UsersRound, WalletCards } from 'lucide-react';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { SignOutButton } from '@/components/auth/sign-out-button';
import { DEV_BYPASS_AUTH } from '@/lib/dev-config';
import { createServerSupabaseClient, hasSupabaseServerConfig } from '@/lib/supabase/server';

type CoachSession = {
  id: string;
  city: string;
  venue: string;
  day: string;
  time: string;
  groupName: string;
  enrolled: number;
  present: number;
  durationHours: number;
  hourlyRate: number;
};

type CoachWard = {
  id: string;
  name: string;
  locations: string[];
  level: number;
  bracelet: string | null;
  braceletColor: string | null;
  paymentStatus: string;
  hasNfcChip: boolean;
  entriesLeft: number;
  lastAttendance: string | null;
};

type AttendanceRecord = {
  id: string;
  dateText: string;
  place: string;
  present: string | null;
  amount: number;
};

type CoachData = {
  name: string;
  level: number;
  xp: number;
  nextLevelXp: number;
  qrTricksApproved: number;
  attendanceLogged: number;
  bonusTotal: number;
  currentLocation: string | null;
  assignedCourses: string[];
  sessions: CoachSession[];
  wards: CoachWard[];
  attendanceRecords: AttendanceRecord[];
};

type AppSession = { coach: CoachData } | { redirectTo: string };

export const metadata = {
  title: 'Trenér',
};

export const dynamic = 'force-dynamic';

export default async function AppCoachPage() {
  const session = await getAppSession();
  if ('redirectTo' in session) redirect(session.redirectTo);

  const coach = session.coach;
  const firstName = coach.name.split(' ')[0] || coach.name;
  const xpProgress = percent(coach.xp, coach.nextLevelXp);
  const payoutTotal = coach.attendanceRecords.reduce((sum, record) => sum + record.amount, 0) + coach.bonusTotal;
  const todayName = new Date().toLocaleDateString('cs-CZ', { weekday: 'long' });
  const todaySessions = coach.sessions.filter((item) => item.day.toLowerCase() === capitalize(todayName).toLowerCase());
  const visibleSessions = todaySessions.length > 0 ? todaySessions : coach.sessions.slice(0, 3);

  return (
    <main className="min-h-dvh bg-brand-paper text-brand-ink texture-grid">
      <div className="mx-auto flex min-h-dvh w-full max-w-[940px] flex-col gap-4 px-4 pb-28 pt-4 sm:px-6 sm:pb-32 sm:pt-6">
        <section className="overflow-hidden rounded-[28px] border border-white/15 bg-gradient-to-br from-brand-ink via-[#2A1645] to-brand-purple p-5 text-white shadow-brand-float sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div className="rounded-[10px] border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white/90">
              Trenér
            </div>
            <SignOutButton redirectTo="/app/sign-in" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_260px] lg:items-end">
            <div>
              <h1 className="text-[42px] font-black leading-none tracking-normal text-white sm:text-6xl">Ahoj, {firstName}</h1>
              <p className="mt-4 max-w-[620px] text-xl font-black leading-tight text-white/85 sm:text-2xl">
                Tréninky, docházka, QR potvrzení, náramky a výplaty v jedné trenérské appce.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/15 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/65">Aktuální místo</p>
              <p className="mt-2 text-xl font-black leading-tight">{coach.currentLocation ?? 'Team VYS'}</p>
            </div>
          </div>

          <div className="mt-7 rounded-[22px] bg-white/10 p-4 backdrop-blur">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-black leading-none">Level {coach.level}</p>
                <p className="mt-2 text-sm font-black uppercase tracking-[0.14em] text-white/75">{coach.xp} / {coach.nextLevelXp} XP</p>
              </div>
              <div className="rounded-[12px] bg-white px-4 py-3 text-xl font-black text-brand-purple-deep shadow-brand-soft">
                {xpProgress} %
              </div>
            </div>
            <ProgressBar value={xpProgress} className="mt-4" />
          </div>
        </section>

        <section className="grid grid-cols-3 gap-3 sm:gap-4">
          <SummaryStat icon={CheckCircle2} value={String(coach.attendanceLogged)} label="Docházka" color="text-brand-purple" soft="bg-brand-purple/10" />
          <SummaryStat icon={QrCode} value={String(coach.qrTricksApproved)} label="QR triky" color="text-[#0E8FB8]" soft="bg-brand-cyan/10" />
          <SummaryStat icon={WalletCards} value={`${formatCzk(payoutTotal)}`} label="Výplata" color="text-brand-orange-deep" soft="bg-brand-orange/15" />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <AppCard icon={CalendarDays} kicker={todaySessions.length > 0 ? 'Dnešní tréninky' : 'Nadcházející tréninky'} title="Docházka a skupiny">
            {visibleSessions.map((item) => (
              <article key={item.id} className="rounded-[20px] border border-brand-purple/10 bg-white p-4 shadow-brand-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-black text-brand-ink">{item.groupName}</p>
                    <p className="mt-1 text-sm font-extrabold text-brand-ink-soft">{item.city} · {item.venue}</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-[14px] bg-brand-paper px-3 py-2 text-xs font-black text-brand-ink">
                    <Clock size={14} /> {item.day} {item.time}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <MiniMetric label="Přítomno" value={`${item.present}/${item.enrolled}`} />
                  <MiniMetric label="Hodiny" value={`${item.durationHours} h`} />
                  <MiniMetric label="Sazba" value={`${item.hourlyRate} Kč`} />
                </div>
              </article>
            ))}
          </AppCard>

          <AppCard icon={Bell} kicker="Akce" title="Rychlý přehled">
            <ActionRow icon={MapPin} title="GPS check-in" text={coach.currentLocation ?? 'Připraveno na tréninku'} />
            <ActionRow icon={QrCode} title="QR potvrzení triků" text={`${coach.qrTricksApproved} schválených triků`} />
            <ActionRow icon={Sparkles} title="Náramky" text="Fyzické předání a potvrzení" />
          </AppCard>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <AppCard icon={UsersRound} kicker="Svěřenci" title="Děti v kurzech">
            <div className="grid gap-3">
              {coach.wards.slice(0, 4).map((ward) => (
                <article key={ward.id} className="rounded-[20px] bg-brand-paper p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-brand-ink">{ward.name}</p>
                      <p className="mt-1 text-xs font-extrabold text-brand-ink-soft">{ward.locations.join(' · ') || 'Bez lokality'}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase text-brand-purple shadow-brand-soft">Lv {ward.level}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pill tone={ward.paymentStatus === 'Zaplaceno' ? 'mint' : 'orange'}>{ward.paymentStatus}</Pill>
                    <Pill tone="purple">{ward.bracelet ?? 'Náramek'}</Pill>
                    <Pill tone={ward.hasNfcChip ? 'cyan' : 'paper'}>{ward.hasNfcChip ? 'NFC' : 'Bez NFC'}</Pill>
                    <Pill tone="paper">{ward.entriesLeft} vstupů</Pill>
                  </div>
                </article>
              ))}
            </div>
          </AppCard>

          <AppCard icon={WalletCards} kicker="Výplaty" title="Poslední zápisy">
            <div className="grid gap-3">
              {coach.attendanceRecords.length > 0 ? coach.attendanceRecords.map((record) => (
                <article key={record.id} className="flex items-center justify-between gap-4 rounded-[20px] bg-brand-paper p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-brand-ink">{record.place}</p>
                    <p className="mt-1 text-xs font-extrabold text-brand-ink-soft">{record.dateText}{record.present ? ` · ${record.present}` : ''}</p>
                  </div>
                  <p className="shrink-0 text-lg font-black text-brand-purple">{formatCzk(record.amount)}</p>
                </article>
              )) : (
                <div className="rounded-[20px] bg-brand-paper p-4 text-sm font-extrabold text-brand-ink-soft">
                  Zatím tu není žádný zápis docházky.
                </div>
              )}
            </div>
          </AppCard>
        </section>

        <CoachTabBar />
      </div>
    </main>
  );
}

function SummaryStat({ icon: Icon, value, label, color, soft }: { icon: typeof CheckCircle2; value: string; label: string; color: string; soft: string }) {
  return (
    <div className="min-h-[112px] rounded-[20px] border border-brand-purple/10 bg-white px-2 py-5 text-center shadow-brand-soft sm:min-h-[132px] sm:px-4">
      <span className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full ${soft}`}>
        <Icon className={color} size={18} />
      </span>
      <p className={`mt-3 text-2xl font-black leading-none sm:text-3xl ${color}`}>{value}</p>
      <p className="mt-2 text-sm font-black leading-tight text-brand-ink-soft">{label}</p>
    </div>
  );
}

function AppCard({ icon: Icon, kicker, title, children }: { icon: typeof CalendarDays; kicker: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[24px] bg-white p-5 shadow-brand-soft">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-brand-purple-light text-brand-purple">
          <Icon size={22} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-purple">{kicker}</p>
          <h2 className="truncate text-2xl font-black text-brand-ink">{title}</h2>
        </div>
      </div>
      <div className="mt-5 grid gap-3">{children}</div>
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] bg-brand-paper px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-brand-ink-soft">{label}</p>
      <p className="mt-1 text-sm font-black text-brand-ink">{value}</p>
    </div>
  );
}

function ActionRow({ icon: Icon, title, text }: { icon: typeof MapPin; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[20px] bg-brand-paper p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-white text-brand-purple shadow-brand-soft">
        <Icon size={18} />
      </span>
      <div>
        <p className="text-sm font-black text-brand-ink">{title}</p>
        <p className="mt-1 text-xs font-extrabold leading-5 text-brand-ink-soft">{text}</p>
      </div>
    </div>
  );
}

function Pill({ tone, children }: { tone: 'mint' | 'orange' | 'purple' | 'cyan' | 'paper'; children: ReactNode }) {
  const tones = {
    mint: 'bg-brand-mint/15 text-[#18795F]',
    orange: 'bg-brand-orange/20 text-brand-orange-deep',
    purple: 'bg-brand-purple/10 text-brand-purple',
    cyan: 'bg-brand-cyan/10 text-[#0E8FB8]',
    paper: 'bg-white text-brand-ink-soft',
  };

  return <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase ${tones[tone]}`}>{children}</span>;
}

function CoachTabBar() {
  const items = [
    { icon: CalendarDays, label: 'Tréninky', active: true, color: 'from-brand-cyan to-brand-purple' },
    { icon: QrCode, label: 'QR', active: false, color: 'from-brand-purple to-brand-pink' },
    { icon: UsersRound, label: 'Svěřenci', active: false, color: 'from-brand-pink to-brand-orange' },
    { icon: WalletCards, label: 'Výplata', active: false, color: 'from-brand-orange to-brand-lime' },
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

function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-4 overflow-hidden rounded-full bg-white/15 ${className}`}>
      <div className="h-full rounded-full bg-gradient-to-r from-brand-cyan via-brand-purple to-brand-pink" style={{ width: `${value}%` }} />
    </div>
  );
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

function formatCzk(value: number) {
  return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(value) + ' Kč';
}

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function getAppSession(): Promise<AppSession> {
  if (DEV_BYPASS_AUTH) {
    return {
      coach: {
        name: 'Filip Trenér',
        level: 5,
        xp: 1840,
        nextLevelXp: 2400,
        qrTricksApproved: 68,
        attendanceLogged: 42,
        bonusTotal: 1500,
        currentLocation: 'Vyškov · ZŠ Nádražní',
        assignedCourses: ['Vyškov · ZŠ Nádražní', 'Vyškov · ZŠ Purkyňova', 'Prostějov · ZŠ Melantrichova'],
        sessions: [
          { id: 'session-vyskov-nadrazni', city: 'Vyškov', venue: 'ZŠ Nádražní', day: 'Středa', time: '16:30 - 17:30', groupName: 'Začátečníci 8-12', enrolled: 14, present: 11, durationHours: 1, hourlyRate: 500 },
          { id: 'session-vyskov-purkynova', city: 'Vyškov', venue: 'ZŠ Purkyňova', day: 'Pondělí', time: '15:30 - 16:30', groupName: 'Mladší skupina', enrolled: 12, present: 10, durationHours: 1, hourlyRate: 500 },
          { id: 'session-prostejov', city: 'Prostějov', venue: 'ZŠ Melantrichova', day: 'Sobota', time: '10:00 - 11:00', groupName: 'Mix level', enrolled: 16, present: 13, durationHours: 1, hourlyRate: 500 },
        ],
        wards: [
          { id: 'ward-eliska', name: 'Eliška Nováková', locations: ['Vyškov · ZŠ Nádražní'], level: 7, bracelet: 'Růžová', braceletColor: '#F5A7C8', paymentStatus: 'Zaplaceno', hasNfcChip: true, entriesLeft: 6, lastAttendance: 'Středa 24. 4. 2026 · 16:27' },
          { id: 'ward-alex', name: 'Alex Svoboda', locations: ['Vyškov · ZŠ Nádražní', 'Prostějov · ZŠ Melantrichova'], level: 9, bracelet: 'Fialová', braceletColor: '#8A62D6', paymentStatus: 'Zaplaceno', hasNfcChip: false, entriesLeft: 3, lastAttendance: 'Čeká na ruční zápis' },
          { id: 'ward-nela', name: 'Nela Horáková', locations: ['Vyškov · ZŠ Purkyňova'], level: 6, bracelet: 'Růžová', braceletColor: '#F5A7C8', paymentStatus: 'Čeká na platbu', hasNfcChip: true, entriesLeft: 0, lastAttendance: '17. 4. 2026 · 16:31' },
        ],
        attendanceRecords: [
          { id: 'att-1', dateText: '24. 4. 2026', place: 'Vyškov · ZŠ Nádražní', present: '11 / 14', amount: 500 },
          { id: 'att-2', dateText: '21. 4. 2026', place: 'Vyškov · ZŠ Purkyňova', present: '10 / 12', amount: 500 },
        ],
      },
    };
  }

  if (!hasSupabaseServerConfig()) return { redirectTo: '/app/sign-in' };

  const supabase = await createServerSupabaseClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (!user) return { redirectTo: '/app/sign-in?next=/app/trener' };

  const { data: profile } = await supabase
    .from('app_profiles')
    .select('role,name,email')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'coach') {
    return { redirectTo: profile?.role === 'participant' ? '/app/ucastnik' : '/sign-in' };
  }

  const { data: coachProfile } = await supabase
    .from('coach_profiles')
    .select('level,xp,next_level_xp,qr_tricks_approved,attendance_logged,bonus_total,current_location,assigned_courses,approval_status')
    .eq('id', user.id)
    .maybeSingle();

  if (coachProfile?.approval_status !== 'approved') {
    return { redirectTo: '/app/sign-in?next=/app/trener' };
  }

  const { data: sessionRows } = await supabase
    .from('coach_sessions')
    .select('id,city,venue,day,time,group_name,enrolled,present,duration_hours,hourly_rate')
    .eq('coach_id', user.id)
    .order('day', { ascending: true });

  const { data: wardRows } = await supabase
    .from('coach_wards')
    .select('id,name,locations,level,bracelet,bracelet_color,payment_status,has_nfc_chip,entries_left,last_attendance')
    .limit(8);

  const { data: attendanceRows } = await supabase
    .from('coach_attendance_records')
    .select('id,date_text,place,present,amount,created_at')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  return {
    coach: {
      name: profile.name || user.email || 'Trenér',
      level: coachProfile?.level ?? 1,
      xp: coachProfile?.xp ?? 0,
      nextLevelXp: coachProfile?.next_level_xp ?? 1000,
      qrTricksApproved: coachProfile?.qr_tricks_approved ?? 0,
      attendanceLogged: coachProfile?.attendance_logged ?? 0,
      bonusTotal: coachProfile?.bonus_total ?? 0,
      currentLocation: coachProfile?.current_location ?? null,
      assignedCourses: Array.isArray(coachProfile?.assigned_courses) ? coachProfile.assigned_courses : [],
      sessions: Array.isArray(sessionRows) ? sessionRows.map((item) => ({
        id: item.id,
        city: item.city,
        venue: item.venue,
        day: item.day,
        time: item.time,
        groupName: item.group_name,
        enrolled: item.enrolled,
        present: item.present,
        durationHours: Number(item.duration_hours ?? 1),
        hourlyRate: item.hourly_rate,
      })) : [],
      wards: Array.isArray(wardRows) ? wardRows.map((item) => ({
        id: item.id,
        name: item.name,
        locations: Array.isArray(item.locations) ? item.locations : [],
        level: item.level,
        bracelet: item.bracelet,
        braceletColor: item.bracelet_color,
        paymentStatus: item.payment_status,
        hasNfcChip: item.has_nfc_chip,
        entriesLeft: item.entries_left,
        lastAttendance: item.last_attendance,
      })) : [],
      attendanceRecords: Array.isArray(attendanceRows) ? attendanceRows.map((item) => ({
        id: item.id,
        dateText: item.date_text,
        place: item.place,
        present: item.present,
        amount: item.amount,
      })) : [],
    },
  };
}