import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveOrganizationRequest,
  createOrganizationDirectly,
  getAdminOrganizationRequestDetails,
  getAdminOrganizationRequests,
  getAdminOrganizations,
  getAdminUsers,
  getMembershipStatus,
  requestOrganizationMembership,
  getMyMemberships,
  getOrganizationMembershipRequests,
  approveOrganizationMembershipRequest,
  rejectOrganizationMembershipRequest,
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
  myRequests: () => [...organizationQueryKeys.all, "my-requests"] as const,
  details: (id: string) => [...organizationQueryKeys.all, "details", id] as const,
  adminOrganizations: (status?: string) =>
    [...organizationQueryKeys.all, "admin", "list", status ?? "all"] as const,
  adminUsers: (search?: string) =>
    [...organizationQueryKeys.all, "admin", "users", search ?? "all"] as const,
  adminRequests: (status?: string) =>
    [...organizationQueryKeys.all, "admin", "requests", status ?? "all"] as const,
  adminRequestDetails: (id: string) =>
    [...organizationQueryKeys.all, "admin", "request-details", id] as const,
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
    mutationFn: ({ organizationId, message }: { organizationId: string; message?: string }) =>
      requestOrganizationMembership(organizationId, { message }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.membershipStatus(variables.organizationId),
      });
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
) {
  return useQuery({
    queryKey: organizationQueryKeys.membershipRequests(organizationId, status),
    queryFn: () => getOrganizationMembershipRequests(organizationId, status),
    enabled: Boolean(organizationId),
    staleTime: 15_000,
    retry: false,
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
    queryFn: () => getAdminUsers({ search, limit: 20 }),
    enabled: Boolean(search?.trim()),
    staleTime: 30_000,
    retry: false,
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
    },
  });
}
