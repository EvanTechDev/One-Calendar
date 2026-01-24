
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getFcConfig() {
  const sitekey = process.env.FC_SITEKEY || "";
  const apiKey = process.env.FC_API_KEY || "";
  const secret = process.env.FC_SECRET_KEY || "";

  const forced = (process.env.FC_VERSION || "").toLowerCase();
  const version: "v1" | "v2" =
    forced === "v2" ? "v2" : forced === "v1" ? "v1" : apiKey ? "v2" : "v1";

  const hasAnyFcEnv = Object.keys(process.env).some((k) => k.startsWith("FC_"));

  return {
    enabled: hasAnyFcEnv && Boolean(sitekey),
    sitekey: sitekey || undefined,
    version,
    serverVerifyReady: version === "v2" ? Boolean(apiKey) : Boolean(secret),
  };
}

export async function GET() {
  return NextResponse.json(getFcConfig(), { status: 200 });
}
