// Runs the API handlers against an in-memory stand-in for Upstash Redis.
const store = { h: {}, l: {}, k: {} };
global.fetch = async (url, o) => {
  const c = JSON.parse(o.body), op = c[0].toUpperCase(); let r = null;
  const H = n => (store.h[n] = store.h[n] || {});
  if (op === "HGETALL") r = Object.entries(H(c[1])).flat();
  else if (op === "HSET") { H(c[1])[c[2]] = c[3]; r = 1; }
  else if (op === "HEXISTS") r = H(c[1])[c[2]] !== undefined ? 1 : 0;
  else if (op === "HLEN") r = Object.keys(H(c[1])).length;
  else if (op === "HKEYS") r = Object.keys(H(c[1]));
  else if (op === "HDEL") { c.slice(2).forEach(k => delete H(c[1])[k]); r = 1; }
  else if (op === "INCR") { store.k[c[1]] = (store.k[c[1]] || 0) + 1; r = store.k[c[1]]; }
  else if (op === "EXPIRE") r = 1;
  else if (op === "LPUSH") { (store.l[c[1]] = store.l[c[1]] || []).unshift(c[2]); r = 1; }
  else if (op === "LTRIM") r = "OK";
  else if (op === "LRANGE") r = (store.l[c[1]] || []).slice(0, 200);
  return { ok: true, json: async () => ({ result: r }) };
};
process.env.UPSTASH_REDIS_REST_URL = "http://x"; process.env.UPSTASH_REDIS_REST_TOKEN = "t"; process.env.ADMIN_TOKEN = "adm";
const spots = require("./api/spots"), suggest = require("./api/suggest");
function call(h, method, body, headers = {}, query = {}) {
  return new Promise(res => { const r = { _h: {}, setHeader() {}, status(c) { this.c = c; return this; }, json(j) { res([this.c, j]); return this; } };
    h({ method, body, headers: Object.assign({ "x-forwarded-for": "1.2.3.4" }, headers), query }, r); });
}
let fail = 0; const ok = (n, c) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };
(async () => {
  let [c, j] = await call(spots, "GET"); ok("empty get", c === 200 && j.spots.length === 0);
  [c, j] = await call(spots, "POST", { type: "spot", name: "Test Loop", area: "Adyar", zone: "coast", kind: "Park", lat: 13.0, lng: 80.25, km: 2.5 }); ok("add spot", c === 201);
  const id = j.spot.id;
  [c] = await call(spots, "POST", { type: "spot", name: "X", area: "Adyar", zone: "coast", kind: "Park" }); ok("short name rejected", c === 400);
  [c] = await call(spots, "POST", { type: "spot", name: "Far away", area: "Delhi", zone: "coast", kind: "Park", lat: 28.6, lng: 77.2 }); ok("out of bounds rejected", c === 400);
  [c] = await call(spots, "POST", { type: "spot", name: "Bad zone", area: "Adyar", zone: "mars", kind: "Park" }); ok("bad zone rejected", c === 400);
  [c] = await call(spots, "POST", { type: "review", spot: id, rid: "abcdefgh12", stars: 4, shade: true, when: "dawn", tip: "Go early" }); ok("review", c === 201);
  [c] = await call(spots, "POST", { type: "review", spot: id, rid: "abcdefgh12", stars: 5, shade: true }); ok("review update", c === 201);
  [c] = await call(spots, "POST", { type: "review", spot: "seed-marina", rid: "abcdefgh12", stars: 3 }); ok("seed review", c === 201);
  [c] = await call(spots, "POST", { type: "review", spot: "nope123", rid: "abcdefgh12", stars: 3 }); ok("unknown spot rejected", c === 400);
  [c] = await call(spots, "POST", { type: "review", spot: id, rid: "short", stars: 3 }); ok("bad rid rejected", c === 400);
  [c] = await call(spots, "POST", { type: "review", spot: id, rid: "abcdefgh12", stars: 9 }); ok("bad stars rejected", c === 400);
  [c] = await call(spots, "POST", { type: "spot", name: "Bot", area: "Adyar", zone: "coast", kind: "Park", hp: "x" }); ok("honeypot silent", c === 200);
  [c, j] = await call(spots, "GET"); ok("get after", j.spots.length === 1 && j.reviews.length === 2 && j.reviews.find(r => r.stars === 5));
  [c] = await call(spots, "DELETE", null, {}, { spot: id }); ok("delete needs token", c === 401);
  [c, j] = await call(spots, "DELETE", null, { "x-admin-token": "adm" }, { spot: id }); ok("admin delete removes reviews", c === 200 && j.removedReviews === 1);
  [c, j] = await call(spots, "GET"); ok("after delete", j.spots.length === 0 && j.reviews.length === 1);
  for (let i = 0; i < 25; i++) c = (await call(spots, "POST", { type: "review", spot: "seed-jln", rid: "abcdefgh" + (10 + i), stars: 3 }, { "x-forwarded-for": "9.9.9.9" }))[0];
  ok("rate limit hits 429", c === 429);
  [c] = await call(suggest, "POST", { kind: "event", name: "Some 5K", link: "https://example.com", note: "n" }); ok("suggest", c === 201);
  [c] = await call(suggest, "POST", { kind: "event", name: "Some 5K", link: "javascript:alert(1)" }); ok("suggest bad link", c === 400);
  [c] = await call(suggest, "GET"); ok("suggest list needs token", c === 401);
  [c, j] = await call(suggest, "GET", null, { "x-admin-token": "adm" }); ok("suggest list", c === 200 && j.suggestions.length === 1);
  delete process.env.UPSTASH_REDIS_REST_URL; [c] = await call(spots, "GET"); ok("503 when not configured", c === 503);
  console.log(fail ? fail + " failed" : "all passed");
})();
