import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DebugPanel } from "./DebugPanel";
import { fetchAccountLimits } from "../api/accountApi";
import { setAuthToken } from "../lib/authToken";

vi.mock("../api/accountApi", () => ({
  fetchAccountLimits: vi.fn(),
}));

describe("DebugPanel", () => {
  beforeEach(() => {
    vi.mocked(fetchAccountLimits).mockReset();
    setAuthToken(null);
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1280,
    });
  });

  it("stays hidden without an authenticated landlord token", () => {
    render(<DebugPanel />);

    expect(screen.queryByText("Debug (dev only)")).not.toBeInTheDocument();
    expect(fetchAccountLimits).not.toHaveBeenCalled();
  });

  it("stays hidden on mobile so it cannot cover bottom navigation", async () => {
    setAuthToken("demo-token");
    window.innerWidth = 390;
    render(<DebugPanel />);

    await waitFor(() => expect(fetchAccountLimits).not.toHaveBeenCalled());
    expect(screen.queryByText("Debug (dev only)")).not.toBeInTheDocument();
  });

  it("renders account limits on authenticated desktop dev sessions", async () => {
    setAuthToken("demo-token");
    vi.mocked(fetchAccountLimits).mockResolvedValue({
      status: "ok",
      plan: "elite",
      capabilities: {
        "ai.insights": true,
        screening: true,
        "team.invites": false,
      },
      usage: {
        properties: 2,
        units: 4,
      },
      integrity: {
        ok: true,
      },
    });

    render(<DebugPanel />);

    expect(await screen.findByText("Debug (dev only)")).toBeInTheDocument();
    expect(screen.getByText("Plan: elite")).toBeInTheDocument();
    expect(screen.getByText("Properties: 2")).toBeInTheDocument();
    expect(screen.getByText("Team Invites: no")).toBeInTheDocument();
  });
});
