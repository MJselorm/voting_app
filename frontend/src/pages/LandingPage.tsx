import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Vote,
  Lock,
  ArrowRight,
  CheckCircle2,
  Building,
  BarChart2,
  Sliders,
  Award,
} from "lucide-react";

import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

export function LandingPage() {
  return (
    <div className="flex flex-col gap-24 py-12 md:py-20">
      {/* 1. Hero Section */}
      <section className="container text-center">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6">
          <Badge variant="default" className="gap-2 px-3 py-1 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            UniVote Enterprise Foundation
          </Badge>

          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl md:leading-[1.12]">
            Every voice. <br className="hidden sm:inline" />
            <span className="text-primary">One trusted platform.</span>
          </h1>

          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg sm:leading-relaxed">
            Centralized digital voting and polling for universities, faculties,
            associations, and modern organizations. Built with cryptographic
            integrity and multi-tenant separation.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link to="/app">
              <Button size="lg" className="gap-2 text-sm">
                Explore Dashboard Preview
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button variant="outline" size="lg" className="text-sm">
                Platform Capabilities
              </Button>
            </a>
          </div>

          <div className="flex items-center gap-6 pt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>Multi-Tenant Architecture</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>Auditable Ballots</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>Institutional Privacy</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Platform Value Overview */}
      <section id="features" className="container">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Designed for institutional governance
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            UniVote consolidates election administration, voter roster verification,
            and real-time tabulation into one unified, elegant workspace.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="transition-all hover:shadow-elevated">
            <CardContent className="p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">
                Multi-Tenant Isolation
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Universities can isolate departments, student bodies, faculties,
                or affiliated clubs within dedicated sub-tenants with tailored roles.
              </p>
            </CardContent>
          </Card>

          <Card className="transition-all hover:shadow-elevated">
            <CardContent className="p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Vote className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">
                Flexible Voting Systems
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Support for Single Transferable Vote (STV), First-Past-The-Post,
                Ranked Choice, and simple majority consensus votes.
              </p>
            </CardContent>
          </Card>

          <Card className="transition-all hover:shadow-elevated">
            <CardContent className="p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">
                Secret Ballot Guarantee
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Voter identity verification is cryptographically uncoupled from the
                cast ballot payload to ensure complete vote secrecy.
              </p>
            </CardContent>
          </Card>

          <Card className="transition-all hover:shadow-elevated">
            <CardContent className="p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BarChart2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">
                Transparent Tabulation
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Real-time participation tracking with embargoed outcome tallies
                until designated polling periods conclude.
              </p>
            </CardContent>
          </Card>

          <Card className="transition-all hover:shadow-elevated">
            <CardContent className="p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sliders className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">
                Adaptive Surveys & Polls
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Beyond statutory elections, conduct institutional surveys,
                constitutional amendments, and pulse sentiment polls easily.
              </p>
            </CardContent>
          </Card>

          <Card className="transition-all hover:shadow-elevated">
            <CardContent className="p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Award className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">
                Verifiable Audit Trail
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Every election exports a non-identifying cryptographic proof
                register allowing independent scrutiny and verification.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 3. Security and Trust Messaging */}
      <section id="security" className="container">
        <div className="rounded-2xl border border-border bg-card p-8 sm:p-12">
          <div className="mx-auto max-w-3xl text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Integrity by design, not by claim
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              UniVote ensures that every eligible voter can vote exactly once,
              no voter can be coerced into revealing their choice, and no
              administrator can tamper with cast votes after submission.
            </p>

            <div className="grid gap-6 pt-6 sm:grid-cols-3 text-left">
              <div className="space-y-1">
                <p className="font-semibold text-foreground text-sm">Strict Roster Validation</p>
                <p className="text-xs text-muted-foreground">Eligibility checks against official university or organization directories.</p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground text-sm">Zero Knowledge Decoupling</p>
                <p className="text-xs text-muted-foreground">Attendance tokens cannot be tied back to ballot ballot choices.</p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground text-sm">Immutable Records</p>
                <p className="text-xs text-muted-foreground">Append-only ballot storage prevents retrospective modification.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Bottom Call To Action */}
      <section className="container text-center">
        <div className="mx-auto max-w-2xl space-y-6">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Ready to experience UniVote?
          </h2>
          <p className="text-sm text-muted-foreground">
            Explore the authenticated dashboard preview to see how organizations,
            elections, and balloting are structured.
          </p>
          <Link to="/app">
            <Button size="lg" className="gap-2">
              Open Dashboard Preview
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
