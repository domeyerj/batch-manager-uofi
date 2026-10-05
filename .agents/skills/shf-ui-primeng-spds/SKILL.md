---
name: shf-ui-primeng-spds
description: >-
  Use this skill when developing UI components, layouts, styling, theming, routing, or translations for SailPoint Human Fabric (SHF)
  UI Plugins using PrimeNG, the SailPoint Design System (SPDS) theme preset, and ngx-translate. Covers SPDS typography tokens (.spds-h1–.spds-h6),
  sandboxed iframe CSS isolation, ISC sidebar navigation layout patterns, hash location routing with App Shell route mirroring (plugin.setRoute),
  managing i18n translation catalogs, and configuring Vitest unit tests.
---

# SailPoint Human Fabric (SHF) UI, Theming & PrimeNG

This skill provides guidelines and procedures for building consistent, accessible, and native-feeling user interfaces in SailPoint Human Fabric (SHF) UI Plugins.

## Tech Stack & Core Libraries

- **Component Library**: [PrimeNG](https://primeng.org/) (`primeng`)
- **Theme Preset**: SailPoint Design System (SPDS) preset in `src/app/core/spds-prime-theme.ts`
- **Routing**: Angular Router with Hash Location Strategy (`withHashLocation()`)
- **Internationalization (i18n)**: `@ngx-translate/core` + `@ngx-translate/http-loader`
- **Icons**: Font Awesome

---

## Key Development Workflows

### 1. PrimeNG & SPDS Theme Setup

In `src/app/app.config.ts`, PrimeNG is configured with the SPDS preset:

```ts
import { providePrimeNG } from 'primeng/config';
import spdsPrimePreset, { SPDS_DARK_MODE_SELECTOR, SPDS_THEME_PREFIX } from '@core/spds-prime-theme';

providePrimeNG({
  theme: {
    preset: spdsPrimePreset,
    options: {
      darkModeSelector: SPDS_DARK_MODE_SELECTOR,
      prefix: SPDS_THEME_PREFIX,
    },
  },
})
```

- When creating components, prefer PrimeNG components (`ButtonModule`, `TableModule`, `TagModule`, `CardModule`, `DialogModule`, `InputTextModule`).
- Do NOT hardcode colors or arbitrary styles. Utilize SPDS CSS variables and utility classes.

Refer to [SPDS Design System & Theming Reference](references/spds-design-system.md).

---

### 2. Standard Layout: ISC Sidebar Navigation

SailPoint applications use a structured shell layout with a left sidebar and main content area:

```html
<div class="shell">
  <div class="shell-body">
    <!-- Sidebar Navigation -->
    <nav class="shell-sidenav">
      <ul class="shell-sidenav__list">
        <li>
          <a routerLink="/" routerLinkActive="shell-sidenav__link--active"
             [routerLinkActiveOptions]="{ exact: true }" class="shell-sidenav__link">
            {{ 'nav.overview' | translate }}
          </a>
        </li>
        <li>
          <a routerLink="/workflows" routerLinkActive="shell-sidenav__link--active"
             class="shell-sidenav__link">
            {{ 'nav.workflows' | translate }}
          </a>
        </li>
      </ul>
    </nav>

    <!-- Main Content Panel -->
    <main class="shell-content">
      <header class="shell-content__header">
        <h1 class="spds-h4">{{ 'app.title' | translate }}</h1>
        <div class="shell-content__meta">
          <p-tag [value]="status()" [severity]="handshakeSeverity[status()]" />
        </div>
      </header>
      <div class="shell-content__card">
        <router-outlet />
      </div>
    </main>
  </div>
</div>
```

---

### 3. Hash Routing & Host URL Synchronization

Plugins must use **Hash Location Strategy** (`#/`, `#/workflows`) because:
1. They run inside an iframe where server-side path rewriting is unavailable.
2. It prevents full page reloads when navigating.

#### Configuration in `app.config.ts`
```ts
import { provideRouter, withHashLocation } from '@angular/router';
import { routes } from './app.routes';

provideRouter(routes, withHashLocation());
```

#### Synchronizing with the App Shell (`app.ts`)
On deep links or page refreshes, the App Shell passes the sub-path in `context().page.subPath`.
When navigating inside the plugin, notify the App Shell to update the host browser URL without pushing extra history states:

```ts
this.router.events
  .pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    takeUntilDestroyed(this.destroyRef)
  )
  .subscribe((event) => {
    const hashPath = event.urlAfterRedirects.replace(/^\/#?\/?/, '');
    if (this.plugin.apiReady()) {
      this.plugin.setRoute(hashPath).catch(console.warn);
    }
  });
```

---

### 4. Internationalization (i18n)

All user-visible strings must be translated via `ngx-translate`.

1. **Add keys to `public/i18n/en.json`**:
   ```json
   {
     "myFeature": {
       "title": "Batch Identity Processing",
       "submit": "Execute Batch"
     }
   }
   ```
2. **Use the `translate` pipe in templates**:
   ```html
   <h2>{{ 'myFeature.title' | translate }}</h2>
   <p-button [label]="'myFeature.submit' | translate" />
   ```
3. **Import `TranslatePipe`** in your standalone component's `imports` array:
   ```ts
   imports: [CommonModule, ButtonModule, TranslatePipe]
   ```

Refer to [i18n Translation Guide](references/i18n-workflow.md) for full configuration and multi-language parity details.

---

### 5. Vitest Unit Testing

When writing unit tests for components that use `TranslatePipe` or PrimeNG:
- Always include `provideTranslateService()` in `TestBed.configureTestingModule`.
- Provide a mock for `SailpointPluginService`.
- If testing PrimeNG components that monitor container dimensions, jsdom requires the `ResizeObserver` mock in `src/test-setup.ts`.

Refer to [Vitest Testing Patterns Reference](references/testing-patterns.md).

---

## Detailed References

- [SPDS Design System & Theming Reference](references/spds-design-system.md)
- [i18n Translation Workflow](references/i18n-workflow.md)
- [Vitest Testing Patterns Reference](references/testing-patterns.md)
