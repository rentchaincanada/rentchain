import { TEMPLATES_VERSION } from "../constants/templates";

export function templateUrl(path: string) {
  if (!TEMPLATES_VERSION) return path;
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}v=${TEMPLATES_VERSION}`;
}
