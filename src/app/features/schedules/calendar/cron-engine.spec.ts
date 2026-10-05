import {
  CronParseError,
  describeQuartzCron,
  nextQuartzRun,
  parseQuartzCron,
  projectQuartzCron,
  projectSearchSchedule,
  wallClockToInstant,
  zoneOffsetMs,
} from './cron-engine';

const iso = (d: Date) => d.toISOString();
const range = (from: string, to: string) => [new Date(from), new Date(to)] as const;

describe('cron-engine: time zones', () => {
  it('computes Chicago offsets across DST', () => {
    expect(zoneOffsetMs(Date.parse('2026-07-01T12:00:00Z'), 'America/Chicago')).toBe(-5 * 3600_000);
    expect(zoneOffsetMs(Date.parse('2026-12-01T12:00:00Z'), 'America/Chicago')).toBe(-6 * 3600_000);
  });

  it('converts wall-clock to instants, shifting through the spring-forward gap', () => {
    const t = wallClockToInstant({ year: 2026, month: 10, day: 5, hour: 2, minute: 0, second: 0 }, 'America/Chicago');
    expect(new Date(t).toISOString()).toBe('2026-10-05T07:00:00.000Z');
    // 2026-03-08 02:30 does not exist in Chicago; it resolves to 03:30 CDT.
    const gap = wallClockToInstant({ year: 2026, month: 3, day: 8, hour: 2, minute: 30, second: 0 }, 'America/Chicago');
    expect(new Date(gap).toISOString()).toBe('2026-03-08T08:30:00.000Z');
  });
});

describe('cron-engine: Quartz parsing', () => {
  it('rejects malformed expressions', () => {
    expect(() => parseQuartzCron('0 0 2 * *')).toThrow(CronParseError);
    expect(() => parseQuartzCron('0 0 25 * * ?')).toThrow(CronParseError);
    expect(() => parseQuartzCron('0 0 2 * * FOO')).toThrow(CronParseError);
  });

  it('parses names, ranges, steps and wrap-around ranges', () => {
    const c = parseQuartzCron('0 0/15 9-17 ? JAN-MAR MON-FRI');
    expect(c.minutes).toEqual([0, 15, 30, 45]);
    expect(c.hours).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
    expect([...c.months].sort((a, b) => a - b)).toEqual([1, 2, 3]);
    const wrap = parseQuartzCron('0 0 22-2 * * ?');
    expect(wrap.hours).toEqual([0, 1, 2, 22, 23]);
  });
});

describe('cron-engine: projection', () => {
  it('projects a daily 02:00 schedule in UTC', () => {
    const [from, to] = range('2026-10-01T00:00:00Z', '2026-10-04T00:00:00Z');
    const p = projectQuartzCron(parseQuartzCron('0 0 2 * * ?'), from, to, { timeZone: 'UTC' });
    expect(p.occurrences.map(iso)).toEqual([
      '2026-10-01T02:00:00.000Z',
      '2026-10-02T02:00:00.000Z',
      '2026-10-03T02:00:00.000Z',
    ]);
    expect(p.truncated).toBe(false);
  });

  it('evaluates wall-clock time in the given zone', () => {
    const [from, to] = range('2026-10-05T00:00:00Z', '2026-10-06T00:00:00Z');
    const p = projectQuartzCron(parseQuartzCron('0 30 6 * * ?'), from, to, { timeZone: 'America/Chicago' });
    expect(p.occurrences.map(iso)).toEqual(['2026-10-05T11:30:00.000Z']);
  });

  it('supports every-N-hours, weekdays, L, LW, nW, nL and n#k', () => {
    const [from, to] = range('2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z');
    const count = (e: string) => projectQuartzCron(parseQuartzCron(e), from, to, { timeZone: 'UTC' }).occurrences;
    expect(count('0 0 0/6 * * ?')).toHaveLength(31 * 4);
    expect(count('0 0 8 ? * MON-FRI')).toHaveLength(22); // Oct 2026 has 22 weekdays
    expect(count('0 0 1 L * ?').map(iso)).toEqual(['2026-10-31T01:00:00.000Z']);
    expect(count('0 0 1 LW * ?').map(iso)).toEqual(['2026-10-30T01:00:00.000Z']); // 31st is a Saturday
    expect(count('0 0 1 3W * ?').map(iso)).toEqual(['2026-10-02T01:00:00.000Z']); // 3rd is a Saturday
    expect(count('0 0 1 ? * 6L').map(iso)).toEqual(['2026-10-30T01:00:00.000Z']); // last Friday
    expect(count('0 0 1 ? * 2#1').map(iso)).toEqual(['2026-10-05T01:00:00.000Z']); // first Monday
  });

  it('honours the limit and reports truncation', () => {
    const [from, to] = range('2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z');
    const p = projectQuartzCron(parseQuartzCron('0 * * * * ?'), from, to, { timeZone: 'UTC', limit: 100 });
    expect(p.occurrences).toHaveLength(100);
    expect(p.truncated).toBe(true);
  });

  it('finds the next run', () => {
    const next = nextQuartzRun(parseQuartzCron('0 0 2 1 * ?'), new Date('2026-10-05T00:00:00Z'), 'UTC');
    expect(next && iso(next)).toBe('2026-11-01T02:00:00.000Z');
  });
});

describe('cron-engine: descriptions', () => {
  const d = (e: string) => describeQuartzCron(parseQuartzCron(e));
  it('describes common shapes', () => {
    expect(d('0 0 2 * * ?')).toEqual({ key: 'schedules.cron.daily', params: { time: '02:00' } });
    expect(d('0 15 0/4 * * ?')).toEqual({ key: 'schedules.cron.everyNHours', params: { n: 4, minute: '15' } });
    expect(d('0 0 6,18 * * ?')).toEqual({ key: 'schedules.cron.dailyAtTimes', params: { times: '06:00, 18:00' } });
    expect(d('0 30 7 ? * MON,WED')).toEqual({ key: 'schedules.cron.weekly', params: { days: 'Mon, Wed', time: '07:30' } });
    expect(d('0 0 3 1,15 * ?')).toEqual({ key: 'schedules.cron.monthly', params: { days: '1, 15', time: '03:00' } });
    expect(d('0 0 3 L * ?')).toEqual({ key: 'schedules.cron.monthlyLastDay', params: { time: '03:00' } });
    expect(d('0 0 3 ? JAN 2#1').key).toBe('schedules.cron.custom');
  });
});

describe('cron-engine: scheduled-search schedules', () => {
  const [from, to] = range('2026-10-01T00:00:00Z', '2026-10-15T00:00:00Z');

  it('projects WEEKLY schedules in their own zone', () => {
    const p = projectSearchSchedule(
      { type: 'WEEKLY', days: { type: 'LIST', values: ['MON'] }, hours: { type: 'LIST', values: ['9'] }, timeZoneId: 'America/Chicago' },
      from, to, 'UTC',
    );
    expect(p.occurrences.map(iso)).toEqual(['2026-10-05T14:00:00.000Z', '2026-10-12T14:00:00.000Z']);
  });

  it('projects RANGE hour selectors and falls back to the default zone', () => {
    const p = projectSearchSchedule(
      { type: 'DAILY', hours: { type: 'RANGE', values: ['9', '18'], interval: 3 } },
      new Date('2026-10-01T00:00:00Z'), new Date('2026-10-02T00:00:00Z'), 'UTC',
    );
    expect(p.occurrences.map((x) => x.getUTCHours())).toEqual([9, 12, 15, 18]);
  });

  it('handles MONTHLY last day and expiration; skips CALENDAR', () => {
    const monthly = projectSearchSchedule(
      { type: 'MONTHLY', days: { type: 'LIST', values: ['L'] }, hours: { type: 'LIST', values: ['0'] } },
      new Date('2026-10-01T00:00:00Z'), new Date('2026-12-31T00:00:00Z'), 'UTC',
    );
    expect(monthly.occurrences.map(iso)).toEqual(['2026-10-31T00:00:00.000Z', '2026-11-30T00:00:00.000Z']);
    const expired = projectSearchSchedule(
      { type: 'DAILY', hours: { type: 'LIST', values: ['0'] }, expiration: '2026-10-03T00:00:00Z' },
      from, to, 'UTC',
    );
    expect(expired.occurrences).toHaveLength(2);
    expect(projectSearchSchedule({ type: 'CALENDAR', hours: { type: 'LIST', values: ['0'] } }, from, to, 'UTC').occurrences).toHaveLength(0);
  });
});
