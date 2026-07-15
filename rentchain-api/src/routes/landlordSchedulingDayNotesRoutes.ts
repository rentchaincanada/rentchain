import { Router, Response } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import {
  createSchedulingDayNote,
  deleteSchedulingDayNote,
  groupSchedulingDayNotesByDate,
  listSchedulingDayNotesForLandlord,
  SchedulingDayNotesValidationError,
  updateSchedulingDayNote,
} from "../services/schedulingDayNotesService";

const router = Router();

function actorFromRequest(req: any, landlordId: string) {
  return {
    id: String(req.user?.id || req.user?.uid || landlordId),
    email: typeof req.user?.email === "string" ? req.user.email : null,
  };
}

function routeError(res: Response, error: unknown) {
  if (error instanceof SchedulingDayNotesValidationError) {
    return res.status(error.status).json({
      ok: false,
      error: error.code,
      code: error.code,
      message: error.message,
    });
  }
  return res.status(500).json({
    ok: false,
    error: "SCHEDULING_DAY_NOTE_REQUEST_FAILED",
    code: "SCHEDULING_DAY_NOTE_REQUEST_FAILED",
  });
}

router.get("/scheduling/day-notes", requireAuth, requireLandlord, async (req: any, res: Response) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "");
    const startDate = String(req.query?.startDate || "");
    const endDate = String(req.query?.endDate || startDate);
    const notes = await listSchedulingDayNotesForLandlord({ landlordId, startDate, endDate });
    return res.json({
      ok: true,
      notes,
      notesByDate: groupSchedulingDayNotesByDate(notes),
    });
  } catch (error) {
    return routeError(res, error);
  }
});

router.get("/scheduling/day-notes/:date", requireAuth, requireLandlord, async (req: any, res: Response) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "");
    const date = String(req.params.date || "");
    const notes = await listSchedulingDayNotesForLandlord({ landlordId, startDate: date, endDate: date });
    return res.json({
      ok: true,
      date,
      notes,
    });
  } catch (error) {
    return routeError(res, error);
  }
});

router.post("/scheduling/day-notes/:date", requireAuth, requireLandlord, async (req: any, res: Response) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "");
    const note = await createSchedulingDayNote({
      landlordId,
      date: String(req.params.date || ""),
      noteText: req.body?.noteText,
      source: req.body?.source || "scheduling",
      actor: actorFromRequest(req, landlordId),
    });
    return res.status(201).json({ ok: true, note });
  } catch (error) {
    return routeError(res, error);
  }
});

router.patch("/scheduling/day-notes/:date/:noteId", requireAuth, requireLandlord, async (req: any, res: Response) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "");
    const note = await updateSchedulingDayNote({
      landlordId,
      date: String(req.params.date || ""),
      noteId: String(req.params.noteId || ""),
      noteText: req.body?.noteText,
      source: req.body?.source || "scheduling",
      actor: actorFromRequest(req, landlordId),
    });
    return res.json({ ok: true, note });
  } catch (error) {
    return routeError(res, error);
  }
});

router.delete("/scheduling/day-notes/:date/:noteId", requireAuth, requireLandlord, async (req: any, res: Response) => {
  try {
    const landlordId = String(req.user?.landlordId || req.user?.id || "");
    const note = await deleteSchedulingDayNote({
      landlordId,
      date: String(req.params.date || ""),
      noteId: String(req.params.noteId || ""),
      actor: actorFromRequest(req, landlordId),
    });
    return res.json({ ok: true, note });
  } catch (error) {
    return routeError(res, error);
  }
});

export default router;
