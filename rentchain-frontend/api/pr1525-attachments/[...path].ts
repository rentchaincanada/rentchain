import { handlePr1525AttachmentsQaProxy } from "../../server/pr1525AttachmentsQaProxy.js";

export const config = { api: { bodyParser: false } };

export default async function handler(req: any, res: any) {
  return handlePr1525AttachmentsQaProxy(req, res);
}
