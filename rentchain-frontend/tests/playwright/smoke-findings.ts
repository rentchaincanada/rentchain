import { expect, type TestInfo } from "@playwright/test";

export type SmokeFindingCategory =
  | "expected-auth-gated-response"
  | "expected-third-party-browser-noise"
  | "environment-browser-permission-issue"
  | "possible-app-regression"
  | "hard-failure";

export type SmokeFindingSeverity = "info" | "warning" | "failure";

export type ClassifiedSmokeFinding = {
  category: SmokeFindingCategory;
  severity: SmokeFindingSeverity;
  message: string;
};

export type SmokeFindingReportContext = {
  role?: "admin" | "landlord" | "tenant";
  routeOrFeature?: string;
  result?: "pass" | "fail" | "blocked";
};

const resourceStatusPattern = /Failed to load resource: the server responded with a status of (\d+)/i;

export function classifyConsoleFinding(message: string): ClassifiedSmokeFinding {
  const resourceStatus = message.match(resourceStatusPattern)?.[1];
  if (resourceStatus === "401" || resourceStatus === "403") {
    return {
      category: "expected-auth-gated-response",
      severity: "info",
      message,
    };
  }

  if (resourceStatus === "429") {
    return {
      category: "possible-app-regression",
      severity: "warning",
      message,
    };
  }

  if (
    /Content Security Policy directive: "font-src/i.test(message) ||
    /space-mono.*\.woff2/i.test(message) ||
    /Provider's accounts list is empty/i.test(message) ||
    /\[GSI_LOGGER\]/i.test(message) ||
    /FedCM .*NetworkError/i.test(message)
  ) {
    return {
      category: "expected-third-party-browser-noise",
      severity: "info",
      message,
    };
  }

  if (
    /MachPortRendezvousServer/i.test(message) ||
    /bootstrap_check_in/i.test(message) ||
    /Permission denied \(1100\)/i.test(message) ||
    /browserType\.launch/i.test(message)
  ) {
    return {
      category: "environment-browser-permission-issue",
      severity: "warning",
      message,
    };
  }

  return {
    category: "possible-app-regression",
    severity: "failure",
    message,
  };
}

export function summarizeSmokeFindings(findings: ClassifiedSmokeFinding[]) {
  return findings.reduce<Record<SmokeFindingCategory, number>>(
    (summary, finding) => {
      summary[finding.category] += 1;
      return summary;
    },
    {
      "expected-auth-gated-response": 0,
      "expected-third-party-browser-noise": 0,
      "environment-browser-permission-issue": 0,
      "possible-app-regression": 0,
      "hard-failure": 0,
    },
  );
}

export async function reportSmokeFindings(
  testInfo: TestInfo,
  label: string,
  consoleErrors: string[],
  pageErrors: string[],
  context: SmokeFindingReportContext = {},
) {
  const findings: ClassifiedSmokeFinding[] = [
    ...consoleErrors.map(classifyConsoleFinding),
    ...pageErrors.map((message) => ({
      category: "hard-failure" as const,
      severity: "failure" as const,
      message,
    })),
  ];

  const summary = summarizeSmokeFindings(findings);
  await testInfo.attach("classified-smoke-findings", {
    contentType: "application/json",
    body: Buffer.from(
      JSON.stringify(
        {
          testName: testInfo.title,
          role: context.role ?? null,
          routeOrFeature: context.routeOrFeature ?? label,
          result: context.result ?? (findings.some((finding) => finding.severity === "failure") ? "fail" : "pass"),
          label,
          summary,
          findings,
        },
        null,
        2,
      ),
    ),
  });

  for (const [category, count] of Object.entries(summary)) {
    if (count > 0) {
      testInfo.annotations.push({
        type: `smoke-${category}`,
        description: `${count} finding${count === 1 ? "" : "s"}`,
      });
    }
  }

  const failures = findings.filter((finding) => finding.severity === "failure");
  expect(failures, `${label} hard smoke failures`).toEqual([]);
}
