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

// Parses "4.11.2026", "4. 11. 2026" or ISO "2026-11-04" into a Date (midnight).
function parseStartDate(value: string | null | undefined): Date | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const czech = text.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (czech) return new Date(Number(czech[3]), Number(czech[2]) - 1, Number(czech[1]));
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return null;
}

function formatStartLabel(date: Date): string {
  const weekIndex = (date.getDay() + 6) % 7; // Monday = 0, matches WEEK_DAY_NAMES
  const preposition = weekIndex === 2 || weekIndex === 3 ? 've' : 'v';
  return `${preposition} ${DAY_ACCUSATIVE[weekIndex]} ${date.getDate()}. ${date.getMonth() + 1}.`;
}

// "Začínáme …" for a course card. Prefers the start date the admin typed on the
// product (eventDate); otherwise falls back to the first occurrence of the
// training day in October. Once the first lesson has passed, returns null so
// the card stops advertising a start date.
export function formatCourseStart(eventDates: Array<string | null | undefined>, days: string[] | null | undefined): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const starts = eventDates.map(parseStartDate).filter((date): date is Date => date !== null).sort((a, b) => a.getTime() - b.getTime());
  if (starts.length > 0) {
    const next = starts.find((date) => date.getTime() >= today.getTime());
    return next ? formatStartLabel(next) : null;
  }

  if (!days || days.length === 0) return null;
  const wanted = days.map((day) => WEEK_DAY_NAMES.indexOf(day)).filter((index) => index >= 0);
  if (wanted.length === 0) return null;

  const year = today.getFullYear();
  for (let dayOfMonth = 1; dayOfMonth <= 31; dayOfMonth += 1) {
    const date = new Date(year, 9, dayOfMonth);
    if (date.getMonth() !== 9) break;
    const weekIndex = (date.getDay() + 6) % 7;
    if (wanted.includes(weekIndex)) {
      return date.getTime() >= today.getTime() ? formatStartLabel(date) : null;
    }
  }
  return null;
}
