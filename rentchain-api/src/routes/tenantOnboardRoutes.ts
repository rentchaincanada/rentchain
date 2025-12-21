// rentchain-api/src/routes/tenantOnboardRoutes.ts
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db } from "../config/firebase";

const router = Router();

/**
 * POST /api/tenants/onboard
 * Creates:
 *  - tenant record
 *  - lease record
 *  - first ledger event
 */
router.post("/tenants/onboard", async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      propertyId,
      propertyName,
      unit,
      applicationId,
      moveInDate,
      monthlyRent,
    } = req.body;

    if (!fullName || !propertyId || !unit) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const tenantId = uuidv4();

    // Tenant record
    const tenantRecord = {
      id: tenantId,
      fullName,
      email: email ?? null,
      phone: phone ?? null,
      propertyId,
      propertyName,
      unit,
      balance: 0,
      status: "Active",
      createdAt: new Date().toISOString(),
      sourceApplication: applicationId ?? null,
    };

    await db.collection("tenants").doc(tenantId).set(tenantRecord);

    // Lease record
    const leaseRecord = {
      tenantId,
      propertyId,
      propertyName,
      unit,
      leaseStart: moveInDate ?? new Date().toISOString().split("T")[0],
      monthlyRent: monthlyRent ?? 0,
      createdAt: new Date().toISOString(),
    };

    await db.collection("leases").add(leaseRecord);

    // Ledger event
    const ledgerEvent = {
      id: uuidv4(),
      tenantId,
      type: "TenantCreated",
      date: new Date().toISOString(),
      notes: `Tenant created from application ${applicationId ?? "-"}`,
    };

    await db.collection("ledger").add(ledgerEvent);

    return res.status(201).json({
      ok: true,
      message: "Tenant onboarded successfully",
      tenantId,
    });
  } catch (err: any) {
    console.error("[POST /tenants/onboard] ERROR:", err);
    return res
      .status(500)
      .json({ error: err?.message ?? "Failed to onboard tenant" });
  }
});

export default router;
