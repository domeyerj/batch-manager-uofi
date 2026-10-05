# AGENTS.md — batch-manager-uofi

Shared operating rules for **every** AI agent working in this repo: Claude (Claude Code / Cowork) and Gemini (Gemini CLI). `CLAUDE.md` and `GEMINI.md` load this file. Put agent-specific notes in those files, never here.

## 1. What this project is

- A **SailPoint UI Plugin** for Identity Security Cloud (ISC / SailPoint Human Fabric). It is a static Angular app that ISC loads in a sandboxed iframe in the `full-page` slot.
- Built for the University of Illinois (UofI) team, starting from the SailPoint hack-day UI Plugins track.
- It talks to ISC only through `@sailpoint/ui-plugin-sdk` (the COIP handshake), using a scoped token. It never calls IdentityIQ. IIQ and NERM APIs are **out of scope**.

## 2. Stack and commands

| Item | Value |
|---|---|
| Framework | Angular 21, standalone components, signals, hash routing (`withHashLocation`) |
| UI | PrimeNG 21 with the SailPoint preset (`src/app/core/spds-prime-theme.ts`, generated, **do not edit**) |
| SDKs | `@sailpoint/ui-plugin-sdk` (handshake), `@sailpoint/angular-sdk` (typed `...V1` services, `Paginator`) |
| i18n | ngx-translate, catalogs in `public/i18n/<lang>.json` (`en` is the fallback) |
| Tests | Vitest via `ng test` (`npm test`) |
| Node / npm | Node ≥ 24.15, npm ≥ 11.12 |

```bash
npm start                      # HTTPS dev server on :4200
npm run build                  # -> dist/batch-manager-uofi/browser
npm test                       # unit tests
npm run changelog -- list      # recent changelog entries + open claims
npm run api:find -- <term>     # look up an ISC endpoint in the local API specs
npm run skills:sync            # regenerate .claude/skills wrappers from .agents/skills
sail ui-plugins link | upload | push-manifest | validate-manifest
```

## 3. Sources of truth

1. **ISC API contract: the local `api-specs` repo, `idn/` specs only.** It lives at `../../../api-specs` relative to this repo; override with the env var `SAILPOINT_API_SPECS`. Prefer `dereferenced/deref-sailpoint-api.json` (per-resource `/<resource>/v1/...` paths, which `@sailpoint/angular-sdk` is generated from). Fall back to `v2026`, `v2025` and `beta`.
2. **Never invent an endpoint, field, filter or enum.** Verify it with the `isc-api-lookup` skill first. Third-party write-ups of ISC APIs, including ones pasted into chat, have been wrong before; see `docs/reference/isc-jobs-scheduling-api.md`.
3. **Plugin mechanics:** `SAILPOINT_PLUGIN_GUIDE_ANGULAR.md` (canonical) and `docs/reference/hack-day-ui-plugins.md`.
4. **History of the work:** `changelog/`. Read it before you change anything (see §5).

## 4. Engineering rules

- **API calls.** Use `@sailpoint/angular-sdk` services (declare them in the component `providers`). For endpoints the SDK lacks, use `SailpointPluginService.get/post`. Pass path suffixes only, never full URLs or tokens.
- **Pagination.** List endpoints cap at 250 records. Use `Paginator.paginate()`, or `paginatePages()` for large sets. Never assume one page is everything.
- **Gate on the handshake.** Start API work only when `plugin.apiReady()` is true, typically in an `effect()` with a once-flag. Components never call `whenReady()`.
- **Scopes.** Every endpoint you call needs its scope in `sp-ui-plugin.json` `apiScopes`. The goal is least privilege: replace `sp:scopes:all` once the feature set is known. After any manifest change, note in the changelog that a human must run `sail ui-plugins push-manifest` and then re-`link`.
- **Experimental endpoints** need the header `X-SailPoint-Experimental: true`. Flag them in code comments and in the changelog entry.
- **Bulk or destructive operations** (access requests, cancels, account actions, aggregations) need:
  - a preview or confirm step in the UI,
  - throttling and 429 backoff,
  - per-item result reporting.

  Never fire them automatically on page load.
- **Do not edit** these, unless the task explicitly requires it (and say so in the changelog):
  - `src/app/core/spds-prime-theme.ts`
  - `src/app/core/sailpoint-plugin.service.ts`
  - `src/app/app.config.ts`
- **User-facing text** goes in `public/i18n/en.json` and is rendered via the `translate` pipe. No hard-coded strings in templates.
- **Structure.** Add new features as lazy routes in `src/app/app.routes.ts` under `src/app/features/<feature>/`. Each feature has a spec file.
- **Secrets.** Never commit secrets, PATs, client secrets, tenant tokens or real identity data. Test fixtures use fake IDs and names.
- **Keep built asset paths relative** (`baseHref`/`deployUrl` = `./`).

## 5. Collaboration protocol (Claude ⇄ Gemini)

The `changelog/` folder is the coordination channel. One file per unit of work, named with a UTC timestamp so `ls` sorts chronologically. The full format and examples are in the `changelog` skill and `changelog/README.md`.

**Before starting any task:**

1. Run `npm run changelog -- list`. Read the last ~10 entries, and **every** entry with `status: in-progress` or `status: blocked`.
2. If an open entry by another agent claims files or areas you need, **do not touch them**. Pick other work or ask the human. A claim older than 24 h with no update may be taken over: add a `Takeover` note to that entry, then open your own.
3. **Claim your work.** Run `npm run changelog -- new --agent <claude|gemini> --slug <kebab-slug> --title "<title>"`, then fill in `scope` (the files and areas you will touch). Its status starts as `in-progress`.

**While working:**

- Keep changes small and focused. One entry is roughly one reviewable enhancement.
- If the plan changes, update the claim's `scope`.

**When finishing:**

1. Run `npm run build` and `npm test`, and record the results in the entry's **Verification** section. If you couldn't run them, say so.
2. Fill in the **Summary**, **Changes**, **Follow-ups / handoff** and **Needs human** sections.
3. Set `status: done`, or `blocked` / `abandoned` with the reason.

**Ownership of entries:**

- Never edit or delete another agent's entry. The only exceptions are appending a `Takeover` note or a `Review` note at the bottom.
- To correct earlier work, create a new entry that references it in `related`.

**Handoffs:** put explicit next steps for the other agent under **Follow-ups / handoff**, prefixed with `@gemini:` or `@claude:`.

**Commit / PR messages:** start with the changelog entry id, e.g. `20261005T182456Z_claude_agent-collaboration-bootstrap: …`.

## 6. Definition of done

- Builds and tests pass, or the failure is documented.
- Any new endpoints have been verified against the local specs, and their scopes are added to the manifest.
- New strings are in `en.json`.
- No secrets.
- The changelog entry is closed with verification notes.

## 7. Skills

Both agents share the skills in `.agents/skills/`, which are the only copy to edit. Gemini CLI discovers them natively. Claude Code reaches them through thin wrappers in `.claude/skills/`, generated by `npm run skills:sync`. Re-run it after adding or renaming a skill or changing a description; `npm run skills:sync -- --check` reports drift.

| Skill | Use it when |
|---|---|
| `changelog` | Starting, claiming, updating or closing any piece of work |
| `isc-api-lookup` | Before calling, documenting or reviewing any ISC endpoint |
| `ui-plugin-dev` | Building or changing plugin features, manifest, routes, i18n, tests or deploy steps |
| `cross-agent-review` | Reviewing work the other agent recorded in the changelog |
