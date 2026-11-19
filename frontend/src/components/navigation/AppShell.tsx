import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Compass,
  FileText,
  PlusCircle,
  Shield,
  User,
  Vote,
  CheckSquare,
  Award,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";

import { Brand } from "../../components/shared/Brand";
import { Avatar } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { cn } from "../../lib/cn";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useUserProfile } from "../../features/auth/hooks/useUserProfile";

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: string;
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { data: profile } = useUserProfile();
  const displayName = profile?.full_name ?? user?.displayName ?? user?.email ?? "Account";
  const email = profile?.email ?? user?.email ?? "";

  // Dynamic Navigation Groups tailored to UniVote modules
  const navGroups: Array<{ title?: string; items: NavItem[] }> = [
    {
      items: [
        { label: "Dashboard", href: "/app", icon: LayoutDashboard },
        { label: "My Profile", href: "/app/profile", icon: User },
      ],
    },
    {
      title: "Organisations",
      items: [
        { label: "Discover Organisations", href: "/app/organizations", icon: Compass },
        { label: "My Organisations", href: "/app/organizations/mine", icon: Building2 },
        { label: "Organisation Requests", href: "/app/organizations/requests", icon: FileText },
        { label: "Request Organisation", href: "/app/organizations/request", icon: PlusCircle },
      ],
    },
    ...(profile?.is_platform_super_admin
      ? [{
          title: "Platform Administration",
          items: [
            { label: "Organisation Console", href: "/app/organizations/admin", icon: Shield },
          ],
        }]
      : []),
    {
      title: "Upcoming Modules",
      items: [
        { label: "Elections", href: "/app/elections", icon: Vote, badge: "Upcoming" },
        { label: "Polls & Surveys", href: "/app/polls", icon: CheckSquare, badge: "Upcoming" },
        { label: "Ballot Booth", href: "/app/voting", icon: CheckSquare, badge: "Upcoming" },
        { label: "Results & Tally", href: "/app/results", icon: Award, badge: "Upcoming" },
      ],
    },
  ];

  // Find active title for breadcrumb
  const allItems = navGroups.flatMap((g) => g.items);
  const currentNav = allItems.find((item) =>
    item.href === "/app"
      ? location.pathname === "/app"
      : location.pathname === item.href ||
        (item.href !== "/app/organizations" && location.pathname.startsWith(item.href)),
  );

  const currentPageTitle = currentNav?.label ?? "Organisations";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-200 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0 shadow-elevated" : "-translate-x-full",
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-border/70 px-5">
          <Brand to="/app" />
          <button
            type="button"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close sidebar</span>
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" aria-label="Main Navigation">
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              {group.title && (
                <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  {group.title}
                </p>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/app"
                    ? location.pathname === "/app"
                    : location.pathname === item.href;

                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors select-none",
                      isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground",
                      )}
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Account / Sidebar Tab for Profile */}
        <div className="border-t border-border/80 p-3">
          <Link
            to="/app/profile"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted group"
          >
            <Avatar name={displayName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground group-hover:text-primary">
                {displayName}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {email}
              </p>
            </div>
          </Link>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open sidebar</span>
            </button>

            {/* Breadcrumb / Title */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link to="/app" className="hover:text-foreground">UniVote</Link>
              <span>/</span>
              <span className="font-semibold text-foreground">{currentPageTitle}</span>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            <Link to="/" target="_blank" rel="noreferrer" className="hidden sm:inline-flex">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <span>Public Portal</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Link>

            {/* Account Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger>
                <div className="flex items-center gap-2 cursor-pointer rounded-full p-1 transition-colors hover:bg-muted">
                  <Avatar name={displayName} size="sm" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="font-semibold text-foreground">{displayName}</p>
                  <p className="text-[11px] font-normal text-muted-foreground truncate">{email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/app/profile")}>
                  <User className="h-3.5 w-3.5 mr-2" />
                  <span>Profile Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/app/organizations/mine")}>
                  <Building2 className="h-3.5 w-3.5 mr-2" />
                  <span>My Organisations</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onClick={() => void logout()}>
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main Content Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
