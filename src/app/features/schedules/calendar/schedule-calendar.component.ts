import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { SailpointPluginService } from '@core';
import {
  type CalendarDay,
  type DayGroup,
  type ForecastEvent,
  type ForecastKind,
  FORECAST_KINDS,
  buildForecastEvents,
  buildMonthGrid,
  localDayKey,
  monthGridRange,
} from './forecast-events';
import { ScheduleForecastService } from './schedule-forecast.service';

/** Max chips rendered in a day cell before "+N more". */
const MAX_CHIPS = 3;

const FALLBACK_ZONES = [
  'UTC',
  'America/Chicago',
  'America/New_York',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
];

interface Option<T> {
  label: string;
  value: T;
}

/**
 * Month calendar for Schedules & Forecast.
 * Future days: projected runs (source aggregation crons, scheduled searches,
 * ISC identity processing). Past days: actual task runs from task-status.
 */
@Component({
  selector: 'app-schedule-calendar',
  standalone: true,
  imports: [DatePipe, FormsModule, TranslatePipe, MessageModule, SelectModule, TagModule],
  templateUrl: './schedule-calendar.component.html',
  styleUrl: './schedule-calendar.component.scss',
})
export class ScheduleCalendarComponent {
  protected readonly plugin = inject(SailpointPluginService);
  protected readonly forecast = inject(ScheduleForecastService);
  private readonly translate = inject(TranslateService);

  protected readonly kinds = FORECAST_KINDS;
  protected readonly maxChips = MAX_CHIPS;

  /** Injectable clock so tests can pin "now". */
  readonly now = signal(new Date());

  protected readonly viewYear = signal(this.now().getFullYear());
  protected readonly viewMonth = signal(this.now().getMonth());
  protected readonly selectedDayKey = signal<string>(localDayKey(this.now()));
  protected readonly sourceFilter = signal<string | null>(null);
  protected readonly layers = signal<Record<ForecastKind, boolean>>({
    ACCOUNT_AGGREGATION: true,
    GROUP_AGGREGATION: true,
    SCHEDULED_SEARCH: true,
    IDENTITY_PROCESSING: false,
    TASK_RUN: true,
  });

  protected readonly range = computed(() => monthGridRange(this.viewYear(), this.viewMonth()));
  protected readonly monthDate = computed(() => new Date(this.viewYear(), this.viewMonth(), 1));

  protected readonly forecastResult = computed(() => {
    const { start, end } = this.range();
    return buildForecastEvents({
      sourceSchedules: this.forecast.sourceSchedules(),
      searches: this.forecast.searches(),
      taskRuns: this.forecast.taskRuns(),
      from: start,
      to: end,
      now: this.now(),
      timeZone: this.forecast.timeZone(),
      includeIdentityProcessing: this.layers().IDENTITY_PROCESSING,
    });
  });

  protected readonly visibleEvents = computed<ForecastEvent[]>(() => {
    const layers = this.layers();
    const source = this.sourceFilter();
    // A source filter narrows to that source's aggregations and runs; searches and
    // identity processing have no source, so they are hidden while it is active.
    return this.forecastResult().events.filter((e) => layers[e.kind] && (!source || e.sourceId === source));
  });

  protected readonly days = computed<CalendarDay[]>(() =>
    buildMonthGrid(this.viewYear(), this.viewMonth(), this.visibleEvents(), this.now()),
  );

  protected readonly weeks = computed<CalendarDay[][]>(() => {
    const d = this.days();
    return Array.from({ length: 6 }, (_, i) => d.slice(i * 7, i * 7 + 7));
  });

  protected readonly selectedDay = computed(() => this.days().find((d) => d.key === this.selectedDayKey()) ?? null);

  /** Event counts per kind inside the visible month (for the legend). */
  protected readonly kindCounts = computed<Record<ForecastKind, number>>(() => {
    const counts = { ACCOUNT_AGGREGATION: 0, GROUP_AGGREGATION: 0, SCHEDULED_SEARCH: 0, IDENTITY_PROCESSING: 0, TASK_RUN: 0 };
    const month = this.viewMonth();
    for (const e of this.forecastResult().events) if (e.at.getMonth() === month) counts[e.kind]++;
    return counts;
  });

  protected readonly sourceOptions = computed<Option<string | null>[]>(() => {
    const seen = new Map<string, string>();
    for (const s of this.forecast.sourceSchedules()) seen.set(s.sourceId, s.sourceName);
    for (const r of this.forecast.taskRuns()) if (r.sourceId && !seen.has(r.sourceId)) seen.set(r.sourceId, r.name);
    return [
      { label: this.translate.instant('schedules.calendar.allSources'), value: null },
      ...[...seen.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ label, value })),
    ];
  });

  protected readonly timeZoneOptions: Option<string>[] = (() => {
    let zones: string[] = [];
    try {
      zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
    } catch {
      zones = [];
    }
    const all = new Set([...FALLBACK_ZONES, ...zones, this.forecast.timeZone()]);
    return [...all].sort().map((z) => ({ label: z, value: z }));
  })();

  protected readonly weekdayHeaders = computed(() => this.days().slice(0, 7).map((d) => d.date));

  private requested = false;

  constructor() {
    effect(() => {
      if (this.plugin.apiReady() && !this.requested) {
        this.requested = true;
        void this.forecast.load(this.range().start);
      }
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  protected shiftMonth(delta: number): void {
    const d = new Date(this.viewYear(), this.viewMonth() + delta, 1);
    this.goTo(d.getFullYear(), d.getMonth());
  }

  protected goToday(): void {
    const now = new Date();
    this.now.set(now);
    this.goTo(now.getFullYear(), now.getMonth());
    this.selectedDayKey.set(localDayKey(now));
  }

  goTo(year: number, monthIndex: number): void {
    this.viewYear.set(year);
    this.viewMonth.set(monthIndex);
    if (this.plugin.apiReady()) void this.forecast.ensureHistorySince(this.range().start);
  }

  protected refresh(): void {
    this.now.set(new Date());
    void this.forecast.load(this.range().start, true);
  }

  // ── Filters ───────────────────────────────────────────────────────────────

  protected toggleLayer(kind: ForecastKind, on: boolean): void {
    this.layers.update((l) => ({ ...l, [kind]: on }));
  }

  protected setTimeZone(tz: string): void {
    this.forecast.setTimeZone(tz);
  }

  protected selectDay(day: CalendarDay): void {
    this.selectedDayKey.set(day.key);
  }

  // ── View helpers ──────────────────────────────────────────────────────────

  protected chipsFor(day: CalendarDay): DayGroup[] {
    return day.groups.slice(0, MAX_CHIPS);
  }

  protected statusSeverity(status: string | null | undefined): 'success' | 'warn' | 'danger' | 'info' | 'secondary' {
    switch (status) {
      case 'SUCCESS':
        return 'success';
      case 'WARNING':
        return 'warn';
      case 'ERROR':
      case 'TEMPERROR':
        return 'danger';
      case 'TERMINATED':
        return 'secondary';
      default:
        return 'info';
    }
  }

  protected dayLabel(day: CalendarDay): string {
    const date = day.date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return `${date}, ${this.translate.instant('schedules.calendar.eventCount', { count: day.events.length })}`;
  }

  protected isPast(day: CalendarDay): boolean {
    return !day.isToday && day.date.getTime() < this.now().getTime();
  }

  /** Tooltip naming the type, so kinds are not distinguished by colour alone. */
  protected chipTitle(g: DayGroup): string {
    const kind = this.translate.instant(`schedules.calendar.kinds.${g.kind}`);
    const title = g.kind === 'IDENTITY_PROCESSING' ? this.translate.instant(g.title) : g.title;
    const status = g.kind === 'TASK_RUN' ? ` (${g.status ?? this.translate.instant('schedules.calendar.running')})` : '';
    return `${kind}: ${title}${g.count > 1 ? ` ×${g.count}` : ''}${status}`;
  }

  protected chipClass(g: DayGroup): string {
    return g.kind === 'TASK_RUN' ? `chip k-TASK_RUN s-${this.statusClass(g.status)}` : `chip k-${g.kind}`;
  }

  protected statusClass(status: string | null | undefined): string {
    return status === null || status === undefined ? 'running' : status.toLowerCase();
  }
}
