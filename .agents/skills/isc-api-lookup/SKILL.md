---
name: isc-api-lookup
description: Verify SailPoint Identity Security Cloud (ISC/idn) endpoints, filters, scopes and response fields against the local api-specs repo before using, documenting or reviewing them. Use whenever code, docs or a pasted spec mentions an ISC API path, operationId, filter, enum or scope.
---

# ISC API lookup (local idn specs only)

Third-party ISC API write-ups are often wrong. A pasted "jobs & scheduling" spec had made-up endpoints, the wrong `/v3` prefixes and invalid filters; see `docs/reference/isc-jobs-scheduling-api.md`. **The local specs are the contract.** IdentityIQ (`iiq/`) and NERM (`nerm/`) specs are out of scope.

## Where the specs are

- `$SAILPOINT_API_SPECS`, else `../../../api-specs` relative to this repo (`C:\storage\projects\sailpoint\api-specs`).
- Use the `dereferenced/*.json` files:

| Key | File | Path style |
|---|---|---|
| `v1` (default) | `deref-sailpoint-api.json` | `/<resource>/v1/...`. `@sailpoint/angular-sdk` methods (`listIdentitiesV1`, …) are generated from this |
| `v2026` / `v2025` / `v2024` | `deref-sailpoint-api.vYYYY.json` | `/vYYYY/...` |
| `v3` | `deref-sailpoint-api.v3.json` | `/v3/...` (smallest; many resources are missing) |
| `beta` | `deref-sailpoint-api.beta.json` | `/beta/...` |

In the versioned specs (`v2026`, `v2025`, `v2024`, `v3`, `beta`) the version prefix is in the server URL, not in the paths. The spec lists `/sources/{id}/load-accounts`, but the call is `/v2026/sources/{id}/load-accounts`. `api-find` prints the base for each spec. The `v1` spec has no base, so its paths are complete as written.

## How to look something up

```bash
npm run api:find -- task-status                       # keyword/path search in v1
npm run api:find -- task-status --all-specs           # which versions have it
npm run api:find -- /task-status/v1 --detail          # params, filter/sort fields, scopes, levels, body + 2xx fields/enums
npm run api:find -- --op getTaskStatusListV1 --detail
npm run api:find -- load-accounts --spec v2026 --detail
```

(Or run `node scripts/api-find.mjs …` directly.)

## Checklist for every endpoint you use or review

1. **It exists** in the spec version you call. Prefer `v1`; if it isn't there, check `--all-specs`.
2. **Method and path match exactly**, including the parameter name style (`{id}` vs `{sourceId}`).
3. **Filters and sorters** are supported. They're listed in the `filters`/`sorters` parameter description, e.g. `completionStatus isnull` is valid and `eq "null"` is not.
4. **Enums**: use only values that appear in the schema. If the filter docs and the response schema disagree, note it and confirm against a live response.
5. **Body content type**: e.g. `load-accounts` takes `multipart/form-data`, and `disableOptimization` is a form field there.
6. **Experimental**: send `X-SailPoint-Experimental: true` if the spec lists that header.
7. **Scopes**: add the operation's scope(s) to `sp-ui-plugin.json` `apiScopes`. Note the `x-sailpoint-userLevels` too: the signed-in user must also hold one of those levels.
8. **Pagination**: list endpoints take `limit` (≤250), `offset` and `count=true`. `X-Total-Count` is only returned when `count=true`.

## In code

- Prefer the typed `@sailpoint/angular-sdk` service: the area is the import subpath (`@sailpoint/angular-sdk/<area>`) and the method is the operationId.
- If the SDK lacks it, use `plugin.get/post('<path suffix>')` with the exact spec path.
- Record every endpoint in the changelog entry's **APIs and scopes** section.

## If the spec seems wrong or out of date

Don't guess. Note the discrepancy in the changelog entry and tell the human. The api-specs repo is read-only upstream (sailpoint-oss/api-specs); refresh it with `git pull` there.
