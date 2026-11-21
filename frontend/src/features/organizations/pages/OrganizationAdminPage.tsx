import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Building2,
  FileCheck2,
  PauseCircle,
  Check,
  X,
  CheckCircle2,
  AlertTriangle,
  LayoutDashboard,
  Settings,
  UsersRound,
  ClipboardList,
} from "lucide-react";

import {
  useAdminOrganizations,
  useAdminUsers,
  useAdminOrganizationRequests,
  useApproveOrganizationRequest,
  useRejectOrganizationRequest,
  useCreateOrganizationDirectly,
  useSuspendOrganization,
  useRestoreOrganization,
  usePlatformOverview,
} from "../hooks/useOrganizations";
import { PlatformAdminTools, type PlatformAdminSection } from "./PlatformAdminTools";
import {
  organizationDirectCreateSchema,
  rejectRequestSchema,
  type OrganizationDirectCreateFormValues,
  type RejectRequestFormValues,
} from "../schemas/organizationSchemas";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Badge } from "../../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { LoadingState } from "../../../components/shared/LoadingState";
import { Notice } from "../../../components/shared/Notice";
import { EmptyState } from "../../../components/shared/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../../components/ui/dialog";
import type { OrganizationRequestResponse } from "../types/organization";
import { useUserProfile } from "../../auth/hooks/useUserProfile";

type AdminTab = "overview" | "directory" | "requests" | "users" | "audit" | "settings" | "create";

export function OrganizationAdminPage() {
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [requestFilter, setRequestFilter] = useState<string>("PENDING_APPROVAL");
  const [ownerSearch, setOwnerSearch] = useState("");

  // Data queries
  const {
    data: orgsData,
    isLoading: orgsLoading,
    error: orgsError,
    refetch: refetchOrgs,
  } = useAdminOrganizations(statusFilter || undefined);
  const {
    data: overviewData,
    isLoading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = usePlatformOverview();

  const {
    data: requestsData,
    isLoading: requestsLoading,
    error: requestsError,
    refetch: refetchRequests,
  } = useAdminOrganizationRequests(requestFilter || undefined);

  // Mutations
  const { mutateAsync: approveRequest, isPending: isApproving } = useApproveOrganizationRequest();
  const { mutateAsync: rejectRequest, isPending: isRejecting } = useRejectOrganizationRequest();
  const { mutateAsync: createDirectly, isPending: isCreating } = useCreateOrganizationDirectly();
  const { mutateAsync: suspendOrg, isPending: isSuspending } = useSuspendOrganization();
  const { mutateAsync: restoreOrg, isPending: isRestoring } = useRestoreOrganization();

  // Modals state
  const [selectedRequest, setSelectedRequest] = useState<OrganizationRequestResponse | null>(null);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createSuccessMsg, setCreateSuccessMsg] = useState<string | null>(null);
  const [createConfirmOpen, setCreateConfirmOpen] = useState(false);
  const [pendingCreateValues, setPendingCreateValues] =
    useState<OrganizationDirectCreateFormValues | null>(null);

  // Rejection Form
  const {
    register: registerReject,
    handleSubmit: handleRejectSubmit,
    reset: resetReject,
    formState: { errors: rejectErrors },
  } = useForm<RejectRequestFormValues>({
    resolver: zodResolver(rejectRequestSchema),
    defaultValues: { reason: "" },
  });

  // Direct Creation Form
  const {
    register: registerCreate,
    handleSubmit: handleCreateSubmit,
    watch: watchCreate,
    reset: resetCreate,
    setValue: setCreateValue,
    formState: { errors: createErrors },
  } = useForm<OrganizationDirectCreateFormValues>({
    resolver: zodResolver(organizationDirectCreateSchema),
    defaultValues: {
      name: "",
      organization_type: "UNIVERSITY",
      country: "",
      description: "",
      contact_email: "",
      contact_phone: "",
      website: "",
      logo_url: "",
      slug: "",
      management_mode: "RETAIN_PLATFORM_MANAGEMENT",
      manager_user_id: "",
    },
  });

  const selectedManagementMode = watchCreate("management_mode");
  const { data: ownerUsers, error: ownerUsersError, isLoading: ownerUsersLoading } =
    useAdminUsers(ownerSearch);

  // Metrics computation from real backend responses
  const totalOrgs = overviewData?.total_organizations ?? 0;
  const activeOrgs = overviewData?.active_organizations ?? 0;
  const suspendedOrgs = overviewData?.suspended_organizations ?? 0;
  const pendingRequests = overviewData?.pending_requests ?? 0;

  const onConfirmApprove = async () => {
    if (!selectedRequest) return;
    setActionError(null);
    try {
      await approveRequest(selectedRequest.id);
      setApproveConfirmOpen(false);
      setSelectedRequest(null);
      void refetchRequests();
      void refetchOrgs();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Approval failed.");
    }
  };

  const onConfirmReject = async (values: RejectRequestFormValues) => {
    if (!selectedRequest) return;
    setActionError(null);
    try {
      await rejectRequest({
        requestId: selectedRequest.id,
        data: { reason: values.reason },
      });
      setRejectModalOpen(false);
      setSelectedRequest(null);
      resetReject();
      void refetchRequests();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Rejection failed.");
    }
  };

  const onSubmitDirectCreate = async (values: OrganizationDirectCreateFormValues) => {
    setPendingCreateValues(values);
    setCreateConfirmOpen(true);
  };

  const onChangeOrganizationStatus = async (
    organizationId: string,
    organizationName: string,
    action: "suspend" | "restore",
  ) => {
    const confirmed = window.confirm(
      action === "suspend"
        ? `Suspend ${organizationName}?`
        : `Restore ${organizationName}?`,
    );
    if (!confirmed) return;
    setActionError(null);
    try {
      if (action === "suspend") {
        await suspendOrg(organizationId);
      } else {
        await restoreOrg(organizationId);
      }
      await Promise.all([refetchOrgs(), refetchOverview()]);
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : `Could not ${action} ${organizationName}.`,
      );
    }
  };

  const confirmDirectCreate = async () => {
    if (!pendingCreateValues) return;
    const values = pendingCreateValues;
    setActionError(null);
    setCreateSuccessMsg(null);
    try {
      const response = await createDirectly({
        name: values.name,
        organization_type: values.organization_type,
        country: values.country,
        description: values.description || null,
        contact_email: values.contact_email || null,
        contact_phone: values.contact_phone || null,
        website: values.website || null,
        logo_url: values.logo_url || null,
        slug: values.slug || null,
        management_mode: values.management_mode,
        manager_user_id:
          values.management_mode === "ASSIGN_OWNER" && values.manager_user_id
            ? values.manager_user_id
            : null,
      });
      setCreateSuccessMsg(`Organisation "${response.name}" successfully created.`);
      resetCreate();
      setOwnerSearch("");
      setCreateConfirmOpen(false);
      setPendingCreateValues(null);
      void refetchOrgs();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create organisation.");
      setCreateConfirmOpen(false);
      setPendingCreateValues(null);
    }
  };

  if (profileLoading) {
    return <LoadingState label="Checking platform access…" />;
  }
  if (!profile?.is_platform_super_admin) {
    return (
      <Notice>
        Platform Super Admin access is required to open this console.
      </Notice>
    );
  }

  return (
    <div className="space-y-6 animate-fade">
      <PageHeader
        title="Organisation Administration"
        description="Platform Super Admin console for institutional review, tenant governance, and direct charter provisioning."
        badge={
          <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider">
            Super Admin Access
          </Badge>
        }
      />

      {/* Overview Statistics Cards (Real data from backend queries) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-xs font-medium text-muted-foreground">Total Organisations</span>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrgs}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">Registered in platform directory</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-xs font-medium text-muted-foreground">Active Tenancies</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeOrgs}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">Authorized to conduct elections</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-xs font-medium text-muted-foreground">Pending Requests</span>
            <FileCheck2 className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequests}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">Awaiting charter verification</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-xs font-medium text-muted-foreground">Suspended</span>
            <PauseCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suspendedOrgs}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">Administrative hold</p>
          </CardContent>
        </Card>
      </div>

      {actionError && (
        <Notice variant="error" className="my-2">
          {actionError}
        </Notice>
      )}
      {overviewError && (
        <Notice variant="error" className="my-2">
          {overviewError instanceof Error ? overviewError.message : "Could not load platform totals."}
        </Notice>
      )}

      <div
        role="tablist"
        aria-label="Platform administration"
        className="flex gap-1 overflow-x-auto border-b border-border/80"
      >
        {([
          { id: "overview", label: "Overview", icon: LayoutDashboard },
          { id: "directory", label: "Organisations", icon: Building2, count: totalOrgs },
          { id: "requests", label: "Requests", icon: FileCheck2, count: pendingRequests },
          { id: "users", label: "Users & access", icon: UsersRound },
          { id: "audit", label: "Audit log", icon: ClipboardList },
          { id: "settings", label: "Settings", icon: Settings },
          { id: "create", label: "Create organisation", icon: CheckCircle2 },
        ] as { id: AdminTab; label: string; icon: typeof LayoutDashboard; count?: number }[]).map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            id={`admin-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            aria-controls="admin-tab-panel"
            onClick={() => setActiveTab(id)}
            className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold transition-colors ${
              activeTab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
            {count !== undefined && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 1. Directory Tab */}
      <div
        id="admin-tab-panel"
        role="tabpanel"
        aria-labelledby={`admin-tab-${activeTab}`}
        className="min-w-0"
      >
      {activeTab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Platform overview</CardTitle>
              <CardDescription>
                A snapshot of platform activity and the tasks that need attention.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Registered users", overviewData?.total_users],
                  ["Organisations", overviewData?.total_organizations],
                  ["Active organisations", overviewData?.active_organizations],
                  ["Suspended organisations", overviewData?.suspended_organizations],
                ].map(([label, count]) => (
                  <div key={label} className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 text-2xl font-semibold">
                      {count ?? (overviewLoading ? "—" : 0)}
                    </p>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void refetchOverview()}
              >
                Refresh overview
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
              <CardDescription>Jump directly to common administration tasks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button type="button" variant="outline" className="w-full justify-between" onClick={() => setActiveTab("requests")}>
                Review organisation requests
                <Badge variant={pendingRequests ? "warning" : "secondary"}>{pendingRequests} pending</Badge>
              </Button>
              <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setActiveTab("directory")}>
                <Building2 className="h-4 w-4" /> Browse organisation directory
              </Button>
              <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setActiveTab("users")}>
                <UsersRound className="h-4 w-4" /> Manage users and roles
              </Button>
              <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setActiveTab("create")}>
                Create an organisation directly
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "directory" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status filter:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 rounded-md border border-input bg-card px-2.5 text-xs text-foreground"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
                <option value="REJECTED">REJECTED</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
            <Button size="sm" variant="outline" className="text-xs" onClick={() => void refetchOrgs()}>
              Refresh
            </Button>
          </div>

          {orgsLoading && <LoadingState label="Loading directory…" />}
          {orgsError && (
            <Notice variant="error">
              {orgsError instanceof Error ? orgsError.message : "Could not load organisations."}
            </Notice>
          )}

          {!orgsLoading && !orgsError && (orgsData?.items.length ?? 0) === 0 && (
            <EmptyState
              icon={<Building2 className="h-6 w-6" />}
              title="No organisations found"
              description="No organisations match the selected filter."
            />
          )}

          {!orgsLoading && (orgsData?.items.length ?? 0) > 0 && (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgsData?.items.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium text-foreground">
                        <div>
                          <p className="font-semibold text-xs sm:text-sm">{org.name}</p>
                          <p className="text-[11px] font-mono text-muted-foreground">{org.slug}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {org.organization_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{org.country}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            org.status === "ACTIVE"
                              ? "success"
                              : org.status === "SUSPENDED"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {org.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(org.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Link to={`/app/organizations/${org.id}`}>
                          <Button size="sm" variant="outline" className="h-7 text-xs">
                            View
                          </Button>
                        </Link>
                        {org.status === "ACTIVE" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs"
                            disabled={isSuspending || isRestoring}
                            onClick={() => void onChangeOrganizationStatus(org.id, org.name, "suspend")}
                          >
                            {isSuspending ? "Suspending…" : "Suspend"}
                          </Button>
                        )}
                        {org.status === "SUSPENDED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-emerald-600 text-emerald-700"
                            disabled={isSuspending || isRestoring}
                            onClick={() => void onChangeOrganizationStatus(org.id, org.name, "restore")}
                          >
                            {isRestoring ? "Restoring…" : "Restore"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}

      {/* 2. Review Requests Tab */}
      {activeTab === "requests" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status filter:</span>
              <select
                value={requestFilter}
                onChange={(e) => setRequestFilter(e.target.value)}
                className="h-8 rounded-md border border-input bg-card px-2.5 text-xs text-foreground"
              >
                <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>
            <Button size="sm" variant="outline" className="text-xs" onClick={() => void refetchRequests()}>
              Refresh
            </Button>
          </div>

          {requestsLoading && <LoadingState label="Loading requests…" />}
          {requestsError && (
            <Notice variant="error">
              {requestsError instanceof Error ? requestsError.message : "Could not load requests."}
            </Notice>
          )}

          {!requestsLoading && !requestsError && (requestsData?.items.length ?? 0) === 0 && (
            <EmptyState
              icon={<FileCheck2 className="h-6 w-6" />}
              title="No requests pending"
              description="No organisation requests match the current status filter."
            />
          )}

          {!requestsLoading && (requestsData?.items.length ?? 0) > 0 && (
            <div className="space-y-3">
              {requestsData?.items.map((req) => (
                <Card key={req.id} className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm text-foreground">{req.name}</h4>
                        <Badge variant="outline" className="text-[10px]">{req.organization_type}</Badge>
                        <Badge
                          variant={
                            req.status === "APPROVED"
                              ? "success"
                              : req.status === "REJECTED"
                              ? "destructive"
                              : "warning"
                          }
                          className="text-[10px]"
                        >
                          {req.status}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Country: <strong>{req.country}</strong> • Submitted:{" "}
                        {new Date(req.created_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Submitted by: <strong>{req.requested_by_name ?? req.requested_by ?? "Unknown user"}</strong>
                      </p>
                      {req.reviewed_at && (
                        <p className="text-xs text-muted-foreground">
                          Decision: <strong>{req.reviewed_by_name ?? req.reviewed_by ?? "Platform reviewer"}</strong>{" "}
                          at {new Date(req.reviewed_at).toLocaleString()}
                        </p>
                      )}

                      {req.description && (
                        <p className="text-xs text-foreground/80 bg-muted/30 p-2.5 rounded-md mt-1 leading-relaxed">
                          {req.description}
                        </p>
                      )}

                      {req.supporting_information && (
                        <div className="text-[11px] text-muted-foreground pt-1">
                          <span className="font-semibold text-foreground">Supporting info:</span>{" "}
                          {req.supporting_information}
                        </div>
                      )}

                      {req.rejection_reason && (
                        <p className="text-xs text-destructive mt-1">
                          Rejection Reason: {req.rejection_reason}
                        </p>
                      )}
                    </div>

                    {req.status === "PENDING_APPROVAL" && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs border-emerald-600 text-emerald-700 hover:bg-emerald-50 gap-1"
                          onClick={() => {
                            setSelectedRequest(req);
                            setApproveConfirmOpen(true);
                          }}
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Approve</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="text-xs gap-1"
                          onClick={() => {
                            setSelectedRequest(req);
                            setRejectModalOpen(true);
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Reject</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Direct Creation Tab */}
      {activeTab === "create" && (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Direct Organisation Charter Creation</CardTitle>
            <CardDescription>
              Directly establish an institutional tenant and configure the initial management assignment choice.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {createSuccessMsg && (
              <Notice variant="success" className="mb-4">
                {createSuccessMsg}
              </Notice>
            )}

            <form onSubmit={handleCreateSubmit(onSubmitDirectCreate)} className="space-y-4" noValidate>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">
                  Organisation Name <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="e.g. Imperial College Council"
                  error={Boolean(createErrors.name)}
                  {...registerCreate("name")}
                />
                {createErrors.name && (
                  <p className="text-[11px] text-destructive">{createErrors.name.message}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">
                    Organisation Type <span className="text-destructive">*</span>
                  </label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-xs text-foreground shadow-subtle focus:outline-none focus:ring-1 focus:ring-primary"
                    {...registerCreate("organization_type")}
                  >
                    <option value="UNIVERSITY">University</option>
                    <option value="DEPARTMENT">Department / Faculty</option>
                    <option value="COMPANY">Company / Enterprise</option>
                    <option value="ASSOCIATION">Association / Union</option>
                    <option value="CLUB">Student Club / Society</option>
                    <option value="OTHER">Other Institution</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">
                    Country <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Ghana"
                    error={Boolean(createErrors.country)}
                    {...registerCreate("country")}
                  />
                  {createErrors.country && (
                    <p className="text-[11px] text-destructive">{createErrors.country.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">
                  Custom Slug (optional)
                </label>
                <Input
                  placeholder="e.g. imperial-council"
                  error={Boolean(createErrors.slug)}
                  {...registerCreate("slug")}
                />
                {createErrors.slug && (
                  <p className="text-[11px] text-destructive">{createErrors.slug.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">
                  Description
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-md border border-input bg-card p-3 text-xs text-foreground shadow-subtle focus:outline-none focus:ring-1 focus:ring-primary"
                  {...registerCreate("description")}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Contact Email</label>
                  <Input
                    type="email"
                    placeholder="contact@institution.edu"
                    error={Boolean(createErrors.contact_email)}
                    {...registerCreate("contact_email")}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Contact Phone</label>
                  <Input
                    type="tel"
                    placeholder="+233 20 000 0000"
                    error={Boolean(createErrors.contact_phone)}
                    {...registerCreate("contact_phone")}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-1">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Website</label>
                  <Input
                    placeholder="https://institution.edu"
                    error={Boolean(createErrors.website)}
                    {...registerCreate("website")}
                  />
                </div>
              </div>

              {/* Management Handover Choice */}
              <div className="pt-4 border-t border-border/60 space-y-3">
                <h4 className="text-xs font-semibold text-foreground">
                  Initial Management Assignment
                </h4>

                <div className="space-y-2 text-xs">
                  <label className="flex items-start gap-2.5 p-3 rounded-md border border-border bg-card cursor-pointer hover:bg-muted/30">
                    <input
                      type="radio"
                      value="RETAIN_PLATFORM_MANAGEMENT"
                      className="mt-0.5 text-primary focus:ring-primary"
                      {...registerCreate("management_mode")}
                    />
                    <div>
                      <p className="font-semibold text-foreground">
                        Option A — Retain Initial Management
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Platform Super Admin retains initial organisation-level ownership.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-md border border-border bg-card cursor-pointer hover:bg-muted/30">
                    <input
                      type="radio"
                      value="ASSIGN_OWNER"
                      className="mt-0.5 text-primary focus:ring-primary"
                      {...registerCreate("management_mode")}
                    />
                    <div>
                      <p className="font-semibold text-foreground">
                        Option B — Hand Over Management
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Designate an existing UniVote user as the initial Organisation Owner. The Super Admin will not retain organisation-level ownership.
                      </p>
                    </div>
                  </label>
                </div>

                {selectedManagementMode === "ASSIGN_OWNER" && (
                  <div className="space-y-1 pt-2 animate-fade">
                    <label className="text-xs font-medium text-foreground">
                      Search registered UniVote user <span className="text-destructive">*</span>
                    </label>
                    <Input
                      aria-label="Search registered UniVote users"
                      placeholder="Search by name or email"
                      error={Boolean(createErrors.manager_user_id)}
                      value={ownerSearch}
                      onChange={(event) => {
                        setOwnerSearch(event.target.value);
                        setCreateValue("manager_user_id", "", { shouldValidate: true });
                      }}
                    />
                    {ownerUsersError && (
                      <Notice variant="error">
                        {ownerUsersError instanceof Error
                          ? ownerUsersError.message
                          : "Could not search users."}
                      </Notice>
                    )}
                    {ownerUsersLoading && (
                      <p className="text-[11px] text-muted-foreground">Searching users…</p>
                    )}
                    {ownerUsers?.items.length ? (
                      <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-card">
                        {ownerUsers.items.map((owner) => (
                          <button
                            key={owner.id}
                            type="button"
                            className="flex w-full items-center justify-between border-b border-border/60 px-3 py-2 text-left last:border-0 hover:bg-muted"
                            onClick={() => {
                              setCreateValue("manager_user_id", owner.id, { shouldValidate: true });
                              setOwnerSearch(owner.email);
                            }}
                          >
                            <span>
                              <span className="block text-xs font-semibold">{owner.full_name}</span>
                              <span className="block text-[11px] text-muted-foreground">{owner.email}</span>
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground">{owner.id.slice(0, 8)}</span>
                          </button>
                        ))}
                      </div>
                    ) : ownerSearch.trim() ? (
                      <p className="text-[11px] text-muted-foreground">No matching active users found.</p>
                    ) : null}
                    {createErrors.manager_user_id && (
                      <p className="text-[11px] text-destructive">
                        {createErrors.manager_user_id.message}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Enter the registered UniVote user UUID to be designated as the Organisation Owner.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-border/60">
                <Button size="sm" type="submit" disabled={isCreating}>
                  {isCreating ? "Creating Organisation…" : "Create Organisation"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Dialog open={createConfirmOpen} onOpenChange={setCreateConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Direct Organisation Creation</DialogTitle>
            <DialogDescription>
              Review the organisation and initial management configuration before creating it.
            </DialogDescription>
          </DialogHeader>
          {pendingCreateValues && (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Organisation</span>
                <strong>{pendingCreateValues.name}</strong>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Type</span>
                <strong>{pendingCreateValues.organization_type}</strong>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                <strong>ACTIVE</strong>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Management</span>
                <strong>
                  {pendingCreateValues.management_mode === "RETAIN_PLATFORM_MANAGEMENT"
                    ? "Retain management"
                    : "Hand over to Organisation Owner"}
                </strong>
              </div>
              {pendingCreateValues.management_mode === "ASSIGN_OWNER" && (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Owner</span>
                  <strong>{ownerSearch || pendingCreateValues.manager_user_id}</strong>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreateConfirmOpen(false);
                setPendingCreateValues(null);
              }}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void confirmDirectCreate()} disabled={isCreating}>
              {isCreating ? "Creating…" : "Confirm & Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation Dialog */}
      <Dialog open={approveConfirmOpen} onOpenChange={setApproveConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-700" />
              <span>Approve Organisation Request</span>
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to approve <strong>{selectedRequest?.name}</strong>?
              An active organisation will be created and the requester will be assigned as Organisation Owner.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setApproveConfirmOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={isApproving} onClick={() => void onConfirmApprove()}>
              {isApproving ? "Approving…" : "Confirm Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Reason Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>Reject Organisation Request</span>
            </DialogTitle>
            <DialogDescription>
              Please provide a clear reason for rejecting the request for <strong>{selectedRequest?.name}</strong>.
              This feedback will be visible to the requester.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRejectSubmit(onConfirmReject)} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Rejection Reason <span className="text-destructive">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Explain why the charter could not be approved..."
                className="w-full rounded-md border border-input bg-card p-3 text-xs text-foreground shadow-subtle focus:outline-none focus:ring-1 focus:ring-destructive"
                {...registerReject("reason")}
              />
              {rejectErrors.reason && (
                <p className="text-[11px] text-destructive">{rejectErrors.reason.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" size="sm" type="button" onClick={() => setRejectModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" type="submit" disabled={isRejecting}>
                {isRejecting ? "Rejecting…" : "Confirm Rejection"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {(activeTab === "users" || activeTab === "audit" || activeTab === "settings") && (
        <PlatformAdminTools section={activeTab as PlatformAdminSection} />
      )}
      </div>
    </div>
  );
}
