// TimeTravel backend — Express app serving the API and the static frontend.
// Implements spec.md > Components > Backend, Data store.

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'destinations.json');

// A direction's duration "locks in" (becomes usable for leave-by/arrival
// math) as soon as this many trips have been logged on it. One full round
// trip is two button-pairs total — depart+arrive for A->B, depart+arrive for
// B->A — and that alone should be enough to populate both legs, so this is 1,
// not 2: there's no redundancy requirement beyond having logged each leg once.
const LOCK_IN_THRESHOLD = 1;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readDestinations() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const destinations = JSON.parse(raw || '[]');
  return destinations.map(migrate);
}

// Brings an older-shaped stored destination (single aToB/bToA values, no
// origin) up to the current shape (sample arrays, explicit origin).
function migrate(destination) {
  if (!Array.isArray(destination.aToBSamples)) {
    destination.aToBSamples =
      destination.aToB !== null && destination.aToB !== undefined ? [destination.aToB] : [];
  }
  if (!Array.isArray(destination.bToASamples)) {
    destination.bToASamples =
      destination.bToA !== null && destination.bToA !== undefined ? [destination.bToA] : [];
  }
  if (!destination.origin) {
    destination.origin = 'Home';
  }
  if (destination.pendingSample === undefined) {
    destination.pendingSample = null;
  }
  delete destination.aToB;
  delete destination.bToA;
  return destination;
}

function writeDestinations(destinations) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(destinations, null, 2));
}

function average(samples) {
  if (!samples.length) return null;
  const sum = samples.reduce((a, b) => a + b, 0);
  return Math.round(sum / samples.length);
}

// Adds the derived, read-only fields the frontend renders: the locked-in
// average per direction (null until LOCK_IN_THRESHOLD samples exist) plus
// how many samples each direction has logged so far.
function withComputed(destination) {
  const aToBCount = destination.aToBSamples.length;
  const bToACount = destination.bToASamples.length;
  return {
    ...destination,
    aToB: aToBCount >= LOCK_IN_THRESHOLD ? average(destination.aToBSamples) : null,
    bToA: bToACount >= LOCK_IN_THRESHOLD ? average(destination.bToASamples) : null,
    aToBCount,
    bToACount,
    lockInThreshold: LOCK_IN_THRESHOLD,
  };
}

// GET /api/destinations — list all destinations with current state and learned durations.
app.get('/api/destinations', (req, res) => {
  res.json(readDestinations().map(withComputed));
});

// POST /api/destinations — add a destination by name, with the user's own
// location label (defaults to "Home" if not given).
app.post('/api/destinations', (req, res) => {
  const name = (req.body && req.body.name || '').trim();
  const origin = (req.body && req.body.origin || '').trim() || 'Home';
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const destinations = readDestinations();
  const destination = {
    id: crypto.randomUUID(),
    name,
    origin,
    currentState: 'home',
    aToBSamples: [],
    bToASamples: [],
    pendingDeparted: null,
    pendingSample: null,
  };
  destinations.push(destination);
  writeDestinations(destinations);

  res.status(201).json(withComputed(destination));
});

// POST /api/destinations/:id/starting-point — lets the person say which end
// they're actually starting from right now (e.g. opening the app for the
// first time while already at the destination, not home). Only allowed
// between trips — changing it mid-trip would orphan the pending departure.
app.post('/api/destinations/:id/starting-point', (req, res) => {
  const destinations = readDestinations();
  const destination = destinations.find((d) => d.id === req.params.id);
  if (!destination) {
    return res.status(404).json({ error: 'destination not found' });
  }
  if (destination.pendingDeparted !== null) {
    return res.status(400).json({ error: 'cannot change starting point mid-trip' });
  }

  const startingAt = req.body && req.body.startingAt;
  if (startingAt !== 'origin' && startingAt !== 'name') {
    return res.status(400).json({ error: 'startingAt must be "origin" or "name"' });
  }

  destination.currentState = startingAt === 'origin' ? 'home' : 'destination';
  writeDestinations(destinations);
  res.json(withComputed(destination));
});

// POST /api/destinations/:id/departed — stamps a departure for whichever leg
// matches the destination's current state (home -> A->B, destination -> B->A).
app.post('/api/destinations/:id/departed', (req, res) => {
  const destinations = readDestinations();
  const destination = destinations.find((d) => d.id === req.params.id);
  if (!destination) {
    return res.status(404).json({ error: 'destination not found' });
  }

  destination.pendingDeparted = Date.now();
  writeDestinations(destinations);
  res.json(withComputed(destination));
});

// POST /api/destinations/:id/arrived — computes elapsed time since the matching
// departed call and stages it as pendingSample (which leg, how many seconds).
// Nothing is counted yet — currentState doesn't flip and the sample arrays
// aren't touched until the person taps "Confirm timings" (POST .../confirm).
// This is the rollback window: a mis-tap can be thrown away with
// POST .../discard instead of permanently skewing the average.
app.post('/api/destinations/:id/arrived', (req, res) => {
  const destinations = readDestinations();
  const destination = destinations.find((d) => d.id === req.params.id);
  if (!destination) {
    return res.status(404).json({ error: 'destination not found' });
  }
  if (destination.pendingDeparted === null) {
    return res.status(400).json({ error: 'no trip in progress — tap "I have departed" first' });
  }

  const elapsedSeconds = Math.round((Date.now() - destination.pendingDeparted) / 1000);
  const leg = destination.currentState === 'home' ? 'aToB' : 'bToA';

  destination.pendingSample = { leg, seconds: elapsedSeconds };
  destination.pendingDeparted = null;
  writeDestinations(destinations);
  res.json(withComputed(destination));
});

// POST /api/destinations/:id/confirm — commits the staged pendingSample into
// the matching leg's sample array and flips currentState. This is the only
// place a sample actually gets counted.
app.post('/api/destinations/:id/confirm', (req, res) => {
  const destinations = readDestinations();
  const destination = destinations.find((d) => d.id === req.params.id);
  if (!destination) {
    return res.status(404).json({ error: 'destination not found' });
  }
  if (!destination.pendingSample) {
    return res.status(400).json({ error: 'nothing staged to confirm' });
  }

  const { leg, seconds } = destination.pendingSample;
  if (leg === 'aToB') {
    destination.aToBSamples.push(seconds);
    destination.currentState = 'destination';
  } else {
    destination.bToASamples.push(seconds);
    destination.currentState = 'home';
  }
  destination.pendingSample = null;

  writeDestinations(destinations);
  res.json(withComputed(destination));
});

// POST /api/destinations/:id/discard — rolls back whatever's currently
// in-flight for this destination: a staged (not-yet-confirmed) sample takes
// priority, otherwise an in-progress departure is cancelled. currentState is
// never touched here — this only lets the person retime the SAME leg, not
// switch direction.
app.post('/api/destinations/:id/discard', (req, res) => {
  const destinations = readDestinations();
  const destination = destinations.find((d) => d.id === req.params.id);
  if (!destination) {
    return res.status(404).json({ error: 'destination not found' });
  }

  if (destination.pendingSample !== null) {
    destination.pendingSample = null;
  } else if (destination.pendingDeparted !== null) {
    destination.pendingDeparted = null;
  } else {
    return res.status(400).json({ error: 'nothing to discard' });
  }

  writeDestinations(destinations);
  res.json(withComputed(destination));
});

app.listen(PORT, () => {
  console.log(`TimeTravel server listening on http://localhost:${PORT}`);
});
