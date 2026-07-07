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
    { label: "Platform", href: "#lifecycle" },
    { label: "About", href: "#vision" },
  ],
  logins: [
    { label: "Landlord login", dotToken: "pine600", href: "/login?role=landlord" },
    { label: "Property manager login", dotToken: "navy600", href: "/login?role=manager" },
    { label: "Tenant login", dotToken: "amber500", href: "/tenant" },
    { label: "Contractor login", dotToken: "slate600", href: "/contractor" },
  ],
  ctaLabel: "Book a demo",
  ctaHref: "/site/request-access",
};

export const hero = {
  kicker: "The operating system for housing",
  titleLine1: "Housing operations.",
  titleAccent: "Connected.",
  subtitle:
    "One platform connecting landlords, tenants, contractors, and property managers — through governed workflows for communication, payments, maintenance, leasing, and evidence.",
  primaryCta: { label: "Start free", href: "/signup?next=/properties&intent=registry_readiness" },
  secondaryCta: { label: "Book a demo", href: "/site/request-access" },
  microcopy: "Start with your first property · No credit card required",
  personas: [
    { label: "Landlords", dotToken: "pine500" },
    { label: "Property managers", dotToken: "navy200" },
    { label: "Tenants", dotToken: "amber500" },
    { label: "Contractors", dotToken: "slate600" },
  ],
};

export const trustFlow = {
  kicker: "Built for real housing operations",
  title: "Every role, working from one shared record",
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
  kicker: "The difference",
  titlePlain: "Most platforms manage properties.",
  titleAccent: "RentChain manages operations.",
  rows: [
    { from: "Property data", to: "Operational intelligence" },
    { from: "Messages", to: "Governed communication" },
    { from: "Documents", to: "Evidence packages" },
    { from: "Maintenance tickets", to: "Workflow coordination" },
    { from: "Payments", to: "Financial continuity" },
  ],
};

export const audiences = {
  kicker: "Who it's for",
  title: "One system, four points of view",
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
  kicker: "Platform overview",
  title: "One continuous lifecycle, from lease to renewal",
  subtitle:
    "Every step writes to the same record. Tap through the lifecycle to see how nothing falls through the cracks.",
  autoAdvanceMs: 3800,
  steps: [
    {
      label: "Lease created",
      title: "Lease created",
      meta: "Apr 2 · 12-month term",
      amount: "$1,450 / mo",
      status: "verified" as LifecycleStatus,
      statusLabel: "Verified",
      body: "A signed lease opens the record. Terms, parties, and the deposit are logged once — the single source of truth everything else hangs off.",
    },
    {
      label: "Tenant moves in",
      title: "Tenant moves in",
      meta: "Apr 15 · keys + condition report",
      amount: "18 photos",
      status: "info" as LifecycleStatus,
      statusLabel: "On record",
      body: "Move-in condition is captured with photos and a signed report, so there is less confusion later about how the unit started.",
    },
    {
      label: "Rent collected",
      title: "Rent collected",
      meta: "May 1 · EFT ••2471",
      amount: "$1,450.00",
      status: "verified" as LifecycleStatus,
      statusLabel: "Verified",
      body: "Rent is collected and reconciled. Both sides see the same confirmation once the payment record is available.",
    },
    {
      label: "Maintenance request",
      title: "Maintenance request",
      meta: "May 9 · water heater",
      amount: "Priority: high",
      status: "pending" as LifecycleStatus,
      statusLabel: "Open",
      body: "A tenant reports an issue from their portal. It lands as a work order — timestamped, attributed, and ready to route.",
    },
    {
      label: "Contractor assigned",
      title: "Contractor assigned",
      meta: "May 9 · Rivera Plumbing",
      amount: "Approved",
      status: "info" as LifecycleStatus,
      statusLabel: "Assigned",
      body: "The manager approves and assigns the right contractor. The approval chain is part of the record, not a side conversation.",
    },
    {
      label: "Work completed",
      title: "Work completed",
      meta: "May 11 · photos + invoice",
      amount: "$320.00",
      status: "verified" as LifecycleStatus,
      statusLabel: "Verified",
      body: "The contractor uploads evidence of completed work and the invoice. The record shows what happened, when it happened, and what was approved.",
    },
    {
      label: "Evidence generated",
      title: "Evidence generated",
      meta: "May 11 · signed bundle",
      amount: "PDF + audit log",
      status: "verified" as LifecycleStatus,
      statusLabel: "Sealed",
      body: "Every step can be compiled into an evidence package for review, dispute preparation, audit support, or renewal decisions.",
    },
    {
      label: "Lease renewal",
      title: "Lease renewal",
      meta: "Mar 2027 · renewed 12 mo",
      amount: "$1,495 / mo",
      status: "verified" as LifecycleStatus,
      statusLabel: "Verified",
      body: "When it is time to renew, the full operating history is already there. Continuity, not a fresh start from scratch.",
    },
  ],
};

export const features = {
  kicker: "The platform",
  title: "Five surfaces. One source of truth.",
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
  kicker: "Operational trust",
  title: "Housing professionals need more than software",
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
  kicker: "Why we built RentChain",
  title: "Housing operations are fragmented",
  body: [
    "Critical information lives in emails, texts, spreadsheets, filing cabinets, and a dozen disconnected tools. When something goes wrong, no one can find the record that proves what happened.",
    "RentChain was built to bring every housing workflow into one operational system — where the record is shared, governed, and difficult to quietly change.",
  ],
  visionTitle: "Building housing infrastructure for the next generation",
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
  subtitle:
    "Join the platform connecting people, properties, and operations — on one shared, governed record.",
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
        { label: "Pricing", href: "/site/pricing" },
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
  features,
  operationalTrust,
  aboutVision,
  finalCta,
  footer,
};

export default landingContent;
