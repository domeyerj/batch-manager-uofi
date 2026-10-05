# Batch Manager UofI (`batch-manager-uofi`)

A **SailPoint UI Plugin** (micro-frontend) for Identity Security Cloud (ISC / SHF) designed to monitor, orchestrate, and audit batch jobs, source account/entitlement aggregations, and automated schedules directly inside the SailPoint App Shell.

## Key Features

- **Task Execution Monitor (`/tasks`)**:
  - Live polling of running background tasks via `TaskManagementService` (`GET /task-status/v1?filters=completionStatus isnull`).
  - Real-time progress bars (`percentComplete`), status labels, and target metadata.
  - Abort/clear hung or runaway tasks via RFC 6902 JSONPatch (`PATCH /task-status/v1/{id}`).
  - 90-day task history table with status filtering (`SUCCESS`, `WARNING`, `ERROR`, `TERMINATED`, `TEMPERROR`).
  - Diagnostic dialog displaying execution metrics and diagnostic messages.
- **On-Demand Task Orchestrator (`/launch`)**:
  - Source application picker with connector details.
  - Full vs. Optimized aggregation toggle (`disableOptimization: true`).
  - One-click trigger for Account Aggregation and Entitlement Aggregation.
- **Schedules & Automation Forecast (`/schedules`)**:
  - Quartz cron schedule inspector for sources (`ACCOUNT_AGGREGATION`, `GROUP_AGGREGATION`).
  - Human-friendly cron translations.
  - Tenant-level scheduled searches and recurring audit reports.
- **Infrastructure & VA Gateways (`/infrastructure`)**:
  - Virtual Appliance Managed Cluster health monitor for diagnosing `TEMPERROR` connector errors.

## Commands

```bash
npm start        # Dev server over HTTPS (ng serve --ssl) on port 4200 — for local in-tenant linking
npm run build    # Production build to dist/batch-manager-uofi/browser
npm test         # Unit tests with Vitest (ng test --watch=false)
```

## In-Tenant Linking & Deployment

See [`../instructions.md`](../instructions.md) for step-by-step instructions:
1. `sail ui-plugins create` (register plugin instance in tenant)
2. `sail ui-plugins link` (bind local port 4200 for live in-tenant testing)
3. `sail ui-plugins upload` (deploy production build to SailPoint CDN)
