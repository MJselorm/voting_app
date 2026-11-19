import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Chrome } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { Notice } from "../../../components/shared/Notice";
import { useAuth } from "../hooks/useAuth";
import { getAuthErrorMessage } from "../lib/authErrors";
import { AuthLayout } from "../components/AuthLayout";
import { FormField, FormHeading } from "../components/FormField";
import { loginSchema, type LoginFormValues } from "../schemas/authSchemas";

export function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const submit = handleSubmit(async ({ email, password }) => {
    setMessage("");
    setBusy(true);
    try {
      const user = await login(email, password);
      navigate(user.emailVerified ? "/dashboard" : "/verify-email", { replace: true });
    } catch (error) {
      setMessage(getAuthErrorMessage(error));
    } finally {
      setBusy(false);
    }
  });

  async function googleSignIn() {
    setMessage("");
    setBusy(true);
    try {
      const user = await loginWithGoogle();
      navigate(user.emailVerified ? "/dashboard" : "/verify-email", { replace: true });
    } catch (error) {
      setMessage(getAuthErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <FormHeading eyebrow="WELCOME BACK" title="Sign in to UniVote">
        Use your account to continue.
      </FormHeading>
      {message && <Notice className="mb-4">{message}</Notice>}
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <FormField label="Email address" error={errors.email?.message} inputProps={{
          type: "email", autoComplete: "email", ...register("email"),
        }} />
        <FormField label="Password" error={errors.password?.message} inputProps={{
          type: "password", autoComplete: "current-password", ...register("password"),
        }} />
        <div className="-mt-1 flex justify-end text-xs">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <Button className="w-full" disabled={busy} type="submit">
          {busy ? "Signing in…" : "Sign in"}
          {!busy && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
        </Button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
        <span>or</span>
      </div>
      <Button className="w-full" disabled={busy} onClick={() => void googleSignIn()} type="button" variant="outline">
        <Chrome className="h-4 w-4 text-primary" aria-hidden="true" />
        Continue with Google
      </Button>
      <p className="mb-0 mt-5 text-center text-[13px] text-muted-foreground">
        New to UniVote? <Link to="/register">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
