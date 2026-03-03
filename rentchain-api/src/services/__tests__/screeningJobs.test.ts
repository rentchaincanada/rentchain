import { describe, expect, it } from "vitest";

import { canProgressJobStatus } from "../screeningJobs";

describe("screening job status progression", () => {
  it("allows forward progression", () => {
    expect(canProgressJobStatus("queued", "running")).toBe(true);
    expect(canProgressJobStatus("running", "provider_calling")).toBe(true);
    expect(canProgressJobStatus("provider_calling", "completed")).toBe(true);
    expect(canProgressJobStatus("provider_calling", "failed")).toBe(true);
    expect(canProgressJobStatus("external_pending", "external_completed")).toBe(true);
  });

  it("prevents regressions and terminal rewrites", () => {
    expect(canProgressJobStatus("running", "queued")).toBe(false);
    expect(canProgressJobStatus("provider_calling", "running")).toBe(false);
    expect(canProgressJobStatus("completed", "running")).toBe(false);
    expect(canProgressJobStatus("external_completed", "running")).toBe(false);
    expect(canProgressJobStatus("failed", "running")).toBe(false);
  });

  it("allows retry transition from failed only when explicitly enabled", () => {
    expect(canProgressJobStatus("failed", "queued")).toBe(false);
    expect(canProgressJobStatus("failed", "queued", true)).toBe(true);
  });
});
