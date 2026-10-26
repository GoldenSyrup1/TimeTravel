---
doc: prd
status: approved
---

# TimeTravel — Product Requirements

A commute-estimation webapp for someone with a long, variable commute: log a trip once, and it learns your real travel time and tells you exactly when to leave next time. Source: `scope.md > The Unique Kernel`, `scope.md > The Core Loop`.

## The Core Journey

1. User opens TimeTravel and adds a destination (e.g. "UNSW"), just a name — no address/maps lookup required for the PoC.
2. First trip to that destination: user taps "I have departed" when they actually leave home. The app starts a timer for that leg.
3. User taps "I have arrived" when they reach the destination. The app stores the elapsed time as the destination's current A→B (home→destination) estimate.
4. Later, when heading home: user taps "I have departed" (leaving the destination, whenever they are actually heading home — regardless of what they did in between, e.g. staying back for sport) and "I have arrived" when home. This stores B→A (destination→home) separately, since it's often a different duration.
5. For a future trip, the user enters a target arrival time at the destination (per trip, not a standing rule).
6. The app computes leave-by = target arrival time − learned A→B duration − buffer, and shows it immediately.
7. At the leave-by time, a browser notification fires telling the user to leave now.
8. Once both legs of a destination are known, the departed/arrived buttons disappear for that destination — there's nothing left to prove by tapping again, and leaving them up risks an accidental tap corrupting an already-usable duration.

Success looks like: a destination set up, one trip logged, a second trip's leave-by time computed and notified correctly — with the user able to see that the number came from their own logged trip, not a generic estimate.

## Screens and Layout

Single-page webapp, responsive (phone and laptop), no calendar grid.

- **Destinations list** — the home screen. Each destination shows its name and its current learned A→B / B→A durations (or "not yet logged" if no trip recorded).
- **Trip view** (per destination) — "I have departed" / "I have arrived" buttons; shows a running timer once departed is tapped, for feedback that it's tracking.
- **Target arrival + leave-by view** — enter a target arrival time for the next trip to a destination; shows the computed leave-by time and a buffer control.

## Look and Feel

Minimal, few buttons — explicitly not maps-app-dense. Closer to a simple to-do app than a navigation tool. No references beyond "not Google Maps" were specified; default to clean, neutral styling rather than inventing a theme.

## Features and Behavior

### Destinations
- Add a destination by name.
- Each destination independently tracks its own A→B and B→A learned durations.

### Trip logging ("departed" / "arrived")
- "I have departed" starts a timestamp for the current leg (A→B if coming from home, B→A if coming from the destination — direction is just whichever leg the user is logging, not a system-enforced state).
- "I have arrived" stops it and stores the elapsed duration as that leg's learned time.
- The buttons only appear while at least one leg (A→B or B→A) is still unknown. Once both are known, they're hidden for that destination — avoids an accidental tap silently corrupting an already-usable duration, and matches the PoC's one-shot-per-leg design (per `scope.md > Later`, re-measuring/averaging across multiple trips is deferred).
- As a commuting student, I want to log a trip in two taps so that I don't have to do any manual timing or math myself.
  - [ ] Tapping "departed" then "arrived" results in a stored duration for the correct leg (A→B or B→A) with no extra input required.
  - [ ] The destinations list immediately reflects the newly learned duration.

### Leave-by estimation
- User enters a target arrival time for an upcoming trip to a destination.
- App computes leave-by = target arrival − learned A→B duration − buffer, using whichever A→B duration is currently stored for that destination.
- As a commuting student, I want to enter when I need to arrive and get a precise leave-by time, so that I don't have to check Maps and estimate buffer time myself.
  - [ ] Entering a target arrival time with a logged A→B duration produces a leave-by time equal to target − duration − buffer.
  - [ ] Changing the buffer updates the leave-by time immediately without re-logging a trip.

### Arrival estimation (departure → arrival)
- The reverse of leave-by: user enters a departure time instead, and sees the resulting door-to-door arrival time, computed as departure + learned A→B duration.
- As a commuting student, I want to enter when I'm actually leaving and see when I'll arrive, so that I can tell someone an ETA without doing the math myself.
  - [ ] Entering a departure time with a logged A→B duration produces an arrival time equal to departure + duration.

### Notification
- A browser notification fires at the computed leave-by time telling the user to leave.
- As a commuting student, I want a notification rather than having to watch a countdown, so that the app stays out of my way until the moment it matters.
  - [ ] A notification appears at (or within a few seconds of) the computed leave-by time, with the destination name in the text.

### Buffer
- Adjustable per trip (not a fixed global setting for the PoC — matches "sure per-trip with just a small amount of buffer" from the interview).
- Has a sensible small default (e.g. 5 minutes) so a first-time user isn't asked to pick a number before understanding why.

## States and Boundaries

- **First use (no destinations)** — empty destinations list with a clear "add a destination" prompt; no leave-by estimation is possible without one.
- **Destination with no logged trip yet** — shows "not yet logged" instead of a duration; target-arrival/leave-by entry is disabled or clearly flagged as unavailable until a first trip exists for that leg.
- **Mid-trip (departed tapped, not yet arrived)** — visible running state (timer) so the user knows logging is active and can find their way back to tap "arrived."
- **Notification permission not granted** — browser notifications require permission; if denied, the leave-by time is still shown on-screen as a fallback.
- **What persists** — destinations and their learned A→B/B→A durations persist between sessions (stored locally for the PoC, per `scope.md > The POC Boundary`; no account system).

## Product Decisions

- Dropped the calendar-grid UI entirely in favor of a destination + leave-by notification model — the actual kernel value (a precise, self-learned leave-by time) didn't need a calendar to deliver, and a calendar was significantly more build surface for the same demo beat.
- Dropped fixed/movable activity tagging — that distinction only mattered for placing blocks on a calendar grid; with no grid, it has nothing to attach to.
- Target arrival time is entered per trip, not as a standing recurring rule — matches how the user actually plans (one trip at a time), and keeps the PoC simpler than a recurring-schedule system. Standing rules are deferred (`scope.md > Later`).
- "Departed" simply means whenever the user is actually heading to or from a location, with no system-enforced assumption about what happened in between (e.g. staying back after an activity before heading home) — the user resolved this directly rather than needing a flag/override mechanism.
- No maps/routing API dependency — the entire differentiation from Google Calendar's existing Maps-based travel-time notifications is that TimeTravel learns the user's own real commute experience instead of trusting an external routing estimate. This is the headline framing for Potential Impact / Innovation in the submission.
- Positioning language carried from the interview: less effort to set up than a Google Calendar recurring event, more accurate because it's based on real logged trips, and less intrusive since there's no calendar to maintain.

## What We're Building

- Add a destination by name.
- Log a trip via "I have departed" / "I have arrived," storing A→B and B→A durations separately per destination.
- Enter a target arrival time for a trip; compute and display a leave-by time (learned duration + adjustable buffer).
- Fire a browser notification at the leave-by time.
- Persist destinations and learned durations between sessions (local storage, no account/login).

## Deferred From the POC

- Multi-trip averaging / outlier detection for learned durations (currently just the latest logged trip) — deferred per `scope.md > Later`.
- Standing recurring leave-by rules per destination, instead of entering a target arrival time each trip.
- Any maps/routing API integration for an initial estimate before the first real trip.
- Live GPS auto-trigger for departed/arrived instead of manual taps.
- A calendar view or calendar sync — explicitly out of this product's shape now, not just deferred.

## Possible Later Enhancements

- Real calendar integration (e.g. Google Calendar sync) once the core estimator is proven.
- Smarter duration learning (rolling average, day-of-week or time-of-day variation).
- An "abnormal trip" flag so one outlier logged trip doesn't distort the learned duration.

## Non-Goals

- A full calendar UI — cut because the leave-by estimate is the actual value, not a calendar replacement, and a calendar is significant added build surface.
- Fixed vs. movable activity tagging — cut because it only existed to place blocks on a calendar grid that no longer exists.
- Any maps/routing API — cut deliberately; the kernel is about learning the user's real experience, not an idealized route, and it's also the product's key differentiation from Google Calendar's existing travel-time notifications.
- Native mobile app — a responsive webapp covers phone and laptop without extra build complexity.
- Background/always-on location tracking — browsers can't do this reliably, and it isn't needed to prove the kernel.

## Open Questions

- Exact notification mechanism (web Notifications API while the tab/app is open, vs. something more persistent) is a `4-spec` technical decision, not a product one — flagged to resolve there, doesn't block PRD approval.
