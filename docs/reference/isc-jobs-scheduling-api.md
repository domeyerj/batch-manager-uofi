# ISC — Jobs, Aggregations & Scheduling API (corrected against api-specs/idn)

Verified 2026-10-05 against `api-specs/dereferenced/deref-sailpoint-api*.json`. Paths use the per-resource `v1` form (what `@sailpoint/angular-sdk` is generated from). The same paths exist under `/v2025/...` and `/v2026/...`. Most of them are **not** in `/v3`.

---

## 1. Auth

- **In a UI plugin:** there is no client-credentials step. The App Shell hands the plugin a scoped token, so declare the scopes below in `sp-ui-plugin.json` `apiScopes`.
- **Outside a plugin:** `POST https://{tenant}.api.identitynow.com/oauth/token` with `grant_type=client_credentials` (works for PATs and API clients).

| Area | Scope(s) | User levels |
|---|---|---|
| Task status (read) | `idn:task-management:read` | ORG_ADMIN, HELPDESK, CERT/REPORT/ROLE/SOURCE admins |
| Task status (clear pending) | `idn:task-management:write` | ORG_ADMIN and the admin levels above (not HELPDESK) |
| Source schedules | `idn:sources:read` | ORG_ADMIN, SOURCE_ADMIN, SOURCE_SUBADMIN |
| Account aggregation | `idn:sources:manage` | ORG_ADMIN, SOURCE_ADMIN, SOURCE_SUBADMIN |
| Entitlement aggregation | `idn:entitlement:manage` | ORG_ADMIN |
| Uncorrelated accounts (file) | `idn:sources:manage` | ORG_ADMIN |
| Attribute sync (experimental) | `idn:attr-sync-source-config:manage` | ORG_ADMIN, SOURCE_ADMIN |
| Identity profile read / process | `idn:identity-profile:read` / `:manage` | ORG_ADMIN, API |
| Managed clusters / clients | `idn:remote-client:read` | ORG_ADMIN |
| Managed client status | `idn:managed-client-status:read` | — |
| Scheduled searches | `sp:scheduled-search:manage` | — |
| Config Hub scheduled actions | `sp:config-scheduled-action:read` | ORG_ADMIN |
| Search (events) | `sp:search:read` | ORG_ADMIN and admin levels |

---

## 2. Task status

| Action | Method | Path | Notes |
|---|---|---|---|
| List | GET | `/task-status/v1` | Only 90 days of history |
| Get | GET | `/task-status/v1/{id}` | |
| Clear a hung task | PATCH | `/task-status/v1/{id}` | `application/json-patch+json`; replace `/completionStatus` and `/completed`. There is **no** `/terminate` endpoint. |
| Pending tasks | GET/HEAD | `/beta/task-status/pending-tasks` (also v2025 and v2024) | **Deprecated.** Not in v1 or v2026. Use `filters=completionStatus isnull` instead. |

**Filters** (only these fields are supported):

- `id`: eq, in
- `sourceId`: eq, in
- `completionStatus`: eq, in, **isnull**
- `type`: eq, in
- `launcher`: eq, in

**Sorters:** `created` only.

```
Running:          filters=completionStatus isnull
Recent:           sorters=-created&limit=50
By source:        filters=sourceId eq "{sourceId}"            (not target.id)
By type:          filters=type eq "CLOUD_ACCOUNT_AGGREGATION"
Failures:         filters=completionStatus in ("ERROR","WARNING","TERMINATED","TEMPERROR")
Combined:         filters=type eq "CLOUD_ACCOUNT_AGGREGATION" and completionStatus isnull
```

**`type` filter values:** CLOUD_ACCOUNT_AGGREGATION, CLOUD_GROUP_AGGREGATION, CLOUD_PROCESS_UNCORRELATED_ACCOUNTS, CLOUD_REFRESH_ROLE, SOURCE_APPLICATION_DISCOVERY, AI_AGENT_AGGREGATION, CLOUD_ENTITLEMENT_IMPORT, CLOUD_UNCORRELATED_REFRESH, CLOUD_IDENTITY_AGGREGATION, CLOUD_ATTRIBUTE_SYNCHRONIZATION, IDENTITY_REFRESH, APPLICATION_DISCOVERY, MACHINE_IDENTITY_AGGREGATION, MACHINE_IDENTITY_DELETION, ACCOUNT_DELETION.

> Not in the spec: `SOURCE_ACCOUNT_AGGREGATION`, `MACHINE_ACCOUNT_AGGREGATION`.
> The response schema enums `type` as `QUARTZ | QPOC | QUEUED_TASK`, which contradicts the filter list. Verify against a live response; the friendly name may land in `uniqueName`.

**Response fields:** id, type, uniqueName, description, parentName, launcher, target{id, type: `APPLICATION|IDENTITY|null`, name}, created, modified, launched, completed, completionStatus, messages[], returns[], attributes{}, progress, percentComplete, taskDefinitionSummary.

**`completionStatus`:** SUCCESS | WARNING | ERROR | TERMINATED | TEMPERROR | null (in flight).

The aggregation counters in `attributes` (totalAccounts, optimizedAccounts, …) are not defined in the schema (free-form object), so treat them as best-effort.

---

## 3. Schedules

| What | Method | Path | Fields |
|---|---|---|---|
| Source schedules | GET | `/sources/v1/{sourceId}/schedules` | `type` (ACCOUNT_AGGREGATION \| GROUP_AGGREGATION), `cronExpression` |
| One source schedule | GET | `/sources/v1/{sourceId}/schedules/{scheduleType}` | same |
| Scheduled searches | GET | `/scheduled-searches/v1` (also `/v3`) | `schedule{type, months, days, hours, expiration, timeZoneId}`, `enabled`, `recipients`, … |
| Config Hub scheduled actions | GET | `/configuration-hub/v1/scheduled-actions` | `jobType` (BACKUP \| CREATE_DRAFT \| CONFIG_DEPLOY_DRAFT), `cronString`, `timeZoneId`, `startTime` |

- Source schedules have **no** `cronExp`, `cronTimeZone` or `enabled` field. The field is `cronExpression`, and days of the week are 1–7 (Sun–Sat). A schedule that is absent means none is configured.
- Identity profiles have **no** schedule fields. ISC runs scheduled identity processing daily at 08:00 and 20:00 in the tenant's time zone, plus event-based processing. `identityRefreshRequired` is the only useful flag.
- `/beta/configuration-hub/schedules` does not exist. Use `scheduled-actions`.

---

## 4. On-demand triggers

| Process | Method | Path | Body | Returns |
|---|---|---|---|---|
| Account aggregation | POST | `/sources/v1/{id}/load-accounts` | `multipart/form-data`: `file` (delimited sources), `disableOptimization` (`"true"`) as a **form field**, not a query param | `{ success, task{…} }` |
| Entitlement aggregation | POST | `/sources/v1/{sourceId}/load-entitlements` | `multipart/form-data`: `file` (delimited sources) | task object (`id`, `type`, …) |
| Uncorrelated accounts | POST | `/sources/v1/{id}/load-uncorrelated-accounts` | `multipart/form-data`, **file required** | `{ success, task }` |
| Attribute sync | POST | `/sources/v1/{id}/synchronize-attributes` | header `X-SailPoint-Experimental: true` | `{ id, status: QUEUED\|IN_PROGRESS\|SUCCESS\|ERROR, payload }`: a job, not a task-status record |
| Identity profile processing | POST | `/identity-profiles/v1/{identity-profile-id}/process-identities` | — | 202 |
| Process specific identities | POST | `/identities/v1/process` | experimental | |

- `process-uncorrelated-accounts` does not exist.
- SailPoint says **not** to use `process-identities` for your own scheduling or tenant-wide refreshes. Only run it when `identityRefreshRequired=true`.

---

## 5. Infrastructure (VA / CCG)

| What | Method | Path | Status values |
|---|---|---|---|
| Clusters | GET | `/managed-clusters/v1` (filters: operational, name, type, status) | `status`: CONFIGURING \| FAILED \| NO_CLIENTS \| NORMAL \| WARNING; also `operational`, `consolidatedHealthIndicatorsStatus` (NORMAL \| WARNING \| ERROR) |
| Clients in a cluster | GET | `/managed-clients/v1?filters=clusterId eq "{id}"` | `status`: NORMAL \| UNDEFINED \| NOT_CONFIGURED \| CONFIGURING \| WARNING \| ERROR \| FAILED; `lastSeen`, `sinceLastSeen` |
| Client status | GET | `/managed-clients/v1/{id}/status` | same enum, plus `timestamp` |

- `/managed-clusters/{id}/clients` does not exist.
- `STALLED` is not a status value.

**Events search:** `POST /search/v1` with `indices: ["events"]`. The `type:AGGREGATION` query values are not defined in the spec, so validate them against live data.

---

## 6. Polling notes

- **Pagination:** `limit`/`offset` (max 250), and `count=true` to get `X-Total-Count`. Without `count=true` the header is absent. In Angular use `Paginator.paginate()`.
- **Rate limits:** handle 429 with backoff.
- **No `target.id` filter:** "last run per source" means filtering `sourceId in (...)` with `sorters=-created`, then grouping client-side by `target.id`.
- **History:** only 90 days. Persist elsewhere if you need longer trends.

---

## 7. Where batch and job information lives (full map)

Added 2026-10-05. Every endpoint below was verified with `npm run api:find`. Paths are v1.

| Domain | List / status | Act | Scope (read) | Notes |
|---|---|---|---|---|
| Background tasks (aggregations, identity refresh, deletions) | `GET /task-status/v1`, `/{id}` | `PATCH /task-status/v1/{id}` (clear a hung task) | `idn:task-management:read` | Filters: `id`, `sourceId`, `completionStatus` (incl. `isnull`), `type`, `launcher`. Sort: `created` only. 90 days of history. |
| Source aggregation schedules | `GET /sources/v1/{id}/schedules[/{type}]` | `load-accounts`, `load-entitlements` (§4) | `idn:sources:read` | Fields: `type` and `cronExpression` only |
| Access requests (batch grants and revokes) | `GET /access-request-status/v1` | `POST /access-requests/v1`, `/bulk-cancel` | `idn:access-request-status:read` (ORG_ADMIN) | Filters: `accessRequestId`, `accountActivityItemId`, `created`. Sort: `created`, `modified`, `name`. |
| Account activities (provisioning outcomes per request) | `GET /account-activities/v1`, `/{id}` | — | none listed in the spec; verify live | Filters: `type`, `created`, `modified` (supports `isnull`, ranges). Sort: `type`, `created`, `modified`. |
| Workflows | `GET /workflow-executions/v1/{id}`, `/history`, `/history-v2` | `POST /workflow-executions/v1/{id}/cancel` | `sp:workflow-execution:read` | `GET /workflows/v1/{id}/executions` (the list) is **deprecated, to be removed July 2028**, and returns at most 250 records; executions are archived after 90 days. Use it only with filters (`start_time`, `status`). |
| Data Access Security (DAS) tasks | `GET /das/v1/tasks`, `/{id}`, `/das/v1/tasks/schedules` | `POST /das/v1/tasks/cancel/{id}`, `/rerun/{id}` | `das:task:read` (ORG_ADMIN) | Filters: `taskIds`, `statuses`, `taskTypeName`, `taskName`, `endBeforeTime` (epoch seconds) |
| Certification campaign tasks | `GET /certification-tasks/v1`, `/{id}` | — | `idn:campaign:read` | Filters: `id`, `targetId`, `type` |
| Reports | `GET /reports/v1/{taskResultId}`, `/result` | `POST /reports/v1/run`, `/{id}/cancel` | `sp:report:read` | No list endpoint; you need the task result id |
| SP-Config import/export | `GET /sp-config/v1/import/{id}`, `/export/{id}` (+ `/download`) | `POST /sp-config/v1/import`, `/export` | per the spec | Async jobs; poll by id |
| Configuration Hub | `GET /configuration-hub/v1/deploys[/{id}]`, `/scheduled-actions` | `POST .../deploys`, `.../scheduled-actions` | `sp:config-deploy:read`, `sp:config-scheduled-action:read` | Backups, drafts and deploys |
| Non-employee bulk upload | `GET /non-employee-sources/v1/{id}/non-employee-bulk-upload/status` | `POST .../non-employee-bulk-upload` | per the spec | One status per source |
| Role metadata bulk updates | `GET /roles/v1/access-model-metadata/bulk-update[/id]` | `POST /roles/v1/access-model-metadata/bulk-update/{ids,filter,query}` | per the spec | The access-profile and entitlement bulk updates have **no** status endpoint |
| Scheduled searches | `GET /scheduled-searches/v1` | — | `sp:scheduled-search:manage` | |
| VA / cluster health | `GET /managed-clusters/v1`, `GET /managed-clients/v1` | — | `idn:remote-client:read` | Use to explain `TEMPERROR` |

**Implications for a unified "batch monitor" page:**

- No single endpoint covers everything. Each domain has its own id, status vocabulary and retention (most keep 90 days).
- Normalize every item to `{domain, id, name, target, status, started, finished, link}` on the client.
- Several domains can only be queried **by id** (reports, sp-config jobs, workflow executions, Config Hub deploys). The plugin should remember the ids it launches, or discover them via `task-status` and search events, rather than expecting to list them.
