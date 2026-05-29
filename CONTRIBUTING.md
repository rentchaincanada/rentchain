# Contributing

## Dev Container Quickstart

This repository includes an optional dev container for QA infrastructure work. It pins Node 20.11.1, installs Playwright 1.58.2, and forwards the frontend and API development ports.

Use it from VS Code with `Dev Containers: Reopen in Container`, or build it manually:

```bash
docker build -f docker/Dockerfile.dev -t rentchain-dev .
```

Full setup and troubleshooting details are in `docs/development/dev-container-setup.md`.

Local package setup remains supported:

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
