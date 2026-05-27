#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const findingCategories = [
  "hard-failure",
  "possible-app-regression",
  "environment-browser-permission-issue",
  "expected-auth-gated-response",
  "expected-third-party-browser-noise",
];

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function rel(filePath, cwd = process.cwd()) {
  if (!filePath) return "";
  return path.relative(cwd, filePath) || ".";
}

function escapeCell(value) {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function safePreview(value, limit = 500) {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\s\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function walkFiles(dir) {
  if (!dir || !fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(entryPath);
    return [entryPath];
  });
}

function collectSpecs(suite, output = []) {
  for (const spec of suite.specs || []) output.push(spec);
  for (const child of suite.suites || []) collectSpecs(child, output);
  return output;
}

function allSpecs(report) {
  return (report.suites || []).flatMap((suite) => collectSpecs(suite));
}

function resultStatus(result) {
  return result?.status || "unknown";
}

function testOutcome(test) {
  return test.status || resultStatus(test.results?.[test.results.length - 1]);
}

function isPassOutcome(outcome) {
  return outcome === "passed" || outcome === "expected";
}

function isFailureOutcome(outcome) {
  return ["failed", "timedOut", "interrupted", "unexpected"].includes(outcome);
}

function zeroSummary() {
  return Object.fromEntries(findingCategories.map((category) => [category, 0]));
}

function attachmentJson(attachment) {
  try {
    if (!attachment?.body) return undefined;
    return JSON.parse(Buffer.from(attachment.body, "base64").toString("utf8"));
  } catch {
    return undefined;
  }
}

function artifactGroups(artifactDir) {
  const files = walkFiles(artifactDir);
  return {
    screenshots: files.filter((file) => /\.(png|jpg|jpeg)$/i.test(file)),
    traces: files.filter((file) => /trace.*\.zip$/i.test(file) || /\.zip$/i.test(file)),
    videos: files.filter((file) => /\.(webm|mp4)$/i.test(file)),
    reports: files.filter((file) => /qa-(summary|review-pack)\.(md|json)$/i.test(file)),
    json: files.filter((file) => /\.json$/i.test(file)),
  };
}

function parseRevisionVerification(filePath) {
  const text = readText(filePath);
  if (!filePath) {
    return {
      provided: false,
      status: "not-provided",
      summary: "No revision verification artifact was provided.",
    };
  }
  if (!text) {
    return {
      provided: true,
      file: filePath,
      status: "missing",
      summary: "Revision verification artifact path was provided but not found or empty.",
    };
  }
  const status = /Verified:/i.test(text)
    ? "verified"
    : /Could not confirm|No safe endpoint|Refusing|required|not found/i.test(text)
      ? "not-confirmed"
      : "recorded";
  return {
    provided: true,
    file: filePath,
    status,
    summary: safePreview(text, 1200),
  };
}

function summarize(report) {
  const counts = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    timedOut: 0,
    interrupted: 0,
  };
  const findingSummary = zeroSummary();
  const groupedFindings = Object.fromEntries(findingCategories.map((category) => [category, []]));
  const tests = [];

  for (const spec of allSpecs(report)) {
    for (const test of spec.tests || []) {
      counts.total += 1;
      const outcome = testOutcome(test);
      if (isPassOutcome(outcome)) counts.passed += 1;
      else if (outcome === "skipped") counts.skipped += 1;
      else if (outcome === "timedOut") counts.timedOut += 1;
      else if (outcome === "interrupted") counts.interrupted += 1;
      else counts.failed += 1;

      const result = test.results?.[test.results.length - 1];
      const errors = [
        ...(result?.errors || []).map((error) => error.message || String(error)),
        ...(result?.error ? [result.error.message || String(result.error)] : []),
      ];
      if (errors.length || isFailureOutcome(outcome)) {
        groupedFindings["hard-failure"].push({
          route: spec.title || test.title,
          message: errors.map((error) => safePreview(error, 500)).join(" | ") || `Test outcome: ${outcome}`,
        });
        findingSummary["hard-failure"] += errors.length || 1;
      }

      const classified = (result?.attachments || [])
        .filter((attachment) => attachment.name === "classified-smoke-findings")
        .map(attachmentJson)
        .filter(Boolean);

      for (const item of classified) {
        for (const [category, count] of Object.entries(item.summary || {})) {
          if (category in findingSummary) findingSummary[category] += Number(count || 0);
        }
        for (const finding of item.findings || []) {
          if (!(finding.category in groupedFindings)) continue;
          groupedFindings[finding.category].push({
            route: item.label || spec.title || test.title,
            severity: finding.severity || "info",
            message: safePreview(finding.message, 500),
          });
        }
      }

      tests.push({
        title: spec.title || test.title || "unnamed test",
        outcome,
        durationMs: result?.duration || 0,
      });
    }
  }

  return { counts, findingSummary, groupedFindings, tests };
}

function listPaths(files, cwd, limit = 20) {
  if (!files.length) return ["None"];
  const result = files.slice(0, limit).map((file) => rel(file, cwd));
  if (files.length > limit) result.push(`... ${files.length - limit} more`);
  return result;
}

function markdownList(items, cwd) {
  const values = Array.isArray(items) ? items : listPaths(items, cwd);
  if (!values.length) return "- None";
  if (values.length === 1 && values[0] === "None") return "- None";
  return values.map((item) => `- \`${item}\``).join("\n");
}

function groupedFindingBlock(groupedFindings, category) {
  const findings = groupedFindings[category] || [];
  if (!findings.length) return "- None";
  return findings
    .slice(0, 12)
    .map((finding) => `- ${finding.route || "unknown route"}: ${finding.message}`)
    .concat(findings.length > 12 ? [`- ... ${findings.length - 12} more`] : [])
    .join("\n");
}

function buildPack({ args, report, inputFile, artifactDir, htmlReportDir }) {
  const cwd = process.cwd();
  const summary = summarize(report);
  const artifacts = artifactGroups(artifactDir);
  const revision = parseRevisionVerification(args["revision-file"] ? path.resolve(args["revision-file"]) : "");
  const status = summary.counts.failed || summary.counts.timedOut || summary.counts.interrupted ? "failed" : "passed";
  const generatedAt = new Date().toISOString();
  const jsonPack = {
    generatedAt,
    status,
    previewUrl: args["preview-url"] || "",
    role: args.role || "",
    spec: args.spec || "",
    authMode: args["auth-mode"] || "unknown",
    revisionVerification: revision,
    counts: summary.counts,
    findingSummary: summary.findingSummary,
    groupedFindings: summary.groupedFindings,
    artifacts: {
      jsonReport: rel(inputFile, cwd),
      htmlReport: rel(htmlReportDir, cwd),
      artifactDir: rel(artifactDir, cwd),
      screenshots: listPaths(artifacts.screenshots, cwd),
      traces: listPaths(artifacts.traces, cwd),
      videos: listPaths(artifacts.videos, cwd),
      reports: listPaths(artifacts.reports, cwd),
    },
    tests: summary.tests,
    governanceNotes: [
      "Review pack contains local artifact paths and summarized findings only.",
      "Do not upload screenshots, traces, storage-state files, cookies, tokens, or private payloads unless the operator has confirmed they are safe.",
      "Expected auth-gated responses and third-party/browser noise should not be treated as product blockers without route-specific review.",
    ],
  };

  const markdown = [
    "# RentChain Claude QA Review Pack",
    "",
    "## Review Context",
    "",
    `- Generated: ${generatedAt}`,
    `- Status: ${status}`,
    `- Preview URL: ${args["preview-url"] || "not provided"}`,
    `- Role: ${args.role || "not provided"}`,
    `- Spec: ${args.spec || "not provided"}`,
    `- Auth mode: ${args["auth-mode"] || "unknown"}`,
    `- Revision verification: ${revision.status}`,
    "",
    "## Result Counts",
    "",
    "| Total | Passed | Failed | Skipped | Timed out | Interrupted |",
    "| ---: | ---: | ---: | ---: | ---: | ---: |",
    `| ${summary.counts.total} | ${summary.counts.passed} | ${summary.counts.failed} | ${summary.counts.skipped} | ${summary.counts.timedOut} | ${summary.counts.interrupted} |`,
    "",
    "## Finding Severity Groups",
    "",
    "| Group | Count |",
    "| --- | ---: |",
    `| Hard failures | ${summary.findingSummary["hard-failure"]} |`,
    `| Possible app regressions | ${summary.findingSummary["possible-app-regression"]} |`,
    `| Environment/browser warnings | ${summary.findingSummary["environment-browser-permission-issue"]} |`,
    `| Expected auth-gated behavior | ${summary.findingSummary["expected-auth-gated-response"]} |`,
    `| Third-party/browser informational noise | ${summary.findingSummary["expected-third-party-browser-noise"]} |`,
    "",
    "## Hard Failures",
    "",
    groupedFindingBlock(summary.groupedFindings, "hard-failure"),
    "",
    "## Possible App Regressions",
    "",
    groupedFindingBlock(summary.groupedFindings, "possible-app-regression"),
    "",
    "## Environment / Browser Warnings",
    "",
    groupedFindingBlock(summary.groupedFindings, "environment-browser-permission-issue"),
    "",
    "## Expected Auth-Gated Behavior",
    "",
    groupedFindingBlock(summary.groupedFindings, "expected-auth-gated-response"),
    "",
    "## Third-Party / Browser Informational Noise",
    "",
    groupedFindingBlock(summary.groupedFindings, "expected-third-party-browser-noise"),
    "",
    "## Revision Verification",
    "",
    `- Status: ${revision.status}`,
    `- Artifact: ${revision.file ? `\`${rel(revision.file, cwd)}\`` : "not provided"}`,
    `- Summary: ${revision.summary}`,
    "",
    "## Artifact Paths",
    "",
    `- JSON report: \`${rel(inputFile, cwd)}\``,
    `- HTML report: \`${rel(htmlReportDir, cwd)}\``,
    `- Artifact directory: \`${rel(artifactDir, cwd)}\``,
    "",
    "### Screenshots",
    "",
    markdownList(listPaths(artifacts.screenshots, cwd), cwd),
    "",
    "### Traces",
    "",
    markdownList(listPaths(artifacts.traces, cwd), cwd),
    "",
    "### Videos",
    "",
    markdownList(listPaths(artifacts.videos, cwd), cwd),
    "",
    "## Governance Notes",
    "",
    "- This pack is generated from local QA artifacts and is not committed by default.",
    "- It is safe to paste the Markdown summary into Claude when screenshots/traces/storage-state files are not included.",
    "- Do not expose cookies, tokens, storage-state JSON, raw private payloads, tenant documents, or sensitive screenshots.",
    "- Merge decisions still require required GitHub checks and operator approval.",
    "",
  ].join("\n");

  return { jsonPack, markdown };
}

const args = parseArgs(process.argv.slice(2));
const inputFile = args.input ? path.resolve(args.input) : "";
const markdownOutput = args.output ? path.resolve(args.output) : "";
const jsonOutput = args["json-output"] ? path.resolve(args["json-output"]) : "";

if (!inputFile || !markdownOutput || !jsonOutput) {
  console.error("Usage: generate-claude-qa-review-pack.mjs --input <qa-results.json> --output <qa-review-pack.md> --json-output <qa-review-pack.json>");
  process.exit(2);
}

if (!fs.existsSync(inputFile)) {
  console.error(`Playwright JSON report not found: ${inputFile}`);
  process.exit(1);
}

const artifactDir = path.resolve(args["artifact-dir"] || path.dirname(inputFile));
const htmlReportDir = path.resolve(args["html-report"] || "playwright-report");
const report = readJson(inputFile);
const { jsonPack, markdown } = buildPack({ args, report, inputFile, artifactDir, htmlReportDir });

ensureDir(markdownOutput);
ensureDir(jsonOutput);
fs.writeFileSync(markdownOutput, markdown);
fs.writeFileSync(jsonOutput, `${JSON.stringify(jsonPack, null, 2)}\n`);
console.log(`Wrote Claude QA review pack: ${markdownOutput}`);
console.log(`Wrote Claude QA review pack JSON: ${jsonOutput}`);
