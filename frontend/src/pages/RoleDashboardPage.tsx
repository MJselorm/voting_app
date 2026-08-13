import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { logoutUser } from "../lib/firebase";
import { useAuthContext } from "../auth/AuthContext";
import type { UserProfile } from "../services/api";
import { getAdminDashboardStats, type AdminDashboardStats } from "../services/api";
import { Sidebar } from "./DashboardPage";

const navigation: Record<Exclude<UserProfile["role"], "STUDENT">, Array<[string, string]>> = {
  ELECTION_OFFICIAL: [["Dashboard", "/official/dashboard"], ["Elections", "/official/elections"], ["Student Records", "/official/students"], ["Candidates", "/official/candidates"], ["Results", "/official/results"], ["Notifications", "/official/notifications"], ["Profile", "/profile"]],
  SUPER_ADMIN: [["Dashboard", "/admin/dashboard"], ["Elections", "/admin/elections"], ["Student Records", "/admin/students"], ["Users", "/admin/users"], ["Election Officials", "/admin/officials"], ["Approvals", "/admin/approvals"], ["Departments", "/admin/departments"], ["Results", "/admin/results"], ["Audit Logs", "/admin/audit-logs"], ["Settings", "/admin/settings"], ["Profile", "/profile"]],
};

export function RoleDashboardPage({ role, page, children }: { role: Exclude<UserProfile["role"], "STUDENT">; page?: string; children?: ReactNode }) {
  const { profile, user } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const resolvedPage = page || navigation[role].find(([, path]) => path === location.pathname)?.[0] || "Workspace";
  const name = profile?.full_name || user?.displayName || "User";
  const title = role === "SUPER_ADMIN" ? "Super Admin" : "Election Official";
  const isDashboard = resolvedPage === "Dashboard";
  const [adminStats, setAdminStats] = useState<AdminDashboardStats | null>(null);
  const [statsError, setStatsError] = useState("");
  useEffect(() => {
    if (role !== "SUPER_ADMIN" || !isDashboard) return;
    getAdminDashboardStats().then(setAdminStats).catch((error) => setStatsError(error?.detail || "Could not load dashboard statistics."));
  }, [role, isDashboard]);
  const metrics = role === "SUPER_ADMIN"
    ? [["Uploaded Student Records", formatStat(adminStats?.uploaded_student_records)], ["Registered Users", formatStat(adminStats?.registered_users)], ["Registered Voters", formatStat(adminStats?.registered_voters)], ["Eligible to Vote", formatStat(adminStats?.eligible_voters)]]
    : [["Active Elections", "2"], ["Upcoming Elections", "3"], ["Pending Approvals", "1"], ["Students", "1,247"]];

  const logout = async () => { await logoutUser(); navigate("/login", { replace: true }); };
  return <div className="dashboard-shell dashboard-shell-new">
    <Sidebar name={name} firstName={name.trim().split(/\s+/)[0] || "User"} onLogout={logout} activeNav={resolvedPage} role={role} />
    <main className="dashboard-main dashboard-main-new"><header className="dashboard-topbar dashboard-topbar-new"><div><p className="dashboard-kicker">{title} workspace</p><h1>{isDashboard ? `${title} Dashboard` : resolvedPage}</h1></div></header>
      {children ?? (isDashboard ? <>{statsError && <div className="alert alert-error" role="alert">{statsError}</div>}<section className="dashboard-metrics dashboard-metrics-new">{metrics.map(([label, value]) => <article key={label} className="metric-card"><h2>{value}</h2><p>{label}</p></article>)}</section><section className="panel"><div className="panel-head"><div><p className="eyebrow">Quick actions</p><h3>Manage elections</h3></div></div><div className="form-actions"><Link className="btn btn-primary" to={role === "SUPER_ADMIN" ? "/admin/elections" : "/official/elections"}>Manage Elections</Link><Link className="btn btn-secondary" to={role === "SUPER_ADMIN" ? "/admin/students" : "/official/students"}>Student Records</Link></div></section></> : <section className="panel"><div className="panel-head"><div><p className="eyebrow">Coming soon</p><h3>{resolvedPage}</h3></div></div><p>This workspace is ready for the next phase of implementation.</p></section>)}
    </main>
  </div>;
}

function formatStat(value: number | undefined): string {
  return typeof value === "number" ? value.toLocaleString() : "—";
}
