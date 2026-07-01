# Dashboard Payment Decision Queue Clarity Audit v1

Branch: `audit/dashboard-payment-decision-queue-clarity-v1`
Scope: audit and documentation only; no implementation, dashboard redesign, payment signal derivation, ledger changes, Operations changes, PAD/payment processing, CSV/PDF export, schema changes, or financial-record mutation.

## Purpose

This audit reviews Dashboard Decision Queue Preview payment cards now that payment signal consistency has been hardened by PR #1262 and Operations manual review metadata persistence has been validated by PR #1263.

The remaining issue is operator clarity. Dashboard payment decisions can now show a due date, but the preview card still lacks enough safe context for an operator to understand the issue before opening the ledger.

Observed Dashboard example:

```text
Review Missing Payment
Payments workspace - Mar 31
critical
```

This is better than the previous `No due date` state, but it still omits property/building, unit, tenant, amount due/outstanding, period, and reason for the alert.

## Enterprise Validation Filter

This mission advances:

- Revenue: clearer payment decisions support future payment workflow adoption and PAD readiness.
- Operational efficiency: operators can triage payment exceptions faster without opening every ledger.
- Enterprise readiness: the executive dashboard must show evidence-backed, explainable decisions.
- Customer validation: the one-building pilot needs dashboard payment cards that are credible and actionable.

## Files Reviewed

Frontend:

- `rentchain-frontend/src/pages/DashboardPage.tsx`
- `rentchain-frontend/src/pages/DashboardPage.test.tsx`
- `rentchain-frontend/src/api/landlordDecisionQueueApi.ts`

Backend:

- `rentchain-api/src/routes/landlordDecisionQueueRoutes.ts`
- `rentchain-api/src/services/landlordDecisionQueue/landlordDecisionQueueService.ts`
- `rentchain-api/src/services/landlordDecisionQueue/landlordDecisionQueueTypes.ts`
- `rentchain-api/src/routes/__tests__/landlordDecisionQueueRoutes.test.ts`

Related audit:

- `docs/audit/lease-ledger-payment-signal-consistency-v1.md`

## Current Dashboard Payment Card Behavior

Dashboard Decision Queue Preview consumes:

```text
DashboardPage
  -> fetchLandlordDecisionQueue({ status: "open_state", limit: 6 })
  -> GET /api/landlord/decision-queue
```

The Dashboard row currently renders:

```text
item.title
workspace label + item.dueAt
item.severity
Open
```

The relevant component is `DecisionRow` in `rentchain-frontend/src/pages/DashboardPage.tsx`. It does not render `item.description`, `item.recommendedActionLabel`, safe related labels, amount fields, or payment reason fields.

The Open action uses `item.recommendedActionHref` when it starts with `/`. For payment decisions this remains the correct destination when it points to:

```text
/leases/:leaseId/ledger
```

## Current Backend Queue Projection

`GET /api/landlord/decision-queue` derives queue items from:

- payment-consistent decision inbox items
- unified inbox records

For decision-inbox payment items, `normalizeDecisionInboxItems(...)` maps the source item into a generic `LandlordDecisionQueueItem`.

The backend queue type currently includes:

- `id`
- `sourceType`
- `sourceId`
- `workspace`
- `severity`
- `title`
- `description`
- `recommendedActionLabel`
- `recommendedActionHref`
- `dueAt`
- `createdAt`
- `updatedAt`
- `status`
- `dedupeKey`
- `sortKey`
- `priorityRank`
- optional related refs:
  - `propertyId`
  - `unitId`
  - `tenantId`
  - `leaseId`
  - `maintenanceRequestId`
  - `noticeId`

The frontend API type does not currently include the optional related refs, even though the backend type can carry them.

## Available Safe Fields Today

The existing Dashboard response can safely support:

- title
- workspace
- severity
- due date
- description
- recommended action label
- destination route
- related internal refs if they are used only for routing or lookup, not as visible labels

The current route test for genuine overdue payment decisions confirms the backend decision item can include:

- `title: "Review Missing Payment"`
- `workspace: "payments"`
- `recommendedActionHref: "/leases/y7XM6BFXIzWW0fV3mu1L/ledger"`
- `dueAt`
- description text containing an outstanding amount, for example `outstanding $2,000.00`

However, the response does not provide a Dashboard-ready safe context projection for:

- property/building label
- unit label
- tenant label
- expected amount
- paid amount
- outstanding amount
- payment period
- reason code or operator-readable reason
- current ledger state summary

## Gap

The dashboard preview is currently using a generic queue item shape for all decision types. That keeps the queue broadly reusable, but payment cards need a small, projection-safe context layer so operators can distinguish:

- a genuinely missing payment
- an overdue obligation
- an underpaid obligation
- a failed payment
- an overpayment/manual review case
- a lease whose ledger destination should be opened for evidence

Without this context, the Dashboard can be technically correct but still operationally vague.

## Destination Review

`/leases/:leaseId/ledger` remains the correct destination for payment decision cards.

Reasons:

- The ledger owns payment evidence, obligation rows, paid/outstanding state, and reconciliation context.
- Payment decision cards should preview the issue, not duplicate the ledger.
- Opening the ledger gives the operator the full source-of-truth evidence path.

The follow-up should preserve this route and improve preview context, not move payment decisions to a new dashboard-only page.

## Projection Safety

The follow-up should not render raw IDs as labels.

Safe labels should come from landlord-scoped projections or explicit display fields, such as:

- property/building safe label
- unit safe label
- tenant safe label only when available through a landlord-safe projection
- formatted currency values derived from queue/payment context
- due date or period labels
- reason copy from normalized payment decision metadata

If safe labels are unavailable, the UI should show a clear fallback such as:

```text
Payment ledger review
Due Mar 31 - Outstanding amount available in ledger
```

It should not show raw lease, tenant, unit, property, document, or Firestore IDs.

## Recommendation

Recommended follow-up mission:

```text
fix/dashboard-payment-decision-queue-context-v1
```

Recommended implementation owner: backend projection first, then a narrow Dashboard row display update.

### Recommended Scope

1. Add a payment-specific safe context projection to landlord decision queue items, or add a generic `context` object that can represent payment cards without exposing raw IDs.
2. Populate payment context for payment decision items where the data is already available from the payment-consistent decision derivation.
3. Include safe fields when available:
   - property/building label
   - unit label
   - tenant label
   - due date or period
   - expected amount
   - paid amount
   - outstanding amount
   - reason for alert
   - ledger state summary
4. Preserve `/leases/:leaseId/ledger` as the destination.
5. Update the frontend API type to include the new safe projection.
6. Update `DecisionRow` to render payment context compactly without redesigning Dashboard.
7. Add tests for valid payment decisions showing due date and amount context.
8. Add tests that raw IDs are not rendered as user-facing labels.

### Acceptance Criteria

- Dashboard payment decision cards show a clear payment context when available:
  - property/building
  - unit
  - tenant when projection-safe
  - amount outstanding
  - due date or period
  - reason for alert
- Dashboard payment decision cards no longer rely only on `Payments workspace - date`.
- The Open action still routes valid payment decisions to `/leases/:leaseId/ledger`.
- Genuine missing-payment cases still appear when ledger evidence supports them.
- Paid/up-to-date leases remain suppressed after PR #1262.
- No raw internal IDs are displayed as labels.
- No financial records, payment records, ledger entries, lease records, or schema are mutated.
- No PAD/payment processing, dashboard redesign, ledger redesign, CSV/PDF export, or Operations changes are introduced.

## Non-Goals For Follow-Up

Keep these separate:

- payment signal derivation changes
- lease ledger redesign
- dashboard redesign
- payment model or PAD implementation
- financial-record mutation
- Operations manual review metadata
- Operations navigation visibility
- CSV/PDF export

## Recommended Priority

Priority: high for RC1 demo readiness.

Rationale: PR #1262 made payment decisions materially more trustworthy. The next credibility step is making those trusted payment decisions explainable from the Dashboard without forcing operators to open every ledger first.
