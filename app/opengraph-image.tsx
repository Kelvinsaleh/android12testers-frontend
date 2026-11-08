import { ImageResponse } from "next/og";

export const alt = "Android Testers — 12 human testers, 15 days, $10 per campaign";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#101c31", color: "#ffffff", fontFamily: "Arial" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 25, fontWeight: 700 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "#d8fb72" }} />ANDROID TESTERS
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, lineHeight: 1.04, fontWeight: 800, letterSpacing: -3 }}>12 human testers.<br />15 focused days.</div>
          <div style={{ marginTop: 22, color: "#d8fb72", fontSize: 42, fontWeight: 700 }}>$10 per campaign</div>
        </div>
        <div style={{ color: "#aab6c8", fontSize: 19 }}>Human-led Android app closed testing</div>
      </div>
    ),
    { ...size },
  );
}
