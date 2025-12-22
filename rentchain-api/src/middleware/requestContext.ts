import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header("x-request-id");
  const requestId = (incoming && String(incoming).slice(0, 80)) || randomUUID();

  (req as any).requestId = requestId;
  res.setHeader("x-request-id", requestId);

  const started = Date.now();
  res.on("finish", () => {
    if (process.env.NODE_ENV !== "production") {
      const ms = Date.now() - started;
      console.log(
        `[REQ] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms) rid=${requestId}`
      );
    }
  });

  next();
}
