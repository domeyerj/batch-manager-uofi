---
id: 20261005T191951Z_gemini_fix-calendar-template-and-test-verify
timestamp: 2026-10-05T19:19:51Z
updated: 2026-10-05T19:27:00Z
agent: gemini
status: done
title: "Fix calendar template typing and verify build and tests"
scope: "src/app/features/schedules/calendar/schedule-calendar.component.html, src/app/features/schedules/calendar/schedule-calendar.component.ts, src/test-setup.ts"
related: "20261005T185929Z_claude_schedules-calendar-view"
---

# Fix calendar template typing and verify build and tests

## Goal
Fix template compile error in ScheduleCalendarComponent (TS7053: indexing issues record with any) reported during `npm test` and `npm run build`, run full test suite, verify build, and provide deployment instructions for the project.

## Plan
1. Fix TS7053 indexing in `schedule-calendar.component.ts` and `schedule-calendar.component.html` using a typed `activeIssues` computed signal.
2. Run `npm test` and `npm run build` to verify clean build and all unit tests pass.
3. Validate changelog with `npm run changelog -- validate`.
4. Close changelog entry with verification details and provide deployment instructions to the user.

## Summary
Fixed a template compilation failure in `ScheduleCalendarComponent` where indexing `forecast.issues()` with `$any(area)` triggered TypeScript error TS7053 with `noImplicitAny`. Introduced a strongly typed `activeIssues` computed signal in the component class that maps active issues cleanly for template consumption.

Also added a `localStorage` fallback polyfill in `src/test-setup.ts` to support Node 22/24 environments where `globalThis.localStorage` is uninitialized without `--localstorage-file`.

Ran the full test suite and production build. All 61 unit tests across 11 test files pass, and the production build compiles successfully with relative assets ready for SailPoint CDN deployment.

## Changes
- `src/app/features/schedules/calendar/schedule-calendar.component.ts`: imported `LoadIssue` and defined `activeIssues` computed signal.
- `src/app/features/schedules/calendar/schedule-calendar.component.html`: replaced `$any(area)` record indexing with iteration over `activeIssues()`.
- `src/test-setup.ts`: added `localStorage` polyfill for Node 22+ test runners.

## APIs and scopes
None. All APIs and scopes were established in previous entries. `sail ui-plugins validate-manifest` confirms `sp-ui-plugin.json` is valid.

## Verification
- `npm test`: 11 test files passed, 61 tests passed (0 failures).
- `npm run build`: succeeded, outputs to `dist/batch-manager-uofi/browser` with relative `<base href="./">` and relative asset bundles.
- `sail ui-plugins validate-manifest`: reported manifest structure valid offline.

## Follow-ups / handoff
- @claude: calendar template compilation and test suite verification complete. All 61 unit tests pass cleanly.

## Needs human
- If deploying to a tenant: run `sail ui-plugins push-manifest` and `sail ui-plugins upload` (or `sail ui-plugins deploy`). See deployment instructions.
