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
  is_verified: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncPayload {
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
  const token = await getIdToken(false); // Use cached token to prevent unnecessary network delay


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
      if (typeof errorData?.detail === "string") {
        detail = errorData.detail;
      } else if (Array.isArray(errorData?.detail)) {
        detail = errorData.detail.map((e: any) => e.msg || JSON.stringify(e)).join(", ");
      } else if (errorData?.message) {
        detail = errorData.message;
      }
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
  return authRequest("/api/auth/sync", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface ImportPreview { preview_id: string; total_rows: number; valid_rows: number; new_students: number; existing_records: number; invalid_rows: number; errors: { row: number; student_id: string | null; reason: string }[]; records: Record<string, string>[]; }
export async function previewStudentImport(file: File): Promise<ImportPreview> {
  const token = await getIdToken(false);
  const form = new FormData(); form.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/admin/students/import/preview`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form });
  if (!response.ok) throw { detail: (await response.json()).detail || "Preview failed." };
  return response.json();
}
export async function confirmStudentImport(preview_id: string, existing_record_behavior: "update" | "skip") {
  return authRequest<{ success: boolean; added: number; updated: number; skipped: number; failed: number; total_student_records: number }>("/api/admin/students/import/confirm", { method: "POST", body: JSON.stringify({ preview_id, existing_record_behavior }) });
}
export async function listAdminStudents(search = "") { return authRequest<StudentProfile[]>(`/api/admin/students${search ? `?search=${encodeURIComponent(search)}` : ""}`); }

/**
 * Get the current authenticated user's profile from the backend.
 * Requires a valid Firebase ID token (attached automatically).
 */
export async function getMe(): Promise<UserProfile> {
  return authRequest<UserProfile>("/api/auth/me");
}

export interface AdminDashboardStats {
  uploaded_student_records: number;
  registered_users: number;
  registered_voters: number;
  eligible_voters: number;
  verified_voters: number;
}

let dashboardStatsRequest: Promise<AdminDashboardStats> | null = null;

export function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  // React Strict Mode may mount a page twice in development. Reuse only an
  // in-flight request; after it settles the next dashboard visit fetches fresh data.
  if (!dashboardStatsRequest) {
    dashboardStatsRequest = authRequest<AdminDashboardStats>("/api/auth/admin/dashboard-stats")
      .finally(() => { dashboardStatsRequest = null; });
  }
  return dashboardStatsRequest;
}

/**
 * Update the current authenticated user's profile in the backend.
 */
export async function updateMe(payload: {
  full_name?: string;
  student_id?: string | null;
}): Promise<UserProfile> {
  return authRequest<UserProfile>("/api/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export interface StudentProfile {
  id: string;
  student_id: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
  level: string | null;
  class_: string | null;
  status: string;
}

export interface VerificationResponse {
  success: boolean;
  message: string;
  is_verified: boolean;
  user: UserProfile;
}

export interface EligibilityCheckResponse {
  is_eligible: boolean;
  reason: string;
  user: UserProfile;
  student: StudentProfile | null;
}

export async function checkEligibility(): Promise<EligibilityCheckResponse> {
  return authRequest<EligibilityCheckResponse>("/api/eligibility/check", {
    method: "POST",
  });
}

/**
 * Verify student identity against official records on FastAPI backend.
 */
export async function verifyStudent(): Promise<VerificationResponse> {
  return authRequest<VerificationResponse>("/api/auth/verify-student", {
    method: "POST",
  });
}

/**
 * Get authenticated student's official record (department, level, class).
 */
export async function getStudentProfile(): Promise<StudentProfile> {
  return authRequest<StudentProfile>("/api/students/me");
}

/**
 * Check backend health.
 */
export async function healthCheck(): Promise<{ status: string }> {
  return publicRequest("/health");
}

// ── Election Types & API Functions ──────────────────────────────────────────

export type ElectionStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "OFFICIAL_REVIEW"
  | "SUPER_ADMIN_FINAL_APPROVAL"
  | "APPROVED"
  | "SCHEDULED"
  | "LIVE"
  | "ENDED"
  | "CANCELLED";

export type ResultVisibility =
  | "HIDDEN_UNTIL_ENDED"
  | "OFFICIALS_DURING_VOTING"
  | "PUBLIC_LIVE";

export interface PositionItem {
  id?: string;
  name: string;
  description?: string | null;
  display_order: number;
  number_of_winners: number;
  created_at?: string;
}

export interface EligibilityCriteria {
  departments: string[];
  levels: string[];
  classes: string[];
  statuses: string[];
}

export interface OfficialUser {
  id: string;
  full_name: string;
  email: string;
  role: "STUDENT" | "ELECTION_OFFICIAL" | "SUPER_ADMIN";
  is_active: boolean;
}

export interface OfficialAssignment {
  id: string;
  election_id: string;
  user_id: string;
  assigned_at: string;
  user?: OfficialUser;
}

export interface ElectionApprovalItem {
  id: string;
  election_id: string;
  user_id: string;
  approval_status: "PENDING" | "APPROVED" | "REJECTED";
  comment?: string | null;
  approved_at?: string | null;
  created_at: string;
  user?: OfficialUser;
}

export interface ElectionAuditLogItem {
  id: string;
  election_id: string;
  user_id?: string | null;
  user_name?: string | null;
  action: string;
  details?: Record<string, any> | null;
  created_at: string;
}

export interface ElectionListItem {
  id: string;
  name: string;
  description?: string | null;
  department: string;
  election_type: string;
  start_at: string | null;
  end_at: string | null;
  status: ElectionStatus;
  result_visibility: ResultVisibility;
  created_by: string;
  creator_name?: string | null;
  positions_count: number;
  officials_count: number;
  created_at: string;
  updated_at: string;
}

export interface ElectionDetail {
  id: string;
  name: string;
  description?: string | null;
  department: string;
  election_type: string;
  start_at: string | null;
  end_at: string | null;
  status: ElectionStatus;
  result_visibility: ResultVisibility;
  eligibility_criteria: EligibilityCriteria;
  created_by: string;
  creator?: OfficialUser;
  created_at: string;
  updated_at: string;

  positions: PositionItem[];
  official_assignments: OfficialAssignment[];
  approvals: ElectionApprovalItem[];
  audit_logs: ElectionAuditLogItem[];
  estimated_voters: number;
}

export interface ElectionPayload {
  name: string;
  description?: string | null;
  department: string;
  election_type: string;
  start_at?: string | null;
  end_at?: string | null;
  result_visibility?: ResultVisibility;
  eligibility_criteria?: EligibilityCriteria;
  positions?: PositionItem[];
  official_user_ids?: string[];
}

export async function listElections(): Promise<ElectionListItem[]> {
  return authRequest<ElectionListItem[]>("/api/elections");
}

export async function getElection(id: string): Promise<ElectionDetail> {
  return authRequest<ElectionDetail>(`/api/elections/${id}`);
}

export async function getEligibleOfficials(): Promise<OfficialUser[]> {
  return authRequest<OfficialUser[]>("/api/elections/officials");
}

export async function estimateEligibility(
  criteria: EligibilityCriteria
): Promise<{ estimated_voters: number; criteria_summary: Record<string, any> }> {
  return authRequest<{ estimated_voters: number; criteria_summary: Record<string, any> }>(
    "/api/elections/eligibility-estimate",
    {
      method: "POST",
      body: JSON.stringify({ eligibility_criteria: criteria }),
    }
  );
}

export async function createElection(payload: ElectionPayload): Promise<ElectionDetail> {
  return authRequest<ElectionDetail>("/api/elections", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateElection(
  id: string,
  payload: Partial<ElectionPayload>
): Promise<ElectionDetail> {
  return authRequest<ElectionDetail>(`/api/elections/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function submitElectionForApproval(id: string): Promise<ElectionDetail> {
  return authRequest<ElectionDetail>(`/api/elections/${id}/submit`, {
    method: "POST",
  });
}

export async function approveElection(
  id: string,
  comment?: string
): Promise<ElectionDetail> {
  return authRequest<ElectionDetail>(`/api/elections/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

export async function rejectElection(
  id: string,
  reason: string
): Promise<ElectionDetail> {
  return authRequest<ElectionDetail>(`/api/elections/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function finalApproveElection(id: string): Promise<ElectionDetail> {
  return authRequest<ElectionDetail>(`/api/elections/${id}/final-approve`, {
    method: "POST",
  });
}
