import { Loader2 } from "lucide-react";

import { cn } from "../../lib/cn";

export interface LoadingStateProps {
  label?: string;
  subtext?: string;
  className?: string;
}

export function LoadingState({
  label = "Loading...",
  subtext,
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[240px] flex-col items-center justify-center p-8 text-center",
        className,
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin text-primary mb-3" />
      <p className="text-sm font-medium text-foreground">{label}</p>
      {subtext && (
        <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>
      )}
    </div>
  );
}
