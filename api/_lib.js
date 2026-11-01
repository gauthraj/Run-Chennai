// Shared helpers: Upstash Redis REST client and a per-IP rate limit.
const { createHash } = require("crypto");

function config() {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
  };
}
function configured() { const c = config(); return !!(c.url && c.token); }

async function redis(cmd) {
  const { url, token } = config();
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error("redis http " + r.status);
  const j = await r.json();
  if (j.error) throw new Error("redis " + j.error);
  return j.result;
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) return JSON.parse(req.body);
  return {};
}

// Returns true if this visitor is over the limit. Stores only a one-way hash of the IP for one hour.
async function overLimit(req, bucket, max) {
  const ip = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  const key = "rl:" + bucket + ":" + createHash("sha256").update(ip).digest("hex").slice(0, 16);
  const n = await redis(["INCR", key]);
  if (n === 1) await redis(["EXPIRE", key, 3600]);
  return n > max;
}

function isAdmin(req) {
  const admin = process.env.ADMIN_TOKEN;
  return !!admin && req.headers["x-admin-token"] === admin;
}

function clean(s, max) {
  return String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

module.exports = { redis, configured, parseBody, overLimit, isAdmin, clean };
