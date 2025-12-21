import api from "./client";

export async function fetchMe() {
  const res = await api.get("/me");
  return res.data as { landlordId?: string; email?: string; role?: string; plan?: string };
}
