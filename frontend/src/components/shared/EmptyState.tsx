import { type ReactNode } from "react";
import { Inbox } from "lucide-react";

import { cn } from "../../lib/cn";
import { Button } from "../ui/button";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 p-8 text-center animate-fade",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="text-sm font-semibold tracking-tight text-foreground mb-1">
        {title}
      </h3>
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground mb-5">
        {description}
      </p>
      {action && (
        <Button size="sm" variant="outline" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
