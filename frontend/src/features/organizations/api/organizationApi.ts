import { apiRequest } from "../../../lib/api-client";
import type {
  OrganizationDirectCreate,
  OrganizationManagementAssignment,
  OrganizationManagementUpdate,
  OrganizationList,
  OrganizationReject,
  OrganizationRequestCreate,
  OrganizationRequestList,
  OrganizationRequestResponse,
  OrganizationResponse,
  OrganizationStatusResponse,
  PlatformUserList,
  PlatformOverview,
  RoleAssignment,
  AuditLogList,
  PlatformSetting,
  PlatformSettingList,
  PlatformSettingUpdate,
  MembershipRequestCreate,
  MembershipRequestReject,
  MembershipRequestList,
  MembershipRequestResponse,
  MembershipStatusResponse,
  MembershipList,
  MembershipRequestStatus,
  MembershipJoinResponse,
  MembershipVerification,
  MembershipVerificationList,
  OrganizationInvitation,
  OrganizationInvitationList,
  OrganizationMembershipPolicy,
  OrganizationProfileUpdate,
} from "../types/organization";

// Public / Authenticated User Routes (/api/v1/organizations)

export function getDiscoverOrganizations(params?: {
  offset?: number;
  limit?: number;
}): Promise<OrganizationList> {
  const query = new URLSearchParams();
  if (params?.offset !== undefined) query.set("offset", String(params.offset));
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  const qs = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<OrganizationList>(`/api/v1/organizations${qs}`);
}

export function getMyOrganizations(params?: {
  offset?: number;
  limit?: number;
}): Promise<OrganizationList> {
  const query = new URLSearchParams();
  if (params?.offset !== undefined) query.set("offset", String(params.offset));
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  const qs = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<OrganizationList>(`/api/v1/organizations/mine${qs}`);
}

export function submitOrganizationRequest(
  data: OrganizationRequestCreate,
): Promise<OrganizationRequestResponse> {
  return apiRequest<OrganizationRequestResponse>("/api/v1/organizations/requests", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getMyOrganizationRequests(params?: {
  offset?: number;
  limit?: number;
}): Promise<OrganizationRequestList> {
  const query = new URLSearchParams();
  if (params?.offset !== undefined) query.set("offset", String(params.offset));
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  const qs = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<OrganizationRequestList>(`/api/v1/organizations/requests/me${qs}`);
}

export function getOrganizationDetails(
  organizationId: string,
): Promise<OrganizationResponse> {
  return apiRequest<OrganizationResponse>(`/api/v1/organizations/${organizationId}`);
}

export function updateOrganizationProfile(organizationId: string, data: OrganizationProfileUpdate): Promise<OrganizationResponse> {
  return apiRequest<OrganizationResponse>(`/api/v1/organizations/${organizationId}/profile`, { method: "PUT", body: JSON.stringify(data) });
}

export function getMembershipStatus(
  organizationId: string,
): Promise<MembershipStatusResponse> {
  return apiRequest<MembershipStatusResponse>(
    `/api/v1/organizations/${organizationId}/membership/status`,
  );
}

export function requestOrganizationMembership(
  organizationId: string,
  data: MembershipRequestCreate,
): Promise<MembershipRequestResponse> {
  return apiRequest<MembershipRequestResponse>(
    `/api/v1/organizations/${organizationId}/membership-requests`,
    { method: "POST", body: JSON.stringify(data) },
  );
}

export function joinOrganization(
  organizationId: string,
  verificationNote?: string,
): Promise<MembershipJoinResponse> {
  return apiRequest<MembershipJoinResponse>(
    `/api/v1/organizations/${organizationId}/membership/join`,
    {
      method: "POST",
      body: JSON.stringify({ note: verificationNote }),
    },
  );
}

export function acceptOrganizationInvitation(
  organizationId: string,
  token: string,
  verificationNote?: string,
): Promise<MembershipJoinResponse> {
  return apiRequest<MembershipJoinResponse>(
    `/api/v1/organizations/${organizationId}/invitations/accept`,
    {
      method: "POST",
      body: JSON.stringify({ token, verification_note: verificationNote }),
    },
  );
}

export function updateOrganizationMembershipPolicy(
  organizationId: string,
  policy: OrganizationMembershipPolicy,
): Promise<OrganizationMembershipPolicy> {
  return apiRequest<OrganizationMembershipPolicy>(
    `/api/v1/organizations/${organizationId}/membership-policy`,
    { method: "PUT", body: JSON.stringify(policy) },
  );
}

export function getMyMemberships(): Promise<MembershipList> {
  return apiRequest<MembershipList>("/api/v1/organizations/membership/my");
}

export function getOrganizationMembershipRequests(
  organizationId: string,
  status?: MembershipRequestStatus,
): Promise<MembershipRequestList> {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  const qs = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<MembershipRequestList>(
    `/api/v1/admin/organizations/${organizationId}/membership-requests${qs}`,
  );
}

export function approveOrganizationMembershipRequest(
  organizationId: string,
  requestId: string,
): Promise<MembershipRequestResponse> {
  return apiRequest<MembershipRequestResponse>(
    `/api/v1/admin/organizations/${organizationId}/membership-requests/${requestId}/approve`,
    { method: "POST" },
  );
}

export function rejectOrganizationMembershipRequest(
  organizationId: string,
  requestId: string,
  data: MembershipRequestReject,
): Promise<MembershipRequestResponse> {
  return apiRequest<MembershipRequestResponse>(
    `/api/v1/admin/organizations/${organizationId}/membership-requests/${requestId}/reject`,
    { method: "POST", body: JSON.stringify(data) },
  );
}

export function createOrganizationInvitation(
  organizationId: string,
  email: string,
): Promise<OrganizationInvitation> {
  return apiRequest<OrganizationInvitation>(
    `/api/v1/admin/organizations/${organizationId}/invitations`,
    { method: "POST", body: JSON.stringify({ email }) },
  );
}

export function getOrganizationInvitations(
  organizationId: string,
): Promise<OrganizationInvitationList> {
  return apiRequest<OrganizationInvitationList>(
    `/api/v1/admin/organizations/${organizationId}/invitations`,
  );
}

export function revokeOrganizationInvitation(
  organizationId: string,
  invitationId: string,
): Promise<OrganizationInvitation> {
  return apiRequest<OrganizationInvitation>(
    `/api/v1/admin/organizations/${organizationId}/invitations/${invitationId}/revoke`,
    { method: "POST" },
  );
}

export function getOrganizationMembershipVerifications(
  organizationId: string,
): Promise<MembershipVerificationList> {
  return apiRequest<MembershipVerificationList>(
    `/api/v1/admin/organizations/${organizationId}/membership-verifications`,
  );
}

export function approveOrganizationMembershipVerification(
  organizationId: string,
  verificationId: string,
): Promise<MembershipVerification> {
  return apiRequest<MembershipVerification>(
    `/api/v1/admin/organizations/${organizationId}/membership-verifications/${verificationId}/approve`,
    { method: "POST" },
  );
}

export function rejectOrganizationMembershipVerification(
  organizationId: string,
  verificationId: string,
  reason: string,
): Promise<MembershipVerification> {
  return apiRequest<MembershipVerification>(
    `/api/v1/admin/organizations/${organizationId}/membership-verifications/${verificationId}/reject`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
}

// Platform Super Admin Routes (/api/v1/admin)

export function getAdminUsers(params?: {
  search?: string;
  offset?: number;
  limit?: number;
}): Promise<PlatformUserList> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.offset !== undefined) query.set("offset", String(params.offset));
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  const qs = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<PlatformUserList>(`/api/v1/admin/users${qs}`);
}

export function getPlatformOverview(): Promise<PlatformOverview> {
  return apiRequest<PlatformOverview>("/api/v1/admin/overview");
}

export function getPlatformAudit(params?: {
  action?: string;
  offset?: number;
  limit?: number;
}): Promise<AuditLogList> {
  const query = new URLSearchParams();
  if (params?.action) query.set("action", params.action);
  if (params?.offset !== undefined) query.set("offset", String(params.offset));
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  const qs = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<AuditLogList>(`/api/v1/admin/audit${qs}`);
}

export function getPlatformUserRoles(userId: string): Promise<RoleAssignment[]> {
  return apiRequest<RoleAssignment[]>(`/api/v1/admin/users/${userId}/roles`);
}

export function assignOrganizationAdminRole(
  organizationId: string,
  userId: string,
): Promise<RoleAssignment> {
  return apiRequest<RoleAssignment>(`/api/v1/admin/organizations/${organizationId}/roles`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, role: "ORGANISATION_ADMIN" }),
  });
}

export function assignPlatformSuperAdminRole(userId: string): Promise<RoleAssignment> {
  return apiRequest<RoleAssignment>(`/api/v1/admin/users/${userId}/platform-role`, {
    method: "POST",
  });
}

export function revokeRoleAssignment(assignmentId: string): Promise<void> {
  return apiRequest<void>(`/api/v1/admin/role-assignment/${assignmentId}`, {
    method: "DELETE",
  });
}

export function getPlatformSettings(): Promise<PlatformSettingList> {
  return apiRequest<PlatformSettingList>("/api/v1/admin/settings");
}

export function updatePlatformSetting(
  key: string,
  data: PlatformSettingUpdate,
): Promise<PlatformSetting> {
  return apiRequest<PlatformSetting>(`/api/v1/admin/settings/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function getAdminOrganizations(params?: {
  status?: string;
  offset?: number;
  limit?: number;
}): Promise<OrganizationList> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.offset !== undefined) query.set("offset", String(params.offset));
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  const qs = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<OrganizationList>(`/api/v1/admin/organizations${qs}`);
}

export function getAdminOrganizationRequests(params?: {
  status?: string;
  offset?: number;
  limit?: number;
}): Promise<OrganizationRequestList> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.offset !== undefined) query.set("offset", String(params.offset));
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  const qs = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<OrganizationRequestList>(`/api/v1/admin/organization-requests${qs}`);
}

export function getAdminOrganizationRequestDetails(
  requestId: string,
): Promise<OrganizationRequestResponse> {
  return apiRequest<OrganizationRequestResponse>(
    `/api/v1/admin/organization-requests/${requestId}`,
  );
}

export function approveOrganizationRequest(
  requestId: string,
): Promise<OrganizationResponse> {
  return apiRequest<OrganizationResponse>(
    `/api/v1/admin/organization-requests/${requestId}/approve`,
    { method: "POST" },
  );
}

export function rejectOrganizationRequest(
  requestId: string,
  data: OrganizationReject,
): Promise<OrganizationRequestResponse> {
  return apiRequest<OrganizationRequestResponse>(
    `/api/v1/admin/organization-requests/${requestId}/reject`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export function createOrganizationDirectly(
  data: OrganizationDirectCreate,
): Promise<OrganizationResponse> {
  return apiRequest<OrganizationResponse>("/api/v1/admin/organizations", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateOrganizationManagement(
  organizationId: string,
  data: OrganizationManagementUpdate,
): Promise<OrganizationManagementAssignment> {
  return apiRequest<OrganizationManagementAssignment>(
    `/api/v1/admin/organizations/${organizationId}/management`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
  );
}

export function suspendOrganization(
  organizationId: string,
): Promise<OrganizationStatusResponse> {
  return apiRequest<OrganizationStatusResponse>(
    `/api/v1/admin/organizations/${organizationId}/suspend`,
    { method: "POST" },
  );
}

export function restoreOrganization(
  organizationId: string,
): Promise<OrganizationStatusResponse> {
  return apiRequest<OrganizationStatusResponse>(
    `/api/v1/admin/organizations/${organizationId}/restore`,
    { method: "POST" },
  );
}
