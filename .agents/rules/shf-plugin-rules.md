# SailPoint Human Fabric (SHF) UI Plugin Coding Rules

These rules apply to all development within the sample UI Plugin (`ui-plugins/sample`, alias: `shf-sample`) in the `shf-kitchen` ecosystem.

---

## 1. Sandboxed Iframe Isolation
- The plugin executes inside a sandboxed `<iframe>` managed by the SailPoint App Shell.
- **NEVER** attempt direct DOM manipulation of the host, reading host cookies, or accessing `window.parent` directly.
- **ALWAYS** communicate with the host via `SailpointPluginService` (`@core`) and `@sailpoint/ui-plugin-sdk`.
- Components must read context from reactive signals (`plugin.context`, `plugin.status`, `plugin.tenant`, `plugin.user`), never by calling `whenReady()` (which is reserved for `app.config.ts` bootstrap gating).

## 2. API Scopes Discipline
- SailPoint backend APIs strictly validate scopes against the scoped bearer token minted by the App Shell.
- An endpoint called without its required scope declared in `sp-ui-plugin.json` (`manifest.apiScopes`) will fail with HTTP 403 in both local development and production.
- **BEFORE** introducing any new API call, inspect the corresponding OpenAPI spec in `c:\storage\projects\sailpoint\api-specs\idn\apis` to determine the required `security.userAuth` scope, and ensure it is declared in `manifest.apiScopes`.
- After updating scopes, run `sail ui-plugins push-manifest` followed by `sail ui-plugins link`.
- **Accepted exception:** `sp-ui-plugin.json` requests the wildcard scope `sp:scopes:all` — accepted for this sample by the developer (2026-10-04); real/production plugins must still list only the scopes they use (agent-safety ASI03).

## 3. CDN Relative Asset Paths
- Production assets are deployed immutably to a SailPoint CDN.
- **NEVER** use root-absolute paths (`/assets/...`, `/main.js`) in code, templates, styles, or build config.
- `angular.json` must retain `baseHref: "./"` and `deployUrl: "./"`.
- Relative URLs (`./assets/...`, `favicon.ico`) must be used for images, fonts, and stylesheets.

## 4. Routing Architecture
- Must use Angular hash location routing (`withHashLocation()`).
- On initial navigation, honor deep-linked `context().page.subPath` derived by the SDK from `/ui/plugin/{alias}/{subPath}`.
- On subsequent `NavigationEnd` events, report subpaths to the host via `plugin.setRoute(hashPath)` so the parent browser URL mirrors internal navigation.

## 5. UI Theming & PrimeNG
- Use PrimeNG components configured with the SailPoint Design System (SPDS) preset in `@core/spds-prime-theme.ts`.
- Use SPDS typography utilities (`.spds-h1` through `.spds-h6`, `.spds-h1--semibold` through `.spds-h6--semibold`) rather than arbitrary font styles.
- Do not introduce competing CSS frameworks (Bootstrap, Tailwind) or hardcoded color palettes that clash with SPDS tokens.

## 6. Internationalization (i18n)
- Every user-facing label or text snippet must be defined in `public/i18n/en.json` (and localized catalogs).
- Bind templates using the `translate` pipe (`{{ 'key.path' | translate }}`) or `[innerHTML]="'key.path' | translate"` for strings containing markup.
- Never hardcode raw strings in component templates.

## 7. Testing & Mocking Standards
- Unit tests run under Vitest with jsdom (`npm test`).
- Components using `TranslatePipe` must supply `provideTranslateService()` and load test translations in `TestBed.configureTestingModule()`.
- jsdom lacks `ResizeObserver` and `window.matchMedia`; maintain their mocks in `src/test-setup.ts`.
- For SDK testing, either mock `SailpointPluginService` or use the official `@sailpoint/ui-plugin-sdk/testing` module (`mockSdkContext`).

## 8. Backend Resource Server Integration (`shf-kitchen-resource-server`)
- When communicating with backend microservices in `shf-kitchen`:
  - Base URL: `https://kitchen-api.domeyer.io` (local dev `http://localhost:8543`); endpoints under `/api/v1/...`. Keep it configurable.
  - Pass the user's SailPoint token from the plugin SDK as `Authorization: Bearer <token>` (e.g. `plugin.sdk.api.getToken()`; verify against the installed SDK version).
  - The resource server accepts it only if the tenant's issuer is `ACTIVE` in Vaadin → Administration → Trusted Issuers (first-seen issuers are auto-registered `PENDING`); it grants `CALLER_SHF`, `TENANT_<org>`, `SHF_<authority>`. Plugin users may call `/api/v1/resource-info` and their own tenant's batch-job routes (writes need `SHF_ORG_ADMIN`); everything else is Kitchen-admin only.
  - The plugin's origin must be listed in the runtime setting `kitchen.cors.allowed-origins` (Vaadin → Administration → Configuration).
  - Ensure the backend origin is declared in `sp-ui-plugin.json` under `manifest.contentSecurityPolicies.connect-src`.
  - Details: skill [`shf-resource-server-integration`](../skills/shf-resource-server-integration/SKILL.md).
