import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuthContext } from "../auth/AuthContext";
import {
  getElection,
  approveElection,
  rejectElection,
  finalApproveElection,
  type ElectionDetail,
} from "../services/api";

export function ElectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuthContext();
  const rolePrefix = profile?.role === "SUPER_ADMIN" ? "/admin" : "/official";

  const [election, setElection] = useState<ElectionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Approval / Rejection form state
  const [officialComment, setOfficialComment] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchElectionData = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setErrorMsg("");
      const data = await getElection(id);
      setElection(data);
    } catch (err: any) {
      setErrorMsg(err?.detail || "Could not load election details.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchElectionData();
  }, [id]);

  const handleApprove = async () => {
    if (!id) return;
    setIsProcessing(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await approveElection(id, officialComment);
      setSuccessMsg("Your approval has been officially recorded!");
      setOfficialComment("");
      await fetchElectionData();
    } catch (err: any) {
      setErrorMsg(err?.detail || "Failed to record approval.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!id) return;
    if (!rejectionReason.trim()) {
      setErrorMsg("A rejection reason is required.");
      return;
    }
    setIsProcessing(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await rejectElection(id, rejectionReason);
      setSuccessMsg("Election rejected and returned to draft for corrections.");
      setShowRejectModal(false);
      setRejectionReason("");
      await fetchElectionData();
    } catch (err: any) {
      setErrorMsg(err?.detail || "Failed to reject election.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalApprove = async () => {
    if (!id) return;
    setIsProcessing(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await finalApproveElection(id);
      setSuccessMsg("Super Admin final approval granted! Election is now approved/scheduled.");
      await fetchElectionData();
    } catch (err: any) {
      setErrorMsg(err?.detail || "Failed to grant final approval.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "2rem" }}>
        <div style={{ height: "120px", background: "#f3f4f6", borderRadius: "8px", animation: "pulse 1.5s infinite" }} />
      </div>
    );
  }

  if (!election) {
    return (
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "2rem" }}>
        <div className="alert alert-error">Election not found.</div>
        <Link to={`${rolePrefix}/elections`} className="btn btn-secondary" style={{ marginTop: "1rem" }}>
          Back to Elections
        </Link>
      </div>
    );
  }

  // Check if current user is an assigned official
  const isAssignedOfficial = election.official_assignments.some(
    (a) => a.user_id === profile?.id || a.user?.id === profile?.id
  );

  const currentUserApproval = election.approvals.find(
    (apprv) => apprv.user_id === profile?.id
  );

  const allOfficialsApproved =
    election.official_assignments.length > 0 &&
    election.official_assignments.every((assignment) =>
      election.approvals.some(
        (apprv) =>
          apprv.user_id === assignment.user_id && apprv.approval_status === "APPROVED"
      )
    );

  const isSuperAdmin = profile?.role === "SUPER_ADMIN";
  const isPending = election.status === "PENDING_APPROVAL";

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", paddingBottom: "3rem" }}>
      {/* Breadcrumb Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#6b7280", fontSize: "0.875rem", marginBottom: "0.25rem" }}>
            <Link to={`${rolePrefix}/elections`} style={{ color: "#4f46e5", textDecoration: "none" }}>
              Elections
            </Link>
            <span>/</span>
            <span>{election.name}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>{election.name}</h2>
            <span
              style={{
                display: "inline-block",
                padding: "0.25rem 0.75rem",
                borderRadius: "1rem",
                fontSize: "0.8125rem",
                fontWeight: 600,
                backgroundColor: election.status === "APPROVED" || election.status === "SCHEDULED" ? "#dcfce7" : "#fef3c7",
                color: election.status === "APPROVED" || election.status === "SCHEDULED" ? "#166534" : "#92400e",
              }}
            >
              {election.status}
            </span>
          </div>
        </div>

        {election.status === "DRAFT" && (
          <Link to={`${rolePrefix}/elections/${election.id}/edit`} className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "1.125rem" }}>edit</span>
            Edit Configuration
          </Link>
        )}
      </div>

      {errorMsg && <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>{errorMsg}</div>}
      {successMsg && <div className="alert alert-success" style={{ marginBottom: "1.5rem" }}>{successMsg}</div>}

      {/* Grid Layout: Left Overview, Right Approval Tracker */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "1.5rem" }}>
        {/* Left Column: Configuration Overview */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Metadata Panel */}
          <div className="panel" style={{ padding: "1.25rem" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.125rem", borderBottom: "1px solid #f3f4f6", paddingBottom: "0.5rem" }}>
              General Information
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.875rem" }}>
              <div><strong>Department:</strong> {election.department}</div>
              <div><strong>Election Type:</strong> {election.election_type}</div>
              <div><strong>Visibility:</strong> {election.result_visibility}</div>
              <div><strong>Estimated Voters:</strong> {election.estimated_voters} students</div>
              <div><strong>Start Time:</strong> {election.start_at ? new Date(election.start_at).toLocaleString() : "Not set"}</div>
              <div><strong>End Time:</strong> {election.end_at ? new Date(election.end_at).toLocaleString() : "Not set"}</div>
            </div>
            {election.description && (
              <div style={{ marginTop: "1rem", fontSize: "0.875rem", color: "#4b5563" }}>
                <strong>Description:</strong>
                <p style={{ margin: "0.25rem 0 0 0", whiteSpace: "pre-line" }}>{election.description}</p>
              </div>
            )}
          </div>

          {/* Positions Panel */}
          <div className="panel" style={{ padding: "1.25rem" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.125rem", borderBottom: "1px solid #f3f4f6", paddingBottom: "0.5rem" }}>
              Configured Positions ({election.positions.length})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {election.positions.map((pos) => (
                <div
                  key={pos.id || pos.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.75rem",
                    background: "#f9fafb",
                    borderRadius: "6px",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#e0e7ff", color: "#3730a3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700 }}>
                      {pos.display_order}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#111827" }}>{pos.name}</div>
                      {pos.description && <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{pos.description}</div>}
                    </div>
                  </div>
                  <span style={{ fontSize: "0.75rem", background: "#f3f4f6", color: "#4b5563", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>
                    {pos.number_of_winners} {pos.number_of_winners === 1 ? "Winner" : "Winners"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Audit Logs */}
          <div className="panel" style={{ padding: "1.25rem" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.125rem", borderBottom: "1px solid #f3f4f6", paddingBottom: "0.5rem" }}>
              Audit Trail History
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {election.audit_logs.map((log) => (
                <div key={log.id} style={{ display: "flex", gap: "0.75rem", fontSize: "0.8125rem" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#6366f1", marginTop: "5px" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong style={{ color: "#374151" }}>{log.action}</strong>
                      <span style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ color: "#6b7280" }}>
                      By: {log.user_name || "System"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Approval Workflow & Action Tracker */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="panel" style={{ padding: "1.25rem" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.125rem", borderBottom: "1px solid #f3f4f6", paddingBottom: "0.5rem" }}>
              Approval Lifecycle Tracker
            </h3>

            {/* Official Approvals List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
                Assigned Election Officials ({election.approvals.length})
              </div>

              {election.approvals.map((apprv) => {
                const isApproved = apprv.approval_status === "APPROVED";
                const isRejected = apprv.approval_status === "REJECTED";
                return (
                  <div
                    key={apprv.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px",
                      padding: "0.75rem",
                      background: isApproved ? "#f0fdf4" : isRejected ? "#fef2f2" : "#f9fafb",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#111827" }}>
                          {apprv.user?.full_name || "Election Official"}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{apprv.user?.email}</div>
                      </div>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          padding: "0.15rem 0.5rem",
                          borderRadius: "4px",
                          backgroundColor: isApproved ? "#dcfce7" : isRejected ? "#fee2e2" : "#fef3c7",
                          color: isApproved ? "#166534" : isRejected ? "#991b1b" : "#92400e",
                        }}
                      >
                        {apprv.approval_status}
                      </span>
                    </div>
                    {apprv.comment && (
                      <div style={{ marginTop: "0.35rem", fontSize: "0.75rem", color: "#4b5563", fontStyle: "italic" }}>
                        "{apprv.comment}"
                      </div>
                    )}
                    {apprv.approved_at && (
                      <div style={{ fontSize: "0.6875rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                        Recorded: {new Date(apprv.approved_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Official Action Controls */}
            {isPending && isAssignedOfficial && currentUserApproval?.approval_status === "PENDING" && (
              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "1rem" }}>
                <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9375rem" }}>Official Review Decision</h4>
                <div className="form-group" style={{ marginBottom: "0.75rem" }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Approval comments (optional)..."
                    value={officialComment}
                    onChange={(e) => setOfficialComment(e.target.value)}
                    style={{ width: "100%", fontSize: "0.875rem" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={isProcessing}
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1, backgroundColor: "#10b981", borderColor: "#10b981" }}
                  >
                    Approve Election
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(true)}
                    disabled={isProcessing}
                    className="btn btn-secondary btn-sm"
                    style={{ color: "#dc2626" }}
                  >
                    Reject with Reason
                  </button>
                </div>
              </div>
            )}

            {/* Super Admin Final Approval Controls */}
            {isPending && isSuperAdmin && (
              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "1rem", marginTop: "1rem" }}>
                <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9375rem" }}>Super Admin Final Authority</h4>
                {allOfficialsApproved ? (
                  <div>
                    <p style={{ color: "#166534", fontSize: "0.8125rem", margin: "0 0 0.75rem 0" }}>
                      ✓ All assigned Election Officials have reviewed and approved. Ready for final authorization.
                    </p>
                    <button
                      type="button"
                      onClick={handleFinalApprove}
                      disabled={isProcessing}
                      className="btn btn-primary"
                      style={{ width: "100%", backgroundColor: "#4f46e5" }}
                    >
                      Grant Super Admin Final Approval
                    </button>
                  </div>
                ) : (
                  <div style={{ background: "#fef3c7", padding: "0.75rem", borderRadius: "6px", fontSize: "0.8125rem", color: "#92400e" }}>
                    Waiting on all assigned Election Officials to approve before final authorization can be granted.
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  disabled={isProcessing}
                  className="btn btn-secondary btn-sm"
                  style={{ width: "100%", marginTop: "0.5rem", color: "#dc2626" }}
                >
                  Admin Reject & Return to Draft
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div className="panel" style={{ width: "100%", maxWidth: "480px", padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 0.5rem 0", color: "#dc2626" }}>Reject Election</h3>
            <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "1rem" }}>
              Provide a clear reason for rejecting this configuration. The election will return to DRAFT status so the creator can address feedback.
            </p>

            <div className="form-group" style={{ marginBottom: "1.25rem" }}>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: "0.25rem", display: "block" }}>
                Rejection Reason <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="e.g. Schedule conflicts with exam period; please adjust dates."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="btn btn-secondary"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                className="btn btn-primary"
                disabled={isProcessing}
                style={{ backgroundColor: "#dc2626", borderColor: "#dc2626" }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
