import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TenantApplicationStatusPage from "./TenantApplicationStatusPage";

const tenantApplicationCompletionApi = vi.hoisted(() => ({
  getTenantApplicationCompletion: vi.fn(),
}));

vi.mock("../../api/tenantApplicationCompletion", () => tenantApplicationCompletionApi);

describe("tenant application completion page", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders progress and grouped checklist safely", async () => {
    tenantApplicationCompletionApi.getTenantApplicationCompletion.mockResolvedValue({
      status: "in_progress",
      progressPercent: 62,
      sections: [
        {
          key: "identity",
          label: "Identity",
          status: "verified",
          items: [
            {
              key: "identity_verification",
              label: "Identity verification",
              status: "verified",
              nextAction: null,
              actionPath: null,
            },
          ],
        },
        {
          key: "documents",
          label: "Documents",
          status: "missing",
          items: [
            {
              key: "income_documents",
              label: "Income documents",
              status: "missing",
              nextAction: "Upload income documents",
              actionPath: "/tenant/profile",
            },
          ],
        },
      ],
      nextSteps: ["Upload income documents"],
      updatedAt: "2026-01-02T00:00:00.000Z",
    });

    render(
      <MemoryRouter>
        <TenantApplicationStatusPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Application Completion/i)).toBeInTheDocument();
    expect(screen.getByText(/62%/i)).toBeInTheDocument();
    expect(screen.getByText(/Identity verification/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Upload income documents/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Continue this step/i })).toBeInTheDocument();
  });

  it("renders empty state safely", async () => {
    tenantApplicationCompletionApi.getTenantApplicationCompletion.mockResolvedValue(null);

    render(
      <MemoryRouter>
        <TenantApplicationStatusPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/No application checklist yet/i)).toBeInTheDocument();
  });

  it("renders error state safely", async () => {
    tenantApplicationCompletionApi.getTenantApplicationCompletion.mockRejectedValue(new Error("Unable to load application completion."));

    render(
      <MemoryRouter>
        <TenantApplicationStatusPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/We couldn't load this view/i)).toBeInTheDocument();
    expect(screen.getByText(/Unable to load application completion/i)).toBeInTheDocument();
  });
});
