import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { logoutUser } from "../lib/firebase";
import { getMe, type UserProfile } from "../services/api";

function Icon({ children }: { children: ReactNode }) {
  return <span className="material-symbols-outlined">{children}</span>;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchProfile = async () => {
      try {
        const data = await getMe();
        if (!cancelled) setProfile(data);
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login");
  };

  const name = profile?.full_name || "Alex Morgan";
  const firstName = name.split(" ")[0];

  return (
    <div className="dashboard-shell">
      <nav className="dashboard-topbar">
        <div className="dashboard-topbar-brand">
          <span className="dashboard-brand-mark">UniVote Scholar</span>
        </div>
        <div className="dashboard-topbar-search">
          <Icon>search</Icon>
          <input placeholder="Search elections, candidates..." />
        </div>
        <div className="dashboard-topbar-actions">
          <button type="button" className="icon-chip" aria-label="Notifications">
            <Icon>notifications</Icon>
            <span className="notification-dot" />
          </button>
          <button type="button" className="icon-chip" aria-label="Settings">
            <Icon>settings</Icon>
          </button>
          <button type="button" className="avatar-chip" aria-label="Profile">
            {firstName.charAt(0)}
          </button>
        </div>
      </nav>

      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar-brand">
          <div className="dashboard-crest">U</div>
          <div>
            <div className="dashboard-sidebar-title">UniVote</div>
            <div className="dashboard-sidebar-subtitle">Academic Portal</div>
          </div>
        </div>

        <button className="sidebar-cta" type="button">
          <Icon>how_to_vote</Icon>
          Cast Vote Now
        </button>

        <div className="dashboard-nav">
          <a className="dashboard-nav-item active" href="#">
            <Icon>dashboard</Icon>
            <span>Dashboard</span>
          </a>
          <a className="dashboard-nav-item" href="#">
            <Icon>how_to_vote</Icon>
            <span>My Votes</span>
          </a>
          <a className="dashboard-nav-item" href="#">
            <Icon>ballot</Icon>
            <span>Elections</span>
          </a>
          <a className="dashboard-nav-item" href="#">
            <Icon>person</Icon>
            <span>Profile</span>
          </a>
          <a className="dashboard-nav-item" href="#">
            <Icon>help_outline</Icon>
            <span>Support</span>
          </a>
        </div>

        <button className="sidebar-logout" onClick={handleLogout} type="button">
          <Icon>logout</Icon>
          Log Out
        </button>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-hero">
          <h1>
            Hello, {firstName}
          </h1>
          <p>Here is your academic voting overview for today.</p>
        </header>

        <section className="dashboard-metrics">
          <article className="metric-card">
            <div className="metric-top">
              <div className="metric-icon metric-icon-primary">
                <Icon>how_to_vote</Icon>
              </div>
              <span className="metric-pill">Action Needed</span>
            </div>
            <h2>2</h2>
            <p>Active Elections</p>
          </article>

          <article className="metric-card">
            <div className="metric-top">
              <div className="metric-icon metric-icon-secondary">
                <Icon>check_circle</Icon>
              </div>
            </div>
            <h2>1</h2>
            <p>Votes Cast</p>
          </article>

          <article className="metric-card metric-card-accent">
            <div className="metric-top">
              <div className="metric-icon metric-icon-neutral">
                <Icon>verified_user</Icon>
              </div>
              <span className="metric-pill metric-pill-verified">
                <span className="metric-pill-dot" />
                Verified
              </span>
            </div>
            <h2>Status</h2>
            <p>Identity Confirmed</p>
          </article>
        </section>

        <section className="dashboard-grid">
          <div className="dashboard-column dashboard-column-main">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>Active Elections</h3>
                </div>
                <a href="#">View All</a>
              </div>

              <div className="election-list">
                <article className="election-card">
                  <div className="election-icon">
                    <Icon>computer</Icon>
                  </div>
                  <div className="election-body">
                    <div className="election-row">
                      <h4>Computer Science Department</h4>
                      <span className="status-chip ongoing">Ongoing</span>
                    </div>
                    <div className="election-meta">
                      <span><Icon>calendar_today</Icon> Ends Oct 25</span>
                      <span><Icon>group</Icon> CS Undergrads</span>
                    </div>
                  </div>
                  <button type="button" className="btn btn-primary election-button">View Details</button>
                </article>

                <article className="election-card">
                  <div className="election-icon">
                    <Icon>account_balance</Icon>
                  </div>
                  <div className="election-body">
                    <div className="election-row">
                      <h4>SRC University Election</h4>
                      <span className="status-chip upcoming">Upcoming</span>
                    </div>
                    <div className="election-meta">
                      <span><Icon>calendar_today</Icon> Starts Nov 1</span>
                      <span><Icon>group</Icon> All Students</span>
                    </div>
                  </div>
                  <button type="button" className="btn btn-secondary election-button">View Details</button>
                </article>
              </div>
            </section>

            <section className="promo-card promo-card-primary">
              <div className="promo-shape promo-shape-top" />
              <div className="promo-shape promo-shape-bottom" />
              <div className="promo-copy">
                <span className="promo-kicker">Call for Nominations</span>
                <h3>2024 Leadership Awards</h3>
                <p>Recognize peers who have demonstrated exceptional leadership and service within the academic community.</p>
              </div>
              <button type="button" className="promo-button">Nominate Now</button>
            </section>
          </div>

          <div className="dashboard-column dashboard-column-side">
            <section className="panel">
              <h3>Recent Activity</h3>
              <div className="activity-list">
                <div className="activity-item">
                  <span className="activity-dot active" />
                  <p className="activity-time">Today, 10:42 AM</p>
                  <h4>Vote Successfully Cast</h4>
                  <p>Your ballot for 'Library Committee' was securely recorded and encrypted.</p>
                  <button type="button" className="link-chip">
                    <Icon>receipt_long</Icon>
                    View Receipt
                  </button>
                </div>
                <div className="activity-item">
                  <span className="activity-dot" />
                  <p className="activity-time">Yesterday</p>
                  <h4>Profile Verified</h4>
                  <p>Identity verification completed via student portal integration.</p>
                </div>
                <div className="activity-item">
                  <span className="activity-dot" />
                  <p className="activity-time">Oct 12</p>
                  <h4>System Update</h4>
                  <p>New structural security patch applied to voting ledger.</p>
                </div>
              </div>
              <button type="button" className="panel-link">View Full History</button>
            </section>

            <section className="panel panel-dashed">
              <div className="security-head">
                <Icon>security</Icon>
                <h3>Secure Voting</h3>
              </div>
              <p>
                All academic elections use end-to-end encryption to ensure your vote remains anonymous and tamper-proof.
              </p>
              <a href="#" className="learn-link">
                Learn about our security <Icon>arrow_forward</Icon>
              </a>
            </section>
          </div>
        </section>

        {loading && <div className="dashboard-loading">Loading dashboard...</div>}
      </main>
    </div>
  );
}
