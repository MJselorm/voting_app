import type { ReactNode } from "react";

import { Brand } from "../../../components/shared/Brand";
import { Card } from "../../../components/ui/card";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-5 py-10">
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-blue-100/70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -right-36 h-[28rem] w-[28rem] rounded-full bg-emerald-100/70 blur-3xl" />
      <div className="relative z-10 mb-5"><Brand /></div>
      <Card className="relative z-10 w-full max-w-[456px] p-6 sm:p-9">{children}</Card>
      <p className="relative z-10 mt-4 text-center text-[11px] text-muted-foreground">
        Your account is protected by Firebase Authentication.
      </p>
    </main>
  );
}
