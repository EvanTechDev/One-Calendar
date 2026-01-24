import { NextResponse } from "next/server";

export const runtime = "nodejs";

type FcVersion = "v1" | "v2";

function pickVersion(forced: string, apiKey: string): FcVersion {
  const f = (forced || "").toLowerCase();
  if (f === "v1") return "v1";
  if (f === "v2") return "v2";
  return apiKey ? "v2" : "v1";
}

function getFcConfig() {
  const sitekey = (process.env.FC_SITEKEY || "").trim();
  const apiKey = (process.env.FC_API_KEY || "").trim();
  const secret = (process.env.FC_SECRET_KEY || "").trim();
  const forced = (process.env.FC_VERSION || "").trim();

  const version = pickVersion(forced, apiKey);
  
  const enabled = Boolean(sitekey);

  const serverVerifyReady =
    version === "v2" ? Boolean(apiKey) : Boolean(secret);

  return {
    enabled,
    sitekey: sitekey || undefined,
    version,
    serverVerifyReady,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";

  const config = getFcConfig();

  if (debug && process.env.NODE_ENV !== "production") {
    const fcKeys = Object.keys(process.env).filter((k) => k.startsWith("FC_"));
    return NextResponse.json(
      {
        ...config,
        _debug: {
          nodeEnv: process.env.NODE_ENV,
          fcKeys,
          lengths: {
            FC_SITEKEY: (process.env.FC_SITEKEY || "").length,
            FC_API_KEY: (process.env.FC_API_KEY || "").length,
            FC_SECRET_KEY: (process.env.FC_SECRET_KEY || "").length,
            FC_VERSION: (process.env.FC_VERSION || "").length,
          },
        },
      },
      { status: 200 }
    );
  }

  return NextResponse.json(config, { status: 200 });
}
