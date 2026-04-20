import React from "react";
import { Link } from "react-router-dom";
import { MacShell } from "../../components/layout/MacShell";
import { Card, Pill, Section } from "../../components/ui/Ui";

type StatusTone = "healthy" | "review" | "action" | "unknown";

type SummaryItem = {
  label: string;
  status: string;
  tone: StatusTone;
  note: string;
};

type ConsoleCard = {
  title: string;
  description: string;
  status: string;
  tone: StatusTone;
  href?: string;
  note?: string;
};

type ConsoleSection = {
  title: string;
  description: string;
  cards: ConsoleCard[];
};

const PROJECT_ID = "project-0d9658de-af29-4dc0-a99";
const CLOUD_RUN_SERVICE = "rentchain-landlord-api";
const GITHUB_REPO = "https://github.com/rentchaincanada/rentchain";

const summaryItems: SummaryItem[] = [
  {
    label: "Production environment",
    status: "Healthy",
    tone: "healthy",
    note: "Primary production surfaces are deployed and should be verified from linked tools.",
  },
  {
    label: "Billing posture",
    status: "Review",
    tone: "review",
    note: "Check Stripe dashboard and Cloud Run billing logs before incident closeout.",
  },
  {
    label: "Email delivery",
    status: "Review",
    tone: "review",
    note: "Mailgun remains the supported provider; verify deliverability and auth mail volume there.",
  },
  {
    label: "Deployment posture",
    status: "Review",
    tone: "review",
    note: "Use GitHub Actions, Cloud Build, and Vercel to confirm current rollout state.",
  },
  {
    label: "Incident posture",
    status: "Unknown",
    tone: "unknown",
    note: "This page does not provide live incident detection. Confirm current state in logs and alerts.",
  },
];

const consoleSections: ConsoleSection[] = [
  {
    title: "Infrastructure",
    description: "Core infrastructure surfaces for runtime health, builds, artifacts, and secrets.",
    cards: [
      {
        title: "Cloud Run service",
        description: "Review backend service health, revisions, and traffic split.",
        status: "Healthy",
        tone: "healthy",
        href: `https://console.cloud.google.com/run/detail/us-central1/${CLOUD_RUN_SERVICE}?project=${PROJECT_ID}`,
      },
      {
        title: "Cloud Logging",
        description: "Inspect production request failures, auth issues, and reliability incidents.",
        status: "Review",
        tone: "review",
        href: `https://console.cloud.google.com/logs/query?project=${PROJECT_ID}`,
        note: "Start here for incident response and runtime verification.",
      },
      {
        title: "Cloud Build history",
        description: "Check recent image builds, failures, and deployment pipeline history.",
        status: "Review",
        tone: "review",
        href: `https://console.cloud.google.com/cloud-build/builds?project=${PROJECT_ID}`,
      },
      {
        title: "Artifact Registry",
        description: "Review published images and vulnerability scan posture.",
        status: "Review",
        tone: "review",
        href: `https://console.cloud.google.com/artifacts?project=${PROJECT_ID}`,
      },
      {
        title: "Secret Manager",
        description: "Confirm secret storage and rotation posture without exposing secret values here.",
        status: "Review",
        tone: "review",
        href: `https://console.cloud.google.com/security/secret-manager?project=${PROJECT_ID}`,
      },
    ],
  },
  {
    title: "Deployments",
    description: "Code, review, and deploy-entry surfaces across source control and hosting.",
    cards: [
      {
        title: "GitHub repository",
        description: "Open the repo for code review, incident context, and branch history.",
        status: "Healthy",
        tone: "healthy",
        href: GITHUB_REPO,
      },
      {
        title: "GitHub Actions",
        description: "Review workflow runs, CI failures, and deployment gating checks.",
        status: "Review",
        tone: "review",
        href: `${GITHUB_REPO}/actions`,
      },
      {
        title: "Pull requests",
        description: "Check open PRs and review backlog before deploy or incident response.",
        status: "Review",
        tone: "review",
        href: `${GITHUB_REPO}/pulls`,
      },
      {
        title: "Vercel deployments",
        description: "Review frontend deployment state, environment linkage, and rollback context.",
        status: "Review",
        tone: "review",
        href: "https://vercel.com/dashboard",
      },
      {
        title: "Domain and DNS",
        description: "Confirm DNS routing, domain renewal posture, and cutover configuration.",
        status: "Review",
        tone: "review",
        href: "https://porkbun.com/account/domains",
      },
    ],
  },
  {
    title: "Security",
    description: "Quick access to review security-sensitive surfaces and operational reminders.",
    cards: [
      {
        title: "GitHub security",
        description: "Inspect Dependabot, code scanning, and repository security alerts.",
        status: "Review",
        tone: "review",
        href: `${GITHUB_REPO}/security`,
      },
      {
        title: "Cloud Run env and secret review",
        description: "Verify runtime config, secret references, and deployment environment posture.",
        status: "Review",
        tone: "review",
        href: `https://console.cloud.google.com/run/detail/us-central1/${CLOUD_RUN_SERVICE}/revisions?project=${PROJECT_ID}`,
      },
      {
        title: "Artifact vulnerability scan",
        description: "Check image findings and base image posture before and after releases.",
        status: "Review",
        tone: "review",
        href: `https://console.cloud.google.com/artifacts?project=${PROJECT_ID}`,
      },
      {
        title: "Security reminder",
        description: "No secret values are displayed here. Review secrets only in Secret Manager.",
        status: "Healthy",
        tone: "healthy",
        note: "This console is links-and-summary only.",
      },
    ],
  },
  {
    title: "Reliability & Debugging",
    description: "Operational triage surfaces for incidents, alert review, and debugging flow.",
    cards: [
      {
        title: "Support / Debug Console",
        description: "Inspect resource-level timelines and derived state for incident triage.",
        status: "Review",
        tone: "review",
        href: "/admin/support-console",
      },
      {
        title: "Admin Alerts",
        description: "Review current alerting surfaces and unresolved platform warnings.",
        status: "Review",
        tone: "review",
        href: "/admin/alerts",
      },
      {
        title: "Admin Triage Queue",
        description: "Check queued issues that need investigation or operator follow-up.",
        status: "Review",
        tone: "review",
        href: "/admin/triage",
      },
      {
        title: "Billing route logs",
        description: "Use Cloud Logging to review checkout failures, Stripe connectivity, and portal errors.",
        status: "Review",
        tone: "review",
        href: `https://console.cloud.google.com/logs/query?project=${PROJECT_ID}`,
        note: "Filter for billing route names and Stripe-related failures.",
      },
      {
        title: "Email-related logs",
        description: "Use logging plus Mailgun to verify delivery failures and auth email behavior.",
        status: "Review",
        tone: "review",
        href: `https://console.cloud.google.com/logs/query?project=${PROJECT_ID}`,
      },
      {
        title: "Incident notes placeholder",
        description: "Use the linked tools as the source of truth. v1 does not store runbooks on-page.",
        status: "Unknown",
        tone: "unknown",
      },
    ],
  },
  {
    title: "Integrations",
    description: "External vendor surfaces that commonly matter during incidents or operator review.",
    cards: [
      {
        title: "Stripe dashboard",
        description: "Review billing products, checkout errors, webhooks, and payments.",
        status: "Review",
        tone: "review",
        href: "https://dashboard.stripe.com/",
      },
      {
        title: "Mailgun dashboard",
        description: "Review sending activity, deliverability, and domain status.",
        status: "Review",
        tone: "review",
        href: "https://app.mailgun.com/",
      },
      {
        title: "TransUnion operations notes",
        description: "Reserved placeholder for operator notes and provider-specific review entry points.",
        status: "Unknown",
        tone: "unknown",
        note: "No in-product console integration is added in v1.",
      },
      {
        title: "Equifax placeholder",
        description: "Future provider placeholder only. No active console link is exposed in v1.",
        status: "Unknown",
        tone: "unknown",
      },
    ],
  },
];

function getStatusStyle(tone: StatusTone): React.CSSProperties {
  switch (tone) {
    case "healthy":
      return { background: "#dcfce7", color: "#166534", borderColor: "#86efac" };
    case "review":
      return { background: "#fef3c7", color: "#92400e", borderColor: "#fcd34d" };
    case "action":
      return { background: "#fee2e2", color: "#b91c1c", borderColor: "#fca5a5" };
    default:
      return { background: "#e2e8f0", color: "#475569", borderColor: "#cbd5e1" };
  }
}

function ConsoleLink({ href }: { href: string }) {
  if (href.startsWith("/")) {
    return (
      <Link to={href} style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
        Open surface
      </Link>
    );
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
      Open external surface
    </a>
  );
}

export default function SecurityReliabilityConsolePage() {
  return (
    <MacShell title="Admin · Security & Reliability Console">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Security & Reliability Console</h1>
              <Pill tone="accent">Admin</Pill>
              <Pill style={getStatusStyle("unknown")}>v1 manual status model</Pill>
            </div>
            <div style={{ color: "#475569", maxWidth: 900 }}>
              Internal control page for production operations, security review, deployments, infrastructure, and incident-response entry points.
              Statuses here are lightweight operator indicators, not live monitoring claims.
            </div>
          </div>
        </Section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {summaryItems.map((item) => (
            <Card key={item.label} style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div style={{ fontWeight: 700 }}>{item.label}</div>
                <Pill style={getStatusStyle(item.tone)}>{item.status}</Pill>
              </div>
              <div style={{ color: "#475569", fontSize: 14 }}>{item.note}</div>
            </Card>
          ))}
        </div>

        {consoleSections.map((section) => (
          <Section key={section.title}>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gap: 4 }}>
                <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{section.title}</h2>
                <div style={{ color: "#64748b" }}>{section.description}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
                {section.cards.map((card) => (
                  <Card key={`${section.title}-${card.title}`} style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ fontWeight: 700 }}>{card.title}</div>
                      <Pill style={getStatusStyle(card.tone)}>{card.status}</Pill>
                    </div>
                    <div style={{ color: "#475569", minHeight: 60 }}>{card.description}</div>
                    {card.note ? <div style={{ color: "#64748b", fontSize: 13 }}>{card.note}</div> : null}
                    {card.href ? <ConsoleLink href={card.href} /> : <div style={{ color: "#64748b", fontSize: 13 }}>No direct link in v1.</div>}
                  </Card>
                ))}
              </div>
            </div>
          </Section>
        ))}
      </div>
    </MacShell>
  );
}
