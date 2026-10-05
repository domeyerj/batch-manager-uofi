---
name: ui-plugin-dev
description: Conventions and step-by-step patterns for building features in the batch-manager-uofi SailPoint UI Plugin (Angular 21, PrimeNG, @sailpoint/ui-plugin-sdk, @sailpoint/angular-sdk). Use when adding pages, calling ISC APIs, editing sp-ui-plugin.json, adding translations, writing tests, or preparing a build/deploy.
---

# UI plugin development (batch-manager-uofi)

The canonical background is `SAILPOINT_PLUGIN_GUIDE_ANGULAR.md`. Hack-day patterns are in `docs/reference/hack-day-ui-plugins.md`.

## Mental model

- ISC loads the plugin in a sandboxed iframe. `SailpointPluginService` (in `src/app/core`) runs the COIP handshake once and exposes `context()`, `status()`, `apiReady()`, `tenant()` and `user()` as signals.
- Every API call uses the scoped token minted from `apiScopes`. An undeclared scope fails both in local dev and in production.
- Opening `https://localhost:4200` directly means there is no handshake and every API call fails. Develop through the `?spPluginDev=<alias>` URL that `sail ui-plugins link` prints.

## Adding a feature page

1. **Claim the work** with the `changelog` skill.
2. **Create** `src/app/features/<feature>/<feature>.component.{ts,html,scss,spec.ts}`. Make it a standalone component and list every PrimeNG module it uses in `imports`.
3. **Add a lazy route** in `src/app/app.routes.ts` and a nav link in `src/app/app.html`. The label is a translate key, e.g. `nav.<feature>`.
4. **Add strings** to `public/i18n/en.json`. Never hard-code user-facing text.
5. **Data loading pattern:**

   ```ts
   private readonly plugin = inject(SailpointPluginService);
   private readonly svc = inject(IdentitiesService);          // declare in component providers
   protected readonly items = signal<Identity[]>([]);
   protected readonly loading = signal(false);
   protected readonly error = signal('');
   private requested = false;

   constructor() {
     effect(() => {
       if (this.plugin.apiReady() && !this.requested) { this.requested = true; void this.load(); }
     });
   }

   private async load() {
     this.loading.set(true); this.error.set('');
     try {
       const all = await firstValueFrom(
         Paginator.paginate((p) => this.svc.listIdentitiesV1(p), { sorters: 'name' }),
       );
       this.items.set(all);
     } catch (e) { this.error.set(e instanceof Error ? `${e.name}: ${e.message}` : String(e)); }
     finally { this.loading.set(false); }
   }
   ```

   - Derive views with `computed()`.
   - Use `Paginator.paginatePages()` for very large sets.
   - Use the search API (`searchPostV1`, `searchAggregateV1`) instead of client-side filtering when the data is large.
6. **Endpoints not in the SDK:** call `this.plugin.get<T>('/resource/v1/...')` or `post`. Verify the path with the `isc-api-lookup` skill first.
7. **Experimental endpoints:** add the `X-SailPoint-Experimental: true` header, and comment it in the code.

## Bulk or "batch" operations (core of this project)

- **Input** (CSV, paste or selection) → **resolve** (search or lookup each row; show unmatched rows) → **preview** (a table of exactly what will happen) → explicit **confirm** → **execute** with limited concurrency (≤ 5 in flight) and 429 backoff → **per-row result** table with retry and export.
- **Never execute on load**, and never execute without a preview.
- Async ISC operations return a task, job or request id. Poll the matching status endpoint, e.g. `/task-status/v1/{id}` for aggregations and the account-activities or access-request status endpoints for requests. Don't assume completion.
- Respect the access request rules: duplicates aren't rejected, so check for existing or pending access first.

## Manifest (`sp-ui-plugin.json`)

- Add the scope for every new endpoint, and aim for least privilege; `sp:scopes:all` is a placeholder.
- After editing, run `sail ui-plugins validate-manifest`, then list `sail ui-plugins push-manifest` and a re-`link` under **Needs human** in the changelog entry (unless you can run them yourself).
- The `build` section is local only. Don't change `alias`, because it is the deploy key across tenants.

## UI conventions

- Use PrimeNG components; they're already themed.
- Use `--spds-*` CSS variables for color and spacing.
- Use the `.spds-h1…h6` heading classes.
- Use `p-message` for errors, `p-skeleton` while loading, and `p-tag` severities for status.
- Keep hash routing. Report the current route to the host with `plugin.setRoute(subPath)` when it helps deep-linking.

## Tests and build

- `npm test` runs Vitest via `ng test`. Each feature gets a spec. Mock `SailpointPluginService` and SDK services, and never hit a real tenant.
- `npm run build` must pass. The bundle budget warning (about 1 MB raw, about 210 kB transfer) is expected.
- Keep `baseHref`/`deployUrl` at `./`, because absolute asset paths break on the CDN.

## Deploy (normally done by a human)

`npm run build` → `sail ui-plugins upload` (upload does not build). The nav bar entry is set under Admin → Global → System Settings → Customize Navbar → Custom Item → Destination: Plugin.
