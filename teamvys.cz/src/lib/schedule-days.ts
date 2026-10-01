export const WEEK_DAY_NAMES = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];

export function normalizeDayName(value: string | null | undefined) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// "Úterý / Čtvrtek 17:00 - 18:00" → ['Úterý', 'Čtvrtek']
export function parseScheduleDays(primaryMeta: string | null | undefined): string[] {
  const normalizedMeta = normalizeDayName(primaryMeta);
  return WEEK_DAY_NAMES.filter((day) => normalizedMeta.includes(normalizeDayName(day)));
}

// "Úterý / Čtvrtek 17:00 - 18:00" → "17:00 - 18:00"
export function parseScheduleTime(primaryMeta: string | null | undefined): string | null {
  const match = String(primaryMeta ?? '').match(/\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}/);
  return match ? match[0].replace(/\s*[-–]\s*/, ' - ') : null;
}

export function formatTrainingDays(days: string[] | null | undefined): string | null {
  if (!days || days.length === 0) return null;
  return days.join(' + ');
}

// Accusative forms for "v pondělí / ve středu / v sobotu…" (index = Monday 0 … Sunday 6).
const DAY_ACCUSATIVE = ['pondělí', 'úterý', 'středu', 'čtvrtek', 'pátek', 'sobotu', 'neděli'];

// First training date in October of the current year for the given weekday
// names, formatted as "v pátek 2. 10." — the season starts on the first
// occurrence of each location's training day, not on Oct 1 for everyone.
export function formatSeasonStart(days: string[] | null | undefined): string | null {
  if (!days || days.length === 0) return null;
  const wanted = days.map((day) => WEEK_DAY_NAMES.indexOf(day)).filter((index) => index >= 0);
  if (wanted.length === 0) return null;

  const year = new Date().getFullYear();
  for (let dayOfMonth = 1; dayOfMonth <= 31; dayOfMonth += 1) {
    const date = new Date(year, 9, dayOfMonth);
    const weekIndex = (date.getDay() + 6) % 7; // Monday = 0, matches WEEK_DAY_NAMES
    if (wanted.includes(weekIndex)) {
      const preposition = weekIndex === 2 || weekIndex === 3 ? 've' : 'v';
      return `${preposition} ${DAY_ACCUSATIVE[weekIndex]} ${dayOfMonth}. 10.`;
    }
  }
  return null;
}
