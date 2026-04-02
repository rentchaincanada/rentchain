import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEntitlements } from "./useEntitlements";

vi.mock("@/hooks/useCapabilities", () => ({
  useCapabilities: vi.fn(),
}));

vi.mock("@/context/useAuth", () => ({
  useAuth: vi.fn(),
}));

describe("useEntitlements", () => {
  it("maps canonical capabilities to landlord-facing booleans", async () => {
    const { useCapabilities } = await import("@/hooks/useCapabilities");
    const { useAuth } = await import("@/context/useAuth");

    vi.mocked(useCapabilities).mockReturnValue({
      caps: { plan: "pro" },
      features: {
        screening: true,
        screening_history: true,
        pdf_export: true,
        move_in_readiness: true,
        work_orders: true,
        review_summary: true,
      },
      loading: false,
    } as any);
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", role: "landlord", plan: "pro" },
    } as any);

    const { result } = renderHook(() => useEntitlements());

    expect(result.current.plan).toBe("pro");
    expect(result.current.canScreen).toBe(true);
    expect(result.current.canViewScreeningHistory).toBe(true);
    expect(result.current.canExportPdf).toBe(true);
    expect(result.current.hasMoveInReadiness).toBe(true);
    expect(result.current.canUseWorkOrders).toBe(true);
    expect(result.current.canViewReviewSummary).toBe(true);
  });

  it("uses safe fallbacks when only legacy capability keys are present", async () => {
    const { useCapabilities } = await import("@/hooks/useCapabilities");
    const { useAuth } = await import("@/context/useAuth");

    vi.mocked(useCapabilities).mockReturnValue({
      caps: { plan: "starter" },
      features: {
        screening_pay_per_use: true,
        tenant_invites: true,
        maintenance: true,
        exports_basic: false,
      },
      loading: false,
    } as any);
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-2", role: "landlord", plan: "starter" },
    } as any);

    const { result } = renderHook(() => useEntitlements());

    expect(result.current.canScreen).toBe(true);
    expect(result.current.canViewScreeningHistory).toBe(true);
    expect(result.current.hasMoveInReadiness).toBe(true);
    expect(result.current.canUseWorkOrders).toBe(true);
    expect(result.current.canExportPdf).toBe(false);
    expect(result.current.canViewReviewSummary).toBe(false);
  });

  it("keeps Starter screening available even when the capability payload is behind the intended product policy", async () => {
    const { useCapabilities } = await import("@/hooks/useCapabilities");
    const { useAuth } = await import("@/context/useAuth");

    vi.mocked(useCapabilities).mockReturnValue({
      caps: { plan: "starter" },
      features: {
        screening: false,
        screening_pay_per_use: false,
      },
      loading: false,
    } as any);
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-3", role: "landlord", plan: "starter" },
    } as any);

    const { result } = renderHook(() => useEntitlements());

    expect(result.current.canScreen).toBe(true);
    expect(result.current.canViewScreeningHistory).toBe(false);
  });
});
