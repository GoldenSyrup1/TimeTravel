# TimeTravel

Tell it when to leave. It learns from you, not from Maps.

TimeTravel is a commute-estimation proof of concept built for Devpost's "Build With AI: Basics" hackathon. Instead of trusting a maps API's estimate, it learns your *actual* travel time by timing the trips you log yourself — then tells you exactly when to leave for a given arrival time, and fires a notification at that moment.

## Why

Google Calendar-style travel-time notifications are built on routing estimates — generic, and often wrong for a real commute with its own quirks (traffic patterns, how you actually walk/drive it, etc.). TimeTravel skips the maps API entirely: you log a trip once by tapping "I have departed" and "I have arrived," and it uses that real elapsed time from then on. No account, no calendar to maintain, less setup than a recurring Calendar event.

## How it works

1. Add a destination with two labels: where you're starting from (e.g. "Home") and where you're going (e.g. "UNSW").
2. Log a trip: tap **I have departed** when you leave, **I have arrived** when you get there. The app times it for you.
3. Each destination tracks both directions (Home → UNSW and UNSW → Home) independently and averages every trip you log for that leg, so the duration gets more accurate the more you use it.
4. Once a leg has at least one logged trip, enter a target arrival time (plus an adjustable buffer) and TimeTravel shows you exactly when to leave.
5. At that leave-by time, a browser notification fires. If notifications are denied, the leave-by time still stays visible on-screen.

## Running it locally

```bash
npm install
npm start
```

Then open `http://localhost:3000` in a browser. Destinations and learned durations persist to `data/destinations.json` between runs.

## Stack

- **Backend**: Node + Express, serving a small JSON-based API (`server.js`), with a flat JSON file (`data/destinations.json`) as the data store — no database, by design, for this proof of concept.
- **Frontend**: Plain HTML/CSS/JS (`public/`), no framework. Leave-by math and the notification timer run entirely client-side.

## Project structure

```
TimeTravel/
  server.js              # Express app, API routes, reads/writes data/destinations.json
  package.json
  data/
    destinations.json    # the datastore
  public/
    index.html           # the single page
    style.css
    app.js                # fetch/render, trip logging, leave-by math, notification timer
  devpost/
    prd.md
    spec.md
    checklist.md          # build plan and progress
```

## Status

Core loop is working end to end: add a destination, log trips in both directions, get a leave-by time, get notified. See `devpost/checklist.md` for the detailed build log, including a few places where the implementation moved past what `prd.md`/`spec.md` originally described (multi-trip averaging per leg instead of overwrite-on-log, and a two-leg-block UI instead of a single combined status line).

## What's deliberately not here

No maps/routing API, no accounts, no calendar view, no live GPS auto-trigger for departed/arrived, no outlier detection on logged trips. All out of scope for this proof of concept — see `devpost/prd.md > Deferred From the POC`.
