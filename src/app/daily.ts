import { hashString } from "../engine/rng.ts";

/** The local calendar date as "YYYY-MM-DD". */
export function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value);
}

/** Where the search for a day's deal starts, the same on every device. */
export function dailyStart(date: string, variantId: string): number {
  return hashString(`${date}${variantId}`);
}

function addDays(key: string, days: number): string {
  const [year = 0, month = 1, day = 1] = key.split("-").map(Number);
  return dateKey(new Date(year, month - 1, day + days));
}

/**
 * Consecutive days, ending today, with at least one daily deal won. A day not yet won
 * today doesn't break the streak until it's over.
 */
export function dailyStreak(wonDays: ReadonlySet<string>, today: string): number {
  let day = wonDays.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (wonDays.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

/** The days of a month as weeks starting on Monday, with blanks before the 1st. */
export function monthGrid(year: number, month: number): (string | undefined)[][] {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const blanks = (first.getDay() + 6) % 7;
  const cells: (string | undefined)[] = [
    ...Array.from({ length: blanks }, (): undefined => undefined),
    ...Array.from({ length: days }, (_, i) => dateKey(new Date(year, month, i + 1))),
  ];
  const weeks: (string | undefined)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}
