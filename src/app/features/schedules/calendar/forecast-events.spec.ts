import { buildForecastEvents, buildMonthGrid, describeCron, monthGridRange } from './forecast-events';

const base = {
  searches: [],
  taskRuns: [],
  timeZone: 'UTC',
  includeIdentityProcessing: false,
};

describe('forecast-events: buildForecastEvents', () => {
  it('projects source schedules only from "now" onwards and keeps past task runs', () => {
    const { events, warnings } = buildForecastEvents({
      ...base,
      sourceSchedules: [
        { sourceId: 's1', sourceName: 'AD Corp', type: 'ACCOUNT_AGGREGATION', cronExpression: '0 0 2 * * ?' },
        { sourceId: 's1', sourceName: 'AD Corp', type: 'GROUP_AGGREGATION', cronExpression: '0 0 3 ? * SUN' },
      ],
      taskRuns: [
        { id: 't1', name: 'AD Corp', detail: 'Cloud Account Aggregation', at: '2026-10-02T02:01:00Z', status: 'SUCCESS', sourceId: 's1' },
        { id: 't2', name: 'AD Corp', detail: 'Cloud Account Aggregation', at: '2026-10-09T02:01:00Z', status: 'ERROR', sourceId: 's1' },
      ],
      from: new Date('2026-10-01T00:00:00Z'),
      to: new Date('2026-10-08T00:00:00Z'),
      now: new Date('2026-10-05T12:00:00Z'),
    });
    expect(warnings).toEqual([]);
    const accounts = events.filter((e) => e.kind === 'ACCOUNT_AGGREGATION').map((e) => e.at.toISOString());
    expect(accounts).toEqual(['2026-10-06T02:00:00.000Z', '2026-10-07T02:00:00.000Z']);
    expect(events.filter((e) => e.kind === 'GROUP_AGGREGATION')).toHaveLength(0); // next Sunday is the 11th
    const runs = events.filter((e) => e.kind === 'TASK_RUN');
    expect(runs.map((e) => e.id)).toEqual(['TASK_RUN:t1']); // t2 is in the future → ignored
    expect(runs[0].projected).toBe(false);
  });

  it('warns about unparsable crons, disabled/CALENDAR searches and adds identity processing', () => {
    const { events, warnings } = buildForecastEvents({
      ...base,
      includeIdentityProcessing: true,
      sourceSchedules: [{ sourceId: 's2', sourceName: 'HR', type: 'ACCOUNT_AGGREGATION', cronExpression: 'nonsense' }],
      searches: [
        { id: 'q1', name: 'Weekly audit', enabled: true, schedule: { type: 'WEEKLY', days: { type: 'LIST', values: ['TUE'] }, hours: { type: 'LIST', values: ['6'] } } },
        { id: 'q2', name: 'Off', enabled: false, schedule: { type: 'DAILY', hours: { type: 'LIST', values: ['1'] } } },
        { id: 'q3', name: 'Custom', enabled: true, schedule: { type: 'CALENDAR', hours: { type: 'LIST', values: ['1'] } } },
      ],
      from: new Date('2026-10-05T00:00:00Z'),
      to: new Date('2026-10-07T00:00:00Z'),
      now: new Date('2026-10-05T00:00:00Z'),
    });
    expect(warnings.map((w) => w.key)).toEqual(['schedules.calendar.warnUnparsable', 'schedules.calendar.warnSearchNotProjected']);
    expect(events.filter((e) => e.kind === 'SCHEDULED_SEARCH').map((e) => e.at.toISOString())).toEqual(['2026-10-06T06:00:00.000Z']);
    expect(events.filter((e) => e.kind === 'IDENTITY_PROCESSING')).toHaveLength(4);
  });
});

describe('forecast-events: month grid', () => {
  it('always renders 6 weeks starting on a Sunday', () => {
    const { start, end } = monthGridRange(2026, 9); // October 2026 starts on a Thursday
    expect(start.getDay()).toBe(0);
    expect(start.getDate()).toBe(27); // Sun 27 Sep
    expect(Math.round((end.getTime() - start.getTime()) / 86_400_000)).toBe(42);
  });

  it('groups same-kind/same-title events per day and keeps the worst run status', () => {
    const at = (h: number) => new Date(2026, 9, 6, h, 0, 0);
    const days = buildMonthGrid(
      2026,
      9,
      [
        { id: 'a', kind: 'ACCOUNT_AGGREGATION', title: 'AD', detail: '', at: at(2), projected: true },
        { id: 'b', kind: 'ACCOUNT_AGGREGATION', title: 'AD', detail: '', at: at(14), projected: true },
        { id: 'c', kind: 'TASK_RUN', title: 'AD', detail: '', at: at(1), projected: false, status: 'SUCCESS' },
        { id: 'd', kind: 'TASK_RUN', title: 'AD', detail: '', at: at(3), projected: false, status: 'ERROR' },
      ],
      new Date(2026, 9, 6),
    );
    expect(days).toHaveLength(42);
    const day = days.find((d) => d.key === '2026-10-06');
    expect(day?.isToday).toBe(true);
    expect(day?.groups.map((g) => [g.kind, g.count, g.status])).toEqual([
      ['TASK_RUN', 2, 'ERROR'],
      ['ACCOUNT_AGGREGATION', 2, undefined],
    ]);
    expect(days[0].inMonth).toBe(false);
  });
});

describe('forecast-events: describeCron', () => {
  it('falls back to custom for unparsable input', () => {
    expect(describeCron('bad')).toEqual({ key: 'schedules.cron.custom', params: { expression: 'bad' } });
    expect(describeCron('0 0 2 * * ?').key).toBe('schedules.cron.daily');
  });
});
