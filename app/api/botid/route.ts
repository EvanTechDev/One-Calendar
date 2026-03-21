import { NextRequest, NextResponse } from "next/server";

type BotIdChallenge = {
  b?: number;
  d?: number;
};

function parseChallenge(rawHeader: string | null): BotIdChallenge | null {
  if (!rawHeader) return null;

  try {
    const parsed = JSON.parse(rawHeader) as BotIdChallenge;
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const challenge = parseChallenge(request.headers.get("x-is-human"));

  // Login / sign-up / reset flows must never be hard-blocked by BotID,
  // because false positives on this endpoint prevent legitimate users from authenticating.
  // We still expose whether the client challenge was present for future debugging.
  return NextResponse.json({
    success: true,
    skipped: true,
    hasChallenge: challenge !== null,
    challengeRequiresAnalysis: challenge?.d === 1,
  });
}
