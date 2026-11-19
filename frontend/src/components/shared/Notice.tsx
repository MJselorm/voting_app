import type { ReactNode } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";

import { cn } from "../../lib/cn";

export function Notice({
  children,
  variant = "error",
  className,
}: {
  children: ReactNode;
  variant?: "error" | "success";
  className?: string;
}) {
  const Icon = variant === "error" ? CircleAlert : CircleCheck;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3.5 py-3 text-[13px] leading-5",
        variant === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800",
        className,
      )}
      role={variant === "error" ? "alert" : "status"}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
