import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AutomationTimelineV1Page from "./AutomationTimelineV1Page";

const showToast = vi.fn();

vi.mock("../../api/timelineApi", () => ({
  fetchTimeline: vi.fn(),
}));

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../components/ui/Ui", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Pill: ({ children }: any) => <span>{children}</span>,
  Section: ({ children }: any) => <section>{children}</section>,
}));

beforeEach(() => {
  showToast.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AutomationTimelineV1Page", () => {
  it("renders timeline items and filters by date client-side", async () => {
    const { fetchTimeline } = await import("../../api/timelineApi");
    vi.mocked(fetchTimeline).mockResolvedValue({
      events: [
        {
          id: "event-1",
          title: "Lease activated",
          description: "Lease activated for unit 4.",
          timestamp: "2026-04-03T10:15:00.000Z",
          domain: "lease",
          status: "active",
          actor: "Landlord",
        },
        {
          id: "event-2",
          title: "Application created",
          description: "Application created for screening.",
          timestamp: "2026-04-01T09:00:00.000Z",
          domain: "application",
          actor: "Landlord",
        },
      ],
    } as any);

    render(<AutomationTimelineV1Page />);

    expect(await screen.findByText(/Lease activated for unit 4/i)).toBeInTheDocument();
    expect(screen.getByText(/Application created for screening/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/From date/i), {
      target: { value: "2026-04-02" },
    });

    await waitFor(() => {
      expect(screen.getByText(/Lease activated for unit 4/i)).toBeInTheDocument();
      expect(screen.queryByText(/Application created for screening/i)).not.toBeInTheDocument();
    });
  });

  it("shows an empty state when no events are returned", async () => {
    const { fetchTimeline } = await import("../../api/timelineApi");
    vi.mocked(fetchTimeline).mockResolvedValue({ events: [] } as any);

    render(<AutomationTimelineV1Page />);

    expect(await screen.findByText(/No canonical timeline activity is available yet/i)).toBeInTheDocument();
  });
});
