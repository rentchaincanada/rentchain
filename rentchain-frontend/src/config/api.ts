import API_BASE from "./apiBase";

export const API_BASE_URL = API_BASE ? `${API_BASE.replace(/\/$/, "")}/api` : "";
export { API_BASE };
