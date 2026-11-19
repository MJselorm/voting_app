import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";

import { Button } from "../components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center px-4 animate-fade">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-primary mb-6">
        <Compass className="h-8 w-8" />
      </div>

      <span className="text-xs font-bold uppercase tracking-widest text-primary mb-2">
        Error 404
      </span>

      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-3">
        Page not found
      </h1>

      <p className="max-w-md text-sm text-muted-foreground mb-8 leading-relaxed">
        The requested resource, election workspace, or ballot portal could not be found or may have been relocated.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link to="/">
          <Button variant="default" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <Link to="/app">
          <Button variant="outline">
            Go to Dashboard Preview
          </Button>
        </Link>
      </div>
    </div>
  );
}
