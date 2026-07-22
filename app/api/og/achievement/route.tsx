import { ImageResponse } from "next/og";

export const runtime = "edge";

/**
 * Generates a branded, shareable achievement card (1200x630 PNG) from query
 * params, using Next's built-in OG image renderer (no external deps).
 * Consumed by the profile "passport" Share / Save buttons.
 *
 * /api/og/achievement?name=Ali&level=6&title=Expert&points=2450&streak=12
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clean = (v: string | null, fallback: string, max = 40) =>
    (v ?? fallback).slice(0, max);

  const name = clean(searchParams.get("name"), "Averna Student", 28);
  const level = clean(searchParams.get("level"), "1", 3);
  const title = clean(searchParams.get("title"), "Rookie", 20);
  const points = clean(searchParams.get("points"), "0", 12);
  const streak = clean(searchParams.get("streak"), "0", 6);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #04070d 0%, #08131a 55%, #0a0f1e 100%)",
          color: "white",
          padding: "64px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "#00ff94",
              color: "#04070d",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 18,
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            A
          </div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: 3 }}>AVERNA</div>
        </div>

        {/* Center */}
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* Level medallion */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: 260,
              height: 260,
              borderRadius: 260,
              border: "12px solid rgba(0,229,255,0.55)",
              background: "rgba(0,229,255,0.08)",
              marginRight: 56,
            }}
          >
            <div style={{ display: "flex", fontSize: 128, fontWeight: 800, color: "#00e5ff", lineHeight: 1 }}>
              {level}
            </div>
            <div style={{ display: "flex", fontSize: 26, color: "#9fb3c8", marginTop: 6, letterSpacing: 4 }}>LEVEL</div>
          </div>

          {/* Identity + stats */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 36, color: "#9fb3c8" }}>{title}</div>
            <div style={{ display: "flex", fontSize: 76, fontWeight: 800, marginTop: 2 }}>{name}</div>
            <div style={{ display: "flex", marginTop: 30 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "16px 30px",
                  borderRadius: 22,
                  background: "rgba(255,255,255,0.06)",
                  marginRight: 22,
                }}
              >
                <div style={{ display: "flex", fontSize: 44, fontWeight: 800, color: "#00ff94" }}>{points}</div>
                <div style={{ display: "flex", fontSize: 22, color: "#9fb3c8" }}>points</div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "16px 30px",
                  borderRadius: 22,
                  background: "rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ display: "flex", fontSize: 44, fontWeight: 800, color: "#ff8a3d" }}>{streak}</div>
                <div style={{ display: "flex", fontSize: 22, color: "#9fb3c8" }}>day streak</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", fontSize: 26, color: "#7a8ba0" }}>
          My IELTS journey on Averna Learning Centre
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
