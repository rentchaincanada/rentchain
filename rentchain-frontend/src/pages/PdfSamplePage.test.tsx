import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import PdfSamplePage from "./PdfSamplePage";

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

describe("PdfSamplePage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the desktop PDF iframe preview", async () => {
    mockViewport({ width: 1280, coarsePointer: false });
    render(
      <MemoryRouter>
        <PdfSamplePage />
      </MemoryRouter>
    );

    expect(await screen.findByTitle("Sample screening report")).toBeInTheDocument();
    expect(screen.queryByText("Open the sample PDF")).not.toBeInTheDocument();
  });

  it("uses Open and Download actions instead of iframe preview on mobile", async () => {
    mockViewport({ width: 390, coarsePointer: true });
    render(
      <MemoryRouter>
        <PdfSamplePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Open the sample PDF")).toBeInTheDocument());
    expect(screen.queryByTitle("Sample screening report")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open PDF" })[0]).toHaveAttribute(
      "href",
      "/sample/screening_report_sample.pdf?v=1"
    );
    expect(screen.getAllByRole("link", { name: "Download PDF" })[0]).toHaveAttribute("download");
  });
});
