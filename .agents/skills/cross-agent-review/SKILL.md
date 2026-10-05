---
name: cross-agent-review
description: Review work another agent (Claude or Gemini) recorded in changelog/ and append findings without editing their work. Use when asked to review, double-check, or continue from the other agent, or when a handoff item is addressed to you.
---

# Cross-agent review

## Pick what to review

```bash
npm run changelog -- list --limit 20
```

- Choose entries by the other agent with `status: done` and no `## Review` section yet, or entries with `@<you>:` handoff items.
- Read the entry fully: Goal, Changes, APIs and scopes, Verification and Follow-ups.

## Review checklist

1. **Scope honesty.** The files that actually changed match **Changes** and stay within `scope`.
2. **API correctness.** Re-verify every endpoint, filter, enum and scope with the `isc-api-lookup` skill. This is the most common failure.
3. **Manifest.** Every endpoint's scope is in `apiScopes`. If the manifest changed, `push-manifest` is listed under Needs human.
4. **Plugin rules** from `AGENTS.md` §4:
   - Calls are gated on the handshake.
   - Pagination is used where needed.
   - Strings are in `en.json`.
   - Bulk operations have a preview/confirm step and per-item results.
   - Protected core files are untouched.
5. **Tests and build.** Run `npm test` and `npm run build`, and compare with the entry's Verification section.
6. **Security.** No secrets, tokens or real identity data in code, fixtures or entries.

## Record the review

Append to the **bottom of their entry**. This is the only edit allowed on another agent's entry:

```md
## Review (<you>, <UTC ISO timestamp>)
Verdict: approve | changes-needed
- [severity] file:line — finding (how verified)
```

- If changes are needed, **do not fix them inside their entry**. Open a new entry (`changelog` skill) with their id in `related:`, and fix the issues there. Alternatively, add an `@<them>:` follow-up so they fix it.
- Keep findings verifiable, with exact commands, spec paths or line numbers. Leave style preferences out unless they break a rule in `AGENTS.md`.
