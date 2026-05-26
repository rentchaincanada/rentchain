FROM mcr.microsoft.com/devcontainers/javascript-node:1-20-bookworm

USER root

# Keep browser dependencies available for existing Playwright workflows without
# changing package manifests or lockfiles.
RUN npx --yes playwright@1.50.1 install-deps chromium

USER node

WORKDIR /workspace/rentchain
