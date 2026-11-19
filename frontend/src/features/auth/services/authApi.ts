import { apiRequest } from "../../../lib/api-client";
import type { UserProfile } from "../types/auth";

export function syncCurrentUser(): Promise<UserProfile> {
  return apiRequest<UserProfile>("/api/auth/sync", { method: "POST" });
}

export function getCurrentProfile(): Promise<UserProfile> {
  return apiRequest<UserProfile>("/api/v1/users/me");
}

export function updateCurrentProfile(fullName: string): Promise<UserProfile> {
  return apiRequest<UserProfile>("/api/v1/users/me", {
    method: "PATCH",
    body: JSON.stringify({ full_name: fullName }),
  });
}

export function deleteCurrentAccount(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/api/v1/users/me", {
    method: "DELETE",
  });
}
