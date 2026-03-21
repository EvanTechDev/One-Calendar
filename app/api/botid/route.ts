import { NextResponse } from "next/server";
import { checkBotId } from "botid/server";

export async function POST() {
  const { isBot } = await checkBotId();

  if (isBot) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 403 },
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
