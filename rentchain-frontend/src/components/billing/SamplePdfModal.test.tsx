import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SamplePdfModal } from "./SamplePdfModal";

const telemetryMocks = vi.hoisted(() => ({
  logTelemetryEvent: vi.fn(),
}));

vi.mock("../../api/telemetryApi", () => ({
  logTelemetryEvent: telemetryMocks.logTelemetryEvent,
}));

function mockViewport(options: { width: number; coarsePointer: boolean }) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: options.width,
  });
  window.matchMedia = vi.fn((query: string) => {
    const matches = query.includes("pointer") ? options.coarsePointer : query.includes("max-width") && options.width <= 768;
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;
  });
}

describe("SamplePdfModal", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps the desktop PDF iframe preview", async () => {
    mockViewport({ width: 1280, coarsePointer: false });
    render(<SamplePdfModal open onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Sample screening report" })).toBeInTheDocument();
    expect(await screen.findByTitle("Sample screening report PDF")).toBeInTheDocument();
    expect(screen.queryByText("Open the sample PDF")).not.toBeInTheDocument();
  });

  it("does not render a PDF iframe on mobile", async () => {
    mockViewport({ width: 390, coarsePointer: true });
    render(<SamplePdfModal open onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Open the sample PDF")).toBeInTheDocument());
    await waitFor(() =>
      expect(telemetryMocks.logTelemetryEvent).toHaveBeenCalledWith(
        "pdf_mobile_fallback_used",
        expect.objectContaining({
          exportType: "sample_screening_report",
          renderingPath: "mobile_fallback",
          fallbackMode: "mobile_open_download",
        })
      )
    );
    expect(screen.queryByTitle("Sample screening report PDF")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sample screening report PDF: open PDF in a new tab" })).toHaveAttribute(
      "href",
      "/sample/screening_report_sample.pdf?v=1"
    );
    expect(screen.getByRole("link", { name: "Sample screening report PDF: download PDF" })).toHaveAttribute("download");
  });

  it("restores focus when the modal closes", () => {
    mockViewport({ width: 1280, coarsePointer: false });
    const onClose = vi.fn();
    const { rerender } = render(
      <>
        <button type="button">Open report</button>
        <SamplePdfModal open={false} onClose={onClose} />
      </>
    );
    const trigger = screen.getByRole("button", { name: "Open report" });
    trigger.focus();
    rerender(
      <>
        <button type="button">Open report</button>
        <SamplePdfModal open onClose={onClose} />
      </>
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });
});
