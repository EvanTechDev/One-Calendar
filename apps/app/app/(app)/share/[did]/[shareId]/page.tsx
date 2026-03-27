"use client";

import { useEffect, useState } from "react";

async function resolveDsByDid(did: string) {
  const url = `https://public.api.bsky.app/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=app.onecalendar.profile&rkey=self`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("resolve_ds_failed");
  const data = await res.json();
  return String(data?.value?.ds || "");
}

export default function DidSharePage({ params }: { params: { did: string; shareId: string } }) {
  const [data, setData] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const ds = await resolveDsByDid(params.did);
        if (!ds) throw new Error("missing_ds");
        const res = await fetch(`${ds.replace(/\/$/, "")}/api/share/public?did=${encodeURIComponent(params.did)}&id=${encodeURIComponent(params.shareId)}`);
        if (!res.ok) throw new Error("load_share_failed");
        const payload = await res.json();
        setData(String(payload.data || ""));
      } catch (e) {
        setError(e instanceof Error ? e.message : "unknown_error");
      }
    })();
  }, [params.did, params.shareId]);

  if (error) return <main>{error}</main>;
  if (!data) return <main>loading</main>;
  return <main>{data}</main>;
}
