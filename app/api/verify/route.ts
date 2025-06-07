import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { token, action } = await request.json();
    const secretKey = process.env.TURNSTILE_SECRET_KEY;

    console.log("Request body:", { token: token ? token.slice(0, 10) + "..." : null, action });
    console.log("TURNSTILE_SECRET_KEY:", secretKey ? "Set" : "Missing");

    if (!token) {
      console.error("Missing token in request body");
      return new Response(JSON.stringify({ error: "Missing CAPTCHA token" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!secretKey) {
      console.error("Missing TURNSTILE_SECRET_KEY in environment");
      return new Response(JSON.stringify({ error: "Server configuration error: Missing secret key" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: secretKey,
          response: token,
        }).toString(),
      }
    );

    if (!response.ok) {
      console.error("Cloudflare API error:", response.status, response.statusText);
      return new Response(JSON.stringify({ error: "Failed to verify with Cloudflare", status: response.status }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log("Cloudflare response:", JSON.stringify(data, null, 2));

    if (data.success) {
      console.log("Verification successful for action:", action);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else {
      console.error("Turnstile verification failed:", data["error-codes"]);
      return new Response(
        JSON.stringify({
          error: "Turnstile verification failed",
          details: data["error-codes"] || ["Unknown error"],
          cloudflareResponse: data,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Server error during verification:", error.message, error.stack);
    return new Response(
      JSON.stringify({
        error: "Server error during verification",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
