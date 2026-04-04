const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const FETCH_TIMEOUT_MS = 12000;

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

function createError(code, message, status = 400) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

function jsonError(res, err) {
  const status = err.status || 500;
  const code = err.code || "INTERNAL_ERROR";
  const message = err.message || "Unexpected server error";
  return res.status(status).json({
    ok: false,
    error: { code, message },
  });
}

function normalizeInstagramReelUrl(input) {
  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    throw createError("INVALID_URL", "Please provide a valid URL.", 400);
  }

  const host = parsed.hostname.toLowerCase();
  const isInstagramHost = host === "instagram.com" || host === "www.instagram.com";
  if (!isInstagramHost) {
    throw createError("UNSUPPORTED_PROVIDER", "Only Instagram Reel URLs are supported.", 400);
  }

  const match = parsed.pathname.match(/^\/(reel|p)\/([^/?#]+)/i);
  if (!match) {
    throw createError("UNSUPPORTED_MEDIA", "Only public Instagram reel/post URLs are supported.", 400);
  }

  const mediaId = match[2];
  const canonicalUrl = `https://www.instagram.com/reel/${mediaId}/`;

  return { mediaId, canonicalUrl };
}

function extractMetaContent(html, propertyOrName) {
  const escaped = propertyOrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return decodeHtml(match[1]);
    }
  }
  return null;
}

function extractCanonicalUrl(html) {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i);
  return match && match[1] ? decodeHtml(match[1]) : null;
}

function decodeHtml(value) {
  if (!value) {
    return value;
  }
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function parseDurationToSeconds(isoDuration) {
  if (!isoDuration || typeof isoDuration !== "string") {
    return null;
  }
  const match = isoDuration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) {
    return null;
  }
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function extractLdJsonCandidates(html) {
  const matches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const out = [];
  for (const match of matches) {
    const raw = (match[1] || "").trim();
    if (!raw) {
      continue;
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        out.push(...parsed);
      } else {
        out.push(parsed);
      }
    } catch {
      // Ignore malformed JSON blocks and continue.
    }
  }
  return out;
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw createError("NOT_FOUND", "Instagram media was not found.", 404);
      }
      throw createError("UPSTREAM_ERROR", `Instagram responded with status ${response.status}.`, 502);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("text/html")) {
      throw createError("UNEXPECTED_RESPONSE", "Instagram did not return an HTML page.", 502);
    }

    return response.text();
  } catch (err) {
    if (err && err.name === "AbortError") {
      throw createError("TIMEOUT", "Instagram request timed out.", 504);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveInstagram(url) {
  const { mediaId, canonicalUrl } = normalizeInstagramReelUrl(url);
  const html = await fetchHtml(canonicalUrl);

  const ldJson = extractLdJsonCandidates(html);
  const videoObject = ldJson.find((item) => item && item["@type"] === "VideoObject");

  const title =
    extractMetaContent(html, "og:title")
    || (videoObject && videoObject.name)
    || "Instagram Reel";

  const description =
    extractMetaContent(html, "og:description")
    || (videoObject && videoObject.description)
    || null;

  const thumbnail =
    extractMetaContent(html, "og:image")
    || (videoObject && videoObject.thumbnailUrl)
    || null;

  const streamUrl =
    extractMetaContent(html, "og:video:secure_url")
    || extractMetaContent(html, "og:video")
    || (videoObject && videoObject.contentUrl)
    || null;

  const durationSec =
    parseDurationToSeconds(videoObject && videoObject.duration)
    || null;

  const authorName =
    (videoObject && videoObject.author && videoObject.author.name)
    || null;

  const authorProfileUrl =
    (videoObject && videoObject.author && videoObject.author.url)
    || null;

  if (!streamUrl) {
    throw createError(
      "UNPLAYABLE_MEDIA",
      "Could not find a playable video source. The reel may be private, restricted, or unavailable.",
      422
    );
  }

  const bestSource = {
    url: streamUrl,
    mimeType: "video/mp4",
    quality: "auto",
    hasAudio: true,
  };

  return {
    ok: true,
    id: `ig_${mediaId}`,
    provider: "instagram",
    type: "video",
    title,
    description,
    durationSec,
    thumbnail,
    author: {
      name: authorName,
      profileUrl: authorProfileUrl,
    },
    playback: {
      best: bestSource,
      fallbacks: [bestSource],
    },
    canonicalUrl: extractCanonicalUrl(html) || canonicalUrl,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    restrictions: {
      embeddable: true,
      geoBlocked: false,
      ageRestricted: false,
    },
  };
}

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

// Smart resolver: currently Instagram-only implementation.
app.get("/resolve", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      throw createError("MISSING_URL", "Query parameter 'url' is required.", 400);
    }

    const result = await resolveInstagram(url);
    return res.json(result);
  } catch (err) {
    return jsonError(res, err);
  }
});

// Backwards compatible endpoint used by existing frontend calls.
app.get("/extract", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      throw createError("MISSING_URL", "Query parameter 'url' is required.", 400);
    }

    const result = await resolveInstagram(url);
    return res.json({
      ok: true,
      provider: result.provider,
      title: result.title,
      thumbnail: result.thumbnail,
      videoUrl: result.playback.best.url,
      canonicalUrl: result.canonicalUrl,
    });
  } catch (err) {
    return jsonError(res, err);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`GroupWatch backend running on port ${PORT}`);
});