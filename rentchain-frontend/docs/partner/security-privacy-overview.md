# Security and Privacy Overview

## Security Controls (Current Pattern)

- Authentication enforced for protected landlord workflows.
- Authorization scoped by account and role.
- Server-side access to third-party providers; frontend does not hold provider secrets.
- Structured error handling with correlation identifiers where applicable.

## Privacy Controls (Current Pattern)

- Data minimization: only required fields are sent for a given operation.
- Purpose limitation: screening-related data used only for screening workflows.
- Access limitation: records exposed by role and tenancy/account scope.

## Logging Guidance

- Log operational metadata and correlation identifiers.
- Do not log sensitive personal identifiers beyond operational need.
- Do not log provider credentials, secret headers, or raw tokens.

## Partner Review Notes

- Production key management remains server-side.
- Integration configuration should be provider-aware and environment-scoped.
- Retention settings should be explicitly documented per record type.
