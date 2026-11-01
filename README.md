# Run Chennai

A free guide for people starting to run in Chennai: a three-question "Start here" path, upcoming events, running groups, community-rated places to run (with a map), a beginner-to-advanced learning guide with calculators, and Tamil for the main screens.

- `public/index.html` is the whole site (no build step). `template.html` + `build.py` regenerate it if you prefer editing the template.
- `api/spots.js` stores community spots and ratings. `api/suggest.js` stores event/group suggestions privately for you to review. Both use an Upstash Redis database.

## Put it online

1. Create a free Vercel account.
2. Either run `npm i -g vercel` then `vercel` in this folder, or push the folder to GitHub and import it in Vercel. Accept the defaults (choose "Other" if asked for a framework).
3. The site works straight away: Start here, Events, Groups, Learn and the starter spots list.

## Switch on community ratings and suggestions

1. In the Vercel project, open Storage and add an Upstash Redis database from the Marketplace. Connect it to the project so it has `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (the older `KV_REST_API_URL` / `KV_REST_API_TOKEN` also work).
2. Add an environment variable `ADMIN_TOKEN` with a long random value.
3. Redeploy (`vercel --prod`, or Redeploy in the dashboard).

## Moderating

```
# read suggestions people sent
curl -H "x-admin-token: YOUR_TOKEN" https://YOUR-SITE.vercel.app/api/suggest

# remove a spot (and its ratings). Spot ids appear in GET /api/spots
curl -X DELETE -H "x-admin-token: YOUR_TOKEN" "https://YOUR-SITE.vercel.app/api/spots?spot=SPOT_ID"

# remove one rating. Rating keys are "spotId:browserId" in GET /api/spots
curl -X DELETE -H "x-admin-token: YOUR_TOKEN" "https://YOUR-SITE.vercel.app/api/spots?review=KEY"
```

Limits: 20 writes per visitor per hour for spots and ratings, 5 suggestions per hour, 500 spots, 5,000 ratings, spot pins limited to the Chennai region. Ratings are one per anonymous browser per spot. This is a light guard, not account-level protection.

## Keeping events and groups fresh (do this every few months)

- Events are the `EVENTS` list in `template.html` (search for `EVENTS = [`). Each entry has a date, distances (`km` array drives the "3K or 5K" filter), venue, fee, link and source. Past events hide themselves automatically.
- Groups are the `GROUPS` list. Confirm each chapter's page and update schedules. Contact phone numbers are deliberately not copied; cards link to the official pages.
- After editing `template.html`, run `python3 build.py` (needs `../run-spots.html` for the shared CSS and Learn code, or edit `public/index.html` directly).

## Please check before sharing widely

- **Events:** dates and fees were read from organiser and listing pages on 1 Nov 2026. Two to confirm: the Chennai Marathon date and registration (official site: thechennaimarathon.com) and the date of Run for Our National Heroes (one listing says 12 Dec, others 13 Dec).
- **Tamil:** the main screens are translated, but please have a native speaker review the wording. The Learn section is English only for now.
- **Learn content:** general guidance written for healthy adults. Ideally a running coach and a physio read it, especially the injury and return-to-running sections.
- **Spot coordinates:** the six starter spots have no map pin, only a link to Google Maps. Community-added spots can drop a pin.

## Privacy

- No accounts. The browser stores a random id (for one-rating-per-spot), the chosen language and the walk-run plan ticks, in the visitor's own browser only.
- The rate limit uses a one-way hash of the IP address, kept for one hour. Suggestions and ratings are stored as submitted.
- The map uses OpenStreetMap tiles and Leaflet from unpkg. Fonts come from Google Fonts.
