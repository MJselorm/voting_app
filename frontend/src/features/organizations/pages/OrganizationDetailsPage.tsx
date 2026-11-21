import { useEffect, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import {
  Globe,
  Mail,
  MapPin,
  Calendar,
  Shield,
  ArrowLeft,
  PauseCircle,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import {
  useOrganizationDetails,
  useSuspendOrganization,
  useRestoreOrganization,
  useMembershipStatus,
  useRequestOrganizationMembership,
  useOrganizationMembershipRequests,
  useApproveOrganizationMembershipRequest,
  useRejectOrganizationMembershipRequest,
  useAdminUsers,
  useUpdateOrganizationManagement,
  useAcceptOrganizationInvitation,
  useApproveOrganizationMembershipVerification,
  useCreateOrganizationInvitation,
  useJoinOrganization,
  useOrganizationInvitations,
  useOrganizationMembershipVerifications,
  useRejectOrganizationMembershipVerification,
  useRevokeOrganizationInvitation,
  useUpdateOrganizationMembershipPolicy,
} from "../hooks/useOrganizations";
import type {
  MembershipVerificationMode,
  OrganizationMembershipPolicy,
  OrganizationManagementMode,
  PlatformUserSummary,
} from "../types/organization";
import { useUserProfile } from "../../auth/hooks/useUserProfile";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { LoadingState } from "../../../components/shared/LoadingState";
import { Notice } from "../../../components/shared/Notice";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../../components/ui/dialog";

export function OrganizationDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: profile } = useUserProfile();
  const { data: org, isLoading, error, refetch } = useOrganizationDetails(id || "");
  const {
    data: membershipStatus,
    isLoading: membershipLoading,
    refetch: refetchMembership,
  } = useMembershipStatus(id || "");
  const { mutateAsync: requestMembership, isPending: isRequesting } =
    useRequestOrganizationMembership();
  const { mutateAsync: joinOrganization, isPending: isJoining } = useJoinOrganization();
  const { mutateAsync: acceptInvitation, isPending: isAcceptingInvitation } =
    useAcceptOrganizationInvitation();
  const [searchParams, setSearchParams] = useSearchParams();
  const invitationToken = searchParams.get("invitation_token") ?? "";
  const [membershipMessage, setMembershipMessage] = useState("");
  const [verificationNote, setVerificationNote] = useState("");
  const [membershipError, setMembershipError] = useState("");
  const [membershipResult, setMembershipResult] = useState("");
  const [membershipNotification, setMembershipNotification] = useState("");
  const [membershipStatusFilter, setMembershipStatusFilter] =
    useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const canManageMemberships = Boolean(membershipStatus?.can_manage);
  const {
    data: membershipRequests,
    isLoading: membershipRequestsLoading,
    refetch: refetchMembershipRequests,
  } = useOrganizationMembershipRequests(
    id || "",
    membershipStatusFilter,
    canManageMemberships,
  );
  const {
    data: membershipVerifications,
    isLoading: verificationsLoading,
    refetch: refetchVerifications,
  } = useOrganizationMembershipVerifications(id || "", canManageMemberships);
  const {
    data: organizationInvitations,
    isLoading: invitationsLoading,
    refetch: refetchInvitations,
  } = useOrganizationInvitations(id || "", canManageMemberships);
  const { mutateAsync: approveMembershipRequest, isPending: isApprovingMembership } =
    useApproveOrganizationMembershipRequest(id || "");
  const { mutateAsync: rejectMembershipRequest, isPending: isRejectingMembership } =
    useRejectOrganizationMembershipRequest(id || "");
  const [membershipRejectReasons, setMembershipRejectReasons] = useState<Record<string, string>>({});
  const { mutateAsync: approveVerification, isPending: isApprovingVerification } =
    useApproveOrganizationMembershipVerification(id || "");
  const { mutateAsync: rejectVerification, isPending: isRejectingVerification } =
    useRejectOrganizationMembershipVerification(id || "");
  const { mutateAsync: createInvitation, isPending: isCreatingInvitation } =
    useCreateOrganizationInvitation(id || "");
  const { mutateAsync: revokeInvitation, isPending: isRevokingInvitation } =
    useRevokeOrganizationInvitation(id || "");
  const { mutateAsync: updateMembershipPolicy, isPending: isSavingPolicy } =
    useUpdateOrganizationMembershipPolicy(id || "");
  const [verificationRejectReasons, setVerificationRejectReasons] = useState<Record<string, string>>({});
  const [invitationEmail, setInvitationEmail] = useState("");
  const [latestInvitationUrl, setLatestInvitationUrl] = useState("");
  const [latestInvitationDelivery, setLatestInvitationDelivery] = useState("");
  const [adminActionError, setAdminActionError] = useState("");
  const [adminActionSuccess, setAdminActionSuccess] = useState("");

  const { mutateAsync: suspendOrg, isPending: isSuspending } = useSuspendOrganization();
  const { mutateAsync: restoreOrg, isPending: isRestoring } = useRestoreOrganization();

  const [confirmSuspendOpen, setConfirmSuspendOpen] = useState(false);
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isSuperAdmin = profile?.is_active && profile.is_platform_super_admin;
  const isCreatorOrManager = profile && org && profile.id === org.created_by;

  const handleSuspend = async () => {
    if (!org) return;
    setActionError(null);
    try {
      await suspendOrg(org.id);
      setConfirmSuspendOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to suspend organisation.");
    }
  };

  const handleRestore = async () => {
    if (!org) return;
    setActionError(null);
    try {
      await restoreOrg(org.id);
      setConfirmRestoreOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to restore organisation.");
    }
  };

  const handleRequestMembership = async () => {
    if (!org) return;
    setMembershipError("");
    try {
      const result = await requestMembership({
        organizationId: org.id,
        message: membershipMessage.trim() || undefined,
        verificationNote: verificationNote.trim() || undefined,
      });
      setMembershipResult("Your membership request was submitted.");
      setMembershipNotification(
        result.notification_delivery
          ? `Administrator email: ${result.notification_delivery}`
          : "",
      );
      await refetchMembership();
    } catch (cause) {
      setMembershipError(cause instanceof Error ? cause.message : "Membership request failed.");
    }
  };

  const handleJoinOrganization = async () => {
    if (!org) return;
    setMembershipError("");
    setMembershipResult("");
    try {
      const result = invitationToken
        ? await acceptInvitation({
            organizationId: org.id,
            token: invitationToken,
            verificationNote: verificationNote.trim() || undefined,
          })
        : await joinOrganization({
            organizationId: org.id,
            verificationNote: verificationNote.trim() || undefined,
          });
      setMembershipResult(
        result.status === "ACTIVE"
          ? "You are now a member of this organisation."
          : result.status === "PENDING_VERIFICATION"
            ? "Your verification was submitted for administrator review."
            : "Your invitation was accepted; membership is awaiting approval.",
      );
      setMembershipNotification(
        result.notification_delivery
          ? `Administrator email: ${result.notification_delivery}`
          : "",
      );
      if (invitationToken) {
        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.delete("invitation_token");
        setSearchParams(nextSearchParams, { replace: true });
      }
      await refetchMembership();
    } catch (cause) {
      setMembershipError(
        cause instanceof Error ? cause.message : "Could not join this organisation.",
      );
    }
  };

  if (isLoading) {
    return <LoadingState label="Loading organisation details…" />;
  }

  if (error || !org) {
    return (
      <div className="space-y-4">
        <Link
          to="/app/organizations"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Organisations
        </Link>
        <Notice variant="error">
          {error instanceof Error ? error.message : "Organisation not found or unauthorized access."}
          {" "}
          <button className="underline font-bold" onClick={() => void refetch()} type="button">
            Try again
          </button>
        </Notice>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade">
      <Link
        to="/app/organizations"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Organisations
      </Link>

      <PageHeader
        title={org.name}
        description={`Registered entity • slug: ${org.slug}`}
        breadcrumbs={[
          { label: "Organisations", href: "/app/organizations" },
          { label: org.name },
        ]}
        badge={
          <Badge
            variant={
              org.status === "ACTIVE"
                ? "success"
                : org.status === "SUSPENDED"
                ? "destructive"
                : "secondary"
            }
          >
            {org.status}
          </Badge>
        }
        actions={
          isSuperAdmin ? (
            <div className="flex items-center gap-2">
              {org.status === "ACTIVE" && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1.5 text-xs"
                  onClick={() => setConfirmSuspendOpen(true)}
                >
                  <PauseCircle className="h-3.5 w-3.5" />
                  <span>Suspend Organisation</span>
                </Button>
              )}
              {org.status === "SUSPENDED" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => setConfirmRestoreOpen(true)}
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  <span>Restore Organisation</span>
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      {actionError && (
        <Notice variant="error">
          {actionError}
        </Notice>
      )}

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Profile and Overview */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-start gap-4 space-y-0">
              {org.logo_url ? (
                <img
                  src={org.logo_url}
                  alt={org.name}
                  className="h-16 w-16 rounded-xl border border-border object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
                  {org.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <CardTitle className="text-xl">{org.name}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">{org.organization_type}</Badge>
                  <span>•</span>
                  <span>{org.country}</span>
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-1">
                  About the Organisation
                </h4>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {org.description || "No official description provided."}
                </p>
              </div>

              <div className="pt-4 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {org.contact_email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4 shrink-0 text-foreground" />
                    <span className="font-mono text-[11px]">{org.contact_email}</span>
                  </div>
                )}
                {org.website && (
                  <div className="flex items-center gap-2 text-muted-foreground truncate">
                    <Globe className="h-4 w-4 shrink-0 text-foreground" />
                    <a
                      href={org.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline truncate"
                    >
                      {org.website}
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0 text-foreground" />
                  <span>{org.country}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0 text-foreground" />
                  <span>Established {new Date(org.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Membership</CardTitle>
              <CardDescription>
                {org.membership_policy.membership_requires_invitation
                  ? "An invitation is required to join."
                  : org.membership_policy.membership_requires_approval
                    ? "Membership requests are reviewed by organisation administrators."
                    : "Eligible users can join this organisation directly."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {membershipLoading ? (
                <p className="text-xs text-muted-foreground">Checking membership status…</p>
              ) : membershipStatus?.membership_status === "ACTIVE" ? (
                <Notice variant="success">You are an active member of this organisation.</Notice>
              ) : membershipStatus?.membership_status === "SUSPENDED" ? (
                <Notice>Your membership in this organisation is suspended.</Notice>
              ) : membershipStatus?.membership_verification_status === "PENDING" ? (
                <Notice>Your institutional verification is awaiting administrator review.</Notice>
              ) : membershipStatus?.membership_request_status === "PENDING" ? (
                <Notice variant="success">Your request is pending review.</Notice>
              ) : (
                <>
                  {membershipError && <Notice variant="error">{membershipError}</Notice>}
                  {membershipResult && <Notice variant="success">{membershipResult}</Notice>}
                  {membershipNotification && (
                    <p className="text-xs text-muted-foreground">{membershipNotification}</p>
                  )}
                  {membershipStatus?.membership_request_status === "REJECTED" && (
                    <Notice variant="error">
                      Your previous membership request was rejected. You can try again if the
                      current membership policy allows it.
                    </Notice>
                  )}
                  {org.membership_policy.verification_mode === "INSTITUTIONAL_EMAIL" && (
                    <p className="text-xs text-muted-foreground">
                      Use your institutional account email from{" "}
                      {org.membership_policy.verified_email_domains.join(", ")}.
                    </p>
                  )}
                  {org.membership_policy.verification_mode === "ADMIN_REVIEW" && (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {org.membership_policy.verification_instructions}
                      </p>
                      <textarea
                        rows={3}
                        value={verificationNote}
                        onChange={(event) => setVerificationNote(event.target.value)}
                        placeholder="Explain how administrators can verify your affiliation"
                        className="w-full rounded-md border border-input bg-card p-3 text-xs text-foreground"
                      />
                    </>
                  )}
                  {invitationToken ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={isAcceptingInvitation}
                      onClick={() => void handleJoinOrganization()}
                    >
                      {isAcceptingInvitation ? "Accepting…" : "Accept Invitation"}
                    </Button>
                  ) : org.membership_policy.membership_requires_invitation ? (
                    <Notice>
                      Ask an organisation administrator for an invitation link. Invitations are
                      bound to the email address they were sent to.
                    </Notice>
                  ) : org.membership_policy.membership_requires_approval ? (
                    <>
                      <textarea
                        rows={3}
                        value={membershipMessage}
                        onChange={(event) => setMembershipMessage(event.target.value)}
                        placeholder="Optional message for organisation administrators"
                        className="w-full rounded-md border border-input bg-card p-3 text-xs text-foreground"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={isRequesting}
                        onClick={() => void handleRequestMembership()}
                      >
                        {isRequesting ? "Submitting…" : "Request to Join"}
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={isJoining}
                      onClick={() => void handleJoinOrganization()}
                    >
                      {isJoining ? "Joining…" : "Join Organisation"}
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
          {canManageMemberships && (
            <>
              {adminActionError && <Notice variant="error">{adminActionError}</Notice>}
              {adminActionSuccess && <Notice variant="success">{adminActionSuccess}</Notice>}
              <MembershipPolicyEditor
                policy={org.membership_policy}
                saving={isSavingPolicy}
                onSave={updateMembershipPolicy}
              />
              <Card>
                <CardHeader>
                  <CardTitle>Membership Requests</CardTitle>
                  <CardDescription>Review requests for this organisation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                <select
                  value={membershipStatusFilter}
                  onChange={(event) =>
                    setMembershipStatusFilter(
                      event.target.value as "PENDING" | "APPROVED" | "REJECTED",
                    )
                  }
                  className="h-8 rounded-md border border-input bg-card px-2.5 text-xs"
                >
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
                {membershipRequestsLoading ? (
                  <p className="text-xs text-muted-foreground">Loading requests…</p>
                ) : membershipRequests?.items.length ? (
                  <div className="space-y-3">
                    {membershipRequests.items.map((request) => (
                      <div key={request.id} className="rounded-md border border-border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {request.applicant_name || "Applicant"}
                            </p>
                            {request.applicant_email && (
                              <p className="text-[11px] text-muted-foreground truncate">
                                {request.applicant_email}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {request.status}
                          </Badge>
                        </div>
                        {request.message && (
                          <p className="text-xs text-muted-foreground">{request.message}</p>
                        )}
                        {membershipVerifications?.items.some(
                          (verification) =>
                            verification.membership_request_id === request.id &&
                            verification.status === "PENDING",
                        ) && (
                          <p className="text-xs font-medium text-amber-700">
                            Verify institutional affiliation before approving this request.
                          </p>
                        )}
                        {request.status === "PENDING" && (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="text-xs"
                              disabled={
                                isApprovingMembership ||
                                Boolean(membershipVerifications?.items.some(
                                  (verification) =>
                                    verification.membership_request_id === request.id &&
                                    verification.status === "PENDING",
                                ))
                              }
                              onClick={async () => {
                                setAdminActionError("");
                                setAdminActionSuccess("");
                                try {
                                  const result = await approveMembershipRequest(request.id);
                                  setAdminActionSuccess(
                                    `Request approved. Applicant email: ${result.notification_delivery ?? "NOT_SENT"}`,
                                  );
                                  await refetchMembershipRequests();
                                } catch (cause) {
                                  setAdminActionError(
                                    cause instanceof Error ? cause.message : "Could not approve membership request.",
                                  );
                                }
                              }}
                            >
                              Approve
                            </Button>
                            <div className="flex flex-1 items-center gap-2">
                              <input
                                type="text"
                                value={membershipRejectReasons[request.id] ?? ""}
                                onChange={(event) => setMembershipRejectReasons((reasons) => ({ ...reasons, [request.id]: event.target.value }))}
                                placeholder="Rejection reason"
                                className="h-8 min-w-32 flex-1 rounded-md border border-input px-2 text-xs"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="text-xs"
                                disabled={isRejectingMembership || (membershipRejectReasons[request.id] ?? "").trim().length < 2}
                                onClick={async () => {
                                  setAdminActionError("");
                                  setAdminActionSuccess("");
                                  try {
                                    const result = await rejectMembershipRequest({
                                      requestId: request.id,
                                      reason: (membershipRejectReasons[request.id] ?? "").trim(),
                                    });
                                    setAdminActionSuccess(
                                      `Request rejected. Applicant email: ${result.notification_delivery ?? "NOT_SENT"}`,
                                    );
                                    setMembershipRejectReasons((reasons) => ({ ...reasons, [request.id]: "" }));
                                    await refetchMembershipRequests();
                                  } catch (cause) {
                                    setAdminActionError(
                                      cause instanceof Error ? cause.message : "Could not reject membership request.",
                                    );
                                  }
                                }}
                              >
                                Reject
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No membership requests found.</p>
                )}
                </CardContent>
              </Card>
              <Card>
                  <CardHeader>
                    <CardTitle>Institutional Verification</CardTitle>
                    <CardDescription>Review pending affiliation submissions</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {verificationsLoading ? (
                      <p className="text-xs text-muted-foreground">Loading verification requests…</p>
                    ) : membershipVerifications?.items.length ? (
                      membershipVerifications.items.map((verification) => (
                        <div key={verification.id} className="space-y-2 rounded-md border border-border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold">
                                {verification.applicant_name || "Applicant"}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {verification.applicant_email}
                              </p>
                            </div>
                            <Badge variant="outline">{verification.status}</Badge>
                          </div>
                          {verification.submission_note && (
                            <p className="text-xs text-muted-foreground">
                              {verification.submission_note}
                            </p>
                          )}
                          {verification.status === "PENDING" && (
                            <div className="space-y-2">
                              <Button
                                type="button"
                                size="sm"
                                disabled={isApprovingVerification}
                                onClick={async () => {
                                  setAdminActionError("");
                                  setAdminActionSuccess("");
                                  try {
                                    const result = await approveVerification(verification.id);
                                    setAdminActionSuccess(
                                      `Verification approved. Applicant email: ${result.notification_delivery ?? "NOT_SENT"}`,
                                    );
                                    await refetchVerifications();
                                  } catch (cause) {
                                    setAdminActionError(
                                      cause instanceof Error ? cause.message : "Could not approve verification.",
                                    );
                                  }
                                }}
                              >
                                Verify affiliation
                              </Button>
                              <div className="flex gap-2">
                                <Input
                                  aria-label="Verification rejection reason"
                                  placeholder="Reason for rejection"
                                  value={verificationRejectReasons[verification.id] ?? ""}
                                  onChange={(event) => setVerificationRejectReasons((reasons) => ({ ...reasons, [verification.id]: event.target.value }))}
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  disabled={isRejectingVerification || (verificationRejectReasons[verification.id] ?? "").trim().length < 2}
                                  onClick={async () => {
                                    setAdminActionError("");
                                    setAdminActionSuccess("");
                                    try {
                                      const result = await rejectVerification({
                                        verificationId: verification.id,
                                      reason: (verificationRejectReasons[verification.id] ?? "").trim(),
                                      });
                                      setAdminActionSuccess(
                                        `Verification rejected. Applicant email: ${result.notification_delivery ?? "NOT_SENT"}`,
                                      );
                                    setVerificationRejectReasons((reasons) => ({ ...reasons, [verification.id]: "" }));
                                      await refetchVerifications();
                                    } catch (cause) {
                                      setAdminActionError(
                                        cause instanceof Error ? cause.message : "Could not reject verification.",
                                      );
                                    }
                                  }}
                                >
                                  Reject
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">No verification submissions found.</p>
                    )}
                  </CardContent>
                </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Invitations</CardTitle>
                  <CardDescription>
                    Invitations are emailed using the configured SMTP server. If SMTP is unavailable,
                    copy the link and share it securely.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <form
                    className="flex gap-2"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      setAdminActionError("");
                      setAdminActionSuccess("");
                      try {
                        const created = await createInvitation(invitationEmail);
                        setLatestInvitationUrl(created.invitation_url ?? "");
                        setLatestInvitationDelivery(created.notification_delivery ?? "");
                        setAdminActionSuccess(
                          `Invitation created. Email delivery: ${created.notification_delivery ?? "NOT_SENT"}`,
                        );
                        setInvitationEmail("");
                        await refetchInvitations();
                      } catch (cause) {
                        setAdminActionError(
                          cause instanceof Error ? cause.message : "Could not send invitation.",
                        );
                      }
                    }}
                  >
                    <Input
                      type="email"
                      required
                      aria-label="Invitee email address"
                      placeholder="member@example.edu"
                      value={invitationEmail}
                      onChange={(event) => setInvitationEmail(event.target.value)}
                    />
                    <Button type="submit" size="sm" disabled={isCreatingInvitation}>
                      {isCreatingInvitation ? "Sending…" : "Invite"}
                    </Button>
                  </form>
                  {latestInvitationUrl && (
                    <div className="space-y-2 rounded-md border border-border p-3">
                      <p className="text-xs font-medium">New invitation link</p>
                      {latestInvitationDelivery && (
                        <p className="text-xs text-muted-foreground">
                          Email delivery: {latestInvitationDelivery}
                        </p>
                      )}
                      <Input readOnly value={latestInvitationUrl} aria-label="New invitation link" />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(latestInvitationUrl);
                          } catch {
                            setAdminActionError("Could not copy the link. Select and copy it manually.");
                          }
                        }}
                      >
                        Copy link
                      </Button>
                    </div>
                  )}
                  {invitationsLoading ? (
                    <p className="text-xs text-muted-foreground">Loading invitations…</p>
                  ) : organizationInvitations?.items.length ? (
                    <div className="space-y-2">
                      {organizationInvitations.items.map((invitation) => (
                        <div key={invitation.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium">{invitation.email}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {invitation.status} · expires {new Date(invitation.expires_at).toLocaleDateString()}
                            </p>
                            {invitation.notification_delivery && (
                              <p className="text-[11px] text-muted-foreground">
                                Expiry email: {invitation.notification_delivery}
                              </p>
                            )}
                          </div>
                          {invitation.status === "PENDING" && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isRevokingInvitation}
                              onClick={async () => {
                                setAdminActionError("");
                                setAdminActionSuccess("");
                                try {
                                  const result = await revokeInvitation(invitation.id);
                                  setAdminActionSuccess(
                                    `Invitation revoked. Email delivery: ${result.notification_delivery ?? "NOT_SENT"}`,
                                  );
                                  await refetchInvitations();
                                } catch (cause) {
                                  setAdminActionError(
                                    cause instanceof Error ? cause.message : "Could not revoke invitation.",
                                  );
                                }
                              }}
                            >
                              Revoke
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No invitations yet.</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Right Column: Governance Metadata */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Organisation Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Current Status</span>
                <span className="font-semibold">{org.status}</span>
              </div>
              {org.approved_at && (
                <div>
                  <span className="text-muted-foreground block text-[11px]">Charter Approved</span>
                  <span>{new Date(org.approved_at).toLocaleString()}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {(isSuperAdmin || isCreatorOrManager) && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5 text-primary">
                  <Shield className="h-4 w-4" />
                  <span>Management Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-foreground">
                <p className="font-semibold">Authorised Administrative Context</p>
                <p className="text-muted-foreground text-[11px]">
                  You have access to view and manage this institutional tenant.
                </p>
                <div className="rounded-md border border-border/70 bg-card p-3">
                  <p className="text-[11px] text-muted-foreground">Current owner</p>
                  <p className="mt-1 font-medium">
                    {org.current_owner_name ?? "Platform-managed"}
                  </p>
                  {org.management_arrangement && (
                    <Badge variant="outline" className="mt-2">
                      {org.management_arrangement.replaceAll("_", " ")}
                    </Badge>
                  )}
                </div>
                {isSuperAdmin && org.status === "ACTIVE" && (
                  <OrganizationManagementEditor
                    organizationId={org.id}
                    currentOwnerId={org.current_owner_id ?? null}
                    onUpdated={() => void refetch()}
                  />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <Dialog open={confirmSuspendOpen} onOpenChange={setConfirmSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>Suspend Organisation</span>
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to suspend <strong>{org.name}</strong>?
              All active voting events and member actions will be paused.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmSuspendOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isSuspending}
              onClick={() => void handleSuspend()}
            >
              {isSuspending ? "Suspending…" : "Confirm Suspension"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmRestoreOpen} onOpenChange={setConfirmRestoreOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <CheckCircle2 className="h-5 w-5 text-emerald-700" />
              <span>Restore Organisation</span>
            </DialogTitle>
            <DialogDescription>
              Restore <strong>{org.name}</strong> to ACTIVE status?
              Administrative features and scheduled elections will resume immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmRestoreOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={isRestoring}
              onClick={() => void handleRestore()}
            >
              {isRestoring ? "Restoring…" : "Confirm Restoration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MembershipPolicyEditor({
  policy,
  saving,
  onSave,
}: {
  policy: OrganizationMembershipPolicy;
  saving: boolean;
  onSave: (policy: OrganizationMembershipPolicy) => Promise<OrganizationMembershipPolicy>;
}) {
  const [requiresApproval, setRequiresApproval] = useState(policy.membership_requires_approval);
  const [requiresInvitation, setRequiresInvitation] = useState(
    policy.membership_requires_invitation,
  );
  const [verificationMode, setVerificationMode] = useState<MembershipVerificationMode>(
    policy.verification_mode,
  );
  const [domains, setDomains] = useState(policy.verified_email_domains.join(", "));
  const [instructions, setInstructions] = useState(policy.verification_instructions ?? "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setRequiresApproval(policy.membership_requires_approval);
    setRequiresInvitation(policy.membership_requires_invitation);
    setVerificationMode(policy.verification_mode);
    setDomains(policy.verified_email_domains.join(", "));
    setInstructions(policy.verification_instructions ?? "");
  }, [policy]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Membership Policy</CardTitle>
        <CardDescription>
          Choose how members join. Existing requests and invitations keep their recorded policy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <Notice variant="error">{error}</Notice>}
        {success && <Notice variant="success">{success}</Notice>}
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={requiresApproval}
            onChange={(event) => setRequiresApproval(event.target.checked)}
          />
          Require administrator approval
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={requiresInvitation}
            onChange={(event) => setRequiresInvitation(event.target.checked)}
          />
          Require an invitation
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium">Institutional verification</span>
          <select
            value={verificationMode}
            onChange={(event) =>
              setVerificationMode(event.target.value as MembershipVerificationMode)
            }
            className="h-9 w-full rounded-md border border-input bg-card px-3 text-xs"
          >
            <option value="NONE">No additional verification</option>
            <option value="INSTITUTIONAL_EMAIL">Approved institutional email domain</option>
            <option value="ADMIN_REVIEW">Manual administrator review</option>
          </select>
        </label>
        {verificationMode === "INSTITUTIONAL_EMAIL" && (
          <label className="block space-y-1">
            <span className="text-xs font-medium">Approved email domains</span>
            <Input
              value={domains}
              onChange={(event) => setDomains(event.target.value)}
              placeholder="university.edu, department.university.edu"
            />
          </label>
        )}
        {verificationMode === "ADMIN_REVIEW" && (
          <label className="block space-y-1">
            <span className="text-xs font-medium">Verification instructions</span>
            <textarea
              rows={3}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Explain what affiliation evidence administrators should review"
              className="w-full rounded-md border border-input bg-card p-3 text-xs"
            />
          </label>
        )}
        <Button
          type="button"
          size="sm"
          disabled={saving}
          onClick={async () => {
            setError("");
            setSuccess("");
            try {
              await onSave({
                membership_requires_approval: requiresApproval,
                membership_requires_invitation: requiresInvitation,
                verification_mode: verificationMode,
                verified_email_domains:
                  verificationMode === "INSTITUTIONAL_EMAIL"
                    ? domains.split(/[,\s]+/).map((domain) => domain.trim()).filter(Boolean)
                    : [],
                verification_instructions:
                  verificationMode === "ADMIN_REVIEW" ? instructions.trim() || null : null,
              });
              setSuccess("Membership policy saved.");
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Could not save membership policy.");
            }
          }}
        >
          {saving ? "Saving…" : "Save membership policy"}
        </Button>
      </CardContent>
    </Card>
  );
}

function OrganizationManagementEditor({
  organizationId,
  currentOwnerId,
  onUpdated,
}: {
  organizationId: string;
  currentOwnerId: string | null;
  onUpdated: () => void;
}) {
  const [mode, setMode] = useState<OrganizationManagementMode>("RETAIN_PLATFORM_MANAGEMENT");
  const [ownerSearch, setOwnerSearch] = useState("");
  const [selectedOwner, setSelectedOwner] = useState<PlatformUserSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { data: users, isLoading: usersLoading, error: usersError } =
    useAdminUsers(ownerSearch);
  const updateManagement = useUpdateOrganizationManagement();

  const onSubmit = async () => {
    if (mode === "ASSIGN_OWNER" && !selectedOwner) {
      setError("Search for and select a registered user before handing over management.");
      return;
    }
    const managerName =
      mode === "ASSIGN_OWNER" ? selectedOwner?.full_name : "the current platform administrator";
    if (!window.confirm(`Confirm management assignment to ${managerName}?`)) return;

    setError(null);
    setSuccess(null);
    try {
      await updateManagement.mutateAsync({
        organizationId,
        data: {
          management_mode: mode,
          ...(mode === "ASSIGN_OWNER" && selectedOwner
            ? { manager_user_id: selectedOwner.id }
            : {}),
        },
      });
      setSuccess(
        mode === "ASSIGN_OWNER"
          ? `Management handed over to ${selectedOwner?.full_name}.`
          : "Platform management retained.",
      );
      onUpdated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update organisation management.");
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-border/70 bg-card p-3">
      <div>
        <p className="text-sm font-semibold">Management assignment</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Hand over ownership to an active user or keep the platform as owner.
        </p>
      </div>
      <label className="block space-y-1">
        <span className="text-xs font-medium">Management choice</span>
        <select
          value={mode}
          onChange={(event) => {
            setMode(event.target.value as OrganizationManagementMode);
            setError(null);
          }}
          className="h-9 w-full rounded-md border border-input bg-card px-3 text-xs text-foreground"
        >
          <option value="RETAIN_PLATFORM_MANAGEMENT">Retain platform management</option>
          <option value="ASSIGN_OWNER">Hand over to an organisation owner</option>
        </select>
      </label>
      {mode === "ASSIGN_OWNER" && (
        <div className="space-y-2">
          <Input
            aria-label="Search for organisation owner"
            placeholder="Search user by name or email"
            value={ownerSearch}
            onChange={(event) => {
              setOwnerSearch(event.target.value);
              setSelectedOwner(null);
            }}
          />
          {selectedOwner && (
            <p className="text-xs text-emerald-700">
              Selected: {selectedOwner.full_name} ({selectedOwner.email})
            </p>
          )}
          {usersError && (
            <Notice variant="error">
              {usersError instanceof Error ? usersError.message : "Could not search users."}
            </Notice>
          )}
          {usersLoading && (
            <p className="text-xs text-muted-foreground">Searching users…</p>
          )}
          {(users?.items.length ?? 0) > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-md border border-border">
              {users?.items.map((user) => (
                <button
                  type="button"
                  key={user.id}
                  disabled={user.id === currentOwnerId}
                  onClick={() => {
                    setSelectedOwner(user);
                    setOwnerSearch(user.email);
                    setError(null);
                  }}
                  className="flex w-full items-center justify-between gap-2 border-b border-border/60 px-3 py-2 text-left text-xs last:border-0 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>
                    <span className="block font-medium">{user.full_name}</span>
                    <span className="block text-[11px] text-muted-foreground">{user.email}</span>
                  </span>
                  {user.id === currentOwnerId && (
                    <span className="text-[10px] text-muted-foreground">Current owner</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {error && <Notice variant="error">{error}</Notice>}
      {success && <Notice variant="success">{success}</Notice>}
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          disabled={updateManagement.isPending || (mode === "ASSIGN_OWNER" && !selectedOwner)}
          onClick={() => void onSubmit()}
        >
          {updateManagement.isPending ? "Saving…" : "Save management"}
        </Button>
      </div>
    </div>
  );
}
