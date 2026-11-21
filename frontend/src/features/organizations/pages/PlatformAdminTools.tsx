import { useState, type FormEvent } from "react";
import { Building2, RefreshCw, Search, Shield, UserRound, X } from "lucide-react";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { EmptyState } from "../../../components/shared/EmptyState";
import { LoadingState } from "../../../components/shared/LoadingState";
import { Notice } from "../../../components/shared/Notice";
import {
  useAdminOrganizations,
  useAdminUsers,
  useAssignOrganizationAdminRole,
  useAssignPlatformSuperAdminRole,
  usePlatformAudit,
  usePlatformSettings,
  usePlatformUserRoles,
  useRevokeRoleAssignment,
  useUpdatePlatformSetting,
} from "../hooks/useOrganizations";
import type {
  AuditLogEntry,
  PlatformSetting,
  PlatformUserSummary,
  RoleAssignment,
} from "../types/organization";

export type PlatformAdminSection = "users" | "audit" | "settings";

export function PlatformAdminTools({ section }: { section: PlatformAdminSection }) {
  if (section === "users") return <UsersAndRolesPanel />;
  if (section === "audit") return <AuditPanel />;
  return <SettingsPanel />;
}

type PendingAction =
  | { kind: "grant-platform-role"; user: PlatformUserSummary }
  | { kind: "revoke-role"; user: PlatformUserSummary; assignment: RoleAssignment };

function UsersAndRolesPanel() {
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<PlatformUserSummary | null>(null);
  const [organizationId, setOrganizationId] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: userData,
    isLoading: usersLoading,
    error: usersError,
  } = useAdminUsers(search);
  const { data: organizationData, error: organizationsError } = useAdminOrganizations();
  const {
    data: roles,
    isLoading: rolesLoading,
    error: rolesError,
    refetch: refetchRoles,
  } = usePlatformUserRoles(selectedUser?.id ?? "");
  const assignOrganizationRole = useAssignOrganizationAdminRole();
  const assignPlatformRole = useAssignPlatformSuperAdminRole();
  const revokeAssignment = useRevokeRoleAssignment();
  const isActing =
    assignOrganizationRole.isPending ||
    assignPlatformRole.isPending ||
    revokeAssignment.isPending;

  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchText.trim());
    setSelectedUser(null);
    setActionError(null);
  };

  const onAssignOrganizationAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedUser || !organizationId) return;
    setActionError(null);
    try {
      await assignOrganizationRole.mutateAsync({
        organizationId,
        userId: selectedUser.id,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not assign the organisation admin role.");
    }
  };

  const onConfirmAction = async () => {
    if (!pendingAction) return;
    setActionError(null);
    try {
      if (pendingAction.kind === "grant-platform-role") {
        await assignPlatformRole.mutateAsync(pendingAction.user.id);
        setSelectedUser((current) =>
          current?.id === pendingAction.user.id
            ? { ...current, is_platform_super_admin: true }
            : current,
        );
      } else {
        await revokeAssignment.mutateAsync({
          assignmentId: pendingAction.assignment.id,
          userId: pendingAction.user.id,
        });
        if (pendingAction.assignment.role === "PLATFORM_SUPER_ADMIN") {
          setSelectedUser((current) =>
            current?.id === pendingAction.user.id
              ? { ...current, is_platform_super_admin: false }
              : current,
          );
        }
      }
      setPendingAction(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The access change failed.");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Find a platform user</CardTitle>
          <CardDescription>
            Search by name or email to inspect active roles and manage access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSearch} className="flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="Search users by name or email"
              placeholder="Type a name or email"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            <Button type="submit" className="shrink-0">
              <Search className="h-4 w-4" />
              Search users
            </Button>
          </form>
          {usersError && (
            <Notice variant="error" className="mt-4">
              {usersError instanceof Error ? usersError.message : "Could not load users."}
            </Notice>
          )}
          {search && !usersLoading && !usersError && (userData?.items.length ?? 0) === 0 && (
            <EmptyState
              icon={<UserRound className="h-5 w-5" />}
              title="No active users found"
              description="Try a different name or email address."
              className="mt-4"
            />
          )}
          {search && usersLoading && <LoadingState label="Searching users…" />}
          {(userData?.items.length ?? 0) > 0 && (
            <div className="mt-4 divide-y divide-border rounded-md border border-border">
              {userData?.items.map((user) => (
                <button
                  type="button"
                  key={user.id}
                  aria-pressed={selectedUser?.id === user.id}
                  onClick={() => {
                    setSelectedUser(user);
                    setActionError(null);
                  }}
                  className={`flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-muted/60 ${
                    selectedUser?.id === user.id ? "bg-primary/5" : ""
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{user.full_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                  </span>
                  {user.is_platform_super_admin && (
                    <Badge variant="outline" className="shrink-0">Super admin</Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedUser && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">{selectedUser.full_name}</CardTitle>
              <CardDescription>{selectedUser.email}</CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void refetchRoles()}
              aria-label="Refresh user roles"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            {actionError && <Notice variant="error">{actionError}</Notice>}
            {organizationsError && (
              <Notice variant="error">
                {organizationsError instanceof Error
                  ? organizationsError.message
                  : "Could not load organisations."}
              </Notice>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Platform Super Admin</p>
                <p className="text-xs text-muted-foreground">
                  Grants full access to platform-wide administration.
                </p>
              </div>
              {selectedUser.is_platform_super_admin ? (
                <Badge variant="success">Assigned</Badge>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={isActing}
                  onClick={() => setPendingAction({ kind: "grant-platform-role", user: selectedUser })}
                >
                  <Shield className="h-4 w-4" />
                  Grant platform access
                </Button>
              )}
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Active role assignments</h3>
                  <p className="text-xs text-muted-foreground">
                    Owner roles are managed through the organisation handover workflow.
                  </p>
                </div>
              </div>
              {rolesLoading && <LoadingState label="Loading roles…" />}
              {rolesError && (
                <Notice variant="error">
                  {rolesError instanceof Error ? rolesError.message : "Could not load user roles."}
                </Notice>
              )}
              {!rolesLoading && !rolesError && (roles?.length ?? 0) === 0 && (
                <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  No active role assignments.
                </p>
              )}
              {(roles?.length ?? 0) > 0 && (
                <div className="divide-y divide-border rounded-md border border-border">
                  {roles?.map((role) => {
                    const organization = organizationData?.items.find(
                      (item) => item.id === role.organization_id,
                    );
                    return (
                      <div
                        key={role.id}
                        className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {role.role.replaceAll("_", " ")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {role.organization_id
                              ? organization?.name ?? `Organisation ${role.organization_id.slice(0, 8)}`
                              : "Platform-wide"}
                            {" · "}Assigned {new Date(role.assigned_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isActing}
                          onClick={() =>
                            setPendingAction({
                              kind: "revoke-role",
                              user: selectedUser,
                              assignment: role,
                            })
                          }
                        >
                          <X className="h-3.5 w-3.5" />
                          Revoke
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <form
              onSubmit={(event) => void onAssignOrganizationAdmin(event)}
              className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[1fr_auto]"
            >
              <label className="space-y-1">
                <span className="block text-sm font-medium">Assign organisation admin</span>
                <select
                  aria-label="Organisation for admin role"
                  value={organizationId}
                  onChange={(event) => setOrganizationId(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground"
                  required
                >
                  <option value="">Choose an organisation</option>
                  {organizationData?.items.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name} · {organization.status}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!organizationId || isActing || rolesLoading}
                >
                  <Building2 className="h-4 w-4" />
                  Assign admin
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open && !isActing) setPendingAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.kind === "grant-platform-role"
                ? "Grant Platform Super Admin access?"
                : "Revoke this role assignment?"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.kind === "grant-platform-role"
                ? `${pendingAction.user.full_name} will receive full platform administration access.`
                : `${pendingAction?.user.full_name} will lose the ${pendingAction?.assignment.role.replaceAll("_", " ")} role.`}
            </DialogDescription>
          </DialogHeader>
          {actionError && <Notice variant="error">{actionError}</Notice>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isActing}
              onClick={() => setPendingAction(null)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={isActing} onClick={() => void onConfirmAction()}>
              {isActing ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AuditPanel() {
  const [actionText, setActionText] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const { data, isLoading, error, refetch } = usePlatformAudit(actionFilter || undefined);

  const onFilter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionFilter(actionText.trim());
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle className="text-base">Platform audit log</CardTitle>
          <CardDescription>Latest platform and organisation administration actions.</CardDescription>
        </div>
        <div className="flex gap-2">
          <form onSubmit={onFilter} className="flex gap-2">
            <Input
              aria-label="Filter audit log by exact action"
              placeholder="Filter by action"
              value={actionText}
              onChange={(event) => setActionText(event.target.value)}
            />
            <Button type="submit" size="sm" variant="outline">Filter</Button>
          </form>
          <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Notice variant="error">
            {error instanceof Error ? error.message : "Could not load the audit log."}
          </Notice>
        )}
        {isLoading && <LoadingState label="Loading audit history…" />}
        {!isLoading && !error && (data?.items.length ?? 0) === 0 && (
          <EmptyState
            icon={<RefreshCw className="h-5 w-5" />}
            title="No audit entries"
            description="No records match this action filter."
          />
        )}
        {(data?.items.length ?? 0) > 0 && (
          <div className="space-y-3">
            {data?.items.map((entry) => <AuditEntry key={entry.id} entry={entry} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AuditEntry({ entry }: { entry: AuditLogEntry }) {
  return (
    <details className="rounded-md border border-border p-3">
      <summary className="flex cursor-pointer list-none flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{entry.action.replaceAll("_", " ")}</Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(entry.created_at).toLocaleString()}
          </span>
        </span>
        <span className="text-xs text-muted-foreground">
          {entry.organization_id
            ? `Organisation ${entry.organization_id.slice(0, 8)}`
            : "Platform-wide"}
        </span>
      </summary>
      <div className="mt-3 space-y-2 border-t border-border pt-3 text-xs">
        <p><span className="font-medium">Actor:</span> {entry.actor_user_id ?? "System"}</p>
        {entry.request_id && <p><span className="font-medium">Request:</span> {entry.request_id}</p>}
        <pre className="overflow-x-auto rounded bg-muted/50 p-3 text-[11px]">
          {JSON.stringify(entry.details, null, 2)}
        </pre>
      </div>
    </details>
  );
}

function SettingsPanel() {
  const { data, isLoading, error, refetch } = usePlatformSettings();
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const updateSetting = useUpdatePlatformSetting();

  const onSave = async (key: string, value: string, description: string) => {
    setActionError(null);
    setSuccess(null);
    try {
      await updateSetting.mutateAsync({
        key,
        data: { value, description: description.trim() || null },
      });
      setSuccess(`Saved "${key}".`);
      return true;
    } catch (saveError) {
      setActionError(saveError instanceof Error ? saveError.message : "Could not save this setting.");
      return false;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Platform settings</CardTitle>
            <CardDescription>
              Edit the key-value settings exposed by the platform API.
            </CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {actionError && <Notice variant="error">{actionError}</Notice>}
          {success && <Notice variant="success">{success}</Notice>}
          {error && (
            <Notice variant="error">
              {error instanceof Error ? error.message : "Could not load platform settings."}
            </Notice>
          )}
          {isLoading && <LoadingState label="Loading platform settings…" />}
          {!isLoading && !error && (data?.items.length ?? 0) === 0 && (
            <EmptyState
              icon={<RefreshCw className="h-5 w-5" />}
              title="No settings configured"
              description="Add a key and value below to create the first platform setting."
            />
          )}
          {data?.items.map((setting) => (
            <SettingEditor
              key={`${setting.key}-${setting.updated_at}`}
              setting={setting}
              disabled={updateSetting.isPending}
              onSave={onSave}
            />
          ))}
        </CardContent>
      </Card>
      <NewSettingForm disabled={updateSetting.isPending} onSave={onSave} />
    </div>
  );
}

function SettingEditor({
  setting,
  disabled,
  onSave,
}: {
  setting: PlatformSetting;
  disabled: boolean;
  onSave: (key: string, value: string, description: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState(setting.value);
  const [description, setDescription] = useState(setting.description ?? "");

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSave(setting.key, value, description);
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <code className="text-sm font-semibold">{setting.key}</code>
        <span className="text-[11px] text-muted-foreground">
          Updated {new Date(setting.updated_at).toLocaleString()}
        </span>
      </div>
      <label className="space-y-1">
        <span className="block text-xs font-medium">Value</span>
        <textarea
          rows={2}
          required
          maxLength={4000}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="w-full rounded-md border border-input bg-card p-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </label>
      <label className="space-y-1">
        <span className="block text-xs font-medium">Description</span>
        <Input
          maxLength={255}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={disabled || !value.trim()}>
          Save setting
        </Button>
      </div>
    </form>
  );
}

function NewSettingForm({
  disabled,
  onSave,
}: {
  disabled: boolean;
  onSave: (key: string, value: string, description: string) => Promise<boolean>;
}) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (await onSave(key.trim(), value, description)) {
      setKey("");
      setValue("");
      setDescription("");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add or update a setting</CardTitle>
        <CardDescription>
          Saving an existing key updates its value and description.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void onSubmit(event)} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="block text-xs font-medium">Key</span>
              <Input
                required
                maxLength={100}
                value={key}
                onChange={(event) => setKey(event.target.value)}
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs font-medium">Value</span>
              <Input
                required
                maxLength={4000}
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="block text-xs font-medium">Description (optional)</span>
            <Input
              maxLength={255}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={disabled || !key.trim() || !value.trim()}>
              Save setting
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
