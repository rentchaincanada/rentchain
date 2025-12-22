import type { Request, Response } from "express";
import { jsonError } from "../lib/httpResponse";
import { parseRange } from "../lib/httpRange";
import { getFileMetadata, getFileReadStream, getFileReadStreamRange } from "../lib/gcsRead";

export async function handleArtifactDownload(opts: {
  req: Request;
  res: Response;
  obj: { bucket: string; path: string; contentType?: string; filename?: string };
  kind: "csv" | "report";
}) {
  const { req, res, obj } = opts;
  const requestId = req.requestId;

  const meta = await getFileMetadata({ bucket: obj.bucket, path: obj.path });
  const size = Number(meta.size || 0);
  const etag = String(meta.etag || "");

  if (etag) res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("x-request-id", requestId || "");

  const inm = req.header("if-none-match");
  if (etag && inm && inm === etag) {
    return res.status(304).end();
  }

  const contentType = obj.contentType || (opts.kind === "csv" ? "text/csv" : "application/json");
  res.setHeader("Content-Type", contentType);

  const filename =
    (obj.filename || (opts.kind === "csv" ? "import.csv" : "import-report.json")).replace(/"/g, "");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  if (req.method === "HEAD") {
    res.setHeader("Content-Length", String(size));
    return res.status(200).end();
  }

  const rangeHeader = req.header("range") || undefined;
  const range = parseRange(rangeHeader, size);

  if (rangeHeader && !range) {
    res.setHeader("Content-Range", `bytes */${size}`);
    return res.status(416).end();
  }

  if (range) {
    const { start, end } = range;
    const chunkSize = end - start + 1;

    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
    res.setHeader("Content-Length", String(chunkSize));

    const stream = getFileReadStreamRange({ bucket: obj.bucket, path: obj.path, start, end });
    stream.on("error", (e: any) => {
      console.error("[download] range stream error", { requestId, message: e?.message });
      if (!res.headersSent) return jsonError(res, 500, "INTERNAL", "Download failed", undefined, requestId);
      try {
        res.end();
      } catch {
        /* ignore */
      }
    });
    return stream.pipe(res);
  }

  res.setHeader("Content-Length", String(size));

  const stream = getFileReadStream({ bucket: obj.bucket, path: obj.path });
  stream.on("error", (e: any) => {
    console.error("[download] stream error", { requestId, message: e?.message });
    if (!res.headersSent) return jsonError(res, 500, "INTERNAL", "Download failed", undefined, requestId);
    try {
      res.end();
    } catch {
      /* ignore */
    }
  });
  return stream.pipe(res);
}
