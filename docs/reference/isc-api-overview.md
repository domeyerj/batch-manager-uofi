# ISC API overview for this plugin

Reviewed 2026-10-05 against `api-specs/idn` (dereferenced). To verify anything here, use `npm run api:find`.

## Spec layout

| Spec | Ops | Path style |
|---|---|---|
| `deref-sailpoint-api.json` (v1) | 940 | `/<resource>/v1/...`. `@sailpoint/angular-sdk` is generated from this (`listIdentitiesV1` → `GET /identities/v1`) |
| v2026 | 864 | `/v2026/...` |
| v2025 | 813 | `/v2025/...` |
| v2024 | 717 | `/v2024/...` |
| beta | 560 | `/beta/...` |
| v3 | 358 | `/v3/...` |

- **Auth:** OAuth2 `userAuth` (PAT or auth code) and `applicationAuth` (client credentials). Inside the plugin, the App Shell supplies a scoped token derived from `apiScopes`.
- **Scopes:** about 284 fine-grained scopes. Each operation also lists `x-sailpoint-userLevels` (ORG_ADMIN, HELPDESK, …), and the signed-in user needs one of them.
- **Experimental:** 258 operations require the header `X-SailPoint-Experimental: true`.

## Batch-relevant endpoints (v1)

| Area | Endpoints |
|---|---|
| Access requests | `POST /access-requests/v1` (GRANT_ACCESS: many identities × many items, or `requestedForWithRequestedItems`; async; duplicates are not rejected) · `POST /access-requests/v1/bulk-cancel` · `POST /access-request-approvals/v1/bulk-approve` |
| Status / tracking | `GET /account-activities/v1` · `GET /task-status/v1[/{id}]` |
| Accounts | Per-account `enable`, `disable`, `unlock`, `reload` and `remove`. There is no bulk endpoint, so fan out client-side with throttling. |
| Identities | `set-lifecycle-state`, `reset`, `process` (experimental) |
| Search | `POST /search/v1`, `/search/v1/count`, `/search/v1/aggregate` |
| Workflows / launchers | `/workflows/v1/*`, `POST /launchers/v1/{id}/launch`, external trigger `/workflows/v1/execute/external/{id}` |
| Other bulk | Governance-group members `bulk-add`/`bulk-delete`, `tagged-objects` `bulk-add`/`bulk-remove`, `entitlements/v1/bulk-update`, roles and access-profiles `bulk-delete`, non-employee bulk upload, work-items bulk approve/reject, generic-approvals `bulk-*` |
| Aggregations and schedules | See `isc-jobs-scheduling-api.md` |

## Known gotchas

- The starter's `LauncherService` calls `/beta/launchers/my/assigned`, which is **not in any spec** in the repo (undocumented). `POST /launchers/v1/{launcherID}/launch` is documented.
- `LaunchersService.getLaunchersV1()` returns all tenant launchers and needs admin scope.
- The manifest uses `apiScopes: ["sp:scopes:all"]`. Narrow it once the features are known.
- Starting scope candidates for a batch tool:
  - `idn:access-request:manage`
  - `sp:search:read`
  - `idn:identity:read`
  - `idn:task-management:read`
  - `sp:tenant:read`
