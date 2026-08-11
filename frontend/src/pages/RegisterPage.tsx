import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FirebaseError } from "firebase/app";
import { registerUser, sendVerificationEmail } from "../lib/firebase";
import { syncUser, type ApiError } from "../services/api";

function validateForm(fields: {
  fullName: string;
  studentId: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!fields.fullName.trim()) errors.fullName = "Full name is required.";
  else if (fields.fullName.trim().length < 3) errors.fullName = "Name must be at least 3 characters.";
  if (!fields.studentId.trim()) errors.studentId = "Student ID is required.";
  if (!fields.email.trim()) errors.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) errors.email = "Enter a valid email address.";
  if (!fields.password) errors.password = "Password is required.";
  else if (fields.password.length < 8) errors.password = "Password must be at least 8 characters.";
  else if (!/(?=.*[A-Z])/.test(fields.password)) errors.password = "Password must contain at least one uppercase letter.";
  else if (!/(?=.*\d)/.test(fields.password)) errors.password = "Password must contain at least one number.";
  else if (!/(?=.*[^A-Za-z0-9])/.test(fields.password)) errors.password = "Password must contain at least one symbol.";
  if (!fields.confirmPassword) errors.confirmPassword = "Please confirm your password.";
  else if (fields.password !== fields.confirmPassword) errors.confirmPassword = "Passwords do not match.";

  return errors;
}

function parseFirebaseError(error: FirebaseError): string {
  switch (error.code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try logging in.";
    case "auth/invalid-email":
      return "The email address is not valid.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 8 characters with uppercase, number, and symbol.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment before trying again.";
    default:
      return "Registration failed. Please try again.";
  }
}

function parseApiError(error: unknown): string {
  if (typeof error === "object" && error !== null && "detail" in error) {
    const apiError = error as ApiError;
    return apiError.detail || "We couldn't complete registration because the backend verification failed.";
  }
  return "We couldn't complete registration because the backend verification failed.";
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    studentId: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    setGlobalError("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    setGlobalError("");

    try {
      const credential = await registerUser(form.email, form.password);
      const firebaseUser = credential.user;

      try {
        await syncUser({
          full_name: form.fullName.trim(),
          email: form.email.trim(),
          student_id: form.studentId.trim() || undefined,
        });
      } catch (syncErr) {
        setGlobalError(parseApiError(syncErr));
        return;
      }

      await sendVerificationEmail(firebaseUser);
      navigate("/verify-email");
    } catch (err) {
      if (err instanceof FirebaseError) setGlobalError(parseFirebaseError(err));
      else setGlobalError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup-shell">
      <div className="signup-card">
        <aside className="signup-visual" aria-hidden="true">
          <div className="signup-visual-badge">UniVote</div>
          <div className="signup-visual-copy">
            <h2>Secure, student-first voting</h2>
            <p>Register with your university email and Student ID to join campus elections safely.</p>
          </div>
        </aside>

        <section className="signup-form-panel">
          <div className="auth-logo">
            <div className="auth-logo-icon">🗳️</div>
            <div>
              <div className="auth-logo-text">UniVote</div>
              <div className="auth-logo-sub">University Voting System</div>
            </div>
          </div>

          <h1 className="auth-title">Create Your Account</h1>
          <p className="auth-subtitle">
            Register to participate in university elections and student awards.
          </p>

          <div className="signup-info-box">
            <span className="signup-info-icon">i</span>
            <p>Your Student ID helps us determine which elections you are eligible to participate in.</p>
          </div>

          {globalError && (
            <div className="alert alert-error" role="alert">
              <span>⚠</span>
              <span>{globalError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="signup-form">
            <div className="form-group">
              <label className="form-label" htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                className={`form-input ${fieldErrors.fullName ? "error" : ""}`}
                placeholder="Enter your full name"
                value={form.fullName}
                onChange={handleChange}
                autoComplete="name"
                aria-describedby={fieldErrors.fullName ? "fullName-error" : undefined}
              />
              {fieldErrors.fullName && <p id="fullName-error" className="form-error"><span>⚠</span> {fieldErrors.fullName}</p>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="studentId">Student ID</label>
              <input
                id="studentId"
                name="studentId"
                type="text"
                className={`form-input ${fieldErrors.studentId ? "error" : ""}`}
                placeholder="e.g. 12345678"
                value={form.studentId}
                onChange={handleChange}
                autoComplete="off"
                aria-describedby={fieldErrors.studentId ? "studentId-error" : undefined}
              />
              {fieldErrors.studentId && <p id="studentId-error" className="form-error"><span>⚠</span> {fieldErrors.studentId}</p>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">University Email</label>
              <input
                id="reg-email"
                name="email"
                type="email"
                className={`form-input ${fieldErrors.email ? "error" : ""}`}
                placeholder="student@university.edu"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
              />
              {fieldErrors.email && <p id="email-error" className="form-error"><span>⚠</span> {fieldErrors.email}</p>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">Password</label>
              <input
                id="reg-password"
                name="password"
                type="password"
                className={`form-input ${fieldErrors.password ? "error" : ""}`}
                placeholder="Create a password"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
                aria-describedby={fieldErrors.password ? "password-error" : undefined}
              />
              {fieldErrors.password && <p id="password-error" className="form-error"><span>⚠</span> {fieldErrors.password}</p>}
            </div>

            <div className="signup-password-hint">
              <p className="signup-hint-title">Requirements</p>
              <ul>
                <li>At least 8 characters</li>
                <li>Uppercase and lowercase letters</li>
                <li>At least one number</li>
                <li>At least one symbol</li>
              </ul>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                className={`form-input ${fieldErrors.confirmPassword ? "error" : ""}`}
                placeholder="Confirm your password"
                value={form.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                aria-describedby={fieldErrors.confirmPassword ? "confirmPassword-error" : undefined}
              />
              {fieldErrors.confirmPassword && <p id="confirmPassword-error" className="form-error"><span>⚠</span> {fieldErrors.confirmPassword}</p>}
            </div>

            <button id="register-submit-btn" type="submit" className="btn btn-primary" disabled={isLoading} style={{ marginTop: "0.5rem" }}>
              {isLoading ? <><span className="spinner spinner-sm" /> Creating account…</> : "Create Account"}
            </button>
          </form>

          <p className="auth-footer-text">
            Already have an account? <Link to="/login" className="auth-link">Sign in</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
