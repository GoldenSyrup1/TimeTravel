---
doc: spec
status: approved
---

# TimeTravel — Technical Specification

## How This Works, In Plain Language

A small Node/Express server is the single source of truth for your destinations and how long it takes to get to and from them. It keeps that data in a plain JSON file on disk — no real database, since this is a proof of concept. The webpage you actually use talks to that server: adding a destination, tapping "I have departed"/"I have arrived," and reading back the learned travel times. The moment-to-moment stuff — counting down to a leave-by time and firing the notification — happens entirely in the browser, because that's inherently a browser's job regardless of what the backend does.

Each destination remembers whether you're currently "at home" or "at the destination." That's what makes departed/arrived unambiguous: if you're currently at home and tap departed, it's timing home→destination; tap it again from the destination side, it's timing destination→home. No extra question, no extra tap.

## Where It Runs and How Someone Tries It

Runs locally. `npm install` once, then `npm start` runs the Express server (serves both the API and the static frontend, e.g. on `http://localhost:3000`). Open that URL in a browser to use it. No deployment for the PoC — the demo video is recorded from this local run.

## Components

### Backend — Express server (`server.js`)
Implements the persistence behind `prd.md > Destinations` and `prd.md > Trip logging`.
- `GET /api/destinations` — list all destinations with their current state and learned A→B/B→A durations.
- `POST /api/destinations` — add a destination (`{ name }`), starting with no learned durations and `currentState: "home"`.
- `POST /api/destinations/:id/departed` — records a departure timestamp for the leg implied by the destination's current state.
- `POST /api/destinations/:id/arrived` — computes elapsed time since the matching departed timestamp, stores it as that leg's duration (overwriting the previous value), flips `currentState`, and returns the updated destination.

### Data store (`data/destinations.json`)
Implements persistence from `prd.md > States and Boundaries > What persists`.
A single JSON array, one object per destination:
```json
{ "id": "...", "name": "UNSW", "currentState": "home", "aToB": 5400, "bToA": 6120, "pendingDeparted": null }
```
`aToB`/`bToA` are seconds, `null` until a first trip logs them (drives the "not yet logged" state in `prd.md > States and Boundaries`). `pendingDeparted` holds the departure timestamp between a "departed" tap and the matching "arrived" tap.

### Frontend (`public/`)
Implements `prd.md > Screens and Layout` and the client-side half of `prd.md > Leave-by estimation` and `prd.md > Notification`.
- `index.html` — the three views: destinations list, trip view, target-arrival/leave-by view. Minimal markup, no calendar grid, per `scope.md > Inspiration & Identity`.
- `style.css` — minimal, neutral styling (few buttons, not maps-app-dense).
- `app.js` —
  - Fetches/renders the destinations list from the backend.
  - Calls the departed/arrived endpoints and re-renders on response.
  - Target-arrival input + buffer control: computes `leaveBy = targetArrival - learnedDuration - buffer` entirely client-side, using whichever `aToB` value the backend returned for that destination.
  - Requests Notification permission on first use; falls back to displaying the leave-by time on-screen if permission is denied (`prd.md > States and Boundaries`).
  - Sets a `setTimeout` to the computed leave-by time and fires a browser notification naming the destination when it elapses.

## The Core Journey Through the System

1. User adds "UNSW" → `app.js` POSTs to `/api/destinations` → stored in `destinations.json` with `currentState: "home"`, both durations `null`.
2. User taps "I have departed" (leaving home) → POST to `.../departed` → server stamps `pendingDeparted` (current state is `"home"`, so this leg is A→B).
3. User taps "I have arrived" (at UNSW) → POST to `.../arrived` → server computes elapsed time, sets `aToB`, flips `currentState` to `"destination"`, clears `pendingDeparted`.
4. Later, user taps departed/arrived again from UNSW → same two endpoints, but because `currentState` is now `"destination"`, the server records it as `bToA` and flips state back to `"home"`.
5. User opens the leave-by view for a future trip, enters a target arrival time → `app.js` already has `aToB` from the destinations list it fetched → computes and displays leave-by instantly, no server round-trip needed.
6. `app.js` schedules the notification for that leave-by time; it fires client-side when the time comes.

## File Structure

```
TimeTravel/
  server.js              # Express app, API routes, reads/writes data/destinations.json
  package.json
  data/
    destinations.json    # the datastore
  public/
    index.html            # destinations list, trip view, leave-by view
    style.css
    app.js                 # fetches, renders, leave-by math, notification timer
  devpost/
    learner-profile.md    # gitignored
    scope.md
    prd.md
    spec.md
```

## Decisions and Open Issues

- **Backend/storage choice** — Express + a JSON file, not a real database. Decided: enough to make it feel real (an actual server, actual persistence) without the overhead a database adds for a PoC with one data shape.
- **One genuine unknown, resolved**: how departed/arrived knows which leg it's logging. Resolved by having each destination track its own `currentState` ("home" or "destination"), toggled on every "arrived" — so the direction is inferred, never asked.
- **Notification mechanism**: browser Notifications API via `setTimeout`, which only fires reliably while the tab is open. No service worker / push subscription — that's real infrastructure beyond PoC scope, noted here so it isn't a surprise during the demo recording.

## Simplify Check (against `scope.md > The POC Boundary`)

- No multi-trip averaging — each new departed/arrived pair simply overwrites the previous duration for that leg, per `prd.md > Deferred From the POC`.
- No destination editing/deleting — add-only is enough to prove the kernel.
- No accounts/login — single implicit user, matching the no-account decision in the PRD.
