import { NextResponse } from "next/server";
import { getAtprotoSession } from "@/lib/atproto-auth";
import { signedDsFetch } from "@/lib/ds-signed-request";

export async function POST(request: Request) {
  const atproto = await getAtprotoSession();
  if (!atproto) {
    return NextResponse.json({ error: "ATProto login required" }, { status: 401 });
  }

  const body = (await request.json()) as {
    ds?: string;
    path?: string;
    method?: "GET" | "POST" | "DELETE";
    payload?: unknown;
  };

  if (!body.ds || !body.path || !body.method) {
    return NextResponse.json(
      { error: "ds, path, method are required" },
      { status: 400 },
    );
  }

  const res = await signedDsFetch({
    session: atproto,
    ds: body.ds,
    path: body.path,
    method: body.method,
    body: body.payload,
  });

  const text = await res.text();
  const contentType = res.headers.get("content-type") || "application/json";
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": contentType,
    },
  });
}
