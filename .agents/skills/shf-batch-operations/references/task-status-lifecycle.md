# Task Status Lifecycle Reference

The SailPoint Task Management API tracks the state of asynchronous jobs (aggregation, synchronization, indexing, batch identity updates).

## Endpoints

| Endpoint | OperationId | Description |
| :--- | :--- | :--- |
| `GET /v3/task-status` | `getTaskStatusListV1` | List background task statuses with filters and sorters. |
| `GET /v3/task-status/{id}` | `getTaskStatusV1` | Retrieve a specific task by ID. |
| `PATCH /v3/task-status/{id}` | `updateTaskStatusV1` | Clear or update pending task status. |

## Required OAuth Scopes
- Read: `idn:task-management:read`
- Write / Update: `idn:task-management:write`

---

## TaskStatus Schema Fields

```typescript
export interface TaskStatus {
  id: string;                      // Task ID (e.g., 00eebcf881994e419d72e757fd30dc0e)
  type?: string;                    // Task type (e.g., "Identity Refresh", "Account Aggregation")
  description?: string;            // Description of task
  created?: string;                // ISO timestamp of task creation
  modified?: string;               // ISO timestamp of last update
  launched?: string;               // ISO timestamp when task execution started
  completed?: string;              // ISO timestamp when task ended (null while running)
  completionStatus?: CompletionStatus; // "Success" | "Error" | "Warning" | "Terminated"
  progress?: string;               // Optional progress message or percentage
  percentComplete?: number;        // Completion percentage (0 - 100)
  attributes?: Record<string, any>;// Type-specific metadata (e.g. processedCount, errorCount)
  messages?: TaskMessage[];        // Array of informational or error messages
  returns?: TaskReturnDetails[];   // Return parameters and statistics
}
```

---

## Task Completion States

- **In Progress**: `completed` is `null` or undefined, and `completionStatus` is `null`.
- **Success**: `completionStatus === 'Success'`. All operations in the task finished cleanly.
- **Warning**: `completionStatus === 'Warning'`. Completed with non-fatal errors or partial skips. Check `messages` for details.
- **Error**: `completionStatus === 'Error'`. Job failed. Check `attributes.errors` or `messages` for root causes.
- **Terminated**: `completionStatus === 'Terminated'`. The task was aborted by an administrator.

---

## Polling Strategy Guidelines

1. **Backoff Intervals**:
   - Start polling every 1–2 seconds for the first 10 seconds.
   - Decay to every 5 seconds for minutes 1–5.
   - Cap at 10–15 second intervals for tasks running longer than 5 minutes.
2. **Timeout Safety**:
   - Always set an absolute maximum polling timeout (e.g., 10 minutes) so the UI does not spin indefinitely if a task hangs.
