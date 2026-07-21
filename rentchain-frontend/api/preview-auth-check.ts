import { getVercelOidcToken } from "@vercel/oidc";

import {
  PreviewAuthBridgeError,
  readPreviewAuthConfig,
  runPreviewAuthBridge,
} from "../server/previewAuthBridge.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const config = readPreviewAuthConfig(process.env);
    const vercelOidcToken = await getVercelOidcToken({ audience: config.gcpAudience });
    const evidence = await runPreviewAuthBridge({
      config,
      vercelOidcToken,
      wrongAudience: req.query?.test === "wrong-audience",
    });
    return res.status(200).json(evidence);
  } catch (error) {
    const bridgeError =
      error instanceof PreviewAuthBridgeError
        ? error
        : new PreviewAuthBridgeError("IDENTITY_BRIDGE_FAILED");
    return res.status(bridgeError.status).json({ ok: false, error: bridgeError.code });
  }
}
