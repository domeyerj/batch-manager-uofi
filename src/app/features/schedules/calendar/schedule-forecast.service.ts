import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TaskManagerService } from '@core';
import { SourcesService, type Source } from '@sailpoint/angular-sdk/sources';
import { TaskManagementService, type TaskStatus } from '@sailpoint/angular-sdk/task_management';
import { ScheduledSearchService } from '@sailpoint/angular-sdk/scheduled_search';
import { type SearchScheduleLike, isValidTimeZone } from './cron-engine';
import type { SearchInput, SourceScheduleInput, TaskRunInput } from './forecast-events';

/** Max concurrent `GET /sources/v1/{id}/schedules` calls (keeps us well under ISC rate limits). */
const SCHEDULE_CONCURRENCY = 4;
/** Task history page size (API max is 250) and hard cap on pages per load. */
const HISTORY_PAGE = 250;
const HISTORY_MAX_PAGES = 8;
/** task-status only keeps 90 days of history. */
const HISTORY_RETENTION_DAYS = 90;

export type LoadIssue = 'forbidden' | 'failed';

const TZ_STORAGE_KEY = 'batch-manager-uofi.schedules.timeZone';

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function readStoredTimeZone(): string | null {
  try {
    const v = globalThis.localStorage?.getItem(TZ_STORAGE_KEY);
    return v && isValidTimeZone(v) ? v : null;
  } catch {
    return null; // storage can be blocked in sandboxed iframes
  }
}

function httpStatus(err: unknown): number | undefined {
  return typeof err === 'object' && err !== null && 'status' in err
    ? Number((err as { status?: unknown }).status)
    : undefined;
}

/**
 * Loads everything the Schedules & Forecast calendar needs:
 * - every source's aggregation schedules (`GET /sources/v1/{sourceId}/schedules`)
 * - scheduled searches (`GET /scheduled-searches/v1`)
 * - recent task runs (`GET /task-status/v1?sorters=-created`, paged back to the visible range)
 *
 * Scopes already in sp-ui-plugin.json: idn:sources:read, sp:scheduled-search:manage,
 * idn:task-management:read.
 */
@Injectable({ providedIn: 'root' })
export class ScheduleForecastService {
  private readonly taskManager = inject(TaskManagerService);
  private readonly sourcesSvc = inject(SourcesService);
  private readonly taskSvc = inject(TaskManagementService);
  private readonly scheduledSearchSvc = inject(ScheduledSearchService);

  /**
   * Zone used to evaluate source cron expressions, scheduled searches without a
   * timeZoneId, and ISC's built-in identity processing. ISC does not return a
   * zone for source schedules, so this is a user setting (persisted per browser).
   */
  readonly timeZone = signal<string>(readStoredTimeZone() ?? browserTimeZone());

  readonly sourceSchedules = signal<SourceScheduleInput[]>([]);
  readonly searches = signal<SearchInput[]>([]);
  readonly taskRuns = signal<TaskRunInput[]>([]);

  readonly loading = signal(false);
  readonly historyLoading = signal(false);
  /** Per-area problems, e.g. { schedules: 'forbidden' }. */
  readonly issues = signal<Partial<Record<'schedules' | 'searches' | 'history', LoadIssue>>>({});
  /** Number of sources whose schedules could not be read. */
  readonly failedSources = signal(0);
  readonly loadedAt = signal<Date | null>(null);

  /** Oldest instant the loaded task history reaches back to (null = nothing loaded). */
  private historyReachedBack: Date | null = null;
  private historyExhausted = false;
  private loadPromise: Promise<void> | null = null;

  setTimeZone(timeZone: string): void {
    if (!isValidTimeZone(timeZone)) return;
    this.timeZone.set(timeZone);
    try {
      globalThis.localStorage?.setItem(TZ_STORAGE_KEY, timeZone);
    } catch {
      /* ignore: storage unavailable */
    }
  }

  /** Load schedules + searches + history back to `historySince`. Concurrent calls share one load. */
  load(historySince: Date, force = false): Promise<void> {
    if (this.loadPromise && !force) return this.loadPromise;
    this.loadPromise = this.doLoad(historySince).finally(() => {
      this.loadPromise = null;
    });
    return this.loadPromise;
  }

  private async doLoad(historySince: Date): Promise<void> {
    this.loading.set(true);
    this.issues.set({});
    this.historyReachedBack = null;
    this.historyExhausted = false;
    this.taskRuns.set([]);
    try {
      await Promise.all([this.loadSchedules(), this.loadSearches(), this.ensureHistorySince(historySince)]);
      this.loadedAt.set(new Date());
    } finally {
      this.loading.set(false);
    }
  }

  private setIssue(area: 'schedules' | 'searches' | 'history', err: unknown): void {
    const issue: LoadIssue = httpStatus(err) === 403 ? 'forbidden' : 'failed';
    this.issues.update((v) => ({ ...v, [area]: issue }));
  }

  private async loadSchedules(): Promise<void> {
    let sources: Source[] = this.taskManager.sources();
    if (!sources.length) sources = await this.taskManager.loadSources();

    const results: SourceScheduleInput[] = [];
    let failed = 0;
    let firstError: unknown = null;
    const queue = sources.filter((s): s is Source & { id: string } => !!s.id);
    const worker = async () => {
      for (let src = queue.shift(); src; src = queue.shift()) {
        try {
          const schedules = await firstValueFrom(this.sourcesSvc.getSourceSchedulesV1({ sourceId: src.id }));
          for (const s of schedules ?? []) {
            if (!s?.cronExpression) continue;
            results.push({
              sourceId: src.id,
              sourceName: src.name ?? src.id,
              type: String(s.type ?? 'ACCOUNT_AGGREGATION'),
              cronExpression: s.cronExpression,
            });
          }
        } catch (err) {
          failed++;
          firstError ??= err;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(SCHEDULE_CONCURRENCY, queue.length) }, worker));

    results.sort((a, b) => a.sourceName.localeCompare(b.sourceName) || a.type.localeCompare(b.type));
    this.sourceSchedules.set(results);
    this.failedSources.set(failed);
    if (failed && failed === sources.length) this.setIssue('schedules', firstError);
  }

  private async loadSearches(): Promise<void> {
    try {
      // Called directly (not via TaskManagerService, which swallows errors) so a
      // 403 can be reported. The result is also pushed into the shared signal so
      // the list view's scheduled-search table is populated.
      const searches = await firstValueFrom(this.scheduledSearchSvc.listScheduledSearchV1({ limit: 250 }));
      this.taskManager.scheduledSearches.set(searches);
      this.searches.set(
        searches.map((s) => ({
          id: String(s.id ?? s.name),
          name: String(s.name ?? s.id ?? ''),
          enabled: s.enabled !== false,
          schedule: s.schedule as unknown as SearchScheduleLike,
        })),
      );
    } catch (err) {
      this.setIssue('searches', err);
    }
  }

  /**
   * Page through task history (newest first) until it reaches `since`, the
   * 90-day retention limit, or the page cap.
   */
  async ensureHistorySince(since: Date): Promise<void> {
    const retention = new Date(Date.now() - HISTORY_RETENTION_DAYS * 86_400_000);
    const target = since < retention ? retention : since;
    if (this.historyExhausted || (this.historyReachedBack && this.historyReachedBack <= target)) return;

    this.historyLoading.set(true);
    try {
      let offset = this.taskRuns().length;
      for (let page = 0; page < HISTORY_MAX_PAGES; page++) {
        const tasks: TaskStatus[] = await firstValueFrom(
          this.taskSvc.getTaskStatusListV1({ sorters: '-created', limit: HISTORY_PAGE, offset }),
        );
        const runs = tasks.map(toTaskRun).filter((r): r is TaskRunInput => r !== null);
        this.taskRuns.update((v) => [...v, ...runs]);
        offset += tasks.length;
        const oldest = runs.length ? new Date(runs[runs.length - 1].at) : null;
        if (oldest) this.historyReachedBack = oldest;
        if (tasks.length < HISTORY_PAGE) {
          this.historyExhausted = true;
          break;
        }
        if (oldest && oldest <= target) break;
      }
    } catch (err) {
      this.setIssue('history', err);
    } finally {
      this.historyLoading.set(false);
    }
  }
}

function toTaskRun(t: TaskStatus): TaskRunInput | null {
  const at = t.launched ?? t.created;
  if (!t.id || !at) return null;
  const target = t.target as { id?: string | null; name?: string | null } | null | undefined;
  return {
    id: t.id,
    name: target?.name || t.description || t.uniqueName || t.id,
    detail: t.uniqueName || t.description || '',
    at: String(at),
    status: (t.completionStatus as string | null | undefined) ?? null,
    sourceId: target?.id ?? undefined,
  };
}
