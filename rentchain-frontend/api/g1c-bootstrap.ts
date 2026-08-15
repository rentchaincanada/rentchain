import { handleG1cBrowserBootstrap } from "../server/g1cBrowserBootstrap.js";

export default function handler(req: any, res: any) {
  return handleG1cBrowserBootstrap(req, res);
}
