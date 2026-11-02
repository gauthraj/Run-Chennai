/* Heat logic shared by Chennai Heat Hours and Run Chennai.
   Levels follow the US National Weather Service heat-index bands, converted to °C and applied to the
   forecast "apparent temperature": below 27 comfortable, 27 to 32 caution, 32 to 39 extreme caution, 39 and above danger.
   Air quality uses US AQI bands. An hour's rating is the worse of the two. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(); else root.Heat = factory();
})(typeof self !== "undefined" ? self : this, function () {
  var LAT = 13.0827, LNG = 80.2707, TZ = "Asia/Kolkata";

  function urls() {
    var base = "latitude=" + LAT + "&longitude=" + LNG + "&timezone=" + encodeURIComponent(TZ) + "&forecast_days=2";
    return {
      weather: "https://api.open-meteo.com/v1/forecast?" + base + "&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,uv_index&daily=sunrise,sunset",
      air: "https://air-quality-api.open-meteo.com/v1/air-quality?" + base + "&hourly=us_aqi"
    };
  }
  function heatLevel(f) { return f < 27 ? 0 : f < 32 ? 1 : f < 39 ? 2 : 3; }
  function aqiLevel(a) { if (a == null || isNaN(a)) return 0; return a <= 100 ? 0 : a <= 150 ? 1 : a <= 200 ? 2 : 3; }
  function aqiBand(a) { return a == null ? "" : a <= 50 ? "Good" : a <= 100 ? "Moderate" : a <= 150 ? "Unhealthy for sensitive groups" : a <= 200 ? "Unhealthy" : a <= 300 ? "Very unhealthy" : "Hazardous"; }

  // w: Open-Meteo forecast response; a: air-quality response (may be null).
  function build(w, a) {
    var H = w.hourly, days = {}, order = [];
    var aq = {};
    if (a && a.hourly && a.hourly.time) a.hourly.time.forEach(function (t, i) { aq[t] = a.hourly.us_aqi[i]; });
    H.time.forEach(function (t, i) {
      var d = t.slice(0, 10), h = +t.slice(11, 13);
      if (!days[d]) { days[d] = []; order.push(d); }
      var feels = H.apparent_temperature[i], aqi = aq[t] == null ? null : aq[t];
      var hl = heatLevel(feels), al = aqiLevel(aqi);
      days[d][h] = { h: h, feels: feels, temp: H.temperature_2m[i], rh: H.relative_humidity_2m[i], rain: H.precipitation_probability ? H.precipitation_probability[i] : null,
        uv: H.uv_index ? H.uv_index[i] : null, aqi: aqi, heatL: hl, aqiL: al, level: Math.max(hl, al) };
    });
    var sun = {};
    if (w.daily && w.daily.time) w.daily.time.forEach(function (d, i) { sun[d] = { rise: (w.daily.sunrise[i] || "").slice(11, 16), set: (w.daily.sunset[i] || "").slice(11, 16) }; });
    return { dates: order, days: days, sun: sun };
  }
  // Best contiguous run(s) of the calmest hours between lo and hi (inclusive hour starts).
  function windows(hs, lo, hi) {
    var min = 3, h;
    for (h = lo; h <= hi; h++) if (hs[h]) min = Math.min(min, hs[h].level);
    var runs = [], cur = null;
    for (h = lo; h <= hi; h++) {
      var ok = hs[h] && hs[h].level === min;
      if (ok) { if (!cur) cur = { from: h, to: h }; else cur.to = h; } else if (cur) { runs.push(cur); cur = null; }
    }
    if (cur) runs.push(cur);
    runs.sort(function (x, y) { return (y.to - y.from) - (x.to - x.from) || x.from - y.from; });
    return { level: min, runs: runs.slice(0, 2) };
  }
  // Contiguous runs where the rating is at or above minLevel.
  function avoid(hs, lo, hi, minLevel) {
    var runs = [], cur = null;
    for (var h = lo; h <= hi; h++) {
      var bad = hs[h] && hs[h].level >= minLevel;
      if (bad) { if (!cur) cur = { from: h, to: h }; else cur.to = h; } else if (cur) { runs.push(cur); cur = null; }
    }
    if (cur) runs.push(cur);
    return runs;
  }
  // Current local hour and date in India, independent of the device time zone.
  function nowIST(date) {
    var p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(date || new Date());
    var o = {}; p.forEach(function (x) { o[x.type] = x.value; });
    return { date: o.year + "-" + o.month + "-" + o.day, hour: +o.hour };
  }
  return { LAT: LAT, LNG: LNG, urls: urls, heatLevel: heatLevel, aqiLevel: aqiLevel, aqiBand: aqiBand, build: build, windows: windows, avoid: avoid, nowIST: nowIST };
});
