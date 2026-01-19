export type AdminSystemLink = {
  name: string;
  url: string;
  description: string;
  category:
    | "Infrastructure"
    | "Email & Communications"
    | "Payments"
    | "Data"
    | "Domains/DNS"
    | "Deployments"
    | "Analytics";
};

export const adminSystems: AdminSystemLink[] = [
  {
    name: "Google Cloud Build",
    url: "https://console.cloud.google.com/cloud-build",
    description: "Build logs and CI pipeline history.",
    category: "Infrastructure",
  },
  {
    name: "Google Cloud Run",
    url: "https://console.cloud.google.com/run",
    description: "Backend services, revisions, and logs.",
    category: "Infrastructure",
  },
  {
    name: "Firestore",
    url: "https://console.firebase.google.com/project/_/firestore",
    description: "Database records and collections.",
    category: "Data",
  },
  {
    name: "SendGrid",
    url: "https://app.sendgrid.com/",
    description: "Email sending, API keys, deliverability.",
    category: "Email & Communications",
  },
  {
    name: "Stripe",
    url: "https://dashboard.stripe.com/",
    description: "Payments, products, webhooks, payouts.",
    category: "Payments",
  },
  {
    name: "Vercel",
    url: "https://vercel.com/dashboard",
    description: "Frontend deploys, env vars, logs.",
    category: "Deployments",
  },
  {
    name: "Porkbun",
    url: "https://porkbun.com/account/domains",
    description: "Domains, DNS, renewals.",
    category: "Domains/DNS",
  },
  {
    name: "GitHub",
    url: "https://github.com/",
    description: "Repos, PRs, Actions.",
    category: "Deployments",
  },
  {
    name: "Google Analytics",
    url: "https://analytics.google.com/",
    description: "Traffic and conversion metrics.",
    category: "Analytics",
  },
  {
    name: "Sentry",
    url: "https://sentry.io/",
    description: "Error monitoring and alerts.",
    category: "Analytics",
  },
];
