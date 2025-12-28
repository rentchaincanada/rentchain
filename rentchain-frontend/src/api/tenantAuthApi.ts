import { resolveApiUrl } from "../lib/apiClient";

export async function tenantLogin(email: string, password: string): Promise<{ token: string }> {
  const res = await fetch(resolveApiUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const text = await res.text();
  if (!res.ok) {
    let message = `Login failed (${res.status})`;
    try {
      const parsed = text ? JSON.parse(text) : null;
      if (parsed?.error) message = parsed.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return text ? (JSON.parse(text) as { token: string }) : { token: "" };
}
