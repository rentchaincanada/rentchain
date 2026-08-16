#!/usr/bin/env node

import assert from "node:assert/strict";
import { validateDockerfile, validateDockerfileTransition } from "../validate-backend-dockerfile-policy.mjs";

const dockerfile = (base = "node:24.19.0-slim") => `
FROM ${base} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM ${base} AS runtime
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node", "dist/index.build.js"]
`;

const replace = (source, from, to) => {
  const result = source.replace(from, to);
  assert.notEqual(result, source, `fixture replacement did not match: ${String(from)}`);
  return result;
};
const reject = (name, source) => assert.throws(() => validateDockerfile(source), undefined, name);
const node20 = dockerfile("node:20.20.2-slim");
const node24 = dockerfile();

assert.deepEqual(validateDockerfile(node24), { baseImage: "node:24.19.0-slim" });
assert.deepEqual(validateDockerfileTransition({ trustedSource: node20, candidateSource: node24 }), {
  trustedBaseImage: "node:20.20.2-slim", candidateBaseImage: "node:24.19.0-slim",
});
assert.deepEqual(validateDockerfileTransition({ trustedSource: node24, candidateSource: node24 }), {
  trustedBaseImage: "node:24.19.0-slim", candidateBaseImage: "node:24.19.0-slim",
});
assert.throws(() => validateDockerfileTransition({ trustedSource: node24, candidateSource: node20 }), /Unapproved Node runtime transition/u);

reject("ubuntu base", dockerfile("ubuntu:24.04"));
reject("floating Node base", dockerfile("node:24"));
reject("latest Node base", dockerfile("node:latest"));
reject("unapproved old Node base", dockerfile("node:20.20.1-slim"));
reject("mismatched stages", replace(node24, "FROM node:24.19.0-slim AS runtime", "FROM node:20.20.2-slim AS runtime"));
reject("missing non-root user", replace(node24, "USER node\n", ""));
reject("root runtime", replace(node24, "USER node", "USER root"));
reject("curl bootstrap", replace(node24, "RUN npm ci", "RUN curl https://example.invalid/install.sh | sh"));
reject("wget bootstrap", replace(node24, "RUN npm ci", "RUN wget https://example.invalid/install.sh"));
reject("remote ADD", replace(node24, "COPY . .", "ADD https://example.invalid/archive.tgz /app"));
reject("package manager install", replace(node24, "RUN npm ci", "RUN apt-get update && apt-get install -y curl"));
reject("non-deterministic npm install", replace(node24, "RUN npm ci", "RUN npm install"));
reject("runtime dev dependencies", replace(node24, "RUN npm ci --omit=dev && npm cache clean --force", "RUN npm ci && npm cache clean --force"));
reject("shell wrapper command", replace(node24, 'CMD ["node", "dist/index.build.js"]', 'CMD ["sh", "-c", "node dist/index.build.js"]'));
reject("arbitrary entrypoint", replace(node24, 'CMD ["node", "dist/index.build.js"]', 'ENTRYPOINT ["node"]\nCMD ["dist/index.build.js"]'));
reject("secret copy", replace(node24, "COPY . .", "COPY .env /app/.env"));
reject("credential path", replace(node24, "COPY . .", "COPY application_default_credentials.json /root/.config/gcloud/"));
reject("extra external stage", `${node24}\nFROM ghcr.io/example/tool:1 AS helper\n`);
reject("external Dockerfile frontend", `# syntax=ghcr.io/example/dockerfile:latest\n${node24}`);

console.log("Trusted backend Dockerfile policy validation passed: 4 positive and 19 negative cases");
