import { Response, NextFunction, RequestHandler } from "express";

type Crumb = { t: string; method: string; path: string; userId?: string };

const MAX = 50;
const crumbs: Crumb[] = [];

export const requestBreadcrumbs: RequestHandler = (req, _res, next: NextFunction) => {
  const anyReq: any = req;
  crumbs.push({
    t: new Date().toISOString(),
    method: req.method,
    path: anyReq.originalUrl || req.url,
    userId: anyReq.user?.id,
  });
  if (crumbs.length > MAX) crumbs.splice(0, crumbs.length - MAX);
  next();
};

export function getCrumbs() {
  return crumbs.slice();
}
