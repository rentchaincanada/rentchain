import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Pr1525AttachmentQaPage, { PR1525_SESSION_KEY } from "./Pr1525AttachmentQaPage";

describe("PR #1525 attachment QA page", () => {
  const attachments = [
    { attachmentId: "jpeg-id", filename: "kitchen.jpg", contentType: "image/jpeg", byteSize: 1200, width: 640, height: 480 },
    { attachmentId: "png-id", filename: "kitchen.png", contentType: "image/png", byteSize: 1500, width: 640, height: 480 },
    { attachmentId: "webp-id", filename: "kitchen.webp", contentType: "image/webp", byteSize: 700, width: 640, height: 480 },
  ];

  function bootstrap(role: "tenant" | "landlord", accessStatus = 200) {
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === `/api/pr1525-bootstrap/${role}`) {
        return new Response(JSON.stringify({
          ok: true,
          scope: "pr1525-maintenance-attachments",
          deploymentSha: "a".repeat(40),
          requestId: "qa-pr1525-target-request",
          session: { role, principalId: `qa-pr1525-${role}`, apiActor: role },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.endsWith("/access")) {
        return new Response(JSON.stringify(accessStatus === 200
          ? { ok: true, data: { url: `https://storage.googleapis.com/private-preview/${url.includes("jpeg-id") ? "jpeg" : url.includes("png-id") ? "png" : "webp"}?Signature=short-lived` } }
          : { ok: false, error: "NOT_FOUND" }), { status: accessStatus, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true, data: attachments }), { status: 200, headers: { "content-type": "application/json" } });
    });
  }

  function renderRole(role: "tenant" | "landlord") {
    return render(<MemoryRouter initialEntries={[`/__qa/pr1525/${role}`]}><Routes><Route path="/__qa/pr1525/:role" element={<Pr1525AttachmentQaPage />} /></Routes></MemoryRouter>);
  }

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it.each([
    ["tenant", "qa-pr1525-tenant"],
    ["landlord", "qa-pr1525-landlord"],
  ])("initializes and clears only the fixed %s session", async (role, principalId) => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === `/api/pr1525-bootstrap/${role}`) {
        return new Response(JSON.stringify({
          ok: true,
          scope: "pr1525-maintenance-attachments",
          deploymentSha: "a".repeat(40),
          requestId: "qa-pr1525-target-request",
          session: { role, principalId, apiActor: role },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200, headers: { "content-type": "application/json" } });
    });
    render(<MemoryRouter initialEntries={[`/__qa/pr1525/${role}`]}><Routes><Route path="/__qa/pr1525/:role" element={<Pr1525AttachmentQaPage />} /></Routes></MemoryRouter>);
    await screen.findByText(principalId);
    expect(window.sessionStorage.getItem(PR1525_SESSION_KEY)).toContain(principalId);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`/api/pr1525-attachments/${role}`), expect.anything());
    fireEvent.click(screen.getByRole("button", { name: "End QA session" }));
    expect(window.sessionStorage.getItem(PR1525_SESSION_KEY)).toBeNull();
    await waitFor(() => expect(screen.getByText(/Synthetic session cleared/)).toBeInTheDocument());
  });

  it("does not initialize an unknown role", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<MemoryRouter initialEntries={["/__qa/pr1525/admin"]}><Routes><Route path="/__qa/pr1525/:role" element={<Pr1525AttachmentQaPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText("Bootstrap route unavailable.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["tenant", "landlord"] as const)("renders authorized JPEG, PNG, and WebP thumbnails for %s", async (role) => {
    const fetchMock = bootstrap(role);
    renderRole(role);
    for (const attachment of attachments) {
      const image = await screen.findByRole("img", { name: `Maintenance attachment preview: ${attachment.filename}` });
      expect(image).toHaveAttribute("src", expect.stringContaining("https://storage.googleapis.com/private-preview/"));
      expect(image).toHaveAttribute("loading", "lazy");
    }
    const accessCalls = fetchMock.mock.calls.map(([input]) => String(input)).filter((url) => url.endsWith("/access"));
    expect(accessCalls).toHaveLength(3);
    expect(accessCalls.every((url) => url.startsWith(`/api/pr1525-attachments/${role}/api/`))).toBe(true);
    expect(document.body.textContent).not.toContain("rentchain-preview-attachments");
    expect(screen.getAllByRole("button", { name: "Open photo" })).toHaveLength(3);
    expect(screen.queryAllByRole("button", { name: "Remove" })).toHaveLength(role === "tenant" ? 3 : 0);
  });

  it("keeps a stable loading state until authorized thumbnail access resolves", async () => {
    let resolveAccess: ((response: Response) => void) | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/pr1525-bootstrap/tenant") return new Response(JSON.stringify({
        ok: true, scope: "pr1525-maintenance-attachments", deploymentSha: "a".repeat(40), requestId: "qa-pr1525-target-request",
        session: { role: "tenant", principalId: "qa-pr1525-tenant", apiActor: "tenant" },
      }), { status: 200, headers: { "content-type": "application/json" } });
      if (url.endsWith("/access")) return new Promise<Response>((resolve) => { resolveAccess = resolve; });
      return new Response(JSON.stringify({ ok: true, data: [attachments[0]] }), { status: 200, headers: { "content-type": "application/json" } });
    });
    renderRole("tenant");
    expect(await screen.findByRole("status", { name: "Loading preview for kitchen.jpg" })).toBeInTheDocument();
    resolveAccess?.(new Response(JSON.stringify({ ok: true, data: { url: "https://storage.googleapis.com/private-preview/jpeg?Signature=short-lived" } }), { status: 200, headers: { "content-type": "application/json" } }));
    expect(await screen.findByRole("img", { name: "Maintenance attachment preview: kitchen.jpg" })).toBeInTheDocument();
  });

  it.each(["tenant", "landlord"] as const)("preserves %s metadata and controls when thumbnail access fails", async (role) => {
    bootstrap(role, 404);
    renderRole(role);
    expect(await screen.findAllByText("Preview unavailable")).toHaveLength(3);
    expect(screen.getByText("kitchen.jpg")).toBeInTheDocument();
    expect(screen.getByText(/image\/jpeg · 640×480 · 1200 bytes/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Retry thumbnail" })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: "Open photo" })).toHaveLength(3);
    expect(screen.queryAllByRole("button", { name: "Remove" })).toHaveLength(role === "tenant" ? 3 : 0);
  });

  it("shows the fallback after an image resource fails without retrying automatically", async () => {
    const fetchMock = bootstrap("tenant");
    renderRole("tenant");
    const image = await screen.findByRole("img", { name: "Maintenance attachment preview: kitchen.jpg" });
    const accessCallsBefore = fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/access")).length;
    fireEvent.error(image);
    expect(await screen.findByText("Preview unavailable")).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/access"))).toHaveLength(accessCallsBefore);
  });
});
