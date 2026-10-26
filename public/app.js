// TimeTravel frontend — destinations list, add-destination, trip logging, leave-by.
// Implements prd.md > Screens and Layout, prd.md > Features and Behavior.
//
// Each destination goes through two phases:
//  - Setup: exactly one leg-block is shown at a time, for whichever leg is
//    "current" (origin->name or name->origin). Only the very first one (before
//    either leg has any logged trip) gets a "Starting from" dropdown; once a
//    trip has been logged for either leg, the direction is locked and every
//    later setup block is plain text — there is no way to redirect back to a
//    leg that's already been started. Completing a leg's depart+arrive pair
//    auto-advances to the other leg's setup block.
//  - Planner: once both legs have at least one logged trip, both leg blocks
//    render together, fixed (no dropdown, no trip button), each showing its
//    averaged duration and its own arrive-by + buffer control.

const listEl = document.getElementById('destinations-list');
const formEl = document.getElementById('add-destination-form');
const originInput = document.getElementById('origin-name');
const nameInput = document.getElementById('destination-name');

const DEFAULT_BUFFER_MINUTES = 5;

// Ask once, on first load, so the browser prompt isn't tied to any one
// button. If denied, the on-screen "Leave by" text is still the fallback.
function requestNotificationPermissionOnce() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

async function fetchDestinations() {
  const res = await fetch('/api/destinations');
  if (!res.ok) throw new Error('Failed to load destinations');
  return res.json();
}

async function addDestination(name, origin) {
  const res = await fetch('/api/destinations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, origin }),
  });
  if (!res.ok) throw new Error('Failed to add destination');
  return res.json();
}

async function setStartingPoint(id, startingAt) {
  const res = await fetch(`/api/destinations/${id}/starting-point`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startingAt }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to set starting point');
  }
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

// leave-by = target arrival time - learned leg duration - buffer.
// targetTimeStr is "HH:MM" from a <input type="time">, assumed to be today
// (or tomorrow if that time has already passed today).
function computeLeaveBy(targetTimeStr, legSeconds, bufferMinutes) {
  const [hours, minutes] = targetTimeStr.split(':').map(Number);
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);
  if (target.getTime() < Date.now()) {
    target.setDate(target.getDate() + 1);
  }
  return new Date(target.getTime() - legSeconds * 1000 - bufferMinutes * 60 * 1000);
}

function legInfo(destination, legState) {
  const fromIsOrigin = legState === 'home';
  return {
    legState,
    from: fromIsOrigin ? destination.origin : destination.name,
    to: fromIsOrigin ? destination.name : destination.origin,
    avgSeconds: fromIsOrigin ? destination.aToB : destination.bToA,
    count: fromIsOrigin ? destination.aToBCount : destination.bToACount,
  };
}

// The setup block: whichever leg is current gets exactly one block, with the
// "Starting from" dropdown shown only when `allowDropdown` is true (i.e.
// neither leg has any logged trip yet). Every later setup block — once a
// trip has been logged for either leg — is plain text; there is no way back
// to redirect a leg that's already in progress or already done.
function renderSetupLegBlock(destination, leg, allowDropdown) {
  const block = document.createElement('div');
  block.className = 'leg-block leg-block-active';

  const fromRow = document.createElement('div');
  fromRow.className = 'leg-row';
  const fromLabel = document.createElement('span');
  fromLabel.className = 'leg-label';
  fromLabel.textContent = 'Starting from:';
  fromRow.appendChild(fromLabel);

  if (allowDropdown && destination.pendingDeparted === null) {
    const select = document.createElement('select');
    select.className = 'leg-select';
    const optOrigin = document.createElement('option');
    optOrigin.value = 'origin';
    optOrigin.textContent = destination.origin;
    const optName = document.createElement('option');
    optName.value = 'name';
    optName.textContent = destination.name;
    select.appendChild(optOrigin);
    select.appendChild(optName);
    select.value = leg.legState === 'home' ? 'origin' : 'name';
    select.addEventListener('change', async () => {
      select.disabled = true;
      try {
        await setStartingPoint(destination.id, select.value);
        await refresh();
      } catch (err) {
        alert(err.message);
        select.disabled = false;
      }
    });
    fromRow.appendChild(select);
  } else {
    const val = document.createElement('span');
    val.className = 'leg-value';
    val.textContent = leg.from;
    fromRow.appendChild(val);
  }
  block.appendChild(fromRow);

  const toRow = document.createElement('div');
  toRow.className = 'leg-row';
  const toLabel = document.createElement('span');
  toLabel.className = 'leg-label';
  toLabel.textContent = 'Arriving at:';
  const toVal = document.createElement('span');
  toVal.className = 'leg-value';
  toVal.textContent = leg.to;
  toRow.appendChild(toLabel);
  toRow.appendChild(toVal);
  block.appendChild(toRow);

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
  block.appendChild(tripButton);

  return block;
}

// The planner block, shown once BOTH legs have at least one logged trip:
// fixed "Starting from"/"Arriving at" text (no dropdown, no trip button —
// testing is done), its averaged duration, and an inline arrive-by + buffer
// control with a scheduled browser notification.
function renderPlannerLegBlock(destination, leg) {
  const { from, to, avgSeconds } = leg;

  const block = document.createElement('div');
  block.className = 'leg-block';

  const fromRow = document.createElement('div');
  fromRow.className = 'leg-row';
  fromRow.innerHTML = '<span class="leg-label">Starting from:</span>';
  const fromVal = document.createElement('span');
  fromVal.className = 'leg-value';
  fromVal.textContent = from;
  fromRow.appendChild(fromVal);
  block.appendChild(fromRow);

  const toRow = document.createElement('div');
  toRow.className = 'leg-row';
  toRow.innerHTML = '<span class="leg-label">Arriving at:</span>';
  const toVal = document.createElement('span');
  toVal.className = 'leg-value';
  toVal.textContent = to;
  toRow.appendChild(toVal);
  block.appendChild(toRow);

  const durationRow = document.createElement('div');
  durationRow.className = 'leg-duration';
  durationRow.textContent = `Duration: ${formatDuration(avgSeconds)}`;
  block.appendChild(durationRow);

  const arriveByRow = document.createElement('div');
  arriveByRow.className = 'arrive-by-row';

  const rowLabel = document.createElement('span');
  rowLabel.className = 'arrive-by-label';
  rowLabel.textContent = `Arrive at ${to} by:`;

  const timeInput = document.createElement('input');
  timeInput.type = 'time';
  timeInput.className = 'target-time-input';
  timeInput.setAttribute('aria-label', `Target arrival time, ${from} to ${to}`);

  const bufferGroup = document.createElement('span');
  bufferGroup.className = 'buffer-group';
  const bufferInput = document.createElement('input');
  bufferInput.type = 'number';
  bufferInput.className = 'buffer-input';
  bufferInput.min = '0';
  bufferInput.value = String(DEFAULT_BUFFER_MINUTES);
  bufferInput.setAttribute('aria-label', `Buffer minutes, ${from} to ${to}`);
  const bufferLabel = document.createElement('span');
  bufferLabel.className = 'buffer-label';
  bufferLabel.textContent = 'min buffer';
  bufferGroup.appendChild(bufferInput);
  bufferGroup.appendChild(bufferLabel);

  arriveByRow.appendChild(rowLabel);
  arriveByRow.appendChild(timeInput);
  arriveByRow.appendChild(bufferGroup);

  const result = document.createElement('div');
  result.className = 'leave-by-result';

  // One pending browser-notification timer per row. Re-typing the time or
  // buffer replaces it rather than stacking up duplicate notifications.
  let notifyTimer = null;

  function scheduleNotification(leaveBy) {
    if (notifyTimer) {
      clearTimeout(notifyTimer);
      notifyTimer = null;
    }
    const msUntil = leaveBy.getTime() - Date.now();
    if (msUntil <= 0) return;
    notifyTimer = setTimeout(() => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(`Time to leave for ${to}`, {
          body: `Leave ${from} now to arrive by ${timeInput.value}.`,
        });
      }
    }, msUntil);
  }

  function update() {
    if (!timeInput.value) {
      result.textContent = '';
      if (notifyTimer) {
        clearTimeout(notifyTimer);
        notifyTimer = null;
      }
      return;
    }
    const buffer = Number(bufferInput.value) || 0;
    const leaveBy = computeLeaveBy(timeInput.value, avgSeconds, buffer);
    result.textContent = `Leave by ${formatClockTime(leaveBy)}`;
    scheduleNotification(leaveBy);
  }
  timeInput.addEventListener('input', update);
  bufferInput.addEventListener('input', update);

  block.appendChild(arriveByRow);
  block.appendChild(result);

  return block;
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

    const title = document.createElement('h2');
    title.className = 'destination-title';
    title.textContent = `${destination.origin} — ${destination.name}`;
    item.appendChild(title);

    const legs = document.createElement('div');
    legs.className = 'leg-blocks';

    const aToBDone = destination.aToBCount > 0;
    const bToADone = destination.bToACount > 0;

    if (aToBDone && bToADone) {
      legs.appendChild(renderPlannerLegBlock(destination, legInfo(destination, 'home')));
      legs.appendChild(renderPlannerLegBlock(destination, legInfo(destination, 'destination')));
    } else {
      const allowDropdown = !aToBDone && !bToADone;
      const activeLeg = legInfo(destination, destination.currentState);
      legs.appendChild(renderSetupLegBlock(destination, activeLeg, allowDropdown));
    }

    item.appendChild(legs);
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
  const origin = originInput.value.trim() || 'Home';
  if (!name) return;
  await addDestination(name, origin);
  originInput.value = '';
  nameInput.value = '';
  await refresh();
});

requestNotificationPermissionOnce();
refresh().catch((err) => console.error(err));
