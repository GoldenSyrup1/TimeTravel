---
doc: prd
status: approved
---

# TimeTravel — Product Requirements

A commute-estimation webapp for someone with a long, variable commute: log a trip once, and it learns your real travel time and tells you exactly when to leave next time. Source: `scope.md > The Unique Kernel`, `scope.md > The Core Loop`.

## The Core Journey

1. User opens TimeTravel and adds a destination: two labels, not just one — where they're starting from (origin, e.g. "Home") and where they're going (e.g. "UNSW"). No address/maps lookup required for the PoC.
2. First trip: user taps "I have departed" when they actually leave. If the trip they're about to log isn't from the assumed origin side (e.g. they're opening the app for the first time while already at the destination), a "Starting from" dropdown lets them set that before tapping. The app starts a timer for that leg.
3. User taps "I have arrived" when they reach the other end. The app stores the elapsed time as a sample for that leg (origin→destination or destination→origin, whichever was active) and averages it with any previous samples for the same leg.
4. Later, heading the other way: user taps "I have departed" (whenever they're actually heading that way — regardless of what they did in between, e.g. staying back for sport) and "I have arrived" on arrival. This leg's samples are tracked and averaged separately, since it's often a different duration.
5. For a future trip, the user enters a target arrival time for a given leg (either direction, once it has at least one logged trip) — per trip, not a standing rule.
6. The app computes leave-by = target arrival time − that leg's averaged duration − buffer, and shows it immediately.
7. At the leave-by time, a browser notification fires telling the user to leave now; the leave-by time also stays visible on-screen as a fallback if notification permission was denied.
8. Every additional "departed"/"arrived" pair for a leg adds another sample and refines that leg's average — the trip button for a leg is simply not shown except when it's that leg's turn, so there's no separate "lock the buttons away" step once a destination has data.

Success looks like: a destination set up, one trip logged, a second trip's leave-by time computed and notified correctly — with the user able to see that the number came from their own logged trip, not a generic estimate.

## Screens and Layout

Single-page webapp, responsive (phone and laptop), no calendar grid.

- **Destinations list** — the only screen. Each destination renders as a card titled "`Origin` — `Name`" with two per-direction blocks, one per leg:
  - **Starting from / Arriving at** — the active leg (whichever direction is next, per `currentState`) shows a "Starting from" dropdown (defaults to that leg's usual direction, overridable) and an auto-filled "Arriving at"; the inactive leg shows both as plain text.
  - **Trip button** — "I have departed" / "I have arrived", shown only on the active leg; tapping it is the feedback that a trip is being timed (no separate running-timer display).
  - **Arrive-by planner** — once a leg has at least one logged trip, an inline target-arrival-time + buffer control computed from that leg's averaged duration; shows "Not yet logged" in its place until then.

## Look and Feel

Minimal, few buttons — explicitly not maps-app-dense. Closer to a simple to-do app than a navigation tool. No references beyond "not Google Maps" were specified; default to clean, neutral styling rather than inventing a theme.

## Features and Behavior

### Destinations
- Add a destination with two labels: an origin (where you're starting from, defaults to "Home" if left blank) and a name (where you're going).
- Each destination independently tracks its own A→B and B→A learned durations, each as an average over every trip logged for that leg.

### Trip logging ("departed" / "arrived")
- "I have departed" starts a timestamp for whichever leg is currently active (`currentState`: origin→name or name→origin). A "Starting from" dropdown on the active leg lets the user set which leg is next, for when the first real trip isn't from the assumed origin side.
- "I have arrived" stops it and adds the elapsed duration as a new sample for that leg, averaged together with any previous samples for the same leg — so a repeated trip refines the number instead of overwriting or being blocked.
- The trip button for a leg is shown only while it's that leg's turn; it isn't hidden based on whether both legs already have data, since logging more trips is exactly how the estimate keeps improving.
- As a commuting student, I want to log a trip in two taps so that I don't have to do any manual timing or math myself.
  - [ ] Tapping "departed" then "arrived" results in a stored duration for the correct leg (A→B or B→A) with no extra input required.
  - [ ] The destinations list immediately reflects the newly learned duration.
  - [ ] Logging a second trip for an already-logged leg updates (averages into) that leg's duration rather than being blocked.

### Leave-by estimation
- User enters a target arrival time for an upcoming trip on a given leg (either direction), once that leg has at least one logged trip.
- App computes leave-by = target arrival − that leg's averaged duration − buffer.
- As a commuting student, I want to enter when I need to arrive and get a precise leave-by time, so that I don't have to check Maps and estimate buffer time myself.
  - [ ] Entering a target arrival time for a leg with a logged duration produces a leave-by time equal to target − duration − buffer.
  - [ ] Changing the buffer updates the leave-by time immediately without re-logging a trip.
  - [ ] Both legs of a destination get their own independent arrive-by planner once each has a logged trip.

### Notification
- A browser notification fires at the computed leave-by time for that leg, telling the user to leave.
- As a commuting student, I want a notification rather than having to watch a countdown, so that the app stays out of my way until the moment it matters.
  - [ ] A notification appears at (or within a few seconds of) the computed leave-by time, with the destination name in the text.

### Buffer
- Adjustable per trip, inline beside the arrive-by time input (not a fixed global setting for the PoC — matches "sure per-trip with just a small amount of buffer" from the interview).
- Has a sensible small default (e.g. 5 minutes) so a first-time user isn't asked to pick a number before understanding why.

## States and Boundaries

- **First use (no destinations)** — empty destinations list with a clear "add a destination" prompt; no leave-by estimation is possible without one.
- **A leg with no logged trip yet** — shows "Not yet logged" in place of the arrive-by planner, per leg (the other leg of the same destination may already have data and show its planner normally).
- **Mid-trip (departed tapped, not yet arrived)** — the trip button switches to "I have arrived," which is the signal that logging is active; there's no separate running countdown display.
- **Notification permission not granted** — browser notifications require permission; if denied, the leave-by time is still shown on-screen as a fallback.
- **What persists** — destinations (origin, name, and every logged sample per leg) persist between sessions (stored locally for the PoC, per `scope.md > The POC Boundary`; no account system).

## Product Decisions

- Dropped the calendar-grid UI entirely in favor of a destination + leave-by notification model — the actual kernel value (a precise, self-learned leave-by time) didn't need a calendar to deliver, and a calendar was significantly more build surface for the same demo beat.
- Dropped fixed/movable activity tagging — that distinction only mattered for placing blocks on a calendar grid; with no grid, it has nothing to attach to.
- Target arrival time is entered per trip, not as a standing recurring rule — matches how the user actually plans (one trip at a time), and keeps the PoC simpler than a recurring-schedule system. Standing rules are deferred (`scope.md > Later`).
- "Departed" simply means whenever the user is actually heading to or from a location, with no system-enforced assumption about what happened in between (e.g. staying back after an activity before heading home) — the user resolved this directly rather than needing a flag/override mechanism.
- No maps/routing API dependency — the entire differentiation from Google Calendar's existing Maps-based travel-time notifications is that TimeTravel learns the user's own real commute experience instead of trusting an external routing estimate. This is the headline framing for Potential Impact / Innovation in the submission.
- Positioning language carried from the interview: less effort to set up than a Google Calendar recurring event, more accurate because it's based on real logged trips, and less intrusive since there's no calendar to maintain.
- Each leg's duration is an average over every trip logged for it, not a single value overwritten each time — the build moved past the original one-shot-per-leg design (see `scope.md > Later`'s original deferral of averaging) once it became clear a simple mean was no extra build cost and directly served "learns from you" better than a single snapshot. No outlier rejection — still deferred.
- Destinations carry an explicit, user-set origin label instead of an implicit "home," with a "Starting from" control to set which leg is next — needed once a destination can represent any pair of places, not just home-and-somewhere, and to cover the case where someone's first real trip isn't from the assumed origin side.
- Dropped the separate departure→arrival reverse lookup (enter a departure time, see when you'll arrive) in favor of giving each leg — not just A→B — its own arrive-by planner; asking the reverse question for a leg is answered by reading that leg's own panel, so a dedicated reverse control was redundant once both directions had one.
- Dropped hiding the trip button once both legs are known — logging more trips is now how the estimate improves, so a leg's button simply follows whose turn it is (`currentState`), with no separate "nothing left to prove" cutoff.

## What We're Building

- Add a destination with an origin label and a destination name.
- Log a trip via "I have departed" / "I have arrived," storing A→B and B→A durations separately per destination, each averaged across every trip logged for that leg.
- Set which leg is next via a "Starting from" control, for when the first real trip isn't from the assumed origin side.
- Enter a target arrival time for either leg of a trip; compute and display a leave-by time (that leg's averaged duration + adjustable buffer).
- Fire a browser notification at the leave-by time.
- Persist destinations and learned durations between sessions (local storage, no account/login).

## Deferred From the POC

- Outlier detection/rejection for learned durations — basic multi-trip averaging (a simple mean, every logged sample weighted equally) is now implemented per leg; what's still deferred is anything smarter, like discarding or flagging an abnormal trip.
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
