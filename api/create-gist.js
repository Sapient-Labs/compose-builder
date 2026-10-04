import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const MAX_PAYLOAD_BYTES = 1024 * 1024;
const MAX_FILES = 50;

const rateLimitMap = new Map();

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

function computeConfigHash(config) {
  const normalized = JSON.stringify(config, Object.keys(config).sort());
  return createHash("sha256").update(normalized).digest("hex");
}

function isRateLimited(ip) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (rateLimitMap.get(ip) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(ip, timestamps);
    return true;
  }

  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return false;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req) {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  if (isRateLimited(ip)) {
    return json({ error: "Rate limit exceeded. Try again later." }, 429);
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return json({ error: "Payload too large" }, 413);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { files, config } = body;
  if (!Array.isArray(files) || files.length === 0) {
    return json({ error: "No files provided" }, 400);
  }
  if (files.length > MAX_FILES) {
    return json({ error: `Maximum ${MAX_FILES} files allowed` }, 400);
  }

  for (const file of files) {
    if (typeof file.path !== "string" || typeof file.content !== "string") {
      return json({ error: "Each file must have path and content strings" }, 400);
    }
  }

  if (config && typeof config === "object") {
    const cacheKey = `remix-gist:${computeConfigHash(config)}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return json(cached);
      }
    } catch {
      // KV unavailable, continue without cache
    }
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return json({ error: "Gist service unavailable" }, 500);
  }

  const gistFiles = {};
  for (const file of files) {
    gistFiles[file.path] = { content: file.content };
  }

  const description = `Compose Diamond Project — ${new Date().toISOString().slice(0, 10)}`;

  let githubResponse;
  try {
    githubResponse = await fetch("https://api.github.com/gists", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "compose-launchpad",
      },
      body: JSON.stringify({
        description,
        public: false,
        files: gistFiles,
      }),
    });
  } catch {
    return json({ error: "Failed to create gist" }, 502);
  }

  if (!githubResponse.ok) {
    if (githubResponse.status === 401 || githubResponse.status === 403) {
      return json({ error: "GitHub authentication failed" }, 502);
    }
    if (githubResponse.status === 429) {
      return json({ error: "GitHub rate limit exceeded. Try again later." }, 429);
    }
    return json({ error: `GitHub API error: ${githubResponse.status}` }, 502);
  }

  const gist = await githubResponse.json();
  const result = { gistId: gist.id, gistUrl: gist.html_url };

  if (config && typeof config === "object") {
    const cacheKey = `remix-gist:${computeConfigHash(config)}`;
    try {
      await redis.set(cacheKey, result);
    } catch {
      // KV unavailable, continue without cache
    }
  }

  return json(result);
}
