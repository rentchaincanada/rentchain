import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PricingPage from "./PricingPage";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  fetchBillingPricing: vi.fn(),
  track: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("../../context/useAuth", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("../../api/billingApi", () => ({
  fetchBillingPricing: mocks.fetchBillingPricing,
}));

vi.mock("../../lib/analytics", () => ({
  track: mocks.track,
}));

function renderPricing(initialEntry = "/site/pricing") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/site/pricing" element={<PricingPage />} />
        <Route path="/" element={<div data-testid="landing-page">Landing</div>} />
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Marketing PricingPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.navigate.mockReset();
    mocks.useAuth.mockReset();
    mocks.fetchBillingPricing.mockReset();
    mocks.track.mockReset();
    mocks.useAuth.mockReturnValue({
      user: null,
    });
    mocks.fetchBillingPricing.mockResolvedValue({ ok: true, plans: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the public pricing route with warm brand copy and plan labels", async () => {
    const { container } = renderPricing("/site/pricing");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Start free\. Grow when your rental operations need more support\./i,
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Free / Starter" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Landlord / Operator" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Property Manager / Portfolio" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Enterprise / Institutional" })).toBeInTheDocument();
    expect(screen.getByText(/EFT/i)).toBeInTheDocument();
    const planFitSection = container.querySelector("#plan-fit");
    expect(planFitSection).toBeInTheDocument();
    expect(planFitSection).toContainElement(screen.getByRole("heading", { name: /Choose the support level/i }));

    await waitFor(() =>
      expect(mocks.track).toHaveBeenCalledWith("pricing_page_viewed", {
        surface: "marketing_pricing",
        currentPlan: "free",
        interval: "monthly",
        route: "/site/pricing",
      })
    );
  });

  it("anchors direct pricing links to the plan fit section", async () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView as Element["scrollIntoView"];

    try {
      const { container } = renderPricing("/site/pricing#plan-fit");
      const planFitSection = container.querySelector("#plan-fit");

      expect(planFitSection).toBeInTheDocument();
      expect(planFitSection).toContainElement(screen.getByRole("heading", { name: /Choose the support level/i }));
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" }));
    } finally {
      if (originalScrollIntoView) {
        Element.prototype.scrollIntoView = originalScrollIntoView;
      } else {
        delete (Element.prototype as Partial<Pick<Element, "scrollIntoView">>).scrollIntoView;
      }
    }
  });

  it("preserves the signed-out Start free signup and attribution flow", () => {
    renderPricing("/site/pricing?utm_source=linkedin&utm_medium=paid&utm_campaign=pricing&utm_content=warm");

    fireEvent.click(screen.getAllByRole("button", { name: "Start free" })[0]);

    expect(mocks.navigate).toHaveBeenCalledWith("/signup?next=/properties&intent=registry_readiness");
    expect(mocks.track).toHaveBeenCalledWith(
      "registry_landing_cta_clicked",
      expect.objectContaining({
        source: "linkedin",
        medium: "paid",
        campaign: "pricing",
        variant: "warm",
        location: "pricing_hero",
      })
    );
    expect(JSON.parse(window.localStorage.getItem("rentchain:registryAcquisitionAttribution") || "{}")).toEqual(
      expect.objectContaining({
        source: "linkedin",
        medium: "paid",
        campaign: "pricing",
        variant: "warm",
        landingPath: "/site/pricing?utm_source=linkedin&utm_medium=paid&utm_campaign=pricing&utm_content=warm",
      })
    );
  });

  it("routes authenticated Start free users to the properties workflow", () => {
    mocks.useAuth.mockReturnValue({
      user: { id: "landlord-1", plan: "free" },
    });

    renderPricing("/site/pricing");

    fireEvent.click(screen.getAllByRole("button", { name: "Start free" })[0]);

    expect(mocks.navigate).toHaveBeenCalledWith("/properties?intent=registry_readiness");
  });

  it("links request access actions to the request access page", () => {
    renderPricing("/site/pricing");

    expect(screen.getAllByRole("link", { name: "Request access" })[0]).toHaveAttribute(
      "href",
      "/site/request-access"
    );
    fireEvent.click(screen.getByRole("button", { name: "Request access" }));

    expect(mocks.navigate).toHaveBeenCalledWith("/site/request-access");
  });

  it("tracks billing interval changes and authenticated paid-plan actions", () => {
    mocks.useAuth.mockReturnValue({
      user: { id: "landlord-1", plan: "free" },
    });

    renderPricing("/site/pricing");

    fireEvent.click(screen.getByRole("button", { name: "Annual" }));
    expect(mocks.track).toHaveBeenCalledWith("pricing_interval_changed", {
      surface: "marketing_pricing",
      currentPlan: "free",
      interval: "yearly",
      route: "/site/pricing",
    });

    fireEvent.click(screen.getByRole("button", { name: "Review Starter in billing" }));

    expect(mocks.track).toHaveBeenCalledWith("pricing_plan_cta_clicked", {
      surface: "marketing_pricing",
      currentPlan: "free",
      targetPlan: "starter",
      interval: "yearly",
      action: "open_billing_hub",
      route: "/site/pricing",
    });
    expect(mocks.navigate).toHaveBeenCalledWith("/billing?upgradePlan=starter&upgradeInterval=year");
  });

  it("does not render placeholders, fake proof, hardcoded legal entity, or ACH terminology", () => {
    const { container } = renderPricing("/site/pricing");
    const content = container.cloneNode(true) as HTMLElement;
    content.querySelectorAll("style").forEach((node) => node.remove());
    const text = content.textContent || "";
    const links = Array.from(container.querySelectorAll("a"));

    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.getAttribute("href") && !link.getAttribute("href")?.startsWith("#"))).toBe(
      true
    );
    expect(text).not.toMatch(/testimonial/i);
    expect(text).not.toMatch(/98\.4%|142/);
    expect(text).not.toMatch(/RentChain,\s*Inc\./i);
    expect(text).not.toMatch(/\bACH\b/i);
  });

  it("uses a pricing-specific page scope while sharing the public marketing shell intentionally", () => {
    const { container } = renderPricing("/site/pricing");

    expect(container.querySelector(".rc-pricing-page")).toBeInTheDocument();
    expect(container.querySelector(".rc-landing")).toBeInTheDocument();
    expect(container.querySelector(".rc-pricing-page .rc-pricing-plan-grid")).toBeInTheDocument();
  });
});
