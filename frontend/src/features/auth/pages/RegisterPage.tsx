import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { Notice } from "../../../components/shared/Notice";
import { useAuth } from "../hooks/useAuth";
import { getAuthErrorMessage } from "../lib/authErrors";
import { AuthLayout } from "../components/AuthLayout";
import { FormField, FormHeading } from "../components/FormField";
import { registrationSchema, type RegistrationFormValues } from "../schemas/authSchemas";

export function RegisterPage() {
  const { register: createAccount } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { fullName: "", email: "", password: "", passwordConfirmation: "" },
  });

  const submit = handleSubmit(async ({ fullName, email, password }) => {
    setMessage("");
    setBusy(true);
    try {
      await createAccount(fullName, email, password);
      navigate("/verify-email", { replace: true });
    } catch (error) {
      setMessage(getAuthErrorMessage(error));
    } finally {
      setBusy(false);
    }
  });

  return (
    <AuthLayout>
      <FormHeading eyebrow="GET STARTED" title="Create your account">
        Use any valid email address. You can verify it after signing up.
      </FormHeading>
      {message && <Notice className="mb-4">{message}</Notice>}
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <FormField label="Full name" error={errors.fullName?.message} inputProps={{
          autoComplete: "name", ...register("fullName"),
        }} />
        <FormField label="Email address" error={errors.email?.message} inputProps={{
          type: "email", autoComplete: "email", ...register("email"),
        }} />
        <FormField label="Password" hint="Use at least 8 characters." error={errors.password?.message} inputProps={{
          type: "password", autoComplete: "new-password", ...register("password"),
        }} />
        <FormField label="Confirm password" error={errors.passwordConfirmation?.message} inputProps={{
          type: "password", autoComplete: "new-password", ...register("passwordConfirmation"),
        }} />
        <Button className="mt-1 w-full" disabled={busy} type="submit">
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mb-0 mt-5 text-center text-[13px] text-muted-foreground">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
