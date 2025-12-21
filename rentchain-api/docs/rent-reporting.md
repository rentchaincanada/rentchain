# RentChain Credit Builder (Rent Reporting)

- Vision: let tenants opt in to report positive, on-time rent payments to bureaus to build credit and retention.
- Consent: **separate from screening consent**; tenant must explicitly opt in and can revoke. Copy should state positive-only, opt-in, and revocable.
- Scope: positive-only reporting (no negative payments in Phase 1); monthly automated furnishing cadence.
- Data handling: treat as sensitive; follow R4 (encryption at rest, retention windows, audit logging for access and furnishing actions).
- Disputes: placeholder — tenants can dispute furnished data; support flow will collect proof and issue corrections to partners.
- Partner: Equifax first (Canada) for coverage and tenant familiarity; additional partners may follow.
- Partner comparison placeholder: FrontLobby vs Landlord Credit Bureau — evaluate pricing, coverage, and dispute SLAs.
- Separation: completely separate from screening pipeline and Stripe screening payments; dedicated consent, pricing, and lifecycle.
- Policy: **No negative reporting in Phase 1**; only on-time/positive rent payments will be furnished.
