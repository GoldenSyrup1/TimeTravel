---
doc: scope
status: approved
---

# TimeTravel

A lightweight commute-estimation tool: it learns your real door-to-door travel time from your own logged trips and tells you exactly when to leave, instead of you checking Maps and doing the math.

## The Unique Kernel
It never calls a maps/routing API. The first time you travel a route, you tap "departed" and "arrived" and it records the real elapsed time for that leg (A→B and B→A are learned separately, since they're often different). From then on, when you tell it when you need to arrive somewhere, it works backward from the learned time (plus an adjustable buffer) to tell you when to leave — and every trip you log makes the next estimate sharper. Google Calendar's travel-time feature does something similar on the surface, but trusts Maps' traffic-based estimate; TimeTravel trusts your own actual experience of the route instead (walking pace, which exit you use, how long you wait) — a different mechanism, not a reskin.

## Who It's For
A student with a long, somewhat variable commute (~1.5hr one-way) who doesn't want to maintain a full calendar just to know when to leave. The model user has a known destination schedule elsewhere (e.g. myUNSW) and just wants a precise, low-effort "leave by" answer with less setup than a recurring Calendar event.

## The Core Loop
1. Set up a destination (e.g. "UNSW").
2. First trip: tap "departed" (leaving home) → tap "arrived" (at destination) — logs A→B duration. Later, "departed" (leaving destination) → "arrived" (home) logs B→A. These keep refining with every trip.
3. Before a trip, enter a target arrival time for that destination.
4. The app computes a "leave by" time using the learned commute duration plus a buffer (default, adjustable per trip).
5. A notification fires at the leave-by time.

## Inspiration & Identity
Minimal, low-effort compared to Google Calendar — a focused utility, not a calendar replacement. No calendar grid UI in the proof of concept; the interaction is destination setup + departed/arrived logging + a leave-by notification.

## Why This Matters to the Learner
Currently does this math manually (checks Google Maps, estimates, sometimes asks an AI assistant to remember/calculate it). The goal is less effort than a Calendar recurring event, more accurate because it's based on real logged experience rather than a traffic API's estimate, and less intrusive since there's no calendar to maintain.

## What "Working" Looks Like
Demo: set up a destination → log a first trip (departed/arrived) to seed the A→B time → set a target arrival time for a future trip → the app tells you the exact leave-by time and the notification fires. The "oh, that's cool" beat: the leave-by time is clearly coming from the learner's own logged trip, not a generic estimate, and a second logged trip visibly refines it.

## The POC Boundary
- Add a destination
- Log a trip: "departed" / "arrived" buttons, timestamps recorded
- Store and refine A→B and B→A durations per destination from logged trips
- Enter a target arrival time for a trip; compute and display/notify a leave-by time (learned duration + adjustable buffer)
- Browser notification at the leave-by time

## Later
- Real calendar integration
- Live GPS-based auto-trigger for "departed"/"arrived" instead of manual buttons
- Standing recurring rules per destination (e.g. "always leave uni with X min buffer") instead of per-trip target time
- Multi-trip averaging / outlier detection (vs. just using the latest or letting the user override)
- Any live routing/maps API

## Explicitly Cut
- Any maps/routing API integration — cut because the kernel is specifically about learning real timing from the user, not trusting an idealized route; also removes an external dependency.
- A full calendar UI (grid, color-coded blocks, nested sub-events) — cut after realizing the actual value is the leave-by estimate itself, not a calendar replacement; a full calendar was significantly more build surface for the same core value.
- Fixed vs. movable activity tagging — belonged to the calendar version (distinguishing a movable event from a fixed one on a grid); not needed once there's no calendar grid to place blocks on.
- Native mobile app — cut because a responsive webapp covers phone and laptop without the extra build complexity.
- Background/always-on location tracking — cut because browsers can't do this reliably in a webapp, and it isn't needed to prove the kernel.
