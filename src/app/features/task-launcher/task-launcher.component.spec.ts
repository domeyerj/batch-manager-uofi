import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TaskLauncherComponent } from './task-launcher.component';
import { TaskManagerService } from '@core';
import { type Source } from '@sailpoint/angular-sdk/sources';

describe('TaskLauncherComponent', () => {
  let fixture: ComponentFixture<TaskLauncherComponent>;
  let component: TaskLauncherComponent;

  const mockSource = {
    id: 'src-123',
    name: 'Active Directory Corporate',
    type: 'Active Directory - Direct',
    authoritative: false,
  } as unknown as Source;

  let taskManagerMock: {
    sources: ReturnType<typeof signal<Source[]>>;
    triggerAccountAggregation: ReturnType<typeof vi.fn>;
    triggerEntitlementAggregation: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    taskManagerMock = {
      sources: signal([mockSource]),
      triggerAccountAggregation: vi.fn().mockResolvedValue({
        success: true,
        task: { id: 'task-new-1' },
      }),
      triggerEntitlementAggregation: vi.fn().mockResolvedValue({
        id: 'task-new-2',
      }),
    };

    await TestBed.configureTestingModule({
      imports: [TaskLauncherComponent],
      providers: [
        provideRouter([]),
        { provide: TaskManagerService, useValue: taskManagerMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskLauncherComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('triggers account aggregation with disableOptimization parameter', async () => {
    component['selectedSource'].set(mockSource);
    component['disableOptimization'].set(true);

    await component['triggerAccounts']();

    expect(taskManagerMock.triggerAccountAggregation).toHaveBeenCalledWith('src-123', true);
    expect(component['launchResult']()?.severity).toBe('success');
    expect(component['launchResult']()?.taskId).toBe('task-new-1');
  });

  it('triggers entitlement aggregation for selected source', async () => {
    component['selectedSource'].set(mockSource);

    await component['triggerEntitlements']();

    expect(taskManagerMock.triggerEntitlementAggregation).toHaveBeenCalledWith('src-123');
    expect(component['launchResult']()?.severity).toBe('success');
    expect(component['launchResult']()?.taskId).toBe('task-new-2');
  });
});
