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

app.listen(PORT, () => {
  console.log(`TimeTravel server listening on http://localhost:${PORT}`);
});
