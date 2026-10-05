# Workflow Launchers & Launchpad Integration Guide

SailPoint Workflows can be triggered by end users via **Launchers**. In UI plugins, you can display available launchers, initiate them, and guide users to complete interactive forms in Launchpad.

## Assigned Launchers vs. All Tenant Launchers

1. **User-Assigned Launchers (`/beta/launchers/my/assigned`)**:
   - Returns launchers specifically assigned to the currently logged-in user in Launchpad.
   - Recommended for user-facing self-service portals.
   - Requires scope: `idn:launcher:read`.
   - Call with `SailpointPluginService.get()`:
     ```ts
     const response = await this.plugin.get<{ items?: Launcher[] }>(
       '/beta/launchers/my/assigned?limit=100&sorters=name'
     );
     ```

2. **All Tenant Launchers (`LaunchersService.getLaunchersV1()`)**:
   - Returns all launchers configured across the entire tenant.
   - Requires admin rights and scope: `idn:launcher-admin:read`.

---

## Launching a Workflow

To initiate a workflow:

```ts
const launchResponse = await this.plugin.post<{
  interactiveProcessId?: string;
  workflowExecutionId?: string;
}>(
  `/beta/launchers/${encodeURIComponent(launcherId)}/launch`,
  {
    // Optional input payload variables for the workflow
  }
);
```

### Interactive vs. Non-Interactive Workflows
- **Non-interactive Workflows**: Execute completely in the background. The response contains `workflowExecutionId`.
- **Interactive Workflows**: Contain user-input steps (forms). The response contains `interactiveProcessId`.

---

## Deep Linking to Launchpad

Plugins cannot render workflow interactive forms directly because they execute inside an isolated iframe. When an `interactiveProcessId` is returned, construct the Launchpad link using the tenant origin:

```ts
export function buildInteractiveProcessUrl(
  pageRoute: string | null | undefined,
  processId: string
): string | null {
  if (!pageRoute || !processId) {
    return null;
  }
  const origin = new URL(pageRoute).origin;
  return `${origin}/ui/d/launchpad/interactive-processes/${encodeURIComponent(processId)}`;
}
```

Usage in component:
```ts
const pageRoute = this.plugin.context()?.page.route;
const url = buildInteractiveProcessUrl(pageRoute, processId);
```
In template:
```html
@if (interactiveProcessUrl(); as url) {
  <a [href]="url" target="_blank" rel="noopener noreferrer" class="launchpad-link">
    Open in Launchpad &rarr;
  </a>
}
```
