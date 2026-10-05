# Security Audit Checklist for Pull Requests & Deployments

Run through this checklist before submitting a pull request or deploying the plugin to a tenant.

## 1. OAuth Scope & Least Privilege Audit (ASI03)
- [ ] Inspect `manifest.apiScopes` in `sp-ui-plugin.json`.
- [ ] Ensure **`sp:scopes:all` is removed** before any production release.
- [ ] Confirm every API call in `src/app/` has its corresponding required scope from `api-specs/idn/apis` declared.
- [ ] Verify that no unused scopes remain declared.

## 2. Content Security Policy (CSP) & Permissions-Policy Audit (ASI02, ASI05)
- [ ] Verify `angular.json` dev server headers and `sp-ui-plugin.json` CSP directives.
- [ ] Ensure `connect-src` only permits `'self'` and the authorized SailPoint tenant API domain.
- [ ] Ensure `script-src` does NOT contain `'unsafe-eval'`.
- [ ] Verify no external third-party CDN scripts or fonts from untrusted sources are loaded.

## 3. Client-Side XSS & Output Sanitization Audit (ASI01, ASI05)
- [ ] Check all `[innerHTML]` bindings:
  - Bound only to translation keys: `[innerHTML]="'key.path' | translate"`.
  - No dynamic, untrusted API responses or user data bound directly to `[innerHTML]`.
- [ ] Check for `bypassSecurityTrust*` calls (must be zero or explicitly audited).
- [ ] Confirm absence of `eval()`, `new Function()`, or dynamic script injection.

## 4. Launchpad Deep Linking & URL Validation Audit (ASI01, ASI02)
- [ ] Confirm all URLs constructed for Launchpad (e.g. `buildInteractiveProcessUrl`) parse the host origin strictly with `new URL()`.
- [ ] Confirm all path variables and process IDs are URL-encoded via `encodeURIComponent()`.

## 5. Batch Throttling & Fail-Closed Polling Audit (ASI08)
- [ ] Verify batch requests are chunked into batches of 25–50 items.
- [ ] Ensure concurrent in-flight requests are throttled (not unbounded `Promise.all`).
- [ ] Verify status polling (`TaskManagementService`) implements exponential backoff on HTTP 429.
- [ ] Verify polling loops enforce finite maximum iterations and timeout safety guards.
- [ ] Confirm batch tasks fail closed on `Error` or `Terminated` status.

## 6. Supply Chain & CDN Build Verification (ASI04)
- [ ] Run `npm audit` to check for known package vulnerabilities.
- [ ] Run `npm run build` and inspect `dist/shf-batch/browser/index.html`:
  - Verify all `<script>` and `<link>` tags use strictly relative paths (`./`).
  - Confirm `baseHref: "./"` and `deployUrl: "./"` in `angular.json`.

## 7. AI Agent Safety & Commit Audit (ASI09, ASI10)
- [ ] Verify no secrets, credentials, or personal access tokens are committed.
- [ ] Verify assisted commits include appropriate `Co-Authored-By:` trailers.
- [ ] Confirm task artifacts in `.agents/artifacts/` are git-ignored.
