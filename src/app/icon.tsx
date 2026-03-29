import { ImageResponse } from "next/og";

export const size        = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 7,
        }}
      >
        <div
          style={{
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "-0.5px",
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
