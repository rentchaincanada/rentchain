import { handlePr1516NoticesQaProxy } from "../../server/pr1516NoticesQaProxy.js";

export default async function handler(req: any, res: any) {
  return handlePr1516NoticesQaProxy(req, res);
}
