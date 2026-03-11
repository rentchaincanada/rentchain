# AGENTS.md

## Scope Rules
Allowed to modify:
- rentchain-frontend/src/pages/tenant/**
- rentchain-frontend/src/api/tenant*.ts
- rentchain-frontend/src/api/maintenanceWorkflowApi.ts
- rentchain-frontend/src/components/layout/TenantNav.tsx
- rentchain-api/src/routes/tenant*.ts
- rentchain-api/src/routes/maintenanceRequestsRoutes.ts

Do not modify:
- vercel.json
- package.json
- package-lock.json
- pnpm-lock.yaml
- yarn.lock
- .env*
- infra/**
- terraform/**
- Dockerfiles
- deployment scripts
- .github/**
- billing / stripe files
- core auth routes unless explicitly required and justified

## Commit Policy
- Do not commit or push without explicit approval.
- After changes, run build, summarize diff, and stop.

## Safety
- Do not change production URLs, domains, secrets, CI/CD, or deployment config.
- Keep changes scoped to tenant maintenance and tenant communication center integration.
