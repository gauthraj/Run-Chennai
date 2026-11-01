// Event or group suggestions from visitors. Kept private for you to review.
// POST /api/suggest {kind, name, link, note}      -> stored for review
// GET  /api/suggest (x-admin-token header)        -> list suggestions
const { redis, configured, parseBody, overLimit, isAdmin, clean } = require("./_lib");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!configured()) return res.status(503).json({ error: "not_configured" });
  try {
    if (req.method === "GET") {
      if (!isAdmin(req)) return res.status(401).json({ error: "unauthorized" });
      const rows = (await redis(["LRANGE", "suggest", 0, 199])) || [];
      return res.status(200).json({ suggestions: rows.map((s) => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean) });
    }
    if (req.method === "POST") {
      let b;
      try { b = parseBody(req); } catch (e) { return res.status(400).json({ error: "bad_json" }); }
      if (b.hp) return res.status(200).json({ ok: true });
      const kind = ["event", "group", "other"].includes(b.kind) ? b.kind : "other";
      const name = clean(b.name, 100), link = clean(b.link, 300), note = clean(b.note, 300);
      if (name.length < 3) return res.status(400).json({ error: "invalid" });
      if (link && !/^https?:\/\//i.test(link)) return res.status(400).json({ error: "invalid" });
      if (await overLimit(req, "suggest", 5)) return res.status(429).json({ error: "rate_limited" });
      await redis(["LPUSH", "suggest", JSON.stringify({ kind, name, link, note, ts: Date.now() })]);
      await redis(["LTRIM", "suggest", 0, 199]);
      return res.status(201).json({ ok: true });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    return res.status(500).json({ error: "server_error" });
  }
};
