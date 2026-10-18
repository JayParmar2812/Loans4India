"use client";

/** Last-resort error page when the root layout itself fails. Plain HTML: the app's styles may not have loaded. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "4rem 1rem", color: "#14122b" }}>
        <h1 style={{ fontSize: "1.8rem" }}>Sorry, something went wrong</h1>
        <p>Please try again in a moment.{error.digest ? ` Reference: ${error.digest}` : ""}</p>
        <button onClick={() => retry()} style={{ marginTop: "1rem", padding: ".7rem 1.2rem", borderRadius: 12, border: 0, background: "#36d49f", fontWeight: 700 }}>
          Try again
        </button>
      </body>
    </html>
  );
}
