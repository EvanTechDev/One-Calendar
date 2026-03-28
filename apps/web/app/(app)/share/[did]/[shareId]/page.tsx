import { notFound } from "next/navigation";

async function resolveDsFromDid(did: string) {
  const url = `https://public.api.bsky.app/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(
    did,
  )}&collection=app.onecalendar.ds&rkey=self`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { value?: { ds?: string } };
  return data.value?.ds || null;
}

export default async function ShareByDidPage({
  params,
}: {
  params: Promise<{ did: string; shareId: string }>;
}) {
  const { did, shareId } = await params;

  if (!did.startsWith("did:")) {
    notFound();
  }

  const ds = await resolveDsFromDid(did);
  if (!ds) {
    notFound();
  }
  const appToken = process.env.DS_APP_TOKEN;
  if (!appToken) {
    notFound();
  }

  const shareRes = await fetch(
    `${ds.replace(/\/$/, "")}/api/share/${encodeURIComponent(shareId)}`,
    {
      cache: "no-store",
      headers: {
        "x-app-token": appToken,
      },
    },
  );

  if (!shareRes.ok) {
    notFound();
  }

  const payload = await shareRes.json();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold">Shared Event</h1>
      <p className="mt-2 text-sm text-muted-foreground">DID: {did}</p>
      <p className="text-sm text-muted-foreground">DS: {ds}</p>
      <pre className="mt-6 overflow-auto rounded-md border p-4 text-sm">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </main>
  );
}
