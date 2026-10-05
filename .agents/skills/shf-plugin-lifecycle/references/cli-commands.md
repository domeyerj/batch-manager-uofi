# SailPoint CLI UI Plugins Commands Reference

The SailPoint CLI (`sail ui-plugins`) orchestrates registration, linking, manifest synchronization, and deployment of UI Plugins in SailPoint Human Fabric.

## Command Matrix

| Command | Purpose | When to run |
| :--- | :--- | :--- |
| `sail ui-plugins init` | Generates initial template and `sp-ui-plugin.json` in the current workspace. | Once when starting a brand new plugin project. |
| `sail ui-plugins create` | Registers the plugin manifest with the active tenant. Writes initial security headers to `angular.json`. | Once per tenant environment after editing initial manifest. |
| `sail ui-plugins link` | Links your running local dev server (`localhost:<port>`) to your identity session. Refreshes `angular.json` headers. | Whenever starting local in-tenant development or after changing scopes/policies. |
| `sail ui-plugins push-manifest`<br>*(alias: `update`)* | Sends updated `manifest` fields from `sp-ui-plugin.json` to the tenant. | Whenever adding new `apiScopes`, modifying name/description, or changing security directives. |
| `sail ui-plugins build` | Invokes the project's build command (`npm run build`). | Pre-deployment step. |
| `sail ui-plugins deploy` | Compiles (if needed) and uploads the contents of `build.outDir` to the immutable SailPoint CDN. | When releasing a plugin version to the tenant. |
| `sail ui-plugins list` | Lists all registered UI plugins in the active tenant. | Auditing installed plugins. |
| `sail ui-plugins delete` | Removes the plugin registration from the active tenant. | Teardown or decommissioning. |

---

## Detailed Command Usage

### 1. `sail ui-plugins create`
Registers the plugin defined in `sp-ui-plugin.json`.
- Validates the JSON schema.
- Assigns the alias to the tenant.
- Fetches effective security headers from UMS and injects them into `angular.json` under `serve.options.headers`.

### 2. `sail ui-plugins link`
Establishes a local developer link:
- Binds your local server port (default: 4200) to the active developer session.
- Emits a URL formatted as:
  ```text
  https://<org>.identitynow.com/ui/d/home?spPluginDev=<alias>
  ```
- Refreshes `angular.json` headers if backend policies changed.
- Requires dev server restart if headers were updated.

### 3. `sail ui-plugins push-manifest`
Updates backend tenant settings with the local manifest:
- Run this after changing `apiScopes`, `slots`, or security policies.
- Run `sail ui-plugins link` immediately following to synchronize headers down into `angular.json`.

### 4. `sail ui-plugins deploy`
Deploys production bundle:
- Packages `build.outDir` (e.g., `./dist/shf-sample/browser`).
- Uploads assets to the tenant's CDN distribution.
- Once deployed, the plugin is served live in the tenant without needing `?spPluginDev=<alias>`.
