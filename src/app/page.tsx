/**
 * Placeholder landing page for M0. The real pre-join / meeting flows land in M1+.
 */
export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "3rem", margin: 0, color: "var(--color-accent)" }}>Hearth</h1>
      <p style={{ color: "var(--color-text-muted)", maxWidth: "32rem", margin: 0 }}>
        Self-hosted video conferencing. Foundation is up (M0) — meeting flows arrive in the
        next milestone.
      </p>
      <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
        Service health:{" "}
        <a href="/api/health" style={{ fontFamily: "monospace" }}>
          /api/health
        </a>
      </p>
    </main>
  );
}
