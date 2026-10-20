---
doc: checklist
status: approved
---

# Build Checklist

Build mode: learn

## Slices

- [x] **1. Add a destination and see it in the list**
  Becomes usable: A running app (Express server + webpage) where adding a destination by name shows it in a list, actually persisted to the JSON data file.
  Why now: Proves the whole path end to end — server, data file, frontend — on the first slice, so every later slice has somewhere to land. Project bootstrapping (package.json, server.js, data file, public/) happens here, not as its own step.
  PRD ref: `prd.md > The Core Journey` (step 1), `prd.md > Features and Behavior > Destinations`
  Spec ref: `spec.md > Components`, `spec.md > File Structure`, `spec.md > Data store`
  Build: Scaffold per the spec's file structure (`server.js`, `package.json`, `data/destinations.json`, `public/index.html` + `app.js` + `style.css`); implement `GET`/`POST /api/destinations`; destinations list view fetching from the backend.
  Verify (mechanical): `npm install && npm start`, confirm the server starts with no errors; add a destination via the UI, confirm it appears; reload the page and confirm it's still there (proves it's reading from the JSON file, not just memory).
  Learner check: Open the app in your browser, add a destination by name, and confirm it shows up in the list.
  Commit: `Add destination scaffold: Express + JSON store + list view`

- [x] **2. Log a trip — learn A→B and B→A durations**
  Becomes usable: Tapping "I have departed" then "I have arrived" on a destination records a real elapsed duration; doing it again from the other direction records the other leg — both A→B and B→A update correctly based on the destination's current state.
  Why now: This is the unique kernel (`scope.md > The Unique Kernel`) — learning real durations from the user instead of trusting a maps API. It has to prove itself early, not get bolted on last.
  PRD ref: `prd.md > The Core Journey` (steps 2-4), `prd.md > Features and Behavior > Trip logging`
  Spec ref: `spec.md > Components > Backend`, `spec.md > Data store`, `spec.md > The Core Journey Through the System` (steps 2-4)
  Build: Implement `POST /api/destinations/:id/departed` and `.../arrived`; each destination carries `currentState` and `pendingDeparted`; departed stamps `pendingDeparted`, arrived computes elapsed time, updates `aToB` or `bToA` based on `currentState`, flips the state, clears `pendingDeparted`. Wire departed/arrived buttons on the frontend; list shows learned durations or "not yet logged."
  Verify (mechanical): Tap departed/arrived once (home→destination), confirm `aToB` populates with a real elapsed value; tap again (destination→home), confirm `bToA` populates and `aToB` is untouched; confirm `currentState` flips each time.
  Learner check: Log one trip out and one trip back for a destination and confirm the "going" time and the "return" time show up correctly and separately.
  Commit: `Implement departed/arrived trip logging with state-based A->B/B->A inference`

- [ ] **3. Target arrival time → leave-by computation**
  Becomes usable: Enter a target arrival time for a destination and see the computed leave-by time (learned A→B duration + adjustable buffer) immediately.
  Why now: This is the PRD's "oh, that's cool" payoff beat — but it only means something once slice 2 has produced a real learned duration to compute from.
  PRD ref: `prd.md > The Core Journey` (steps 5-6), `prd.md > Features and Behavior > Leave-by estimation`, `prd.md > Features and Behavior > Buffer`
  Spec ref: `spec.md > Components > Frontend`, `spec.md > The Core Journey Through the System` (step 5)
  Build: Add target-arrival input and buffer control to the frontend; compute `leaveBy = targetArrival - aToB - buffer` client-side from the destination's current `aToB`; display the result; sensible default buffer, adjustable.
  Verify (mechanical): With a destination that has a logged `aToB`, enter a target arrival time and confirm the displayed leave-by time equals target − duration − buffer; change the buffer and confirm it updates without a new trip log.
  Learner check: Pick a destination you've logged a trip for, enter when you need to arrive, and check the leave-by time matches what you'd expect by hand.
  Commit: `Add target-arrival input and client-side leave-by computation`

- [ ] **4. Notification fires at leave-by time**
  Becomes usable: The full core journey is complete — a browser notification fires at the computed leave-by time, with an on-screen fallback if permission is denied.
  Why now: Depends on slice 3's leave-by value existing; closes the loop described in `prd.md`'s Core Journey step 7.
  PRD ref: `prd.md > The Core Journey` (steps 6-7), `prd.md > Features and Behavior > Notification`, `prd.md > States and Boundaries` (notification permission not granted)
  Spec ref: `spec.md > Components > Frontend` (notification bullet)
  Build: Request Notification permission on first use; schedule a `setTimeout` to the leave-by time that fires a browser notification naming the destination; if permission is denied, keep the leave-by time visibly displayed on-screen.
  Verify (mechanical): Set a target arrival a minute or two out, confirm the notification fires at the computed leave-by time with the destination's name in the text; deny permission and confirm the on-screen leave-by time is still shown.
  Learner check: Set a leave-by time a couple minutes in the future and wait for the notification to actually appear.
  Commit: `Fire browser notification at leave-by time with on-screen fallback`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 2 (the kernel: departed/arrived producing real learned durations). Learner confirmed it works and asked whether timing was real vs. estimated; confirmed it's a genuine Date.now() stopwatch between taps.
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: [not yet started]
Route and stops: [not yet started]
Edit outcome: [not yet started]
Reflection: [not yet started]
Activity mode: [not yet started]

## Revisions
