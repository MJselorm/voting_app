import { getIdToken } from "../lib/firebase";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApiError {
  detail: string;
  status: number;
}

export interface UserProfile {
  id: string;
  firebase_uid: string;
  student_id: string | null;
  full_name: string;
  email: string;
  role: "STUDENT" | "ELECTION_OFFICIAL" | "SUPER_ADMIN";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SyncPayload {
  firebase_uid: string;
  full_name: string;
  email: string;
  student_id?: string;
}

// ── Core Request Helper ───────────────────────────────────────────────────────

/**
 * Make an authenticated API request.
 * Automatically attaches the Firebase ID token as a Bearer token.
 *
 * Security: Token is sent in the Authorization header only — never in URLs
 * or query parameters.
 */
async function authRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getIdToken(true); // Always refresh for accuracy

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let detail = "An unexpected error occurred.";
    try {
      const errorData = await response.json();
      detail = errorData?.detail || detail;
    } catch {
      // Response body was not JSON
    }
    const error: ApiError = { detail, status: response.status };
    throw error;
  }

  return response.json() as Promise<T>;
}

/**
 * Make an unauthenticated API request (no token required).
 */
async function publicRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let detail = "An unexpected error occurred.";
    try {
      const errorData = await response.json();
      detail = errorData?.detail || detail;
    } catch {
      // pass
    }
    const error: ApiError = { detail, status: response.status };
    throw error;
  }

  return response.json() as Promise<T>;
}

// ── Auth API Functions ────────────────────────────────────────────────────────

/**
 * Sync the Firebase user to the PostgreSQL backend.
 * Call this after successful Firebase registration/login.
 *
 * The backend will create a new user record if one doesn't exist,
 * or return the existing record.
 */
export async function syncUser(payload: SyncPayload): Promise<{
  user: UserProfile;
  created: boolean;
}> {
  return publicRequest("/api/auth/sync", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Get the current authenticated user's profile from the backend.
 * Requires a valid Firebase ID token (attached automatically).
 */
export async function getMe(): Promise<UserProfile> {
  return authRequest<UserProfile>("/api/auth/me");
}

/**
 * Check backend health.
 */
export async function healthCheck(): Promise<{ status: string }> {
  return publicRequest("/health");
}
