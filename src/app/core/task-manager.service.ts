import { Injectable, inject, signal, effect, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, timer, catchError, of, switchMap } from 'rxjs';
import { SailpointPluginService } from './sailpoint-plugin.service';
import {
  TaskManagementService,
  type TaskStatus,
  JsonPatchOperationOpEnum,
} from '@sailpoint/angular-sdk/task_management';
import { SourcesService, type Source, type Schedule3, type LoadAccountsTask, type LoadEntitlementTask } from '@sailpoint/angular-sdk/sources';
import { ManagedClustersService, type ManagedCluster } from '@sailpoint/angular-sdk/managed_clusters';
import { ScheduledSearchService, type ScheduledSearch } from '@sailpoint/angular-sdk/scheduled_search';

export interface TaskFilterOptions {
  status?: string;
  sourceId?: string;
  type?: string;
}

@Injectable({ providedIn: 'root' })
export class TaskManagerService {
  private readonly plugin = inject(SailpointPluginService);
  private readonly taskSvc = inject(TaskManagementService);
  private readonly sourcesSvc = inject(SourcesService);
  private readonly clustersSvc = inject(ManagedClustersService);
  private readonly scheduledSearchSvc = inject(ScheduledSearchService);
  private readonly destroyRef = inject(DestroyRef);

  /** Active executing tasks (where completionStatus is null) */
  readonly activeTasks = signal<TaskStatus[]>([]);

  /** Recent finished/historical tasks */
  readonly recentTasks = signal<TaskStatus[]>([]);

  /** Available sources for triggering aggregations */
  readonly sources = signal<Source[]>([]);

  /** Managed Virtual Appliance clusters */
  readonly clusters = signal<ManagedCluster[]>([]);

  /** Tenant scheduled searches */
  readonly scheduledSearches = signal<ScheduledSearch[]>([]);

  /** Loading & error states */
  readonly isLoading = signal(false);
  readonly error = signal('');
  readonly lastUpdated = signal<Date | null>(null);

  /** Polling toggle */
  readonly autoRefresh = signal(true);

  private initialized = false;

  constructor() {
    // Automatically trigger initial load and start background refresh once App Shell COIP handshake completes
    effect(() => {
      if (this.plugin.apiReady() && !this.initialized) {
        this.initialized = true;
        void this.initialLoad();
        this.startPollingLoop();
      }
    });
  }

  private async initialLoad(): Promise<void> {
    this.isLoading.set(true);
    try {
      await Promise.all([
        this.refreshTasks(),
        this.loadSources(),
        this.loadClusters(),
      ]);
    } catch (err) {
      this.error.set(this.formatError(err));
    } finally {
      this.isLoading.set(false);
    }
  }

  private startPollingLoop(): void {
    // Poll every 3 seconds for active running tasks
    timer(3000, 3000)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(() => {
          if (!this.autoRefresh() || !this.plugin.apiReady()) {
            return of(null);
          }
          return this.taskSvc.getTaskStatusListV1({ filters: 'completionStatus isnull' }).pipe(
            catchError(() => of(null))
          );
        })
      )
      .subscribe((tasks) => {
        if (tasks !== null) {
          const prevCount = this.activeTasks().length;
          this.activeTasks.set(tasks);
          this.lastUpdated.set(new Date());

          // If a task finished while polling, also refresh recent tasks
          if (prevCount > 0 && tasks.length < prevCount) {
            void this.loadRecentTasks();
          }
        }
      });
  }

  /** Refresh both active and recent tasks */
  async refreshTasks(): Promise<void> {
    await Promise.all([this.loadActiveTasks(), this.loadRecentTasks()]);
    this.lastUpdated.set(new Date());
  }

  /** Query currently running tasks (completionStatus isnull) */
  async loadActiveTasks(): Promise<TaskStatus[]> {
    try {
      const tasks = await firstValueFrom(
        this.taskSvc.getTaskStatusListV1({ filters: 'completionStatus isnull' })
      );
      this.activeTasks.set(tasks);
      return tasks;
    } catch (err) {
      this.error.set(this.formatError(err));
      return [];
    }
  }

  /** Query recently completed tasks */
  async loadRecentTasks(limit = 50, filters?: string): Promise<TaskStatus[]> {
    try {
      const params: { sorters: string; limit: number; filters?: string } = {
        sorters: '-created',
        limit,
      };
      if (filters) {
        params.filters = filters;
      }
      const tasks = await firstValueFrom(this.taskSvc.getTaskStatusListV1(params));
      this.recentTasks.set(tasks);
      return tasks;
    } catch (err) {
      this.error.set(this.formatError(err));
      return [];
    }
  }

  /** Get specific task details */
  async getTaskDetails(id: string): Promise<TaskStatus> {
    return firstValueFrom(this.taskSvc.getTaskStatusV1({ id }));
  }

  /**
   * Abort / clear a hung task using RFC 6902 JSONPatch on /task-status/v1/{id}.
   * Official IDN mechanism to resolve stuck tasks by setting completionStatus to TERMINATED.
   */
  async terminateTask(id: string): Promise<TaskStatus> {
    const timestamp = new Date().toISOString();
    const updated = await firstValueFrom(
      this.taskSvc.updateTaskStatusV1({
        id,
        jsonPatchOperation: [
          {
            op: JsonPatchOperationOpEnum.Replace,
            path: '/completionStatus',
            value: 'TERMINATED',
          },
          {
            op: JsonPatchOperationOpEnum.Replace,
            path: '/completed',
            value: timestamp,
          },
        ],
      })
    );

    // Refresh active and recent lists
    await this.refreshTasks();
    return updated;
  }

  /** Load sources list for on-demand task launching */
  async loadSources(): Promise<Source[]> {
    try {
      const sources = await firstValueFrom(this.sourcesSvc.listSourcesV1({ limit: 100 }));
      this.sources.set(sources);
      return sources;
    } catch (err) {
      this.error.set(this.formatError(err));
      return [];
    }
  }

  /** Trigger Account Aggregation on a source (with disableOptimization option) */
  async triggerAccountAggregation(
    sourceId: string,
    disableOptimization = false
  ): Promise<LoadAccountsTask> {
    const res = await firstValueFrom(
      this.sourcesSvc.importAccountsV1({
        id: sourceId,
        disableOptimization: disableOptimization ? 'true' : 'false',
      })
    );
    // Refresh tasks after launching
    await this.loadActiveTasks();
    return res;
  }

  /** Trigger Entitlement Aggregation on a source */
  async triggerEntitlementAggregation(sourceId: string): Promise<LoadEntitlementTask> {
    const res = await firstValueFrom(
      this.sourcesSvc.importEntitlementsV1({
        sourceId,
      })
    );
    // Refresh tasks after launching
    await this.loadActiveTasks();
    return res;
  }

  /** Load schedules for a specific source */
  async loadSourceSchedules(sourceId: string): Promise<Schedule3[]> {
    try {
      return await firstValueFrom(this.sourcesSvc.getSourceSchedulesV1({ sourceId }));
    } catch {
      return [];
    }
  }

  /** Load Virtual Appliance Managed Clusters */
  async loadClusters(): Promise<ManagedCluster[]> {
    try {
      const clusters = await firstValueFrom(this.clustersSvc.getManagedClustersV1());
      this.clusters.set(clusters);
      return clusters;
    } catch (err) {
      this.error.set(this.formatError(err));
      return [];
    }
  }

  /** Load tenant scheduled searches */
  async loadScheduledSearches(): Promise<ScheduledSearch[]> {
    try {
      const searches = await firstValueFrom(this.scheduledSearchSvc.listScheduledSearchV1());
      this.scheduledSearches.set(searches);
      return searches;
    } catch {
      return [];
    }
  }

  toggleAutoRefresh(): void {
    this.autoRefresh.update((v) => !v);
  }

  private formatError(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }
    return typeof err === 'string' ? err : JSON.stringify(err);
  }
}
