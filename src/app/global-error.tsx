"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global app error", error.digest || error.name);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          background: "#0b0f14",
          color: "#e8eef6",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Aether hit an unexpected error</h1>
          <p style={{ color: "#9fb0c3", fontSize: 14, lineHeight: 1.5 }}>
            The app could not recover from a root-level failure. Reload the page or sign in again.
          </p>
          {error.digest ? (
            <p style={{ color: "#6f8296", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
              Ref: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 16,
              border: "1px solid #2a3a4d",
              background: "#15202b",
              color: "#e8eef6",
              borderRadius: 8,
              padding: "10px 14px",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
