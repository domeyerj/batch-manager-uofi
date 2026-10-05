---
name: changelog
description: Claim, track and close work in the changelog/ folder so Claude and Gemini agents coordinate. Use at the start and end of every task in batch-manager-uofi, before touching any file, and whenever you hand work to the other agent.
---

# Changelog: claim → work → close

`changelog/` is the shared timeline and lock table. One Markdown file per unit of work, named `<YYYYMMDDTHHMMSSZ>_<agent>_<slug>.md` in UTC. Full rules are in `changelog/README.md`.

## 1. Before you touch anything

```bash
npm run changelog -- list        # last 10 entries + open-claim count
npm run changelog -- open        # every in-progress / blocked entry
```

- Read every open entry. Its `scope:` lists the files and areas it claims.
- **Overlap with another agent's open entry → stop.**
  - Choose non-overlapping work, or ask the human.
  - If that entry's `updated` is more than 24 h old (the list marks it `STALE`), you may take it over: append `## Takeover (<you>, <UTC ISO>)` with your reason at the bottom of *their* entry, then open your own entry with their id in `related:`.
- Skim the recent `done` entries. Their **Follow-ups / handoff** sections may contain `@<you>:` items addressed to you.

## 2. Claim the work

```bash
npm run changelog -- new --agent <claude|gemini> --slug <kebab-slug> --title "<one-line title>"
```

Then, in the new file:

- Set `scope:` to the concrete files and areas you will touch, comma-separated, globs allowed. Example: `src/app/features/job-monitor/**, src/app/app.routes.ts, public/i18n/en.json, sp-ui-plugin.json`.
- Set `related:` to the ids of entries you build on or fix.
- Fill in **Goal** and **Plan**.

If `npm` is unavailable, create the file by hand:

- Copy `changelog/_TEMPLATE.md` and replace the `{{…}}` placeholders.
- Get the timestamp with `date -u +%Y%m%dT%H%M%SZ` (bash) or `(Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")` (PowerShell).

## 3. While working

- Stay inside your `scope`. If you must widen it, edit `scope:`, bump `updated:` (UTC ISO), and re-check open entries for overlap.
- Keep one entry per reviewable enhancement. Split large work into several sequential entries rather than one giant entry.

## 4. Close the entry

Fill in these sections:

- **Summary:** plain language.
- **Changes:** each file with a short note.
- **APIs and scopes:** method, path, operationId, whether it is experimental, and the scope added. Verify each one with the `isc-api-lookup` skill.
- **Verification:** the actual `npm run build` / `npm test` results, or why they weren't run.
- **Follow-ups / handoff:** items for the other agent prefixed `@claude:` or `@gemini:`.
- **Needs human:** e.g. `sail ui-plugins push-manifest` after manifest edits, `upload`, tenant settings.

Then set `status: done` (or `blocked` / `abandoned` with the reason in Summary), bump `updated:`, and run `npm run changelog -- validate`.

## Hard rules

- Never edit or delete another agent's entry. You may only append `## Review (...)` or `## Takeover (...)` at the bottom.
- Never change an entry's filename or `timestamp`. They define the chronological order.
- Commit messages and PR titles start with the entry id.
- Never put secrets, tokens or real identity data in entries.
