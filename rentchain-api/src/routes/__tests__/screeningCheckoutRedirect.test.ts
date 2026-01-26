import { describe, expect, it } from "vitest";
import { __testing } from "../rentalApplicationsRoutes";

describe("screening checkout redirect allowlist", () => {
  it("allows rentchain origin", () => {
    expect(__testing.isAllowedRedirectOrigin("https://www.rentchain.ai")).toBe(true);
  });

  it("allows vercel preview origins", () => {
    expect(__testing.isAllowedRedirectOrigin("https://example.vercel.app")).toBe(true);
  });

  it("rejects unknown origins", () => {
    expect(__testing.isAllowedRedirectOrigin("https://evil.com")).toBe(false);
  });

  it("builds redirect URLs from paths", () => {
    const url = __testing.buildRedirectUrl({
      input: "/screening/success",
      fallbackPath: "/screening/success",
      frontendOrigin: "https://www.rentchain.ai",
      applicationId: "app_123",
      returnTo: "/dashboard",
    });
    expect(url).toContain("https://www.rentchain.ai/screening/success");
    expect(url).toContain("applicationId=app_123");
    expect(url).toContain("returnTo=%2Fdashboard");
  });

  it("rejects disallowed absolute URLs", () => {
    const url = __testing.buildRedirectUrl({
      input: "https://evil.com/boom",
      fallbackPath: "/screening/cancel",
      frontendOrigin: "https://www.rentchain.ai",
      applicationId: "app_123",
      returnTo: "/dashboard",
    });
    expect(url).toBeNull();
  });
});
