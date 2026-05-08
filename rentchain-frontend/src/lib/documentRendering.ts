import type { PdfExportType, PdfRenderingPath } from "./pdfExportObservability";

export type PrintSummaryMode = "summary" | "lease-renewals" | "application";

export const PRINT_ROOT_ATTRIBUTE = "data-print-root";
export const PRINT_ROOT_ACTIVE_ATTRIBUTE = "data-print-root-active";
export const PRINT_MODE_ATTRIBUTE = "data-print-mode";

export const PRINT_SAFE_CLASS = "rc-print-area";
export const PRINT_CLEAN_CLASS = "rc-print-clean";
export const PAGE_BREAK_GUARD_CLASS = "rc-avoid-break";

export const PRINT_SELECTOR_BY_MODE: Record<PrintSummaryMode, string> = {
  summary: ".print-only-summary",
  "lease-renewals": ".print-only-lease-renewals",
  application: ".print-only-application",
};

export type DocumentDownloadOptions = {
  blob: Blob;
  filename: string;
  documentRef?: Document;
  urlApi?: Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;
};

export type PdfPreviewFallbackMetadata = {
  exportType: PdfExportType;
  renderingPath: PdfRenderingPath;
  fallbackMode: "mobile_open_download";
};

export function createPrintRoot(documentRef: Document = document): HTMLDivElement {
  const printableRoot = documentRef.createElement("div");
  printableRoot.setAttribute(PRINT_ROOT_ATTRIBUTE, "true");
  return printableRoot;
}

export function nextRenderFrame(windowRef: Window = window): Promise<void> {
  return new Promise<void>((resolve) => {
    windowRef.requestAnimationFrame(() => resolve());
  });
}

export function shouldStartNewPage(params: {
  cursorY: number;
  neededHeight: number;
  bottomY: number;
}): boolean {
  return params.cursorY - params.neededHeight < params.bottomY;
}

export function wrapTextForPdf(text: string, maxLineLength: number): string[] {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const wrapped: string[] = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLineLength) {
      if (current) wrapped.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) wrapped.push(current);
  return wrapped;
}

export function triggerDocumentDownload({
  blob,
  filename,
  documentRef = document,
  urlApi = URL,
}: DocumentDownloadOptions): void {
  const objectUrl = urlApi.createObjectURL(blob);
  const anchor = documentRef.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  documentRef.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  urlApi.revokeObjectURL(objectUrl);
}
