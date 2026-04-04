import { ImageResponse } from "next/og"
import { APP_SUBTITLE, APP_TITLE } from "@/app/layout"

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = "image/png"

const instrumentSansPromises = new Map<number, Promise<ArrayBuffer>>()

async function loadInstrumentSans(weight: 400 | 500) {
  const cached = instrumentSansPromises.get(weight)
  if (cached) {
    return cached
  }

  const promise = (async () => {
    const cssResponse = await fetch(
      `https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@${weight}&display=swap`,
    )
    const css = await cssResponse.text()
    const fontUrlMatch = css.match(/src: url\(([^)]+)\) format\('(opentype|truetype|woff2)'\)/)

    if (!fontUrlMatch?.[1]) {
      throw new Error(`Unable to resolve Instrument Sans ${weight} font URL`)
    }

    const fontResponse = await fetch(fontUrlMatch[1])
    return fontResponse.arrayBuffer()
  })()

  instrumentSansPromises.set(weight, promise)
  return promise
}

export default async function OpenGraphImage() {
  const [instrumentSans400, instrumentSans500] = await Promise.all([
    loadInstrumentSans(400),
    loadInstrumentSans(500),
  ])

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
          justifyContent: "space-between",
          padding: "72px",
          color: "#000000",
        }}
      >
        <svg
          width="120"
          height="120"
          viewBox="0 0 1000 1000"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g transform="translate(0,1000) scale(0.1,-0.1)" fill="#000000" stroke="none">
            <path d="M4960 8206 c-87 -24 -164 -70 -231 -136 -101 -101 -149 -217 -149 -360 0 -144 48 -259 150 -360 102 -102 218 -150 360 -150 140 0 264 53 365 156 194 198 194 508 0 709 -67 69 -165 125 -253 144 -68 14 -184 13 -242 -3z" />
            <path d="M3616 6859 c-109 -26 -239 -117 -307 -215 -97 -141 -111 -350 -34 -510 61 -126 166 -217 305 -264 55 -19 82 -21 175 -18 102 3 115 6 185 39 147 70 239 172 281 311 17 57 21 88 18 182 -4 109 -5 115 -46 198 -68 136 -202 245 -343 277 -54 13 -180 12 -234 0z" />
            <path d="M4963 6855 c-228 -64 -383 -263 -383 -493 0 -149 45 -259 149 -363 105 -105 212 -149 362 -149 188 0 345 90 443 254 70 117 85 297 35 434 -48 130 -170 250 -306 302 -75 29 -225 37 -300 15z" />
            <path d="M4940 5491 c-91 -29 -142 -61 -211 -130 -103 -103 -149 -214 -149 -361 0 -328 308 -570 629 -495 279 66 450 358 373 636 -46 164 -177 299 -340 349 -83 26 -224 26 -302 1z" />
            <path d="M4980 4149 c-81 -16 -188 -76 -255 -145 -97 -100 -145 -215 -145 -354 0 -147 46 -258 149 -361 105 -105 212 -149 362 -149 455 0 680 547 358 869 -121 122 -296 174 -469 140z" />
            <path d="M3601 2784 c-116 -31 -242 -125 -306 -229 -65 -105 -87 -283 -50 -410 61 -215 263 -365 490 -365 134 0 244 43 343 135 118 109 162 211 162 376 0 160 -46 267 -159 371 -103 96 -213 139 -351 137 -41 0 -99 -7 -129 -15z" />
            <path d="M4959 2785 c-85 -23 -162 -69 -229 -135 -102 -101 -150 -216 -150 -360 0 -147 57 -278 162 -374 205 -187 515 -181 709 13 157 157 193 397 91 600 -56 112 -196 223 -326 257 -63 17 -195 17 -257 -1z" />
            <path d="M6311 2784 c-76 -20 -146 -60 -212 -122 -113 -104 -159 -211 -159 -371 0 -189 74 -329 228 -431 103 -68 259 -97 385 -71 130 28 271 129 336 245 86 151 86 361 1 512 -38 65 -141 164 -208 198 -109 55 -256 71 -371 40z" />
          </g>
        </svg>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 500,
              fontFamily: "Instrument Sans",
              lineHeight: 1.1,
            }}
          >
            {APP_TITLE}
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 400,
              fontFamily: "Instrument Sans",
              lineHeight: 1.2,
            }}
          >
            {APP_SUBTITLE}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Instrument Sans",
          data: instrumentSans400,
          style: "normal",
          weight: 400,
        },
        {
          name: "Instrument Sans",
          data: instrumentSans500,
          style: "normal",
          weight: 500,
        },
      ],
    },
  )
}
