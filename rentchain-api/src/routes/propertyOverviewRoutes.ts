import express from "express";
import {
  getPropertyOverview,
  listProperties,
} from "../services/propertyOverview";

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const properties = await listProperties();
    res.json({ properties });
  } catch (err) {
    console.error("[GET /properties] error:", (err as Error).message);
    res.status(500).json({ error: "Failed to load properties" });
  }
});

router.get("/:propertyId/overview", async (req, res) => {
  const { propertyId } = req.params;

  try {
    const overview = await getPropertyOverview(propertyId);
    res.json(overview);
  } catch (err) {
    console.error(
      "[GET /properties/:propertyId/overview] error:",
      (err as Error).message
    );

    if ((err as Error).message.includes("not found")) {
      return res.status(404).json({ error: "Property not found" });
    }

    res.status(500).json({ error: "Failed to load property overview" });
  }
});

export default router;
