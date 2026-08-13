import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

type VercelRoute = {
  src?: string;
  dest?: string;
  handle?: string;
  status?: number;
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
        src: "^/api/pr1516-(?:bootstrap|notices(?:/.*)?)$",
        status: 404,
      },
      {
        src: "^/api/pr1525-readiness$",
        dest: "/api/pr1525-readiness",
      },
      {
        src: "^/api/pr1525-attachments/(.*)$",
        dest: "/api/pr1525-attachments/[...path]?path=$1",
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
    const functionRoute = config.routes[4];
    const match = new RegExp(functionRoute.src as string).exec(requestPath);

    expect(match?.[1]).toBe(requestPath.slice("/api/preview-backend/".length));
    expect(functionRoute.dest?.replace("$1", match?.[1] ?? "")).toBe(
      `/api/preview-backend/[...path]?path=${match?.[1]}`,
    );
    expect(config.routes[5]).toEqual({ handle: "filesystem" });
  });

  it("reserves the PR #1512 read-only QA suffix before filesystem misses", () => {
    const requestPath = "/api/pr1512-notices/api/landlord/notices";
    const functionRoute = config.routes[3];
    const match = new RegExp(functionRoute.src as string).exec(requestPath);
    expect(match?.[1]).toBe("api/landlord/notices");
    expect(functionRoute.dest?.replace("$1", match?.[1] ?? "")).toBe(
      "/api/pr1512-notices/[...path]?path=api/landlord/notices",
    );
    expect(existsSync(join(frontendRoot, "api/pr1512-notices/[...path].ts"))).toBe(true);
  });

  it("reserves the PR #1525 readiness proof before Production rewrites", () => {
    const requestPath = "/api/pr1525-readiness";
    const functionRoute = config.routes[1];
    expect(new RegExp(functionRoute.src as string).test(requestPath)).toBe(true);
    expect(functionRoute.dest).toBe("/api/pr1525-readiness");
    expect(existsSync(join(frontendRoot, "api/pr1525-readiness.ts"))).toBe(true);
  });

  it("reserves the strict PR #1525 attachment QA suffix before filesystem misses", () => {
    const requestPath = "/api/pr1525-attachments/tenant/api/tenant/maintenance-requests/qa-pr1525-target-request/attachments";
    const functionRoute = config.routes[2];
    const match = new RegExp(functionRoute.src as string).exec(requestPath);
    expect(match?.[1]).toBe("tenant/api/tenant/maintenance-requests/qa-pr1525-target-request/attachments");
    expect(existsSync(join(frontendRoot, "api/pr1525-attachments/[...path].ts"))).toBe(true);
  });

  it.each([
    "/api/pr1516-bootstrap",
    "/api/pr1516-notices/api/landlord/notices/recipients",
  ])("fails the retired PR #1516 QA path closed before Production rewrites: %s", (requestPath) => {
    const retiredRoute = config.routes[0];
    expect(new RegExp(retiredRoute.src as string).test(requestPath)).toBe(true);
    expect(retiredRoute).toMatchObject({ status: 404 });
    expect(retiredRoute.dest).toBeUndefined();
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
