export default async function handler(req, res) {
  if (req.method !== "POST") {
    console.error("Invalid method:", req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token, action } = req.body;
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  console.log("Request body:", { token: token ? token.slice(0, 10) + "..." : null, action });
  console.log("TURNSTILE_SECRET_KEY:", secretKey ? "Set" : "Missing");

  if (!token) {
    console.error("Missing token in request body");
    return res.status(400).json({ error: "Missing CAPTCHA token" });
  }
  if (!secretKey) {
    console.error("Missing TURNSTILE_SECRET_KEY in environment");
    return res.status(400).json({ error: "Server configuration error: Missing secret key" });
  }

  try {
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

    const data = await response.json();
    console.log("Cloudflare response:", JSON.stringify(data, null, 2));

    if (data.success) {
      console.log("Verification successful for action:", action);
      return res.status(200).json({ success: true });
    } else {
      console.error("Turnstile verification failed:", data["error-codes"]);
      return res.status(400).json({
        error: "Turnstile verification failed",
        details: data["error-codes"] || ["Unknown error"],
        cloudflareResponse: data,
      });
    }
  } catch (error) {
    console.error("Server error during verification:", error.message, error.stack);
    return res.status(500).json({
      error: "Server error during verification",
      details: error.message,
    });
  }
}
