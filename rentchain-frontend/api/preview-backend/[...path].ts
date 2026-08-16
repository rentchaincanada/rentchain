import { handlePreviewBackendProxy } from "../../server/previewBackendProxy.js";

export const config = { api: { bodyParser: false } };

export default async function handler(req: any, res: any) {
  return handlePreviewBackendProxy(req, res);
}
