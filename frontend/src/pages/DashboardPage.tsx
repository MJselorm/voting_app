import { useEffect, useMemo, useState, type ReactNode, memo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { logoutUser } from "../lib/firebase";
import { useAuthContext } from "../auth/AuthContext";
import { checkEligibility, getMe, verifyStudent, type EligibilityCheckResponse, type UserProfile } from "../services/api";

function Icon({ children }: { children: ReactNode }) {
  // Decorative icons should not be announced by screen readers; the
  // adjacent text label already carries the meaning.
  return (
    <span className="material-symbols-outlined" aria-hidden="true">
      {children}
    </span>
  );
}

// Visually-hidden helper for text that should reach screen readers only.
function VisuallyHidden({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    >
      {children}
    </span>
  );
}

const navItems = [
  ["dashboard", "Dashboard", "/dashboard"],
  ["how_to_vote", "My Votes", "/dashboard#votes"],
  ["ballot", "Elections", "/dashboard#elections"],
  ["person", "Profile", "/profile"],
] as const;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Sidebar has no dependency on profile-loading state, so it's memoized to
// avoid re-rendering while the dashboard's data fetch is in flight.
export const Sidebar = memo(function Sidebar({
  name,
  firstName,
  onLogout,
  activeNav = "Dashboard",
}: {
  name: string;
  firstName: string;
  onLogout: () => void;
  activeNav?: string;
}) {
  return (
    <aside className="dashboard-sidebar dashboard-sidebar-new">
      <div className="dashboard-sidebar-brand">
        <div className="dashboard-crest" aria-hidden="true">U</div>
        <div>
          <div className="dashboard-sidebar-title">UniVote</div>
          <div className="dashboard-sidebar-subtitle">Student voting portal</div>
        </div>
      </div>

      <div className="dashboard-account-card">
        <div className="dashboard-account-avatar" aria-hidden="true">
          {firstName.charAt(0)}
        </div>
        <div>
          <strong>{name}</strong>
          <span>Verified student</span>
        </div>
      </div>

      <p className="dashboard-nav-label">Workspace</p>
      <nav className="dashboard-nav" aria-label="Dashboard navigation">
        {navItems.map(([icon, label, href]) => {
          const isActive = label === activeNav;
          return (
            <Link
              key={label}
              className={`dashboard-nav-item ${isActive ? "active" : ""}`}
              to={href}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon>{icon}</Icon>
              <span>{label}</span>
              {label === "Elections" && (
                <span className="nav-count">
                  2<VisuallyHidden> open elections</VisuallyHidden>
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <button className="sidebar-logout" onClick={onLogout} type="button">
        <Icon>logout</Icon>Log out
      </button>
    </aside>
  );
});

function Topbar({
  firstName,
  greeting,
  onProfileClick,
}: {
  firstName: string;
  greeting: string;
  onProfileClick: () => void;
}) {
  return (
    <header className="dashboard-topbar dashboard-topbar-new">
      <div>
        <p className="dashboard-kicker">Student dashboard</p>
        <h1>
          {greeting}, {firstName}.
        </h1>
      </div>
      <div className="dashboard-topbar-actions">
        <button type="button" className="icon-chip has-notification" aria-label="Notifications">
          <Icon>notifications</Icon>
          <span className="notification-dot" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="avatar-chip"
          aria-label={`${firstName}'s profile`}
          onClick={onProfileClick}
        >
          {firstName.charAt(0)}
        </button>
      </div>
    </header>
  );
}

function MetricsSection({ eligibility }: { eligibility: EligibilityCheckResponse | null }) {
  const eligibilityKnown = eligibility !== null;
  const eligible = eligibility?.is_eligible === true;
  return (
    <section className="dashboard-metrics dashboard-metrics-new" aria-label="Voting overview">
      <article className="metric-card metric-card-featured">
        <div className="metric-top">
          <div className="metric-icon metric-icon-primary">
            <Icon>ballot</Icon>
          </div>
          <span className="metric-pill">Open now</span>
        </div>
        <h2>2</h2>
        <p>Active elections</p>
        <a className="metric-link" href="#elections">
          Browse elections <Icon>arrow_forward</Icon>
        </a>
      </article>

      <article className="metric-card">
        <div className="metric-top">
          <div className="metric-icon metric-icon-secondary">
            <Icon>check_circle</Icon>
          </div>
          <span className="metric-trend">This semester</span>
        </div>
        <h2>1</h2>
        <p>Vote cast</p>
        <a className="metric-link" href="#votes">
          View history <Icon>arrow_forward</Icon>
        </a>
      </article>

      <article className="metric-card metric-card-accent">
        <div className="metric-top">
          <div className="metric-icon metric-icon-neutral">
            <Icon>verified_user</Icon>
          </div>
          <span className={`metric-pill ${eligible ? "metric-pill-verified" : ""}`}>
            <span className="metric-pill-dot" aria-hidden="true" />
            {!eligibilityKnown ? "Checking" : eligible ? "Eligible" : "Not eligible"}
          </span>
        </div>
        <h2>{eligible ? "Ready" : "Review"}</h2>
        <p>{eligibilityKnown ? eligibility.reason : "Checking your official student record"}</p>
        <a className="metric-link" href="/profile">
          View student record <Icon>arrow_forward</Icon>
        </a>
      </article>
    </section>
  );
}

type ElectionStatus = "ongoing" | "upcoming";

interface Election {
  id: string;
  title: string;
  icon: string;
  iconClassName?: string;
  status: ElectionStatus;
  statusLabel: string;
  description: string;
  dateLabel: string;
  audienceLabel: string;
  participation: number; // 0-100, only meaningful for ongoing elections
  participationLabel: string;
  ctaLabel: string;
  ctaClassName: string;
}

const elections: Election[] = [
  {
    id: "cs-department",
    title: "Computer Science Department",
    icon: "computer",
    status: "ongoing",
    statusLabel: "Ongoing",
    description: "Choose representatives for the department committee.",
    dateLabel: "Ends Oct 25",
    audienceLabel: "CS undergrads",
    participation: 68,
    participationLabel: "68% participation so far",
    ctaLabel: "Vote now",
    ctaClassName: "btn btn-primary election-button",
  },
  {
    id: "src-university",
    title: "SRC University Election",
    icon: "account_balance",
    iconClassName: "election-icon-sky",
    status: "upcoming",
    statusLabel: "Upcoming",
    description: "Meet the candidates shaping the next student council.",
    dateLabel: "Opens Nov 1",
    audienceLabel: "All students",
    participation: 12,
    participationLabel: "Voting opens in 12 days",
    ctaLabel: "Explore",
    ctaClassName: "btn btn-secondary election-button",
  },
];

function ElectionCard({ election }: { election: Election }) {
  const isOngoing = election.status === "ongoing";
  return (
    <article className="election-card election-card-new">
      <div className={`election-icon ${election.iconClassName ?? ""}`}>
        <Icon>{election.icon}</Icon>
      </div>
      <div className="election-body">
        <div className="election-row">
          <h4>{election.title}</h4>
          <span className={`status-chip ${election.status}`}>{election.statusLabel}</span>
        </div>
        <p className="election-description">{election.description}</p>
        <div className="election-meta">
          <span>
            <Icon>event</Icon> {election.dateLabel}
          </span>
          <span>
            <Icon>group</Icon> {election.audienceLabel}
          </span>
        </div>
        <div
          className={`election-progress ${isOngoing ? "" : "muted"}`}
          role="progressbar"
          aria-valuenow={election.participation}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={isOngoing ? "Participation so far" : "Time until voting opens"}
        >
          <span style={{ width: `${election.participation}%` }} />
        </div>
        <small>{election.participationLabel}</small>
      </div>
      <button type="button" className={election.ctaClassName}>
        {election.ctaLabel} <Icon>arrow_forward</Icon>
      </button>
    </article>
  );
}

function ElectionsPanel() {
  return (
    <section className="panel panel-featured" id="elections">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Your next decision</p>
          <h3>Open elections</h3>
        </div>
        <a className="panel-link" href="#elections">
          View all <Icon>arrow_forward</Icon>
        </a>
      </div>
      <div className="election-list">
        {elections.map((election) => (
          <ElectionCard key={election.id} election={election} />
        ))}
      </div>
    </section>
  );
}

interface ActivityItem {
  id: string;
  isActive: boolean;
  time: string;
  title: string;
  description: string;
  hasReceipt?: boolean;
}

const activityItems: ActivityItem[] = [
  {
    id: "vote-cast",
    isActive: true,
    time: "Today · 10:42 AM",
    title: "Vote successfully cast",
    description: "Your Library Committee ballot was securely recorded.",
    hasReceipt: true,
  },
  {
    id: "profile-verified",
    isActive: false,
    time: "Yesterday",
    title: "Profile verified",
    description: "Your student identity is ready for secure voting.",
  },
];

function ActivityPanel() {
  return (
    <section className="panel" id="votes">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Your account</p>
          <h3>Recent activity</h3>
        </div>
      </div>
      <div className="activity-list">
        {activityItems.map((item) => (
          <div className="activity-item" key={item.id}>
            <span className={`activity-dot ${item.isActive ? "active" : ""}`} aria-hidden="true" />
            <p className="activity-time">{item.time}</p>
            <h4>
              {item.title}
              {item.isActive && <VisuallyHidden> (recent)</VisuallyHidden>}
            </h4>
            <p>{item.description}</p>
            {item.hasReceipt && (
              <button type="button" className="link-chip">
                <Icon>receipt_long</Icon>View receipt
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityCheckResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then(async (profileData) => {
        let latestProfile = profileData;

        try {
          // This comparison is server-side and uses only the official students table.
          const verification = await verifyStudent();
          latestProfile = verification.user;
        } catch {
          // A mismatch is reflected by the eligibility result below; avoid exposing it here.
        }

        const eligibilityData = await checkEligibility();
        if (!cancelled) {
          setProfile(latestProfile);
          setEligibility(eligibilityData);
        }
      })
      .catch((err) => {
        console.error("Failed to load voting status:", err);
        if (!cancelled) setLoadError(true);
      })
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
  const greeting = useMemo(() => getGreeting(), []);

  return (
    <div className="dashboard-shell dashboard-shell-new">
      <Sidebar name={name} firstName={firstName} onLogout={handleLogout} />

      <main className="dashboard-main dashboard-main-new">
        <Topbar firstName={firstName} greeting={greeting} onProfileClick={() => navigate("/profile")} />

        <MetricsSection eligibility={eligibility} />

        <section className="dashboard-grid dashboard-grid-new">
          <div className="dashboard-column dashboard-column-main">
            <ElectionsPanel />
          </div>
          <div className="dashboard-column dashboard-column-side">
            <ActivityPanel />
          </div>
        </section>

        {loading && (
          <div className="dashboard-loading" role="status">
            Loading your profile...
          </div>
        )}
        {!loading && loadError && (
          <div className="dashboard-loading" role="status">
            We couldn't load your latest profile details. Some information above may be out of date.
          </div>
        )}
      </main>
    </div>
  );
}
