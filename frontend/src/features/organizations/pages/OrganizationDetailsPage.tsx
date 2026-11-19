import { useState } from "react";
import { useParams, Link } from "react-router-dom";
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
} from "../hooks/useOrganizations";
import { useUserProfile } from "../../auth/hooks/useUserProfile";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
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
  const [membershipMessage, setMembershipMessage] = useState("");
  const [membershipError, setMembershipError] = useState("");
  const [membershipStatusFilter, setMembershipStatusFilter] =
    useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const canManageMemberships =
    Boolean(membershipStatus?.can_manage) ||
    Boolean(profile?.is_platform_super_admin);
  const {
    data: membershipRequests,
    isLoading: membershipRequestsLoading,
    refetch: refetchMembershipRequests,
  } = useOrganizationMembershipRequests(
    id || "",
    membershipStatusFilter,
  );
  const { mutateAsync: approveMembershipRequest, isPending: isApprovingMembership } =
    useApproveOrganizationMembershipRequest(id || "");
  const { mutateAsync: rejectMembershipRequest, isPending: isRejectingMembership } =
    useRejectOrganizationMembershipRequest(id || "");
  const [membershipRejectReason, setMembershipRejectReason] = useState("");

  const { mutateAsync: suspendOrg, isPending: isSuspending } = useSuspendOrganization();
  const { mutateAsync: restoreOrg, isPending: isRestoring } = useRestoreOrganization();

  const [confirmSuspendOpen, setConfirmSuspendOpen] = useState(false);
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isSuperAdmin = profile?.is_active && (profile as any)?.is_platform_super_admin;
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
      await requestMembership({
        organizationId: org.id,
        message: membershipMessage.trim() || undefined,
      });
      await refetchMembership();
    } catch (cause) {
      setMembershipError(cause instanceof Error ? cause.message : "Membership request failed.");
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
              <CardDescription>Request access to this organisation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {membershipLoading ? (
                <p className="text-xs text-muted-foreground">Checking membership status…</p>
              ) : membershipStatus?.membership_status === "ACTIVE" ? (
                <Notice variant="success">You are an active member of this organisation.</Notice>
              ) : membershipStatus?.membership_status === "SUSPENDED" ? (
                <Notice>Your membership in this organisation is suspended.</Notice>
              ) : membershipStatus?.membership_request_status === "PENDING" ? (
                <Notice variant="success">Your request is pending review.</Notice>
              ) : membershipStatus?.membership_request_status === "REJECTED" ? (
                <Notice variant="error">
                  Your previous membership request was rejected. You may submit another request.
                </Notice>
              ) : (
                <>
                  {membershipError && <Notice variant="error">{membershipError}</Notice>}
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
              )}
            </CardContent>
          </Card>
          {canManageMemberships && (
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
                        {request.status === "PENDING" && (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="text-xs"
                              disabled={isApprovingMembership}
                              onClick={async () => {
                                await approveMembershipRequest(request.id);
                                await refetchMembershipRequests();
                              }}
                            >
                              Approve
                            </Button>
                            <div className="flex flex-1 items-center gap-2">
                              <input
                                type="text"
                                value={membershipRejectReason}
                                onChange={(event) => setMembershipRejectReason(event.target.value)}
                                placeholder="Rejection reason"
                                className="h-8 min-w-32 flex-1 rounded-md border border-input px-2 text-xs"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="text-xs"
                                disabled={isRejectingMembership || membershipRejectReason.trim().length < 2}
                                onClick={async () => {
                                  await rejectMembershipRequest({
                                    requestId: request.id,
                                    reason: membershipRejectReason.trim(),
                                  });
                                  setMembershipRejectReason("");
                                  await refetchMembershipRequests();
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
              <CardContent className="text-xs text-foreground space-y-1">
                <p className="font-semibold">Authorised Administrative Context</p>
                <p className="text-muted-foreground text-[11px]">
                  You have access to view and manage this institutional tenant.
                </p>
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
