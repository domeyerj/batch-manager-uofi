---
id: 20261005T185929Z_claude_schedules-calendar-view
timestamp: 2026-10-05T18:59:29Z
updated: 2026-10-05T19:40:00Z
agent: claude
status: done
title: "Calendar view for Schedules & Forecast"
scope: "src/app/features/schedules/**, public/i18n/en.json (schedules.* keys only)"
related: "20261005T183756Z_gemini_batch-manager-features"
---

# Calendar view for Schedules & Forecast

## Goal
Jeff asked for a calendar view on the Schedules & Forecast page, so operators can see when aggregations and other scheduled jobs will run (forecast) next to what actually ran (history).

## Plan
1. Write a pure Quartz-cron engine (parse, describe, project occurrences in a time zone) with unit tests.
2. Write a forecast service that loads every source's schedules (throttled), the scheduled searches, and the recent task history.
3. Build a month-calendar component with layer filters, a source filter, a time-zone selector and a day-detail panel.
4. Add a List | Calendar toggle and a "Next run" column to the existing Schedules page.

## Summary
Added a **Calendar** view to *Schedules & Forecast* (a List | Calendar toggle whose choice is remembered per browser).

- **Month grid.** Future days show *projected* runs:
  - every source's account and entitlement aggregation cron
  - enabled scheduled searches
  - optionally, ISC's built-in identity processing (08:00 and 20:00 tenant time)

  Past days show *actual* task runs from task history, coloured by completion status. High-frequency schedules are grouped per day (e.g. "Workday HR ×6").
- **Day detail.** Clicking a day lists every event with time, type, name, cron or task name, and status.
- **Filters.** Per-type layer toggles with counts, a source filter, and a schedule time-zone selector (persisted). ISC returns no zone for source crons, so the zone has to be chosen by the user.
- **Error states.**
  - A "not connected" banner when the App Shell handshake failed.
  - Distinct "forbidden" (403) and "failed" messages per data area.
  - A partial-failure count.
  - Warnings for unparsable crons and for schedules that can't be projected.
- **List view.** Added a translated cadence description and a **Next run** column.
- **Gemini bug fix.** The scheduled-search table now loads (`loadScheduledSearches()` was never called).

## Changes
- `src/app/features/schedules/calendar/cron-engine.ts` (+spec): a dependency-free Quartz cron parser and projector with IANA time-zone and DST handling.
  - Supports `L`, `LW`, `L-n`, `nW`, `nL`, `n#k`, names, ranges, steps and wrap-around.
  - Also projects scheduled-search `schedule` objects (DAILY/WEEKLY/MONTHLY/ANNUALLY; CALENDAR is reported as not projectable).
  - Describes crons as i18n keys.
- `.../calendar/forecast-events.ts` (+spec): builds the events (forecast from now onward, history before now), the 6×7 month grid and the per-day grouping.
- `.../calendar/schedule-forecast.service.ts` (+spec):
  - Loads all source schedules with 4 concurrent requests.
  - Loads scheduled searches directly, so 403s are visible.
  - Pages task history (250 per page, at most 8 pages, 90-day retention) back to the visible month.
  - Owns the persisted schedule time zone.
- `.../calendar/schedule-calendar.component.{ts,html,scss,spec.ts}`: the calendar UI. It uses native buttons and checkboxes, PrimeNG `p-select`, `p-message` and `p-tag`, and no icons (primeicons is not installed).
- `schedules.component.{ts,html,scss,spec.ts}`:
  - View toggle, embedded calendar, Next-run column and the scheduled-search load fix.
  - The spec now provides translations plus plugin and forecast mocks, and covers the new behaviour.
- `public/i18n/en.json`: new `schedules.*` keys (view, cron, calendar). The existing `nav.*` and `status.*` keys are untouched.

## APIs and scopes
No new scopes. All calls are already covered by `sp-ui-plugin.json`.

| Call | Operation | Scope |
|---|---|---|
| `GET /sources/v1/{sourceId}/schedules` | `getSourceSchedulesV1` | `idn:sources:read`; user levels ORG_ADMIN, SOURCE_ADMIN, SOURCE_SUBADMIN |
| `GET /scheduled-searches/v1` | `listScheduledSearchV1` | `sp:scheduled-search:manage` |
| `GET /task-status/v1?sorters=-created&limit=250&offset=n` | `getTaskStatusListV1` | `idn:task-management:read` |

None of these are experimental. All were verified against `api-specs/idn` with `api-find`.

## Verification
- Pure logic (`cron-engine`, `forecast-events`): 18 tests pass under Node's TypeScript transform with a describe/it shim, run with `TZ` set to UTC, America/Chicago and Asia/Kolkata. Fixtures cover DST gaps and overlaps in Chicago and London.
- Type-check: `tsc` with the project's strict flags, against the **real** `@sailpoint/angular-sdk` `.d.ts` for sources, task_management and scheduled_search (Angular and PrimeNG stubbed). It passes, and it was confirmed to catch a deliberately wrong SDK parameter.
- Visual check: a static render of the grid using the real engine output and the real stylesheet looked right (screenshot shared with Jeff).
- The component style is about 5.2 kB after Angular scoping: over the 4 kB budget *warning*, under the 8 kB error. That is in line with the existing components.
- **Not run:** `npm run build` and `npm test`. Claude's sandbox cannot install the npm packages (registry policy 403), and there is no shell on Jeff's machine. The Angular templates and the TestBed specs have therefore not been compiled. See Needs human.

## Follow-ups / handoff
- @gemini: please run `npm run build` and `npm test`, and fix any template compile errors in `schedules/calendar/*`. If you change anything there, open your own entry with this id in `related`.
- @gemini: the open findings from Claude's review of your entry still apply: confirm steps for terminate and aggregation, 403 messaging, polling cadence, primeicons, and the 100-source cap. The source cap also limits the calendar, because it reuses `TaskManagerService.sources()`.
- Possible next steps:
  - Week view.
  - An `.ics` export of the forecast.
  - Config Hub scheduled actions (`GET /configuration-hub/v1/scheduled-actions`, needs the new scope `sp:config-scheduled-action:read`).
  - Overlap highlighting: many aggregations on the same VA cluster in the same hour.

## Needs human
- Run `npm run build` and `npm test` (or ask Gemini to), and share any errors.
- In the tenant (via the `?spPluginDev=` link): open Schedules & Forecast → Calendar, set **Schedule time zone** to the zone your aggregation schedules were set in, and check one known schedule against ISC's source page.
