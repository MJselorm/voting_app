import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthContext } from "../auth/AuthContext";
import { listElections, type ElectionListItem, type ElectionStatus } from "../services/api";

const STATUS_CONFIG: Record<
  ElectionStatus,
  { label: string; bg: string; color: string; badgeClass: string }
> = {
  DRAFT: { label: "Draft", bg: "#f3f4f6", color: "#4b5563", badgeClass: "badge-draft" },
  PENDING_APPROVAL: { label: "Pending Approval", bg: "#fef3c7", color: "#92400e", badgeClass: "badge-pending" },
  OFFICIAL_REVIEW: { label: "Official Review", bg: "#e0e7ff", color: "#3730a3", badgeClass: "badge-review" },
  SUPER_ADMIN_FINAL_APPROVAL: { label: "Admin Review", bg: "#ede9fe", color: "#5b21b6", badgeClass: "badge-admin" },
  APPROVED: { label: "Approved", bg: "#dcfce7", color: "#166534", badgeClass: "badge-approved" },
  SCHEDULED: { label: "Scheduled", bg: "#dbeafe", color: "#1e40af", badgeClass: "badge-scheduled" },
  LIVE: { label: "Live", bg: "#fee2e2", color: "#991b1b", badgeClass: "badge-live" },
  ENDED: { label: "Ended", bg: "#f3f4f6", color: "#6b7280", badgeClass: "badge-ended" },
  CANCELLED: { label: "Cancelled", bg: "#fef2f2", color: "#b91c1c", badgeClass: "badge-cancelled" },
};

export function ElectionsPage() {
  const { profile } = useAuthContext();
  const navigate = useNavigate();
  const [elections, setElections] = useState<ElectionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const rolePrefix = profile?.role === "SUPER_ADMIN" ? "/admin" : "/official";

  const fetchElections = async () => {
    try {
      setIsLoading(true);
      setError("");
      const data = await listElections();
      setElections(data);
    } catch (err: any) {
      setError(err?.detail || "Could not load elections list.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchElections();
  }, []);

  const filteredElections = elections.filter((e) => {
    const matchesStatus = filterStatus === "ALL" || e.status === filterStatus;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q) ||
      e.election_type.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return "Not configured";
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="elections-page-container">
      {/* Header bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>Elections Management</h2>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0 0", fontSize: "0.875rem" }}>
            Create, configure, and manage election lifecycles across departments.
          </p>
        </div>
        <Link
          to={`${rolePrefix}/elections/create`}
          className="btn btn-primary"
          style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 1.25rem" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "1.125rem" }}>add</span>
          Create Election
        </Link>
      </div>

      {/* Filter and search toolbar */}
      <div className="panel" style={{ marginBottom: "1.5rem", padding: "1rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {["ALL", "DRAFT", "PENDING_APPROVAL", "APPROVED", "SCHEDULED", "LIVE", "ENDED"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`btn btn-sm ${filterStatus === st ? "btn-primary" : "btn-secondary"}`}
                style={{ borderRadius: "2rem", textTransform: "capitalize", fontSize: "0.8125rem", padding: "0.35rem 0.85rem" }}
              >
                {st === "ALL" ? "All Elections" : STATUS_CONFIG[st as ElectionStatus]?.label || st}
              </button>
            ))}
          </div>

          <div style={{ minWidth: "240px", flex: "1", maxWidth: "360px" }}>
            <input
              type="search"
              className="form-input"
              placeholder="Search by election name or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", margin: 0, padding: "0.5rem 0.75rem", fontSize: "0.875rem" }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>
          {error}
        </div>
      )}

      {/* Main List */}
      {isLoading ? (
        <div className="panel" style={{ padding: "2rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[1, 2, 3].map((n) => (
              <div key={n} style={{ height: "70px", background: "#f3f4f6", borderRadius: "8px", animation: "pulse 1.5s infinite" }} />
            ))}
          </div>
        </div>
      ) : filteredElections.length === 0 ? (
        <div className="panel" style={{ padding: "3rem", textAlign: "center" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "3rem", color: "#9ca3af", marginBottom: "0.5rem" }}>
            how_to_vote
          </span>
          <h3 style={{ margin: "0.5rem 0 0.25rem 0", color: "#374151" }}>No elections found</h3>
          <p style={{ color: "#6b7280", fontSize: "0.875rem", maxWidth: "400px", margin: "0.25rem auto 1.5rem auto" }}>
            {searchQuery || filterStatus !== "ALL"
              ? "No elections match your current search or status filter."
              : "Get started by creating your first election."}
          </p>
          <Link to={`${rolePrefix}/elections/create`} className="btn btn-primary">
            Create Election
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {filteredElections.map((election) => {
            const statusMeta = STATUS_CONFIG[election.status] || STATUS_CONFIG.DRAFT;
            return (
              <article
                key={election.id}
                className="panel"
                style={{
                  padding: "1.25rem 1.5rem",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  transition: "box-shadow 0.15s ease",
                }}
              >
                {/* Left info */}
                <div style={{ flex: "1 1 340px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.35rem" }}>
                    <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600, color: "#111827" }}>
                      {election.name}
                    </h3>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.2rem 0.6rem",
                        borderRadius: "1rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        backgroundColor: statusMeta.bg,
                        color: statusMeta.color,
                      }}
                    >
                      {statusMeta.label}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", color: "#6b7280", fontSize: "0.8125rem", marginTop: "0.25rem" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1rem", color: "#9ca3af" }}>domain</span>
                      {election.department}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1rem", color: "#9ca3af" }}>category</span>
                      {election.election_type}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1rem", color: "#9ca3af" }}>badge</span>
                      {election.positions_count} {election.positions_count === 1 ? "Position" : "Positions"}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "1rem", color: "#9ca3af" }}>group</span>
                      {election.officials_count} {election.officials_count === 1 ? "Official" : "Officials"}
                    </span>
                  </div>

                  <div style={{ color: "#9ca3af", fontSize: "0.75rem", marginTop: "0.35rem" }}>
                    Schedule: {formatDate(election.start_at)} — {formatDate(election.end_at)}
                  </div>
                </div>

                {/* Right Action buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {election.status === "DRAFT" && (
                    <>
                      <button
                        type="button"
                        onClick={() => navigate(`${rolePrefix}/elections/${election.id}/edit`)}
                        className="btn btn-primary btn-sm"
                        style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>edit</span>
                        Resume Draft
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`${rolePrefix}/elections/${election.id}`)}
                        className="btn btn-secondary btn-sm"
                      >
                        View
                      </button>
                    </>
                  )}

                  {election.status === "PENDING_APPROVAL" && (
                    <>
                      <button
                        type="button"
                        onClick={() => navigate(`${rolePrefix}/elections/${election.id}`)}
                        className="btn btn-primary btn-sm"
                        style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>fact_check</span>
                        Review & Approvals
                      </button>
                    </>
                  )}

                  {election.status === "APPROVED" && (
                    <button
                      type="button"
                      onClick={() => navigate(`${rolePrefix}/elections/${election.id}`)}
                      className="btn btn-secondary btn-sm"
                    >
                      View Configuration
                    </button>
                  )}

                  {election.status === "SCHEDULED" && (
                    <button
                      type="button"
                      onClick={() => navigate(`${rolePrefix}/elections/${election.id}`)}
                      className="btn btn-secondary btn-sm"
                    >
                      Scheduled Details
                    </button>
                  )}

                  {election.status === "LIVE" && (
                    <button
                      type="button"
                      onClick={() => navigate(`${rolePrefix}/elections/${election.id}`)}
                      className="btn btn-primary btn-sm"
                      style={{ backgroundColor: "#dc2626", borderColor: "#dc2626" }}
                    >
                      Monitor Election
                    </button>
                  )}

                  {election.status === "ENDED" && (
                    <button
                      type="button"
                      onClick={() => navigate(`${rolePrefix}/elections/${election.id}`)}
                      className="btn btn-secondary btn-sm"
                    >
                      View Results
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
