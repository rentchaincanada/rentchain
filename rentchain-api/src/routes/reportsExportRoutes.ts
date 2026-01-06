import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requirePermission } from "../middleware/requireAuthz";

const router = Router();

function csvEscape(v: any): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCSV(rows: Record<string, any>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const headerLine = headers.map(csvEscape).join(",");
  const lines = rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","));
  return [headerLine, ...lines].join("\n");
}

router.get(
  "/reports/export/monthly-ops",
  requireAuth,
  requirePermission("reports.export"),
  async (req: any, res) => {
    const landlordId = req.user?.landlordId || req.user?.id;
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const period = String(req.query?.period || "").trim() || "current";

    const rows = [
      {
        period,
        landlordId,
        portfolioProperties: "",
        portfolioUnits: "",
        occupancyRate: "",
        rentCollected: "",
        rentOutstanding: "",
        delinquenciesCount: "",
        newApplications: "",
        newLeases: "",
        maintenanceOpen: "",
        noticesIssued: "",
        updatedAt: new Date().toISOString(),
      },
    ];

    const csv = toCSV(rows);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="rentchain-monthly-ops-${period}.csv"`
    );

    return res.status(200).send(csv);
  }
);

export default router;
