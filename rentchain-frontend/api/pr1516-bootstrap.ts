import {
  handlePr1516BrowserQaBootstrap,
  type Pr1516BootstrapRequest,
  type Pr1516BootstrapResponseWriter,
} from "../server/pr1516BrowserQaBootstrap.js";

export default async function handler(req: Pr1516BootstrapRequest, res: Pr1516BootstrapResponseWriter) {
  return handlePr1516BrowserQaBootstrap(req, res);
}
