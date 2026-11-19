import { ArrowUpRight, BadgeCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { Notice } from "../../../components/shared/Notice";
import { buttonVariants } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { useAuth } from "../hooks/useAuth";
import { useUserProfile } from "../hooks/useUserProfile";

export function DashboardPage() {
  const { profileError, refreshProfile } = useAuth();
  const { data: profile, isLoading, error, refetch } = useUserProfile();

  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-7">
        <span className="mb-2 block text-[11px] font-extrabold tracking-[.13em] text-muted-foreground">ACCOUNT OVERVIEW</span>
        <h1 className="mb-1 font-display text-3xl font-extrabold tracking-tight text-foreground">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="m-0 text-sm text-muted-foreground">Your UniVote account is ready.</p>
      </div>
      {(profileError || error) && (
        <Notice className="mb-5">
          {profileError || (error instanceof Error ? error.message : "Your profile could not be loaded.")}
          {" "}
          <button className="font-bold underline" onClick={() => {
            void refreshProfile();
            void refetch();
          }} type="button">Try again</button>
        </Notice>
      )}
      {isLoading && <p className="text-sm text-muted-foreground" role="status">Loading your account…</p>}
      <Card className="mb-5 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Signed in as</span>
          <strong className="text-sm">{profile?.email ?? "Loading…"}</strong>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800">
          <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Email verified
        </span>
      </Card>
      <Card className="flex items-start gap-4 p-5 sm:p-6">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
          <BadgeCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="mb-1 font-display text-base font-bold">Account foundation complete</h2>
          <p className="mb-3 text-[13px] leading-5 text-muted-foreground">
            Firebase manages your sign-in and your UniVote profile is stored in Neon.
          </p>
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} to="/profile">
            View profile <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </Card>
    </section>
  );
}
