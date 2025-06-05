export default async function handler(req, res) {
  if (req.method !== "POST") {
    console.error("Invalid method:", req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token } = req.body;
  const secretKey = process.env.TURNSTILE_SCERET_KEY;

  if (!token || !secretKey) {
    console.error("Missing parameters:", { token: !!token, secretKey: !!secretKey });
    return res.status(400).json({ error: "Missing token or secret key" });
  }

  try {
    console.log("Sending verification request to Cloudflare for token:", token);
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`,
      }
    );
    const data = await response.json();
    console.log("Cloudflare response:", data);

    if (data.success) {
      return res.status(200).json({ success: true });
    } else {
      console.error("Turnstile verification failed:", data["error-codes"]);
      return res.status(400).json({ error: "Turnstile verification failed", details: data["error-codes"] });
    }
  } catch (error) {
    console.error("Server error during verification:", error);
    return res.status(500).json({ error: "Server error during verification", details: error.message });
  }
}
