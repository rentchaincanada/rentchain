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
        src: "^/api/pr1516-notices/(.*)$",
        dest: "/api/pr1516-notices/[...path]?path=$1",
      },
      {
        src: "^/api/pr1512-notices/(.*)$",
        dest: "/api/pr1512-notices/[...path]?path=$1",
      },
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
    const functionRoute = config.routes[2];
    const match = new RegExp(functionRoute.src as string).exec(requestPath);

    expect(match?.[1]).toBe(requestPath.slice("/api/preview-backend/".length));
    expect(functionRoute.dest?.replace("$1", match?.[1] ?? "")).toBe(
      `/api/preview-backend/[...path]?path=${match?.[1]}`,
    );
    expect(config.routes[3]).toEqual({ handle: "filesystem" });
  });

  it("reserves the PR #1512 read-only QA suffix before filesystem misses", () => {
    const requestPath = "/api/pr1512-notices/api/landlord/notices";
    const functionRoute = config.routes[1];
    const match = new RegExp(functionRoute.src as string).exec(requestPath);
    expect(match?.[1]).toBe("api/landlord/notices");
    expect(functionRoute.dest?.replace("$1", match?.[1] ?? "")).toBe(
      "/api/pr1512-notices/[...path]?path=api/landlord/notices",
    );
    expect(existsSync(join(frontendRoot, "api/pr1512-notices/[...path].ts"))).toBe(true);
  });

  it("reserves the PR #1516 read-only QA suffix before filesystem misses", () => {
    const requestPath = "/api/pr1516-notices/api/landlord/notices/recipients";
    const functionRoute = config.routes[0];
    const match = new RegExp(functionRoute.src as string).exec(requestPath);
    expect(match?.[1]).toBe("api/landlord/notices/recipients");
    expect(functionRoute.dest?.replace("$1", match?.[1] ?? "")).toBe(
      "/api/pr1516-notices/[...path]?path=api/landlord/notices/recipients",
    );
    expect(existsSync(join(frontendRoot, "api/pr1516-notices/[...path].ts"))).toBe(true);
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
