export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center gap-3 p-6 text-muted-foreground" role="status" aria-live="polite">
      <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-border border-t-primary" aria-hidden="true" />
      <span>{label}</span>
    </main>
  );
}
