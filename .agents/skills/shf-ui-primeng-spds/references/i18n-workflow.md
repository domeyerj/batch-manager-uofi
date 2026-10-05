# Internationalization (i18n) Workflow with ngx-translate

SailPoint Human Fabric requires consistent multi-language support. The UI plugin starter uses `@ngx-translate/core` and `@ngx-translate/http-loader`.

## Architecture & Configuration

In `src/app/app.config.ts`:
```ts
provideTranslateService({
  fallbackLang: 'en',
  loader: provideTranslateHttpLoader({
    prefix: 'i18n/',
    suffix: '.json',
    useHttpBackend: true,
  }),
})
```

### Why `useHttpBackend: true` is Critical
The SailPoint SDK provides an HTTP interceptor that attaches bearer tokens to outgoing API calls. Because translation files (`public/i18n/*.json`) are static assets residing within the plugin bundle, sending auth headers or waiting for the COIP handshake can break asset loading. `useHttpBackend: true` routes translation requests directly through Angular's `HttpBackend`, bypassing interceptors and ensuring catalogs load instantly even before the App Shell handshake finishes.

---

## Adding and Updating Labels

### 1. Structure in `public/i18n/en.json`
Group labels logically by feature or section:
```json
{
  "batch": {
    "title": "Batch Identity Operations",
    "table": {
      "id": "ID",
      "name": "Identity Name",
      "status": "State"
    },
    "actions": {
      "process": "Process Selected",
      "cancel": "Cancel"
    }
  }
}
```

### 2. Usage in Templates
- **Standard binding**:
  ```html
  <h1>{{ 'batch.title' | translate }}</h1>
  ```
- **With HTML markup in values**:
  ```html
  <p [innerHTML]="'batch.description' | translate"></p>
  ```
- **Interpolated parameters**:
  ```html
  <!-- en.json: "selectedCount": "{{ count }} identities selected" -->
  <span>{{ 'batch.selectedCount' | translate:{ count: selectedItems().length } }}</span>
  ```

---

## Supporting Tenant Languages

ISC / SHF supports 22 languages:
`en` (English, fallback), `cs`, `da`, `de`, `es`, `fi`, `fr`, `hu`, `it`, `ja`, `ko`, `lt`, `nl`, `no`, `pl`, `pt`, `ru`, `sv`, `th`, `tr`, `zh-CN`, `zh-TW`.

To add a language:
1. Copy `public/i18n/en.json` to `public/i18n/<locale-code>.json`.
2. Translate values.
3. The plugin automatically detects the browser's locale (`navigator.language`) and requests the corresponding file. If missing, it safely falls back to `en`.
