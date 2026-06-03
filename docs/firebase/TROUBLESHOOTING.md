# Firebase Initialization Troubleshooting

## Unsafe Local Startup

If local backend startup fails with an unsafe Firestore environment message, confirm that the command is using the emulator-backed scripts:

```bash
npm --prefix rentchain-api run emulator:firestore
npm --prefix rentchain-api run dev
```

Local and test commands must set `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` unless an operator-approved diagnostic override is being used.

## Emulator Not Running

Symptoms:

- Backend starts in emulator mode but Firestore calls fail.
- Readiness checks return DB failure.

Checks:

```bash
echo $FIRESTORE_EMULATOR_HOST
npm --prefix rentchain-api run emulator:firestore
```

The expected local host is `127.0.0.1:8080`.

## Credential Warnings

Local development should not use `GOOGLE_APPLICATION_CREDENTIALS`. If the guard rejects local startup because credentials are present, unset the variable for normal development.

Use `ALLOW_LOCAL_PROD_FIRESTORE=true` only for explicit operator-approved diagnostics. That mode is logged by the guard and appears as `local-prod-firestore-override` in initialization state.

## Initialization Order

Application code should import from `src/firebase` and should not import Firebase Admin directly for Firestore initialization side effects. If a module appears to initialize Firebase before the canonical module, search for:

```bash
rg -n "initializeApp\\(|config/firebase|events/firestore" rentchain-api/src
```

Expected result after consolidation: only `src/firebase/admin.ts` calls `initializeApp()`, and no source import should reference retired Firebase paths.

## Health Verification

Use health responses to verify initialization mode:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/ready
curl http://localhost:3000/health/db
```

Expected field:

```json
{ "firebaseInitializationMode": "emulator" }
```

Production should report `production`. Local override diagnostics should report `local-prod-firestore-override`.
