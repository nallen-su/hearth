import JoinForm from "./JoinForm";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <div>
        <h1 style={{ fontSize: "3rem", margin: 0, color: "var(--color-accent)" }}>Hearth</h1>
        <p style={{ color: "var(--color-text-muted)", maxWidth: "32rem", margin: "0.5rem auto 0" }}>
          Self-hosted video conferencing. Start a meeting or join an existing room.
        </p>
      </div>

      <JoinForm />

      <p style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
        Service health:{" "}
        <a href="/api/health" style={{ fontFamily: "monospace" }}>
          /api/health
        </a>
      </p>
    </main>
  );
}
