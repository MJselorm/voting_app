import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { Notice } from "../../../components/shared/Notice";
import { useAuth } from "../hooks/useAuth";
import { getAuthErrorMessage } from "../lib/authErrors";
import { AuthLayout } from "../components/AuthLayout";
import { FormField, FormHeading } from "../components/FormField";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "../schemas/authSchemas";

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const submit = handleSubmit(async ({ email }) => {
    setMessage("");
    setError("");
    setBusy(true);
    try {
      await resetPassword(email);
      setMessage("If an account exists for this email, Firebase will send a password reset link.");
    } catch (cause) {
      setError(getAuthErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  });

  return (
    <AuthLayout>
      <FormHeading eyebrow="ACCOUNT RECOVERY" title="Reset your password">
        Enter your email and Firebase will send a password reset link.
      </FormHeading>
      {message && <Notice variant="success" className="mb-4">{message}</Notice>}
      {error && <Notice className="mb-4">{error}</Notice>}
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <FormField label="Email address" error={errors.email?.message} inputProps={{
          type: "email", autoComplete: "email", ...register("email"),
        }} />
        <Button disabled={busy} type="submit">{busy ? "Sending…" : "Send reset link"}</Button>
      </form>
      <p className="mb-0 mt-5 text-center text-[13px]"><Link to="/login">Back to sign in</Link></p>
    </AuthLayout>
  );
}
