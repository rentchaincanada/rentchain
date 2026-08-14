import { handlePr1525BrowserBootstrap } from "../../server/pr1525BrowserBootstrap.js";

export default function handler(req: any, res: any) {
  return handlePr1525BrowserBootstrap(req, res);
}
