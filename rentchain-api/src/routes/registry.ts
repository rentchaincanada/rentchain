import type { Express, Router } from "express";

type Mount = {
  path: string;
  router: Router;
  source: string;
  env?: "dev" | "prod" | "both";
};

export function mountRoutes(app: Express, mounts: Mount[]) {
  const isProd = process.env.NODE_ENV === "production";

  for (const m of mounts) {
    const allowed =
      m.env === "both" ||
      m.env === undefined ||
      (m.env === "prod" && isProd) ||
      (m.env === "dev" && !isProd);

    if (!allowed) continue;

    app.use(m.path, (req, res, next) => {
      res.setHeader("x-route-source", m.source);
      next();
    });

    app.use(m.path, m.router);
  }
}
