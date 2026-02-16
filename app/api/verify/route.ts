import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { token, action } = await request.json();
    const secretKey = process.env.TURNSTILE_SECRET_KEY;

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing CAPTCHA token" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!secretKey) {
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
      return new Response(JSON.stringify({ error: "Failed to verify with Cloudflare", status: response.status }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    if (data.success) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else {
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
    const message = error instanceof Error ? error.message : "Unknown error"
    return new Response(
      JSON.stringify({
        error: "Server error during verification",
        details: message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
