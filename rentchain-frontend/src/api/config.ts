export const API_HOST =
import { API_BASE } from "../config/apiBase";

export const API_HOST = API_BASE || "http://localhost:3000";

export const API_BASE_URL = `${API_HOST.replace(/\/$/, "")}/api`;
