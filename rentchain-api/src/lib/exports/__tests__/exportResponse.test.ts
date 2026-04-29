import { describe, expect, it, vi } from "vitest";
import {
  buildDatedExportFilename,
  getExportContentType,
  setAttachmentExportHeaders,
} from "../exportResponse";

describe("exportResponse", () => {
  it("builds dated filenames deterministically", () => {
    expect(
      buildDatedExportFilename({
        prefix: "rentchain-payments",
        format: "csv",
        date: new Date("2026-04-29T12:00:00.000Z"),
      })
    ).toBe("rentchain-payments-2026-04-29.csv");
  });

  it("returns the expected export content types", () => {
    expect(getExportContentType("csv")).toBe("text/csv; charset=utf-8");
    expect(getExportContentType("xlsx")).toBe("application/vnd.ms-excel; charset=utf-8");
    expect(getExportContentType("pdf")).toBe("application/pdf");
  });

  it("sets attachment headers without changing the filename", () => {
    const setHeader = vi.fn();
    setAttachmentExportHeaders(
      { setHeader },
      {
        filename: "rentchain-expenses-2026-04-29.pdf",
        format: "pdf",
      }
    );

    expect(setHeader).toHaveBeenNthCalledWith(1, "Content-Type", "application/pdf");
    expect(setHeader).toHaveBeenNthCalledWith(
      2,
      "Content-Disposition",
      'attachment; filename="rentchain-expenses-2026-04-29.pdf"'
    );
  });
});
