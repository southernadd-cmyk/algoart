import {systems, palettes, paletteInks, createStudy, makeRun, prepareCanvas} from './collab.js?v=confluence-progressive-order-11';
import {materials, makePainter} from './materials.js?v=confluence-tissue-source-over-18';
import {artistInspector, defaultSettings} from './artist-controls.js?v=studio-06';
import {turnShares} from './composition.js?v=studio-06';
import {mountDrawer} from './drawer-ui.js?v=confluence-viewport-04';
import {restoreSharedState, bindSharing} from './share-study.js?v=confluence-wash-seams-07';
import {importLeadFromURL} from './import-lead.js?v=confluence-01';

const byId = id => document.getElementById(id);
const form = byId('study-form');
const roster = byId('roster');
const seed = byId('seed');
const strength = byId('strength');
const collaborationPull = byId('collaboration-pull');
const orientation = byId('orientation');
const paper = byId('paper');
const grain = byId('grain');
const totalTurns = byId('total-turns');
const playButton = byId('play');
const stepButton = byId('step');
const finishButton = byId('finish');
const save = byId('download');
const shared = byId('shared');
const baseline = byId('baseline');
const canvases = byId('canvases');
const systemChoices = systems.map(system => [system.id, system.name]);
const choices = {
  system: systemChoices,
  palette: Object.entries(palettes),
  material: Object.entries(materials)
};

const artists = systems.slice(0, 3).map((system, index) => ({
  id: index + 1, system: system.id, palette: 'spectrum', material: 'marker', settings: defaultSettings(system)
}));
const state = {frame: 0, playing: false, finishing: false, history: [], turn: 0};
// Remember the user's *requested* number of turns separately from what the
// current roster can supply. A low-capacity system must not permanently
// reduce subsequent studies to eight Fibonacci turns.
let preferredTurns=55;

function syncHint(changed) {
  const status = byId('roster-status');
  status.dataset.pending = String(changed);
  byId('board-pending').hidden = !changed;
  status.textContent = changed ? 'Changes ready to draw' : 'Roster applied';
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

function renderRoster() {
  const cards = artists.map((artist, index) => {
    const card = document.createElement('section');
    card.className = 'artist';
    card.dataset.artist = artist.id;
    card.dataset.role = index === 0 ? 'lead' : 'response';
    const header = document.createElement('div');
    header.className = 'artist-head';
    const title = document.createElement('h3');
    title.id = 'artist-title-' + artist.id;
    const number = document.createElement('span');
    number.className = 'artist-number';
    number.textContent = String(index + 1).padStart(2, '0');
    title.append(number, 'Artist ' + artist.id);
    const role = document.createElement('span');
    role.className = 'artist-role';
    role.textContent = ['Lead voice', 'Reply', 'Counterpoint'][index];
    card.setAttribute('aria-labelledby', title.id);
    const swatches = document.createElement('div');
    swatches.className = 'artist-swatches';
    swatches.setAttribute('aria-hidden', 'true');
    showSwatches(swatches, artist);
    header.append(title, role, swatches);
    const fields = document.createElement('div');
    fields.className = 'artist-fields';
    fields.append(picker(artist, index, 'system'), picker(artist, index, 'palette'), picker(artist, index, 'material'));
    card.append(header, fields, artistInspector(artist));
    return card;
  });
  roster.replaceChildren(...cards);
  byId('artist-count').textContent = '3 artists';
  updateShares();
}

function updateShares() {
  byId('collaboration-value').value = collaborationPull.value + '%';
  const bars = turnShares(Number(collaborationPull.value)).map((share, i) => {
    const tag = document.createElement('span');
    tag.textContent = 'A' + (i + 1) + ' · ' + (share * 100).toFixed(1) + '%';
    tag.style.flexGrow = share;
    return tag;
  });
  byId('turn-shares').replaceChildren(...bars);
}

function updateReadout() {
  const total = state.study?.schedule.length || 0;
  const progress = total ? Math.floor(state.turn / total * 100) : 0;
  const ready = total > 0;
  const complete = state.turn === total;
  byId('counter').textContent = state.turn + ' / ' + total + ' turns';
  byId('progress').style.width = progress + '%';
  byId('progress').parentElement.setAttribute('aria-valuenow', progress);
  playButton.textContent = state.playing ? 'Pause' : complete ? 'Replay' : state.turn ? 'Resume' : 'Play';
  playButton.disabled = !ready;
  stepButton.disabled = !ready || state.playing;
  finishButton.disabled = !ready || complete || state.finishing;
  save.disabled = !ready || !state.turn;
  if (state.shareControls) state.shareControls.sync();
  byId('summary').textContent = ready
    ? state.replanned + ' / ' + state.read + ' turns replanned from the shared sheet'
    : state.study ? 'No visible marks for these settings' : 'Prepare a study';
  const items = state.history.map(action => {
    const item = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = action.artist.ink;
    const name = document.createElement('strong');
    name.textContent = 'Artist ' + action.artist.number + ' · ' + action.artist.name;
    const detail = document.createElement('span');
    detail.className = 'detail';
    const influences = action.contacts.map(number => 'Artist ' + number).join(' and ');
    const result = !state.settings.strength ? 'Independent'
      : !action.heard ? 'First mark on paper'
      : action.plans.size ? 'Replanned from ' + (influences || 'earlier ink')
      : action.reordered ? 'Chose the next mark from the shared drawing'
      : (action.changed ? 'Adjusted' : 'Held') + ' after reading ' + action.heard +
        (action.heard === 1 ? ' artist' : ' artists');
    const reaction = action.heard && state.settings.strength
      ? {weave:'weaving',echo:'echoing',space:'leaving space'}[action.reaction]
      : null;
    detail.textContent = materials[action.artist.material] + ' · ' + action.group.label +
      (reaction?' · '+reaction:'') + ' · ' + result;
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
  const sheet = state.study.sheet;
  state.paintShared = makePainter(prepareCanvas(shared, settings.seed, sheet), settings.seed, sheet,
    {roster:state.study.roster});
  state.paintBaseline = makePainter(prepareCanvas(baseline, settings.seed, sheet), settings.seed, sheet,
    {roster:state.study.roster});
  state.run = makeRun(state.study, settings.strength);
  state.baseline = makeRun(state.study, settings.strength, {equal: true});
  state.turn = 0;
  state.replanned = 0;
  state.read = 0;
  state.history = [];
}

function advance() {
  if (state.turn >= state.study.schedule.length) return false;
  const action = state.run.next(state.paintShared);
  state.baseline.next(state.paintBaseline);
  state.turn++;
  if(state.turn===state.study.schedule.length){
    state.paintShared.finalize?.();
    state.paintBaseline.finalize?.();
  }
  if (action.heard) state.read++;
  if (action.plans.size || action.reordered) state.replanned++;
  state.history.unshift(action);
  state.history.length = Math.min(state.history.length, 4);
  return true;
}

function failStudy(error) {
  console.error(error);
  stop();
  state.study = null;
  state.history = [];
  state.turn = 0;
  updateReadout();
  state.snapshot = null;
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
    state.settings = {seed: studySeed, strength: Number(strength.value),
      collaborationPull: Number(collaborationPull.value)};
    const slots = artists.map(artist => ({...artist, settings: {...artist.settings}}));
    state.study = createStudy(studySeed, slots,
      {orientation: orientation.value, paper: paper.value, grain: Number(grain.value)},
      state.settings.collaborationPull, preferredTurns);
    const selectedTurns = state.study.totalTurns;
    totalTurns.replaceChildren(...state.study.availableTurns.map(count => new Option(count + ' turns', String(count))));
    totalTurns.value = String(selectedTurns);
    byId('turn-count-help').textContent = 'The selected systems support up to ' +
      state.study.availableTurns.at(-1) + ' Fibonacci turns. Step advances one turn at a time.';
    state.snapshot = {
      v: 1, seed: studySeed, orientation: orientation.value,
      paper: paper.value, grain: Number(grain.value),
      strength: Number(strength.value), collaborationPull: Number(collaborationPull.value),
      totalTurns: selectedTurns,
      artists: slots.map(({system,palette,material,settings})=>({system,palette,material,settings}))
    };
    const {width, height} = state.study.sheet;
    byId('drawing').dataset.format = orientation.value;
    byId('dimensions').textContent = width + ' × ' + height;
    syncFormatButtons();
    // Fit synchronously before starting the expensive initial render.
    // Delaying to a microtask lets the default 100%-wide figure flash.
    fitCanvas();
    byId('shared-caption').textContent = state.settings.collaborationPull ? 'φ-weighted turns' : 'Equal turns';
    byId('shared-turns').textContent = state.study.primary.counts.join(' / ') + ' turns';
    byId('equal-turns').textContent = state.study.equal.counts.join(' / ') + ' turns';
    reset();
    finish();
    syncHint(false);
    byId('status').textContent = 'Study prepared with three artists.';
  } catch (error) {
    failStudy(error);
  }
}


function syncFormatButtons() {
  for (const format of ['portrait','landscape']) {
    byId('format-' + format).setAttribute('aria-pressed', String(orientation.value === format));
  }
}
// Fit within *actual* viewport area, including portrait and side-by-side
// comparison. This affects CSS display width only; exports remain full pixels.
function fitCanvas() {
  // Do not reveal the paper until the stage has measurable dimensions.
  // Hidden figures still participate in layout; the ResizeObserver retries
  // if the stage is not yet sized (e.g. mobile browser viewport settling).
  if (canvases.clientWidth < 20 || canvases.clientHeight < 30) return;
  const count = canvases.classList.contains('comparing') ? 2 : 1;
  const ratio = state.study ? state.study.sheet.width / state.study.sheet.height
    : orientation.value === 'portrait' ? 5 / 7 : 7 / 5;
  const gap = count > 1 ? 16 : 0;
  const width = Math.max(1, canvases.clientWidth - gap - 12);
  const height = Math.max(1, canvases.clientHeight - 29);
  const fitted = Math.max(1, Math.floor(Math.min(width / count, height * ratio)));
  // Constrain the displayed paper; keep source/export pixels unchanged.
  for (const figure of canvases.querySelectorAll('figure')) {
    figure.style.width = fitted + 'px';
    figure.style.maxWidth = fitted + 'px';
  }
  // The CSS keeps paper hidden until its final display width is set.
  // This changes visibility, never opacity or the rendered pixels.
  canvases.classList.add('is-sized');
}

function setComparison(comparing) {
  byId('single').setAttribute('aria-pressed', !comparing);
  byId('compare').setAttribute('aria-pressed', comparing);
  byId('baseline-panel').hidden = !comparing;
  byId('canvases').classList.toggle('comparing', comparing);
  queueMicrotask(fitCanvas);
}

function artistFor(input) {
  return artists[Number(input.closest('[data-artist]').dataset.artist) - 1];
}

function updateArtist(input) {
  const artist = artistFor(input);
  const key = input.dataset.setting;
  if (key) {
    artist.settings[key] = input.type === 'range' ? Number(input.value)
      : input.type === 'checkbox' ? input.checked : input.value;
    if (input.type === 'range') input.parentElement.querySelector('output').value = input.value;
  } else {
    artist[input.dataset.field] = input.value;
  }
  if (!key || ['colourCount', 'saturation', 'brightness'].includes(key)) {
    showSwatches(input.closest('[data-artist]').querySelector('.artist-swatches'), artist);
  }
  syncHint(true);
}

roster.addEventListener('input', event => {
  if (['range', 'text'].includes(event.target.type)) updateArtist(event.target);
});
roster.addEventListener('change', event => {
  if (!['range', 'text'].includes(event.target.type)) updateArtist(event.target);
});

for (const input of [orientation, paper, grain]) input.addEventListener('input', () => {
  byId('grain-value').value = grain.value;
  syncFormatButtons();
  syncHint(true);
});
orientation.addEventListener('change', build);
totalTurns.addEventListener('change', () => {
  preferredTurns=Number(totalTurns.value)||55;
  build();
});
for (const format of ['landscape','portrait']) {
  byId('format-' + format).addEventListener('click', () => {
    if (orientation.value === format) return;
    orientation.value = format;
    syncFormatButtons();
    build();
  });
}

collaborationPull.addEventListener('input', () => {
  updateShares();
  syncHint(true);
});
collaborationPull.addEventListener('change', build);
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
  if (!state.study) return;
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
  const filename = 'proportion-piece-confluence-' + state.settings.seed.replace(/[^a-zA-Z0-9_-]/g, '_') + '.png';
  shared.toBlob(blob => {
    if (!blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 30000);
  }, 'image/png');
});

// The page remains a complete, bookmarkable editor; a shared composition
// restores all three voices, while a future main-editor handoff imports Artist 1.
const inputs = {seed, orientation, paper, grain, strength, collaborationPull, totalTurns};
const params = new URLSearchParams(location.search);
const restored = restoreSharedState(params, artists, inputs, {systems, palettes, materials});
if(restored)preferredTurns=Number(totalTurns.value)||55;
const imported = !restored && importLeadFromURL(params, artists[0],
  {seed, orientation, paper, grain}, {systems, palettes, materials});
byId('import-note').hidden = !imported;
renderRoster();
mountDrawer();
state.shareControls = bindSharing({
  canvas: shared, ready: () => !!state.study && state.turn === state.study.schedule.length &&
    !state.playing && !byId('roster-status').dataset.pending?.includes('true') && !!state.snapshot,
  snapshot: () => state.snapshot
});
const viewport = new ResizeObserver(() => fitCanvas());
viewport.observe(canvases);
viewport.observe(byId('drawing'));
window.addEventListener('resize', fitCanvas);
syncFormatButtons();
build();
