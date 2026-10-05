# Vitest Testing Patterns for SailPoint UI Plugins

Unit testing in the project uses Angular CLI with Vitest (`runnerConfig: "vitest.config.ts"`, jsdom environment).

## Common Testing Scenarios & Solutions

### 1. `NG0201: No provider found for TranslateService`
When a component under test imports `TranslatePipe`, the Angular testing module must provide `TranslateService`.

**Solution**: Add `provideTranslateService()` to `TestBed.configureTestingModule`:
```ts
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import enTranslations from '../../../../public/i18n/en.json';
import { MyComponent } from './my-component';

describe('MyComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyComponent],
      providers: [
        provideTranslateService(),
      ],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', enTranslations);
    translate.use('en');
  });
});
```

---

### 2. Mocking `SailpointPluginService`
Components that inject `SailpointPluginService` should receive a mock to prevent real SDK creation and handshake timeouts during tests:

```ts
import { signal } from '@angular/core';
import { SailpointPluginService } from '@core';

const mockPluginService = {
  context: signal({
    tenant: { org: 'test-org' },
    user: { displayName: 'Admin User', email: 'admin@test.com' },
    page: { route: 'https://test.identitynow.com/ui/plugin/shf-sample', subPath: '' },
  }),
  status: signal('ready'),
  apiReady: () => true,
  get: () => Promise.resolve({ items: [] }),
  post: () => Promise.resolve({}),
  setRoute: () => Promise.resolve(),
};

TestBed.configureTestingModule({
  providers: [
    { provide: SailpointPluginService, useValue: mockPluginService },
  ]
});
```

---

### 3. Using Official `@sailpoint/ui-plugin-sdk/testing` (`mockSdkContext`)
The official testing utility from SailPoint simulates the App Shell handshake in browser-like environments:

```ts
import { mockSdkContext } from '@sailpoint/ui-plugin-sdk/testing';
import { createSDK } from '@sailpoint/ui-plugin-sdk';

describe('SDK Integration', () => {
  let mockHandle: ReturnType<typeof mockSdkContext>;

  beforeEach(() => {
    mockHandle = mockSdkContext({
      context: {
        tenant: { org: 'acme-tenant', apiUrl: { idn: 'https://acme.api.identitynow.com' } },
        user: {
          displayName: 'Jane Doe',
          capabilities: { isOrgAdmin: true } // override specific capabilities
        }
      }
    });
  });

  afterEach(() => {
    mockHandle.restore();
  });

  it('handles token update', () => {
    mockHandle.emitTokenUpdate('new-jwt-token');
    // test reactive response
  });
});
```

---

### 4. PrimeNG, jsdom `ResizeObserver`, and `matchMedia`
jsdom does not implement `ResizeObserver` (used by tabs/tables) or `window.matchMedia` (used by animations/reduced-motion).
These are mocked globally in `src/test-setup.ts`:
```ts
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

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

### 5. Asserting PrimeNG Component Labels
Angular property bindings like `[label]="'key' | translate"` set the component's internal property rather than adding an HTML attribute.
Do **not** use `button.getAttribute('label')`. Instead, check the element's rendered `textContent`:
```ts
const buttons = compiled.querySelectorAll('p-button');
expect(buttons[0].textContent).toContain('List Identities (Observable)');
```

---

### 6. Running Tests
Run unit tests with:
```bash
npm test
```
To run targeted tests:
```bash
npm test -- --include src/app/app.spec.ts
```
