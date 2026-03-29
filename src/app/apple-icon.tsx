import { ImageResponse } from "next/og";

export const size        = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2E7D32",
          borderRadius: 36,
        }}
      >
        <div
          style={{
            color: "#fff",
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: "-2px",
            fontFamily: "sans-serif",
            lineHeight: 1,
          }}
        >
          FR
        </div>
      </div>
    ),
    { ...size },
  );
}
