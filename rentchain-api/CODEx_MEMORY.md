# RentChain: CODEx Memory File
This file teaches the VSCode CODEx assistant the architecture, vision,
naming standards, and coding style of the RentChain project.

## Core Identity
- RentChain is a multi-service platform for property management,
  fintech, insurance, credit, and government integrations.
- Architecture must support multiple companies:
  LandlordCo, TenantCo, InsuranceCo, GovAccess.

## System Style
- Event-driven backend (every action → ledger event).
- Firestore-first architecture, collections must be scalable.
- Typescript mandatory, strict typing enforced.
- Modular services: payments, leases, tenants, applications, ledger, AI.

## Data Principles
- Every mutation creates a ledger event.
- Ledger events are immutable.
- Use `tenantId`, `leaseId`, `propertyId`, `eventId` consistently.
- Avoid duplicating data unless required for performance.

## APIs
- REST-first, soon dual REST + GraphQL.
- Namespacing such as:
  /api/tenants, /api/payments, /api/leases, /api/applications.
- All major API calls return fully typed models.

## Frontend Style
- React + Vite + TypeScript.
- Panels must be modular and elegant, investor-ready visuals.
- Components should accept typed props and remain stateless.

## Features CODEx Should Expect
- Convert Application → Tenant + Lease + Ledger.
- Manual Payment recording.
- Modify Payment system.
- Tenant Deep Linking.
- Portfolio AI Summary engine.
- Property analytics dashboards.
- Risk scoring system.
- Event auditing and version history.

## Future Expansion
- Tenant app (sister platform).
- Credit report purchases.
- Tenant Insurance purchases
- Insurance validation and risk pricing.
- Bank underwriting outputs.
- Government registry integrations.
- Blockchain-based audit logs.
- Multi-region data residency.
- Subscription tiers + pay-per-use fees.

## Coding Rules
- Never generate code without Typescript interfaces.
- Always return clean JSON in APIs.
- Frontend must handle loading, error, empty states cleanly.
- Use event-driven naming: RentPaymentRecorded, PaymentModified, LeaseCreated.
- Prefer pure functions over shared state.
