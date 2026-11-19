import { apiRequest } from "../../../lib/api-client";
import type {
  OrganizationDirectCreate,
  OrganizationList,
  OrganizationReject,
  OrganizationRequestCreate,
  OrganizationRequestList,
  OrganizationRequestResponse,
  OrganizationResponse,
  OrganizationStatusResponse,
  PlatformUserList,
  MembershipRequestCreate,
  MembershipRequestReject,
  MembershipRequestList,
  MembershipRequestResponse,
  MembershipStatusResponse,
  MembershipList,
  MembershipRequestStatus,
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
