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
