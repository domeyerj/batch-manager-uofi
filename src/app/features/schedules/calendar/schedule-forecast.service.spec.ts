import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { TaskManagerService } from '@core';
import { SourcesService } from '@sailpoint/angular-sdk/sources';
import { TaskManagementService } from '@sailpoint/angular-sdk/task_management';
import { ScheduledSearchService } from '@sailpoint/angular-sdk/scheduled_search';
import { ScheduleForecastService } from './schedule-forecast.service';

describe('ScheduleForecastService', () => {
  let service: ScheduleForecastService;
  let taskManager: {
    sources: ReturnType<typeof signal<unknown[]>>;
    scheduledSearches: ReturnType<typeof signal<unknown[]>>;
    loadSources: ReturnType<typeof vi.fn>;
  };
  let sourcesSvc: { getSourceSchedulesV1: ReturnType<typeof vi.fn> };
  let taskSvc: { getTaskStatusListV1: ReturnType<typeof vi.fn> };
  let searchSvc: { listScheduledSearchV1: ReturnType<typeof vi.fn> };

  const task = (id: string, launched: string) => ({
    id,
    uniqueName: 'Cloud Account Aggregation',
    description: 'Account aggregation',
    launched,
    created: launched,
    completionStatus: 'SUCCESS',
    target: { id: 'src-1', name: 'Active Directory' },
  });

  beforeEach(() => {
    taskManager = {
      sources: signal<unknown[]>([
        { id: 'src-1', name: 'Active Directory' },
        { id: 'src-2', name: 'Workday' },
      ]),
      scheduledSearches: signal<unknown[]>([]),
      loadSources: vi.fn().mockResolvedValue([]),
    };
    sourcesSvc = {
      getSourceSchedulesV1: vi.fn(({ sourceId }: { sourceId: string }) =>
        sourceId === 'src-1'
          ? of([
              { type: 'ACCOUNT_AGGREGATION', cronExpression: '0 0 2 * * ?' },
              { type: 'GROUP_AGGREGATION', cronExpression: '0 0 3 ? * SUN' },
            ])
          : throwError(() => ({ status: 500 })),
      ),
    };
    taskSvc = { getTaskStatusListV1: vi.fn().mockReturnValue(of([task('t1', '2026-10-04T02:00:00Z')])) };
    searchSvc = {
      listScheduledSearchV1: vi.fn().mockReturnValue(
        of([{ id: 'q1', name: 'Weekly audit', enabled: true, schedule: { type: 'WEEKLY', hours: { type: 'LIST', values: ['6'] } } }]),
      ),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: TaskManagerService, useValue: taskManager },
        { provide: SourcesService, useValue: sourcesSvc },
        { provide: TaskManagementService, useValue: taskSvc },
        { provide: ScheduledSearchService, useValue: searchSvc },
      ],
    });
    service = TestBed.inject(ScheduleForecastService);
  });

  it('loads schedules for every source and counts per-source failures', async () => {
    await service.load(new Date('2026-10-01T00:00:00Z'));
    expect(sourcesSvc.getSourceSchedulesV1).toHaveBeenCalledTimes(2);
    expect(service.sourceSchedules().map((s) => `${s.sourceName}:${s.type}`)).toEqual([
      'Active Directory:ACCOUNT_AGGREGATION',
      'Active Directory:GROUP_AGGREGATION',
    ]);
    expect(service.failedSources()).toBe(1);
    expect(service.issues()['schedules']).toBeUndefined();
  });

  it('reports "forbidden" when every schedule call returns 403', async () => {
    sourcesSvc.getSourceSchedulesV1.mockReturnValue(throwError(() => ({ status: 403 })));
    await service.load(new Date('2026-10-01T00:00:00Z'));
    expect(service.issues()['schedules']).toBe('forbidden');
  });

  it('maps scheduled searches and shares them with the list view', async () => {
    await service.load(new Date('2026-10-01T00:00:00Z'));
    expect(service.searches()).toEqual([
      { id: 'q1', name: 'Weekly audit', enabled: true, schedule: { type: 'WEEKLY', hours: { type: 'LIST', values: ['6'] } } },
    ]);
    expect(taskManager.scheduledSearches().length).toBe(1);
  });

  it('maps task history into runs', async () => {
    await service.load(new Date('2026-10-01T00:00:00Z'));
    expect(taskSvc.getTaskStatusListV1).toHaveBeenCalledWith({ sorters: '-created', limit: 250, offset: 0 });
    expect(service.taskRuns()).toEqual([
      {
        id: 't1',
        name: 'Active Directory',
        detail: 'Cloud Account Aggregation',
        at: '2026-10-04T02:00:00Z',
        status: 'SUCCESS',
        sourceId: 'src-1',
      },
    ]);
  });

  it('ignores invalid time zones', () => {
    service.setTimeZone('America/Chicago');
    expect(service.timeZone()).toBe('America/Chicago');
    service.setTimeZone('Not/AZone');
    expect(service.timeZone()).toBe('America/Chicago');
  });
});
