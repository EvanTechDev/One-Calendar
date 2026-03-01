import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/", request.url));
}

/*
import { NextResponse } from "next/server";
import { ATPROTO_DISABLED, atprotoDisabledResponse } from "@/lib/atproto-feature";
import { getActorProfileRecord, profileAvatarBlobUrl } from "@/lib/atproto";
import { getAtprotoSession, setAtprotoSession } from "@/lib/atproto-auth";

export async function GET() {
  if (ATPROTO_DISABLED) return atprotoDisabledResponse();
  const session = await getAtprotoSession();
  if (!session) return NextResponse.json({ signedIn: false });

  let avatar = session.avatar;
  let displayName = session.displayName;

  if (session.accessToken && session.did && session.pds) {
    const actorProfile = await getActorProfileRecord({
      pds: session.pds,
      repo: session.did,
      accessToken: session.accessToken,
      dpopPrivateKeyPem: session.dpopPrivateKeyPem,
      dpopPublicJwk: session.dpopPublicJwk,
    }).catch(() => undefined);

    const avatarCid = actorProfile?.avatar?.ref?.$link;
    const resolvedAvatar = profileAvatarBlobUrl({ pds: session.pds, did: session.did, cid: avatarCid });

    if (resolvedAvatar || actorProfile?.displayName) {
      avatar = resolvedAvatar || avatar;
      displayName = actorProfile?.displayName || displayName;
      await setAtprotoSession({
        ...session,
        avatar,
        displayName,
      });
    }
  }

  return NextResponse.json({
    signedIn: true,
    handle: session.handle,
    did: session.did,
    pds: session.pds,
    displayName,
    avatar,
  });
}

*/
