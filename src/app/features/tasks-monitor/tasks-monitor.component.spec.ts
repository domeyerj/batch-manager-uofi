import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TasksMonitorComponent } from './tasks-monitor.component';
import { TaskManagerService } from '@core';
import {
  type TaskStatus,
  TaskStatusTypeEnum,
  TaskStatusCompletionStatusEnum,
} from '@sailpoint/angular-sdk/task_management';

describe('TasksMonitorComponent', () => {
  let fixture: ComponentFixture<TasksMonitorComponent>;
  let component: TasksMonitorComponent;

  const mockActiveTask: TaskStatus = {
    id: 'task-active-1',
    uniqueName: 'Active Aggregation',
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
    progress: 'Processing accounts...',
    percentComplete: 45,
    target: { id: 'src-1', name: 'Corporate AD', type: null },
  };

  const mockCompletedTask: TaskStatus = {
    id: 'task-done-1',
    uniqueName: 'Completed Aggregation',
    description: 'ServiceNow Aggregation',
    type: TaskStatusTypeEnum.Quartz,
    parentName: null,
    launcher: 'sp-admin',
    created: '2026-10-01T03:00:00.000Z',
    modified: null,
    launched: '2026-10-01T03:00:00.000Z',
    completed: '2026-10-01T03:05:00.000Z',
    completionStatus: TaskStatusCompletionStatusEnum.Success,
    messages: [],
    returns: [],
    attributes: { totalAccounts: 50 },
    progress: 'Complete',
    percentComplete: 100,
    target: { id: 'src-2', name: 'ServiceNow', type: null },
  };

  let taskManagerMock: {
    activeTasks: ReturnType<typeof signal<TaskStatus[]>>;
    recentTasks: ReturnType<typeof signal<TaskStatus[]>>;
    isLoading: ReturnType<typeof signal<boolean>>;
    autoRefresh: ReturnType<typeof signal<boolean>>;
    lastUpdated: ReturnType<typeof signal<Date | null>>;
    refreshTasks: ReturnType<typeof vi.fn>;
    terminateTask: ReturnType<typeof vi.fn>;
    toggleAutoRefresh: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    taskManagerMock = {
      activeTasks: signal([mockActiveTask]),
      recentTasks: signal([mockCompletedTask]),
      isLoading: signal(false),
      autoRefresh: signal(true),
      lastUpdated: signal(new Date()),
      refreshTasks: vi.fn().mockResolvedValue(undefined),
      terminateTask: vi.fn().mockResolvedValue({ ...mockActiveTask, completionStatus: 'TERMINATED' }),
      toggleAutoRefresh: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [TasksMonitorComponent],
      providers: [{ provide: TaskManagerService, useValue: taskManagerMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(TasksMonitorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders active background jobs card', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.active-card__title')?.textContent).toContain('Active Directory Aggregation');
    expect(compiled.querySelector('.progress-labels')?.textContent).toContain('45%');
  });

  it('renders recent execution history table row', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('ServiceNow Aggregation');
    expect(compiled.textContent).toContain('SUCCESS');
  });

  it('filters recent tasks by status', () => {
    component['selectedStatusFilter'].set('WARNING');
    fixture.detectChanges();
    expect(component['filteredRecentTasks']().length).toBe(0);

    component['selectedStatusFilter'].set('SUCCESS');
    fixture.detectChanges();
    expect(component['filteredRecentTasks']().length).toBe(1);
  });

  it('terminates an active task on abort action', async () => {
    await component['terminateTask'](mockActiveTask);
    expect(taskManagerMock.terminateTask).toHaveBeenCalledWith('task-active-1');
  });
});
