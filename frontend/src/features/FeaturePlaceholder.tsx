import { ArrowLeft, Layers } from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";

export function FeaturePlaceholder({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <section className="mx-auto max-w-2xl py-6 animate-fade">
      <Link
        to="/app"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Dashboard Overview
      </Link>

      <Card className="p-8">
        <CardContent className="p-0">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Layers className="h-6 w-6" aria-hidden="true" />
          </div>

          <Badge variant="outline" className="mb-3 text-[10px] font-mono uppercase tracking-wider">
            Architecture Boundary
          </Badge>

          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
            {title}
          </h1>

          <p className="max-w-prose text-xs sm:text-sm leading-relaxed text-muted-foreground mb-6">
            {description ??
              `This modular boundary is established for ${title.toLowerCase()}. Its components, API services, and domain models will be built in subsequent stages without restructuring the frontend foundation.`}
          </p>

          <div className="rounded-lg border border-border/80 bg-muted/40 p-4 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">Feature Directory Location:</p>
            <code className="text-primary font-mono text-[11px]">
              frontend/src/features/{title.toLowerCase().replace(/[^a-z0-9]/g, "")}/
            </code>
          </div>

          <div className="mt-6 flex justify-end">
            <Link to="/app">
              <Button size="sm" variant="outline">
                Return to Overview
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
