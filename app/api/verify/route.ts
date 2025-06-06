export default async function handler(req, res) {
  if (req.method !== "POST") {
    console.error("Invalid method:", req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token, action } = req.body;
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!token) {
    console.error("Missing token in request body");
    return res.status(400).json({ error: "Missing CAPTCHA token" });
  }
  if (!secretKey) {
    console.error("Missing TURNSTILE_SECRET_KEY in environment");
    return res.status(400).json({ error: "Server configuration error: Missing secret key" });
  }

  try {
    console.log("Verifying token:", token.slice(0, 10) + "...", "Action:", action || "none");
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
      return res.status(200).json({ success: true });
    } else {
      console.error("Turnstile verification failed:", data["error-codes"]);
      return res.status(400).json({
        error: "Turnstile verification failed",
        details: data["error-codes"] || ["Unknown error"],
      });
    }
  } catch (error) {
    console.error("Server error during verification:", error.message);
    return res.status(500).json({ error: "Server error during verification", details: error.message });
  }
}
