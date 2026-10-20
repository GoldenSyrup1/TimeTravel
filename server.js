// TimeTravel backend — Express app serving the API and the static frontend.
// Implements spec.md > Components > Backend, Data store.

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'destinations.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readDestinations() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw || '[]');
}

function writeDestinations(destinations) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(destinations, null, 2));
}

// GET /api/destinations — list all destinations with current state and learned durations.
app.get('/api/destinations', (req, res) => {
  res.json(readDestinations());
});

// POST /api/destinations — add a destination by name.
app.post('/api/destinations', (req, res) => {
  const name = (req.body && req.body.name || '').trim();
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const destinations = readDestinations();
  const destination = {
    id: crypto.randomUUID(),
    name,
    currentState: 'home',
    aToB: null,
    bToA: null,
    pendingDeparted: null,
  };
  destinations.push(destination);
  writeDestinations(destinations);

  res.status(201).json(destination);
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
  res.json(destination);
});

// POST /api/destinations/:id/arrived — computes elapsed time since the matching
// departed call, stores it as aToB or bToA (whichever leg currentState implies),
// flips currentState, and clears pendingDeparted.
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

  if (destination.currentState === 'home') {
    destination.aToB = elapsedSeconds;
    destination.currentState = 'destination';
  } else {
    destination.bToA = elapsedSeconds;
    destination.currentState = 'home';
  }

  destination.pendingDeparted = null;
  writeDestinations(destinations);
  res.json(destination);
});

app.listen(PORT, () => {
  console.log(`TimeTravel server listening on http://localhost:${PORT}`);
});
