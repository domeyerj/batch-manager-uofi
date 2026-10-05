import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TaskManagerService } from './task-manager.service';
import { SailpointPluginService } from './sailpoint-plugin.service';
import {
  TaskManagementService,
  type TaskStatus,
  TaskStatusTypeEnum,
} from '@sailpoint/angular-sdk/task_management';
import { SourcesService } from '@sailpoint/angular-sdk/sources';
import { ManagedClustersService } from '@sailpoint/angular-sdk/managed_clusters';
import { ScheduledSearchService } from '@sailpoint/angular-sdk/scheduled_search';

describe('TaskManagerService', () => {
  let service: TaskManagerService;
  let taskSvcMock: {
    getTaskStatusListV1: ReturnType<typeof vi.fn>;
    getTaskStatusV1: ReturnType<typeof vi.fn>;
    updateTaskStatusV1: ReturnType<typeof vi.fn>;
  };
  let sourcesSvcMock: {
    listSourcesV1: ReturnType<typeof vi.fn>;
    importAccountsV1: ReturnType<typeof vi.fn>;
    importEntitlementsV1: ReturnType<typeof vi.fn>;
    getSourceSchedulesV1: ReturnType<typeof vi.fn>;
  };
  let clustersSvcMock: {
    getManagedClustersV1: ReturnType<typeof vi.fn>;
  };
  let scheduledSearchSvcMock: {
    listScheduledSearchV1: ReturnType<typeof vi.fn>;
  };

  const mockTask: TaskStatus = {
    id: 'task-123',
    uniqueName: 'Cloud Account Aggregation',
    description: 'Active Directory Aggregation',
    type: TaskStatusTypeEnum.Quartz,
    parentName: null,
    launcher: 'sp-admin',
    created: '2026-10-01T04:00:00.000Z',
    modified: null,
    launched: '2026-10-01T04:00:00.000Z',
    completed: null,
    completionStatus: null,
    messages: [],
    returns: [],
    attributes: { totalAccounts: 100 },
    progress: 'Processing',
    percentComplete: 50,
  };

  beforeEach(() => {
    taskSvcMock = {
      getTaskStatusListV1: vi.fn().mockReturnValue(of([mockTask])),
      getTaskStatusV1: vi.fn().mockReturnValue(of(mockTask)),
      updateTaskStatusV1: vi.fn().mockReturnValue(of({ ...mockTask, completionStatus: 'TERMINATED' })),
    };

    sourcesSvcMock = {
      listSourcesV1: vi.fn().mockReturnValue(of([{ id: 'src-1', name: 'Active Directory', type: 'Active Directory - Direct' }])),
      importAccountsV1: vi.fn().mockReturnValue(of({ success: true, task: { id: 'task-456' } })),
      importEntitlementsV1: vi.fn().mockReturnValue(of({ success: true, task: { id: 'task-789' } })),
      getSourceSchedulesV1: vi.fn().mockReturnValue(of([{ type: 'ACCOUNT_AGGREGATION', cronExpression: '0 0 2 * * ?' }])),
    };

    clustersSvcMock = {
      getManagedClustersV1: vi.fn().mockReturnValue(of([{ id: 'cluster-1', name: 'Primary VA Cluster' }])),
    };

    scheduledSearchSvcMock = {
      listScheduledSearchV1: vi.fn().mockReturnValue(of([])),
    };

    TestBed.configureTestingModule({
      providers: [
        TaskManagerService,
        {
          provide: SailpointPluginService,
          useValue: {
            apiReady: () => false,
            context: () => null,
          },
        },
        { provide: TaskManagementService, useValue: taskSvcMock },
        { provide: SourcesService, useValue: sourcesSvcMock },
        { provide: ManagedClustersService, useValue: clustersSvcMock },
        { provide: ScheduledSearchService, useValue: scheduledSearchSvcMock },
      ],
    });

    service = TestBed.inject(TaskManagerService);
  });

  it('creates the service', () => {
    expect(service).toBeTruthy();
    expect(service.activeTasks()).toEqual([]);
  });

  it('loads active tasks with completionStatus isnull filter', async () => {
    const tasks = await service.loadActiveTasks();
    expect(taskSvcMock.getTaskStatusListV1).toHaveBeenCalledWith({ filters: 'completionStatus isnull' });
    expect(tasks.length).toBe(1);
    expect(service.activeTasks()).toEqual([mockTask]);
  });

  it('terminates a task using JSONPatch update', async () => {
    const updated = await service.terminateTask('task-123');
    expect(taskSvcMock.updateTaskStatusV1).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-123',
        jsonPatchOperation: expect.arrayContaining([
          expect.objectContaining({ op: 'replace', path: '/completionStatus', value: 'TERMINATED' }),
        ]),
      })
    );
    expect(updated.completionStatus).toBe('TERMINATED');
  });

  it('triggers account aggregation with disableOptimization flag', async () => {
    await service.triggerAccountAggregation('src-1', true);
    expect(sourcesSvcMock.importAccountsV1).toHaveBeenCalledWith({
      id: 'src-1',
      disableOptimization: 'true',
    });
  });

  it('loads sources correctly', async () => {
    const sources = await service.loadSources();
    expect(sourcesSvcMock.listSourcesV1).toHaveBeenCalledWith({ limit: 100 });
    expect(sources.length).toBe(1);
    expect(service.sources()).toEqual(sources);
  });

  it('toggles autoRefresh signal', () => {
    expect(service.autoRefresh()).toBe(true);
    service.toggleAutoRefresh();
    expect(service.autoRefresh()).toBe(false);
  });
});
