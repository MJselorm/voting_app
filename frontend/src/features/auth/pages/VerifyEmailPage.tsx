import { MailCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { Notice } from "../../../components/shared/Notice";
import { useAuth } from "../hooks/useAuth";
import { getAuthErrorMessage } from "../lib/authErrors";
import { AuthLayout } from "../components/AuthLayout";
import { FormHeading } from "../components/FormField";

export function VerifyEmailPage() {
  const { user, resendVerification, refreshEmailVerification, logout } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await resendVerification();
      setMessage("Verification email sent. Check your inbox.");
    } catch (cause) {
      setError(getAuthErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function checkVerification() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (await refreshEmailVerification()) navigate("/dashboard", { replace: true });
      else setMessage("Your email is not verified yet. Open the link we sent, then try again.");
    } catch (cause) {
      setError(getAuthErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <FormHeading eyebrow="ONE LAST STEP" title="Verify your email">
        We sent a verification link to <strong className="text-foreground">{user?.email}</strong>.
      </FormHeading>
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
        <MailCheck className="h-8 w-8" aria-hidden="true" />
      </div>
      {message && <Notice variant="success" className="mb-4">{message}</Notice>}
      {error && <Notice className="mb-4">{error}</Notice>}
      <div className="grid gap-3">
        <Button disabled={busy} onClick={() => void checkVerification()} type="button">
          {busy ? "Checking…" : "I have verified my email"}
        </Button>
        <Button disabled={busy} onClick={() => void resend()} type="button" variant="outline">
          Resend verification email
        </Button>
        <Button className="mx-auto" onClick={() => void logout()} type="button" variant="ghost">
          Sign out
        </Button>
      </div>
    </AuthLayout>
  );
}
