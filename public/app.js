// TimeTravel frontend — destinations list + add-destination.
// Implements prd.md > Screens and Layout (destinations list), prd.md > Features and Behavior > Destinations.
// Trip logging, leave-by math, and notifications are added in later slices.

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

    const nameEl = document.createElement('span');
    nameEl.className = 'destination-name';
    nameEl.textContent = destination.name;

    const statusEl = document.createElement('span');
    statusEl.className = 'destination-status';
    statusEl.textContent = 'not yet logged';

    item.appendChild(nameEl);
    item.appendChild(statusEl);
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
