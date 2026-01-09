import { createHash } from "crypto";

// Return hex-encoded sha256 of the given string.
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
