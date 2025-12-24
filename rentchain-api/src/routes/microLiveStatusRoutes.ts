import { Router } from "express";
import { db } from "../config/firebase";
import { requireMicroLiveAccess } from "../middleware/requireMicroLiveAccess";
import { incrementCounter, logEvent } from "../services/telemetryService";

const router = Router();

const STEPS = [
  { key: "import_properties", label: "Import properties/units (CSV)" },
  { key: "import_tenants", label: "Import tenants (CSV)" },
  { key: "run_screening", label: "Run 1 screening" },
  { key: "view_report", label: "View report snapshot" },
  { key: "book_call", label: "Book onboarding call" },
] as const;

function nowMs() {
  return Date.now();
}

router.get("/micro-live/status", requireMicroLiveAccess, async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  const ref = db.collection("landlords").doc(landlordId);
  const snap = await ref.get();
  const data = snap.data() as any;

  const progress = data?.microLiveProgress || {};
  const completed: Record<string, boolean> = progress?.completed || {};
  const completedCount = STEPS.filter((s) => Boolean(completed[s.key])).length;

  await incrementCounter({ name: "micro_live_status_view", dims: { landlordId }, amount: 1 });

  return res.json({
    ok: true,
    landlordId,
    steps: STEPS,
    completed,
    completedCount,
    total: STEPS.length,
    updatedAt: progress?.updatedAt || null,
  });
});

router.post("/micro-live/complete-step", requireMicroLiveAccess, async (req: any, res) => {
  const landlordId = req.user?.landlordId || req.user?.id;
  const stepKey = String(req.body?.stepKey || "").trim();

  if (!STEPS.some((s) => s.key === stepKey)) {
    return res.status(400).json({ ok: false, error: "Invalid stepKey" });
  }

  const ref = db.collection("landlords").doc(landlordId);
  const ts = nowMs();

  await db.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref);
    const data = snap.data() as any;
    const progress = data?.microLiveProgress || {};
    const completed = { ...(progress.completed || {}) };

    if (!completed[stepKey]) {
      completed[stepKey] = true;
    }

    tx.set(
      ref,
      {
        microLiveProgress: {
          completed,
          updatedAt: ts,
        },
        updatedAt: ts,
      },
      { merge: true }
    );
  });

  await incrementCounter({ name: "micro_live_step_complete", dims: { stepKey }, amount: 1 });
  await logEvent({
    type: "micro_live_step_complete",
    landlordId,
    actor: req.user?.email || req.user?.id || null,
    meta: { stepKey },
  });

  return res.json({ ok: true, stepKey });
});

export default router;
