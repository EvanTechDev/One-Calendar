export async function signedDsRequest<T>(params: {
  ds: string;
  path: string;
  method: "GET" | "POST" | "DELETE";
  payload?: unknown;
}) {
  const res = await fetch("/api/ds/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `DS request failed: ${res.status}`);
  }

  return (await res.json()) as T;
}
