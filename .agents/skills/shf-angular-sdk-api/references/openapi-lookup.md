# OpenAPI Specifications Lookup & Mapping Guide

The OpenAPI 3.0 specification directory is located at:
`c:\storage\projects\sailpoint\api-specs\idn\apis`

## Directory Structure

```text
api-specs/idn/apis/
├── <domain>/                   # e.g., identities, accounts, launchers, task-management
│   ├── openapi.yaml            # Main API definition for domain
│   ├── paths/                  # Individual path endpoints
│   │   ├── <resource>-v1.yaml
│   │   └── <resource>-v1-by-id.yaml
│   └── schemas/                # Request/response data models
└── shared/                     # Common parameters, errors, headers
    ├── parameters/             # limit, offset, count, filters, sorters
    ├── responses/              # 400, 401, 403, 429, 500
    └── schemas/                # ErrorMessageDto, JsonPatchOperation, etc.
```

## How to Find Endpoint Details

### 1. Finding the Operation ID & SDK Method
Inspect the HTTP method in the path YAML file:
```yaml
get:
  operationId: listIdentitiesV1
  tags:
    - Identities
```
The SDK generator creates a method matching `operationId` on the domain's service:
- `operationId: listIdentitiesV1` -> `IdentitiesService.listIdentitiesV1(params)`
- `operationId: getTaskStatusV1` -> `TaskManagementService.getTaskStatusV1({ id: '...' })`

### 2. Finding Required OAuth Scopes
Inspect the `security` section of the operation:
```yaml
security:
  - userAuth:
    - idn:identity:read
    - idn:identity:manage
```
- Each item under `userAuth` indicates valid scopes for user context requests.
- Add at least one of the listed scopes to `apiScopes` in `sp-ui-plugin.json`.

### 3. Collection Query Parameters
SailPoint collection endpoints follow standard conventions:
- **`filters`**: Standard filtering expressions (e.g. `filters: 'correlated eq true'`, `name sw "John"`).
- **`sorters`**: Comma-separated sort fields (e.g. `sorters: 'name,-created'`). Prefix with `-` for descending.
- **`limit`**: Maximum items to return per page (typically defaults to 250, max 250).
- **`offset`**: Zero-based offset for pagination.
- **`count`**: Boolean flag (`count=true`) to return total count in `X-Total-Count` header.

### 4. Schemas and DTOs
Look in `schemas/` in the domain directory:
- Models referenced by `$ref: ../schemas/<name>.yaml` are exported as TypeScript interfaces by `@sailpoint/angular-sdk/<domain>`.
- For example: `schemas/identity.yaml` becomes `export interface Identity { ... }` in `@sailpoint/angular-sdk/identities`.
