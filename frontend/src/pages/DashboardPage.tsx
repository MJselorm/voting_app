import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { logoutUser } from "../lib/firebase";
import { useAuthContext } from "../auth/AuthContext";
import { getMe, type UserProfile } from "../services/api";

function Icon({ children }: { children: ReactNode }) {
  return <span className="material-symbols-outlined">{children}</span>;
}

const navItems = [
  ["dashboard", "Dashboard", "/dashboard"],
  ["how_to_vote", "My Votes", "#votes"],
  ["ballot", "Elections", "#elections"],
  ["person", "Profile", "/profile"],
  ["help_outline", "Support", "#support"],
] as const;

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err) => console.error("Failed to load profile:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login");
  };

  const name = profile?.full_name || user?.displayName || user?.email?.split("@")[0] || "Student";
  const firstName = name.trim().split(/\s+/)[0] || "Student";

  return (
    <div className="dashboard-shell dashboard-shell-new">
      <aside className="dashboard-sidebar dashboard-sidebar-new">
        <div className="dashboard-sidebar-brand"><div className="dashboard-crest">U</div><div><div className="dashboard-sidebar-title">UniVote</div><div className="dashboard-sidebar-subtitle">Student voting portal</div></div></div>
        <div className="dashboard-account-card"><div className="dashboard-account-avatar">{firstName.charAt(0)}</div><div><strong>{name}</strong><span>Verified student</span></div><Icon>expand_more</Icon></div>
        <p className="dashboard-nav-label">Workspace</p>
        <nav className="dashboard-nav" aria-label="Dashboard navigation">{navItems.map(([icon, label, href]) => <a key={label} className={`dashboard-nav-item ${label === "Dashboard" ? "active" : ""}`} href={href}><Icon>{icon}</Icon><span>{label}</span>{label === "Elections" && <span className="nav-count">2</span>}</a>)}</nav>
        <div className="sidebar-help"><Icon>support_agent</Icon><strong>Need help?</strong><p>Our election support team is here.</p><a href="#support">Contact support <Icon>arrow_forward</Icon></a></div>
        <button className="sidebar-logout" onClick={handleLogout} type="button"><Icon>logout</Icon>Log out</button>
      </aside>

      <main className="dashboard-main dashboard-main-new">
        <header className="dashboard-topbar dashboard-topbar-new"><div><p className="dashboard-kicker">Student dashboard</p><h1>Good morning, {firstName}.</h1></div><div className="dashboard-topbar-actions"><button type="button" className="icon-chip has-notification" aria-label="Notifications"><Icon>notifications</Icon><span className="notification-dot" /></button><button type="button" className="icon-chip" aria-label="Settings"><Icon>settings</Icon></button><button type="button" className="avatar-chip" aria-label={`${firstName}'s profile`} onClick={() => navigate("/profile")}>{firstName.charAt(0)}</button></div></header>
        <div className="dashboard-welcome"><div><p>Here is what is happening across your campus today.</p></div><a className="sidebar-cta" href="#elections"><Icon>how_to_vote</Icon>Cast a vote <Icon>arrow_forward</Icon></a></div>

        <section className="dashboard-metrics dashboard-metrics-new" aria-label="Voting overview"><article className="metric-card metric-card-featured"><div className="metric-top"><div className="metric-icon metric-icon-primary"><Icon>ballot</Icon></div><span className="metric-pill">Open now</span></div><h2>2</h2><p>Active elections</p><a className="metric-link" href="#elections">Browse elections <Icon>arrow_forward</Icon></a></article><article className="metric-card"><div className="metric-top"><div className="metric-icon metric-icon-secondary"><Icon>check_circle</Icon></div><span className="metric-trend">This semester</span></div><h2>1</h2><p>Vote cast</p><a className="metric-link" href="#votes">View history <Icon>arrow_forward</Icon></a></article><article className="metric-card metric-card-accent"><div className="metric-top"><div className="metric-icon metric-icon-neutral"><Icon>verified_user</Icon></div><span className="metric-pill metric-pill-verified"><span className="metric-pill-dot" />Ready</span></div><h2>100%</h2><p>Profile complete</p><a className="metric-link" href="/profile">Review profile <Icon>arrow_forward</Icon></a></article></section>

        <section className="dashboard-grid dashboard-grid-new"><div className="dashboard-column dashboard-column-main"><section className="panel panel-featured" id="elections"><div className="panel-head"><div><p className="eyebrow">Your next decision</p><h3>Open elections</h3><p className="panel-subtitle">Make your voice count before the deadlines.</p></div><a className="panel-link" href="#elections">View all <Icon>arrow_forward</Icon></a></div><div className="election-list"><article className="election-card election-card-new"><div className="election-icon"><Icon>computer</Icon></div><div className="election-body"><div className="election-row"><h4>Computer Science Department</h4><span className="status-chip ongoing">Ongoing</span></div><p className="election-description">Choose representatives for the department committee.</p><div className="election-meta"><span><Icon>event</Icon> Ends Oct 25</span><span><Icon>group</Icon> CS undergrads</span></div><div className="election-progress"><span style={{ width: "68%" }} /></div><small>68% participation so far</small></div><button type="button" className="btn btn-primary election-button">Vote now <Icon>arrow_forward</Icon></button></article><article className="election-card election-card-new"><div className="election-icon election-icon-sky"><Icon>account_balance</Icon></div><div className="election-body"><div className="election-row"><h4>SRC University Election</h4><span className="status-chip upcoming">Upcoming</span></div><p className="election-description">Meet the candidates shaping the next student council.</p><div className="election-meta"><span><Icon>event</Icon> Opens Nov 1</span><span><Icon>group</Icon> All students</span></div><div className="election-progress muted"><span style={{ width: "12%" }} /></div><small>Voting opens in 12 days</small></div><button type="button" className="btn btn-secondary election-button">Explore <Icon>arrow_forward</Icon></button></article></div></section><section className="promo-card promo-card-primary"><div className="promo-copy"><span className="promo-kicker">Student leadership</span><h3>Have a voice beyond the ballot.</h3><p>Discover ways to nominate a peer, join a committee, or support campus change.</p></div><button type="button" className="promo-button">Explore opportunities <Icon>arrow_forward</Icon></button></section></div><div className="dashboard-column dashboard-column-side"><section className="panel" id="votes"><div className="panel-head"><div><p className="eyebrow">Your account</p><h3>Recent activity</h3></div><button type="button" className="panel-more" aria-label="More activity"><Icon>more_horiz</Icon></button></div><div className="activity-list"><div className="activity-item"><span className="activity-dot active" /><p className="activity-time">Today · 10:42 AM</p><h4>Vote successfully cast</h4><p>Your Library Committee ballot was securely recorded.</p><button type="button" className="link-chip"><Icon>receipt_long</Icon>View receipt</button></div><div className="activity-item"><span className="activity-dot" /><p className="activity-time">Yesterday</p><h4>Profile verified</h4><p>Your student identity is ready for secure voting.</p></div><div className="activity-item"><span className="activity-dot" /><p className="activity-time">Oct 12</p><h4>System update</h4><p>Security improvements were applied to the voting ledger.</p></div></div><button type="button" className="panel-link">View full history <Icon>arrow_forward</Icon></button></section><section className="panel panel-dashed" id="support"><div className="security-head"><div className="security-icon"><Icon>security</Icon></div><div><p className="eyebrow">Private by design</p><h3>Your vote is protected</h3></div></div><p>Every ballot is encrypted, anonymous, and independently verifiable from the moment you submit it.</p><a href="#support" className="learn-link">Learn about security <Icon>arrow_forward</Icon></a></section></div></section>
        {loading && <div className="dashboard-loading" role="status">Loading your profile...</div>}
      </main>
    </div>
  );
}
