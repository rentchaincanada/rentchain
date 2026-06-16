import { Request, Response } from "express";
import { processSigningWebhook, signingErrorCode, signingErrorStatus } from "../../services/signing/leaseSigningService";

function frontendSigningCompleteUrl() {
  const explicit = String(process.env.SIGNING_PROVIDER_RETURN_URL || process.env.SIGNING_RETURN_URL || "").trim();
  if (explicit) return explicit;
  const appBaseUrl = String(process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
  return appBaseUrl ? `${appBaseUrl}/signing/complete` : null;
}

export function signingWebhookBrowserReturnHandler(_req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  const completeUrl = frontendSigningCompleteUrl();
  if (completeUrl) {
    return res.redirect(303, completeUrl);
  }
  return res
    .status(200)
    .type("text/plain")
    .send("Lease signing completed. You may close this page or return to RentChain.");
}

export async function signingWebhookHandler(req: Request & { rawBody?: Buffer }, res: Response) {
  const providerId = String(req.params?.providerId || req.query?.provider || process.env.SIGNING_PROVIDER || "mock")
    .trim()
    .toLowerCase();
  try {
    const result = await processSigningWebhook({
      providerId,
      headers: req.headers,
      body: req.body,
      rawBody: Buffer.isBuffer(req.body) ? req.body : req.rawBody,
    });
    if (result.providerResponseText) {
      return res.status(200).type("text/plain").send(result.providerResponseText);
    }
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    const status = signingErrorStatus(error);
    const code = signingErrorCode(error);
    return res.status(status >= 400 && status < 600 ? status : 500).json({ ok: false, error: code });
  }
}
