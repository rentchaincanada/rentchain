# TransUnion Integration Overview

## Purpose

This document outlines how a bureau-style integration can be introduced within the existing platform boundaries, without changing user-facing compliance controls.

## Proposed Integration Model

- Use a provider adapter service layer with one provider implementation per bureau.
- Keep consent capture and audit logging in the platform before any provider call.
- Isolate provider-specific request and response mapping from product workflows.

## Adapter Responsibilities

- Validate required consent status before request assembly.
- Build provider request payloads from internal canonical screening input.
- Normalize provider responses into internal screening result fields.
- Return structured error codes for workflow handling.

## Non-Goals (v1)

- No partner-facing write APIs exposed directly to clients.
- No direct provider credentials in frontend clients.
- No change to existing authorization model.

## Review Questions

- Which consent artifacts are required at request time?
- Which response fields are mandatory for decision support?
- What retry and outage behavior is required by policy?
