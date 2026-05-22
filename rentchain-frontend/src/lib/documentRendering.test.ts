import { describe, expect, it, vi } from "vitest";
import {
  createPrintRoot,
  PRINT_SAFE_CLASS,
  PRINT_ROOT_ATTRIBUTE,
  shouldStartNewPage,
  triggerDocumentDownload,
  wrapTextForPdf,
} from "./documentRendering";

describe("documentRendering foundation", () => {
  it("creates print roots with the shared print-root attribute", () => {
    const root = createPrintRoot(document);

    expect(root.getAttribute(PRINT_ROOT_ATTRIBUTE)).toBe("true");
    expect(root.classList.contains(PRINT_SAFE_CLASS)).toBe(true);
  });

  it("keeps pagination decisions deterministic at the bottom guard", () => {
    expect(shouldStartNewPage({ cursorY: 120, neededHeight: 30, bottomY: 88 })).toBe(false);
    expect(shouldStartNewPage({ cursorY: 110, neededHeight: 30, bottomY: 88 })).toBe(true);
  });

  it("wraps export text without dropping words", () => {
    expect(wrapTextForPdf("one two three four five", 10)).toEqual(["one two", "three four", "five"]);
  });

  it("triggers object-url downloads and revokes the object url", () => {
    const click = vi.fn();
    const remove = vi.fn();
    const anchor = {
      href: "",
      download: "",
      click,
      remove,
    } as unknown as HTMLAnchorElement;
    const appendChild = vi.fn();
    const documentRef = {
      createElement: vi.fn(() => anchor),
      body: { appendChild },
    } as unknown as Document;
    const urlApi = {
      createObjectURL: vi.fn(() => "blob:rentchain-document"),
      revokeObjectURL: vi.fn(),
    };
    const blob = new Blob(["pdf"], { type: "application/pdf" });

    triggerDocumentDownload({
      blob,
      filename: "lease-summary.pdf",
      documentRef,
      urlApi,
    });

    expect(anchor.href).toBe("blob:rentchain-document");
    expect(anchor.download).toBe("lease-summary.pdf");
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(click).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
    expect(urlApi.revokeObjectURL).toHaveBeenCalledWith("blob:rentchain-document");
  });
});
