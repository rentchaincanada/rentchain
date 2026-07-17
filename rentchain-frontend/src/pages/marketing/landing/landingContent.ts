/**
 * landingContent.ts
 * All copy + structured data for the RentChain marketing landing page.
 *
 * Production-safe content for the native React marketing landing page:
 *  - no fabricated aggregate metrics
 *  - no fictional testimonials / U.S. cities
 *  - Canadian EFT payment terminology
 *  - neutral public entity name until legal entity is confirmed
 *  - no placeholder # social links
 *  - conservative free/pricing microcopy
 *
 * Intended location:
 * rentchain-frontend/src/pages/marketing/landing/landingContent.ts
 */

export type Accent = "pine" | "navy" | "amber" | "slate";
export type LifecycleStatus = "verified" | "pending" | "info";

export const header = {
  nav: [
    { label: "Features", href: "#features" },
    { label: "Solutions", href: "#who" },
    { label: "Pricing", href: "/site/pricing#plan-fit" },
    { label: "About", href: "#vision" },
  ],
  logins: [
    { label: "Landlord Portal", dotToken: "pine600", href: "/login?role=landlord" },
    { label: "Property Manager Portal", dotToken: "navy600", href: "/login?role=manager" },
    { label: "Tenant Portal", dotToken: "amber500", href: "/tenant" },
    { label: "Contractor Portal", dotToken: "slate600", href: "/contractor" },
  ],
  ctaLabel: "Book a demo",
  ctaHref: "/site/request-access",
};

export const hero = {
  kicker: "Housing Operations Infrastructure",
  titleLine1: "Connected housing",
  titleAccent: "operations.",
  subtitle:
    "RentChain connects landlords, tenants, contractors, and property managers through governed workflows for leasing, payments, maintenance, communication, evidence, and operational review.",
  primaryCta: { label: "Start free", href: "/signup?next=/properties&intent=registry_readiness" },
  secondaryCta: { label: "Book a demo", href: "/site/request-access" },
  microcopy: "Start with one property. Build the operating record as you grow.",
  personas: [
    { label: "Landlords", dotToken: "pine500" },
    { label: "Property managers", dotToken: "navy200" },
    { label: "Tenants", dotToken: "amber500" },
    { label: "Contractors", dotToken: "slate600" },
  ],
};

export const trustFlow = {
  kicker: "One operating record",
  title: "Every role, working from the same record",
  nodes: [
    { code: "LL", role: "Landlords", blurb: "Set terms, keep the proof.", accent: "pine" as Accent },
    { code: "PM", role: "Property managers", blurb: "Coordinate teams and work.", accent: "navy" as Accent },
    { code: "TN", role: "Tenants", blurb: "Pay, request, keep records.", accent: "amber" as Accent },
    { code: "CO", role: "Contractors", blurb: "Do the work, upload evidence.", accent: "slate" as Accent },
  ],
  hubKicker: "One shared record",
  hubTitle: "Every role writes to the same source of truth",
  hubBody:
    "Leases, payments, messages, maintenance activity, approvals, and evidence stay connected to the same operating history.",
};

export const whyRentChain = {
  kicker: "The RentChain difference",
  titlePlain: "Most platforms manage properties.",
  titleAccent: "RentChain manages operations.",
  insightKicker: "The operating advantage",
  insightTitle: "One operating history, from intake to outcome.",
  insightBody:
    "Property, lease, people, communication, payment, maintenance, and evidence context stay connected as work moves forward.",
  rows: [
    { from: "Property data", to: "Operational intelligence" },
    { from: "Messages", to: "Governed communication" },
    { from: "Documents", to: "Evidence packages" },
    { from: "Maintenance tickets", to: "Workflow coordination" },
    { from: "Payments", to: "Financial continuity" },
  ],
};

export const audiences = {
  kicker: "Shared work, role-aware views",
  title: "Landlords, managers, tenants, and contractors — connected without losing boundaries",
  cards: [
    {
      key: "landlords",
      code: "LL",
      role: "Landlords",
      accent: "pine" as Accent,
      points: ["Protect assets", "Reduce risk", "Increase visibility"],
    },
    {
      key: "propertyManagers",
      code: "PM",
      role: "Property managers",
      accent: "navy" as Accent,
      points: ["Coordinate portfolios", "Manage teams", "Standardize operations"],
    },
    {
      key: "tenants",
      code: "TN",
      role: "Tenants",
      accent: "amber" as Accent,
      points: ["Pay rent and keep receipts", "Send and track requests", "Keep documents in one place"],
    },
    {
      key: "contractors",
      code: "CO",
      role: "Contractors",
      accent: "slate" as Accent,
      points: ["Receive work orders", "Upload evidence", "Track approvals and payment status"],
    },
  ],
};

export const lifecycle = {
  kicker: "Connected lifecycle",
  title: "Every housing workflow contributes to one operating history",
  subtitle:
    "Every step writes to the same record. Tap through the lifecycle to see how nothing falls through the cracks.",
  autoAdvanceMs: 3800,
  steps: [
    {
      label: "Viewing request",
      title: "Viewing request",
      meta: "Mar 28 · prospect interest",
      amount: "Unit linked",
      status: "info" as LifecycleStatus,
      statusLabel: "Connected",
      body: "A prospect requests a viewing or shows interest. The request is connected to the property and unit record so the leasing workflow starts with context.",
    },
    {
      label: "Application & screening",
      title: "Application & screening",
      meta: "Mar 30 · application review",
      amount: "Consent tracked",
      status: "pending" as LifecycleStatus,
      statusLabel: "In review",
      body: "Application details, screening consent/status, and review notes stay connected to the applicant, unit, and landlord workspace.",
    },
    {
      label: "Leasing approval",
      title: "Leasing approval",
      meta: "Apr 2 · 12-month term",
      amount: "$1,450 / mo",
      status: "verified" as LifecycleStatus,
      statusLabel: "Approved",
      body: "Once approved, lease terms, deposits, documents, and signing steps move into one governed record.",
    },
    {
      label: "Move-in / occupied",
      title: "Move-in / occupied",
      meta: "Apr 15 · start date",
      amount: "Occupied",
      status: "info" as LifecycleStatus,
      statusLabel: "On record",
      body: "Move-in condition, keys, start date, and occupancy status are recorded so the unit is clearly marked occupied.",
    },
    {
      label: "Notices & maintenance",
      title: "Notices & maintenance",
      meta: "May 6 · entry notice",
      amount: "Work coordinated",
      status: "info" as LifecycleStatus,
      statusLabel: "Coordinated",
      body: "Maintenance notices to tenants, entry coordination, work orders, and contractor activity stay tied to the unit and lease.",
    },
    {
      label: "Tenant request",
      title: "Tenant request",
      meta: "May 9 · water heater",
      amount: "Priority: high",
      status: "pending" as LifecycleStatus,
      statusLabel: "Open",
      body: "Tenants submit maintenance requests from their portal. Each request is timestamped, routed, and tracked through resolution.",
    },
    {
      label: "Lease-end decision",
      title: "Lease-end decision",
      meta: "Feb 2027 · notice window",
      amount: "Options reviewed",
      status: "pending" as LifecycleStatus,
      statusLabel: "Decision point",
      body: "Lease-end notices, renewal options, rent changes where applicable, or move-out planning are handled from the operating history.",
    },
    {
      label: "Renewal or turnover",
      title: "Renewal or turnover",
      meta: "Mar 2027 · next cycle",
      amount: "Renew or vacant",
      status: "verified" as LifecycleStatus,
      statusLabel: "Next record",
      body: "Renew into a new lease, or complete move-out, turnover maintenance, and mark the unit vacant for the next leasing cycle.",
    },
  ],
};

export const pricingStart = {
  kicker: "Start free",
  title: "Start with one property. Build the operating record as you grow.",
  body:
    "Set up your first property, understand the workflow, and decide whether paid tools are worth it once you see the value in practice.",
  freeTitle: "Free includes",
  freeItems: [
    "First property setup",
    "Basic tenant/property organization",
    "Core workflow preview",
  ],
  paidTitle: "Paid plans add",
  paidItems: [
    "Deeper operational tools",
    "Filing and compliance support where available",
    "Portfolio-level oversight",
    "Stronger records and evidence workflows",
  ],
  pricingCta: { label: "View pricing", href: "/site/pricing#plan-fit" },
  primaryCta: { label: "Start free", href: "/signup?next=/properties&intent=registry_readiness" },
};

export const features = {
  kicker: "Platform surfaces",
  title: "Every lease, payment, repair, message, and decision — connected.",
  rows: [
    {
      key: "leasing",
      kicker: "Leasing & documents",
      title: "Digital workflows that leave a clean trail",
      body: "Send, sign, and store leases with every version tracked. Each signature becomes an evidence record you can produce on demand.",
      mockLeads: false,
    },
    {
      key: "payments",
      kicker: "Payments",
      title: "Rent collection with a built-in record",
      body: "Track rent, reconcile payment activity, and give everyone the same financial picture. Every transaction is timestamped and connected to the lease.",
      mockLeads: true,
    },
    {
      key: "maintenance",
      kicker: "Maintenance",
      title: "From request to resolved, coordinated",
      body: "Tenants report, managers approve, contractors deliver — and the evidence closes the loop. No more lost texts or he-said-she-said.",
      mockLeads: false,
    },
    {
      key: "communication",
      kicker: "Communication",
      title: "Conversations that stay on the record",
      body: "Centralized, trackable, governed. Messages attach to the lease, unit, or work order they are about — so context never gets lost in a phone.",
      mockLeads: true,
    },
  ],
  commandCenter: {
    kicker: "Operational command center",
    title: "See the whole operation at a glance",
    body: "Portfolio oversight, alerts, and decision support — so the things that need attention surface before they become problems.",
    sampleStatsNote: "Illustrative sample interface data, not company performance claims.",
    sampleStats: [
      { value: "98.4%", label: "on-time rent", accent: false },
      { value: "3", label: "need attention", accent: true },
      { value: "12", label: "open work orders", accent: false },
      { value: "142", label: "units governed", accent: false },
    ],
  },
};

export const operationalTrust = {
  kicker: "Evidence and governance",
  title: "Every action leaves a trail",
  subtitle:
    "RentChain is designed around the record: who said what, who approved what, what was paid, what was signed, and what evidence supports the outcome.",
  capabilities: [
    "Timestamped payment records",
    "One shared record for every party",
    "Evidence packages on demand",
    "Audit-ready operating history",
  ],
  cards: [
    {
      title: "Shared record",
      body: "Every action connects to the lease, unit, tenant, property, or work order it belongs to.",
    },
    {
      title: "Evidence-ready workflows",
      body: "Documents, messages, payments, and maintenance history stay organized for review when needed.",
    },
    {
      title: "Role-based access",
      body: "Landlords, tenants, contractors, and property managers each work from the right view of the same record.",
    },
  ],
  testimonials: [] as Array<{ quote: string; name: string; role: string }>,
};

export const aboutVision = {
  kicker: "The fragmentation problem",
  title: "Housing operations are fragmented",
  body: [
    "Critical information lives in emails, texts, spreadsheets, filing cabinets, and a dozen disconnected tools. When something goes wrong, no one can find the record that proves what happened.",
    "RentChain was built to bring every housing workflow into one operational system — where the record is shared, governed, and difficult to quietly change.",
  ],
  visionTitle: "Housing Operations Infrastructure",
  tags: [
    "Operational governance",
    "Institutional housing",
    "Evidence management",
    "Compliance support",
    "Government partnerships",
    "Scalable operations",
  ],
};

export const finalCta = {
  kicker: "Get started",
  title: "Run housing operations with confidence",
  subtitle: "Connect people, properties, workflows, and evidence on one shared, governed record.",
  primaryCta: { label: "Start free", href: "/signup?next=/properties&intent=registry_readiness" },
  secondaryCta: { label: "Book a demo", href: "/site/request-access" },
  microcopy: "Start free · Upgrade only when your workflow needs more support",
};

export const footer = {
  blurb:
    "The operating infrastructure for housing — connecting people, properties, and operations on one governed record.",
  columns: [
    {
      heading: "Solutions",
      links: [
        { label: "Landlords", href: "/site" },
        { label: "Property managers", href: "/site" },
        { label: "Tenants", href: "/tenant" },
        { label: "Contractors", href: "/contractor" },
      ],
    },
    {
      heading: "Platform",
      links: [
        { label: "Features", href: "/site" },
        { label: "Pricing", href: "/site/pricing#plan-fit" },
        { label: "Trust", href: "/trust" },
        { label: "Security", href: "/security" },
      ],
    },
    {
      heading: "Resources",
      links: [
        { label: "Help center", href: "/help" },
        { label: "Templates", href: "/help/templates" },
        { label: "Request access", href: "/site/request-access" },
        { label: "Contact", href: "/contact" },
      ],
    },
    {
      heading: "Company",
      links: [
        { label: "About", href: "/site/about" },
        { label: "Status", href: "/status" },
        { label: "Accessibility", href: "/accessibility" },
      ],
    },
  ],
  legal: {
    copyright: "© 2026 RentChain. All rights reserved.",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Acceptable use", href: "/acceptable-use" },
      { label: "Subprocessors", href: "/subprocessors" },
    ],
  },
  social: [] as Array<{ label: string; href: string }>,
};

export const landingContent = {
  header,
  hero,
  trustFlow,
  whyRentChain,
  audiences,
  lifecycle,
  pricingStart,
  features,
  operationalTrust,
  aboutVision,
  finalCta,
  footer,
};

export default landingContent;
