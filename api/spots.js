// Community run spots and ratings.
// GET    /api/spots                      -> { spots, reviews }
// POST   /api/spots {type:"spot",...}    -> add a spot
// POST   /api/spots {type:"review",...}  -> add or update one rating (one per anonymous browser id per spot)
// DELETE /api/spots?spot=<id>            -> remove a spot and its ratings (x-admin-token)
// DELETE /api/spots?review=<key>         -> remove one rating (x-admin-token)
const { redis, configured, parseBody, overLimit, isAdmin, clean } = require("./_lib");

const ZONES = ["north", "central", "coast", "sw", "omr", "west"];
const TYPES = ["Park", "Beach / promenade", "Stadium / track", "Road loop", "Campus / trail", "Other"];
const WHEN = ["", "dawn", "morning", "evening", "night"];
const FLAGS = ["water", "shade", "lights", "toilets", "safe"];
const SEED_IDS = ["seed-marina", "seed-elliots", "seed-adyar-poonga", "seed-nehru-park", "seed-semmozhi", "seed-jln"];
const BOX = { latMin: 12.6, latMax: 13.4, lngMin: 79.9, lngMax: 80.45 };
const MAX_SPOTS = 500, MAX_REVIEWS = 5000, MAX_WRITES_PER_HOUR = 20;

function pairs(flat) {
  const out = [];
  for (let i = 0; i + 1 < (flat || []).length; i += 2) {
    try { out.push([flat[i], JSON.parse(flat[i + 1])]); } catch (e) {}
  }
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!configured()) return res.status(503).json({ error: "not_configured" });
  try {
    if (req.method === "GET") {
      const [s, r] = await Promise.all([redis(["HGETALL", "spots"]), redis(["HGETALL", "reviews"])]);
      const spots = pairs(s).map(([id, v]) => Object.assign({ id }, v));
      const reviews = pairs(r).map(([key, v]) => Object.assign({ key }, v));
      return res.status(200).json({ spots, reviews });
    }

    if (req.method === "POST") {
      let b;
      try { b = parseBody(req); } catch (e) { return res.status(400).json({ error: "bad_json" }); }
      if (b.hp) return res.status(200).json({ ok: true });
      if (await overLimit(req, "spots", MAX_WRITES_PER_HOUR)) return res.status(429).json({ error: "rate_limited" });

      if (b.type === "spot") {
        const name = clean(b.name, 60), area = clean(b.area, 40), note = clean(b.note, 200);
        if (name.length < 3 || area.length < 2 || !ZONES.includes(b.zone) || !TYPES.includes(b.kind)) {
          return res.status(400).json({ error: "invalid_spot" });
        }
        const spot = { name, area, zone: b.zone, kind: b.kind, note, ts: Date.now() };
        const km = Number(b.km);
        if (Number.isFinite(km) && km > 0 && km <= 60) spot.km = Math.round(km * 10) / 10;
        const lat = Number(b.lat), lng = Number(b.lng);
        if (b.lat != null && b.lng != null) {
          if (!(lat >= BOX.latMin && lat <= BOX.latMax && lng >= BOX.lngMin && lng <= BOX.lngMax)) return res.status(400).json({ error: "invalid_spot" });
          spot.lat = +lat.toFixed(5); spot.lng = +lng.toFixed(5);
        }
        if ((await redis(["HLEN", "spots"])) >= MAX_SPOTS) return res.status(400).json({ error: "full" });
        const id = "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        await redis(["HSET", "spots", id, JSON.stringify(spot)]);
        return res.status(201).json({ ok: true, spot: Object.assign({ id }, spot) });
      }

      if (b.type === "review") {
        const spot = clean(b.spot, 40), rid = clean(b.rid, 40);
        const stars = Number(b.stars);
        if (!/^[A-Za-z0-9_-]{8,40}$/.test(rid) || !/^[A-Za-z0-9_-]{3,40}$/.test(spot)) return res.status(400).json({ error: "invalid_review" });
        if (!Number.isInteger(stars) || stars < 1 || stars > 5 || !WHEN.includes(b.when || "")) return res.status(400).json({ error: "invalid_review" });
        if (!SEED_IDS.includes(spot) && (await redis(["HEXISTS", "spots", spot])) !== 1) return res.status(400).json({ error: "unknown_spot" });
        const review = { spot, stars, when: b.when || "", tip: clean(b.tip, 200), ts: Date.now() };
        FLAGS.forEach((f) => { review[f] = b[f] === true; });
        const key = spot + ":" + rid;
        const exists = (await redis(["HEXISTS", "reviews", key])) === 1;
        if (!exists && (await redis(["HLEN", "reviews"])) >= MAX_REVIEWS) return res.status(400).json({ error: "full" });
        await redis(["HSET", "reviews", key, JSON.stringify(review)]);
        return res.status(201).json({ ok: true });
      }
      return res.status(400).json({ error: "invalid_type" });
    }

    if (req.method === "DELETE") {
      if (!isAdmin(req)) return res.status(401).json({ error: "unauthorized" });
      const q = req.query || {};
      if (q.spot) {
        const id = String(q.spot);
        await redis(["HDEL", "spots", id]);
        const keys = (await redis(["HKEYS", "reviews"])) || [];
        const mine = keys.filter((k) => k.indexOf(id + ":") === 0);
        if (mine.length) await redis(["HDEL", "reviews"].concat(mine));
        return res.status(200).json({ ok: true, removedReviews: mine.length });
      }
      if (q.review) { await redis(["HDEL", "reviews", String(q.review)]); return res.status(200).json({ ok: true }); }
      return res.status(400).json({ error: "missing_id" });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "method_not_allowed" });
  } catch (e) {
    return res.status(500).json({ error: "server_error" });
  }
};
