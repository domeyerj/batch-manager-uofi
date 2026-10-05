---
name: shf-resource-server-integration
description: >-
  Use this skill when connecting SailPoint Human Fabric (SHF) UI Plugins to shf-kitchen-resource-server
  (https://kitchen-api.domeyer.io, local http://localhost:8543). Covers token pass-through via the plugin SDK,
  trusted-issuer approval (ACTIVE in Trusted Issuers), authorities (CALLER_SHF, TENANT_<org>, SHF_<authority>),
  the route authorization matrix, CORS (runtime setting kitchen.cors.allowed-origins) and CSP connect-src in sp-ui-plugin.json.
---

# SailPoint Human Fabric (SHF) UI Plugin Backend Integration

This skill guides the end-to-end integration between a SailPoint Human Fabric UI Plugin (`shf-sample`) and a Spring Boot OAuth2 Resource Server (`shf-kitchen-resource-server`).

---

## 1. Architectural Model: Token Pass-Through

The UI plugin does not maintain separate user credentials or sessions with the backend. Instead, it rides the tenant's security model:

```
┌─────────────────────────────────┐
│     SailPoint App Shell         │
│  (Holds active tenant session)  │
└────────────────┬────────────────┘
                 │ COIP Handshake / Scoped JWT
                 ▼
┌─────────────────────────────────┐
│     SHF UI Plugin (Iframe)      │
│  sdk.api.getToken()             │
└────────────────┬────────────────┘
                 │ Authorization: Bearer <scoped-token>
                 ▼
┌─────────────────────────────────┐
│  shf-kitchen-resource-server    │
│  DynamicJwtDecoder: issuer must │
│  be ACTIVE in TRUSTED_ISSUER_T  │
└─────────────────────────────────┘
```

| Environment | Resource server base URL |
| :--- | :--- |
| Production | `https://kitchen-api.domeyer.io` (TLS terminated by the reverse proxy) |
| Local dev | `http://localhost:8543` (container/IDE serves plain HTTP) |

All endpoints live under `/api`, e.g. `GET /api/v1/resource-info`.

---

## 2. UI Plugin Configuration

### Step A: Declare Backend Origin in CSP (`sp-ui-plugin.json`)

To allow HTTP calls from the iframe to the resource server, add the backend URL to `manifest.contentSecurityPolicies.connect-src`:

```json
{
  "version": 1,
  "manifest": {
    "alias": "shf-sample",
    "contentSecurityPolicies": {
      "connect-src": [
        "'self'",
        "https://kitchen-api.domeyer.io",
        "http://localhost:8543"
      ]
    }
  }
}
```

> [!IMPORTANT]
> After updating `sp-ui-plugin.json`, run:
> ```bash
> sail ui-plugins push-manifest
> sail ui-plugins link
> ```
> This informs the SailPoint UMS and syncs the CSP into `angular.json` dev server headers.

### Step A2: Allow the Plugin Origin (CORS) and Trust the Tenant Issuer

Both are done by a Kitchen admin in the Vaadin console, not in the plugin:
1. **CORS:** add the plugin's origin to the runtime setting `kitchen.cors.allowed-origins`
   (Administration → Configuration; takes effect within seconds, no restart). It is not an environment variable.
   `https://localhost:4200` is in the default list for local dev.
2. **Trusted issuer:** the tenant's token issuer must be `ACTIVE` in Administration → Trusted Issuers. The first
   token from an unknown issuer auto-registers it as `PENDING` and is rejected (401) until an admin approves it.

---

### Step B: Create an Angular Backend Client Service

Create an Angular service that retrieves the scoped JWT and calls the resource server:

```ts
import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { SailpointPluginService } from '@core';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class KitchenBackendService {
  private readonly http = inject(HttpClient);
  private readonly plugin = inject(SailpointPluginService);

  // Keep configurable; production https://kitchen-api.domeyer.io/api, local dev http://localhost:8543/api
  private readonly backendBaseUrl = 'https://kitchen-api.domeyer.io/api';

  async getResourceInfo(): Promise<any> {
    // 1. Retrieve the user's current SailPoint token from the plugin SDK
    //    (verify the exact call against the installed @sailpoint/ui-plugin-sdk version)
    const token = await this.plugin.sdk.api.getToken();

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    // 2. Dispatch request to shf-kitchen-resource-server
    return firstValueFrom(
      this.http.get<any>(`${this.backendBaseUrl}/v1/resource-info`, { headers })
    );
  }
}
```

---

## 3. Backend Verification (`shf-kitchen-resource-server`)

Read the live code and the root rule [`api-security-jwt.md`](../../../../../.agents/rules/api-security-jwt.md) before relying on details.

1. **`DynamicJwtDecoder`**:
   - Reads the unverified `iss` (or, for tokens without `iss`, the `org` claim) and accepts only issuers that are
     `ACTIVE` in `TRUSTED_ISSUER_T`. Unknown https issuers are auto-registered `PENDING` (max 25) and rejected.
   - Verifies the signature with the JWKS URI stored on the issuer row (never from the token), timestamps
     (60 s skew), and — when the issuer has `EXPECTED_ORG` — that the token's `org` matches.

2. **`ShfJwtAuthenticationConverter`** — a SailPoint token (`org` claim) gets:
   - `CALLER_SHF`
   - `TENANT_<org>`
   - `SHF_<authority>` for each entry of the `authorities` claim (e.g. `SHF_ORG_ADMIN`)
   - `SCOPE_<scope>` for `scope`/`scp` values. No claim ever becomes a `ROLE_*` authority.

3. **Authorization matrix (`SecurityConfig` + `TenantAccessGuard`)**:

   | Path | Plugin user (`CALLER_SHF`) |
   | :--- | :--- |
   | `GET /api/v1/resource-info` | allowed (any authenticated caller) |
   | `GET /api/v1/tenants/{tenantId}/batch-jobs/**` | allowed if the tenant's org (first DNS label of its `TENANT_URL`, or its name) equals the token's `org` |
   | `POST /api/v1/tenants/{tenantId}/batch-jobs/refresh`, `/sync-active`, `/trigger` | as above **and** `SHF_ORG_ADMIN` |
   | everything else under `/api/**` | denied (Kitchen admins only, `ROLE_KITCHEN_ADMIN`) |
   | `/v3/api-docs/**`, `/api/api-doc/**`, `/actuator/health/**` | public |

   New plugin-facing routes need an explicit matcher in `SecurityConfig` (skill `shf-kitchen-jwt-trust` in
   `shf-kitchen-resource-server`); there is no blanket `authenticated()` or `permitAll()` for `/api/**`.

---

## 4. Local Development Cross-Origin Considerations

During local development:
- Plugin runs on `https://localhost:4200`.
- Resource Server runs on `http://localhost:8543` (plain HTTP).
- `https://localhost:4200` must be listed in the runtime setting `kitchen.cors.allowed-origins` (it is in the default);
  the deployed plugin's origin must be added there as well.
