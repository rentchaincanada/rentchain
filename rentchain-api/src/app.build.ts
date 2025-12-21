import express from "express";
import cors from "cors";
import { mountSafeRoutes } from "./app.routes";

export const app = express();
app.set("etag", false);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Mount safe routes
mountSafeRoutes(app);
