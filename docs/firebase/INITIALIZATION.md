# Firebase Initialization

## Purpose

Backend Firebase Admin initialization is centralized in `rentchain-api/src/firebase`. This prevents duplicate Admin SDK initialization, keeps Firestore singleton behavior consistent, and gives operators one place to verify initialization state.

## Import Contract

All backend consumers must import Firestore utilities from `src/firebase`:

```ts
import { db, firestore, FieldValue, PROJECT_ID } from "../firebase";
```

Use `db` and `firestore` for the shared Firestore singleton. Use `FieldValue` for server timestamps and array operations. Use `PROJECT_ID` only for diagnostics or configuration reporting where the project identifier is already non-secret operational metadata.

Do not import from `src/config/firebase.ts`, `src/events/firestore.ts`, or the retired file root `src/firebase.ts`.

## Canonical Modules

- `src/firebase/admin.ts` initializes Firebase Admin and exports `db`, `firestore`, `FieldValue`, and `PROJECT_ID`.
- `src/firebase/index.ts` is the barrel export used by application code.
- `src/firebase/initializationRegistry.ts` records informational initialization state for health and future audit workflows.

## Environment Modes

`assertSafeFirestoreEnvironment()` determines the mode before Admin SDK initialization:

- `production`: production process startup. Production credential handling remains unchanged.
- `emulator`: local development or test startup using `FIRESTORE_EMULATOR_HOST`.
- `local-prod-firestore-override`: explicit local override using `ALLOW_LOCAL_PROD_FIRESTORE=true`; this is for operator-approved diagnostics only.

The guard can throw before Firebase Admin initialization if local startup is unsafe.

## Audit Trail

The initialization module preserves the existing console log format:

```text
[FIREBASE CONFIG LOADED]
[FIREBASE CONFIG] PROJECT_ID = ...
```

`initializationState()` returns environment, mode, emulator host, project ID, timestamp, and caller metadata. This data is informational and must not be used for authorization decisions.

## Health Contract

Health routes include `firebaseInitializationMode` so operators can confirm whether the backend initialized in production, emulator, or local override mode. The health payload does not expose credentials, tokens, credential file paths, or sensitive Firebase config.
