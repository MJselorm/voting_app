import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { loginUser, signInWithGoogle } from "../lib/firebase";
import { getMe, syncUser } from "../services/api";
import { dashboardPath } from "../auth/ProtectedRoute";
import { useAuthContext } from "../auth/AuthContext";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { Loader } from "../components/Loader";
import bannerImg from "../assets/banner.jpg";

function parseLoginError(error: any): string {
  const code = error?.code || "";
  const message = error?.message || "";

  switch (code) {
    case "auth/operation-not-allowed":
      return "Google Sign-In is disabled in your Firebase console. Enable Google in Firebase Console → Authentication → Sign-in method.";
    case "auth/unauthorized-domain":
      return "This domain is not authorised in Firebase. Add your domain in Firebase Console → Authentication → Settings → Authorized domains.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email address using a different sign-in method. Try signing in with email and password.";
    case "auth/user-not-found":
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Incorrect email or password.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please wait before trying again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/invalid-email":
      return "The email address is not valid.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Google sign-in window was closed.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in window. Please allow popups and try again.";
    default:
      if (code) return `Authentication error [${code}]: ${message}`;
      if (error?.detail) return String(error.detail);
      if (message) return message;
      return "Authentication failed. Please check your credentials and try again.";
  }
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { updateProfile } = useAuthContext();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError("");

    try {
      const credential = await signInWithGoogle();
      const firebaseUser = credential.user;

      const fullName = firebaseUser.displayName?.trim() || firebaseUser.email?.split("@")[0] || "Student";
      try {
        const syncRes = await syncUser({
          full_name: fullName,
          email: firebaseUser.email || "",
        });
        updateProfile(syncRes.user);
        navigate(from === "/dashboard" ? dashboardPath(syncRes.user.role) : from, { replace: true });
      } catch (syncErr: any) {
        console.error("Backend sync failed on Google login:", syncErr);
        const profile = await getMe().catch(() => null);
        if (profile) {
          updateProfile(profile);
          navigate(from === "/dashboard" ? dashboardPath(profile.role) : from, { replace: true });
        } else {
          setError(syncErr?.detail || "Backend profile sync failed after Google sign-in.");
        }
      }
    } catch (err: any) {
      console.error("Google login error:", err);
      setError(parseLoginError(err));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const credential = await loginUser(email.trim(), password);
      const firebaseUser = credential.user;

      if (!firebaseUser.emailVerified) {
        navigate("/verify-email");
        return;
      }

      const fullName = firebaseUser.displayName?.trim() || email.split("@")[0] || "Student";
      try {
        const syncRes = await syncUser({
          full_name: fullName,
          email: firebaseUser.email || email,
        });
        updateProfile(syncRes.user);
        navigate(from === "/dashboard" ? dashboardPath(syncRes.user.role) : from, { replace: true });
      } catch (syncErr: any) {
        console.error("Backend sync failed on login:", syncErr);
        const profile = await getMe().catch(() => null);
        if (profile) {
          updateProfile(profile);
          navigate(from === "/dashboard" ? dashboardPath(profile.role) : from, { replace: true });
        }
      }
    } catch (err: any) {
      setError(parseLoginError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {(isLoading || isGoogleLoading) && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(248, 250, 252, 0.88)",
            backdropFilter: "blur(6px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            gap: "2.5rem",
          }}
        >
          <Loader />
          <p
            style={{
              color: "var(--color-primary, #032b37)",
              fontWeight: 600,
              fontSize: "1rem",
              letterSpacing: "0.025em",
            }}
          >
            {isGoogleLoading ? "Connecting to Google…" : "Signing in…"}
          </p>
        </div>
      )}
      <Header />
      <main className="page-container">
        <div className="auth-card-split">
          {/* Left Column: App Name at top, Picture in middle */}
          <div className="auth-card-left">
            {/* Top of Left: App Name */}
            <div className="auth-card-brand-top">
              <span className="brand-icon" aria-hidden="true" style={{ color: "var(--color-primary)" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </span>
              <div>
                <div className="auth-card-brand-title">UniVote</div>
                <div className="auth-card-brand-tagline">Academic Voting Portal</div>
              </div>
            </div>

            {/* Middle of Left: Picture */}
            <div className="auth-card-image-wrapper">
              <img src={bannerImg} alt="Academic Voting Portal Illustration" />
            </div>

            {/* Bottom of Left: Feature Badges */}
            <div className="auth-card-features">
              <span>🔒 Encrypted Voting</span>
              <span>✓ Instant Verification</span>
            </div>
          </div>

          {/* Right Column: All Auth Content */}
          <div className="auth-card-form">
            <div className="auth-header" style={{ textAlign: "center" }}>
              <h1 className="auth-title">Welcome Back</h1>
              <p className="auth-subtitle">Sign in to access your university elections.</p>
            </div>

            {error && (
              <div className="alert alert-error" role="alert">
                <span>⚠</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">University Email</label>
                <input
                  id="login-email"
                  type="email"
                  className="form-input"
                  placeholder="student@university.edu"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  autoComplete="current-password"
                />
              </div>

              <div className="form-checkbox-group" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    className="form-checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span style={{ fontSize: "0.84rem", fontWeight: 600 }}>Remember me</span>
                </label>
                <Link to="/forgot-password" className="auth-link" style={{ fontSize: "0.84rem" }}>
                  Forgot password?
                </Link>
              </div>

              <button
                id="login-submit-btn"
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
                style={{ marginTop: "0.5rem" }}
              >
                {isLoading ? (
                  <>
                    <span className="spinner spinner-sm" />
                    Signing in…
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <div className="auth-divider">or</div>

            <button
              id="google-login-btn"
              type="button"
              className="btn btn-google"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isLoading}
            >
              {isGoogleLoading ? (
                <>
                  <span className="spinner spinner-sm" />
                  Connecting to Google…
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            <p className="auth-footer-text">
              Don&apos;t have an account?{" "}
              <Link to="/register" className="auth-link">Sign Up</Link>
            </p>

            <div className="security-badge-box">
              <div className="security-badge-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </div>
              <span>Your account is protected by secure authentication.</span>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
