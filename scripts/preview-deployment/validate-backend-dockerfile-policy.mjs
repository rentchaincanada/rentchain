#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const DOCKERFILE = "rentchain-api/Dockerfile";
const APPROVED_BASES = Object.freeze([
  "node:20.20.2-slim",
  "node:24.19.0-slim",
]);
const APPROVED_TRANSITIONS = new Set([
  "node:20.20.2-slim->node:24.19.0-slim",
]);

const EXPECTED_INSTRUCTIONS = Object.freeze([
  "FROM <BASE> AS build",
  "WORKDIR /app",
  "COPY package.json package-lock.json ./",
  "RUN npm ci",
  "COPY . .",
  "RUN npm run build",
  "FROM <BASE> AS runtime",
  "WORKDIR /app",
  "COPY package.json package-lock.json ./",
  "RUN npm ci --omit=dev && npm cache clean --force",
  "COPY --from=build /app/dist ./dist",
  "ENV NODE_ENV=production",
  "ENV PORT=8080",
  "EXPOSE 8080",
  "USER node",
  'CMD ["node", "dist/index.build.js"]',
]);

function readAtCommit(repository, sha) {
  return execFileSync("git", ["-C", repository, "show", `${sha}:${DOCKERFILE}`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function normalizedInstructions(source) {
  if (source.includes("\\\n")) {
    throw new Error("Dockerfile continuation lines are not permitted by the approved contract");
  }
  const lines = source
    .split(/\r?\n/u)
    .map((line) => line.trim());
  if (lines.some((line) => line.startsWith("#"))) {
    throw new Error("Dockerfile comments and parser directives are not permitted by the approved contract");
  }
  return lines
    .filter(Boolean)
    .map((line) => line.replace(/[\t ]+/gu, " "));
}

export function validateDockerfile(source) {
  const instructions = normalizedInstructions(source);
  if (instructions.length !== EXPECTED_INSTRUCTIONS.length) {
    throw new Error(`Dockerfile must contain exactly ${EXPECTED_INSTRUCTIONS.length} approved instructions`);
  }

  const build = /^FROM ([^ ]+) AS build$/u.exec(instructions[0]);
  const runtime = /^FROM ([^ ]+) AS runtime$/u.exec(instructions[6]);
  if (!build || !runtime) {
    throw new Error("Dockerfile must contain the exact build and runtime stages");
  }
  if (!APPROVED_BASES.includes(build[1]) || !APPROVED_BASES.includes(runtime[1])) {
    throw new Error("Dockerfile uses an unapproved Node base image");
  }
  if (build[1] !== runtime[1]) {
    throw new Error("Build and runtime stages must use the same approved Node base image");
  }

  const expected = EXPECTED_INSTRUCTIONS.map((instruction) => instruction.replace("<BASE>", build[1]));
  for (let index = 0; index < expected.length; index += 1) {
    if (instructions[index] !== expected[index]) {
      throw new Error(`Unapproved Dockerfile instruction at position ${index + 1}`);
    }
  }
  return { baseImage: build[1] };
}

export function validateDockerfileTransition({ trustedSource, candidateSource }) {
  const trusted = validateDockerfile(trustedSource);
  const candidate = validateDockerfile(candidateSource);
  if (candidate.baseImage !== trusted.baseImage && !APPROVED_TRANSITIONS.has(`${trusted.baseImage}->${candidate.baseImage}`)) {
    throw new Error(`Unapproved Node runtime transition: ${trusted.baseImage} -> ${candidate.baseImage}`);
  }
  return { trustedBaseImage: trusted.baseImage, candidateBaseImage: candidate.baseImage };
}

export function validateRepositoryDockerfile({ repository, trustedSha, sourceSha }) {
  return validateDockerfileTransition({
    trustedSource: readAtCommit(repository, trustedSha),
    candidateSource: readAtCommit(repository, sourceSha),
  });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const [repository, trustedSha, sourceSha] = process.argv.slice(2);
    if (!repository || !/^[0-9a-f]{40}$/u.test(trustedSha || "") || !/^[0-9a-f]{40}$/u.test(sourceSha || "")) {
      throw new Error("usage: validate-backend-dockerfile-policy.mjs <repository> <trusted-sha> <source-sha>");
    }
    const result = validateRepositoryDockerfile({ repository, trustedSha, sourceSha });
    console.log(`Trusted backend Dockerfile policy passed: ${result.trustedBaseImage} -> ${result.candidateBaseImage}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
