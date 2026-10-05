---
id: 20261005T182456Z_claude_agent-collaboration-bootstrap
timestamp: 2026-10-05T18:24:56Z
updated: 2026-10-05T18:45:00Z
agent: claude
status: done
title: "Bootstrap Claude + Gemini collaboration: shared rules, skills, changelog"
scope: "AGENTS.md, CLAUDE.md, GEMINI.md, .gemini/settings.json, .agents/skills/**, .claude/skills/**, changelog/**, scripts/changelog.mjs, scripts/api-find.mjs, scripts/sync-claude-skills.mjs, docs/reference/**, package.json (scripts only)"
related: ""
---

# Bootstrap Claude + Gemini collaboration: shared rules, skills, changelog

## Goal
Let Claude and Gemini agents work on this plugin without stepping on each other. Jeff asked for shared skills and rules, plus a changelog folder of individually timestamped logs that records the order in which enhancements were made.

## Plan
1. Create one shared rule file (`AGENTS.md`), loaded by both `CLAUDE.md` (via `@AGENTS.md`) and Gemini (via `.gemini/settings.json` `context.fileName`).
2. Put shared skills in `.agents/skills/`, which Gemini CLI discovers natively. Generate thin wrappers in `.claude/skills/` for Claude Code with `scripts/sync-claude-skills.mjs`.
3. Add `changelog/` with a README, a template and a Node helper (`scripts/changelog.mjs`).
4. Add `scripts/api-find.mjs` to check endpoints against the local idn specs.
5. Copy the earlier research into `docs/reference/` so both agents can read it.

## Summary
Set up the collaboration scaffolding. No application code changed.

## Changes
- `AGENTS.md`: shared project rules, sources of truth, engineering rules, collaboration protocol and definition of done.
- `CLAUDE.md`, `GEMINI.md`, `.gemini/settings.json`: per-agent entry points that load `AGENTS.md`.
- `.agents/skills/{changelog,isc-api-lookup,ui-plugin-dev,cross-agent-review}/SKILL.md`: the shared skills.
- `scripts/sync-claude-skills.mjs` (`npm run skills:sync`): generates the `.claude/skills/*/SKILL.md` wrappers. Claude couldn't write into `.claude/` remotely, so the wrappers are generated locally instead of committed by Claude.
- `changelog/README.md`, `changelog/_TEMPLATE.md`, this entry.
- `scripts/changelog.mjs`: `new | list | open | validate`.
- `scripts/api-find.mjs`: endpoint lookup across the v1, v2026, v2025, v2024, v3 and beta idn specs.
- `docs/reference/`:
  - `isc-api-overview.md`: spec layout, scopes and batch-relevant endpoints.
  - `isc-jobs-scheduling-api.md`: corrected version of a third-party jobs/scheduling write-up.
  - `hack-day-ui-plugins.md`: notes from the SailPoint hack-day track.
- `package.json`: added the `changelog`, `api:find` and `skills:sync` npm scripts. Dependencies are unchanged.

## APIs and scopes
None.

## Verification
- Both scripts were exercised in Claude's sandbox against a copy of the repo and the api-specs dereferenced JSON: `new`, `list`, `open` and `validate` passed, and `api-find task-status --detail` returned the expected filters and scopes. `skills:sync` and `skills:sync -- --check` were tested.
- `npm run build` and `npm test` were not run, because the change touches no application code.

## Follow-ups / handoff
- @gemini: on your first session, run `npm run changelog -- list` and confirm that the `.agents/skills` skills show up (`/skills list`). Record the result in a short entry of your own.
- @claude / @gemini: the next functional work needs Jeff to decide the first batch feature: a job/aggregation monitor, bulk access requests from CSV, or something else.
- Replace `apiScopes: ["sp:scopes:all"]` with least-privilege scopes once that first feature is chosen.

## Needs human
- Run `npm run skills:sync` once, to create the `.claude/skills/` wrappers for Claude Code.
- Decide the first feature.
- Run `git init` (the repo has no `.git` yet) so commits can reference changelog ids.
