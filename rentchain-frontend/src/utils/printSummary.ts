import { recordPdfExportEvent } from "../lib/pdfExportObservability";
import {
  createPrintRoot,
  nextRenderFrame,
  PRINT_MODE_ATTRIBUTE,
  PRINT_ROOT_ACTIVE_ATTRIBUTE,
  PRINT_SELECTOR_BY_MODE,
  type PrintSummaryMode,
} from "../lib/documentRendering";

export async function printSummaryDocument(mode: PrintSummaryMode = "summary"): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const body = document.body;
  const previousMode = body.getAttribute(PRINT_MODE_ATTRIBUTE);
  const selector = PRINT_SELECTOR_BY_MODE[mode];
  const printableSource = document.querySelector<HTMLElement>(selector);
  const printableRoot = createPrintRoot(document);
  let cleanedUp = false;

  if (printableSource) {
    printableRoot.appendChild(printableSource.cloneNode(true));
  }

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    window.removeEventListener("afterprint", cleanup);
    printableRoot.remove();
    body.removeAttribute(PRINT_ROOT_ACTIVE_ATTRIBUTE);
    if (previousMode) {
      body.setAttribute(PRINT_MODE_ATTRIBUTE, previousMode);
    } else {
      body.removeAttribute(PRINT_MODE_ATTRIBUTE);
    }
  };

  try {
    body.setAttribute(PRINT_MODE_ATTRIBUTE, mode);
    body.setAttribute(PRINT_ROOT_ACTIVE_ATTRIBUTE, "true");
    body.appendChild(printableRoot);

    window.addEventListener("afterprint", cleanup, { once: true });
    await nextRenderFrame(window);

    recordPdfExportEvent("pdf_print_opened", {
      exportType: "print_summary",
      renderingPath: "window_print",
      status: "print_opened",
    });
    window.print();
  } finally {
    window.setTimeout(cleanup, 250);
  }
}
