---
name: shf-plugin-testing
description: >-
  Use this skill when writing, running, or debugging unit tests for SailPoint Human Fabric (SHF) UI Plugins.
  Covers Angular 21 + Vitest + jsdom test configuration, providing TranslateService for TranslatePipe,
  mocking SailpointPluginService, using official @sailpoint/ui-plugin-sdk/testing (mockSdkContext),
  jsdom polyfills (ResizeObserver, matchMedia), and asserting PrimeNG components.
---

# SailPoint Human Fabric (SHF) UI Plugin Testing Skill

This skill provides step-by-step procedures, patterns, and troubleshooting techniques for testing SailPoint Human Fabric UI Plugins using Angular 21, Vitest, jsdom, and the SailPoint UI Plugin SDK.

---

## 1. Test Architecture Overview

- **Test Runner**: Angular CLI Application Builder with Vitest (`runnerConfig: "vitest.config.ts"`).
- **DOM Environment**: `jsdom` configured in `vitest.config.ts`.
- **Global Setup**: `src/test-setup.ts` initializes polyfills (`ResizeObserver`, `window.matchMedia`).
- **Command**: `npm test` (or `npm test -- --include <path-to-spec>`).

---

## 2. Core Testing Patterns

### Pattern A: Testing Components with `TranslatePipe`

Components using `TranslatePipe` (`{{ 'key' | translate }}`) will fail with `NG0201: No provider found for TranslateService` unless `TranslateService` is supplied to `TestBed`.

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import enTranslations from '../../../../public/i18n/en.json';
import { MyFeatureComponent } from './my-feature.component';

describe('MyFeatureComponent', () => {
  let fixture: ComponentFixture<MyFeatureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyFeatureComponent],
      providers: [
        provideTranslateService(),
      ],
    }).compileComponents();

    // Populate translations so assertions match real text
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', enTranslations);
    translate.use('en');

    fixture = TestBed.createComponent(MyFeatureComponent);
    fixture.detectChanges();
  });
});
```

---

### Pattern B: Stubbing `SailpointPluginService`

Components that inject `SailpointPluginService` should receive a lightweight mock to avoid real SDK initialization and timeout failures:

```ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SailpointPluginService } from '@core';

const mockContext = signal({
  tenant: { id: 't1', org: 'acme-org', name: 'Acme Corp' },
  user: { displayName: 'Admin User', email: 'admin@acme.com' },
  page: { route: 'https://acme.identitynow.com/ui/plugin/shf-sample', subPath: '' },
});

TestBed.configureTestingModule({
  providers: [
    {
      provide: SailpointPluginService,
      useValue: {
        context: mockContext,
        status: signal('ready'),
        apiReady: signal(true),
        get: vi.fn().mockResolvedValue({ items: [] }),
        post: vi.fn().mockResolvedValue({}),
        setRoute: vi.fn().mockResolvedValue(undefined),
      },
    },
  ],
});
```

---

### Pattern C: Testing with `@sailpoint/ui-plugin-sdk/testing` (`mockSdkContext`)

For integration testing of SDK interactions, token refresh, and route changes, use the official mock App Shell:

```ts
import { mockSdkContext } from '@sailpoint/ui-plugin-sdk/testing';
import { createSDK } from '@sailpoint/ui-plugin-sdk';

describe('SDK Integration', () => {
  let mockHandle: ReturnType<typeof mockSdkContext>;

  beforeEach(() => {
    mockHandle = mockSdkContext({
      context: {
        tenant: {
          id: 'tenant-1',
          org: 'acme',
          name: 'Acme Tenant',
          apiUrl: { idn: 'https://acme.api.identitynow.com' },
          products: [],
        },
        user: {
          id: 'user-1',
          displayName: 'Test User',
          email: 'test@example.com',
          capabilities: {
            isOrgAdmin: true,
            isHelpdesk: false,
            isDashboard: true,
            isCertAdmin: false,
            isReportAdmin: false,
            isSourceAdmin: false,
            isSourceSubadmin: false,
            isRoleAdmin: false,
            isRoleSubadmin: false,
            isCloudGovAdmin: false,
            isCloudGovUser: false,
            isSaasManagementAdmin: false,
            isSaasManagementReader: false,
          },
        },
        page: {
          route: 'https://acme.identitynow.com/ui/plugin/shf-sample/settings',
        },
        slot: {},
        pluginConfiguration: {
          pluginId: 'shf-sample',
        },
      },
      token: 'initial-scoped-token',
    });
  });

  afterEach(() => {
    mockHandle.restore();
  });

  it('receives emitted token updates', async () => {
    const sdk = createSDK();
    let latestToken = '';
    sdk.events.onTokenUpdate((token) => {
      latestToken = token;
    });

    mockHandle.emitTokenUpdate('refreshed-token-xyz');
    expect(latestToken).toBe('refreshed-token-xyz');
  });

  it('tracks route changes sent to App Shell', async () => {
    const sdk = createSDK();
    await sdk.navigation.setRoute('workflows');
    expect(mockHandle.routeChanges).toContain('workflows');
  });
});
```

---

### Pattern D: Testing PrimeNG Components & DOM Bindings

In Angular and PrimeNG 21:
- Property bindings like `[label]="'btn.text' | translate"` set the component input, NOT an HTML attribute.
- **Do NOT check** `element.getAttribute('label')` (returns null).
- **Check** `element.textContent` instead:
  ```ts
  const button = compiled.querySelector('p-button');
  expect(button?.textContent).toContain('List Identities (Observable)');
  ```

---

## 3. Global Polyfills (`src/test-setup.ts`)

jsdom does not implement browser APIs used by modern UI components. `src/test-setup.ts` must provide:

1. **`ResizeObserver`** (used by PrimeNG tabs, tables, overlays):
   ```ts
   class ResizeObserverMock {
     observe() {}
     unobserve() {}
     disconnect() {}
   }
   globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
   ```

2. **`window.matchMedia`** (used by Angular animations and reduced-motion queries):
   ```ts
   Object.defineProperty(window, 'matchMedia', {
     writable: true,
     value: (query: string) => ({
       matches: false,
       media: query,
       onchange: null,
       addListener: () => {},
       removeListener: () => {},
       addEventListener: () => {},
       removeEventListener: () => {},
       dispatchEvent: () => false,
     }),
   });
   ```

---

## 4. Test Execution Cheatsheet

```bash
# Run all unit tests
npm test

# Run a specific spec file
npm test -- --include src/app/features/workflows/workflows.component.spec.ts

# Run tests once without watch mode
npm test -- --watch=false
```
