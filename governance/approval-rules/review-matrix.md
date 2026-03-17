# Review Matrix

## Green
- Documentation-only work
- Small additive UI changes in approved scope
- Internal tooling with no runtime risk

## Yellow
- Backend logic changes
- Customer-facing behavior changes
- Multi-file work across frontend and backend
- Data-model or migration-adjacent tasks

## Red
- Auth
- Billing
- Secrets
- Infra
- CI/CD
- Production data migrations
- Destructive operations

Yellow work requires founder or designated reviewer approval before merge.
Red work requires explicit approval before implementation begins.
