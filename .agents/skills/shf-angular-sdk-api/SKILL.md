---
name: shf-angular-sdk-api
description: >-
  Use this skill when integrating SailPoint Human Fabric (SHF) / Identity Security Cloud APIs into Angular UI Plugins using
  @sailpoint/angular-sdk, SailpointPluginService, or OpenAPI specifications. Covers finding endpoints and required OAuth scopes in
  api-specs, declaring scopes in sp-ui-plugin.json, consuming typed partition services, handling Observables and Promises, using
  generic get/post methods, handling ApiError, subscribing to SDK events, and orchestrating Workflows and Launchers with Launchpad deep linking.
---

# SailPoint Human Fabric (SHF) Angular SDK & API Integration

This skill provides step-by-step procedures and best practices for interacting with SailPoint APIs in an Angular UI Plugin.

## Architecture Overview

API communication in SailPoint UI plugins uses a dual-layer approach:
1. **`SailpointPluginService` (`@core`)**: Owns the singleton instance of `@sailpoint/ui-plugin-sdk`, performs the COIP handshake, survives HMR, and provides reactive context signals (`tenant`, `user`, `status`, `apiReady`) and lightweight HTTP helpers (`get<T>()`, `post<T>()`).
2. **`@sailpoint/angular-sdk`**: Generated Angular client libraries partitioned by API area (e.g. `@sailpoint/angular-sdk/identities`, `@sailpoint/angular-sdk/accounts`, `@sailpoint/angular-sdk/launchers`). Initialized globally by `provideSailPoint()` in `app.config.ts`, which attaches an HTTP interceptor that reads `window.sailpointConfig()` minted by the host App Shell.

---

## Standard API Integration Workflow

Follow these steps whenever adding a new API call to the plugin:

### Step 1: Discover Endpoint & Scopes in OpenAPI Specifications

SailPoint's complete OpenAPI specifications are located at:
`c:\storage\projects\sailpoint\api-specs\idn\apis\<domain>/`

1. Open the relevant domain folder (e.g. `identities`, `accounts`, `launchers`, `task-management`, `roles`).
2. Locate the path YAML file under `paths/` (e.g. `paths/identities-v1.yaml`).
3. Inspect `operationId` to identify the corresponding SDK method name (e.g., `operationId: listIdentitiesV1` maps to `identitiesService.listIdentitiesV1(...)`).
4. Inspect `security.userAuth` to find the required OAuth scopes:
   ```yaml
   security:
     - userAuth:
       - idn:identity:read
       - idn:identity:manage
   ```

Refer to [OpenAPI Specs Reference](references/openapi-lookup.md) for more details.

---

### Step 2: Declare Scopes in `sp-ui-plugin.json`

Add the required scopes to `manifest.apiScopes` in `sp-ui-plugin.json`:

```json
"apiScopes": [
  "idn:identity:read",
  "idn:task-management:read"
]
```

> [!WARNING]
> Because local development runs with a real scoped token issued by your tenant, missing scopes fail immediately in both local development and production.

If you have already registered the plugin with `sail ui-plugins create`, synchronize the updated scopes:
```bash
sail ui-plugins push-manifest
sail ui-plugins link
```

---

### Step 3: Inject and Use SDK Partition Services

Each API area provides an independent partition service.

1. **Import the Service and Types**:
   ```ts
   import { IdentitiesService, type Identity } from '@sailpoint/angular-sdk/identities';
   ```

2. **Declare in Component Providers**:
   In Angular standalone components, list the service in `providers`:
   ```ts
   @Component({
     selector: 'app-identity-list',
     imports: [CommonModule],
     providers: [IdentitiesService],
     templateUrl: './identity-list.component.html'
   })
   export class IdentityListComponent {
     private readonly identitiesSvc = inject(IdentitiesService);
   }
   ```

3. **Choose Reactive (Observable) or Imperative (Promise) Style**:

#### Observable Style (Recommended for Template Binding)
```ts
protected readonly identities$ = this.identitiesSvc
  .listIdentitiesV1({ limit: 10, sorters: 'name' })
  .pipe(
    catchError((err) => {
      this.error.set(err.message);
      return EMPTY;
    })
  );
```
In template:
```html
@if (identities$ | async; as list) {
  <ul>
    @for (item of list; track item.id) {
      <li>{{ item.name }} ({{ item.email }})</li>
    }
  </ul>
}
```

#### Promise Style (Recommended for Event Handlers / Multi-Step Logic)
```ts
import { firstValueFrom } from 'rxjs';

async loadTenantInfo(): Promise<void> {
  try {
    const tenant = await firstValueFrom(this.tenantSvc.getTenantV1());
    this.tenantData.set(tenant);
  } catch (err) {
    this.errorMessage.set(String(err));
  }
}
```

---

### Step 4: Generic Calls with `SailpointPluginService`

For beta endpoints, custom endpoints, or raw payloads where typed SDK services are not yet available, use `SailpointPluginService.get()` and `post()`:

```ts
import { inject } from '@angular/core';
import { SailpointPluginService } from '@core';

export class CustomComponent {
  private readonly plugin = inject(SailpointPluginService);

  async fetchAssignedLaunchers(): Promise<any[]> {
    // Relative path only; token & base URL are injected automatically
    const res = await this.plugin.get<{ items: any[] }>('/beta/launchers/my/assigned?limit=50');
    return res.items ?? [];
  }
}
```

---

### Step 5: Handling API Errors (`ApiError`)

Calls made through `plugin.get()`, `plugin.post()`, or SDK methods can throw `ApiError` from `@sailpoint/ui-plugin-sdk`:

```ts
import { ApiError } from '@sailpoint/ui-plugin-sdk';

try {
  await this.plugin.get('/v3/accounts/missing');
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`HTTP ${error.status} on ${error.path}:`, error.body);
    if (error.status === 403) {
      this.errorMessage.set('Permission denied: Missing OAuth scope in manifest.');
    } else if (error.status === 429) {
      this.errorMessage.set('Rate limit exceeded. Retrying shortly...');
    }
  }
}
```

---

### Step 6: Subscribing to SDK Events (`events`)

`SailpointPluginService.sdk.events` exposes subscriptions to App Shell lifecycle events:

```ts
// Viewport resize (e.g. responsive canvas / graphs)
const unsubViewport = this.plugin.sdk.events.onViewportChange(({ width, height }) => {
  console.log(`Host viewport resized to ${width}x${height}`);
});

// Scoped token refresh
const unsubToken = this.plugin.sdk.events.onTokenUpdate((newToken) => {
  console.log('App Shell refreshed scoped token');
});

// Call unsub when component destroys:
destroyRef.onDestroy(() => {
  unsubViewport();
  unsubToken();
});
```

---

### Step 7: Calling Custom Backend Services (`shf-kitchen-resource-server`)

To call custom backend APIs hosted by `shf-kitchen-resource-server` from the UI plugin:

1. Obtain the scoped bearer token from the SDK:
   ```ts
   const token = await this.plugin.sdk.api.getToken();
   ```
2. Make HTTP request to backend endpoint with `Authorization: Bearer <token>`:
   ```ts
   const response = await fetch('https://api.domeyer.io/api/custom-endpoint', {
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json'
     }
   });
   ```
3. Ensure the backend URL is allowed by the plugin's Content Security Policy:
   Add `'https://api.domeyer.io'` to `manifest.contentSecurityPolicies.connect-src` in `sp-ui-plugin.json`.

---

### Step 8: Invoking Workflows & Linking to Launchpad

1. **Start a Launcher**:
   ```ts
   const result = await this.plugin.post<{ interactiveProcessId?: string }>(
     `/beta/launchers/${encodeURIComponent(launcherId)}/launch`,
     {}
   );
   ```

2. **Deep Link to Launchpad for Interactive Forms**:
   Because plugins run inside an iframe, interactive workflow forms must be completed in the host Launchpad:
   ```ts
   const origin = new URL(this.plugin.context()?.page.route ?? '').origin;
   const launchpadUrl = `${origin}/ui/d/launchpad/interactive-processes/${encodeURIComponent(result.interactiveProcessId)}`;
   ```

Refer to [Workflow Launchers Guide](references/workflow-launchers.md) for full interactive process implementation.

---

## Detailed References

- [OpenAPI Lookup & Mapping Guide](references/openapi-lookup.md)
- [SDK Partition Services Catalog](references/sdk-services.md)
- [Workflow Launchers & Launchpad Guide](references/workflow-launchers.md)
