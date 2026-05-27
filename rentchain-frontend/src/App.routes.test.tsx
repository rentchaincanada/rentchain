import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  cleanup();
  mockTenantToken = null;
});

vi.stubEnv("VITE_TENANT_PORTAL_ENABLED", "true");

vi.mock("./components/auth/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./components/auth/RequireAdmin", () => ({
  RequireAdmin: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./components/layout/LandlordNav", () => ({
  LandlordNav: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./components/auth/RequireTenant", () => ({
  RequireTenant: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./components/layout/TenantNav", () => ({
  TenantNav: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

let mockTenantToken: string | null = null;

vi.mock("./context/useAuth", () => ({
  useAuth: () => ({
    user: { id: "landlord_1", role: "landlord", landlordId: "landlord_1" },
    token: "test-token",
    isLoading: false,
    ready: true,
    authStatus: "authed",
  }),
}));

vi.mock("./lib/tenantAuth", () => ({
  getTenantToken: () => mockTenantToken,
}));

vi.mock("./features/automation/timeline/AutomationTimelinePage", () => ({
  default: () => <h1>Automation Timeline</h1>,
}));

vi.mock("./pages/admin/AutomationTimelineV1Page", () => ({
  default: () => <h1>Automation Timeline v1</h1>,
}));

vi.mock("./pages/admin/SupportDebugConsolePage", () => ({
  default: () => <h1>Support / Debug Console</h1>,
}));

vi.mock("./pages/admin/SecurityReliabilityConsolePage", () => ({
  default: () => <h1>Security & Reliability Console</h1>,
}));

vi.mock("./pages/admin/AdminTriageQueuePage", () => ({
  default: () => <h1>Admin Triage Queue</h1>,
}));

vi.mock("./pages/admin/AdminLeaseLifecycleReviewPage", () => ({
  default: () => <h1>Lease Lifecycle Review</h1>,
}));

vi.mock("./pages/admin/AdminAlertingPage", () => ({
  default: () => <h1>Admin Alerts</h1>,
}));

vi.mock("./pages/admin/AdminNotificationsPage", () => ({
  default: () => <h1>Admin Notifications</h1>,
}));

vi.mock("./pages/admin/AdminSecurityIncidentsPage", () => ({
  default: () => <h1>Security incidents</h1>,
}));

vi.mock("./pages/admin/AdminSupportEscalationsPage", () => ({
  default: () => <h1>Support escalations</h1>,
}));

vi.mock("./pages/admin/AdminReviewWorkspacesPage", () => ({
  default: () => <h1>Governed review workspaces</h1>,
}));

vi.mock("./pages/ReleaseGovernancePage", () => ({
  default: () => <h1>Release Governance Page</h1>,
}));

vi.mock("./pages/admin/PortfolioScorePage", () => ({
  default: () => <h1>Portfolio Score Foundation</h1>,
}));

vi.mock("./pages/admin/PortfolioScoreHistoryPage", () => ({
  default: () => <h1>Portfolio Score History</h1>,
}));

vi.mock("./pages/landlord/PortfolioHealthSummaryPage", () => ({
  default: () => <h1>Portfolio Health Summary</h1>,
}));

vi.mock("./pages/landlord/LandlordAnalyticsPage", () => ({
  default: () => <h1>Landlord Analytics Dashboard</h1>,
}));

vi.mock("./pages/DecisionInboxPage", () => ({
  default: () => <h1>Decision Inbox Page</h1>,
}));

vi.mock("./pages/AgentSupervisionPage", () => ({
  default: () => <h1>Agent Supervision Page</h1>,
}));

vi.mock("./pages/InstitutionExportsPage", () => ({
  default: () => <h1>Institution Export Preview Page</h1>,
}));

vi.mock("./pages/AuditCompliancePage", () => ({
  default: () => <h1>Audit Compliance Readiness Page</h1>,
}));

vi.mock("./pages/EvidencePackPage", () => ({
  default: () => <h1>Evidence Pack Preview Page</h1>,
}));

vi.mock("./pages/ReviewTimelinePage", () => ({
  default: () => <h1>Canonical Review Timeline Page</h1>,
}));

vi.mock("./pages/IdentityLayerPage", () => ({
  default: () => <h1>Identity Layer Page</h1>,
}));

vi.mock("./pages/InstitutionalSharingRoomPage", () => ({
  default: () => <h1>Institutional Sharing Rooms Page</h1>,
}));

vi.mock("./pages/VerifiedRentalHistoryPage", () => ({
  default: () => <h1>Verified Rental History Page</h1>,
}));

vi.mock("./pages/SettlementReadinessPage", () => ({
  default: () => <h1>Settlement Readiness Page</h1>,
}));

vi.mock("./pages/RegulatoryProfilePage", () => ({
  default: () => <h1>Regulatory Profiles Page</h1>,
}));

vi.mock("./pages/AssetTokenizationReadinessPage", () => ({
  default: () => <h1>Asset Tokenization Readiness Page</h1>,
}));

vi.mock("./pages/NetworkParticipantsPage", () => ({
  default: () => <h1>Network Participants Page</h1>,
}));

vi.mock("./pages/CrossOrganizationTrustPage", () => ({
  default: () => <h1>Cross Organization Trust Page</h1>,
}));

vi.mock("./pages/InstitutionOnboardingReadinessPage", () => ({
  default: () => <h1>Institution Onboarding Readiness Page</h1>,
}));

vi.mock("./pages/OperationalRiskPage", () => ({
  default: () => <h1>Operational Risk Page</h1>,
}));

vi.mock("./pages/InteroperabilityAdapterPage", () => ({
  default: () => <h1>Interoperability Adapter Page</h1>,
}));

vi.mock("./pages/landlord/PortfolioScorePage", () => ({
  default: () => <h1>Landlord Portfolio Score</h1>,
}));

vi.mock("./pages/public/SharedPortfolioScorePage", () => ({
  default: () => <h1>Shared Portfolio Score Page</h1>,
}));

vi.mock("./pages/landlord/ActionRecommendationsPage", () => ({
  default: () => <h1>Decision Inbox</h1>,
}));

vi.mock("./pages/tenant/TenantWorkspacePage", () => ({
  default: () => <h1>Tenant Dashboard</h1>,
}));

vi.mock("./pages/tenant/FeedbackSubmissionPage", () => ({
  default: () => <h1>Tenant Feedback Submission</h1>,
}));

vi.mock("./pages/tenant/TenantApplicationStatusPage", () => ({
  default: () => {
    const location = useLocation();
    return <h1>{`Tenant Application Status ${location.pathname}${location.search}`}</h1>;
  },
}));

describe("Routes: /tenant", () => {
  it("renders the tenant-first landing page without landlord pricing content", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/tenant"]}>
        <App />
      </MemoryRouter>
    );

    expect(
      await screen.findByText(/Your rental profile\. Secure, organized, and in your control\./i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Create free account/i)).not.toBeInTheDocument();
  });

  it("redirects authenticated tenants from the public tenant entry page to the tenant dashboard", async () => {
    mockTenantToken = "header.payload.signature";
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/tenant"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Tenant Dashboard/i)).toBeInTheDocument();
  });

  it("restores a safe preserved tenant route when an authenticated tenant lands on /tenant", async () => {
    mockTenantToken = "header.payload.signature";
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/tenant?next=%2Ftenant%2Fapplication"]}>
        <App />
      </MemoryRouter>
    );

    expect(
      await screen.findByText(/Tenant Application Status \/tenant\/application/i)
    ).toBeInTheDocument();
  });
});

describe("Routes: /register", () => {
  it("renders the signup page instead of a not-found dead end", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/register"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Create your RentChain account/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /tenant/dashboard", () => {
  it("renders the tenant dashboard route without falling into landlord surfaces", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/tenant/dashboard"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Tenant Dashboard/i)).toBeInTheDocument();
    expect(screen.queryByText(/DashboardPage/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /tenant/feedback", () => {
  it("renders the tenant feedback submission route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/tenant/feedback"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Tenant Feedback Submission/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /automation/timeline", () => {
  it("renders the Automation Timeline shell and does not fall through to NotFound", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/automation/timeline"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Automation Timeline/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /decision-inbox", () => {
  it("renders the read-only decision inbox route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/decision-inbox"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Decision Inbox Page/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /agent-supervision", () => {
  it("renders the read-only agent supervision route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/agent-supervision"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Agent Supervision Page/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /institution-exports", () => {
  it("renders the read-only institution export preview route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/institution-exports"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Institution Export Preview Page/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /audit-compliance", () => {
  it("renders the read-only audit compliance readiness route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/audit-compliance"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Audit Compliance Readiness Page/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /evidence-packs", () => {
  it("renders the read-only evidence pack preview route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/evidence-packs?scope=decision&scopeId=decision-1"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Evidence Pack Preview Page/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /review-timeline", () => {
  it("renders the canonical review timeline route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/review-timeline?scope=decision&scopeId=decision-1"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Canonical Review Timeline Page/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /identity-layer", () => {
  it("renders the permissioned identity layer route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/identity-layer?identityType=tenant&identityId=tenant-1"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Identity Layer Page/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /institutional-sharing-rooms", () => {
  it("renders the institutional sharing room route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/institutional-sharing-rooms"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Institutional Sharing Rooms Page/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /verified-rental-history", () => {
  it("renders the verified rental history route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/verified-rental-history?identityId=tenant-1"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Verified Rental History Page/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /settlement-readiness", () => {
  it("renders the settlement readiness route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/settlement-readiness?leaseId=lease-1"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Settlement Readiness Page/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /regulatory-profiles", () => {
  it("renders the regulatory profiles route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/regulatory-profiles?province=NS&municipality=Halifax"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Regulatory Profiles Page/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /asset-tokenization-readiness", () => {
  it("renders the asset tokenization readiness route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/asset-tokenization-readiness?propertyId=property-1"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Asset Tokenization Readiness Page/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /network-participants", () => {
  it("renders the network participants route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/network-participants?participantType=lender"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Network Participants Page/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /cross-organization-trust", () => {
  it("renders the cross-organization trust route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/cross-organization-trust?relationshipType=operational_trust"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Cross Organization Trust Page/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /institution-onboarding-readiness", () => {
  it("renders the institution onboarding readiness route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/institution-onboarding-readiness?institutionType=lender"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Institution Onboarding Readiness Page/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /operational-risk", () => {
  it("renders the operational risk route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/operational-risk?riskScope=institution"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Operational Risk Page/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /interoperability-adapters", () => {
  it("renders the interoperability adapters route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/interoperability-adapters?adapterType=lender"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Interoperability Adapter Page/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /analytics", () => {
  it("renders the landlord analytics dashboard route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/analytics"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Landlord Analytics Dashboard/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /timeline", () => {
  it("renders the canonical automation timeline admin view", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/timeline"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Automation Timeline v1/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /admin/support-console", () => {
  it("renders the admin support/debug console route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/admin/support-console"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Support \/ Debug Console/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /admin/ops", () => {
  it("renders the admin security and reliability console route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/admin/ops"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Security & Reliability Console/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /admin/triage", () => {
  it("renders the admin triage queue route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/admin/triage"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Admin Triage Queue/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /admin/lease-lifecycle-review", () => {
  it("renders the admin lease lifecycle review route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/admin/lease-lifecycle-review"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Lease Lifecycle Review/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: governed review workspace surfaces", () => {
  it("keeps the security incident review surface available behind the admin shell", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/admin/security/incidents"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Security incidents/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });

  it("keeps the support escalation review surface available behind the admin shell", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/admin/support/escalations"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Support escalations/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });

  it("keeps the governed review workspace surface available behind the admin shell", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/admin/review-workspaces"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Governed review workspaces/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /admin/alerts", () => {
  it("renders the admin alerting route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/admin/alerts"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Admin Alerts/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /admin/notifications", () => {
  it("renders the admin notifications route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/admin/notifications"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Admin Notifications/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /admin/release-governance", () => {
  it("renders the admin release governance route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/admin/release-governance?releaseVersion=v0.9.0-core-foundation"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Release Governance Page/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /admin/portfolio-score", () => {
  it("renders the admin portfolio score route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/admin/portfolio-score"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Portfolio Score Foundation/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /admin/portfolio-score/history", () => {
  it("renders the admin portfolio score history route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/admin/portfolio-score/history"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Portfolio Score History/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /portfolio-health", () => {
  it("renders the landlord portfolio health route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/portfolio-health"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Portfolio Health Summary/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /portfolio-score", () => {
  it("renders the landlord portfolio score route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/portfolio-score"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Landlord Portfolio Score/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /portfolio-score/shared/:token", () => {
  it("renders the shared portfolio score route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/portfolio-score/shared/token-1"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Shared Portfolio Score Page/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});

describe("Routes: /recommended-actions", () => {
  it("renders the landlord recommended actions route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/recommended-actions"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Decision Inbox/i)).toBeInTheDocument();
    expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
  });
});


describe("Routes: /tenant/application", () => {
  it("renders the tenant application route without falling into landlord surfaces", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/tenant/application"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Tenant Application Status/i)).toBeInTheDocument();
    expect(screen.queryByText(/Dashboard/i)).not.toBeInTheDocument();
  });
});

describe("Routes: tenant application aliases", () => {
  it("normalizes tenant apply links into the tenant application flow", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/tenant/apply/app-123"]}>
        <App />
      </MemoryRouter>
    );

    expect(
      await screen.findByText(/Tenant Application Status \/tenant\/application\?entry=application&applicationToken=app-123/i)
    ).toBeInTheDocument();
  });

  it("normalizes tenant invite redeem aliases into a tokenized redeem route", async () => {
    const { default: App } = await import("./App");
    render(
      <MemoryRouter initialEntries={["/tenant/invite/redeem/invite-123"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole("textbox", { name: /Invite token/i })).toHaveValue("invite-123");
  });
});
