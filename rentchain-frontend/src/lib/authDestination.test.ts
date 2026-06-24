import { describe, expect, it } from "vitest";
import {
  DELEGATED_ACCESS_DEFAULT_DESTINATION,
  getRoleDefaultDestination,
  PROPERTY_MANAGER_COMPANY_DEFAULT_DESTINATION,
  getSafeTenantRedirect,
  resolveTenantPostAuthDestination,
  TENANT_DEFAULT_DESTINATION,
} from "./authDestination";

describe("authDestination tenant routing", () => {
  it("uses the tenant workspace as the tenant role default", () => {
    expect(getRoleDefaultDestination("tenant")).toBe(TENANT_DEFAULT_DESTINATION);
  });

  it("uses the delegated workspace as the delegate role default", () => {
    expect(getRoleDefaultDestination("delegate")).toBe(DELEGATED_ACCESS_DEFAULT_DESTINATION);
  });

  it("uses PM company management as the PM company role default", () => {
    expect(getRoleDefaultDestination("property_manager_company")).toBe(
      PROPERTY_MANAGER_COMPANY_DEFAULT_DESTINATION
    );
  });

  it("rejects public tenant entry routes as post-auth destinations", () => {
    expect(getSafeTenantRedirect("/tenant")).toBeNull();
    expect(getSafeTenantRedirect("/tenant/login?next=%2Ftenant%2Fprofile")).toBeNull();
    expect(getSafeTenantRedirect("/auth/magic?token=abc")).toBeNull();
  });

  it("allows safe tenant workspace routes and onboarding continuations", () => {
    expect(getSafeTenantRedirect("/tenant/profile")).toBe("/tenant/profile");
    expect(getSafeTenantRedirect("/tenant/application?step=documents")).toBe(
      "/tenant/application?step=documents"
    );
    expect(getSafeTenantRedirect("/auth/onboard?token=invite-123")).toBe(
      "/auth/onboard?token=invite-123"
    );
  });

  it("falls back to the tenant dashboard when no safe destination is preserved", () => {
    expect(resolveTenantPostAuthDestination({ search: "" })).toEqual({
      destination: TENANT_DEFAULT_DESTINATION,
      usedFallback: true,
      source: "fallback",
    });
  });

  it("preserves a safe tenant destination from query params", () => {
    expect(
      resolveTenantPostAuthDestination({
        search: "?next=%2Ftenant%2Fattachments",
      })
    ).toEqual({
      destination: "/tenant/attachments",
      usedFallback: false,
      source: "query",
    });
  });

  it("ignores a backend redirect to the public tenant entry page", () => {
    expect(
      resolveTenantPostAuthDestination({
        explicitDestination: "/tenant",
        backendRedirect: "/tenant",
        search: "",
      })
    ).toEqual({
      destination: TENANT_DEFAULT_DESTINATION,
      usedFallback: true,
      source: "fallback",
    });
  });
});
