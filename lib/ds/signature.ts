export type SignedPayload = {
  method: string;
  path: string;
  timestamp: string;
  body: string;
};

export function buildSignedPayload(payload: SignedPayload) {
  return JSON.stringify({
    method: payload.method.toUpperCase(),
    path: payload.path,
    timestamp: payload.timestamp,
    body: payload.body,
  });
}
