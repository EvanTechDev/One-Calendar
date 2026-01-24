
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type VerifyBody = {
  solution?: string;
  response?: string;
  token?: string;
};

function pickVersion(): "v1" | "v2" {
  const forced = (process.env.FC_VERSION || "").toLowerCase();
  if (forced === "v2") return "v2";
  if (forced === "v1") return "v1";
  return process.env.FC_API_KEY ? "v2" : "v1";
}

async function verifyV1(solution: string) {
  const secret =
    process.env.FC_SECRET ||
    process.env.FC_SECRETKEY ||
    process.env.FC_SECRET_KEY ||
    "";
  const sitekey = process.env.FC_SITEKEY || process.env.FC_SITE_KEY || "";

  if (!secret) return { ok: false as const };

  const res = await fetch("https://api.friendlycaptcha.com/api/v1/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      solution,
      secret,
      sitekey: sitekey || undefined,
    }),
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  return { ok: Boolean(json?.success) as const };
}

async function verifyV2(responseToken: string) {
  const apiKey = process.env.FC_API_KEY || "";
  const sitekey = process.env.FC_SITEKEY || process.env.FC_SITE_KEY || "";

  if (!apiKey) return { ok: false as const };

  const res = await fetch("https://global.frcapi.com/api/v2/captcha/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      response: responseToken,
      sitekey: sitekey || undefined,
    }),
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  return { ok: Boolean(json?.success) as const };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as VerifyBody;
  const version = pickVersion();
  const token = body.token || body.solution || body.response || "";

  if (!token) {
    return NextResponse.json({ success: false, error: "missing_token" }, { status: 400 });
  }

  try {
    const result = version === "v2" ? await verifyV2(token) : await verifyV1(token);
    return NextResponse.json({ success: result.ok, version }, { status: 200 });
  } catch {
    return NextResponse.json({ success: false, error: "verify_failed" }, { status: 200 });
  }
}
``
