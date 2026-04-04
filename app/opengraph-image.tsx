import { ImageResponse } from "next/og"
import { APP_TITLE } from "@/app/layout"

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = "image/png"

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-start",
          padding: "72px",
          color: "#000000",
        }}
      >
        <img
          src="/icon.svg"
          width={120}
          height={120}
          alt="One Calendar icon"
          style={{ marginBottom: "24px" }}
        />
        <div
          style={{
            fontSize: 72,
            fontWeight: 400,
            fontFamily: '"Instrument Sans", sans-serif',
            lineHeight: 1.1,
          }}
        >
          {APP_TITLE}
        </div>
      </div>
    ),
    {
      ...size,
    },
  )
}
