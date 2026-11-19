import { type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/cn";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium tracking-tight transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-primary/10 text-primary hover:bg-primary/15",
        secondary:
          "border border-border bg-secondary text-secondary-foreground",
        outline:
          "border border-border text-foreground bg-transparent",
        success:
          "border border-emerald-500/20 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
        warning:
          "border border-amber-500/20 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
        destructive:
          "border border-destructive/20 bg-destructive/10 text-destructive",
        muted:
          "border border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
