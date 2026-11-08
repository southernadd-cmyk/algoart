import {systems, palettes, paletteInks, createStudy, makeRun, prepareCanvas} from './collab.js';
import {materials, makePainter} from './materials.js';

const byId = id => document.getElementById(id);
const form = byId('study-form');
const roster = byId('roster');
const add = byId('add-artist');
const seed = byId('seed');
const response = byId('response');
const strength = byId('strength');
const playButton = byId('play');
const stepButton = byId('step');
const finishButton = byId('finish');
const save = byId('download');
const shared = byId('shared');
const baseline = byId('baseline');
const minArtists = 2;
const maxArtists = 8;
const systemChoices = systems.map(system => [system.id, system.name]);
const choices = {
  system: systemChoices,
  palette: Object.entries(palettes),
  material: Object.entries(materials)
};
const hints = {
  weave: "Look for gaps beside other artists' marks.",
  echo: 'Look for nearby marks that run in a similar direction.',
  space: "Favour open paper farther from other artists' marks."
};

let nextId = 1;
const artists = [];
const state = {frame: 0, playing: false, finishing: false, history: [], turn: 0};

function newArtist(source) {
  const system = systems.find(candidate => !artists.some(artist => artist.system === candidate.id)) || systems[0];
  return {system: system.id, palette: 'signature', material: 'marker', ...source, id: nextId++};
}

function syncHint(changed) {
  byId('roster-status').textContent = changed
    ? 'Settings changed. Draw study to apply them.'
    : artists.length + ' artists ready.';
}

function showSwatches(holder, artist) {
  const swatches = paletteInks(artist, seed.value.trim()).map(ink => {
    const swatch = document.createElement('span');
    swatch.style.backgroundColor = ink;
    return swatch;
  });
  holder.replaceChildren(...swatches);
}

function picker(artist, index, key) {
  const field = document.createElement('label');
  field.className = 'artist-' + key;
  const caption = document.createElement('span');
  const select = document.createElement('select');
  const name = key.charAt(0).toUpperCase() + key.slice(1);
  caption.textContent = name;
  select.setAttribute('aria-label', 'Artist ' + (index + 1) + ' ' + key);
  select.dataset.field = key;
  for (const [value, title] of choices[key]) select.add(new Option(title, value));
  select.value = artist[key];
  field.append(caption, select);
  return field;
}

function rosterButton(action, text, index, disabled) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.action = action;
  button.textContent = text;
  button.setAttribute('aria-label', action + ' artist ' + (index + 1));
  button.disabled = disabled;
  return button;
}

function renderRoster(focusId) {
  const cards = artists.map((artist, index) => {
    const card = document.createElement('section');
    card.className = 'artist';
    card.dataset.artist = artist.id;
    const header = document.createElement('div');
    header.className = 'artist-head';
    const title = document.createElement('h3');
    title.id = 'artist-title-' + artist.id;
    title.textContent = 'Artist ' + String(index + 1).padStart(2, '0');
    card.setAttribute('aria-labelledby', title.id);
    const swatches = document.createElement('div');
    swatches.className = 'artist-swatches';
    swatches.setAttribute('aria-hidden', 'true');
    showSwatches(swatches, artist);
    const tools = document.createElement('div');
    tools.className = 'artist-tools';
    tools.append(
      rosterButton('Duplicate', 'Copy', index, artists.length >= maxArtists),
      rosterButton('Remove', 'Remove', index, artists.length <= minArtists)
    );
    header.append(title, swatches, tools);
    const fields = document.createElement('div');
    fields.className = 'artist-fields';
    fields.append(picker(artist, index, 'system'), picker(artist, index, 'palette'), picker(artist, index, 'material'));
    card.append(header, fields);
    return card;
  });
  roster.replaceChildren(...cards);
  add.disabled = artists.length >= maxArtists;
  byId('artist-count').textContent = artists.length + ' / ' + maxArtists;
  for (const button of byId('counts').querySelectorAll('button')) {
    button.setAttribute('aria-pressed', Number(button.dataset.count) === artists.length);
  }
  if (focusId) roster.querySelector('[data-artist="' + focusId + '"] select')?.focus();
}

function resize(count) {
  if (artists.length > count) artists.length = count;
  while (artists.length < count) artists.push(newArtist());
}

function updateReadout() {
  const total = state.study?.schedule.length || 0;
  const progress = total ? Math.floor(state.turn / total * 100) : 0;
  const ready = Boolean(state.study);
  const complete = state.turn === total;
  byId('counter').textContent = state.turn + ' / ' + total + ' turns';
  byId('progress').style.width = progress + '%';
  byId('progress').parentElement.setAttribute('aria-valuenow', progress);
  playButton.textContent = state.playing ? 'Pause' : complete ? 'Replay' : state.turn ? 'Resume' : 'Play';
  playButton.disabled = !ready;
  stepButton.disabled = !ready || state.playing;
  finishButton.disabled = !ready || complete || state.finishing;
  save.disabled = !ready || !state.turn;
  byId('summary').textContent = ready ? state.changed + ' / ' + state.read + ' turns adjusted after reading marks'
    : 'Prepare a study';
  const items = state.history.map(action => {
    const item = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = action.artist.ink;
    const name = document.createElement('strong');
    name.textContent = 'Artist ' + action.artist.number + ' · ' + action.artist.name;
    const detail = document.createElement('span');
    detail.className = 'detail';
    const result = !state.settings.strength ? 'Independent'
      : !action.heard ? 'First mark on paper'
      : (action.changed ? 'Adjusted' : 'Held') + ' after reading ' + action.heard +
        (action.heard === 1 ? ' artist' : ' artists');
    detail.textContent = materials[action.artist.material] + ' · ' + action.group.label + ' · ' + result;
    item.append(swatch, name, detail);
    return item;
  });
  byId('decisions').replaceChildren(...items);
}

function stop() {
  cancelAnimationFrame(state.frame);
  state.playing = false;
  state.finishing = false;
  state.frame = 0;
}

function reset() {
  stop();
  const settings = state.settings;
  state.paintShared = makePainter(prepareCanvas(shared, settings.seed), settings.seed);
  state.paintBaseline = makePainter(prepareCanvas(baseline, settings.seed), settings.seed);
  state.run = makeRun(state.study, settings.strength, settings.response);
  state.baseline = makeRun(state.study, 0, settings.response);
  state.turn = 0;
  state.changed = 0;
  state.read = 0;
  state.history = [];
}

function advance() {
  if (state.turn >= state.study.schedule.length) return false;
  const action = state.run.next(state.paintShared);
  state.baseline.next(state.paintBaseline);
  state.turn++;
  if (action.heard) state.read++;
  if (action.changed) state.changed++;
  state.history.unshift(action);
  state.history.length = Math.min(state.history.length, 4);
  return true;
}

function failStudy(error) {
  console.error(error);
  stop();
  state.study = null;
  state.turn = 0;
  updateReadout();
  byId('summary').textContent = 'Could not render this study.';
  byId('status').textContent = 'Could not render this study.';
}

function finish() {
  stop();
  if (state.study.roster.every(artist => artist.material === 'marker')) {
    while (advance()) {}
    updateReadout();
    return;
  }
  state.playing = true;
  state.finishing = true;
  updateReadout();
  function drawBatch() {
    const start = performance.now();
    try {
      while (advance() && performance.now() - start < 17) {}
    } catch (error) {
      failStudy(error);
      return;
    }
    if (state.turn === state.study.schedule.length) stop();
    else state.frame = requestAnimationFrame(drawBatch);
    updateReadout();
  }
  state.frame = requestAnimationFrame(drawBatch);
}

function play() {
  if (state.playing) {
    stop();
    updateReadout();
    return;
  }
  if (state.turn === state.study.schedule.length) reset();
  state.playing = true;
  updateReadout();
  let last = -Infinity;
  function tick(now) {
    if (now - last > 83) {
      last = now;
      try {
        advance();
      } catch (error) {
        failStudy(error);
        return;
      }
      if (state.turn === state.study.schedule.length) stop();
      updateReadout();
    }
    if (state.playing) state.frame = requestAnimationFrame(tick);
  }
  state.frame = requestAnimationFrame(tick);
}

function build() {
  const studySeed = seed.value.trim();
  if (!studySeed) {
    seed.focus();
    return;
  }
  stop();
  try {
    state.settings = {seed: studySeed, response: response.value, strength: Number(strength.value)};
    state.study = createStudy(studySeed, artists);
    reset();
    finish();
    syncHint(false);
    byId('status').textContent = 'Study prepared with ' + artists.length + ' artists.';
  } catch (error) {
    failStudy(error);
  }
}

function setComparison(comparing) {
  byId('single').setAttribute('aria-pressed', !comparing);
  byId('compare').setAttribute('aria-pressed', comparing);
  byId('baseline-panel').hidden = !comparing;
  byId('canvases').classList.toggle('comparing', comparing);
}

byId('counts').addEventListener('click', event => {
  const button = event.target.closest('button[data-count]');
  if (!button || Number(button.dataset.count) === artists.length) return;
  resize(Number(button.dataset.count));
  renderRoster();
  syncHint(true);
});

add.addEventListener('click', () => {
  if (artists.length >= maxArtists) return;
  const artist = newArtist();
  artists.push(artist);
  renderRoster(artist.id);
  syncHint(true);
});

roster.addEventListener('change', event => {
  const card = event.target.closest('[data-artist]');
  const artist = artists.find(entry => entry.id === Number(card.dataset.artist));
  artist[event.target.dataset.field] = event.target.value;
  showSwatches(card.querySelector('.artist-swatches'), artist);
  syncHint(true);
});

roster.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = Number(button.closest('[data-artist]').dataset.artist);
  const index = artists.findIndex(entry => entry.id === id);
  if (button.dataset.action === 'Duplicate' && artists.length < maxArtists) {
    const copy = newArtist(artists[index]);
    artists.splice(index + 1, 0, copy);
    renderRoster(copy.id);
  } else if (button.dataset.action === 'Remove' && artists.length > minArtists) {
    artists.splice(index, 1);
    renderRoster(artists[Math.min(index, artists.length - 1)].id);
  }
  syncHint(true);
});

response.addEventListener('change', () => {
  byId('response-help').textContent = hints[response.value];
  syncHint(true);
});
strength.addEventListener('input', () => {
  byId('strength-value').value = strength.value + '%';
  syncHint(true);
});
seed.addEventListener('input', () => syncHint(true));
seed.addEventListener('change', () => {
  for (const [index, artist] of artists.entries()) {
    showSwatches(roster.children[index].querySelector('.artist-swatches'), artist);
  }
});
byId('new-seed').addEventListener('click', () => {
  seed.value = String(crypto.getRandomValues(new Uint32Array(1))[0]);
  seed.dispatchEvent(new Event('change'));
  syncHint(true);
});
form.addEventListener('submit', event => {
  event.preventDefault();
  build();
  if (form.contains(event.submitter) && matchMedia('(max-width: 820px)').matches) {
    byId('drawing').scrollIntoView({block: 'start'});
  }
});

playButton.addEventListener('click', play);
finishButton.addEventListener('click', finish);
stepButton.addEventListener('click', () => {
  if (state.turn === state.study.schedule.length) reset();
  try {
    advance();
  } catch (error) {
    failStudy(error);
    return;
  }
  updateReadout();
  const action = state.history[0];
  byId('status').textContent = 'Artist ' + action.artist.number + ' drew ' + action.group.label + '.';
});
byId('single').addEventListener('click', () => setComparison(false));
byId('compare').addEventListener('click', () => setComparison(true));
save.addEventListener('click', () => {
  const filename = 'proportion-piece-collab-' + state.settings.seed.replace(/[^a-zA-Z0-9_-]/g, '_') + '.png';
  shared.toBlob(blob => {
    if (!blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 30000);
  }, 'image/png');
});

resize(3);
renderRoster();
build();
