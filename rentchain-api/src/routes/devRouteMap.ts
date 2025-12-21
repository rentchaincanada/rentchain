import type { Request, Response } from "express";

export function mountRouteMap(app: any) {
  app.get("/__debug/routes", (_req: Request, res: Response) => {
    try {
      const stack = app?._router?.stack || [];
      const paths: any[] = [];

      for (const layer of stack) {
        if (layer.route?.path) {
          const methods = Object.keys(layer.route.methods || {}).filter(Boolean);
          paths.push({ path: layer.route.path, methods });
        }
        if (layer.name === "router" && layer.regexp) {
          paths.push({ path: layer.regexp.toString(), methods: ["MOUNT"] });
        }
      }

      res.json({ ok: true, count: paths.length, routes: paths });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
  });
}
