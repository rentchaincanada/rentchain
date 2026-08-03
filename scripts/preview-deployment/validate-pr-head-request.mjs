#!/usr/bin/env node

import fs from "node:fs";

const TRUSTED_REPOSITORY = "rentchaincanada/rentchain";
const TRUSTED_BASE = "main";
const FULL_SHA = /^[0-9a-f]{40}$/;
const PR_NUMBER = /^[1-9][0-9]*$/;

export function validatePrHeadRequest({
  metadata,
  prNumber,
  expectedHeadSha,
  expectedBaseSha,
  authorizationReference,
}) {
  if (!PR_NUMBER.test(prNumber)) throw new Error("PR number must be a positive integer");
  if (!FULL_SHA.test(expectedHeadSha)) throw new Error("Expected head SHA must be 40 lowercase hexadecimal characters");
  if (!FULL_SHA.test(expectedBaseSha)) throw new Error("Expected base SHA must be 40 lowercase hexadecimal characters");
  if (!authorizationReference || authorizationReference.length > 200 || /[\r\n]/.test(authorizationReference)) {
    throw new Error("Authorization reference must be a non-empty single-line value of at most 200 characters");
  }
  if (String(metadata.number) !== prNumber) throw new Error("PR number does not match GitHub metadata");
  if (metadata.state !== "open") throw new Error("PR must be open");
  if (metadata.base?.ref !== TRUSTED_BASE) throw new Error("PR base branch must be main");
  if (metadata.base?.repo?.full_name !== TRUSTED_REPOSITORY) throw new Error("PR base repository is not trusted");
  if (metadata.head?.repo?.full_name !== TRUSTED_REPOSITORY) throw new Error("Fork or untrusted head repository is not allowed");
  if (metadata.head?.repo?.fork === true) throw new Error("Fork pull requests are not allowed");
  if (metadata.head?.sha !== expectedHeadSha) throw new Error("Authorized head SHA no longer matches the PR head");
  if (metadata.base?.sha !== expectedBaseSha) throw new Error("Authorized base SHA no longer matches the PR base");

  return {
    prNumber,
    sourceSha: expectedHeadSha,
    baseSha: expectedBaseSha,
    imageTag: `pr-${prNumber}-sha-${expectedHeadSha}`,
    authorizationReference,
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [metadataPath, prNumber, expectedHeadSha, expectedBaseSha, authorizationReference] = process.argv.slice(2);
  if (!metadataPath) {
    console.error("usage: validate-pr-head-request.mjs <metadata.json> <pr-number> <head-sha> <base-sha> <authorization-reference>");
    process.exit(2);
  }
  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    process.stdout.write(`${JSON.stringify(validatePrHeadRequest({ metadata, prNumber, expectedHeadSha, expectedBaseSha, authorizationReference }))}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
