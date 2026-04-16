import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import FeedbackSubmissionPage from "./FeedbackSubmissionPage";

const feedbackApi = vi.hoisted(() => ({
  submitTenantFeedback: vi.fn(),
}));

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("../../api/tenantFeedbackApi", () => ({
  submitTenantFeedback: feedbackApi.submitTenantFeedback,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe("FeedbackSubmissionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the form and submits feedback", async () => {
    feedbackApi.submitTenantFeedback.mockResolvedValue({
      feedback: { id: "fb-1", createdAt: "2026-04-16T12:00:00.000Z" },
    });

    render(
      <MemoryRouter>
        <FeedbackSubmissionPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/maint-123/i), { target: { value: "maint-1" } });
    fireEvent.change(screen.getByDisplayValue(/Neutral/i), { target: { value: "positive" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Submit feedback/i })[0]);

    await waitFor(() => {
      expect(feedbackApi.submitTenantFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: "maint-1",
          sentiment: "positive",
        })
      );
    });

    expect(await screen.findByText(/Feedback submitted/i)).toBeInTheDocument();
  });

  it("validates required fields", async () => {
    render(
      <MemoryRouter>
        <FeedbackSubmissionPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getAllByPlaceholderText(/maintenance/i)[0], { target: { value: "" } });
    fireEvent.click(screen.getAllByRole("button", { name: /Submit feedback/i })[0]);

    expect(await screen.findByText(/Resource type and resource ID are required/i)).toBeInTheDocument();
    expect(feedbackApi.submitTenantFeedback).not.toHaveBeenCalled();
  });
});
