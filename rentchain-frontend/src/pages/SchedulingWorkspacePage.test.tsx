import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import SchedulingWorkspacePage from "./SchedulingWorkspacePage";

afterEach(() => {
  cleanup();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <SchedulingWorkspacePage />
    </MemoryRouter>
  );
}

describe("SchedulingWorkspacePage", () => {
  it("renders a calendar-centric scheduling workspace with operational sections", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Scheduling" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Month" })).toHaveClass("is-active");
    expect(screen.getByRole("button", { name: "7-day" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Viewings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Maintenance Requests" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Work Orders" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Screening Activities" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Connect Screening Provider" })).toHaveAttribute("href", "/screening");
    expect(screen.getByRole("link", { name: "Screen Manually" })).toHaveAttribute("href", "/screening/manual");
  });

  it("switches between month and 7-day calendar views", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "7-day" }));

    expect(screen.getByRole("button", { name: "7-day" })).toHaveClass("is-active");
    expect(screen.getByText(/Week of/i)).toBeInTheDocument();
  });

  it("lets landlords add, edit, and delete multiple selected-day notes", () => {
    renderPage();

    const noteInput = screen.getByLabelText("New schedule note");
    fireEvent.change(noteInput, { target: { value: "Call tenant before viewing" } });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    fireEvent.change(noteInput, { target: { value: "Confirm maintenance access" } });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));

    const selectedDay = screen.getByRole("button", { pressed: true });
    expect(within(selectedDay).getByText("2 notes")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Call tenant before viewing")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Confirm maintenance access")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Edit note 1"), { target: { value: "Call tenant at noon" } });

    expect(screen.getByDisplayValue("Call tenant at noon")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    expect(within(selectedDay).getByText("1 note")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Call tenant at noon")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Confirm maintenance access")).toBeInTheDocument();
  });

  it("keeps scheduling review recommendations read-only", () => {
    renderPage();

    const review = screen.getByLabelText("Read-only scheduling recommendations");
    expect(within(review).getAllByRole("listitem")).toHaveLength(4);
    expect(within(review).queryByRole("button")).not.toBeInTheDocument();
  });
});
