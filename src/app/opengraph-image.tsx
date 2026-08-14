import { ImageResponse } from "next/og";

/**
 * The Open Graph card, generated at the edge from the same paths as the
 * monogram — no binary asset to keep in sync with the brand marks.
 *
 * Serif wordmark and gold-on-ink palette match the site; WhatsApp, Slack,
 * and X all render this when the store is shared.
 */

export const runtime = "edge";
export const alt = "Avenues — eau de parfum, made in India";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0B0B0D",
          backgroundImage:
            "radial-gradient(720px 480px at 50% 38%, rgba(201,162,75,0.14), rgba(11,11,13,0) 65%)",
        }}
      >
        {/* The monogram — identical paths to src/components/brand/monogram.tsx */}
        <svg viewBox="0 0 100 100" width="228" height="228">
          <defs>
            <linearGradient id="g" x1="18%" y1="0%" x2="82%" y2="100%">
              <stop offset="0%" stopColor="#F0DBA4" />
              <stop offset="34%" stopColor="#C9A24B" />
              <stop offset="68%" stopColor="#A67C2E" />
              <stop offset="100%" stopColor="#E0BE72" />
            </linearGradient>
          </defs>
          <path d="M69.4 14.2 A43 43 0 1 1 30.6 14.2 A39 39 0 1 0 69.4 14.2 Z" fill="url(#g)" />
          <path d="M50 20 L74.5 76 L63.5 76 L50 44 L37.5 76 L30.5 76 Z" fill="url(#g)" />
          <path
            d="M27 71.5 C36 60 56 55 71 56.8 C81 58 89 62.5 94 69.5 C88.5 63.5 80.5 59.8 71 58.7 C56.5 57 39.5 61.8 27 71.5 Z"
            fill="url(#g)"
          />
        </svg>

        <div
          style={{
            marginTop: 44,
            fontSize: 64,
            letterSpacing: "0.42em",
            // Compensate the trailing letter-space after the final S.
            paddingLeft: "0.42em",
            color: "#F2EDE3",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontWeight: 400,
          }}
        >
          AVENUES
        </div>

        <div
          style={{
            marginTop: 22,
            fontSize: 21,
            letterSpacing: "0.34em",
            paddingLeft: "0.34em",
            textTransform: "uppercase",
            color: "#C9A24B",
          }}
        >
          Eau de parfum · Made in India
        </div>
      </div>
    ),
    size,
  );
}
