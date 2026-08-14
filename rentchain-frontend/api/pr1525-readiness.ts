import { handlePr1525ReadinessQaProxy } from "../server/pr1525ReadinessQaProxy.js";

export default async function handler(req: any, res: any) {
  return handlePr1525ReadinessQaProxy(req, res);
}
