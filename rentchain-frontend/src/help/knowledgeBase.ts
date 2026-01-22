export type KBEntry = {
  id: string;
  title: string;
  body: string;
  url: string;
  tags: string[];
  audience?: "landlord" | "tenant" | "general";
};

export const KNOWLEDGE_BASE: KBEntry[] = [
  {
    id: "landlord-getting-started",
    title: "Getting started as a landlord",
    body:
      "Set up your account, invite tenants, and start tracking lease events in one place. " +
      "Use the Help Center templates for notices and records when you are onboarding a new unit.",
    url: "/help/landlords",
    tags: ["landlord", "onboarding", "getting", "started", "lease", "records"],
    audience: "landlord",
  },
  {
    id: "landlord-invite-tenant",
    title: "How do I invite a tenant?",
    body:
      "Use the Invite flow from your landlord dashboard to send a secure tenant invite. " +
      "Tenants can accept the invite to connect their records to your property.",
    url: "/help/landlords",
    tags: ["invite", "tenant", "landlord", "onboarding"],
    audience: "landlord",
  },
  {
    id: "landlord-screening",
    title: "How does screening work?",
    body:
      "RentChain supports screening workflows with clear consent and record transparency. " +
      "Review screening steps and communicate expectations with applicants before you begin.",
    url: "/help/landlords",
    tags: ["screening", "applicants", "landlord", "consent"],
    audience: "landlord",
  },
  {
    id: "landlord-lease-events",
    title: "Tracking lease events",
    body:
      "Keep an accurate timeline of notices, payments, and incidents by logging lease events. " +
      "Consistent records help with reporting and future screenings.",
    url: "/help/landlords",
    tags: ["lease", "events", "records", "landlord"],
    audience: "landlord",
  },
  {
    id: "tenant-getting-started",
    title: "Getting started as a tenant",
    body:
      "Learn how RentChain stores rental history and what consent means for your data. " +
      "You can review records and understand how they are shared.",
    url: "/help/tenants",
    tags: ["tenant", "getting", "started", "consent", "records"],
    audience: "tenant",
  },
  {
    id: "tenant-consent",
    title: "Consent and transparency",
    body:
      "Tenants are informed when screenings or records are created and can review what is stored. " +
      "RentChain focuses on clarity so you know what information is visible.",
    url: "/help/tenants",
    tags: ["tenant", "consent", "privacy", "transparency"],
    audience: "tenant",
  },
  {
    id: "tenant-review-records",
    title: "How do I review my records?",
    body:
      "Your tenant dashboard shows your rental record history and related activity. " +
      "Check that information is accurate and contact support if you need help.",
    url: "/help/tenants",
    tags: ["tenant", "records", "review", "support"],
    audience: "tenant",
  },
  {
    id: "templates-downloads",
    title: "Where do I download templates?",
    body:
      "Templates for notices, ledgers, and checklists live in the Legal & Help section. " +
      "Browse the templates list and download the format you need.",
    url: "/site/legal",
    tags: ["templates", "downloads", "documents", "legal"],
    audience: "general",
  },
  {
    id: "invite-tenant-best-hit",
    title: "Invite a tenant",
    body:
      "Send a secure invite to connect a tenant to your property. " +
      "Invites are managed from the landlord help and onboarding guidance.",
    url: "/help/landlords",
    tags: ["invite", "tenant", "landlord", "onboarding"],
    audience: "landlord",
  },
  {
    id: "screening-best-hit",
    title: "How screening works",
    body:
      "Screenings follow consent-first steps and focus on clear, factual records. " +
      "Review the landlord help guide for more details.",
    url: "/help/landlords",
    tags: ["screening", "landlord", "consent"],
    audience: "landlord",
  },
  {
    id: "templates-best-hit",
    title: "Download templates",
    body:
      "Find notice, checklist, and ledger templates in the Legal & Help area. " +
      "Choose a PDF, DOCX, or CSV format depending on the template.",
    url: "/site/legal",
    tags: ["templates", "downloads", "legal"],
    audience: "general",
  },
  {
    id: "privacy-policy",
    title: "Privacy Policy",
    body:
      "Review how RentChain collects, stores, and uses personal data. " +
      "The privacy policy explains consent, retention, and security practices.",
    url: "/privacy",
    tags: ["privacy", "policy", "legal"],
    audience: "general",
  },
  {
    id: "contact-support",
    title: "Contact Support",
    body:
      "Need help with your account or records? Reach the support team through the Contact page.",
    url: "/contact",
    tags: ["contact", "support", "help"],
    audience: "general",
  },
  {
    id: "trust-security",
    title: "Trust & Security",
    body:
      "Learn how RentChain protects data, enforces consent, and keeps records transparent.",
    url: "/trust",
    tags: ["trust", "security", "privacy"],
    audience: "general",
  },
];
