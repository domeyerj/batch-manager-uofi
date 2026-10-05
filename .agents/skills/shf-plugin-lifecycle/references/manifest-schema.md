# `sp-ui-plugin.json` Manifest Reference

The `sp-ui-plugin.json` file is the central specification contract between your UI Plugin and the SailPoint Human Fabric backend.

## File Structure

```jsonc
{
  "version": 1,
  "manifest": {
    "alias": "shf-sample",
    "name": {
      "en": "SHF Sample UI Plugin"
    },
    "description": {
      "en": "Sample SailPoint Human Fabric UI Plugin for SHF Kitchen"
    },
    "apiScopes": [
      "sp:scopes:all"
    ],
    "permissionPolicy": {},
    "iframeAllow": {},
    "contentSecurityPolicies": {},
    "state": "ENABLED",
    "slots": [
      {
        "slotId": "full-page"
      }
    ]
  },
  "build": {
    "outDir": "./dist/shf-sample/browser",
    "port": 4200
  }
}
```

## Section Definitions

### 1. Root

| Field | Type | Description |
| :--- | :--- | :--- |
| `version` | number | Manifest format version. Currently `1`. |
| `manifest` | object | Payload registered with the backend. Transmitted verbatim. |
| `build` | object | Local machine configuration for build and dev server. Never transmitted to tenant. |

---

### 2. `manifest` Object

#### `alias` (string, required)
- Format: Lowercase alphanumeric with hyphens, 3 to 63 characters (`^[a-z0-9-]{3,63}$`).
- Identifies the plugin across lifecycle environments.
- Unique within the tenant.
- Appears in local dev query params (`?spPluginDev=<alias>`) and route paths (`/ui/plugin/<alias>`).

#### `name` (object, required)
- Map of language codes to localized plugin names.
- Example: `{ "en": "Batch Operations", "es": "Operaciones por Lotes" }`.

#### `description` (object, required)
- Map of language codes to localized plugin descriptions.

#### `apiScopes` (array of strings, required)
- The OAuth scopes requested by the plugin.
- In both local development and production, the App Shell mints a bearer token for the iframe constrained exclusively to these scopes.
- If an endpoint requires `idn:identity:read` and it is missing from `apiScopes`, the call will fail with HTTP 403.
- Use `"sp:scopes:all"` during early prototyping, but prune to specific least-privilege scopes for production.

#### `slots` (array of objects, required)
- Specifies the UI extension points where the plugin renders in SailPoint Human Fabric.
- Current slot IDs:
  - `"full-page"`: Renders as a dedicated primary application page reachable via navigation.

#### `state` (string, optional)
- `"ENABLED"` or `"DISABLED"`. Controls whether the plugin is accessible to authorized tenant users.

#### `contentSecurityPolicies` (object, optional)
- Key-value mapping of CSP directives applied to the plugin iframe document by the CDN (UMS).
- Directives are merged with SailPoint's baseline platform CSP.
- Example:
  ```json
  "contentSecurityPolicies": {
    "connect-src": "'self' https://api.external-service.com"
  }
  ```

#### `permissionPolicy` (object, optional)
- Defines browser Permissions-Policy directives for the iframe document.
- Example: `{ "camera": "()", "microphone": "()" }`.

#### `iframeAllow` (object, optional)
- HTML `allow` attribute directives assigned to the `<iframe>` element by the host App Shell.

---

### 3. `build` Object (Local Only)

| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `outDir` | string | `./dist/<alias>/browser` | Path to production build artifacts uploaded by `sail ui-plugins deploy`. Must match Angular's `outputPath.browser` in `angular.json`. |
| `port` | number | `4200` | Port for the local HTTPS development server (`ng serve --ssl`). |
