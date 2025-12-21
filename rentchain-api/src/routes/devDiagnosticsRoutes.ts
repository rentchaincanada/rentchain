import { Router } from "express";
import { db } from "../config/firebase";

const router = Router();

router.get("/properties-sample", async (_req, res) => {
  try {
    const snap = await db.collection("properties").limit(10).get();
    const items = snap.docs.map((d) => {
      const data: any = d.data();
      return {
        id: d.id,
        landlordId: data.landlordId ?? null,
        accountId: data.accountId ?? null,
        createdAt: data.createdAt ?? null,
        name: data.name ?? data.nickname ?? null,
      };
    });
    return res.json({ ok: true, count: snap.size, items });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

export default router;
