import { handlePr1512NoticesQaProxy } from "../../server/pr1512NoticesQaProxy.js";

export default async function handler(req: any, res: any) {
  return handlePr1512NoticesQaProxy(req, res);
}
