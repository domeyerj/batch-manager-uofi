/**
 * Pure (framework-free) schedule math for the Schedules & Forecast calendar.
 *
 * - Quartz cron (`sec min hour day-of-month month day-of-week [year]`), as used
 *   by ISC source aggregation schedules (`GET /sources/v1/{id}/schedules`).
 *   Days of week are 1-7 = SUN-SAT. Supports `*`, `?`, lists, ranges, steps,
 *   month/day names, `L`, `LW`, `L-n`, `nW` (day-of-month) and `nL`, `n#k`
 *   (day-of-week).
 * - Scheduled-search schedules (`DAILY | WEEKLY | MONTHLY | ANNUALLY` with
 *   LIST/RANGE selectors), as returned by `GET /scheduled-searches/v1`.
 *
 * Every projection is evaluated as wall-clock time in an IANA time zone and
 * returned as absolute `Date` instants. No Angular imports: unit-testable in
 * isolation.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Time-zone helpers (Intl-based, no dependencies)
// ─────────────────────────────────────────────────────────────────────────────

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

export interface WallClock {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number;
  minute: number;
  second: number;
}

/** Wall-clock fields of an instant in a time zone. */
export function toWallClock(instantMs: number, timeZone: string): WallClock {
  const parts = formatterFor(timeZone).formatToParts(new Date(instantMs));
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

/** Offset (ms) of `timeZone` from UTC at the given instant: local = utc + offset. */
export function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const w = toWallClock(instantMs, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/**
 * Convert a wall-clock time in `timeZone` to an absolute instant (ms).
 * During a DST "gap" the time is shifted forward by the gap length; during an
 * overlap one of the two occurrences is returned (good enough for a forecast).
 */
export function wallClockToInstant(w: WallClock, timeZone: string): number {
  const guess = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  const offset1 = zoneOffsetMs(guess, timeZone);
  const first = guess - offset1;
  const offset2 = zoneOffsetMs(first, timeZone);
  if (offset2 === offset1) return first;
  // Offsets differ around a transition. Prefer the candidate whose wall clock
  // matches; if none does (spring-forward gap), shift forward past the gap.
  const second = guess - offset2;
  const w2 = toWallClock(second, timeZone);
  if (w2.hour === w.hour && w2.minute === w.minute) return second;
  return Math.max(first, second);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar helpers
// ─────────────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 1 = Sunday … 7 = Saturday (Quartz numbering). */
function quartzDow(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 1;
}

function isWeekday(year: number, month: number, day: number): boolean {
  const d = quartzDow(year, month, day);
  return d >= 2 && d <= 6;
}

/** Nearest weekday to `target` within the same month (Quartz `W`). */
function nearestWeekday(year: number, month: number, target: number): number {
  const last = daysInMonth(year, month);
  const t = Math.min(target, last);
  const dow = quartzDow(year, month, t);
  if (dow === 7) return t === 1 ? 3 : t - 1; // Saturday → Friday (or Monday the 3rd)
  if (dow === 1) return t === last ? t - 2 : t + 1; // Sunday → Monday (or Friday)
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quartz cron parsing
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};
const DOW_NAMES: Record<string, number> = { SUN: 1, MON: 2, TUE: 3, WED: 4, THU: 5, FRI: 6, SAT: 7 };

/** Day-of-month rule. */
type DomRule =
  | { kind: 'any' }
  | { kind: 'set'; values: Set<number> }
  | { kind: 'last'; offset: number } // L, L-n
  | { kind: 'lastWeekday' } // LW
  | { kind: 'nearestWeekday'; day: number }; // nW

/** Day-of-week rule. */
type DowRule =
  | { kind: 'any' }
  | { kind: 'set'; values: Set<number> }
  | { kind: 'lastOfMonth'; dow: number } // nL
  | { kind: 'nth'; dow: number; nth: number }; // n#k

export interface QuartzCron {
  expression: string;
  seconds: number[];
  minutes: number[];
  hours: number[];
  dom: DomRule;
  months: Set<number>;
  dow: DowRule;
  years: Set<number> | null; // null = every year
}

export class CronParseError extends Error {
  constructor(message: string, readonly expression: string) {
    super(message);
    this.name = 'CronParseError';
  }
}

function parseValue(token: string, names: Record<string, number> | null, field: string, expr: string): number {
  const upper = token.toUpperCase();
  if (names && upper in names) return names[upper];
  if (!/^\d+$/.test(token)) throw new CronParseError(`Invalid ${field} value "${token}"`, expr);
  return Number(token);
}

/** Parse a numeric field (sec/min/hour/month/year or plain dom/dow lists). */
function parseSet(
  field: string,
  min: number,
  max: number,
  names: Record<string, number> | null,
  label: string,
  expr: string,
): Set<number> {
  const out = new Set<number>();
  for (const part of field.split(',')) {
    if (!part) throw new CronParseError(`Empty ${label} list item`, expr);
    const [rangePart, stepPart] = part.split('/');
    const step = stepPart === undefined ? 1 : parseValue(stepPart, null, label, expr);
    if (step < 1) throw new CronParseError(`Invalid ${label} step "${stepPart}"`, expr);
    let start: number;
    let end: number;
    if (rangePart === '*' || rangePart === '?') {
      start = min;
      end = max;
    } else if (rangePart.includes('-')) {
      const [a, b] = rangePart.split('-');
      start = parseValue(a, names, label, expr);
      end = parseValue(b, names, label, expr);
    } else {
      start = parseValue(rangePart, names, label, expr);
      end = stepPart === undefined ? start : max; // "5/15" = from 5 every 15
    }
    if (start < min || start > max || end < min || end > max) {
      throw new CronParseError(`${label} value out of range (${min}-${max}) in "${part}"`, expr);
    }
    if (start <= end) {
      for (let v = start; v <= end; v += step) out.add(v);
    } else {
      // Wrap-around range, e.g. FRI-MON or 22-2: walk start..max then min..end.
      const seq: number[] = [];
      for (let v = start; v <= max; v++) seq.push(v);
      for (let v = min; v <= end; v++) seq.push(v);
      for (let i = 0; i < seq.length; i += step) out.add(seq[i]);
    }
  }
  return out;
}

function parseDom(field: string, expr: string): DomRule {
  const f = field.toUpperCase();
  if (f === '?' || f === '*') return { kind: 'any' };
  if (f === 'L') return { kind: 'last', offset: 0 };
  if (f === 'LW') return { kind: 'lastWeekday' };
  const lastOffset = f.match(/^L-(\d+)$/);
  if (lastOffset) return { kind: 'last', offset: Number(lastOffset[1]) };
  const nearest = f.match(/^(\d+)W$/);
  if (nearest) {
    const day = Number(nearest[1]);
    if (day < 1 || day > 31) throw new CronParseError(`Invalid day-of-month "${field}"`, expr);
    return { kind: 'nearestWeekday', day };
  }
  return { kind: 'set', values: parseSet(field, 1, 31, null, 'day-of-month', expr) };
}

function parseDow(field: string, expr: string): DowRule {
  const f = field.toUpperCase();
  if (f === '?' || f === '*') return { kind: 'any' };
  const last = f.match(/^([A-Z]{3}|\d)L$/);
  if (last) return { kind: 'lastOfMonth', dow: parseValue(last[1], DOW_NAMES, 'day-of-week', expr) };
  const nth = f.match(/^([A-Z]{3}|\d)#([1-5])$/);
  if (nth) {
    return { kind: 'nth', dow: parseValue(nth[1], DOW_NAMES, 'day-of-week', expr), nth: Number(nth[2]) };
  }
  return { kind: 'set', values: parseSet(field, 1, 7, DOW_NAMES, 'day-of-week', expr) };
}

/** Parse a Quartz cron expression. Throws {@link CronParseError}. */
export function parseQuartzCron(expression: string): QuartzCron {
  const expr = (expression ?? '').trim();
  const fields = expr.split(/\s+/);
  if (fields.length < 6 || fields.length > 7) {
    throw new CronParseError(`Expected 6 or 7 fields, got ${fields.length}`, expr);
  }
  const [sec, min, hour, dom, month, dow, year] = fields;
  const sorted = (s: Set<number>) => [...s].sort((a, b) => a - b);
  return {
    expression: expr,
    seconds: sorted(parseSet(sec, 0, 59, null, 'second', expr)),
    minutes: sorted(parseSet(min, 0, 59, null, 'minute', expr)),
    hours: sorted(parseSet(hour, 0, 23, null, 'hour', expr)),
    dom: parseDom(dom, expr),
    months: parseSet(month, 1, 12, MONTH_NAMES, 'month', expr),
    dow: parseDow(dow, expr),
    years: year === undefined || year === '*' ? null : parseSet(year, 1970, 2199, null, 'year', expr),
  };
}

function domMatches(rule: DomRule, y: number, m: number, d: number): boolean {
  switch (rule.kind) {
    case 'any':
      return true;
    case 'set':
      return rule.values.has(d);
    case 'last':
      return d === daysInMonth(y, m) - rule.offset;
    case 'lastWeekday': {
      let last = daysInMonth(y, m);
      while (!isWeekday(y, m, last)) last--;
      return d === last;
    }
    case 'nearestWeekday':
      return rule.day <= daysInMonth(y, m) && d === nearestWeekday(y, m, rule.day);
  }
}

function dowMatches(rule: DowRule, y: number, m: number, d: number): boolean {
  const dow = quartzDow(y, m, d);
  switch (rule.kind) {
    case 'any':
      return true;
    case 'set':
      return rule.values.has(dow);
    case 'lastOfMonth':
      return dow === rule.dow && d + 7 > daysInMonth(y, m);
    case 'nth':
      return dow === rule.dow && Math.ceil(d / 7) === rule.nth;
  }
}

function dayMatches(cron: QuartzCron, y: number, m: number, d: number): boolean {
  if (cron.years && !cron.years.has(y)) return false;
  if (!cron.months.has(m)) return false;
  // Quartz requires one of the two day fields to be '?'; if both are restricted
  // we require both to match (the conservative reading).
  return domMatches(cron.dom, y, m, d) && dowMatches(cron.dow, y, m, d);
}

export interface ProjectionOptions {
  /** IANA zone the expression is evaluated in. */
  timeZone: string;
  /** Hard cap on returned occurrences (protects the UI from `* * * * * ?`). */
  limit?: number;
}

export interface Projection {
  occurrences: Date[];
  /** True when `limit` cut the list short. */
  truncated: boolean;
}

/**
 * Iterate wall-clock calendar days covering [fromMs, toMs) in `timeZone`,
 * yielding y/m/d. One day of padding each side absorbs offset differences.
 */
function* zonedDays(fromMs: number, toMs: number, timeZone: string): Generator<[number, number, number]> {
  const start = toWallClock(fromMs - DAY_MS, timeZone);
  const end = toWallClock(toMs + DAY_MS, timeZone);
  let cursor = Date.UTC(start.year, start.month - 1, start.day);
  const stop = Date.UTC(end.year, end.month - 1, end.day);
  for (; cursor <= stop; cursor += DAY_MS) {
    const dt = new Date(cursor);
    yield [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
  }
}

/** All instants in [from, to) when the Quartz expression fires. */
export function projectQuartzCron(cron: QuartzCron, from: Date, to: Date, opts: ProjectionOptions): Projection {
  const limit = opts.limit ?? 5000;
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const out: Date[] = [];
  for (const [y, m, d] of zonedDays(fromMs, toMs, opts.timeZone)) {
    if (!dayMatches(cron, y, m, d)) continue;
    for (const hour of cron.hours) {
      for (const minute of cron.minutes) {
        for (const second of cron.seconds) {
          const t = wallClockToInstant({ year: y, month: m, day: d, hour, minute, second }, opts.timeZone);
          if (t < fromMs || t >= toMs) continue;
          if (out.length >= limit) return { occurrences: out, truncated: true };
          out.push(new Date(t));
        }
      }
    }
  }
  out.sort((a, b) => a.getTime() - b.getTime());
  return { occurrences: out, truncated: false };
}

/** Next fire time strictly after `after`, searching up to `horizonDays` ahead. */
export function nextQuartzRun(cron: QuartzCron, after: Date, timeZone: string, horizonDays = 400): Date | null {
  const step = 31 * DAY_MS;
  for (let start = after.getTime() + 1; start < after.getTime() + horizonDays * DAY_MS; start += step) {
    const { occurrences } = projectQuartzCron(cron, new Date(start), new Date(start + step), { timeZone, limit: 1 });
    if (occurrences.length) return occurrences[0];
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Human-readable description (returned as i18n key + params)
// ─────────────────────────────────────────────────────────────────────────────

export interface CronDescription {
  /** Translation key under `schedules.cron.*`. */
  key: string;
  params: Record<string, string | number>;
}

const DOW_LABELS = ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function hhmm(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function evenStep(values: number[]): number | null {
  if (values.length < 2) return null;
  const step = values[1] - values[0];
  return values.every((v, i) => i === 0 || v - values[i - 1] === step) ? step : null;
}

/** Best-effort summary; falls back to `schedules.cron.custom` with the raw expression. */
export function describeQuartzCron(cron: QuartzCron): CronDescription {
  const { minutes, hours, dom, dow, months } = cron;
  const allMonths = months.size === 12;
  const anyDay = dom.kind === 'any' && dow.kind === 'any';

  if (anyDay && allMonths && minutes.length === 1) {
    if (hours.length === 1) {
      return { key: 'schedules.cron.daily', params: { time: hhmm(hours[0], minutes[0]) } };
    }
    const step = evenStep(hours);
    if (step && hours.length >= 3 && hours[0] < step && hours[hours.length - 1] + step > 23) {
      return { key: 'schedules.cron.everyNHours', params: { n: step, minute: String(minutes[0]).padStart(2, '0') } };
    }
    if (hours.length <= 6) {
      return { key: 'schedules.cron.dailyAtTimes', params: { times: hours.map((h) => hhmm(h, minutes[0])).join(', ') } };
    }
  }
  if (anyDay && allMonths && hours.length === 24 && minutes.length > 1) {
    const step = evenStep(minutes);
    if (step && minutes[0] < step) return { key: 'schedules.cron.everyNMinutes', params: { n: step } };
  }
  if (dom.kind === 'any' && dow.kind === 'set' && allMonths && minutes.length === 1 && hours.length === 1) {
    const days = [...dow.values].sort((a, b) => a - b).map((d) => DOW_LABELS[d]).join(', ');
    return { key: 'schedules.cron.weekly', params: { days, time: hhmm(hours[0], minutes[0]) } };
  }
  if (dow.kind === 'any' && dom.kind === 'set' && allMonths && minutes.length === 1 && hours.length === 1) {
    const days = [...dom.values].sort((a, b) => a - b).join(', ');
    return { key: 'schedules.cron.monthly', params: { days, time: hhmm(hours[0], minutes[0]) } };
  }
  if (dow.kind === 'any' && dom.kind === 'last' && dom.offset === 0 && allMonths && minutes.length === 1 && hours.length === 1) {
    return { key: 'schedules.cron.monthlyLastDay', params: { time: hhmm(hours[0], minutes[0]) } };
  }
  return { key: 'schedules.cron.custom', params: { expression: cron.expression } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduled-search schedules (DAILY / WEEKLY / MONTHLY / ANNUALLY)
// ─────────────────────────────────────────────────────────────────────────────

/** Structural subset of the ISC `schedule` / `selector` schemas. */
export interface ScheduleSelectorLike {
  type?: string; // LIST | RANGE
  values?: string[];
  interval?: number | null;
}

export interface SearchScheduleLike {
  type?: string; // DAILY | WEEKLY | MONTHLY | CALENDAR | ANNUALLY
  months?: ScheduleSelectorLike | null;
  days?: ScheduleSelectorLike | null;
  hours?: ScheduleSelectorLike | null;
  expiration?: string | null;
  timeZoneId?: string | null;
}

function expandSelector(sel: ScheduleSelectorLike | null | undefined, map: (v: string) => number): number[] {
  if (!sel?.values?.length) return [];
  const nums = sel.values.map(map).filter((n) => Number.isFinite(n));
  if ((sel.type ?? 'LIST').toUpperCase() === 'RANGE' && nums.length >= 2) {
    const step = sel.interval && sel.interval > 0 ? sel.interval : 1;
    const out: number[] = [];
    for (let v = nums[0]; v <= nums[1]; v += step) out.push(v);
    return out;
  }
  return nums;
}

/** True when the schedule type can be projected (CALENDAR and unknown types cannot). */
export function isProjectableSearchSchedule(schedule: SearchScheduleLike | null | undefined): boolean {
  const t = (schedule?.type ?? '').toUpperCase();
  return ['DAILY', 'WEEKLY', 'MONTHLY', 'ANNUALLY'].includes(t) && !!schedule?.hours?.values?.length;
}

/**
 * Instants in [from, to) for a scheduled-search schedule. Runs fire at minute 0
 * of each selected hour. `fallbackTimeZone` is used when `timeZoneId` is absent
 * (ISC then uses the org default zone).
 */
export function projectSearchSchedule(
  schedule: SearchScheduleLike,
  from: Date,
  to: Date,
  fallbackTimeZone: string,
  limit = 2000,
): Projection {
  const type = (schedule.type ?? '').toUpperCase();
  if (!isProjectableSearchSchedule(schedule)) return { occurrences: [], truncated: false };
  const tz = schedule.timeZoneId && isValidTimeZone(schedule.timeZoneId) ? schedule.timeZoneId : fallbackTimeZone;
  const hours = expandSelector(schedule.hours, Number).filter((h) => h >= 0 && h <= 23);
  const weekDays = new Set(expandSelector(schedule.days, (v) => DOW_NAMES[v.toUpperCase()] ?? NaN));
  const dayValues = schedule.days?.values ?? [];
  const monthDays = new Set(expandSelector(schedule.days, (v) => (v.toUpperCase() === 'L' ? NaN : Number(v))));
  const wantsLastDay = dayValues.some((v) => v.toUpperCase() === 'L');
  const months = new Set(expandSelector(schedule.months, Number));
  const expires = schedule.expiration ? Date.parse(schedule.expiration) : NaN;
  const toMs = Number.isFinite(expires) ? Math.min(to.getTime(), expires) : to.getTime();
  const fromMs = from.getTime();

  const out: Date[] = [];
  for (const [y, m, d] of zonedDays(fromMs, toMs, tz)) {
    let match = false;
    switch (type) {
      case 'DAILY':
        match = true;
        break;
      case 'WEEKLY':
        match = weekDays.has(quartzDow(y, m, d));
        break;
      case 'ANNUALLY':
        if (!months.has(m)) break;
        match = monthDays.has(d) || (wantsLastDay && d === daysInMonth(y, m));
        break;
      case 'MONTHLY':
        match = monthDays.has(d) || (wantsLastDay && d === daysInMonth(y, m));
        break;
    }
    if (!match) continue;
    for (const hour of hours) {
      const t = wallClockToInstant({ year: y, month: m, day: d, hour, minute: 0, second: 0 }, tz);
      if (t < fromMs || t >= toMs) continue;
      if (out.length >= limit) return { occurrences: out, truncated: true };
      out.push(new Date(t));
    }
  }
  out.sort((a, b) => a.getTime() - b.getTime());
  return { occurrences: out, truncated: false };
}
