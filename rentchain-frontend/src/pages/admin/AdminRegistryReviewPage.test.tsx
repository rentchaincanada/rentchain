import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminRegistryReviewPage from "./AdminRegistryReviewPage";

const mocks = vi.hoisted(() => ({
  fetchAdminRegistryReview: vi.fn(),
  fetchNextAdminRegistryReviewPage: vi.fn(),
}));

vi.mock("../../api/adminRegistryApi", async () => {
  const actual = await vi.importActual<typeof import("../../api/adminRegistryApi")>("../../api/adminRegistryApi");
  return {
    ...actual,
    fetchAdminRegistryReview: mocks.fetchAdminRegistryReview,
    fetchNextAdminRegistryReviewPage: mocks.fetchNextAdminRegistryReviewPage,
  };
});

vi.mock("../../components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function makeItem(index: number) {
  return {
    match: {
      id: `match-${index}`,
      sourceKey: "halifax_r400" as const,
      registryRecordId: `reg-${index}`,
      normalizedRecordId: `normalized-${index}`,
      propertyId: index % 2 === 0 ? `prop-${index}` : null,
      landlordId: null,
      matchMethod: index % 2 === 0 ? ("manual" as const) : ("address_fuzzy" as const),
      matchScore: 0.9,
      matchStatus: index % 2 === 0 ? ("matched" as const) : ("possible_match" as const),
      mismatchReasons: [],
      reviewedBy: null,
      reviewedAt: null,
      overrideReason: null,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
    normalizedRecord: {
      id: `normalized-${index}`,
      registryRecordId: `reg-${index}`,
      registrationNumber: `REG-${index}`,
      pid: `${index}${index}${index}${index}`,
      addressRaw: `${index} Example Street`,
    },
    property:
      index % 2 === 0
        ? {
            id: `prop-${index}`,
            name: `Property ${index}`,
            addressLine1: `${index} Example Street`,
            city: "Halifax",
            province: "NS",
            postalCode: "B3H1A1",
            pid: `${index}${index}${index}${index}`,
          }
        : null,
    topCandidate:
      index % 2 === 1
        ? {
            propertyId: `candidate-${index}`,
            propertyName: `Candidate ${index}`,
            addressLine1: `${index} Example Street`,
            city: "Halifax",
            province: "NS",
            postalCode: "B3H1A1",
            pid: `${index}${index}${index}${index}`,
            unitCount: 2,
            score: 0.88,
          }
        : null,
    reasonSummary: index % 2 === 1 ? ["Manual confirmation is recommended before trusting this match."] : [],
  };
}

function renderPage(initialEntry = "/admin/registry/review") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/admin/registry/review" element={<AdminRegistryReviewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminRegistryReviewPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.useRealTimers();
    mocks.fetchAdminRegistryReview.mockReset();
    mocks.fetchNextAdminRegistryReviewPage.mockReset();
    mocks.fetchAdminRegistryReview.mockResolvedValue({
      ok: true,
      items: Array.from({ length: 12 }, (_, index) => makeItem(index + 1)),
      pageInfo: { pageSize: 50, nextCursor: "cursor-1", hasMore: true },
      summary: {
        all: 12,
        possible_match: 6,
        mismatch: 0,
        unmatched: 0,
        matched: 6,
        ignored: 0,
      },
    });
    mocks.fetchNextAdminRegistryReviewPage.mockResolvedValue({
      ok: true,
      items: [makeItem(13), makeItem(14)],
      pageInfo: { pageSize: 50, nextCursor: null, hasMore: false },
      summary: {
        all: 14,
        possible_match: 7,
        mismatch: 0,
        unmatched: 0,
        matched: 7,
        ignored: 0,
      },
    });
    (globalThis as any).ResizeObserver = class {
      observe() {}
      disconnect() {}
      unobserve() {}
    };
  });

  it("renders queue rows with virtualization and preserves row actions", async () => {
    renderPage();

    const visibleRows = await screen.findAllByText("1 Example Street");
    expect(visibleRows.length).toBeGreaterThan(0);
    expect(screen.getByText("Visible items: 12")).toBeInTheDocument();
    expect(screen.queryByText("12 Example Street")).not.toBeInTheDocument();

    const openRecordLink = screen.getAllByRole("link", { name: "Open record" })[0];
    expect(openRecordLink).toHaveAttribute("href", "/admin/registry/records/normalized-1");

    const openCandidateReviewLink = screen.getAllByRole("link", { name: "Open candidate review" })[0];
    expect(openCandidateReviewLink).toHaveAttribute(
      "href",
      "/admin/registry/properties/candidate-1?normalizedRecordId=normalized-1"
    );
  });

  it("debounces search requests before reloading the queue", async () => {
    renderPage();

    await waitFor(() => {
      expect(mocks.fetchAdminRegistryReview).toHaveBeenCalledWith("all", "");
    });

    fireEvent.change(screen.getByPlaceholderText(/Search by registry address/i), {
      target: { value: "harbour" },
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    });
    expect(mocks.fetchAdminRegistryReview).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(mocks.fetchAdminRegistryReview).toHaveBeenLastCalledWith("all", "harbour");
    });
  }, 10000);

  it("reloads when filters change and appends results on load more", async () => {
    renderPage();

    await waitFor(() => {
      expect(mocks.fetchAdminRegistryReview).toHaveBeenCalledWith("all", "");
    });

    fireEvent.click(screen.getByRole("button", { name: "matched (6)" }));
    await waitFor(() => {
      expect(mocks.fetchAdminRegistryReview).toHaveBeenLastCalledWith("matched", "");
    });

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => {
      expect(mocks.fetchNextAdminRegistryReviewPage).toHaveBeenCalledWith({
        matchStatus: "matched",
        searchQuery: "",
        pageSize: 50,
        pageCursor: "cursor-1",
      });
    });
    expect(screen.getByText("Visible items: 14")).toBeInTheDocument();
  });
});
