import { Link } from "react-router-dom";
import {
  Building2,
  Compass,
  FileText,
  PlusCircle,
  Shield,
  ArrowRight,
  CheckCircle2,
  BadgeCheck,
  User,
} from "lucide-react";

import { useUserProfile } from "../features/auth/hooks/useUserProfile";
import { useMyOrganizationRequests, useAdminOrganizations } from "../features/organizations/hooks/useOrganizations";
import { PageHeader } from "../components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";

export function DashboardPreviewPage() {
  const { data: profile } = useUserProfile();
  const { data: myRequestsData } = useMyOrganizationRequests();
  const { data: orgsData } = useAdminOrganizations();

  const myRequests = myRequestsData?.items ?? [];
  const pendingCount = myRequests.filter((r) => r.status === "PENDING_APPROVAL").length;
  const approvedCount = myRequests.filter((r) => r.status === "APPROVED").length;

  const activeOrgs = (orgsData?.items ?? []).filter((o) => o.status === "ACTIVE");

  return (
    <div className="space-y-8 animate-fade">
      {/* 1. Page Header */}
      <PageHeader
        title={`Welcome back, ${profile?.full_name ?? "Member"}`}
        description="UniVote multi-tenant governance platform. Discover registered organisations, track your institutional requests, and manage your account."
        badge={
          <Badge variant="success" className="gap-1.5 text-xs">
            <BadgeCheck className="h-3.5 w-3.5" />
            Active Session
          </Badge>
        }
        actions={
          <div className="flex gap-2">
            <Link to="/app/organizations">
              <Button size="sm" variant="outline" className="text-xs gap-1.5">
                <Compass className="h-3.5 w-3.5" />
                <span>Discover</span>
              </Button>
            </Link>
            <Link to="/app/organizations/request">
              <Button size="sm" className="gap-1.5 text-xs">
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Request Organisation</span>
              </Button>
            </Link>
          </div>
        }
      />

      {/* 2. Account Status Summary Card */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-xs font-medium text-muted-foreground">My Profile Status</span>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold text-foreground truncate">
              {profile?.email ?? "Synchronized"}
            </div>
            <p className="mt-1 text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Email Verified & Neon Synced
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-xs font-medium text-muted-foreground">My Submitted Requests</span>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{myRequests.length}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {pendingCount} pending review • {approvedCount} approved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-xs font-medium text-muted-foreground">Active Organisations</span>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{activeOrgs.length}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Verified in the global directory
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-xs font-medium text-muted-foreground">Platform Role</span>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold text-foreground">
              {(profile as any)?.is_platform_super_admin ? "Platform Super Admin" : "Registered Member"}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Institutional Governance Access
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Real Active Organisations Overview */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Organisation Management Hub</CardTitle>
              <CardDescription>
                Direct access to institutional features and chartered entities.
              </CardDescription>
            </div>
            <Link to="/app/organizations">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                Explore <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/app/organizations" className="block">
              <div className="flex items-center justify-between rounded-md border border-border p-3 text-xs transition-colors hover:bg-muted">
                <div>
                  <p className="font-semibold text-foreground">Discover Organisations</p>
                  <p className="text-[11px] text-muted-foreground">
                    Search and inspect verified universities and faculties
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>

            <Link to="/app/organizations/mine" className="block">
              <div className="flex items-center justify-between rounded-md border border-border p-3 text-xs transition-colors hover:bg-muted">
                <div>
                  <p className="font-semibold text-foreground">My Organisations</p>
                  <p className="text-[11px] text-muted-foreground">
                    Entities you have founded or manage
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>

            <Link to="/app/organizations/requests" className="block">
              <div className="flex items-center justify-between rounded-md border border-border p-3 text-xs transition-colors hover:bg-muted">
                <div>
                  <p className="font-semibold text-foreground">Track Organisation Requests</p>
                  <p className="text-[11px] text-muted-foreground">
                    View administrative decisions and feedback
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          </CardContent>
        </Card>

        {/* 4. Recent Requests Tracker */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>My Recent Charter Requests</CardTitle>
              <CardDescription>
                Live status from the FastAPI backend.
              </CardDescription>
            </div>
            <Link to="/app/organizations/requests">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {myRequests.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <p className="mb-3">You have not submitted any organisation requests yet.</p>
                <Link to="/app/organizations/request">
                  <Button size="sm" variant="outline" className="text-xs">
                    Submit First Request
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {myRequests.slice(0, 3).map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between border-b border-border/50 pb-2.5 text-xs last:border-0"
                  >
                    <div>
                      <p className="font-semibold text-foreground">{req.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {req.organization_type} • {req.country}
                      </p>
                    </div>
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
