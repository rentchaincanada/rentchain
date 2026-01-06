export async function joinWaitlist(email: string, name?: string) {
  const url = `${window.location.origin}/api/waitlist`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name, source: "pricing" }),
  });
  const json = await res.json();
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "Failed to join waitlist");
  }
  return json;
}
