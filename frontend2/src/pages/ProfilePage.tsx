import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { logoutUser } from "../lib/firebase";

/**
 * ProfilePage — placeholder for future profile editing.
 * Currently protected and accessible only to verified users.
 */
export function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login");
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <div className="dashboard-brand-icon">🗳️</div>
          UniVote
        </div>
        <div className="dashboard-header-actions">
          <button
            id="profile-back-btn"
            className="btn btn-secondary"
            style={{ width: "auto", padding: "0.4rem 0.875rem", fontSize: "0.875rem" }}
            onClick={() => navigate("/dashboard")}
          >
            ← Dashboard
          </button>
          <button
            id="profile-logout-btn"
            className="btn btn-danger"
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <div className="dashboard-greeting">
          <h1>My Profile</h1>
          <p>Manage your account information.</p>
        </div>

        <div className="profile-section">
          <div className="profile-section-title">Account Information</div>
          <div className="profile-field">
            <div className="profile-field-label">Email</div>
            <div className="profile-field-value">{user?.email || "—"}</div>
          </div>
          <div className="profile-field">
            <div className="profile-field-label">Email Verified</div>
            <div
              className="profile-field-value"
              style={{ color: user?.emailVerified ? "var(--color-success)" : "var(--color-error)" }}
            >
              {user?.emailVerified ? "✓ Verified" : "✗ Not verified"}
            </div>
          </div>
          <div className="profile-field">
            <div className="profile-field-label">Firebase UID</div>
            <div
              className="profile-field-value"
              style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "var(--color-text-muted)", wordBreak: "break-all" }}
            >
              {user?.uid || "—"}
            </div>
          </div>
        </div>

        <div className="profile-section" style={{ borderColor: "rgba(139, 92, 246, 0.15)" }}>
          <div className="profile-section-title">🔧 Coming Soon</div>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem", lineHeight: 1.6 }}>
            Profile editing will be available in a future update. Contact your university administrator to update your details.
          </p>
        </div>
      </main>
    </div>
  );
}
