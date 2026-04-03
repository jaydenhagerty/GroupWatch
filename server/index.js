const express = require("express");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "groupwatch-backend",
    message: "Server is running",
  });
});

// Extract video endpoint
app.get("/extract", async (req, res) => {
  const reelUrl = req.query.url;

  if (!reelUrl) {
    return res.status(400).json({ error: "Missing url param" });
  }

  try {
    const response = await fetch(reelUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const html = await response.text();

    // Log the raw HTML to console (first 5000 chars)
    console.log("==== Raw HTML start ====");
    console.log(html.slice(0, 5000));
    console.log("==== Raw HTML end ====");

    // Existing regex extraction
    const match = html.match(/"video_url":"([^"]+)"/);
    const videoUrl = match ? match[1].replace(/\\u0026/g, "&") : null;

    if (!videoUrl) {
      return res.status(404).json({ error: "No video found" });
    }

    res.json({ videoUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Request failed" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`GroupWatch backend running on port ${PORT}`);
});