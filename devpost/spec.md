---
doc: spec
status: approved
---

# TimeTravel — Technical Specification

## How This Works, In Plain Language

A small Node/Express server is the single source of truth for your destinations and how long it takes to get to and from them. It keeps that data in a plain JSON file on disk — no real database, since this is a proof of concept. The webpage you actually use talks to that server: adding a destination, tapping "I have departed"/"I have arrived," and reading back the learned travel times. The moment-to-moment stuff — counting down to a leave-by time and firing the notification — happens entirely in the browser, because that's inherently a browser's job regardless of what the backend does.

Each destination remembers whether you're currently "at origin" or "at destination." That's what makes departed/arrived unambiguous: if you're currently at the origin and tap departed, it's timing origin→destination; tap it again from the other side, it's timing destination→origin. No extra question, no extra tap — though a "Starting from" dropdown lets you override which side you're on, for the case where your very first trip isn't from the assumed origin.

Each leg doesn't just remember the latest trip — it remembers every sample ever logged for it, and shows the average. So the second time you log a Home→UNSW trip, the duration shown is the mean of both, not a value that got silently overwritten.

## Where It Runs and How Someone Tries It

Runs locally. `npm install` once, then `npm start` runs the Express server (serves both the API and the static frontend, e.g. on `http://localhost:3000`). Open that URL in a browser to use it. No deployment for the PoC — the demo video is recorded from this local run.

## Components

### Backend — Express server (`server.js`)
Implements the persistence behind `prd.md > Destinations` and `prd.md > Trip logging`.
- `GET /api/destinations` — list all destinations with their current state and computed, averaged A→B/B→A durations.
- `POST /api/destinations` — add a destination (`{ name, origin }`; `origin` defaults to `"Home"` if omitted), starting with no logged samples and `currentState: "home"`.
- `POST /api/destinations/:id/starting-point` — sets `currentState` directly (`{ startingAt: "origin" | "name" }`), for when the next real trip isn't from the assumed side. Rejected with 400 while a trip is mid-flight (`pendingDeparted` set), so it can't orphan a departure.
- `POST /api/destinations/:id/departed` — records a departure timestamp for the leg implied by the destination's current state.
- `POST /api/destinations/:id/arrived` — computes elapsed time since the matching departed timestamp, appends it as a new sample to that leg's sample array (never overwrites), flips `currentState`, clears `pendingDeparted`, and returns the updated destination with its computed fields.
- Every response is passed through a `withComputed()` step that adds `aToB`/`bToA` (the mean of that leg's samples, `null` until it has at least `LOCK_IN_THRESHOLD` samples — currently `1`, so a leg becomes usable immediately after its first logged trip) plus `aToBCount`/`bToACount` and `lockInThreshold`, so the frontend never has to compute an average itself.

### Data store (`data/destinations.json`)
Implements persistence from `prd.md > States and Boundaries > What persists`.
A single JSON array, one object per destination, storing raw samples rather than a single value per leg:
```json
{
  "id": "...",
  "name": "UNSW",
  "origin": "Home",
  "currentState": "home",
  "aToBSamples": [5400, 5580],
  "bToASamples": [6120],
  "pendingDeparted": null
}
```
`aToBSamples`/`bToASamples` are arrays of seconds, one entry per logged trip for that leg; `withComputed()` (see Backend) turns these into the `aToB`/`bToA` averages and counts the frontend actually renders. `pendingDeparted` holds the departure timestamp between a "departed" tap and the matching "arrived" tap. A destination read from an older, pre-`origin`/pre-sample-array shape (a bare `aToB`/`bToA` number, no `origin`) is migrated on read: the single value becomes a one-entry sample array, and a missing `origin` defaults to `"Home"`.

### Frontend (`public/`)
Implements `prd.md > Screens and Layout` and the client-side half of `prd.md > Leave-by estimation` and `prd.md > Notification`.
- `index.html` — one screen: the destinations list, each destination a card. Add-destination form takes two plain inputs (origin, name), no pre-filled value. Minimal markup, no calendar grid, per `scope.md > Inspiration & Identity`.
- `style.css` — minimal, neutral styling (few buttons, not maps-app-dense); the arrive-by row (time + buffer) lays out inline on one line rather than wrapping.
- `app.js` —
  - Fetches/renders the destinations list from the backend.
  - Renders each destination as a title (`origin — name`, em dash) plus two leg blocks (one per direction). The active leg (matching `currentState`) gets a "Starting from" `<select>` wired to the starting-point endpoint, and the trip button; the inactive leg renders its "Starting from"/"Arriving at" as plain text.
  - Calls the departed/arrived endpoints and re-renders on response.
  - Per leg, once it has a non-null average: a target-arrival input + buffer control computes `leaveBy = targetArrival - avgSeconds - buffer` entirely client-side, using the `aToB`/`bToA` value the backend already computed for that leg.
  - Requests Notification permission once on page load; falls back to displaying the leave-by time on-screen if permission is denied (`prd.md > States and Boundaries`).
  - Per arrive-by row, sets a `setTimeout` to the computed leave-by time and fires a browser notification naming the destination when it elapses; re-typing the time or buffer replaces the pending timer rather than stacking duplicates.

## The Core Journey Through the System

1. User adds "UNSW" with origin "Home" → `app.js` POSTs to `/api/destinations` → stored in `destinations.json` with `currentState: "home"`, both sample arrays empty.
2. User taps "I have departed" (leaving home) → POST to `.../departed` → server stamps `pendingDeparted` (current state is `"home"`, so this leg is A→B). If the user's actual starting point isn't "home," they first set it via the "Starting from" dropdown → POST to `.../starting-point`.
3. User taps "I have arrived" (at UNSW) → POST to `.../arrived` → server computes elapsed time, pushes it onto `aToBSamples`, flips `currentState` to `"destination"`, clears `pendingDeparted`; the response's `withComputed()` step turns that into a non-null `aToB` average.
4. Later, user taps departed/arrived again from UNSW → same two endpoints, but because `currentState` is now `"destination"`, the server appends to `bToASamples` and flips state back to `"home"`. A third trip on either leg appends another sample and shifts that leg's average.
5. For either leg that already has an average, the user enters a target arrival time in that leg's block → `app.js` already has the leg's averaged duration from the destinations list it fetched → computes and displays leave-by instantly, no server round-trip needed.
6. `app.js` schedules the notification for that leave-by time on that row; it fires client-side when the time comes, replacing any previously scheduled notification for the same row if the time or buffer changes again.

## File Structure

```
TimeTravel/
  server.js              # Express app, API routes, reads/writes data/destinations.json
  package.json
  README.md               # what it is, how to run it, structure
  data/
    destinations.json    # the datastore
  public/
    index.html            # the destinations list
    style.css
    app.js                 # fetches, renders, leave-by math, notification timer
  devpost/
    learner-profile.md    # gitignored
    scope.md
    prd.md
    spec.md
    checklist.md
```

## Decisions and Open Issues

- **Backend/storage choice** — Express + a JSON file, not a real database. Decided: enough to make it feel real (an actual server, actual persistence) without the overhead a database adds for a PoC with one data shape.
- **One genuine unknown, resolved**: how departed/arrived knows which leg it's logging. Resolved by having each destination track its own `currentState` ("home" or "destination"), toggled on every "arrived" — so the direction is inferred, never asked. A later revision added the `starting-point` endpoint so the inferred direction can still be corrected when it doesn't match reality (the very first trip, logged from the wrong side).
- **Notification mechanism**: browser Notifications API via `setTimeout`, which only fires reliably while the tab is open. No service worker / push subscription — that's real infrastructure beyond PoC scope, noted here so it isn't a surprise during the demo recording.
- **Averaging, added after the original plan**: each leg stores every sample it's ever logged and the API returns the mean, gated behind `LOCK_IN_THRESHOLD = 1` (a leg becomes usable the moment it has its first sample — the threshold exists as a named constant specifically so it's trivial to raise later if a judge or future use wants more confidence before trusting a number). No weighting, no outlier rejection — the simplest version that's still more accurate than a single overwritten value.

## Simplify Check (against `scope.md > The POC Boundary`)

- Multi-trip averaging is implemented, but only as a plain mean — no outlier rejection, no weighting toward recent trips, no day-of-week/time-of-day variation. That's the deliberate stopping point; anything smarter is `prd.md > Possible Later Enhancements`.
- No destination editing/deleting — add-only is enough to prove the kernel.
- No accounts/login — single implicit user, matching the no-account decision in the PRD.
