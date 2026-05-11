# RentChain - Copilot & Codex Instructions
# STATUS: Copilot not yet configured. This file is a placeholder.
# When Copilot is enabled in VS Code, remove the STATUS line above.

## Stack
TypeScript monorepo. Frontend: React/Vite on Vercel. API: Express on Cloud Run.
Database: Firestore. Auth: Firebase JWT. IaC: Terraform. DNS: Porkbun -> rentchain.ai.

## Critical rule
Frontend API calls MUST use `import.meta.env.VITE_API_BASE_URL` as the base.
Never use relative `/api/` paths - they 404 on Vercel.

## Conventions
- TypeScript only (no .js in src/)
- Conventional commits: feat:, fix:, chore:, docs:
- No commits without human approval
- Node 20.11.1 pinned - do not upgrade

## Scope limits
Do not modify: *.tf, cloudbuild.yaml, Dockerfile, vercel.json, package.json,
*.lock, .env*, rentchain-ai-agent/, agent-system/, governance/
