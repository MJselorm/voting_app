import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  PlusCircle,
  AlertCircle,
} from "lucide-react";

import { useMyOrganizationRequests } from "../hooks/useOrganizations";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { EmptyState } from "../../../components/shared/EmptyState";
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
import type { OrganizationRequestResponse } from "../types/organization";

export function OrganizationRequestsTrackingPage() {
  const { data, isLoading, error, refetch } = useMyOrganizationRequests();
  const [selectedRequest, setSelectedRequest] = useState<OrganizationRequestResponse | null>(null);

  const requests = data?.items ?? [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge variant="success" className="gap-1 text-[11px]">
            <CheckCircle2 className="h-3 w-3" /> Approved
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge variant="destructive" className="gap-1 text-[11px]">
            <XCircle className="h-3 w-3" /> Rejected
          </Badge>
        );
      case "PENDING_APPROVAL":
      default:
        return (
          <Badge variant="warning" className="gap-1 text-[11px]">
            <Clock className="h-3 w-3" /> Pending Review
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade">
      <PageHeader
        title="Organisation Requests Tracking"
        description="Monitor status, review outcomes, and administrative feedback for your submitted organisation requests."
        breadcrumbs={[
          { label: "Organisations", href: "/app/organizations" },
          { label: "Requests" },
        ]}
        actions={
          <Link to="/app/organizations/request">
            <Button size="sm" className="gap-1.5 text-xs">
              <PlusCircle className="h-3.5 w-3.5" />
              <span>New Request</span>
            </Button>
          </Link>
        }
      />

      {isLoading && <LoadingState label="Loading your requests…" />}

      {error && (
        <Notice variant="error" className="my-4">
          Could not load requests. {error instanceof Error ? error.message : ""}
          {" "}
          <button className="underline font-bold" onClick={() => void refetch()} type="button">
            Retry
          </button>
        </Notice>
      )}

      {!isLoading && !error && requests.length === 0 && (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No requests submitted"
          description="You have not submitted any organisation establishment requests yet."
          action={{
            label: "Request an Organisation",
            onClick: () => {
              window.location.href = "/app/organizations/request";
            },
          }}
        />
      )}

      {!isLoading && !error && requests.length > 0 && (
        <div className="space-y-3">
          {requests.map((req) => (
            <Card
              key={req.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 gap-4 transition-all hover:border-foreground/20"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h3 className="font-semibold text-sm text-foreground">
                    {req.name}
                  </h3>
                  <Badge variant="outline" className="text-[10px]">
                    {req.organization_type}
                  </Badge>
                  {getStatusBadge(req.status)}
                </div>

                <p className="text-xs text-muted-foreground line-clamp-1">
                  Country: {req.country} • Submitted: {new Date(req.created_at).toLocaleDateString()}
                </p>

                {req.status === "REJECTED" && req.rejection_reason && (
                  <p className="text-xs text-destructive flex items-center gap-1.5 mt-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Reason: {req.rejection_reason}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => setSelectedRequest(req)}
                >
                  View Details
                </Button>
                {req.status === "APPROVED" && req.organization_id && (
                  <Link to={`/app/organizations/${req.organization_id}`}>
                    <Button size="sm" variant="default" className="text-xs gap-1">
                      <span>Organisation</span>
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={Boolean(selectedRequest)} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        {selectedRequest && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedRequest.name}</DialogTitle>
              <DialogDescription>
                Request submission details and review metadata.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-2 border-b border-border/50 pb-2">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Type</span>
                  <span className="font-semibold">{selectedRequest.organization_type}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Status</span>
                  <div>{getStatusBadge(selectedRequest.status)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Country</span>
                  <span className="font-semibold">{selectedRequest.country}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Submitted</span>
                  <span className="font-semibold">
                    {new Date(selectedRequest.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {selectedRequest.description && (
                <div>
                  <span className="text-muted-foreground block text-[11px] mb-0.5">Description</span>
                  <p className="text-foreground leading-relaxed bg-muted/30 p-2.5 rounded-md">
                    {selectedRequest.description}
                  </p>
                </div>
              )}

              {selectedRequest.contact_email && (
                <div>
                  <span className="text-muted-foreground block text-[11px]">Contact Email</span>
                  <span className="font-mono">{selectedRequest.contact_email}</span>
                </div>
              )}

              {selectedRequest.website && (
                <div>
                  <span className="text-muted-foreground block text-[11px]">Website</span>
                  <a
                    href={selectedRequest.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {selectedRequest.website}
                  </a>
                </div>
              )}

              {selectedRequest.supporting_information && (
                <div>
                  <span className="text-muted-foreground block text-[11px] mb-0.5">Supporting Notes</span>
                  <p className="text-foreground text-[11px] bg-muted/40 p-2.5 rounded-md whitespace-pre-wrap leading-relaxed">
                    {selectedRequest.supporting_information}
                  </p>
                </div>
              )}

              {selectedRequest.status === "REJECTED" && (
                <div className="border border-destructive/20 bg-destructive/10 p-3 rounded-md text-destructive space-y-1">
                  <span className="font-bold text-[11px] block">Rejection Feedback</span>
                  <p>{selectedRequest.rejection_reason || "No explicit reason was provided."}</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button size="sm" variant="outline" onClick={() => setSelectedRequest(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
