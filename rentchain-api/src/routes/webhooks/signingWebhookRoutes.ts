import { Request, Response } from "express";
import { processSigningWebhook, signingErrorCode, signingErrorStatus } from "../../services/signing/leaseSigningService";

export async function signingWebhookHandler(req: Request & { rawBody?: Buffer }, res: Response) {
  const providerId = String(req.params?.providerId || req.query?.provider || process.env.SIGNING_PROVIDER || "mock")
    .trim()
    .toLowerCase();
  try {
    await processSigningWebhook({
      providerId,
      headers: req.headers,
      body: req.body,
      rawBody: Buffer.isBuffer(req.body) ? req.body : req.rawBody,
    });
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    const status = signingErrorStatus(error);
    const code = signingErrorCode(error);
    return res.status(status >= 400 && status < 600 ? status : 500).json({ ok: false, error: code });
  }
}
