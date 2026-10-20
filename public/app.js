// TimeTravel frontend — destinations list, add-destination, trip logging, leave-by.
// Implements prd.md > Screens and Layout, prd.md > Features and Behavior.
// Notifications are added in the next slice.

const listEl = document.getElementById('destinations-list');
const formEl = document.getElementById('add-destination-form');
const nameInput = document.getElementById('destination-name');

const DEFAULT_BUFFER_MINUTES = 5;

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

function formatClockTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

// leave-by = target arrival time - learned A->B duration - buffer.
// targetTimeStr is "HH:MM" from a <input type="time">, assumed to be today
// (or tomorrow if that time has already passed today).
function computeLeaveBy(targetTimeStr, aToBSeconds, bufferMinutes) {
  const [hours, minutes] = targetTimeStr.split(':').map(Number);
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);
  if (target.getTime() < Date.now()) {
    target.setDate(target.getDate() + 1);
  }
  const leaveBy = new Date(target.getTime() - aToBSeconds * 1000 - bufferMinutes * 60 * 1000);
  return leaveBy;
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

    // Leave-by section: only meaningful once we have a learned A->B duration.
    if (destination.aToB !== null) {
      const leaveByBox = document.createElement('div');
      leaveByBox.className = 'leave-by-box';

      const timeInput = document.createElement('input');
      timeInput.type = 'time';
      timeInput.className = 'target-time-input';
      timeInput.setAttribute('aria-label', `Target arrival time for ${destination.name}`);

      const bufferInput = document.createElement('input');
      bufferInput.type = 'number';
      bufferInput.className = 'buffer-input';
      bufferInput.min = '0';
      bufferInput.value = String(DEFAULT_BUFFER_MINUTES);
      bufferInput.setAttribute('aria-label', `Buffer minutes for ${destination.name}`);

      const bufferLabel = document.createElement('span');
      bufferLabel.className = 'buffer-label';
      bufferLabel.textContent = 'min buffer';

      const leaveByResult = document.createElement('div');
      leaveByResult.className = 'leave-by-result';

      function updateLeaveBy() {
        if (!timeInput.value) {
          leaveByResult.textContent = '';
          return;
        }
        const buffer = Number(bufferInput.value) || 0;
        const leaveBy = computeLeaveBy(timeInput.value, destination.aToB, buffer);
        leaveByResult.textContent = `Leave by ${formatClockTime(leaveBy)}`;
      }

      timeInput.addEventListener('input', updateLeaveBy);
      bufferInput.addEventListener('input', updateLeaveBy);

      leaveByBox.appendChild(document.createTextNode('Arrive by:'));
      leaveByBox.appendChild(timeInput);
      leaveByBox.appendChild(bufferInput);
      leaveByBox.appendChild(bufferLabel);
      leaveByBox.appendChild(leaveByResult);

      item.appendChild(leaveByBox);
    }

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
