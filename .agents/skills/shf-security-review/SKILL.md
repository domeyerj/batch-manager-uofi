---
name: shf-security-review
description: >-
  Use this skill to perform comprehensive security audits and reviews on the SHF UI Plugin and multi-agent workflows.
  Covers the OWASP Top 10 for Agentic Applications (2026) (ASI01–ASI10), OAuth scope least-privilege auditing, CSP header verification,
  XSS sink sanitization, safe Launchpad deep-linking, rate-limit backoff, and pre-deployment security gates.
---

# SailPoint Human Fabric (SHF) Security Review Skill

This skill provides a structured security audit procedure for the `shf-sample` UI Plugin, ensuring compliance with SailPoint platform security standards and the **OWASP Top 10 for Agentic Applications (2026)**.

---

## When to Run This Review

Execute this review:
1. **Before any Pull Request** or before calling a feature task complete.
2. **Whenever modifying `sp-ui-plugin.json`** (especially `apiScopes`, `contentSecurityPolicies`, `permissionPolicy`).
3. **Whenever adding new API calls**, batch operations, or workflow launcher links.
4. **Before deploying to production** (`sail ui-plugins deploy`).

---

## 5-Step Security Audit Procedure

### Step 1: Audit API Scopes & Least Privilege (ASI03)
1. Inspect `manifest.apiScopes` in `sp-ui-plugin.json`.
2. Ensure **`sp:scopes:all` is NOT present** in any production release branch.
3. For each API endpoint called in `src/app/`, verify its `security.userAuth` in `api-specs/idn/apis/` and verify that only the exact required scope is declared (e.g. `idn:identity:read`, `idn:task-management:read`).

### Step 2: Content-Security-Policy (CSP) & Permissions-Policy Audit (ASI02, ASI05)
1. Check `angular.json` under `projects.shf-sample.architect.serve.options.headers`.
2. Verify `connect-src` contains only `'self'` and the authorized tenant API host (`https://<tenant>.api.cloud.sailpoint.com`).
3. Verify `script-src` does NOT contain `'unsafe-eval'`.
4. Ensure no external unvetted script CDNs (e.g. `unpkg.com`, `cdnjs`) are present in `src/index.html`.

### Step 3: XSS & Client-Side Injection Audit (ASI01, ASI05)
1. Search the codebase for `[innerHTML]` bindings:
   - Verify that `[innerHTML]` is used **only** with translated strings from `public/i18n/*.json` (e.g., `[innerHTML]="'some.key' | translate"`).
   - Ensure dynamic API response data or user-supplied strings are **never** rendered via `[innerHTML]`.
2. Verify no usages of Angular `DomSanitizer.bypassSecurityTrust*` exist without explicit security rationale.
3. Verify no direct DOM manipulation via `document.createElement`, `innerHTML`, or `eval()`.

### Step 4: Launchpad Deep-Linking & Origin Validation (ASI01, ASI02)
1. Inspect functions that generate Launchpad redirect links (e.g. `buildInteractiveProcessUrl`).
2. Verify the host origin is parsed strictly using `new URL()`:
   ```ts
   const origin = new URL(pageRoute).origin;
   ```
3. Verify all route parameters and process IDs are URL-encoded (`encodeURIComponent(processId)`).

### Step 5: Batch Throttling & Fail-Closed Task Management (ASI08)
1. Verify all batch iteration loops chunk items (batches of 25–50) and limit concurrency.
2. Verify that task status polling (`TaskManagementService`) implements:
   - Exponential backoff for HTTP 429 (`Too Many Requests`);
   - Finite polling attempt cutoffs (timeout guards);
   - Fail-closed handling if task status is `Error` or `Terminated`.

---

## Detailed References

- [OWASP Top 10 for Agentic Applications (2026) Reference](references/owasp-agentic-top10.md)
- [Security Audit Checklist](references/security-audit-checklist.md)
