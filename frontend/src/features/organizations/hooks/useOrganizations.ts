import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveOrganizationRequest,
  createOrganizationDirectly,
  getAdminOrganizationRequestDetails,
  getAdminOrganizationRequests,
  getAdminOrganizations,
  getAdminUsers,
  getPlatformOverview,
  getPlatformAudit,
  getPlatformUserRoles,
  assignOrganizationAdminRole,
  assignPlatformSuperAdminRole,
  revokeRoleAssignment,
  getPlatformSettings,
  updatePlatformSetting,
  updateOrganizationManagement,
  getMembershipStatus,
  requestOrganizationMembership,
  getMyMemberships,
  getOrganizationMembershipRequests,
  approveOrganizationMembershipRequest,
  rejectOrganizationMembershipRequest,
  acceptOrganizationInvitation,
  approveOrganizationMembershipVerification,
  createOrganizationInvitation,
  getOrganizationInvitations,
  getOrganizationMembershipVerifications,
  joinOrganization,
  rejectOrganizationMembershipVerification,
  revokeOrganizationInvitation,
  updateOrganizationMembershipPolicy,
  getDiscoverOrganizations,
  getMyOrganizations,
  getMyOrganizationRequests,
  getOrganizationDetails,
  rejectOrganizationRequest,
  restoreOrganization,
  submitOrganizationRequest,
  suspendOrganization,
} from "../api/organizationApi";
import type {
  OrganizationDirectCreate,
  OrganizationReject,
  OrganizationRequestCreate,
  OrganizationManagementUpdate,
  PlatformSettingUpdate,
  OrganizationMembershipPolicy,
} from "../types/organization";

export const organizationQueryKeys = {
  all: ["organizations"] as const,
  discover: () => [...organizationQueryKeys.all, "discover"] as const,
  mine: () => [...organizationQueryKeys.all, "mine"] as const,
  membershipStatus: (organizationId: string) =>
    [...organizationQueryKeys.all, "membership-status", organizationId] as const,
  myMemberships: () => [...organizationQueryKeys.all, "my-memberships"] as const,
  membershipRequests: (organizationId: string, status?: string) =>
    [...organizationQueryKeys.all, "membership-requests", organizationId, status ?? "all"] as const,
  membershipVerifications: (organizationId: string) =>
    [...organizationQueryKeys.all, "membership-verifications", organizationId] as const,
  invitations: (organizationId: string) =>
    [...organizationQueryKeys.all, "invitations", organizationId] as const,
  myRequests: () => [...organizationQueryKeys.all, "my-requests"] as const,
  details: (id: string) => [...organizationQueryKeys.all, "details", id] as const,
  adminOrganizations: (status?: string) =>
    status
      ? [...organizationQueryKeys.all, "admin", "list", status] as const
      : [...organizationQueryKeys.all, "admin", "list"] as const,
  adminUsers: (search?: string) =>
    search
      ? [...organizationQueryKeys.all, "admin", "users", search] as const
      : [...organizationQueryKeys.all, "admin", "users"] as const,
  adminRequests: (status?: string) =>
    status
      ? [...organizationQueryKeys.all, "admin", "requests", status] as const
      : [...organizationQueryKeys.all, "admin", "requests"] as const,
  adminRequestDetails: (id: string) =>
    [...organizationQueryKeys.all, "admin", "request-details", id] as const,
  platformOverview: () => [...organizationQueryKeys.all, "admin", "overview"] as const,
  platformUserRoles: (userId: string) =>
    [...organizationQueryKeys.all, "admin", "user-roles", userId] as const,
  platformAudit: (action?: string) =>
    action
      ? [...organizationQueryKeys.all, "admin", "audit", action] as const
      : [...organizationQueryKeys.all, "admin", "audit"] as const,
  platformSettings: () => [...organizationQueryKeys.all, "admin", "settings"] as const,
};

// User Hooks
export function useDiscoverOrganizations() {
  return useQuery({
    queryKey: organizationQueryKeys.discover(),
    queryFn: () => getDiscoverOrganizations(),
    staleTime: 30_000,
    retry: false,
  });
}

export function useMyOrganizations() {
  return useQuery({
    queryKey: organizationQueryKeys.mine(),
    queryFn: () => getMyOrganizations(),
    staleTime: 30_000,
    retry: false,
  });
}

export function useMembershipStatus(organizationId: string) {
  return useQuery({
    queryKey: organizationQueryKeys.membershipStatus(organizationId),
    queryFn: () => getMembershipStatus(organizationId),
    enabled: Boolean(organizationId),
    staleTime: 15_000,
    retry: false,
  });
}

export function useRequestOrganizationMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      message,
      verificationNote,
    }: {
      organizationId: string;
      message?: string;
      verificationNote?: string;
    }) => requestOrganizationMembership(organizationId, {
      message,
      verification_note: verificationNote,
    }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.membershipStatus(variables.organizationId),
      });
    },
  });
}

export function useJoinOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      verificationNote,
    }: {
      organizationId: string;
      verificationNote?: string;
    }) => joinOrganization(organizationId, verificationNote),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.membershipStatus(variables.organizationId),
      });
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.myMemberships() });
    },
  });
}

export function useAcceptOrganizationInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      token,
      verificationNote,
    }: {
      organizationId: string;
      token: string;
      verificationNote?: string;
    }) => acceptOrganizationInvitation(organizationId, token, verificationNote),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.membershipStatus(variables.organizationId),
      });
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.myMemberships() });
    },
  });
}

export function useUpdateOrganizationMembershipPolicy(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (policy: OrganizationMembershipPolicy) =>
      updateOrganizationMembershipPolicy(organizationId, policy),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.details(organizationId),
      });
      void queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.discover(),
      });
    },
  });
}

export function useUpdateOrganizationProfile(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: import("../types/organization").OrganizationProfileUpdate) =>
      import("../api/organizationApi").then(({ updateOrganizationProfile }) => updateOrganizationProfile(organizationId, data)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.details(organizationId) });
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.discover() });
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.mine() });
    },
  });
}

export function useMyMemberships() {
  return useQuery({
    queryKey: organizationQueryKeys.myMemberships(),
    queryFn: getMyMemberships,
    staleTime: 30_000,
  });
}

export function useOrganizationMembershipRequests(
  organizationId: string,
  status?: "PENDING" | "APPROVED" | "REJECTED",
  enabled = true,
) {
  return useQuery({
    queryKey: organizationQueryKeys.membershipRequests(organizationId, status),
    queryFn: () => getOrganizationMembershipRequests(organizationId, status),
    enabled: Boolean(organizationId) && enabled,
    staleTime: 15_000,
    retry: false,
  });
}

export function useOrganizationMembershipVerifications(
  organizationId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: organizationQueryKeys.membershipVerifications(organizationId),
    queryFn: () => getOrganizationMembershipVerifications(organizationId),
    enabled: Boolean(organizationId) && enabled,
    staleTime: 15_000,
    retry: false,
  });
}

export function useApproveOrganizationMembershipVerification(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (verificationId: string) =>
      approveOrganizationMembershipVerification(organizationId, verificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.membershipVerifications(organizationId),
      });
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.all });
    },
  });
}

export function useRejectOrganizationMembershipVerification(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      verificationId,
      reason,
    }: {
      verificationId: string;
      reason: string;
    }) => rejectOrganizationMembershipVerification(organizationId, verificationId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.membershipVerifications(organizationId),
      });
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.all });
    },
  });
}

export function useOrganizationInvitations(organizationId: string, enabled = true) {
  return useQuery({
    queryKey: organizationQueryKeys.invitations(organizationId),
    queryFn: () => getOrganizationInvitations(organizationId),
    enabled: Boolean(organizationId) && enabled,
    staleTime: 15_000,
    retry: false,
  });
}

export function useCreateOrganizationInvitation(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => createOrganizationInvitation(organizationId, email),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.invitations(organizationId),
      });
    },
  });
}

export function useRevokeOrganizationInvitation(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      revokeOrganizationInvitation(organizationId, invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.invitations(organizationId),
      });
    },
  });
}

export function useApproveOrganizationMembershipRequest(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) =>
      approveOrganizationMembershipRequest(organizationId, requestId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.all });
    },
  });
}

export function useRejectOrganizationMembershipRequest(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason: string }) =>
      rejectOrganizationMembershipRequest(organizationId, requestId, { reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.all });
    },
  });
}

export function useMyOrganizationRequests() {
  return useQuery({
    queryKey: organizationQueryKeys.myRequests(),
    queryFn: () => getMyOrganizationRequests(),
    staleTime: 30_000,
  });
}

export function useOrganizationDetails(organizationId: string) {
  return useQuery({
    queryKey: organizationQueryKeys.details(organizationId),
    queryFn: () => getOrganizationDetails(organizationId),
    enabled: Boolean(organizationId),
    staleTime: 30_000,
  });
}

export function useSubmitOrganizationRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: OrganizationRequestCreate) => submitOrganizationRequest(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.myRequests() });
    },
  });
}

// Super Admin Hooks
export function useAdminUsers(search?: string) {
  return useQuery({
    queryKey: organizationQueryKeys.adminUsers(search),
    queryFn: () => getAdminUsers({ search, limit: 50 }),
    enabled: Boolean(search?.trim()),
    staleTime: 30_000,
    retry: false,
  });
}

export function usePlatformOverview() {
  return useQuery({
    queryKey: organizationQueryKeys.platformOverview(),
    queryFn: getPlatformOverview,
    staleTime: 30_000,
    retry: false,
  });
}

export function usePlatformUserRoles(userId: string) {
  return useQuery({
    queryKey: organizationQueryKeys.platformUserRoles(userId),
    queryFn: () => getPlatformUserRoles(userId),
    enabled: Boolean(userId),
    staleTime: 15_000,
    retry: false,
  });
}

export function usePlatformAudit(action?: string) {
  return useQuery({
    queryKey: organizationQueryKeys.platformAudit(action),
    queryFn: () => getPlatformAudit({ action, limit: 50 }),
    staleTime: 15_000,
    retry: false,
  });
}

export function usePlatformSettings() {
  return useQuery({
    queryKey: organizationQueryKeys.platformSettings(),
    queryFn: getPlatformSettings,
    staleTime: 30_000,
    retry: false,
  });
}

export function useAssignOrganizationAdminRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, userId }: { organizationId: string; userId: string }) =>
      assignOrganizationAdminRole(organizationId, userId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.platformUserRoles(variables.userId),
      });
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.platformAudit() });
    },
  });
}

export function useAssignPlatformSuperAdminRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: assignPlatformSuperAdminRole,
    onSuccess: (_data, userId) => {
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.adminUsers() });
      void queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.platformUserRoles(userId),
      });
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.platformAudit() });
    },
  });
}

export function useRevokeRoleAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      assignmentId,
    }: {
      assignmentId: string;
      userId: string;
    }) => revokeRoleAssignment(assignmentId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.platformUserRoles(variables.userId),
      });
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.adminUsers() });
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.platformAudit() });
    },
  });
}

export function useUpdatePlatformSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, data }: { key: string; data: PlatformSettingUpdate }) =>
      updatePlatformSetting(key, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.platformSettings(),
      });
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.platformAudit() });
    },
  });
}

export function useAdminOrganizations(status?: string) {
  return useQuery({
    queryKey: organizationQueryKeys.adminOrganizations(status),
    queryFn: () => getAdminOrganizations({ status }),
    staleTime: 30_000,
    retry: false,
  });
}

export function useAdminOrganizationRequests(status?: string) {
  return useQuery({
    queryKey: organizationQueryKeys.adminRequests(status),
    queryFn: () => getAdminOrganizationRequests({ status }),
    staleTime: 30_000,
    retry: false,
  });
}

export function useAdminOrganizationRequestDetails(requestId: string) {
  return useQuery({
    queryKey: organizationQueryKeys.adminRequestDetails(requestId),
    queryFn: () => getAdminOrganizationRequestDetails(requestId),
    enabled: Boolean(requestId),
    staleTime: 30_000,
    retry: false,
  });
}

export function useApproveOrganizationRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => approveOrganizationRequest(requestId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.all });
    },
  });
}

export function useRejectOrganizationRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, data }: { requestId: string; data: OrganizationReject }) =>
      rejectOrganizationRequest(requestId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.all });
    },
  });
}

export function useCreateOrganizationDirectly() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: OrganizationDirectCreate) => createOrganizationDirectly(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.adminOrganizations() });
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.platformOverview() });
    },
  });
}

export function useUpdateOrganizationManagement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      data,
    }: {
      organizationId: string;
      data: OrganizationManagementUpdate;
    }) => updateOrganizationManagement(organizationId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.details(variables.organizationId),
      });
      void queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.adminOrganizations(),
      });
      void queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.platformAudit(),
      });
    },
  });
}

export function useSuspendOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (organizationId: string) => suspendOrganization(organizationId),
    onSuccess: (_data, organizationId) => {
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.details(organizationId) });
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.adminOrganizations() });
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.platformOverview() });
    },
  });
}

export function useRestoreOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (organizationId: string) => restoreOrganization(organizationId),
    onSuccess: (_data, organizationId) => {
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.details(organizationId) });
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.adminOrganizations() });
      void queryClient.invalidateQueries({ queryKey: organizationQueryKeys.platformOverview() });
    },
  });
}
