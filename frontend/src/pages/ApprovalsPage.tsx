import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  adminFinalApproveElection,
  adminRejectElection,
  getApprovalsOverview,
  type ApprovalElection,
  type ApprovalsOverview,
} from "../services/api";

const emptyOverview: ApprovalsOverview = {
  ready_for_final_approval: [], under_official_review: [], recently_approved: [], rejected: [],
  counts: { ready: 0, in_review: 0, approved: 0, rejected: 0, total_active: 0 },
};

export function ApprovalsPage() {
  const [overview, setOverview] = useState<ApprovalsOverview>(emptyOverview);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError("");
    try { setOverview(await getApprovalsOverview()); }
    catch (err: any) { setError(err?.detail || err?.message || "Could not load approval requests."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const approve = async (election: ApprovalElection) => {
    setActionId(election.id); setError("");
    try { await adminFinalApproveElection(election.id); await load(); }
    catch (err: any) { setError(err?.detail || "Final approval could not be recorded."); }
    finally { setActionId(null); }
  };
  const reject = async (election: ApprovalElection) => {
    const reason = window.prompt(`Why are you returning “${election.name}” to draft?`);
    if (!reason?.trim()) return;
    setActionId(election.id); setError("");
    try { await adminRejectElection(election.id, reason.trim()); await load(); }
    catch (err: any) { setError(err?.detail || "The election could not be rejected."); }
    finally { setActionId(null); }
  };

  return <div className="elections-page-container">
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "start", marginBottom: "1.5rem" }}>
      <div><h2 style={{ margin: 0 }}>Approval Centre</h2><p style={{ color: "#6b7280", margin: "0.35rem 0 0" }}>Review election requests, track official feedback, and grant final authorization.</p></div>
      <button className="btn btn-secondary" onClick={() => void load()} disabled={loading}>Refresh</button>
    </div>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    <section className="dashboard-metrics dashboard-metrics-new" style={{ marginBottom: "1.5rem" }}>
      {[["Ready for final approval", overview.counts.ready], ["Awaiting officials", overview.counts.in_review], ["Approved", overview.counts.approved], ["Returned / rejected", overview.counts.rejected]].map(([label, count]) => <article className="metric-card" key={String(label)}><h2>{count}</h2><p>{label}</p></article>)}
    </section>
    {loading ? <div className="dashboard-loading">Loading approval requests…</div> : <>
      <ApprovalSection title="Ready for your final approval" empty="No elections are ready for final authorization." elections={overview.ready_for_final_approval} actionId={actionId} approve={approve} reject={reject} />
      <ApprovalSection title="Pending official approvals" empty="No elections are awaiting official review." elections={overview.under_official_review} actionId={actionId} reject={reject} />
      <ApprovalSection title="Recently approved" empty="No approved elections yet." elections={overview.recently_approved} actionId={actionId} />
      <ApprovalSection title="Returned or rejected" empty="No returned elections." elections={overview.rejected} actionId={actionId} />
    </>}
  </div>;
}

function ApprovalSection({ title, empty, elections, actionId, approve, reject }: { title: string; empty: string; elections: ApprovalElection[]; actionId: string | null; approve?: (e: ApprovalElection) => Promise<void>; reject?: (e: ApprovalElection) => Promise<void> }) {
  return <section className="panel" style={{ marginBottom: "1.25rem" }}><div className="panel-head"><div><p className="eyebrow">{elections.length} item{elections.length === 1 ? "" : "s"}</p><h3>{title}</h3></div></div>
    {!elections.length ? <p style={{ color: "#6b7280" }}>{empty}</p> : <div style={{ display: "grid", gap: "0.85rem" }}>{elections.map((e) => <article key={e.id} style={{ border: "1px solid #e5e7eb", borderRadius: "10px", padding: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}><div><h4 style={{ margin: 0 }}>{e.name}</h4><p style={{ margin: "0.3rem 0", color: "#6b7280" }}>{e.department} · {e.election_type} · {e.positions_count} position{e.positions_count === 1 ? "" : "s"} · {e.estimated_voters.toLocaleString()} estimated voters</p><strong style={{ color: e.status === "REJECTED" ? "#b91c1c" : e.status === "APPROVED" ? "#166534" : "#92400e", fontSize: "0.85rem" }}>{e.status.replaceAll("_", " ")}</strong></div><div style={{ display: "flex", alignItems: "start", gap: "0.5rem" }}><Link className="btn btn-secondary" to={`/admin/elections/${e.id}`}>View</Link>{approve && <button className="btn btn-primary" disabled={actionId === e.id} onClick={() => void approve(e)}>{actionId === e.id ? "Saving…" : "Final approve"}</button>}{reject && e.status !== "REJECTED" && <button className="btn btn-secondary" disabled={actionId === e.id} onClick={() => void reject(e)}>Return to draft</button>}</div></div>
      <p style={{ margin: "0.75rem 0 0", fontSize: "0.9rem" }}><strong>Official review:</strong> {e.approved_officials_count}/{e.total_assigned_officials} approved</p>
      {e.reviewers.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.45rem" }}>{e.reviewers.map((r) => <span key={r.official_id} className="badge" style={{ background: r.status === "APPROVED" ? "#dcfce7" : r.status === "REJECTED" ? "#fee2e2" : "#fef3c7", color: "#374151" }}>{r.full_name}: {r.status}</span>)}</div>}
      {e.rejection_reason && <p style={{ margin: "0.65rem 0 0", color: "#b91c1c" }}><strong>Reason:</strong> {e.rejection_reason}</p>}
    </article>)}</div>}
  </section>;
}
