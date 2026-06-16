import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LandlordLeaseSummaryPage from "./LandlordLeaseSummaryPage";
import { buildLeaseSummaryPdfSource } from "@/utils/leaseSummaryPdf";

const mocks = vi.hoisted(() => ({
  getLeaseById: vi.fn(),
  printSummaryDocument: vi.fn(),
  downloadAuthenticatedExport: vi.fn(),
}));

const originalWindowPrintDescriptor = Object.getOwnPropertyDescriptor(window, "print");

vi.mock("@/api/leasesApi", () => ({
  getLeaseById: mocks.getLeaseById,
}));

vi.mock("@/api/exportDownload", () => ({
  downloadAuthenticatedExport: (...args: unknown[]) => mocks.downloadAuthenticatedExport(...args),
}));

vi.mock("@/utils/printSummary", () => ({
  printSummaryDocument: (...args: unknown[]) => mocks.printSummaryDocument(...args),
}));

describe("LandlordLeaseSummaryPage", () => {
  beforeEach(() => {
    mocks.getLeaseById.mockReset();
    mocks.printSummaryDocument.mockReset();
    mocks.printSummaryDocument.mockResolvedValue(undefined);
    mocks.downloadAuthenticatedExport.mockReset();
    mocks.downloadAuthenticatedExport.mockResolvedValue({
      blob: new Blob(["%PDF-1.4"], { type: "application/pdf" }),
      filename: "lease-evidence-package.pdf",
    });
    mocks.getLeaseById.mockResolvedValue({
      lease: {
        id: "lease-1",
        propertyId: "prop-1",
        propertyName: "Coburg Rd",
        unitNumber: "3",
        monthlyRent: 2100,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        status: "active",
        tenantName: "Tony Wenpeng",
        tenantEmail: "tony@example.com",
        documentUrl: null,
        paymentReadiness: {
          readinessStatus: "ready_to_configure",
          readinessLabel: "Rent terms ready for future setup",
          readinessDescription: "The current lease shows the rent terms needed for a future setup workflow.",
          requiredNextAction: "confirm_payment_setup_later",
          rentTerms: {
            rentAmountAvailable: true,
            dueDateAvailable: true,
            leaseDatesAvailable: true,
            tenantLinked: true,
            leaseExecuted: false,
          },
          paymentSetup: {
            processorConnected: false,
            moneyMovementEnabled: false,
            storedPaymentMethod: false,
          },
        },
        leaseLifecycleSummary: {
          lifecycleStatus: "expiring_soon",
          lifecycleLabel: "Expiring soon",
          lifecycleDescription: "This lease is approaching notice timing.",
          requiredNextAction: "prepare_renewal_notice",
          renewalOutcome: "not_started",
          history: [],
        },
      },
    });

    global.URL.createObjectURL = vi.fn(() => "blob:lease-summary");
    global.URL.revokeObjectURL = vi.fn();
    Object.defineProperty(window, "print", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  afterEach(() => {
    cleanup();
    if (originalWindowPrintDescriptor) {
      Object.defineProperty(window, "print", originalWindowPrintDescriptor);
    } else {
      delete (window as Partial<Window>).print;
    }
    vi.restoreAllMocks();
  });

  it("renders landlord-safe lease details without exposing storage paths", async () => {
    render(
      <MemoryRouter initialEntries={["/leases/lease-1/summary"]}>
        <Routes>
          <Route path="/leases/:leaseId/summary" element={<LandlordLeaseSummaryPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Lease summary")).toBeInTheDocument();
    expect(screen.getAllByTestId("lease-document-view").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("article", { name: "Residential Lease Pack" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("term", { name: "Property" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Residential Lease Pack").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Property and Unit").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Landlord and Tenant").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Lease Term").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rent and Payment Terms").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Clauses and Additional Terms").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Audit and Events").length).toBeGreaterThan(0);
    expect(document.getElementById("lease-section-rent-payment")).toBeTruthy();
    expect(document.getElementById("lease-section-audit-events")).toBeTruthy();
    expect(document.querySelectorAll("#lease-section-rent-payment")).toHaveLength(1);
    expect(document.querySelectorAll("#lease-section-audit-events")).toHaveLength(1);
    expect(mocks.getLeaseById).toHaveBeenCalledWith("lease-1");
    expect(screen.getAllByText("Coburg Rd").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tony Wenpeng").length).toBeGreaterThan(0);
    expect(screen.queryByText(/gs:\/\//i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open ledger" })).toHaveAttribute("href", "/leases/lease-1/ledger");
    expect(screen.getByRole("button", { name: "Print / Save PDF" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download evidence package" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to leases" })).toHaveAttribute("href", "/leases");
  });

  it("scrolls to and highlights requested lease summary workflow sections after data loads", async () => {
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => undefined);

    render(
      <MemoryRouter initialEntries={["/leases/lease-1/summary?section=rent-payment#lease-section-rent-payment"]}>
        <Routes>
          <Route path="/leases/:leaseId/summary" element={<LandlordLeaseSummaryPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Lease summary")).toBeInTheDocument();
    const target = document.getElementById("lease-section-rent-payment");

    expect(target).toBeTruthy();
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    });
    expect(target).toHaveStyle({ background: "#eff6ff" });
  });

  it("renders a non-empty printable lease summary source for browser print preview", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/leases/lease-1/summary"]}>
        <Routes>
          <Route path="/leases/:leaseId/summary" element={<LandlordLeaseSummaryPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Lease summary");
    const printSource = container.querySelector(".print-only-summary");

    expect(printSource).toBeTruthy();
    expect(printSource?.textContent).toContain("Residential Lease Pack");
    expect(printSource?.textContent).toContain("Coburg Rd");
    expect(printSource?.textContent).toContain("Tony Wenpeng");
  });

  it("renders date-only lease summary dates without UTC timezone rollback", async () => {
    mocks.getLeaseById.mockResolvedValue({
      lease: {
        id: "lease-1",
        propertyId: "prop-1",
        propertyName: "Coburg Rd",
        unitNumber: "3",
        monthlyRent: 2100,
        startDate: "2026-05-01",
        endDate: "2026-06-01",
        status: "active",
        tenantName: "Tony Wenpeng",
        tenantEmail: "tony@example.com",
        documentUrl: null,
      },
    });

    render(
      <MemoryRouter initialEntries={["/leases/lease-1/summary"]}>
        <Routes>
          <Route path="/leases/:leaseId/summary" element={<LandlordLeaseSummaryPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect((await screen.findAllByText("May 1, 2026")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("June 1, 2026").length).toBeGreaterThan(0);
    expect(screen.queryByText("April 30, 2026")).not.toBeInTheDocument();
    expect(screen.queryByText("May 31, 2026")).not.toBeInTheDocument();
  });

  it("continues to render ISO datetime lease summary dates", async () => {
    mocks.getLeaseById.mockResolvedValue({
      lease: {
        id: "lease-1",
        propertyId: "prop-1",
        propertyName: "Coburg Rd",
        unitNumber: "3",
        monthlyRent: 2100,
        startDate: "2026-05-01T12:00:00.000Z",
        endDate: "2026-06-01T12:00:00.000Z",
        status: "active",
        tenantName: "Tony Wenpeng",
        tenantEmail: "tony@example.com",
        documentUrl: null,
      },
    });

    render(
      <MemoryRouter initialEntries={["/leases/lease-1/summary"]}>
        <Routes>
          <Route path="/leases/:leaseId/summary" element={<LandlordLeaseSummaryPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect((await screen.findAllByText("May 1, 2026")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("June 1, 2026").length).toBeGreaterThan(0);
  });

  it("opens the browser print flow before falling back to direct PDF download", async () => {
    render(
      <MemoryRouter initialEntries={["/leases/lease-1/summary"]}>
        <Routes>
          <Route path="/leases/:leaseId/summary" element={<LandlordLeaseSummaryPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Print / Save PDF" }));

    await waitFor(() => {
      expect(mocks.printSummaryDocument).toHaveBeenCalledWith("summary");
    });
    expect(global.URL.createObjectURL).not.toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });

  it("falls back to direct PDF download only when browser printing is unavailable", async () => {
    const realCreateElement = document.createElement.bind(document);
    const createdAnchors: HTMLAnchorElement[] = [];
    vi.spyOn(document, "createElement").mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const element = realCreateElement(tagName, options);
      if (tagName.toLowerCase() === "a") createdAnchors.push(element as HTMLAnchorElement);
      return element;
    });
    const originalPrint = window.print;
    Object.defineProperty(window, "print", {
      configurable: true,
      value: undefined,
    });

    render(
      <MemoryRouter initialEntries={["/leases/lease-1/summary"]}>
        <Routes>
          <Route path="/leases/:leaseId/summary" element={<LandlordLeaseSummaryPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Print / Save PDF" }));

    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
      expect(global.URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    });
    expect(mocks.printSummaryDocument).not.toHaveBeenCalled();
    const blob = vi.mocked(global.URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/pdf");
    const pdfText = buildLeaseSummaryPdfSource(mocks.getLeaseById.mock.calls.length ? (await mocks.getLeaseById.mock.results[0].value).lease : {});
    expect(pdfText).toContain("Residential Lease Pack");
    expect(pdfText).toContain("Property and Unit");
    expect(pdfText).toContain("Landlord and Tenant");
    expect(pdfText).toContain("Lease Term");
    expect(pdfText).toContain("Rent and Payment Terms");
    expect(pdfText).toContain("Clauses and Additional Terms");
    expect(pdfText).toContain("Audit and Events");
    const downloadAnchor = createdAnchors[createdAnchors.length - 1];
    expect(downloadAnchor?.download).toBe("lease-3.pdf");
    expect(downloadAnchor?.download).not.toMatch(/\.txt$/);
    Object.defineProperty(window, "print", {
      configurable: true,
      value: originalPrint,
    });
  });

  it("downloads the governed backend evidence package PDF", async () => {
    render(
      <MemoryRouter initialEntries={["/leases/lease-1/summary"]}>
        <Routes>
          <Route path="/leases/:leaseId/summary" element={<LandlordLeaseSummaryPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Download evidence package" }));

    await waitFor(() => {
      expect(mocks.downloadAuthenticatedExport).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/landlord/evidence-packages/leases/lease-1.pdf",
          fallbackFilename: "lease-evidence-package-lease-1.pdf",
          observability: {
            exportType: "lease_evidence_package",
            renderingPath: "backend_pdfkit",
          },
        })
      );
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    });
  });

  it("paginates long lease summary content without adding empty trailing pages", () => {
    const longText = Array.from({ length: 180 }, (_, index) => `deterministic clause ${index + 1}`).join(" ");
    const pdfText = buildLeaseSummaryPdfSource({
      id: "lease-long",
      propertyId: "prop-1",
      propertyName: "Coburg Rd",
      unitNumber: "3",
      monthlyRent: 2100,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      status: "active",
      tenantName: "Tony Wenpeng",
      tenantEmail: "tony@example.com",
      documentUrl: null,
      paymentReadiness: {
        readinessStatus: "ready_to_configure",
        readinessLabel: "Rent terms ready for future setup",
        readinessDescription: longText,
        requiredNextAction: "confirm_payment_setup_later",
        rentTerms: {
          rentAmountAvailable: true,
          dueDateAvailable: true,
          leaseDatesAvailable: true,
          tenantLinked: true,
          leaseExecuted: false,
        },
        paymentSetup: {
          processorConnected: false,
          moneyMovementEnabled: false,
          storedPaymentMethod: false,
        },
      },
      leaseExecution: {
        executionStatus: "ready_for_review",
        executionLabel: "Execution review",
        executionDescription: longText,
      },
    } as any);

    const pageCount = (pdfText.match(/\/Type \/Page /g) || []).length;
    expect(pageCount).toBeGreaterThan(1);
    expect(pdfText).toContain(`/Count ${pageCount}`);
    expect(pdfText).toContain("deterministic clause 180");
  });
});
