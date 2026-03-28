import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ViewingSlotsEditor } from "./ViewingSlotsEditor";

afterEach(() => {
  cleanup();
});

describe("ViewingSlotsEditor", () => {
  it("validates required slot values", async () => {
    const onSubmit = vi.fn();
    render(<ViewingSlotsEditor onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Save Proposed Times" }));

    expect(await screen.findByText("Slot 1 needs a date, start time, and end time.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits ISO slot payloads", async () => {
    const onSubmit = vi.fn();
    render(<ViewingSlotsEditor onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-04-05" } });
    fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "18:00" } });
    fireEvent.change(screen.getByLabelText("End time"), { target: { value: "18:30" } });
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "Call on arrival" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Proposed Times" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith([
        {
          id: "slot-1",
          startAt: new Date("2026-04-05T18:00:00").toISOString(),
          endAt: new Date("2026-04-05T18:30:00").toISOString(),
          note: "Call on arrival",
        },
      ]);
    });
  });
});
