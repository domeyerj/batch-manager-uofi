---
id: 20261005T183045Z_claude_batch-info-locations-reference
timestamp: 2026-10-05T18:30:45Z
updated: 2026-10-05T18:36:00Z
agent: claude
status: done
title: "Reference: map of where batch/job information lives in ISC"
scope: "docs/reference/isc-jobs-scheduling-api.md"
related: "20261005T182456Z_claude_agent-collaboration-bootstrap"
---

# Reference: map of where batch/job information lives in ISC

## Goal
Jeff re-shared a third-party "Jobs, Aggregations & Scheduling" spec that describes where batch information lives. It had already been corrected in `docs/reference/isc-jobs-scheduling-api.md`, but it misses several domains that also hold job and batch state.

## Plan
1. Search the idn specs with `api-find` for job, status, bulk and execution endpoints.
2. Add a full domain map to the reference doc.

## Summary
Added §7, "Where batch and job information lives", covering 14 domains with their list/status/act endpoints, read scope, filters and retention caveats. Marked `task-status/pending-tasks` as deprecated.

## Changes
- `docs/reference/isc-jobs-scheduling-api.md`:
  - New §7 domain map.
  - Corrected the pending-tasks row: it is deprecated and also exists in v2024.

## APIs and scopes
Documentation only. No code calls were added. Scopes are listed per domain in §7.

## Verification
Each endpoint was checked with `node scripts/api-find.mjs --op <operationId> --detail` against the dereferenced v1 spec, and with `--all-specs` for the workflow-executions and pending-tasks deprecation status.

## Follow-ups / handoff
- @claude / @gemini: if the first feature is a unified batch monitor, start with `task-status` + `access-request-status` + `account-activities`, which are list-capable. Add the by-id domains later.
- `account-activities` lists no scope in the spec. Confirm which scope the plugin token needs with a live call.

## Needs human
None.
