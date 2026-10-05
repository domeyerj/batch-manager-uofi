# changelog/

This folder records the chronological history of enhancements made by humans, Claude and Gemini. It is also how they coordinate: open entries claim work.

## File naming

```
<YYYYMMDDTHHMMSSZ>_<agent>_<slug>.md
20261005T182456Z_claude_agent-collaboration-bootstrap.md
```

- **Timestamp:** UTC, taken when the work **starts** (the claim). It never changes afterwards, so a plain listing is chronological.
- **Agent:** `claude`, `gemini` or `human`.
- **Slug:** kebab-case, short, describes the enhancement.
- The file name minus `.md` is the entry **id**. Use it in `related:`, commit messages and PR titles.

Create entries with the helper rather than by hand, so the timestamp is exact UTC:

```bash
npm run changelog -- new --agent gemini --slug job-monitor-page --title "Add job monitor page"
npm run changelog -- list          # last 10 + open-claim count
npm run changelog -- open          # in-progress / blocked only (flags claims >24h old as STALE)
npm run changelog -- validate      # check names and front matter
```

## Front matter

| Field | Meaning |
|---|---|
| `id` | The filename without `.md` |
| `timestamp` | When the entry was created (UTC ISO 8601) |
| `updated` | When the entry was last updated (UTC ISO). Bump it whenever you edit your entry. |
| `agent` | Who owns the entry |
| `status` | `in-progress` → `done` \| `blocked` \| `abandoned` |
| `title` | A one-line description of the enhancement |
| `scope` | The files and areas claimed (comma-separated globs). Others must not touch these while the entry is open. |
| `related` | Ids of earlier entries this one builds on, fixes or reviews |

## Lifecycle

1. **Claim.** `new` creates the entry with `status: in-progress`. Fill in `scope` immediately.
2. **Work.** Keep the entry's scope accurate, and bump `updated` when you change it.
3. **Close.** Fill in Summary, Changes, Verification, Follow-ups / handoff and Needs human, then set `status: done`, or `blocked` / `abandoned` with a reason.

## Ownership rules

- Edit only **your own** entries.
- On another agent's entry you may only **append** at the bottom:
  - `## Review (<agent>, <UTC ISO>)` with review findings, or
  - `## Takeover (<agent>, <UTC ISO>)`, allowed only when the claim is open and its `updated` is older than 24 h.
- Never delete entries. To revert or redo work, open a new entry and list the old id in `related`.
- `_TEMPLATE.md` is the template. Change it only through its own changelog entry.
