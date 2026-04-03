const express = require("express");
// const fetch = require("node-fetch");

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
const express = require("express");

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

  console.log("Fetching reel URL:", reelUrl);

  try {
    const response = await fetch(reelUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.instagram.com/",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    console.log("Response status:", response.status);

    const html = await response.text();

    // Always log something for inspection
    console.log("Response length:", html.length);
    console.log("==== Raw HTML snippet start ====");
    console.log(html.slice(0, 1000)); // first 1000 chars
    console.log("==== Raw HTML snippet end ====");

    // Crude video URL extraction (likely to fail on new Instagram)
    const match = html.match(/"video_url":"([^"]+)"/);
    const videoUrl = match ? match[1].replace(/\\u0026/g, "&") : null;

    if (!videoUrl) {
      return res.status(404).json({ error: "No video found" });
    }

    res.json({ videoUrl });
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(500).json({ error: "Request failed" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`GroupWatch backend running on port ${PORT}`);
});

// Start server
app.listen(PORT, () => {
  console.log(`GroupWatch backend running on port ${PORT}`);
});