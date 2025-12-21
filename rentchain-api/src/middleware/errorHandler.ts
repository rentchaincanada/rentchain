export function errorHandler(err: any, _req: any, res: any, _next: any) {
  const status = err?.statusCode || err?.status || 500;
  const body = err?.body;

  if (body) {
    return res.status(status).json(body);
  }

  // Legacy facade 501 or generic errors
  res.status(status).json({
    error: err?.error || "INTERNAL_ERROR",
    message: err?.message || "Internal Server Error",
    code: err?.code || "INTERNAL_ERROR",
  });
}
