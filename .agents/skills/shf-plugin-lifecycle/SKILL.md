---
name: shf-plugin-lifecycle
description: >-
  Use this skill when managing the lifecycle of a SailPoint Human Fabric (SHF) / Identity Security Cloud (ISC) UI Plugin (pro-code).
  Covers configuring the sp-ui-plugin.json manifest, running SailPoint CLI (sail ui-plugins) commands, local development with HTTPS and
  the COIP handshake (?spPluginDev=<alias>), synchronizing CSP and Permissions-Policy headers in angular.json, and generating CDN-safe production builds.
---

# SailPoint Human Fabric (SHF) UI Plugin Lifecycle

This skill guides the end-to-end lifecycle of a pro-code UI Plugin for SailPoint Human Fabric (formerly Identity Security Cloud). UI plugins run as sandboxed micro-frontends loaded inside an iframe in the SHF App Shell.

## Key Architectural Principles

1. **Sandboxed Iframe Isolation**: The plugin executes inside a sandboxed iframe. It has no direct access to the host DOM, host cookies, or host window object. All host communication occurs via `@sailpoint/ui-plugin-sdk` over a cross-origin postMessage (COIP) handshake.
2. **Strict Scoped Tokens**: Backend API calls made by the plugin use an OAuth bearer token scoped strictly to the `apiScopes` declared in `sp-ui-plugin.json`. Calls to undeclared scopes fail immediately in both local development and production.
3. **Immutable CDN Hosting**: Production assets are hosted on a SailPoint CDN (managed by UMS). All asset paths must be strictly relative (`./`), never root-absolute (`/`).
4. **Manifest as Contract**: `sp-ui-plugin.json` is the contract with the backend for identity, permissions, and security headers.

---

## Lifecycle Procedures

### 1. Configuring `sp-ui-plugin.json`

The manifest file defines the plugin's metadata, permissions, and slots.

```json
{
  "version": 1,
  "manifest": {
    "alias": "shf-sample",
    "name": { "en": "SHF Sample UI Plugin" },
    "description": { "en": "Sample SailPoint Human Fabric UI Plugin for SHF Kitchen" },
    "apiScopes": ["sp:scopes:all"],
    "permissionPolicy": {},
    "iframeAllow": {},
    "contentSecurityPolicies": {},
    "state": "ENABLED",
    "slots": [
      { "slotId": "full-page" }
    ]
  },
  "build": {
    "outDir": "./dist/shf-sample/browser",
    "port": 4200
  }
}
```

- **`alias`**: Unique, lowercase, hyphenated slug (3–63 chars) that is environment-independent. The same alias is registered across dev/staging/prod tenants.
- **`apiScopes`**: Explicit list of required SailPoint OAuth scopes. Check OpenAPI specs (`api-specs/idn/apis`) before adding API calls.
- **`build`**: Local-only configuration. `outDir` must match the output folder configured in `angular.json`.

Refer to [Manifest Schema Reference](references/manifest-schema.md) for full details on security directives.

---

### 2. Local In-Tenant Development Loop

Local development connects your local Angular server directly into a live SailPoint tenant session:

1. **Start the Angular HTTPS Dev Server**:
   ```bash
   npm start
   ```
   *Note: Plugins must be served over HTTPS (`ng serve --ssl`) on the configured port (default: 4200).*

2. **Register & Link with the SailPoint CLI**:
   - If registering the plugin for the first time in the tenant:
     ```bash
     sail ui-plugins create
     ```
   - Link your local server to your identity session:
     ```bash
     sail ui-plugins link
     ```
   The CLI outputs a developer URL with query parameter `?spPluginDev=<alias>`.

3. **Open the Developer URL in your Browser**:
   Open `https://<your-org>.identitynow.com/ui/d/home?spPluginDev=<alias>` in your browser. The App Shell will load your local code with a "Local Dev" badge, completing the real COIP handshake with live scoped tokens.

4. **Security Headers Synchronization**:
   `sail ui-plugins create` and `sail ui-plugins link` write tenant-specific CSP and Permissions-Policy headers into `angular.json` under `projects.<plugin>.architect.serve.options.headers`.
   > [!IMPORTANT]
   > If the dev server is already running when `create` or `link` updates `angular.json`, **restart the dev server** (`npm start`) so the new headers take effect.

Refer to [Dev Server Headers Guide](references/dev-server-headers.md) for CSP troubleshooting.

---

### 3. Updating Manifest and Scopes

When adding new API calls or changing security policies:

1. Edit `sp-ui-plugin.json` to add required scopes or headers.
2. Push the manifest to your tenant:
   ```bash
   sail ui-plugins push-manifest
   ```
   *(or alias: `sail ui-plugins update`)*
3. Refresh dev headers:
   ```bash
   sail ui-plugins link
   ```
4. Restart your Angular dev server (`npm start`).

---

### 4. Building for Production

Compile production assets with the Angular CLI:

```bash
npm run build
```

Verify CDN compatibility:
- Check `angular.json` to ensure `baseHref: "./"` and `deployUrl: "./"`.
- Verify generated `dist/<plugin>/browser/index.html` uses relative script/style tags (e.g. `<script src="main.js">` or `<script src="./main.js">`, NOT `<script src="/main.js">`).

---

### 5. Deploying to SailPoint Human Fabric

Upload the compiled bundle to the CDN and deploy:

```bash
sail ui-plugins deploy
```

The SailPoint CLI bundles the files in `build.outDir` and uploads them immutably. The deployment targets the plugin instance bound to `alias` in the CLI's current active tenant context.

---

## Detailed References

- [Manifest Schema Reference](references/manifest-schema.md)
- [SailPoint CLI Commands Reference](references/cli-commands.md)
- [Dev Server Headers & CSP Reference](references/dev-server-headers.md)
