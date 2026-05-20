import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

type VercelHeader = {
  key: string;
  value: string;
};

type VercelHeaderRule = {
  source: string;
  headers: VercelHeader[];
};

type VercelRewrite = {
  source: string;
  destination: string;
};

type VercelConfig = {
  headers: VercelHeaderRule[];
  rewrites: VercelRewrite[];
};

const vercelConfig = JSON.parse(
  readFileSync(join(process.cwd(), "vercel.json"), "utf8"),
) as VercelConfig;

const requiredSecurityHeaders = [
  "Content-Security-Policy",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "Strict-Transport-Security",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
];

const getHeaderRule = (source: string) => {
  const rule = vercelConfig.headers.find((entry) => entry.source === source);
  expect(rule, `Missing Vercel header rule for ${source}`).toBeDefined();
  return rule as VercelHeaderRule;
};

const getHeaderMap = (rule: VercelHeaderRule) =>
  new Map(rule.headers.map((header) => [header.key, header.value]));

describe("frontend Vercel security headers", () => {
  it("applies one broad security baseline to all frontend routes", () => {
    const headerMap = getHeaderMap(getHeaderRule("/(.*)"));

    for (const headerName of requiredSecurityHeaders) {
      expect(headerMap.get(headerName), `Missing ${headerName}`).toBeTruthy();
    }
  });

  it("keeps cache policy and security headers non-conflicting per rule", () => {
    for (const source of ["/assets/(.*)", "/((?!assets/).*)", "/(.*)"]) {
      const rule = getHeaderRule(source);
      const normalizedHeaderNames = rule.headers.map((header) => header.key.toLowerCase());
      const permissionsPolicy = getHeaderMap(rule).get("Permissions-Policy");

      expect(new Set(normalizedHeaderNames).size).toBe(normalizedHeaderNames.length);
      expect(permissionsPolicy ?? "").not.toContain("browsing-topics");
    }

    expect(getHeaderMap(getHeaderRule("/assets/(.*)")).get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(getHeaderMap(getHeaderRule("/((?!assets/).*)")).get("Cache-Control")).toBe(
      "no-store",
    );
  });

  it("uses a conservative CSP that preserves required app integrations", () => {
    const csp = getHeaderMap(getHeaderRule("/(.*)")).get(
      "Content-Security-Policy",
    );

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src 'self' https://vercel.live");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("https://rentchain-landlord-api-915921057662.us-central1.run.app");
    expect(csp).toContain("https://*.a.run.app");
    expect(csp).toContain("https://*.rentchain.ai");
    expect(csp).toContain("https://*.googleapis.com");
    expect(csp).toContain("https://*.firebaseio.com");
    expect(csp).toContain("https://*.firebaseapp.com");
    expect(csp).toContain("https://*.stripe.com");
    expect(csp).toContain("frame-src 'self' blob: data: https:");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("preserves Cloud Run API rewrites before the SPA fallback", () => {
    const rewriteSources = vercelConfig.rewrites.map((rewrite) => rewrite.source);
    const apiRewrite = vercelConfig.rewrites.find((rewrite) => rewrite.source === "/api/:path*");

    expect(apiRewrite).toEqual({
      source: "/api/:path*",
      destination:
        "https://rentchain-landlord-api-915921057662.us-central1.run.app/api/:path*",
    });
    expect(rewriteSources.indexOf("/api/:path*")).toBeGreaterThan(-1);
    expect(rewriteSources.indexOf("/:path*")).toBeGreaterThan(rewriteSources.indexOf("/api/:path*"));
  });
});
