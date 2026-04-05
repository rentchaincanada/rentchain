import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminRegistryImportsPage from "./AdminRegistryImportsPage";

const mocks = vi.hoisted(() => ({
  fetchAdminRegistryImportsMock: vi.fn(),
  startAdminRegistryImportMock: vi.fn(),
}));

vi.mock("../../api/adminRegistryApi", async () => {
  const actual = await vi.importActual<typeof import("../../api/adminRegistryApi")>("../../api/adminRegistryApi");
  return {
    ...actual,
    fetchAdminRegistryImports: mocks.fetchAdminRegistryImportsMock,
    startAdminRegistryImport: mocks.startAdminRegistryImportMock,
  };
});

vi.mock("../../components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function makeImport(overrides: Record<string, unknown> = {}) {
  return {
    id: "import-1",
    sourceKey: "halifax_r400",
    sourceFileName: "halifax.csv",
    sourceFileStoragePath: "registry-imports/halifax_r400/import-1.csv",
    sourceFileStorageBucket: "test-bucket",
    importBatchId: "import-1",
    rowCount: 10,
    parsedRowCount: 10,
    normalizedRowCount: 10,
    matchedRowCount: 6,
    unmatchedRowCount: 4,
    mismatchRowCount: 0,
    ignoredRowCount: 0,
    skippedRowCount: 0,
    status: "queued",
    processingMode: "async",
    progress: {
      stage: "queued",
      rowsProcessed: 0,
      rowCount: 10,
      percent: 0,
    },
    lastHeartbeatAt: "2026-04-04T10:00:00.000Z",
    failureStage: null,
    retryCount: 0,
    errorSummary: null,
    diagnostics: {
      missingPidCount: 1,
      missingAddressCount: 0,
      unsupportedStatusCount: 0,
      invalidNumericFieldCount: 0,
      duplicateRowHashCount: 0,
    },
    startedAt: null,
    completedAt: null,
    createdBy: "admin-1",
    createdAt: "2026-04-04T10:00:00.000Z",
    ...overrides,
  };
}

describe("AdminRegistryImportsPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.fetchAdminRegistryImportsMock.mockReset();
    mocks.startAdminRegistryImportMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queues an import quickly and polls while active imports remain", async () => {
    const queuedImport = makeImport({
      progress: { stage: "file_load", rowsProcessed: 0, rowCount: 0, percent: 4 },
      retryCount: 1,
    });
    const completedImport = makeImport({
      status: "completed",
      progress: { stage: "completed", rowsProcessed: 10, rowCount: 10, percent: 100 },
      startedAt: "2026-04-04T10:00:01.000Z",
      completedAt: "2026-04-04T10:00:05.000Z",
    });

    mocks.fetchAdminRegistryImportsMock
      .mockResolvedValueOnce([queuedImport])
      .mockResolvedValueOnce([queuedImport])
      .mockResolvedValueOnce([completedImport]);
    mocks.startAdminRegistryImportMock.mockResolvedValue({
      ok: true,
      importId: "import-1",
      status: "queued",
      importRecord: queuedImport,
    });

    render(
      <MemoryRouter initialEntries={["/admin/registry/imports"]}>
        <Routes>
          <Route path="/admin/registry/imports" element={<AdminRegistryImportsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Registry Imports")).toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.fetchAdminRegistryImportsMock).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByPlaceholderText("Optional file name"), { target: { value: "halifax.csv" } });
    fireEvent.change(screen.getByPlaceholderText("Paste Halifax CSV content here if you are not using file upload."), {
      target: { value: "OBJECTID,Registration Number,PID,Address,Registered\n1,REG-1,1234567,123 Example St,Y" },
    });
    expect(screen.getByRole("button", { name: "Queue import" })).toBeEnabled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Queue import" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.startAdminRegistryImportMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Import queued: import-1")).toBeInTheDocument();
    expect(mocks.fetchAdminRegistryImportsMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Stage: file load/i)).toBeInTheDocument();
    expect(screen.getByText(/File-load retries: 1/i)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.fetchAdminRegistryImportsMock).toHaveBeenCalledTimes(3);
    expect(screen.getByText(/Stage: completed/i)).toBeInTheDocument();
  });

  it("shows clear file-load failure details", async () => {
    mocks.fetchAdminRegistryImportsMock.mockResolvedValue([
      makeImport({
        status: "failed",
        progress: { stage: "failed", rowsProcessed: 0, rowCount: 0, percent: 100 },
        failureStage: "file_load",
        errorSummary: "DEADLINE_EXCEEDED while reading csv",
        retryCount: 2,
      }),
    ]);

    render(
      <MemoryRouter initialEntries={["/admin/registry/imports"]}>
        <Routes>
          <Route path="/admin/registry/imports" element={<AdminRegistryImportsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(/Failure stage: file load/i)).toBeInTheDocument();
    expect(screen.getByText(/DEADLINE_EXCEEDED while reading csv/i)).toBeInTheDocument();
    expect(screen.getByText(/File-load retries: 2/i)).toBeInTheDocument();
  });
});
