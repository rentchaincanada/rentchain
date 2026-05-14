// Test for payment adjustment entries
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Firebase
const mockFirebase = vi.hoisted(() => ({
  collection: vi.fn(),
  doc: vi.fn(),
  set: vi.fn(),
  get: vi.fn(),
}));

vi.mock("../../config/firebase", () => ({
  db: {
    collection: mockFirebase.collection,
  },
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => next(),
}));

vi.mock("../../middleware/requireAuthz", () => ({
  requirePermission: () => (req: any, res: any, next: any) => next(),
}));

vi.mock("../../services/ledgerEventsService", () => ({
  recordPaymentEvent: vi.fn(),
}));

describe("Payment Adjustment Entries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFirebase.doc.mockReturnValue({
      id: "test-adjustment-id",
      set: mockFirebase.set,
      get: mockFirebase.get,
    });
    mockFirebase.collection.mockReturnValue({
      doc: mockFirebase.doc,
    });
  });

  describe("createPaymentAdjustmentEntry", () => {
    it("should create adjustment entry when leaseId is present and amount changes", async () => {
      // Import after mocks are set up
      const { createPaymentAdjustmentEntry } = await import("../paymentsRoutes");

      const options = {
        paymentId: "payment-123",
        landlordId: "landlord-456",
        tenantId: "tenant-789",
        leaseId: "lease-abc",
        propertyId: "property-def",
        unitId: "unit-ghi",
        originalAmountCents: 150000, // $1500.00
        newAmountCents: 160000, // $1600.00
        method: "etransfer",
        createdBy: "user-123",
      };

      await createPaymentAdjustmentEntry(options);

      expect(mockFirebase.set).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "test-adjustment-id",
          landlordId: "landlord-456",
          tenantId: "tenant-789",
          leaseId: "lease-abc",
          propertyId: "property-def",
          unitId: "unit-ghi",
          entryType: "adjustment",
          category: "payment_adjustment",
          amountCents: 10000, // $100.00 delta
          method: "etransfer",
          reference: "payment-123",
          notes: "Payment adjustment: +$100.00 (1500.00 → 1600.00)",
          sourceType: "payment_edit",
          referencePaymentId: "payment-123",
          originalAmountCents: 150000,
          newAmountCents: 160000,
          amountDeltaCents: 10000,
          createdBy: "user-123",
        }),
        { merge: false }
      );
    });

    it("should not create adjustment entry when leaseId is missing", async () => {
      const { createPaymentAdjustmentEntry } = await import("../paymentsRoutes");

      const options = {
        paymentId: "payment-123",
        landlordId: "landlord-456",
        tenantId: "tenant-789",
        leaseId: null, // No lease context
        originalAmountCents: 150000,
        newAmountCents: 160000,
        method: "etransfer",
        createdBy: "user-123",
      };

      await createPaymentAdjustmentEntry(options);

      expect(mockFirebase.set).not.toHaveBeenCalled();
    });

    it("should handle negative adjustments correctly", async () => {
      const { createPaymentAdjustmentEntry } = await import("../paymentsRoutes");

      const options = {
        paymentId: "payment-123",
        landlordId: "landlord-456",
        tenantId: "tenant-789",
        leaseId: "lease-abc",
        originalAmountCents: 160000, // $1600.00
        newAmountCents: 150000, // $1500.00
        method: "cash",
        createdBy: "user-123",
      };

      await createPaymentAdjustmentEntry(options);

      expect(mockFirebase.set).toHaveBeenCalledWith(
        expect.objectContaining({
          amountCents: -10000, // -$100.00 delta
          notes: "Payment adjustment: -$100.00 (1600.00 → 1500.00)",
          amountDeltaCents: -10000,
        }),
        { merge: false }
      );
    });

    it("should use integer cents math and avoid floating point errors", async () => {
      const { createPaymentAdjustmentEntry } = await import("../paymentsRoutes");

      const options = {
        paymentId: "payment-123",
        landlordId: "landlord-456",
        tenantId: "tenant-789",
        leaseId: "lease-abc",
        originalAmountCents: 123456, // $1234.56
        newAmountCents: 123457, // $1234.57
        method: "card",
        createdBy: "user-123",
      };

      await createPaymentAdjustmentEntry(options);

      expect(mockFirebase.set).toHaveBeenCalledWith(
        expect.objectContaining({
          amountCents: 1, // 1 cent delta
          originalAmountCents: 123456,
          newAmountCents: 123457,
          amountDeltaCents: 1,
          notes: "Payment adjustment: +$0.01 (1234.56 → 1234.57)",
        }),
        { merge: false }
      );
    });

    it("should not throw error if ledger entry creation fails", async () => {
      const { createPaymentAdjustmentEntry } = await import("../paymentsRoutes");

      mockFirebase.set.mockRejectedValueOnce(new Error("Firestore error"));

      const options = {
        paymentId: "payment-123",
        landlordId: "landlord-456",
        tenantId: "tenant-789",
        leaseId: "lease-abc",
        originalAmountCents: 150000,
        newAmountCents: 160000,
        method: "etransfer",
        createdBy: "user-123",
      };

      // Should not throw
      await expect(createPaymentAdjustmentEntry(options)).resolves.toBeUndefined();
    });
  });
});