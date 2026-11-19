import { Link } from "react-router-dom";
import { Building2, ExternalLink, MapPin } from "lucide-react";

import { useMyMemberships } from "../hooks/useOrganizations";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { EmptyState } from "../../../components/shared/EmptyState";
import { LoadingState } from "../../../components/shared/LoadingState";
import { Notice } from "../../../components/shared/Notice";

export function MyOrganizationsPage() {
  const { data, isLoading, error, refetch } = useMyMemberships();
  const memberships = data?.items ?? [];

  return (
    <div className="space-y-6 animate-fade">
      <PageHeader
        title="My Organisations"
        description="Organisations where you hold an active membership."
        breadcrumbs={[
          { label: "Organisations", href: "/app/organizations" },
          { label: "My Organisations" },
        ]}
        actions={
          <Link to="/app/organizations">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              Discover Organisations
            </Button>
          </Link>
        }
      />

      {isLoading && <LoadingState label="Loading your memberships…" />}

      {error && (
        <Notice variant="error" className="my-4">
          Could not load your organisations. {error instanceof Error ? error.message : ""}
          <button className="underline font-bold ml-1" onClick={() => void refetch()} type="button">
            Retry
          </button>
        </Notice>
      )}

      {!isLoading && !error && memberships.length === 0 && (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="No active memberships"
          description="Request membership from an organisation in the discovery directory."
        />
      )}

      {!isLoading && !error && memberships.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memberships.map((membership) => (
            <Card key={membership.id} className="flex flex-col justify-between">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">
                      {membership.organization_name ?? "Organisation"}
                    </h3>
                    {membership.organization_type && (
                      <Badge variant="outline" className="mt-1 text-[10px]">
                        {membership.organization_type}
                      </Badge>
                    )}
                  </div>
                  <Badge variant="success" className="text-[10px]">
                    {membership.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {membership.role}
                  </span>
                  <span>Joined {new Date(membership.joined_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
              <div className="border-t border-border/60 px-5 py-2.5 text-right">
                <Link
                  to={`/app/organizations/${membership.organization_id}`}
                  className="font-medium text-primary hover:underline text-xs"
                >
                  Open Organisation <ExternalLink className="inline h-3 w-3" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
