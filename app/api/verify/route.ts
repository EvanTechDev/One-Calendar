export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token } = req.body;
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!token || !secretKey) {
    return res.status(400).json({ error: "Missing token or secret key" });
  }

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`,
      }
    );
    const data = await response.json();

    if (data.success) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(400).json({ error: "Turnstile verification failed", details: data["error-codes"] });
    }
  } catch (error) {
    return res.status(500).json({ error: "Server error during verification" });
  }
}
