import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Search,
  PlusCircle,
  ExternalLink,
  Globe,
  MapPin,
  Filter,
} from "lucide-react";

import { useDiscoverOrganizations } from "../hooks/useOrganizations";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Badge } from "../../../components/ui/badge";
import { EmptyState } from "../../../components/shared/EmptyState";
import { LoadingState } from "../../../components/shared/LoadingState";
import { Notice } from "../../../components/shared/Notice";

const ORG_TYPES: { label: string; value: string }[] = [
  { label: "All Types", value: "" },
  { label: "University", value: "UNIVERSITY" },
  { label: "Department", value: "DEPARTMENT" },
  { label: "Company", value: "COMPANY" },
  { label: "Association", value: "ASSOCIATION" },
  { label: "Club", value: "CLUB" },
  { label: "Other", value: "OTHER" },
];

export function DiscoverOrganizationsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("");

  const { data, isLoading, error, refetch } = useDiscoverOrganizations();

  // Client-side search and filtering over active/visible organisations
  const filteredOrganizations = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((org) => {
      // In discovery, only show active organisations unless super admin
      if (org.status !== "ACTIVE") return false;

      const matchesSearch =
        org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (org.description && org.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType = !selectedType || org.organization_type === selectedType;

      return matchesSearch && matchesType;
    });
  }, [data, searchTerm, selectedType]);

  return (
    <div className="space-y-6 animate-fade">
      <PageHeader
        title="Discover Organisations"
        description="Explore verified universities, faculties, departments, and registered bodies on UniVote."
        breadcrumbs={[
          { label: "Organisations", href: "/app/organizations" },
          { label: "Discover" },
        ]}
        actions={
          <Link to="/app/organizations/request">
            <Button size="sm" className="gap-1.5 text-xs">
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Request Organisation</span>
            </Button>
          </Link>
        }
      />

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by organisation name or country…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground hidden sm:inline" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-3 text-xs text-foreground shadow-subtle focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {ORG_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content Rendering */}
      {isLoading && <LoadingState label="Loading organisations directory…" />}

      {error && (
        <Notice variant="error" className="my-4">
          Failed to load organisations. {error instanceof Error ? error.message : "Please try again."}
          {" "}
          <button className="underline font-bold" onClick={() => void refetch()} type="button">
            Retry
          </button>
        </Notice>
      )}

      {!isLoading && !error && filteredOrganizations.length === 0 && (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="No organisations found"
          description={
            searchTerm || selectedType
              ? "No organisations match your search criteria. Try modifying your filters."
              : "No active organisations have been registered yet. You can submit an organisation request to establish one."
          }
          action={{
            label: "Request an Organisation",
            onClick: () => {
              window.location.href = "/app/organizations/request";
            },
          }}
        />
      )}

      {!isLoading && !error && filteredOrganizations.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredOrganizations.map((org) => (
            <Card key={org.id} className="flex flex-col justify-between transition-all hover:shadow-elevated">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {org.logo_url ? (
                      <img
                        src={org.logo_url}
                        alt={org.name}
                        className="h-9 w-9 rounded-md border border-border object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                        {org.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-sm text-foreground line-clamp-1">
                        {org.name}
                      </h3>
                      <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                        {org.organization_type}
                      </Badge>
                    </div>
                  </div>
                  <Badge variant="success" className="text-[10px]">
                    Active
                  </Badge>
                </div>

                {org.description ? (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {org.description}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/60 italic">
                    No description provided.
                  </p>
                )}

                <div className="space-y-1 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span>{org.country}</span>
                  </div>
                  {org.website && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Globe className="h-3 w-3 shrink-0" />
                      <a
                        href={org.website}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate hover:underline text-foreground"
                      >
                        {org.website.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>

              <div className="border-t border-border/60 bg-muted/20 px-5 py-2.5 flex items-center justify-between text-xs">
                <span className="text-[11px] text-muted-foreground">
                  {org.membership_policy.membership_requires_invitation
                    ? "Invitation required"
                    : org.membership_policy.membership_requires_approval
                      ? "Approval required"
                      : "Direct joining"}
                </span>
                <Link
                  to={`/app/organizations/${org.id}`}
                  className="font-medium text-primary hover:underline flex items-center gap-1"
                >
                  Details <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
