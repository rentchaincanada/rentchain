# Internal Dev Assistant Project Brief – RentChain (Landlord / Tenant Platform)

You are helping on a TypeScript full-stack project called **RentChain**.

It is a landlord / portfolio management and analytics platform with:

- **Backend:** Node.js + Express + TypeScript, Firestore
- **Frontend:** React + Vite + TypeScript
- **Core flow:** Applications → Tenants → Leases → Payments → Ledger Events → AI Insights

Your job is to generate code that is:
- Typed, modular, and scalable
- Event-driven (ledger-first)
- Investor-ready in UI polish
- Future-proof for multi-company and partner integrations

---

## 1. Current Core Domain Flows

### 1.1 Applications → Tenant Conversion

Backend:

- Main route: `POST /api/applications/:id/convert`
- Lives in: `rentchain-api/src/routes/applicationsRoutes.ts`
- Conversion logic lives in: `applicationConversionService.ts`

Flow:

1. Find the application by `id` (Firestore or stub).
2. Ensure status is `"Approved"` (set it if needed).
3. Create:
   - Tenant document in `tenants` collection.
   - Lease document in `leases` collection.
   - Ledger event for conversion (e.g. `TenantOnboarded` / initial event).
4. Return JSON:

```json
{
  "success": true,
  "applicationId": "a1",
  "tenantId": "TENANT_ID",
  "leaseId": "LEASE_ID",
  "ledgerEventId": "LEDGER_EVENT_ID",
  "convertedAt": "ISO_TIMESTAMP"
}
```

Frontend:

* API wrapper: `convertApplicationToTenant(id)` in `rentchain-frontend/src/api/applications.ts`
* UI: `ApplicationsPage.tsx`

  * Shows applications list and details
  * Has a **Convert to Tenant** button
  * On success:

    * Shows a toast notification
    * Updates local application status to `Approved`
    * Navigates to `/tenants?tenantId=<newTenantId>`

---

### 1.2 Tenants Page & Deep Linking

* Route: `/tenants`
* URL pattern: `/tenants?tenantId=<tenantId>` for deep-linking into a specific tenant

Frontend file: `rentchain-frontend/src/pages/TenantsPage.tsx`

Uses:

* `useTenants()` hook → calls `GET /api/tenants`
* `useTenantStore()` (global store) → holds `selectedTenantId`
* `useSearchParams()` → syncs `tenantId` from URL to store

Behavior:

* If `/tenants` is loaded **without** a `tenantId` query param:

  * Auto-select the **first tenant** from `useTenants`
  * Update URL to `?tenantId=<firstId>`
* When a row in the tenant list is clicked:

  * Set `selectedTenantId`
  * Navigate to `/tenants?tenantId=<thatId>`

Layout:

* Left side: tenant list (name, unit, property, balance)
* Right side: `<TenantDetailPanel tenantId={selectedTenantId} />`

---

### 1.3 Tenant Detail Panel (Upgraded)

* File: `rentchain-frontend/src/components/tenants/TenantDetailPanel.tsx`
* Data hook: `useTenantDetail(tenantId)`

  * Backend route: `GET /api/tenants/:tenantId/detail`
  * Returns a `TenantDetailBundle`

`TenantDetailBundle` includes:

* `tenant` (profile, balance, risk, status)
* `lease` (current lease info)
* `payments` (recent payments)
* `ledger` (recent ledger events)
* `insights` (AI / system insights array)

Panel sections:

1. **Header**

   * Tenant name
   * Property name + unit
   * Risk badge (`Low` / `Medium` / `High`) with colored chip

2. **Basics grid**

   * Email, phone
   * Lease start / end
   * Monthly rent (tenant or lease)
   * Current balance
   * Tenant status

3. **Lease Summary block** (if `lease` exists)

4. **Recent Payments block**

   * List of recent payments (date, amount, method, notes)
   * Each row may show a **✏️ Edit** button to open Edit Payment modal

5. **Ledger Events block**

   * List of recent ledger events (date, type, amount, notes)

6. **Smart Insights card**

   * Text-based insights generated from payments, ledger, and raw insights

7. **“View all ledger events →” button**

   * Navigates to `/ledger?tenantId=<tenantId>` (future ledger page)

---

### 1.4 Payments & Ledger

Backend:

* File: `rentchain-api/src/routes/paymentsRoutes.ts`
* Firestore collections:

  * `payments` (payment records)
  * `ledgerEvents` (events like `RentPaid`, `PaymentRecorded`, `PaymentModified`)

Key routes:

* `GET /api/payments` or `GET /api/payments?tenantId=...`
* `POST /api/payments/record`

  * Records a manual payment
  * Creates a payment in `payments`
  * Creates a matching ledger event (e.g. `RentPaymentRecorded`)
* `PATCH /api/payments/:id` (planned / partial)

  * Updates payment (amount, date, method, notes)
  * Creates a `PaymentModified` ledger event

Frontend:

* File: `rentchain-frontend/src/api/payments.ts`

  * `recordPayment(payload)` → `POST /api/payments/record`
  * `updatePayment(id, payload)` → `PATCH /api/payments/:id`
  * `PaymentRecord` type

* Hook: `rentchain-frontend/src/hooks/usePayments.ts`

  * `usePayments()` → loads payments (for future `/payments` page)

Manual payment:

* From Tenant Detail Panel:

  * A **Record Manual Payment** button
  * Opens a modal to enter amount, date, method, notes
  * On save:

    * Calls `recordPayment`
    * Updates local tenant payments / ledger state

Edit payment:

* From Recent Payments list:

  * **✏️ Edit** opens an Edit Payment modal
  * Fields: amount, paidAt, method, notes
  * On save:

    * Calls `updatePayment`
    * Updates local payments list in state
    * Backend logs `PaymentModified` ledger event

---

### 1.5 Demo / Seed Data

To make `/tenants` demo-friendly:

* In `tenantsRoutes.ts`, there is or will be a debug route:

  * `POST /api/debug/seed-demo-tenants`

    * Upserts several demo tenants into `tenants` collection
    * Fields: `id`, `fullName`, `propertyName`, `unit`, `status`, `riskLevel`, `monthlyRent`, `balance`, `leaseStart`, `leaseEnd`

* After calling this:

  * `GET /api/tenants` returns both seeded demo tenants and real converted tenants

---

## 2. Frontend Architecture & Style

* Bundled with Vite (`localhost:5173`)
* Uses React Router for pages

Shared components:

* `TopNav` – global navigation bar

Pages:

* `DashboardPage` – KPIs, property table, charts, AI insights
* `ApplicationsPage` – list + detail, status changes, conversion, PDF export
* `TenantsPage` – tenant list + detail panel
* `PropertiesPage` – currently a placeholder / in-progress

Styling:

* Mostly inline styles with a dark SaaS dashboard look:

  * Backgrounds like: `rgba(15,23,42,0.7)`
  * Subtle borders with slate-like colors
  * Rounded corners, small fonts, shadows

State patterns:

* Data hooks like:

  * `useTenants`
  * `useTenantDetail`
  * `usePayments`
* Global store:

  * `useTenantStore` to track `selectedTenantId`

---

## 3. Coding Conventions

When generating or modifying code:

### 3.1 TypeScript

* Use strict TypeScript with explicit types
* Reuse existing types:

  * `Application`
  * `TenantDetailBundle`
  * `TenantPayment`
  * `TenantLedgerEntry`
  * `PaymentRecord`
* Avoid `any` unless absolutely necessary (and then narrow quickly)

### 3.2 Frontend API Clients (`rentchain-frontend/src/api/*.ts`)

* Check `res.ok`
* On error:

  * `const text = await res.text();`
  * Try `JSON.parse(text)`
  * If `parsed.error` exists, use that as message
  * Else fallback to generic: `Failed to ...: ${res.status}`
* Throw `new Error(message)` on failure

### 3.3 Backend Routes (Express)

* Use async/await
* Wrap Firestore interactions in `try/catch`
* Log errors with `console.error("[RouteName] error:", err)`
* Respond with structured errors:

  * `res.status(400 or 500).json({ error: "..." })`
* Use clear route names and HTTP verbs:

  * GET = fetch
  * POST = create/record
  * PATCH = partial update

### 3.4 UI / Components

* Use functional React components
* Handle **loading**, **error**, and **empty** states
* Prefer inline style objects matching existing style
* Avoid adding new UI libraries without being asked
* Use toasts for user feedback on important actions (convert, save, error)

### 3.5 Multi-file Changes

If a change touches multiple layers:

1. Backend route in `rentchain-api/src/routes/...`
2. Frontend API wrapper in `rentchain-frontend/src/api/...`
3. Hook or component wiring in `src/pages` / `src/components`

Think in terms of:

> Applications → Tenants → Leases → Payments → Ledger → Insights

---

## 4. Long-Term Vision – Platform & AI

RentChain is evolving into a **fully autonomous property-management intelligence platform**.

You should generate code that supports:

* Scalability
* Automation
* Auditability
* Investor-ready polish

### 4.1 Core Future Goals

* End-to-end lifecycle automation:

  * Applications → Underwriting → Tenant creation → Lease generation → Payments → Ledger → AI analysis
* Real-time financial accuracy:

  * Every payment/lease action updates:

    * Tenant balance
    * Rent roll
    * Property KPIs
    * Portfolio KPIs
* Unified ledger:

  * Ledger is the source of truth
  * Any action (payment, charge, correction, fee, credit) emits a ledger event
* Autonomous AI insights:

  * Late-payment predictions
  * Risk-level changes
  * Tenant stability scores
  * Property NOI projections
  * Portfolio early warning signals

Future UI:

* Portfolio AI drawer
* Tenant AI summaries
* Anomaly detectors

---

### 4.2 Backend Vision

Architecture:

* Express + TypeScript, modular routes and services
* Firestore as primary DB
* Ledger-first event model

Planned expansions:

* Automated scheduled billing
* Automated delinquency detection
* AI underwriting pipelines
* Optional on-chain / immutable audit logs

Future endpoints (examples):

* `GET /portfolio/summary` – AI narrative + KPIs
* `GET /tenants/:id/timeline` – chronological event list
* `GET /properties/:id/kpi` – NOI, cashflow, risk, occupancy
* `POST /ai/insights` – portfolio-wide intelligence generation

---

### 4.3 Product Feel

RentChain should feel:

* **Fast** – snappy UX
* **Smart** – AI woven into flows
* **Trustworthy** – ledger-backed, auditable
* **Investor-grade** – portfolio metrics front and center
* **Self-operating** – minimal landlord intervention

Code should:

* Be scalable and reusable
* Follow current conventions
* Anticipate future needs
* Build toward a modular, intelligent SaaS

Internal Dev Assistant should prioritize:

* Clean TS/React
* Seamless API ↔ frontend integration
* Modals over `prompt()`
* Ledger events for every financial action
* Preparing for analytics and AI features
* Flexible, extendable pages/components
* Never breaking existing flows

---

## 5. Strategic Growth & Multi-Company Ecosystem

RentChain is evolving into a **multi-company infrastructure platform** connecting:

* Landlords
* Tenants
* Financial institutions
* Insurance providers
* Government housing agencies

Your code must support **ecosystem expansion**, not just landlord workflows.

### 5.1 Multi-Company Architecture

There will be:

**A. RentChain Landlord Platform** (current)

* Applications → Tenants → Leases → Payments → Ledger
* AI insights + portfolio tools
* Subscription + add-on marketplace

**B. Tenant Companion Platform** (future sister company)

* Tenant-facing web/app:

  * Tenant financial history dashboard
  * Payment verification + stability score
  * Reportable rental history
  * Dispute resolution
  * Tenant credit builder
  * Rent statements for immigration, loans, employment

Internal Dev Assistant must prepare for:

* Multi-tenant / multi-company auth
* Separated but interoperable databases
* Shared event streams (ledger → tenant app)
* Consent-based access tokens for data sharing

---

### 5.2 Insurance Partnerships

Insurers use RentChain for:

* Rental insurance verification
* Claim risk scoring
* Real-time property risk metrics
* Predictive modeling from tenant payment patterns
* Automated proof-of-rent documentation

Internal Dev Assistant should:

* Build `src/integrations/insurance/...` modules
* Support shared analytics services
* Use event-driven risk scoring based on ledger/property data
* Maintain audit logs for compliance

---

### 5.3 Banking & Financial Institutions

Banks use RentChain data to:

* Underwrite mortgages (landlord performance)
* Assess tenant affordability/stability
* Provide landlord credit lines / HELOCs
* Automate income verification from rent rolls

Internal Dev Assistant must:

* Generate exportable financial statements
* Structure per-property NOI
* Use ledger + loans to calculate real-time DSCR
* Provide read-only API endpoints for lenders
* Maintain tamper-evident audit trails

---

### 5.4 Government & Regulatory Use

Governments use RentChain to:

* Modernize rental registries
* Simplify landlord licensing
* Monitor affordability metrics
* Detect fraud / illegal rentals
* Track eviction-risk zones
* Integrate subsidies

Internal Dev Assistant should:

* Implement data anonymization pipelines
* Create export endpoints for statistical reporting
* Build a government dashboard (restricted access)
* Support multi-region Firestore layout
* Implement consent-based data governance

---

## 6. Subscriptions & Billing (Internal Dev Assistant-Ready)

RentChain will be a **subscription SaaS with per-use fees**.

### 6.1 Firestore Data Model

**Collection: `plans`**

```json
{
  "id": "pro",
  "name": "RentChain Pro",
  "priceMonthly": 49,
  "limits": {
    "activeApplications": "unlimited",
    "tenantCount": "unlimited",
    "aiInsights": true,
    "portfolioAI": false
  }
}
```

**Collection: `users`**

```json
{
  "id": "USER_ID",
  "email": "user@example.com",
  "subscription": {
    "planId": "pro",
    "status": "active",
    "renewalDate": "2025-03-01",
    "paymentProvider": "stripe",
    "featuresOverride": {}
  },
  "usage": {
    "creditReportsUsed": 4,
    "aiInsightsUsed": 12
  }
}
```

**Collection: `usageEvents`**

```json
{
  "userId": "USER_ID",
  "type": "CREDIT_PULL",
  "timestamp": "ISO_TIMESTAMP",
  "cost": 19.00
}
```

---

### 6.2 Backend Billing Architecture

Create new backend modules:

```text
src/
  billing/
    stripeClient.ts
    subscriptionService.ts
    usageService.ts
    creditReportBilling.ts
  routes/
    billingRoutes.ts
    creditReportRoutes.ts
```

Example routes:

* `POST /api/billing/create-checkout-session`
* `POST /api/billing/webhook`
* `GET /api/billing/subscription-status`
* `POST /api/credit/pull`

  * Charges per-use fee
  * Records usage
  * Returns credit report data
* `POST /api/ai/apply-insight`

  * Records AI insight usage

---

### 6.3 Frontend Subscription Integration

Global `useUser` state:

```ts
interface Subscription {
  planId: "free" | "pro" | "enterprise";
  status: "active" | "past_due" | "canceled";
}

interface UserState {
  subscription: Subscription;
  usage: Record<string, number>;
}
```

Feature gating helper:

```ts
function hasFeature(user: UserState, featureKey: string): boolean {
  const plan = PLANS[user.subscription.planId];
  return plan.features[featureKey] === true;
}
```

UI placement:

* `/settings/subscription` page:

  * Show current plan, usage, upgrade options
  * Buttons:

    * “Upgrade to Pro”
    * “Buy Credit Check ($19)”

* In Application Details:

  * If user clicks “Pull Credit”:

    * If Pro/Enterprise → show credit pull modal
    * If Free → show paywall / upgrade modal

---

### 6.4 AI-Driven Billing

AI actions with costs:

* AI Underwriting: ~$3 per application review
* Portfolio AI Summary: included in Pro
* Tenant AI Stability Score: included in Enterprise
* AI Ledger Audit: ~$0.50 per run

Internal Dev Assistant should generate:

* Endpoints
* DB updates
* Usage tracking
* Feature toggles
* Paywall modals
* Proper error handling and UX feedback

---

## 7. Security & Compliance

Prepare for:

* JWT auth with roles and scopes
* Consent tokens for tenant data sharing
* Secure audit ledger (future blockchain option)
* Immutable event log architecture
* Data residency rules by region/province

---

## 8. Guiding Principles for Internal Dev Assistant

Every time you generate code, prioritize:

1. **Scalability** – modular, typed, decoupled
2. **Ecosystem readiness** – consider sister apps and partners
3. **Event-driven design** – every important action emits an event
4. **Interoperability** – APIs that can be used by other systems
5. **AI-first architecture** – design for advanced analytics
6. **Compliance & auditability** – tamper-evident logs, clear histories
7. **Investor-grade professionalism** – robust backend, clean UI

Your ultimate goal:

> Help build a fully automated, investor-friendly property management and intelligence system that can serve landlords, tenants, insurers, lenders, and governments.
