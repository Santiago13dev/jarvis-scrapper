/**
 * Cliente HTTP mínimo hacia la API de JarvisIA. Sin dependencias externas
 * (fetch nativo); centraliza base URL, auth header, renovación de sesión y errores.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const ACCESS_KEY = "jarvisia_access_token";
const REFRESH_KEY = "jarvisia_refresh_token";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

function clearSession() {
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

/**
 * El token de acceso dura 30 minutos. Ante un 401 se renueva con el refresh token
 * (una sola vez aunque fallen varias peticiones a la vez) y se repite la petición.
 */
let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refreshToken = window.localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return false;
  refreshing ??= (async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!response.ok) return false;
      const data = (await response.json()) as { access_token: string; refresh_token: string };
      window.localStorage.setItem(ACCESS_KEY, data.access_token);
      window.localStorage.setItem(REFRESH_KEY, data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => {
        refreshing = null;
      }, 0);
    }
  })();
  return refreshing;
}

function errorMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown })?.detail;
  if (typeof detail === "string") return detail;
  // Errores de validación de FastAPI: [{loc, msg}, …]
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  return fallback;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const token = getAccessToken();

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("No se pudo conectar con la API. Verifica que el backend esté encendido.");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth/")) {
      if (!retried && (await refreshSession())) {
        return apiFetch<T>(path, options, true);
      }
      clearSession();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      }
      throw new ApiError(401, "Tu sesión expiró. Inicia sesión de nuevo.");
    }
    throw new ApiError(response.status, errorMessage(body, response.statusText));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};
