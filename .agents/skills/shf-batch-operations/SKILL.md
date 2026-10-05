---
name: shf-batch-operations
description: >-
  Use this skill when designing, implementing, or debugging batch operations, bulk identity/account actions, asynchronous task tracking,
  or long-running background jobs in SailPoint Human Fabric (SHF) / Identity Security Cloud. Covers batch identity processing, account aggregations,
  task status polling with TaskManagementService, 429 rate limit backoff strategies, and responsive UI progress indicators.
---

# SailPoint Human Fabric (SHF) Batch Operations & Task Management

This skill provides patterns, workflows, and procedures for executing bulk operations, long-running jobs, and asynchronous background tasks in SailPoint Human Fabric (SHF) UI Plugins.

## The Batch Processing Model in SailPoint

In SailPoint Human Fabric:
1. **Asynchronous Task Architecture**: Large operations (identity processing, attribute synchronization, source account aggregations) do not run synchronously in the HTTP request. Instead, the API initiates a background job and returns a `TaskResultResponse` containing a task ID (`id`).
2. **Task Polling**: The plugin tracks job progress by polling `/v3/task-status/{id}` via `TaskManagementService`.
3. **API Rate Limiting**: The platform enforces concurrency and rate limits. Bursts of requests will return HTTP `429 Too Many Requests` with a `Retry-After` header. Plugins performing batch actions must handle chunking, throttling, and backoff.

---

## Core Batch Workflows

### 1. Initiating Background Tasks

#### Example: Process Identities Batch
To initiate processing for specific identities:
- **API Endpoint**: `POST /v1/identities/process` (see `api-specs/idn/apis/identities/paths/identities-v1-process.yaml`)
- **Required Scope**: `idn:identity:manage`
- **Payload**:
  ```json
  {
    "identityIds": ["2c91808470a266a60170a2779fcb0001", "2c91808470a266a60170a2779fcb0002"],
    "sendNotification": false
  }
  ```
- **Response**: Returns a `TaskResultResponse` with `id: string` (e.g. `00eebcf881994e419d72e757fd30dc0e`).

---

### 2. Monitoring Task Status (`TaskManagementService`)

Use `TaskManagementService` from `@sailpoint/angular-sdk/task_management`:

```ts
import { Component, inject, signal } from '@angular/core';
import { TaskManagementService, type TaskStatus } from '@sailpoint/angular-sdk/task_management';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-batch-tracker',
  providers: [TaskManagementService],
  templateUrl: './batch-tracker.component.html'
})
export class BatchTrackerComponent {
  private readonly taskSvc = inject(TaskManagementService);

  protected readonly taskStatus = signal<TaskStatus | null>(null);
  protected readonly isPolling = signal(false);

  async pollTaskUntilComplete(taskId: string, maxAttempts = 30, intervalMs = 2000): Promise<TaskStatus> {
    this.isPolling.set(true);

    try {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const status = await firstValueFrom(
          this.taskSvc.getTaskStatusV1({ id: taskId })
        );

        this.taskStatus.set(status);

        // Completion status: Success, Error, Terminated
        if (status.completed || status.completionStatus) {
          return status;
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
      throw new Error(`Task ${taskId} timed out after ${maxAttempts * intervalMs / 1000}s`);
    } finally {
      this.isPolling.set(false);
    }
  }
}
```

Refer to [Task Status Lifecycle Reference](references/task-status-lifecycle.md).

---

### 3. Handling Rate Limits & Throttling (HTTP 429)

When iterating over hundreds of identities or accounts:
- **Chunking**: Break lists into batches of 25–50 items.
- **Concurrency Control**: Do not launch all promises with `Promise.all()`. Limit concurrent requests (e.g. 3–5 concurrent requests).
- **Exponential Backoff**: Catch `HttpErrorResponse` with status 429 and retry after `Retry-After` seconds (or exponential delay `2^attempt * 500ms`).

Refer to [Bulk Patterns & Concurrency Control](references/bulk-patterns.md).

---

### 4. UI Progress & Feedback Patterns

When executing batch operations:
- Use PrimeNG's `p-progressBar` for active percentages or indeterminate modes.
- Display a real-time log or status table (`p-table`) showing each item's individual progress (`Pending`, `In Progress`, `Completed`, `Failed`).
- Allow the user to cancel or pause batch processing where possible.

---

## Detailed References

- [Task Status Lifecycle Reference](references/task-status-lifecycle.md)
- [Bulk Patterns & Concurrency Control](references/bulk-patterns.md)
