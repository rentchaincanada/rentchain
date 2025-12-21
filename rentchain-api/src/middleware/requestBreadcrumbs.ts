import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./authMiddleware";

 type Crumb = { t: string; method: string; path: string; userId?: string };

const MAX = 50;
const crumbs: Crumb[] = [];

export function requestBreadcrumbs(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  crumbs.push({
    t: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id,
  });
  if (crumbs.length > MAX) crumbs.splice(0, crumbs.length - MAX);
  next();
}

export function getCrumbs() {
  return crumbs.slice();
}
