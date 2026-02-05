# Rentchain

## Node.js requirement
This repo requires Node.js **20.x** (pinned to **20.11.1**). Node 24 is not supported due to tooling instability (notably Vite/esbuild and test runners).

### Quick setup
- macOS/Linux (nvm):
  - `nvm install 20.11.1`
  - `nvm use 20.11.1`
- Windows (nvm-windows):
  - `nvm install 20.11.1`
  - `nvm use 20.11.1`

The repo includes `.nvmrc` and `.node-version` plus a preflight check that fails fast if you use the wrong Node version.

## Pilot screening ops
See `docs/pilot-screening.md` for the Canada pilot flow, env vars, webhooks, and smoke checks.
