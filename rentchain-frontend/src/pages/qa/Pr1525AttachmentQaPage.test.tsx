import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Pr1525AttachmentQaPage, { PR1525_SESSION_KEY } from "./Pr1525AttachmentQaPage";

describe("PR #1525 attachment QA page", () => {
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
});
