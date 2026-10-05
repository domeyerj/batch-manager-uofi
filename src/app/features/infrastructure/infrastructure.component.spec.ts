import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { InfrastructureComponent } from './infrastructure.component';
import { TaskManagerService } from '@core';
import { type ManagedCluster } from '@sailpoint/angular-sdk/managed_clusters';

describe('InfrastructureComponent', () => {
  let fixture: ComponentFixture<InfrastructureComponent>;
  let component: InfrastructureComponent;

  const mockCluster: ManagedCluster = {
    id: 'cluster-101',
    name: 'Corp VA Cluster',
    pod: 'us-east-1',
    org: 'acme-corp',
    ccgVersion: '2.5.0',
    clientType: null,
    description: 'On-premises connector gateway',
  };

  let taskManagerMock: {
    clusters: ReturnType<typeof signal<ManagedCluster[]>>;
    loadClusters: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    taskManagerMock = {
      clusters: signal([mockCluster]),
      loadClusters: vi.fn().mockResolvedValue([mockCluster]),
    };

    await TestBed.configureTestingModule({
      imports: [InfrastructureComponent],
      providers: [{ provide: TaskManagerService, useValue: taskManagerMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(InfrastructureComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders cluster table row with details', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Corp VA Cluster');
    expect(compiled.textContent).toContain('2.5.0');
    expect(compiled.textContent).toContain('us-east-1');
  });

  it('refreshes clusters on demand', async () => {
    await component['refreshClusters']();
    expect(taskManagerMock.loadClusters).toHaveBeenCalled();
  });
});
