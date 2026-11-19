import { Link } from "react-router-dom";
import { Vote } from "lucide-react";

import { cn } from "../../lib/cn";

export function Brand({
  to = "/",
  collapsed = false,
  className,
}: {
  to?: string;
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center gap-2.5 font-sans tracking-tight text-foreground select-none group",
        className,
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-subtle transition-transform group-hover:scale-105">
        <Vote className="h-4 w-4" aria-hidden="true" />
      </span>
      {!collapsed && (
        <span className="flex items-baseline gap-1 text-base font-bold tracking-tight">
          <span>UniVote</span>
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        </span>
      )}
    </Link>
  );
}
