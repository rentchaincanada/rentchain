#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

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

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function escapeCell(value) {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function rel(filePath, cwd = process.cwd()) {
  if (!filePath) return "";
  return path.relative(cwd, filePath) || ".";
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
  for (const spec of suite.specs || []) {
    output.push(spec);
  }
  for (const child of suite.suites || []) {
    collectSpecs(child, output);
  }
  return output;
}

function allSpecs(report) {
  return (report.suites || []).flatMap((suite) => collectSpecs(suite));
}

function resultStatus(result) {
  if (!result) return "unknown";
  if (result.status) return result.status;
  return "unknown";
}

function testOutcome(test) {
  if (test.status) return test.status;
  const last = test.results?.[test.results.length - 1];
  return resultStatus(last);
}

function isFailureOutcome(outcome) {
  return ["failed", "timedOut", "interrupted", "unexpected"].includes(outcome);
}

function isPassOutcome(outcome) {
  return ["passed", "expected"].includes(outcome);
}

function isSkippedOutcome(outcome) {
  return outcome === "skipped";
}

function attachmentFile(baseDir, attachment) {
  if (!attachment?.path) return "";
  return path.isAbsolute(attachment.path) ? attachment.path : path.resolve(baseDir, attachment.path);
}

function readAttachmentJson(baseDir, attachment) {
  try {
    if (attachment.body) {
      const raw = Buffer.from(attachment.body, "base64").toString("utf8");
      return JSON.parse(raw);
    }
    const filePath = attachmentFile(baseDir, attachment);
    if (filePath && fs.existsSync(filePath)) {
      return readJson(filePath);
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function zeroFindingSummary() {
  return {
    "expected-auth-gated-response": 0,
    "expected-third-party-browser-noise": 0,
    "environment-browser-permission-issue": 0,
    "possible-app-regression": 0,
    "hard-failure": 0,
  };
}

function addFindingSummary(target, source = {}) {
  for (const key of Object.keys(target)) {
    target[key] += Number(source[key] || 0);
  }
}

function summarizeTests(report, baseDir) {
  const counts = {
    passed: 0,
    failed: 0,
    skipped: 0,
    timedOut: 0,
    interrupted: 0,
    flaky: 0,
    total: 0,
  };
  const findingSummary = zeroFindingSummary();
  const rows = [];

  for (const spec of allSpecs(report)) {
    for (const test of spec.tests || []) {
      counts.total += 1;
      const outcome = testOutcome(test);
      if (isPassOutcome(outcome)) counts.passed += 1;
      else if (isSkippedOutcome(outcome)) counts.skipped += 1;
      else if (outcome === "timedOut") counts.timedOut += 1;
      else if (outcome === "interrupted") counts.interrupted += 1;
      else if (isFailureOutcome(outcome)) counts.failed += 1;
      else counts.failed += 1;

      if (test.results && test.results.length > 1 && !isFailureOutcome(outcome)) {
        counts.flaky += 1;
      }

      const result = test.results?.[test.results.length - 1];
      const classified = (result?.attachments || [])
        .filter((attachment) => attachment.name === "classified-smoke-findings")
        .map((attachment) => readAttachmentJson(baseDir, attachment))
        .filter(Boolean);
      for (const item of classified) {
        addFindingSummary(findingSummary, item.summary);
      }

      rows.push({
        title: spec.title || test.title || "unnamed test",
        project: test.projectName || result?.projectName || "default",
        outcome,
        durationMs: result?.duration ?? 0,
        classifiedSummary: classified.map((item) => item.summary),
        errors: [
          ...(result?.errors || []).map((error) => error.message || String(error)),
          ...(result?.error ? [result.error.message || String(result.error)] : []),
        ],
      });
    }
  }

  return { counts, findingSummary, rows };
}

function artifactGroups(artifactDir) {
  const files = walkFiles(artifactDir);
  const byExt = {
    screenshots: files.filter((file) => /\.(png|jpg|jpeg)$/i.test(file)),
    traces: files.filter((file) => /trace.*\.zip$/i.test(file) || /\.zip$/i.test(file)),
    videos: files.filter((file) => /\.(webm|mp4)$/i.test(file)),
    markdown: files.filter((file) => /\.md$/i.test(file)),
    json: files.filter((file) => /\.json$/i.test(file)),
  };
  return byExt;
}

function listBlock(files, cwd, limit = 20) {
  if (!files.length) return "- None";
  const visible = files.slice(0, limit).map((file) => `- \`${rel(file, cwd)}\``);
  if (files.length > limit) {
    visible.push(`- ... ${files.length - limit} more`);
  }
  return visible.join("\n");
}

function compactFindingSummary(summary) {
  return Object.entries(summary)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${key}: ${count}`)
    .join("; ") || "none";
}

function buildMarkdown({ args, report, inputFile, artifactDir, htmlReportDir }) {
  const cwd = process.cwd();
  const { counts, findingSummary, rows } = summarizeTests(report, path.dirname(inputFile));
  const artifacts = artifactGroups(artifactDir);
  const status = counts.failed || counts.timedOut || counts.interrupted ? "failed" : "passed";
  const generatedAt = new Date().toISOString();

  const lines = [
    "# RentChain Preview QA Report",
    "",
    "## Run Metadata",
    "",
    `- Generated: ${generatedAt}`,
    `- Status: ${status}`,
    `- Preview URL: ${args["preview-url"] || "not provided"}`,
    `- Role: ${args.role || process.env.QA_ROLE || "not provided"}`,
    `- Spec: ${args.spec || process.env.QA_SPEC || "not provided"}`,
    `- Viewport coverage: ${args.viewport || "from Playwright suite"}`,
    `- JSON report: \`${rel(inputFile, cwd)}\``,
    `- HTML report: \`${rel(htmlReportDir, cwd)}\``,
    `- Artifact directory: \`${rel(artifactDir, cwd)}\``,
    "",
    "## Result Counts",
    "",
    "| Total | Passed | Failed | Skipped | Timed out | Interrupted | Flaky |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    `| ${counts.total} | ${counts.passed} | ${counts.failed} | ${counts.skipped} | ${counts.timedOut} | ${counts.interrupted} | ${counts.flaky} |`,
    "",
    "## Classified Findings",
    "",
    "| Category | Count |",
    "| --- | ---: |",
    ...Object.entries(findingSummary).map(([category, count]) => `| ${category} | ${count} |`),
    "",
    "## Route/Test Summary",
    "",
    "| Status | Project/Viewport | Test | Duration | Findings |",
    "| --- | --- | --- | ---: | --- |",
    ...rows.map((row) => {
      const findings = row.classifiedSummary.length
        ? row.classifiedSummary.map(compactFindingSummary).join("; ")
        : "none";
      return `| ${escapeCell(row.outcome)} | ${escapeCell(row.project)} | ${escapeCell(row.title)} | ${row.durationMs}ms | ${escapeCell(findings)} |`;
    }),
    "",
    "## Failure Details",
    "",
    ...rows
      .filter((row) => row.errors.length)
      .flatMap((row) => [
        `### ${row.title}`,
        "",
        ...row.errors.map((error) => `- ${escapeCell(error).slice(0, 500)}`),
        "",
      ]),
  ];

  if (!rows.some((row) => row.errors.length)) {
    lines.push("- No Playwright failure details recorded.", "");
  }

  lines.push(
    "## Artifact Locations",
    "",
    "### Screenshots",
    "",
    listBlock(artifacts.screenshots, cwd),
    "",
    "### Traces",
    "",
    listBlock(artifacts.traces, cwd),
    "",
    "### Videos",
    "",
    listBlock(artifacts.videos, cwd),
    "",
    "### Supporting JSON / Markdown",
    "",
    listBlock([...artifacts.json, ...artifacts.markdown], cwd),
    "",
    "## Review Notes",
    "",
    "- This report is generated from local Playwright artifacts and is not committed by default.",
    "- Treat expected auth-gated responses and known third-party/browser noise separately from hard failures.",
    "- Do not paste screenshots or traces into public channels if they contain private data, tokens, raw IDs, or user documents.",
    "- Merge decisions still require required GitHub checks and operator approval.",
    "",
  );

  return lines.join("\n");
}

const args = parseArgs(process.argv.slice(2));
const inputFile = args.input ? path.resolve(args.input) : "";
const outputFile = args.output ? path.resolve(args.output) : "";

if (!inputFile || !outputFile) {
  console.error("Usage: generate-playwright-qa-report.mjs --input <results.json> --output <qa-summary.md>");
  process.exit(2);
}

if (!fs.existsSync(inputFile)) {
  console.error(`Playwright JSON report not found: ${inputFile}`);
  process.exit(1);
}

const artifactDir = path.resolve(args["artifact-dir"] || path.dirname(inputFile));
const htmlReportDir = path.resolve(args["html-report"] || "playwright-report");
const report = readJson(inputFile);
const markdown = buildMarkdown({ args, report, inputFile, artifactDir, htmlReportDir });

ensureDir(outputFile);
fs.writeFileSync(outputFile, markdown);
console.log(`Wrote QA report: ${outputFile}`);
