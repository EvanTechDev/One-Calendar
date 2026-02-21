import { createHash, createPrivateKey, generateKeyPairSync, randomUUID, sign } from "crypto";

export interface DpopPublicJwk {
  kty: string;
  crv: string;
  x: string;
  y: string;
}

function toBase64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function jwkThumbprint(publicJwk: DpopPublicJwk) {
  const canonical = JSON.stringify({
    crv: publicJwk.crv,
    kty: publicJwk.kty,
    x: publicJwk.x,
    y: publicJwk.y,
  });

  return createHash("sha256").update(canonical, "utf8").digest("base64url");
}

export function generateDpopKeyMaterial() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const publicJwk = publicKey.export({ format: "jwk" }) as DpopPublicJwk;
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  if (!publicJwk?.kty || !publicJwk?.crv || !publicJwk?.x || !publicJwk?.y) {
    throw new Error("Failed to generate DPoP key material");
  }

  return {
    publicJwk,
    privateKeyPem,
    jkt: jwkThumbprint(publicJwk),
  };
}

export function createDpopProof(params: {
  htu: string;
  htm: string;
  privateKeyPem: string;
  publicJwk: DpopPublicJwk;
  accessToken?: string;
  nonce?: string;
}) {
  const header = {
    typ: "dpop+jwt",
    alg: "ES256",
    jwk: {
      kty: params.publicJwk.kty,
      crv: params.publicJwk.crv,
      x: params.publicJwk.x,
      y: params.publicJwk.y,
    },
  };

  const payload: Record<string, string | number> = {
    jti: randomUUID(),
    iat: Math.floor(Date.now() / 1000),
    htm: params.htm.toUpperCase(),
    htu: params.htu,
  };

  if (params.accessToken) {
    payload.ath = createHash("sha256").update(params.accessToken, "utf8").digest("base64url");
  }

  if (params.nonce) {
    payload.nonce = params.nonce;
  }

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = sign("sha256", Buffer.from(signingInput, "utf8"), {
    key: createPrivateKey(params.privateKeyPem),
    dsaEncoding: "ieee-p1363",
  });

  return `${signingInput}.${toBase64Url(signature)}`;
}
