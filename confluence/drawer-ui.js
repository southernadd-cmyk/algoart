// The shared artist controls live in one drawer: three artist tabs and one shared tab.
export function mountDrawer() {
  const $ = id => document.getElementById(id);
  const controls = $('confluence-controls');
  const form = $('study-form');
  const roster = $('roster');
  const artists = $('artists');
  const openButton = $('inspector-toggle');
  const scrim = $('drawer-scrim');
  const drawActions = form.querySelector('.draw-actions');
  let current = 'artist-1';
  let open = false;

  const header = document.createElement('div');
  header.className = 'drawer-head';
  header.innerHTML = '<strong>PARAMETERS</strong><button type="button" id="inspector-close" aria-label="Close parameters">×</button>';
  form.insertBefore(header, artists);

  const tabs = document.createElement('nav');
  tabs.className = 'drawer-tabs';
  tabs.setAttribute('role','tablist');
  tabs.setAttribute('aria-label','Parameter categories');
  for (const [id, label] of [['artist-1','Artist 1'], ['artist-2','Artist 2'], ['artist-3','Artist 3'], ['shared','Shared']]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'drawer-tab';
    b.id = 'tab-' + id;
    b.dataset.pane = id;
    b.textContent = label;
    b.setAttribute('role','tab');
    b.setAttribute('aria-controls', id === 'shared' ? 'shared-settings' : 'artists');
    tabs.append(b);
  }
  form.insertBefore(tabs, artists);

  // All shared inputs, including φ turn allocation, belong on the fourth tab.
  const sharedSettings = document.createElement('div');
  sharedSettings.id = 'shared-settings';
  sharedSettings.className = 'shared-settings';
  sharedSettings.setAttribute('role','tabpanel');
  sharedSettings.setAttribute('aria-labelledby','tab-shared');
  sharedSettings.append(form.querySelector('.study-settings'), form.querySelector('.sheet-settings'), $('turn-balance'));
  form.insertBefore(sharedSettings, drawActions);

  const rosterHeading = artists.querySelector('.roster-heading');
  if(rosterHeading) rosterHeading.hidden = true;
  artists.setAttribute('role','tabpanel');
  artists.setAttribute('aria-labelledby','tab-artist-1');
  const count = $('artist-count');
  if(count) count.textContent = '3 artists';

  function selectPane(pane, focus = false) {
    current = pane;
    for (const tab of tabs.querySelectorAll('button')) {
      const selected = tab.dataset.pane === pane;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (focus && selected) tab.focus();
    }
    const shared = pane === 'shared';
    sharedSettings.hidden = !shared;
    artists.hidden = shared;
    if (!shared) {
      artists.setAttribute('aria-labelledby','tab-' + pane);
      for (const card of roster.children) card.hidden = card.dataset.artist !== pane.slice(-1);
    }
  }

  function setOpen(next, focus = true) {
    open = next;
    controls.classList.toggle('is-open', open);
    controls.setAttribute('aria-hidden', String(!open));
    controls.inert = !open;
    scrim.hidden = !open;
    openButton.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('drawer-open', open);
    if (focus) {
      if (open) tabs.querySelector('[aria-selected="true"]').focus();
      else openButton.focus();
    }
  }

  tabs.addEventListener('click', event => {
    const tab = event.target.closest('button[data-pane]');
    if(tab) selectPane(tab.dataset.pane);
  });
  tabs.addEventListener('keydown', event => {
    if (!['ArrowRight','ArrowLeft','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const items = [...tabs.querySelectorAll('button[data-pane]')];
    let i = items.findIndex(tab => tab.dataset.pane === current);
    if(event.key === 'Home') i = 0;
    else if(event.key === 'End') i = items.length - 1;
    else i = (i + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
    selectPane(items[i].dataset.pane, true);
  });
  openButton.addEventListener('click', () => setOpen(!open));
  $('inspector-close').addEventListener('click', () => setOpen(false));
  scrim.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open) setOpen(false);
  });
  const editArtists = $('edit-artists');
  if (editArtists) editArtists.addEventListener('click', () => {
    selectPane('artist-1');
    setOpen(true);
  });
  // Rendering is performed by the existing form handler; return to the artwork.
  form.addEventListener('submit', () => setOpen(false, false));
  selectPane('artist-1');
  setOpen(false, false);
}
