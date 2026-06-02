# Local Firestore Emulator Runbook

## Purpose

Local RentChain development and backend tests must use the Firestore emulator by default. Local, development, and test processes must not silently fall back to production Firestore.

## Requirements

- Node 20.x for backend commands.
- Java 21 or newer for Firebase emulators.
- Firebase CLI installed locally or available through `npx firebase-tools`.
- No local service account credential path unless an operator explicitly approves a diagnostic override.

## Environment

Use these defaults for local development:

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
ALLOW_LOCAL_PROD_FIRESTORE=false
```

Do not set `GOOGLE_APPLICATION_CREDENTIALS` for local development.

## Start The Firestore Emulator

From the repository root:

```bash
npm --prefix rentchain-api run emulator:firestore
```

The emulator uses root `firebase.json` and root `firestore.rules`.

Expected ports:

- Firestore emulator: `127.0.0.1:8080`
- Emulator UI: `127.0.0.1:4000`

## Start Backend Against Emulator

In a second terminal:

```bash
npm --prefix rentchain-api run dev:emulator
```

The default backend `dev` script also points at `127.0.0.1:8080`.

## Run Tests Against Emulator Configuration

```bash
npm --prefix rentchain-api run test:emulator
```

The default backend test scripts set `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` so route and service imports cannot accidentally initialize production Firestore.

## Startup Guard Behavior

The backend fails fast in local, development, and test environments when:

- `FIRESTORE_EMULATOR_HOST` is missing.
- `GOOGLE_APPLICATION_CREDENTIALS` is present and `ALLOW_LOCAL_PROD_FIRESTORE` is not `true`.

The backend allows production startup unchanged when `NODE_ENV=production`.

## Override Process

The only local override is:

```bash
ALLOW_LOCAL_PROD_FIRESTORE=true
```

Use it only for explicit operator-approved diagnostics. When enabled, startup emits a warning banner. The override is not automatic, and it must not be committed to `.env` templates as enabled.

## Troubleshooting

### Backend fails with missing emulator host

Start the emulator and use the emulator scripts:

```bash
npm --prefix rentchain-api run emulator:firestore
npm --prefix rentchain-api run dev:emulator
```

### Backend fails because local credentials are present

Remove `GOOGLE_APPLICATION_CREDENTIALS` from the local shell or `.env` file. Local development should use the emulator.

### Emulator command cannot start

Verify Java:

```bash
java -version
```

Install Java 21 or newer if needed.

Verify Firebase CLI:

```bash
firebase --version
```

If it is not installed globally, run through your approved local tooling or install Firebase CLI following the official Firebase documentation.

### Tests try to reach production

Use backend test scripts from `rentchain-api/package.json`. They set emulator environment variables before Vitest starts.

## Verification Checklist

- `firebase.json` exists at repo root.
- Root `firestore.rules` is referenced by root `firebase.json`.
- `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` is present for local backend commands.
- `GOOGLE_APPLICATION_CREDENTIALS` is absent for local backend commands.
- Startup fails without emulator host in non-production environments.
- Startup fails with local credentials unless `ALLOW_LOCAL_PROD_FIRESTORE=true`.
- Production `start` behavior is unchanged.

## Security Rationale

Firestore production access is a protected operational boundary. Local tooling, editor terminals, test runners, smoke scripts, seed scripts, and migration utilities must not depend on human memory to avoid production credentials. The startup guard makes unsafe local Firestore access deterministic and visible before Firebase Admin initialization can create a Firestore client.
