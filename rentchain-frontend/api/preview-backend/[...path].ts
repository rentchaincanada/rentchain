import { handlePreviewBackendProxy } from "../../server/previewBackendProxy.js";

export default async function handler(req: any, res: any) {
  return handlePreviewBackendProxy(req, res);
}
