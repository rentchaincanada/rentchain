# Firebase Initialization Consolidation Plan

## Current Topology

Before this mission, backend Firebase initialization was split across three files:

- `rentchain-api/src/config/firebase.ts` initialized Firebase Admin with Application Default Credentials, exported `db`, `firestore`, `FieldValue`, and logged the existing Firebase config messages.
- `rentchain-api/src/firebase.ts` initialized Firebase Admin with an alternate project ID fallback and exported only `db`.
- `rentchain-api/src/events/firestore.ts` imported Firebase Admin directly, imported the config module for side effects, and exported `firestore`.

The split made import order harder to audit because different consumers imported different roots. The mission audit found one `admin.initializeApp()` call in `src/config/firebase.ts`, one in `src/firebase.ts`, and side-effect initialization through `src/events/firestore.ts`.

## Import Landscape

The primary consumer path was `src/config/firebase.ts`; more than 280 source imports referenced it before migration. A smaller set imported `src/events/firestore.ts` for a Firestore named export. Several modules already imported `src/firebase.ts` for `db`.

After consolidation, consumers import from the canonical barrel path:

```ts
import { db, FieldValue, firestore } from "../firebase";
```

Relative depth may vary by module, but the target is always `src/firebase/index.ts`.

## Consolidated Contract

The canonical initialization path is now:

- `rentchain-api/src/firebase/admin.ts`
- `rentchain-api/src/firebase/index.ts`
- `rentchain-api/src/firebase/initializationRegistry.ts`

`admin.ts` is the only backend source file that calls `admin.initializeApp()`. It calls `assertSafeFirestoreEnvironment()` before initialization, keeps the `admin.apps.length` singleton guard, configures Firestore with `ignoreUndefinedProperties`, and preserves the existing log format:

```text
[FIREBASE CONFIG LOADED]
[FIREBASE CONFIG] PROJECT_ID = ...
```

## Export Mapping

| Old file | Old exports | New path | New exports |
| --- | --- | --- | --- |
| `src/config/firebase.ts` | `db`, `firestore`, `FieldValue` | `src/firebase` | `db`, `firestore`, `FieldValue`, `PROJECT_ID` |
| `src/events/firestore.ts` | `firestore`, default export | `src/firebase` | `firestore` |
| `src/firebase.ts` | `db` | `src/firebase` | `db` |

The legacy files were removed after imports were migrated. No service or route imports are used by the initialization layer.

## Environment Guard Coverage

`assertSafeFirestoreEnvironment()` remains the authority for production, emulator, and local override safety. Its result is captured for audit visibility by `recordInitializationState()` but is not used for authorization or permission decisions.

## Health Surface

Health responses now include `firebaseInitializationMode`, derived from `initializationState()`. The field is informational only and does not include credentials, tokens, service account paths, or sensitive payloads.
