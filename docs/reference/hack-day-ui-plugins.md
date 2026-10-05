# Hack Day: UI Plugins track — notes

Source: https://developer.sailpoint.com/hack-day/ui-plugins (read 2026-10-05). The track builds a "manager lookup": one paginated API call loads all identities, then a manager dropdown and a direct-reports table are derived client-side.

## Setup

- **Versions:** Node 24+ and SailPoint CLI 2.7.0+. The `ui-plugins` command group is new, so if you get "unknown command", update the CLI.
- **PAT:** create one with an empty scope list, which defaults to `sp:scopes:all`. Then run `sail env create <name>` and enter the tenant URL and API URL.
- **Smoke test:** `sail ui-plugins list` checks your credentials and the feature flag together. "Not enabled for this tenant" means the flag is off, and SailPoint must enable it.
- **Rights:**
  - create: `idn:plugins-ui:create`
  - list: `idn:plugins-ui:read`
  - link, unlink, upload: `idn:plugins-ui:update`
  - delete: `idn:plugins-ui:delete`
- **Offline manifest check:** `sail ui-plugins validate-manifest`.

## Dev loop

1. Run `sail ui-plugins create`. It registers the manifest only.
2. Run `npm run start`. This serves HTTPS with a self-signed certificate, so accept it at https://localhost:4200.
3. Run `sail ui-plugins link [--port N]`.
4. Open `https://<tenant>/ui/plugin/<id>?spPluginDev=<alias>`. A "Local Dev" badge appears.

Opening localhost directly skips the App Shell handshake, so there's no token and API calls fail. When you're done, run `sail ui-plugins unlink`.

## Deploy

- Run `npm run build`, then `sail ui-plugins upload`. Upload does **not** build.
- The bundle budget warning is expected.
- Each upload becomes an immutable bundle, and the latest one is active.
- The same alias deploys to whichever tenant `sail env` points at.
- To remove the plugin: `sail ui-plugins delete <alias>`.
- **Nav bar item:**
  1. Go to Admin → Global → System Settings → Customize Navbar → Custom Item → Add sub menu item.
  2. Set Destination to Plugin. This needs an uploaded bundle.
  3. Optionally set Required Capabilities to restrict who sees it.

## Code patterns

- `Paginator.paginate(p => svc.listXxxV1(p), { sorters: 'name' }, 250)` comes from `@sailpoint/angular-sdk` and emits once with every record. `Paginator.paginatePages()` streams page by page.
- The SDK is split by area (`@sailpoint/angular-sdk/identities`, …). Its methods return Observables; use `firstValueFrom()` to get a promise.
- Load inside an `effect()` gated on `plugin.apiReady()`, with a once-flag. Derive views with `computed()`, which makes no extra API calls.
- These PrimeNG components are pre-themed: `p-select` (with filter), `p-table`, `p-tag`, `p-message`, `p-skeleton`, `p-avatar`. Theme tokens are available as `--spds-*` CSS variables.
- Stretch ideas from the track:
  - `searchPostV1` for server-side filtering.
  - `searchAggregateV1` for counts in one call.
  - `getIdentityV1` to walk up the management chain.

## Main hack rules

A plugin entry must use at least one SailPoint API and be demoed live in a tenant. It is judged with the same criteria as the MCP Server hack.
