// TimeTravel frontend — destinations list, add-destination, trip logging.
// Implements prd.md > Screens and Layout, prd.md > Features and Behavior > Destinations, Trip logging.
// Leave-by math and notifications are added in later slices.

const listEl = document.getElementById('destinations-list');
const formEl = document.getElementById('add-destination-form');
const nameInput = document.getElementById('destination-name');

async function fetchDestinations() {
  const res = await fetch('/api/destinations');
  if (!res.ok) throw new Error('Failed to load destinations');
  return res.json();
}

async function addDestination(name) {
  const res = await fetch('/api/destinations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to add destination');
  return res.json();
}

async function logDeparted(id) {
  const res = await fetch(`/api/destinations/${id}/departed`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to log departure');
  return res.json();
}

async function logArrived(id) {
  const res = await fetch(`/api/destinations/${id}/arrived`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to log arrival');
  }
  return res.json();
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return null;
  const mins = Math.round(seconds / 60);
  return mins < 1 ? '<1 min' : `${mins} min`;
}

function statusText(destination) {
  const aToB = formatDuration(destination.aToB);
  const bToA = formatDuration(destination.bToA);
  if (!aToB && !bToA) return 'not yet logged';
  const parts = [];
  if (aToB) parts.push(`there ${aToB}`);
  if (bToA) parts.push(`back ${bToA}`);
  return parts.join(' · ');
}

function renderDestinations(destinations) {
  listEl.innerHTML = '';
  if (destinations.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'No destinations yet — add one above.';
    listEl.appendChild(empty);
    return;
  }

  for (const destination of destinations) {
    const item = document.createElement('li');
    item.className = 'destination-item';
    item.dataset.id = destination.id;

    const topRow = document.createElement('div');
    topRow.className = 'destination-top-row';

    const nameEl = document.createElement('span');
    nameEl.className = 'destination-name';
    nameEl.textContent = destination.name;

    const statusEl = document.createElement('span');
    statusEl.className = 'destination-status';
    statusEl.textContent = statusText(destination);

    topRow.appendChild(nameEl);
    topRow.appendChild(statusEl);

    const tripButton = document.createElement('button');
    tripButton.className = 'trip-button';
    const isMidTrip = destination.pendingDeparted !== null;
    tripButton.textContent = isMidTrip ? 'I have arrived' : 'I have departed';
    tripButton.addEventListener('click', async () => {
      tripButton.disabled = true;
      try {
        if (isMidTrip) {
          await logArrived(destination.id);
        } else {
          await logDeparted(destination.id);
        }
        await refresh();
      } catch (err) {
        alert(err.message);
        tripButton.disabled = false;
      }
    });

    item.appendChild(topRow);
    item.appendChild(tripButton);
    listEl.appendChild(item);
  }
}

async function refresh() {
  const destinations = await fetchDestinations();
  renderDestinations(destinations);
}

formEl.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  await addDestination(name);
  nameInput.value = '';
  await refresh();
});

refresh().catch((err) => console.error(err));
