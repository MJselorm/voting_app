import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "../../lib/cn";

interface DropdownContextType {
  open: boolean;
  setOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
}

const DropdownContext = createContext<DropdownContextType | null>(null);

export function DropdownMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div ref={containerRef} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export function DropdownMenuTrigger({
  children,
  asChild: _asChild,
}: {
  children: ReactNode;
  asChild?: boolean;
}) {
  const context = useContext(DropdownContext);
  if (!context) throw new Error("DropdownMenuTrigger must be inside DropdownMenu");

  return (
    <span
      className="inline-flex cursor-pointer"
      onClick={() => context.setOpen((prev) => !prev)}
    >
      {children}
    </span>
  );
}

export function DropdownMenuContent({
  children,
  align = "end",
  className,
}: HTMLAttributes<HTMLDivElement> & { align?: "start" | "end" }) {
  const context = useContext(DropdownContext);
  if (!context) throw new Error("DropdownMenuContent must be inside DropdownMenu");

  if (!context.open) return null;

  return (
    <div
      role="menu"
      className={cn(
        "absolute z-50 mt-2 min-w-[10rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-elevated animate-fade",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({
  children,
  className,
  onClick,
  destructive,
}: HTMLAttributes<HTMLDivElement> & { destructive?: boolean }) {
  const context = useContext(DropdownContext);

  return (
    <div
      role="menuitem"
      tabIndex={0}
      onClick={(e) => {
        onClick?.(e);
        context?.setOpen(false);
      }}
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs font-medium outline-none transition-colors hover:bg-muted focus:bg-muted",
        destructive && "text-destructive hover:bg-destructive/10 focus:bg-destructive/10",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DropdownMenuSeparator({ className }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("-mx-1 my-1 h-px bg-border", className)} />;
}

export function DropdownMenuLabel({
  children,
  className,
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
