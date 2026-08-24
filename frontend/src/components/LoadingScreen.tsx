import Loader from "./Loader";

export function CubeSpinner() {
  return <Loader />;
}

export function LoadingScreen({ message }: { message?: string }) {
  return (
    <div className="auth-loading-screen">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2.5rem" }}>
        <Loader />
        {message && (
          <p
            style={{
              color: "var(--color-text-secondary, #64748b)",
              fontSize: "0.9375rem",
              fontWeight: 500,
              letterSpacing: "0.025em",
            }}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

export default LoadingScreen;
