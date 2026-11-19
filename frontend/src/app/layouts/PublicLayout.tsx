import { Link, Outlet } from "react-router-dom";
import { Brand } from "../../components/shared/Brand";
import { Button } from "../../components/ui/button";

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background selection:bg-primary/10 selection:text-primary">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Brand to="/" />

          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Platform
            </a>
            <a href="#security" className="transition-colors hover:text-foreground">
              Integrity & Trust
            </a>
            <a href="#organizations" className="transition-colors hover:text-foreground">
              Organizations
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/app">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                Live Preview
              </Button>
            </Link>
            <Link to="/app">
              <Button size="sm">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/80 bg-card py-12 text-xs text-muted-foreground">
        <div className="container flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <Brand to="/" />
            <span className="text-border">|</span>
            <p>Every voice. One trusted platform.</p>
          </div>
          <div className="flex gap-6">
            <span className="text-muted-foreground/80">
              © {new Date().getFullYear()} UniVote. Built for multi-tenant governance.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
