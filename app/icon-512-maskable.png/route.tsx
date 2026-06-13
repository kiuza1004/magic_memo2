import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0f17",
          color: "#ffffff",
          fontSize: 200,
          fontWeight: 800,
          letterSpacing: -8,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        ML
      </div>
    ),
    { width: 512, height: 512 },
  );
}
