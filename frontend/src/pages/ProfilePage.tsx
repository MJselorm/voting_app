import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "./DashboardPage";
import { useAuthContext } from "../auth/AuthContext";
import { getMe, updateMe, type UserProfile } from "../services/api";
import { logoutUser, sendPasswordReset, sendVerificationEmail } from "../lib/firebase";

function Icon({ children }: { children: ReactNode }) {
  return (
    <span className="material-symbols-outlined" aria-hidden="true">
      {children}
    </span>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuthContext();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Form State
  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");

  // Action states
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState("");
  const [saveError, setSaveError] = useState("");

  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  const [verificationSent, setVerificationSent] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((data) => {
        if (!cancelled) {
          setProfile(data);
          setFullName(data.full_name || user?.displayName || "");
          setStudentId(data.student_id || "");
        }
      })
      .catch((err) => {
        console.error("Failed to load profile:", err);
        if (!cancelled) setLoadError(err?.detail || "Failed to load user profile.");
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login");
  };

  const displayName = profile?.full_name || fullName || user?.displayName || user?.email?.split("@")[0] || "Student";
  const firstName = displayName.trim().split(/\s+/)[0] || "Student";
  const profileEmail = profile?.email || user?.email || "";

  const isFormModified =
    fullName.trim() !== (profile?.full_name || "") ||
    studentId.trim() !== (profile?.student_id || "");

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setSaveError("Full Name cannot be empty.");
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const updated = await updateMe({
        full_name: fullName.trim(),
        student_id: studentId.trim() || null,
      });
      setProfile(updated);
      setFullName(updated.full_name);
      setStudentId(updated.student_id || "");
      setSaveSuccess("Profile details updated successfully!");
    } catch (err: any) {
      setSaveError(err?.detail || "Failed to update profile details.");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    setResetError("");
    setResetSent(false);

    try {
      await sendPasswordReset(user.email);
      setResetSent(true);
    } catch (err: any) {
      setResetError(err?.message || "Failed to send password reset email.");
    } finally {
      setSendingReset(false);
    }
  };

  const handleResendVerification = async () => {
    if (!user) return;
    setSendingVerification(true);
    try {
      await sendVerificationEmail(user);
      setVerificationSent(true);
    } catch (err) {
      console.error("Failed to send verification email:", err);
    } finally {
      setSendingVerification(false);
    }
  };

  const roleLabelMap: Record<string, string> = {
    STUDENT: "Student",
    ELECTION_OFFICIAL: "Election Official",
    SUPER_ADMIN: "Super Admin",
  };

  const formattedRole = roleLabelMap[profile?.role || "STUDENT"] || "Student";
  const createdDate = profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  return (
    <div className="dashboard-shell dashboard-shell-new">
      <Sidebar name={displayName} firstName={firstName} onLogout={handleLogout} activeNav="Profile" />

      <main className="dashboard-main dashboard-main-new">
        <header className="dashboard-topbar dashboard-topbar-new">
          <div>
            <p className="dashboard-kicker">Account settings</p>
            <h1>My Profile</h1>
          </div>
          <div className="dashboard-topbar-actions">
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: "auto", padding: "0.4rem 0.875rem", fontSize: "0.875rem" }}
              onClick={() => navigate("/dashboard")}
            >
              ← Back to Dashboard
            </button>
          </div>
        </header>

        {loadingProfile ? (
          <div className="dashboard-loading" role="status">
            Loading your profile parameters...
          </div>
        ) : (
          <div className="profile-container">
            {loadError && (
              <div className="alert alert-error" role="alert">
                <Icon>error</Icon>
                <span>{loadError}</span>
              </div>
            )}

            {/* ── Hero Profile Header Card ───────────────────────────────── */}
            <div className="profile-hero-card">
              <div className="profile-hero-avatar">
                {firstName.charAt(0).toUpperCase()}
                <span
                  className={`profile-status-dot ${user?.emailVerified ? "verified" : "unverified"}`}
                  title={user?.emailVerified ? "Email verified" : "Email pending verification"}
                />
              </div>

              <div className="profile-hero-info">
                <div className="profile-hero-name-row">
                  <h2>{displayName}</h2>
                  <span className="role-badge">{formattedRole}</span>
                </div>
                <p className="profile-hero-email">{profileEmail}</p>
                <div className="profile-hero-tags">
                  <span className={`status-pill ${user?.emailVerified ? "status-verified" : "status-pending"}`}>
                    <Icon>{user?.emailVerified ? "verified" : "mark_email_unread"}</Icon>
                    {user?.emailVerified ? "Email Verified" : "Verification Pending"}
                  </span>
                  <span className={`status-pill ${profile?.is_verified ? "status-verified" : "status-pending"}`}>
                    <Icon>{profile?.is_verified ? "school" : "pending_actions"}</Icon>
                    {profile?.is_verified ? "Student Verified" : "Student Verification Required"}
                  </span>
                </div>
              </div>
            </div>

            <div className="profile-grid">
              {/* ── Personal & Student Details Form ─────────────────────── */}
              <section className="panel profile-panel">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Personal Information</p>
                    <h3>General Details</h3>
                  </div>
                </div>

                {saveSuccess && (
                  <div className="alert alert-success" role="alert">
                    <Icon>check_circle</Icon>
                    <span>{saveSuccess}</span>
                  </div>
                )}

                {saveError && (
                  <div className="alert alert-error" role="alert">
                    <Icon>error</Icon>
                    <span>{saveError}</span>
                  </div>
                )}

                <form onSubmit={handleSaveProfile} className="profile-form">
                  <div className="form-group">
                    <label htmlFor="fullNameInput">Full Name</label>
                    <div className="input-wrapper">
                      <Icon>person</Icon>
                      <input
                        id="fullNameInput"
                        type="text"
                        className="form-input"
                        placeholder="Enter your full name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="emailInput">Email Address</label>
                    <div className="input-wrapper disabled">
                      <Icon>mail</Icon>
                      <input
                        id="emailInput"
                        type="email"
                        className="form-input"
                        value={profileEmail}
                        disabled
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="studentIdInput">Student ID</label>
                    <div className="input-wrapper">
                      <Icon>badge</Icon>
                      <input
                        id="studentIdInput"
                        type="text"
                        className="form-input"
                        placeholder="e.g. STU-2026-889"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                      />
                    </div>
                    <small className="form-hint">
                      Your university student ID is used to verify eligibility for campus elections.
                    </small>
                  </div>

                  <div className="form-actions">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={saving || !isFormModified}
                    >
                      {saving ? (
                        <>
                          <span className="btn-spinner" aria-hidden="true" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Icon>save</Icon>
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </section>

              {/* ── Security & Credentials ─────────────────────────────── */}
              <section className="panel profile-panel">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Authentication & Security</p>
                    <h3>Account Security</h3>
                  </div>
                </div>

                <div className="security-section">
                  <div className="security-item">
                    <div className="security-item-icon">
                      <Icon>lock_reset</Icon>
                    </div>
                    <div className="security-item-content">
                      <h4>Password Reset</h4>
                      <p>Send a secure password reset link to your registered email address.</p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handlePasswordReset}
                      disabled={sendingReset}
                    >
                      {sendingReset ? "Sending..." : "Reset Password"}
                    </button>
                  </div>

                  {resetSent && (
                    <div className="alert alert-success mt-2" role="alert">
                      <Icon>mark_email_read</Icon>
                      <span>Password reset link sent! Check your inbox.</span>
                    </div>
                  )}

                  {resetError && (
                    <div className="alert alert-error mt-2" role="alert">
                      <Icon>error</Icon>
                      <span>{resetError}</span>
                    </div>
                  )}

                  {!user?.emailVerified && (
                    <div className="security-item mt-3">
                      <div className="security-item-icon warning">
                        <Icon>mark_email_unread</Icon>
                      </div>
                      <div className="security-item-content">
                        <h4>Email Verification</h4>
                        <p>Your email is not verified yet. Re-send verification link.</p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleResendVerification}
                        disabled={sendingVerification || verificationSent}
                      >
                        {verificationSent ? "Sent!" : sendingVerification ? "Sending..." : "Re-send Link"}
                      </button>
                    </div>
                  )}

                  <hr className="divider" />

                  <div className="meta-list">
                    <div className="meta-item">
                      <span className="meta-label">Account Created</span>
                      <span className="meta-val">{createdDate}</span>
                    </div>

                    <div className="meta-item">
                      <span className="meta-label">Student Verification</span>
                      <span className="meta-val">
                        {profile?.is_verified
                          ? `Verified${profile.verified_at ? ` on ${new Date(profile.verified_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}`
                          : "Not verified"}
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
