export type OrganizationType =
  | "UNIVERSITY"
  | "DEPARTMENT"
  | "COMPANY"
  | "ASSOCIATION"
  | "CLUB"
  | "OTHER";

export type OrganizationStatus =
  | "PENDING_APPROVAL"
  | "ACTIVE"
  | "REJECTED"
  | "SUSPENDED"
  | "ARCHIVED";

export type OrganizationRequestStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED";

export type OrganizationManagementRole =
  | "ORGANISATION_OWNER"
  | "ORGANISATION_ADMIN";

export type OrganizationManagementMode =
  | "RETAIN_PLATFORM_MANAGEMENT"
  | "ASSIGN_OWNER";

export interface OrganizationResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  organization_type: OrganizationType;
  logo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  country: string;
  status: OrganizationStatus;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  current_owner_id?: string | null;
  current_owner_name?: string | null;
  management_arrangement?: "RETAIN_PLATFORM_MANAGEMENT" | "HAND_OVER" | "AWAITING_OWNER";
}

export interface OrganizationList {
  items: OrganizationResponse[];
}

export interface OrganizationRequestResponse {
  id: string;
  name: string;
  organization_type: OrganizationType;
  description: string | null;
  logo_url: string | null;
  contact_email: string | null;
  website: string | null;
  country: string;
  supporting_information: string | null;
  status: OrganizationRequestStatus;
  rejection_reason: string | null;
  requested_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
  requested_by_name?: string | null;
  reviewed_by_name?: string | null;
}

export interface OrganizationRequestList {
  items: OrganizationRequestResponse[];
}

export interface OrganizationRequestCreate {
  name: string;
  organization_type: OrganizationType;
  description?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website?: string | null;
  logo_url?: string | null;
  country: string;
  supporting_information?: string | null;
}

export interface OrganizationReject {
  reason: string;
}

export interface OrganizationDirectCreate {
  name: string;
  organization_type: OrganizationType;
  description?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website?: string | null;
  logo_url?: string | null;
  country: string;
  slug?: string | null;
  management_mode: OrganizationManagementMode;
  manager_user_id?: string | null;
}

export interface OrganizationManagementUpdate {
  management_mode: OrganizationManagementMode;
  manager_user_id?: string | null;
}

export interface OrganizationStatusResponse {
  id: string;
  status: OrganizationStatus;
}

export interface PlatformUserSummary {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  is_platform_super_admin: boolean;
  created_at: string;
}

export interface PlatformUserList {
  items: PlatformUserSummary[];
}

export type MembershipRequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type MembershipStatus = "ACTIVE" | "SUSPENDED" | "REMOVED";

export interface MembershipRequestCreate {
  message?: string | null;
}

export interface MembershipRequestReject {
  reason: string;
}

export interface MembershipRequestResponse {
  id: string;
  organization_id: string;
  user_id: string;
  status: MembershipRequestStatus;
  message: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  applicant_name: string | null;
  applicant_email: string | null;
}

export interface MembershipRequestList {
  items: MembershipRequestResponse[];
}

export interface MembershipStatusResponse {
  organization_id: string;
  membership_status: MembershipStatus | null;
  membership_request_status: MembershipRequestStatus | null;
  can_manage: boolean;
}

export interface MembershipResponse {
  id: string;
  organization_id: string;
  user_id: string;
  status: MembershipStatus;
  joined_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  role: string;
  organization_name: string | null;
  organization_type: OrganizationType | null;
}

export interface MembershipList {
  items: MembershipResponse[];
}
