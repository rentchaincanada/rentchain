import { recordPdfExportEvent } from "../lib/pdfExportObservability";

type PrintSummaryMode = "summary" | "lease-renewals" | "application";

const PRINT_SELECTOR_BY_MODE: Record<PrintSummaryMode, string> = {
  summary: ".print-only-summary",
  "lease-renewals": ".print-only-lease-renewals",
  application: ".print-only-application",
};

export async function printSummaryDocument(mode: PrintSummaryMode = "summary"): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const body = document.body;
  const previousMode = body.getAttribute("data-print-mode");
  const selector = PRINT_SELECTOR_BY_MODE[mode];
  const printableSource = document.querySelector<HTMLElement>(selector);
  const printableRoot = document.createElement("div");
  let cleanedUp = false;

  printableRoot.setAttribute("data-print-root", "true");

  if (printableSource) {
    printableRoot.appendChild(printableSource.cloneNode(true));
  }

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    window.removeEventListener("afterprint", cleanup);
    printableRoot.remove();
    body.removeAttribute("data-print-root-active");
    if (previousMode) {
      body.setAttribute("data-print-mode", previousMode);
    } else {
      body.removeAttribute("data-print-mode");
    }
  };

  try {
    body.setAttribute("data-print-mode", mode);
    body.setAttribute("data-print-root-active", "true");
    body.appendChild(printableRoot);

    window.addEventListener("afterprint", cleanup, { once: true });
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        resolve();
      });
    });

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
