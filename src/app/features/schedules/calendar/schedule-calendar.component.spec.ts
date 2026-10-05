import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SailpointPluginService } from '@core';
import { activateTranslations, provideTranslateTesting } from '../../../testing/i18n.testing';
import { ScheduleCalendarComponent } from './schedule-calendar.component';
import { ScheduleForecastService } from './schedule-forecast.service';
import type { SearchInput, SourceScheduleInput, TaskRunInput } from './forecast-events';

describe('ScheduleCalendarComponent', () => {
  let fixture: ComponentFixture<ScheduleCalendarComponent>;
  let component: ScheduleCalendarComponent;
  let forecast: {
    timeZone: ReturnType<typeof signal<string>>;
    sourceSchedules: ReturnType<typeof signal<SourceScheduleInput[]>>;
    searches: ReturnType<typeof signal<SearchInput[]>>;
    taskRuns: ReturnType<typeof signal<TaskRunInput[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    historyLoading: ReturnType<typeof signal<boolean>>;
    issues: ReturnType<typeof signal<Record<string, string>>>;
    failedSources: ReturnType<typeof signal<number>>;
    load: ReturnType<typeof vi.fn>;
    ensureHistorySince: ReturnType<typeof vi.fn>;
    setTimeZone: ReturnType<typeof vi.fn>;
  };

  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    forecast = {
      timeZone: signal('UTC'),
      sourceSchedules: signal<SourceScheduleInput[]>([
        { sourceId: 'src-1', sourceName: 'Active Directory', type: 'ACCOUNT_AGGREGATION', cronExpression: '0 0 12 * * ?' },
      ]),
      searches: signal<SearchInput[]>([]),
      taskRuns: signal<TaskRunInput[]>([
        { id: 't1', name: 'Active Directory', detail: 'Cloud Account Aggregation', at: '2026-10-02T12:00:00Z', status: 'ERROR', sourceId: 'src-1' },
      ]),
      loading: signal(false),
      historyLoading: signal(false),
      issues: signal<Record<string, string>>({}),
      failedSources: signal(0),
      load: vi.fn().mockResolvedValue(undefined),
      ensureHistorySince: vi.fn().mockResolvedValue(undefined),
      setTimeZone: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ScheduleCalendarComponent],
      providers: [
        provideTranslateTesting(),
        { provide: ScheduleForecastService, useValue: forecast },
        { provide: SailpointPluginService, useValue: { apiReady: signal(true), status: signal('ready') } },
      ],
    }).compileComponents();
    activateTranslations();

    fixture = TestBed.createComponent(ScheduleCalendarComponent);
    component = fixture.componentInstance;
    component.now.set(new Date(2026, 9, 5, 9, 0, 0)); // Mon 5 Oct 2026, 09:00 local
    component.goTo(2026, 9);
    fixture.detectChanges();
  });

  it('loads forecast data once the handshake is ready', () => {
    expect(forecast.load).toHaveBeenCalledTimes(1);
  });

  it('renders a 6-week grid with forecast chips and past task runs', () => {
    expect(el().querySelectorAll('.cal__day').length).toBe(42);
    expect(el().querySelectorAll('.chip.k-ACCOUNT_AGGREGATION').length).toBeGreaterThan(20);
    expect(el().querySelectorAll('.chip.k-TASK_RUN.s-error').length).toBe(1);
    expect(el().textContent).toContain('Account aggregation');
  });

  it('hides a layer when its checkbox is unticked', () => {
    const boxes = el().querySelectorAll<HTMLInputElement>('.cal__legend input[type=checkbox]');
    boxes[0].checked = false;
    boxes[0].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(el().querySelectorAll('.chip.k-ACCOUNT_AGGREGATION').length).toBe(0);
  });

  it('shows the selected day in the detail panel', () => {
    const day = Array.from(el().querySelectorAll<HTMLButtonElement>('.cal__day')).find(
      (b) => b.querySelector('.cal__date')?.textContent?.trim() === '2' && !b.classList.contains('cal__day--out'),
    );
    day?.click();
    fixture.detectChanges();
    const detail = el().querySelector('.cal__detail');
    expect(detail?.textContent).toContain('Cloud Account Aggregation');
    expect(detail?.textContent).toContain('ERROR');
  });

  it('loads older history when navigating back', () => {
    forecast.ensureHistorySince.mockClear();
    (el().querySelector('.cal__nav .cal-btn') as HTMLButtonElement).click();
    expect(forecast.ensureHistorySince).toHaveBeenCalledTimes(1);
  });
});
