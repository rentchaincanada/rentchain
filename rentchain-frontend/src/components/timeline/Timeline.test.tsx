import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Timeline } from "./Timeline";

describe("Timeline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-03T15:00:00.000Z"));
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    cleanup();
  });

  it("renders timeline items in time buckets and collapses older history by default", () => {
    render(
      <Timeline
        items={[
          {
            id: "event-today",
            title: "Reviewed",
            description: "Decision reviewed.",
            timestamp: "2026-04-03T10:15:00.000Z",
            domain: "system",
            status: "reviewed",
            actor: "Landlord",
          },
          {
            id: "event-yesterday",
            title: "Appeared",
            description: "Decision appeared.",
            timestamp: "2026-04-02T09:30:00.000Z",
            domain: "system",
            actor: "System",
          },
          {
            id: "event-earlier",
            title: "Executed",
            description: "Decision executed.",
            timestamp: "2026-03-28T12:00:00.000Z",
            domain: "system",
            actor: "Landlord",
          },
        ]}
        storageKey="timeline-test"
      />
    );

    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
    expect(screen.getByText("Earlier")).toBeInTheDocument();
    expect(screen.getByText("Reviewed")).toBeInTheDocument();
    expect(screen.getByText("Appeared")).toBeInTheDocument();
    expect(screen.queryByText(/Decision executed\./i)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Show" })[0]);
    expect(screen.getByText(/Decision executed\./i)).toBeInTheDocument();
    expect(screen.getAllByText(/2026/).length).toBeGreaterThan(0);
  });

  it("persists bucket visibility in local storage", () => {
    const { unmount } = render(
      <Timeline
        items={[
          {
            id: "event-earlier",
            title: "Executed",
            description: "Decision executed.",
            timestamp: "2026-03-28T12:00:00.000Z",
            domain: "system",
            actor: "Landlord",
          },
        ]}
        storageKey="timeline-persist"
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Show" })[0]);
    unmount();

    render(
      <Timeline
        items={[
          {
            id: "event-earlier",
            title: "Executed",
            description: "Decision executed.",
            timestamp: "2026-03-28T12:00:00.000Z",
            domain: "system",
            actor: "Landlord",
          },
        ]}
        storageKey="timeline-persist"
      />
    );

    expect(screen.getByText(/Decision executed\./i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no items", () => {
    render(<Timeline items={[]} emptyMessage="Nothing to show yet." />);
    expect(screen.getByText(/Nothing to show yet/i)).toBeInTheDocument();
  });
});
