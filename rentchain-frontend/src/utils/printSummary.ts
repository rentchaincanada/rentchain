export async function printSummaryDocument(mode: "summary" | "lease-renewals" = "summary"): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const body = document.body;
  const previousMode = body.getAttribute("data-print-mode");
  body.setAttribute("data-print-mode", mode);

  try {
    window.print();
  } finally {
    window.setTimeout(() => {
      if (previousMode) {
        body.setAttribute("data-print-mode", previousMode);
      } else {
        body.removeAttribute("data-print-mode");
      }
    }, 0);
  }
}
