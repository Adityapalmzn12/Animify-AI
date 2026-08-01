const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://zoological-commitment-production-2ef6.up.railway.app/api/v1";

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  error?: { code?: string; message?: string };
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("animify_admin_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("animify_admin_token", token);
  else localStorage.removeItem("animify_admin_token");
}

export function getStoredUser<T = unknown>(): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("animify_admin_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setStoredUser(user: unknown | null) {
  if (typeof window === "undefined") return;
  if (user) localStorage.setItem("animify_admin_user", JSON.stringify(user));
  else localStorage.removeItem("animify_admin_user");
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  const json = (await res.json().catch(() => ({}))) as ApiEnvelope<T> & {
    message?: string;
  };

  if (!res.ok) {
    const msg =
      json?.error?.message ||
      json?.message ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return (json?.data ?? json) as T;
}

export { API_URL };
