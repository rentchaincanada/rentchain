import { apiUrl } from "./config";
import { getAuthToken } from "../lib/authToken";

type DownloadAuthenticatedExportOptions = {
  path: string;
  fallbackFilename: string;
  errorMessage: string;
};

export function parseContentDispositionFilename(
  disposition: string | null,
  fallbackFilename: string
): string {
  const raw = disposition || "";
  const match = raw.match(/filename\*?=(?:UTF-8''|\"?)([^\";]+)/i);
  return match?.[1] ? decodeURIComponent(match[1].replace(/\"/g, "").trim()) : fallbackFilename;
}

export async function downloadAuthenticatedExport({
  path,
  fallbackFilename,
  errorMessage,
}: DownloadAuthenticatedExportOptions): Promise<{ blob: Blob; filename: string }> {
  const token = getAuthToken();
  const response = await fetch(apiUrl(path), {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = text || errorMessage;
    try {
      const json = text ? JSON.parse(text) : null;
      message = json?.message || json?.error || message;
    } catch {
      // Ignore non-JSON responses and fall back to the provided message.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const filename = parseContentDispositionFilename(response.headers.get("Content-Disposition"), fallbackFilename);

  return { blob, filename };
}
