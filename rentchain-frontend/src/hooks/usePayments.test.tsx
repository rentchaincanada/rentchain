import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePayments } from "./usePayments";

const mocks = vi.hoisted(() => ({
  fetchPayments: vi.fn(),
  auth: {
    user: {
      id: "admin-pro",
      landlordId: "landlord-pro",
      role: "admin",
    },
    token: "token-pro",
    ready: true,
    authStatus: "authed",
    isLoading: false,
  } as any,
}));

vi.mock("@/api/paymentsApi", () => ({
  fetchPayments: mocks.fetchPayments,
}));

vi.mock("@/context/useAuth", () => ({
  useAuth: () => mocks.auth,
}));

describe("usePayments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth = {
      user: {
        id: "admin-pro",
        landlordId: "landlord-pro",
        role: "admin",
      },
      token: "token-pro",
      ready: true,
      authStatus: "authed",
      isLoading: false,
    };
  });

  it("reloads payments when the authenticated landlord scope changes", async () => {
    mocks.fetchPayments
      .mockResolvedValueOnce([{ id: "payment-pro", amount: 100 }])
      .mockResolvedValueOnce([{ id: "payment-elite", amount: 200 }]);

    const { result, rerender } = renderHook(() => usePayments());

    await waitFor(() => expect(result.current.payments).toEqual([{ id: "payment-pro", amount: 100 }]));
    expect(mocks.fetchPayments).toHaveBeenCalledTimes(1);

    mocks.auth = {
      user: {
        id: "admin-elite",
        landlordId: "landlord-elite",
        role: "admin",
      },
      token: "token-elite",
      ready: true,
      authStatus: "authed",
      isLoading: false,
    };
    rerender();

    await waitFor(() => expect(mocks.fetchPayments).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.payments).toEqual([{ id: "payment-elite", amount: 200 }]));
  });

  it("clears payments and skips loading for non-landlord sessions", async () => {
    mocks.fetchPayments.mockResolvedValueOnce([{ id: "payment-pro", amount: 100 }]);
    const { result, rerender } = renderHook(() => usePayments());

    await waitFor(() => expect(result.current.payments).toEqual([{ id: "payment-pro", amount: 100 }]));

    mocks.auth = {
      user: {
        id: "tenant-1",
        tenantId: "tenant-1",
        role: "tenant",
      },
      token: "token-tenant",
      ready: true,
      authStatus: "authed",
      isLoading: false,
    };
    rerender();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.payments).toEqual([]);
    expect(mocks.fetchPayments).toHaveBeenCalledTimes(1);
  });
});
