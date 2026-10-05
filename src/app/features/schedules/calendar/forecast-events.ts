/**
 * Turns raw ISC schedule/task data into calendar events. Pure and framework-free.
 *
 * - Future (>= now): projected runs from source cron schedules, scheduled
 *   searches and ISC's built-in identity processing.
 * - Past (< now): actual task runs from `GET /task-status/v1`.
 */
import {
  type CronDescription,
  type SearchScheduleLike,
  CronParseError,
  describeQuartzCron,
  isProjectableSearchSchedule,
  parseQuartzCron,
  projectQuartzCron,
  projectSearchSchedule,
} from './cron-engine';

export type ForecastKind =
  | 'ACCOUNT_AGGREGATION'
  | 'GROUP_AGGREGATION'
  | 'SCHEDULED_SEARCH'
  | 'IDENTITY_PROCESSING'
  | 'TASK_RUN';

export const FORECAST_KINDS: readonly ForecastKind[] = [
  'ACCOUNT_AGGREGATION',
  'GROUP_AGGREGATION',
  'SCHEDULED_SEARCH',
  'IDENTITY_PROCESSING',
  'TASK_RUN',
];

export interface ForecastEvent {
  id: string;
  kind: ForecastKind;
  title: string;
  /** Secondary line, e.g. the cron expression or task unique name. */
  detail: string;
  at: Date;
  projected: boolean;
  /** For TASK_RUN: completionStatus (null = still running). */
  status?: string | null;
  sourceId?: string;
}

export interface SourceScheduleInput {
  sourceId: string;
  sourceName: string;
  /** ACCOUNT_AGGREGATION | GROUP_AGGREGATION */
  type: string;
  cronExpression: string;
}

export interface SearchInput {
  id: string;
  name: string;
  enabled: boolean;
  schedule: SearchScheduleLike | null | undefined;
}

export interface TaskRunInput {
  id: string;
  name: string;
  detail: string;
  /** ISO timestamp the run started (launched, else created). */
  at: string;
  status: string | null;
  sourceId?: string;
}

export interface ForecastWarning {
  key: string;
  params: Record<string, string | number>;
}

export interface BuildForecastInput {
  sourceSchedules: SourceScheduleInput[];
  searches: SearchInput[];
  taskRuns: TaskRunInput[];
  from: Date;
  to: Date;
  now: Date;
  /** Zone used for source cron schedules, searches without timeZoneId and identity processing. */
  timeZone: string;
  includeIdentityProcessing: boolean;
  /** Max projected occurrences per series in the window. */
  perSeriesLimit?: number;
}

export interface BuildForecastResult {
  events: ForecastEvent[];
  warnings: ForecastWarning[];
}

/** ISC runs scheduled identity processing daily at 08:00 and 20:00 tenant time (API spec, process-identities). */
export const IDENTITY_PROCESSING_CRON = '0 0 8,20 * * ?';

export function buildForecastEvents(input: BuildForecastInput): BuildForecastResult {
  const limit = input.perSeriesLimit ?? 1500;
  const projectFrom = new Date(Math.max(input.from.getTime(), input.now.getTime()));
  const events: ForecastEvent[] = [];
  const warnings: ForecastWarning[] = [];

  if (projectFrom < input.to) {
    for (const s of input.sourceSchedules) {
      const kind: ForecastKind = s.type === 'GROUP_AGGREGATION' ? 'GROUP_AGGREGATION' : 'ACCOUNT_AGGREGATION';
      try {
        const cron = parseQuartzCron(s.cronExpression);
        const p = projectQuartzCron(cron, projectFrom, input.to, { timeZone: input.timeZone, limit });
        if (p.truncated) warnings.push({ key: 'schedules.calendar.warnTruncated', params: { name: s.sourceName } });
        for (const at of p.occurrences) {
          events.push({
            id: `${kind}:${s.sourceId}:${at.getTime()}`,
            kind,
            title: s.sourceName,
            detail: s.cronExpression,
            at,
            projected: true,
            sourceId: s.sourceId,
          });
        }
      } catch (err) {
        if (!(err instanceof CronParseError)) throw err;
        warnings.push({
          key: 'schedules.calendar.warnUnparsable',
          params: { name: s.sourceName, expression: s.cronExpression },
        });
      }
    }

    for (const search of input.searches) {
      if (!search.enabled) continue;
      if (!isProjectableSearchSchedule(search.schedule)) {
        warnings.push({ key: 'schedules.calendar.warnSearchNotProjected', params: { name: search.name } });
        continue;
      }
      const p = projectSearchSchedule(search.schedule ?? {}, projectFrom, input.to, input.timeZone, limit);
      for (const at of p.occurrences) {
        events.push({
          id: `SCHEDULED_SEARCH:${search.id}:${at.getTime()}`,
          kind: 'SCHEDULED_SEARCH',
          title: search.name,
          detail: search.schedule?.type ?? '',
          at,
          projected: true,
        });
      }
    }

    if (input.includeIdentityProcessing) {
      const p = projectQuartzCron(parseQuartzCron(IDENTITY_PROCESSING_CRON), projectFrom, input.to, {
        timeZone: input.timeZone,
        limit,
      });
      for (const at of p.occurrences) {
        events.push({
          id: `IDENTITY_PROCESSING:${at.getTime()}`,
          kind: 'IDENTITY_PROCESSING',
          title: 'schedules.calendar.identityProcessingTitle', // i18n key; translated in the template
          detail: IDENTITY_PROCESSING_CRON,
          at,
          projected: true,
        });
      }
    }
  }

  const fromMs = input.from.getTime();
  const toMs = Math.min(input.to.getTime(), input.now.getTime() + 1);
  for (const run of input.taskRuns) {
    const t = Date.parse(run.at);
    if (!Number.isFinite(t) || t < fromMs || t >= toMs) continue;
    events.push({
      id: `TASK_RUN:${run.id}`,
      kind: 'TASK_RUN',
      title: run.name,
      detail: run.detail,
      at: new Date(t),
      projected: false,
      status: run.status,
      sourceId: run.sourceId,
    });
  }

  events.sort((a, b) => a.at.getTime() - b.at.getTime() || a.title.localeCompare(b.title));
  return { events, warnings };
}

/** Description for a source cron, or a "custom" fallback for unparsable expressions. */
export function describeCron(expression: string): CronDescription {
  try {
    return describeQuartzCron(parseQuartzCron(expression));
  } catch {
    return { key: 'schedules.cron.custom', params: { expression } };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Month grid
// ─────────────────────────────────────────────────────────────────────────────

export interface DayGroup {
  key: string;
  kind: ForecastKind;
  title: string;
  count: number;
  first: Date;
  /** Worst status among TASK_RUN events in the group. */
  status?: string | null;
}

export interface CalendarDay {
  /** Local date key YYYY-MM-DD. */
  key: string;
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  events: ForecastEvent[];
  groups: DayGroup[];
}

export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** First visible day (Sunday on/before the 1st) and the exclusive end (6 weeks later), in local time. */
export function monthGridRange(year: number, monthIndex: number): { start: Date; end: Date } {
  const first = new Date(year, monthIndex, 1);
  const start = new Date(year, monthIndex, 1 - first.getDay());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 42);
  return { start, end };
}

const STATUS_RANK: Record<string, number> = { ERROR: 4, TEMPERROR: 3, TERMINATED: 2, WARNING: 1, SUCCESS: 0 };

function worse(a: string | null | undefined, b: string | null | undefined): string | null | undefined {
  if (a === undefined) return b;
  if (a === null || b === null) return null; // running beats everything
  return (STATUS_RANK[b ?? ''] ?? 0) > (STATUS_RANK[a ?? ''] ?? 0) ? b : a;
}

/** Builds the 6x7 grid for a month in the viewer's local time zone. */
export function buildMonthGrid(year: number, monthIndex: number, events: ForecastEvent[], today: Date): CalendarDay[] {
  const { start } = monthGridRange(year, monthIndex);
  const byDay = new Map<string, ForecastEvent[]>();
  for (const e of events) {
    const k = localDayKey(e.at);
    const list = byDay.get(k);
    if (list) list.push(e);
    else byDay.set(k, [e]);
  }
  const todayKey = localDayKey(today);
  const days: CalendarDay[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = localDayKey(date);
    const dayEvents = byDay.get(key) ?? [];
    const groups = new Map<string, DayGroup>();
    for (const e of dayEvents) {
      const gk = `${e.kind}|${e.title}`;
      const g = groups.get(gk);
      if (g) {
        g.count++;
        if (e.kind === 'TASK_RUN') g.status = worse(g.status, e.status);
      } else {
        groups.set(gk, {
          key: gk,
          kind: e.kind,
          title: e.title,
          count: 1,
          first: e.at,
          status: e.kind === 'TASK_RUN' ? e.status : undefined,
        });
      }
    }
    days.push({
      key,
      date,
      inMonth: date.getMonth() === monthIndex,
      isToday: key === todayKey,
      events: dayEvents,
      groups: [...groups.values()].sort((a, b) => a.first.getTime() - b.first.getTime()),
    });
  }
  return days;
}
