import type { Request, Response, NextFunction } from "express";

export function routeSource(source: string) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("x-route-source", source);
    next();
  };
}
