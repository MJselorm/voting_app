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
    <div className="dashboard-shell">
      <nav className="dashboard-topbar" aria-label="Dashboard utilities">
        <div className="dashboard-topbar-brand">
          <span className="dashboard-brand-mark">UniVote <em>Scholar</em></span>
        </div>
        <label className="dashboard-topbar-search">
          <Icon>search</Icon>
          <input aria-label="Search dashboard" placeholder="Search elections, candidates..." />
          <kbd>⌘ K</kbd>
        </label>
        <div className="dashboard-topbar-actions">
          <button type="button" className="icon-chip has-notification" aria-label="Notifications">
            <Icon>notifications</Icon><span className="notification-dot" />
          </button>
          <button type="button" className="icon-chip" aria-label="Settings"><Icon>settings</Icon></button>
          <button type="button" className="avatar-chip" aria-label={`${firstName}'s profile`} onClick={() => navigate("/profile")}>
            {firstName.charAt(0)}
          </button>
        </div>
      </nav>

      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar-brand">
          <div className="dashboard-crest">U</div>
          <div><div className="dashboard-sidebar-title">UniVote</div><div className="dashboard-sidebar-subtitle">Academic Portal</div></div>
        </div>
        <a className="sidebar-cta" href="#elections"><Icon>how_to_vote</Icon>Cast Vote Now<Icon>arrow_forward</Icon></a>
        <div className="dashboard-nav">
          {navItems.map(([icon, label, href]) => <a key={label} className={`dashboard-nav-item ${label === "Dashboard" ? "active" : ""}`} href={href}><Icon>{icon}</Icon><span>{label}</span>{label === "Elections" && <span className="nav-count">2</span>}</a>)}
        </div>
        <div className="sidebar-footer"><div className="sidebar-footer-line" /><button className="sidebar-logout" onClick={handleLogout} type="button"><Icon>logout</Icon>Log Out</button></div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-hero">
          <div><p className="eyebrow">Student overview · October 2024</p><h1>Good morning, {firstName}.</h1><p>Stay informed, make your voice count, and help shape your campus.</p></div>
          <div className="hero-status"><span className="status-pulse" />Account verified</div>
        </header>

        <section className="dashboard-metrics" aria-label="Voting overview">
          <article className="metric-card metric-card-featured"><div className="metric-top"><div className="metric-icon metric-icon-primary"><Icon>how_to_vote</Icon></div><span className="metric-pill">Action needed</span></div><h2>2</h2><p>Active elections</p><span className="metric-link">Your voice matters <Icon>arrow_forward</Icon></span></article>
          <article className="metric-card"><div className="metric-top"><div className="metric-icon metric-icon-secondary"><Icon>check_circle</Icon></div><span className="metric-trend">+1 this month</span></div><h2>1</h2><p>Votes cast</p><span className="metric-link">View voting history <Icon>arrow_forward</Icon></span></article>
          <article className="metric-card metric-card-accent"><div className="metric-top"><div className="metric-icon metric-icon-neutral"><Icon>verified_user</Icon></div><span className="metric-pill metric-pill-verified"><span className="metric-pill-dot" />Verified</span></div><h2>Ready</h2><p>Identity confirmed</p><span className="metric-link">Manage your profile <Icon>arrow_forward</Icon></span></article>
        </section>

        <section className="dashboard-grid">
          <div className="dashboard-column dashboard-column-main">
            <section className="panel" id="elections"><div className="panel-head"><div><p className="eyebrow">Make an impact</p><h3>Active elections</h3></div><a href="#elections">View all <Icon>arrow_forward</Icon></a></div><div className="election-list">
              <article className="election-card"><div className="election-icon"><Icon>computer</Icon></div><div className="election-body"><div className="election-row"><h4>Computer Science Department</h4><span className="status-chip ongoing">Ongoing</span></div><div className="election-meta"><span><Icon>calendar_today</Icon> Ends Oct 25</span><span><Icon>group</Icon> CS undergrads</span></div><div className="election-progress"><span style={{ width: "68%" }} /></div><small>68% of eligible students have participated</small></div><button type="button" className="btn btn-primary election-button">View details</button></article>
              <article className="election-card"><div className="election-icon election-icon-sky"><Icon>account_balance</Icon></div><div className="election-body"><div className="election-row"><h4>SRC University Election</h4><span className="status-chip upcoming">Upcoming</span></div><div className="election-meta"><span><Icon>calendar_today</Icon> Starts Nov 1</span><span><Icon>group</Icon> All students</span></div><div className="election-progress muted"><span style={{ width: "12%" }} /></div><small>Voting opens in 12 days</small></div><button type="button" className="btn btn-secondary election-button">View details</button></article>
            </div></section>
            <section className="promo-card promo-card-primary"><div className="promo-copy"><span className="promo-kicker">Call for nominations</span><h3>Celebrate campus leaders.</h3><p>Recognize peers who make a difference through exceptional leadership and service.</p></div><button type="button" className="promo-button">Nominate a peer <Icon>arrow_forward</Icon></button></section>
          </div>

          <div className="dashboard-column dashboard-column-side"><section className="panel" id="votes"><div className="panel-head"><div><p className="eyebrow">Your account</p><h3>Recent activity</h3></div><button type="button" className="panel-more" aria-label="More activity"><Icon>more_horiz</Icon></button></div><div className="activity-list"><div className="activity-item"><span className="activity-dot active" /><p className="activity-time">Today · 10:42 AM</p><h4>Vote successfully cast</h4><p>Your ballot for Library Committee was securely recorded.</p><button type="button" className="link-chip"><Icon>receipt_long</Icon>View receipt</button></div><div className="activity-item"><span className="activity-dot" /><p className="activity-time">Yesterday</p><h4>Profile verified</h4><p>Identity verification completed via student portal.</p></div><div className="activity-item"><span className="activity-dot" /><p className="activity-time">Oct 12</p><h4>System update</h4><p>Security patch applied to the voting ledger.</p></div></div><button type="button" className="panel-link">View full history <Icon>arrow_forward</Icon></button></section>
          <section className="panel panel-dashed" id="support"><div className="security-head"><div className="security-icon"><Icon>security</Icon></div><div><p className="eyebrow">Built for trust</p><h3>Secure voting</h3></div></div><p>Every election is protected with end-to-end encryption so your vote stays anonymous and tamper-proof.</p><a href="#support" className="learn-link">Learn about our security <Icon>arrow_forward</Icon></a></section></div>
        </section>
        {loading && <div className="dashboard-loading" role="status">Loading your profile...</div>}
      </main>
    </div>
  );
}
