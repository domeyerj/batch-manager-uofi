import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SchedulesComponent } from './schedules.component';
import { SailpointPluginService, TaskManagerService } from '@core';
import { activateTranslations, provideTranslateTesting } from '../../testing/i18n.testing';
import { ScheduleForecastService } from './calendar/schedule-forecast.service';
import { type Source } from '@sailpoint/angular-sdk/sources';

describe('SchedulesComponent', () => {
  let fixture: ComponentFixture<SchedulesComponent>;
  let component: SchedulesComponent;

  const mockSource = {
    id: 'src-123',
    name: 'Active Directory Corporate',
    type: 'Active Directory - Direct',
  } as unknown as Source;

  let taskManagerMock: {
    sources: ReturnType<typeof signal<Source[]>>;
    scheduledSearches: ReturnType<typeof signal<unknown[]>>;
    loadSourceSchedules: ReturnType<typeof vi.fn>;
    loadScheduledSearches: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    taskManagerMock = {
      sources: signal([mockSource]),
      scheduledSearches: signal([]),
      loadSourceSchedules: vi.fn().mockResolvedValue([
        { type: 'ACCOUNT_AGGREGATION', cronExpression: '0 0 2 * * ?' },
      ]),
      loadScheduledSearches: vi.fn().mockResolvedValue([]),
    };
    try {
      localStorage.removeItem('batch-manager-uofi.schedules.view');
    } catch {
      /* ignore */
    }

    await TestBed.configureTestingModule({
      imports: [SchedulesComponent],
      providers: [
        provideTranslateTesting(),
        { provide: TaskManagerService, useValue: taskManagerMock },
        { provide: SailpointPluginService, useValue: { apiReady: signal(true), status: signal('ready') } },
        { provide: ScheduleForecastService, useValue: { timeZone: signal('UTC') } },
      ],
    }).compileComponents();
    activateTranslations();

    fixture = TestBed.createComponent(SchedulesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('translates Quartz cron expression to human readable format', () => {
    const daily = component['parseCronToHuman']('0 0 2 * * ?');
    expect(daily).toBe('Daily at 02:00');
  });

  it('loads and displays source schedules on source change', async () => {
    await component['onSourceChange'](mockSource);
    expect(taskManagerMock.loadSourceSchedules).toHaveBeenCalledWith('src-123');
    expect(component['sourceSchedules']().length).toBe(1);
    expect(component['sourceSchedules']()[0].humanReadable).toBe('Daily at 02:00');
    expect(component['sourceSchedules']()[0].description).toEqual({ key: 'schedules.cron.daily', params: { time: '02:00' } });
    expect(component['sourceSchedules']()[0].nextRun?.getUTCHours()).toBe(2);
  });

  it('loads scheduled searches once the handshake is ready', () => {
    expect(taskManagerMock.loadScheduledSearches).toHaveBeenCalledTimes(1);
  });

  it('defaults to the list view and remembers the chosen view', () => {
    expect(component['view']()).toBe('list');
    component['setView']('calendar');
    expect(component['view']()).toBe('calendar');
    expect(localStorage.getItem('batch-manager-uofi.schedules.view')).toBe('calendar');
  });
});
