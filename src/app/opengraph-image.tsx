import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo";

// Node.js runtime: the Edge Runtime is deprecated in Next 16 and warns on
// every boot. ImageResponse renders identically on nodejs.
export const runtime = "nodejs";
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
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
          justifyContent: "space-between",
          background: "linear-gradient(145deg, #0a0a0a 0%, #171717 55%, #262626 100%)",
          color: "#fafafa",
          padding: "64px",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#fafafa",
              color: "#0a0a0a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              fontWeight: 700,
            }}
          >
            K
          </div>
          <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: -0.5 }}>{SITE_NAME}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 980 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 650,
              lineHeight: 1.08,
              letterSpacing: -1.4,
            }}
          >
            Enterprise social operations control plane
          </div>
          <div style={{ fontSize: 28, color: "#d4d4d4", lineHeight: 1.35, maxWidth: 900 }}>
            Route sessions, generate AI drafts, approve safely, and publish to Instagram, Threads,
            and TikTok with full audit trails.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "#a3a3a3",
          }}
        >
          <div style={{ display: "flex", gap: 18 }}>
            <span>Session routing</span>
            <span>·</span>
            <span>Approval-first</span>
            <span>·</span>
            <span>AI drafts</span>
          </div>
          <div>komenin</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
