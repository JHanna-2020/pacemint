export function toMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthBounds(monthKey: string): { start: string; end: string; daysInMonth: number } {
  const [year, month] = monthKey.split('-').map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));
  return {
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
    daysInMonth: endDate.getUTCDate()
  };
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  return toMonthKey(new Date(year, month - 1 + delta, 1));
}

export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1)
  );
}

export function daysRemainingInMonth(monthKey: string, today = new Date()): number {
  const currentMonth = toMonthKey(today);
  const { daysInMonth } = monthBounds(monthKey);
  if (monthKey < currentMonth) return 0;
  if (monthKey > currentMonth) return daysInMonth;
  return Math.max(0, daysInMonth - today.getDate() + 1);
}

export function dateForMonthDay(monthKey: string, dayOfMonth: number): string {
  const { daysInMonth } = monthBounds(monthKey);
  const safeDay = Math.min(Math.max(dayOfMonth, 1), daysInMonth);
  return `${monthKey}-${String(safeDay).padStart(2, '0')}`;
}

function utcDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  const value = utcDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function daysInRange(start: string, end: string): number {
  return Math.floor((utcDate(end).getTime() - utcDate(start).getTime()) / 86_400_000) + 1;
}

export function dateRangeLabel(start: string, end: string): string {
  const format = (value: string, includeYear: boolean) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      ...(includeYear ? { year: 'numeric' as const } : {})
    }).format(utcDate(value));
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${format(start, !sameYear)}–${format(end, true)}`;
}

export function monthlyPeriod(monthKey: string) {
  const { start, end } = monthBounds(monthKey);
  return {
    mode: 'monthly' as const,
    anchorMonth: monthKey,
    start,
    end,
    label: monthLabel(monthKey),
    statementProfileId: null
  };
}

export function statementPeriod(anchorMonth: string, closingDay: number, statementProfileId: string) {
  const previousMonth = shiftMonth(anchorMonth, -1);
  const previousClose = dateForMonthDay(previousMonth, closingDay);
  const end = dateForMonthDay(anchorMonth, closingDay);
  const start = addDays(previousClose, 1);
  return {
    mode: 'statement' as const,
    anchorMonth,
    start,
    end,
    label: dateRangeLabel(start, end),
    statementProfileId
  };
}

export function currentStatementAnchor(closingDay: number, today = new Date()): string {
  const currentMonth = toMonthKey(today);
  const candidate = dateForMonthDay(currentMonth, closingDay);
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return todayKey <= candidate ? currentMonth : shiftMonth(currentMonth, 1);
}

export function daysRemainingInPeriod(start: string, end: string, today = new Date()): number {
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (todayKey < start) return daysInRange(start, end);
  if (todayKey > end) return 0;
  return daysInRange(todayKey, end);
}

export function monthKeysForRange(start: string, end: string): string[] {
  const keys: string[] = [];
  let key = start.slice(0, 7);
  const last = end.slice(0, 7);
  while (key <= last) {
    keys.push(key);
    key = shiftMonth(key, 1);
  }
  return keys;
}
