import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

type VercelRoute = {
  src?: string;
  dest?: string;
  handle?: string;
};

type VercelRewrite = {
  source: string;
  destination: string;
};

type VercelConfig = {
  routes: VercelRoute[];
  rewrites: VercelRewrite[];
};

const frontendRoot = process.cwd();
const config = JSON.parse(
  readFileSync(join(frontendRoot, "vercel.json"), "utf8"),
) as VercelConfig;

const productionApi =
  "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app";

describe("Vercel Preview backend route precedence", () => {
  it("routes the complete Preview suffix to the existing Function before filesystem misses", () => {
    expect(config.routes).toEqual([
      {
        src: "^/api/preview-backend/(.*)$",
        dest: "/api/preview-backend/[...path]?path=$1",
      },
      { handle: "filesystem" },
    ]);
    expect(
      existsSync(join(frontendRoot, "api/preview-backend/[...path].ts")),
    ).toBe(true);
  });

  it.each([
    "/api/preview-backend/api/me",
    "/api/preview-backend/api/auth/login",
  ])("reserves %s for the dedicated filesystem Function", (requestPath) => {
    const functionRoute = config.routes[0];
    const match = new RegExp(functionRoute.src as string).exec(requestPath);

    expect(match?.[1]).toBe(requestPath.slice("/api/preview-backend/".length));
    expect(functionRoute.dest?.replace("$1", match?.[1] ?? "")).toBe(
      `/api/preview-backend/[...path]?path=${match?.[1]}`,
    );
    expect(config.routes[1]).toEqual({ handle: "filesystem" });
  });

  it.each(["/api/properties", "/api/tenants"])(
    "retains the Production rewrite for %s after a filesystem miss",
    (requestPath) => {
      const rewrite = config.rewrites.find(
        ({ source }) => source === "/api/:path*",
      );
      expect(requestPath.startsWith("/api/")).toBe(true);
      expect(rewrite).toEqual({
        source: "/api/:path*",
        destination: `${productionApi}/api/:path*`,
      });
    },
  );

  it("preserves health and SPA fallbacks", () => {
    expect(config.rewrites).toContainEqual({
      source: "/health",
      destination: `${productionApi}/health`,
    });
    expect(config.rewrites.at(-1)).toEqual({
      source: "/:path*",
      destination: "/index.html",
    });
  });

  it("does not expose Preview Cloud Run or public-access configuration", () => {
    const serialized = JSON.stringify(config);
    expect(serialized).not.toContain(
      "rentchain-preview-backend-glistw4pya-nn.a.run.app",
    );
    expect(serialized).not.toContain("allUsers");
    expect(serialized).not.toContain("allAuthenticatedUsers");
  });
});
