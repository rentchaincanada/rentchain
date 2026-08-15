import { handleG1cIdentityQaProxy } from "../../server/g1cIdentityQaProxy.js";

export const config = { api: { bodyParser: false } };

export default async function handler(req: any, res: any) {
  return handleG1cIdentityQaProxy(req, res);
}
