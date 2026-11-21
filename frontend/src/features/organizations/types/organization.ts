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

export type MembershipVerificationMode =
  | "NONE"
  | "INSTITUTIONAL_EMAIL"
  | "ADMIN_REVIEW";
export type MembershipVerificationStatus =
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "CANCELLED";
export type OrganizationInvitationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "EXPIRED"
  | "REVOKED";
export type NotificationDeliveryStatus =
  | "SENT"
  | "NOT_CONFIGURED"
  | "FAILED"
  | "NO_RECIPIENT";

export interface OrganizationMembershipPolicy {
  membership_requires_approval: boolean;
  membership_requires_invitation: boolean;
  verification_mode: MembershipVerificationMode;
  verified_email_domains: string[];
  verification_instructions: string | null;
}

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
  is_public_profile: boolean;
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
  membership_policy: OrganizationMembershipPolicy;
}

export interface OrganizationProfileUpdate {
  name: string;
  description: string | null;
  organization_type: OrganizationType;
  logo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  country: string;
  is_public_profile: boolean;
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

export interface OrganizationManagementAssignment {
  organization_id: string;
  user_id: string;
  role: OrganizationManagementRole;
  management_mode: OrganizationManagementMode;
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

export interface PlatformOverview {
  total_users: number;
  total_organizations: number;
  active_organizations: number;
  pending_requests: number;
  suspended_organizations: number;
}

export interface RoleAssignment {
  id: string;
  user_id: string;
  role: string;
  status: "ACTIVE" | "REVOKED";
  assigned_by: string | null;
  assigned_at: string;
  revoked_at: string | null;
  organization_id?: string | null;
}

export interface AuditLogEntry {
  id: string;
  actor_user_id: string | null;
  action: string;
  organization_id: string | null;
  request_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface AuditLogList {
  items: AuditLogEntry[];
}

export interface PlatformSetting {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

export interface PlatformSettingList {
  items: PlatformSetting[];
}

export interface PlatformSettingUpdate {
  value: string;
  description?: string | null;
}

export type MembershipRequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type MembershipStatus = "ACTIVE" | "SUSPENDED" | "REMOVED";

export interface MembershipRequestCreate {
  message?: string | null;
  verification_note?: string | null;
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
  notification_delivery?: NotificationDeliveryStatus | null;
}

export interface MembershipRequestList {
  items: MembershipRequestResponse[];
}

export interface MembershipStatusResponse {
  organization_id: string;
  membership_status: MembershipStatus | null;
  membership_request_status: MembershipRequestStatus | null;
  membership_verification_status: MembershipVerificationStatus | null;
  can_manage: boolean;
}

export interface MembershipJoinResponse {
  status: string;
  membership_id: string | null;
  membership_request_id: string | null;
  verification_id: string | null;
  notification_delivery: NotificationDeliveryStatus | null;
}

export interface MembershipVerification {
  id: string;
  organization_id: string;
  user_id: string;
  membership_request_id: string | null;
  invitation_id: string | null;
  verification_mode: MembershipVerificationMode;
  status: MembershipVerificationStatus;
  membership_requires_approval: boolean;
  submission_note: string | null;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  applicant_name: string | null;
  applicant_email: string | null;
  notification_delivery?: NotificationDeliveryStatus | null;
}

export interface MembershipVerificationList {
  items: MembershipVerification[];
}

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  status: OrganizationInvitationStatus;
  expires_at: string;
  invited_by: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  invitation_url?: string | null;
  notification_delivery?: NotificationDeliveryStatus | null;
}

export interface OrganizationInvitationList {
  items: OrganizationInvitation[];
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
