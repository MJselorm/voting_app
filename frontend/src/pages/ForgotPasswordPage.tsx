import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { FirebaseError } from "firebase/app";
import { sendPasswordReset } from "../lib/firebase";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      await sendPasswordReset(email.trim());
      setStatus("success");
    } catch (err) {
      setStatus("error");
      if (err instanceof FirebaseError) {
        switch (err.code) {
          case "auth/user-not-found":
          case "auth/invalid-email":
            // Security: don't reveal whether an email exists in the system
            setStatus("success"); // Show success even for unknown emails
            break;
          case "auth/too-many-requests":
            setErrorMessage("Too many requests. Please wait before trying again.");
            break;
          case "auth/network-request-failed":
            setErrorMessage("Network error. Check your connection and try again.");
            break;
          default:
            setErrorMessage("Failed to send reset email. Please try again.");
        }
      } else {
        setErrorMessage("An unexpected error occurred. Please try again.");
      }
    }
  };

  if (status === "success") {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div className="auth-logo" style={{ justifyContent: "center" }}>
            <div className="auth-logo-icon">🗳️</div>
            <div>
              <div className="auth-logo-text">UniVote</div>
              <div className="auth-logo-sub">University Voting System</div>
            </div>
          </div>

          <div
            style={{
              width: 64,
              height: 64,
              background: "var(--color-success-bg)",
              border: "1px solid rgba(52, 211, 153, 0.25)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.75rem",
              margin: "0 auto 1.5rem",
            }}
          >
            ✉️
          </div>

          <h1 className="auth-title" style={{ textAlign: "center" }}>Check your email</h1>
          <p className="auth-subtitle" style={{ textAlign: "center" }}>
            If an account exists for <strong style={{ color: "var(--color-primary-light)" }}>{email}</strong>,
            you'll receive a password reset link shortly.
          </p>

          <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <button
              id="try-again-reset-btn"
              className="btn btn-secondary"
              onClick={() => { setStatus("idle"); setEmail(""); }}
            >
              Try a different email
            </button>
            <p className="auth-footer-text">
              <Link to="/login" className="auth-link">← Back to Sign In</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">🗳️</div>
          <div>
            <div className="auth-logo-text">UniVote</div>
            <div className="auth-logo-sub">University Voting System</div>
          </div>
        </div>

        <h1 className="auth-title">Reset password</h1>
        <p className="auth-subtitle">
          Enter your university email and we'll send you a link to reset your password.
        </p>

        {errorMessage && (
          <div className="alert alert-error" role="alert">
            <span>⚠</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="reset-email">University Email</label>
            <input
              id="reset-email"
              type="email"
              className="form-input"
              placeholder="you@university.edu.gh"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrorMessage(""); }}
              autoComplete="email"
              autoFocus
            />
          </div>

          <button
            id="reset-submit-btn"
            type="submit"
            className="btn btn-primary"
            disabled={status === "loading"}
            style={{ marginTop: "0.5rem" }}
          >
            {status === "loading" ? (
              <>
                <span className="spinner spinner-sm" />
                Sending reset link…
              </>
            ) : (
              "Send Reset Link"
            )}
          </button>
        </form>

        <p className="auth-footer-text">
          Remember your password?{" "}
          <Link to="/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
