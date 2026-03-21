import { checkBotId } from "botid/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const challengeHeader = request.headers.get("x-is-human");

  // Auth pages should not hard-fail when the BotID client script or headers are unavailable.
  if (!challengeHeader) {
    return NextResponse.json({
      success: true,
      skipped: true,
    });
  }

  const verification = await checkBotId();

  if (verification.isBot) {
    return NextResponse.json(
      { error: "Bot detected. Access denied." },
      { status: 403 },
    );
  }

  return NextResponse.json({ success: true });
}
