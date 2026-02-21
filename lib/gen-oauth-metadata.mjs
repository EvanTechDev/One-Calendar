import { writeFileSync } from "node:fs";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://calendar.xyehr.cn";
const normalizedBase = baseUrl.replace(/\/$/, "");

const metadata = {
  client_id: `${normalizedBase}/oauth-client-metadata.json`,
  application_type: "web",
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  redirect_uris: [`${normalizedBase}/api/atproto/callback`],
  token_endpoint_auth_method: "none",
  scope: "atproto transition:generic",
  dpop_bound_access_tokens: true,
};

writeFileSync("public/oauth-client-metadata.json", `${JSON.stringify(metadata, null, 2)}
`, "utf8");
console.log("Generated public/oauth-client-metadata.json");
