"use client";

import { useEffect } from "react";

/**
 * The last line of defence: an error thrown by the ROOT LAYOUT itself.
 *
 * `error.tsx` sits inside the layout, so it cannot catch a failure in the thing
 * that renders it. If the root layout throws — a bad font load, a provider
 * blowing up, an environment variable missing at request time — only this file
 * runs, and it replaces the entire document. That is why it has to ship its own
 * <html> and <body>: there is no shell left to sit inside.
 *
 * For the same reason it uses inline styles and no imports beyond React. This
 * file has to work when the app's own CSS, fonts and components are exactly
 * what failed, so depending on any of them would risk the error page throwing
 * inside the error page and leaving the browser with nothing at all.
 *
 * The palette is written literally rather than pulled from Tailwind for that
 * reason. It is duplication, and it is deliberate.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error.digest, error.message);
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
          background: "#0B0B0D",
          color: "#F2EDE3",
          fontFamily: "Georgia, 'Times New Roman', serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "30rem", textAlign: "center" }}>
          <div
            style={{
              fontSize: "13px",
              letterSpacing: "0.36em",
              textTransform: "uppercase",
              color: "#C9A24B",
              fontFamily: "Arial, sans-serif",
            }}
          >
            Avenues
          </div>

          <h1 style={{ margin: "24px 0 0", fontSize: "30px", fontWeight: 300, lineHeight: 1.25 }}>
            The store is temporarily unavailable
          </h1>

          <p
            style={{
              margin: "16px 0 0",
              fontSize: "15px",
              lineHeight: 1.7,
              color: "#9A938A",
              fontFamily: "Arial, sans-serif",
            }}
          >
            We are already looking into it. Nothing you were doing has been lost —
            please try again in a moment.
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "32px",
              background: "#C9A24B",
              color: "#0B0B0D",
              border: 0,
              padding: "16px 30px",
              fontSize: "11px",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontFamily: "Arial, sans-serif",
              cursor: "pointer",
            }}
          >
            Try again
          </button>

          {error.digest && (
            <p
              style={{
                margin: "36px 0 0",
                fontSize: "12px",
                color: "#868075",
                fontFamily: "Arial, sans-serif",
              }}
            >
              Reference {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
