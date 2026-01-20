import { BUILD_ID } from "@/constants/build";

export function templateUrl(path: string) {
  if (!BUILD_ID) return path;
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}v=${BUILD_ID}`;
}
