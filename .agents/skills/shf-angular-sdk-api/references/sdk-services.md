# SailPoint Angular SDK Services Catalog

The `@sailpoint/angular-sdk` library provides partitioned Angular services for each API area.

## Core Setup in `app.config.ts`

Ensure `provideSailPoint()` is added to `ApplicationConfig.providers`:
```ts
import { provideSailPoint } from '@sailpoint/angular-sdk';

export const appConfig: ApplicationConfig = {
  providers: [
    // Registers HttpClient and the token/config interceptor
    provideSailPoint(),
    // ...
  ]
};
```

---

## Commonly Used Partition Services

| API Domain | Import Path | Primary Service Class | Typical Use Cases |
| :--- | :--- | :--- | :--- |
| **Identities** | `@sailpoint/angular-sdk/identities` | `IdentitiesService` | Query identities, list attributes, trigger identity processing. |
| **Accounts** | `@sailpoint/angular-sdk/accounts` | `AccountsService` | Retrieve source accounts, entitlements, status. |
| **Launchers** | `@sailpoint/angular-sdk/launchers` | `LaunchersService` | Query tenant workflow launchers. |
| **Workflows** | `@sailpoint/angular-sdk/workflows` | `WorkflowsService` | Inspect workflow definitions and execution runs. |
| **Task Management** | `@sailpoint/angular-sdk/task_management` | `TaskManagementService` | Monitor background aggregations, batch jobs, and sync status. |
| **Tenant** | `@sailpoint/angular-sdk/tenant` | `TenantService` | Retrieve tenant details and flags. |
| **Roles** | `@sailpoint/angular-sdk/roles` | `RolesService` | List and inspect access roles and memberships. |
| **Access Profiles** | `@sailpoint/angular-sdk/access_profiles` | `AccessProfilesService` | Query access profiles and associated entitlements. |
| **Entitlements** | `@sailpoint/angular-sdk/entitlements` | `EntitlementsService` | Query application entitlements. |
| **Sources** | `@sailpoint/angular-sdk/sources` | `SourcesService` | Query configured HR sources, directories, cloud targets. |
| **Search** | `@sailpoint/angular-sdk/search` | `SearchService` | Execute Elasticsearch-backed queries across identities, roles, events. |
| **Certifications** | `@sailpoint/angular-sdk/certifications` | `CertificationsService` | Review campaigns, decisions, and sign-offs. |

---

## Service Usage Pattern

Always register the partition service in the component's `providers` array:

```ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IdentitiesService, type Identity } from '@sailpoint/angular-sdk/identities';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule],
  providers: [IdentitiesService],
  template: `
    @for (user of users(); track user.id) {
      <div>{{ user.name }} ({{ user.email }})</div>
    }
  `
})
export class UsersComponent {
  private readonly identitiesSvc = inject(IdentitiesService);
  protected readonly users = signal<Identity[]>([]);

  async loadUsers(): Promise<void> {
    const list = await firstValueFrom(
      this.identitiesSvc.listIdentitiesV1({
        limit: 20,
        filters: 'correlated eq true'
      })
    );
    this.users.set(list);
  }
}
```
