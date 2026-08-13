import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { auth, sendVerificationEmail, logoutUser } from "../lib/firebase";
import { verifyStudent } from "../services/api";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";

export function VerifyEmailPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [verificationStep, setVerificationStep] = useState<"idle" | "verifying_student" | "verified_success" | "verification_failed">("idle");
  const [verificationError, setVerificationError] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleResend = async () => {
    if (!user || countdown > 0) return;
    setResendStatus("sending");
    try {
      await sendVerificationEmail(user);
      setResendStatus("sent");
      setCountdown(60);
    } catch {
      setResendStatus("error");
    }
  };

  const handleCheckVerification = async () => {
    setCheckingStatus(true);
    setVerificationError("");
    setVerificationStep("idle");

    try {
      await refreshUser();

      if (auth?.currentUser?.emailVerified) {
        setVerificationStep("verifying_student");

        try {
          await verifyStudent();
          setVerificationStep("verified_success");
          setTimeout(() => {
            navigate("/dashboard");
          }, 1200);
          return;
        } catch (err: any) {
          setVerificationStep("verification_failed");
          setVerificationError(
            err?.detail ||
              "We couldn't verify your student information. Please check that your Student ID and university email match your official student records."
          );
          return;
        }
      }
      setVerificationStep("verification_failed");
      setVerificationError("Your email is not verified yet. Please use the link in your inbox, then try again.");
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login");
  };

  return (
    <>
      <Header />
      <main className="page-container">
        <div className="auth-card-container" style={{ textAlign: "center" }}>
          {/* Badge Icon */}
          <div className="verify-icon-container">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <div className="verify-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
          </div>

          <h1 className="auth-title">Verify Your Account</h1>
          <p className="auth-subtitle" style={{ marginBottom: "1.75rem" }}>
            We've sent a verification link to your university email. Please click the link in your email and confirm below.
          </p>

          {resendStatus === "sent" && (
            <div className="alert alert-success" style={{ textAlign: "left" }}>
              <span>✓</span>
              <span>Verification email resent successfully.</span>
            </div>
          )}
          {resendStatus === "error" && (
            <div className="alert alert-error" style={{ textAlign: "left" }}>
              <span>⚠</span>
              <span>Failed to resend email. Try again in a moment.</span>
            </div>
          )}

          {verificationStep === "verifying_student" && (
            <div className="alert alert-info" style={{ textAlign: "left", marginBottom: "1rem" }}>
              <span className="spinner spinner-sm" />
              <span>Verifying your student information...</span>
            </div>
          )}

          {verificationStep === "verified_success" && (
            <div className="alert alert-success" style={{ textAlign: "left", marginBottom: "1rem" }}>
              <span>✓</span>
              <span>Student account verified. Redirecting to dashboard...</span>
            </div>
          )}

          {verificationStep === "verification_failed" && (
            <div className="alert alert-error" style={{ textAlign: "left", marginBottom: "1rem" }}>
              <span>⚠</span>
              <span>{verificationError}</span>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <button
              id="check-verification-btn"
              type="button"
              className="btn btn-primary"
              onClick={handleCheckVerification}
              disabled={checkingStatus}
            >
              {checkingStatus ? (
                <>
                  <span className="spinner spinner-sm" />
                  Verifying…
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  I've Verified My Email
                </>
              )}
            </button>

            <button
              id="resend-email-btn"
              type="button"
              className="btn btn-outline"
              onClick={handleResend}
              disabled={resendStatus === "sending" || countdown > 0}
            >
              {resendStatus === "sending" ? (
                <>
                  <span className="spinner spinner-sm" />
                  Sending…
                </>
              ) : countdown > 0 ? (
                `Resend in ${countdown}s`
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  Resend Email
                </>
              )}
            </button>
          </div>

          <div style={{ marginTop: "2rem", paddingTop: "1.25rem", borderTop: "1px solid var(--color-border)" }}>
            <button
              id="logout-from-verify-btn"
              type="button"
              className="btn"
              style={{
                background: "transparent",
                color: "var(--color-text-title)",
                width: "auto",
                margin: "0 auto",
                display: "inline-flex",
                gap: "0.5rem"
              }}
              onClick={handleLogout}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Log Out
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
