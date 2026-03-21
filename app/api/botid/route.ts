import { checkBotId } from "botid/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  await request.json().catch(() => null);

  const verification = await checkBotId();

  if (verification.isBot) {
    return NextResponse.json(
      { error: "Bot detected. Access denied." },
      { status: 403 },
    );
  }

  return NextResponse.json({ success: true });
}
