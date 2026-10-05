# Local Dev Server Security Headers & CSP Reference

## How Plugin Security Headers Work

SailPoint UI Plugins execute in an `<iframe>` governed by strict `Content-Security-Policy` (CSP) and `Permissions-Policy` headers.

- **In Production**: SailPoint's Unified Micro-frontend Service (UMS) stamps these HTTP response headers onto the plugin's CDN document assets when serving them.
- **In Local Development**: The browser loads the plugin directly from your local Angular dev server (`https://localhost:4200`). Therefore, **your local dev server must emit the exact same headers** as production, or else API calls and asset downloads will be blocked by the browser.

## Source of Truth for Dev Server

The dev server reads its headers from `angular.json`:
```text
angular.json -> projects.<project-name>.architect.serve.options.headers
```

It does **not** read headers directly from `sp-ui-plugin.json`.

### Example Generated Configuration in `angular.json`

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "configurations": {
    "development": {
      "buildTarget": "shf-sample:build:development"
    },
    "production": {
      "buildTarget": "shf-sample:build:production"
    }
  },
  "defaultConfiguration": "development",
  "options": {
    "headers": {
      "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-eval'; connect-src 'self' https://<tenant>.api.cloud.sailpoint.com; style-src 'self' 'unsafe-inline'; font-src 'self' data:;",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
    }
  }
}
```

## Header Sync Lifecycle

```
[sp-ui-plugin.json]
       │
       │ sail ui-plugins push-manifest
       ▼
 [SailPoint UMS]  <-- merges your manifest policies with tenant base policies
       │
       │ sail ui-plugins link / create
       ▼
  [angular.json]  <-- populates serve.options.headers
       │
       │ ng serve --ssl (restart required if running)
       ▼
[Browser Dev Session]
```

## Common Issues & Troubleshooting

### 1. `Refused to connect to 'https://...' because it violates CSP directive`
- **Cause**: The API endpoint origin is not whitelisted in the tenant's CSP, or you called an endpoint before running `push-manifest` / `link`.
- **Solution**:
  1. Add any external API hosts to `contentSecurityPolicies["connect-src"]` in `sp-ui-plugin.json`.
  2. Run `sail ui-plugins push-manifest`.
  3. Run `sail ui-plugins link`.
  4. Restart your Angular dev server (`Ctrl+C` then `npm start`).

### 2. Dev Server Running with Stale Headers
- Angular CLI dev-server caches `headers` upon process startup.
- Changing `angular.json` while `ng serve` is active does not hot-reload HTTP response headers. Always restart the process after `link` or `create`.
