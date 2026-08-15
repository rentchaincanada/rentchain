export const G1C_QA_SESSION_KEY = "rentchain.qa.g1c.fixed-session";
export const G1C_QA_SCOPE = "g1c-synthetic-identity-qa-v1";
export const G1C_QA_PRINCIPAL = "qa-g1c-tenant";

export function hasG1cQaSession(storage: Pick<Storage, "getItem"> | null = typeof window === "undefined" ? null : window.sessionStorage) {
  if (!storage) return false;
  try {
    const value = JSON.parse(storage.getItem(G1C_QA_SESSION_KEY) || "null");
    return value?.scope === G1C_QA_SCOPE && value?.session?.principalId === G1C_QA_PRINCIPAL;
  } catch {
    return false;
  }
}
