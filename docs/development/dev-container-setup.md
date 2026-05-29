# Dev Container And Playwright Setup

## Purpose

The dev container provides a reproducible Node 20.11.1 environment with Playwright browsers and common command-line tools installed. It is optional: local development with `nvm use 20.11.1` and package-level `npm ci` remains supported.

## Container Quickstart

1. Install Docker Desktop or a compatible Docker daemon.
2. Install the VS Code Dev Containers extension.
3. Open the repository and run `Dev Containers: Reopen in Container`.
4. Confirm the runtime:

```bash
node --version
npm --version
npx playwright --version
```

Expected Node version: `v20.11.1`.

## Manual Container Build

Build the dev image from the repository root:

```bash
docker build -f docker/Dockerfile.dev -t rentchain-dev .
```

The image installs:

- Node 20.11.1
- Playwright 1.58.2
- Chromium, Firefox, and WebKit browser binaries
- `curl`, `jq`, `git`, and OpenSSH client tools

## Local Package Setup

Local setup remains package-scoped:

```bash
cd rentchain-api
npm ci
npm run test
npm run build
```

```bash
cd rentchain-frontend
npm ci
npm run test
npm run build
```

## Browser Test Commands

API package:

```bash
cd rentchain-api
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:debug
```

Frontend package:

```bash
cd rentchain-frontend
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:debug
```

Docker convenience command after building `rentchain-dev`:

```bash
cd rentchain-frontend
npm run test:docker
```

## Environment Variables

- `BASE_URL` controls the browser base URL for Playwright.
- `VITE_API_BASE_URL` is available in the dev container and defaults to `http://localhost:5001`.
- `QA_ARTIFACT_DIR` controls Playwright output artifacts.
- `QA_TRACE=on` enables full traces.
- `QA_VIDEO=on` enables full video capture.
- `PLAYWRIGHT_HEADED=1` runs browsers visibly.

Do not place secrets, credentials, or production tokens in committed environment files. Use local ignored files or shell environment variables.

## Ports

The dev container forwards:

- `3000` for alternate frontend workflows
- `5173` for Vite frontend
- `5001` for alternate API workflows
- `8080` for API workflows

## Artifacts

Generated browser artifacts are ignored by git:

- `test-results/`
- `playwright-report/`
- `.playwright/`

## Troubleshooting

If Docker is unavailable, use the local package setup above.

If Playwright reports missing browsers locally, run:

```bash
npx playwright install
```

If browser UI mode cannot open from inside the container, use headed command-line mode or run UI mode from the host. Some Linux, WSL2, and remote desktop setups require extra display forwarding.

If dependency volumes become stale inside the dev container, remove the named Docker volumes for `rentchain-api-node-modules` and `rentchain-frontend-node-modules`, then reopen the container.
