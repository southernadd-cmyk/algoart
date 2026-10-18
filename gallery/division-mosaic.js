/* Each daily cover uses a deterministic golden-ratio recursive partition.
 * Every image listed in the day's meta.json gets one tile, including portraits. */
(() => {
  const PHI = (Math.sqrt(5) - 1) / 2;
  function rectangles(count, seed) {
    const boxes = [{x: 0, y: 0, w: 1, h: 1}];
    while (boxes.length < count) {
      let largest = 0;
      for (let i = 1; i < boxes.length; i++)
        if (boxes[i].w * boxes[i].h > boxes[largest].w * boxes[largest].h) largest = i;
      const box = boxes.splice(largest, 1)[0];
      const vertical = box.w >= box.h;
      // Split in golden proportions, alternating which child gets the larger region.
      const fraction = (boxes.length + seed) % 2 ? PHI : 1 - PHI;
      if (vertical) {
        boxes.push({x:box.x,y:box.y,w:box.w*fraction,h:box.h});
        boxes.push({x:box.x+box.w*fraction,y:box.y,w:box.w*(1-fraction),h:box.h});
      } else {
        boxes.push({x:box.x,y:box.y,w:box.w,h:box.h*fraction});
        boxes.push({x:box.x,y:box.y+box.h*fraction,w:box.w,h:box.h*(1-fraction)});
      }
    }
    return boxes.sort((a,b) => a.y-b.y || a.x-b.x);
  }
  function build(card, date, entries) {
    const images = entries.filter(e => e && typeof e.imageFile === 'string' && /^[\w.-]+\.(jpe?g|png|webp)$/i.test(e.imageFile));
    // Never replace the cover with a partial mosaic when metadata is missing.
    if (!images.length || images.length !== entries.length) return;
    const link = card.querySelector('a');
    const cover = link && link.querySelector('img');
    if (!cover) return;
    const mosaic = document.createElement('div');
    mosaic.className = 'division-mosaic';
    mosaic.setAttribute('role','img');
    mosaic.setAttribute('aria-label', images.length + ' artworks from ' + date + ', arranged in golden-ratio recursive rectangles');
    const seed = [...date].reduce((a,ch) => a + ch.charCodeAt(0),0);
    const cells = rectangles(images.length,seed);
    images.forEach((entry,i) => {
      const box = cells[i];
      const tile = document.createElement('span');
      tile.className = 'division-tile';
      tile.style.left = (box.x*100) + '%';
      tile.style.top = (box.y*100) + '%';
      tile.style.width = (box.w*100) + '%';
      tile.style.height = (box.h*100) + '%';
      const img = document.createElement('img');
      img.src = './' + date + '/' + entry.imageFile;
      img.alt = '';
      img.loading = card === document.querySelector('.day-card') ? 'eager' : 'lazy';
      img.fetchPriority = 'low';
      img.decoding = 'async';
      tile.append(img);
      mosaic.append(tile);
    });
    cover.replaceWith(mosaic);
    card.classList.remove('portrait');
    card.classList.add('has-division-mosaic');
  }
  // Keep initial navigation responsive. The old implementation fetched metadata
  // for every day at once and immediately constructed hundreds of full-size images.
  const cards = [...document.querySelectorAll('.day-card')];
  const jobs = [];
  const queued = new WeakSet();
  let active = 0;
  const LIMIT = 2;
  function pump() {
    while (active < LIMIT && jobs.length) {
      const {card,date} = jobs.shift();
      active++;
      fetch('./' + date + '/meta.json', {priority:'low'})
        .then(response => { if (!response.ok) throw new Error('metadata unavailable'); return response.json(); })
        .then(meta => { if (Array.isArray(meta.entries)) build(card,date,meta.entries); })
        .catch(() => { /* The existing single-image cover remains available. */ })
        .finally(() => { active--; pump(); });
    }
  }
  function enqueue(card) {
    if (queued.has(card)) return;
    const link = card.querySelector('a[href]');
    const match = link?.getAttribute('href')?.match(/^\\.\\/([0-9]{4}-[0-9]{2}-[0-9]{2})\\/$/);
    if (!match) return;
    queued.add(card);
    jobs.push({card,date:match[1]});
    pump();
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        enqueue(entry.target);
      }
    }, {rootMargin:'400px 0px'});
    cards.forEach(card => observer.observe(card));
  } else {
    // Small, deferred batches on older browsers.
    cards.forEach((card,i) => setTimeout(() => enqueue(card),i*250));
  }
})();
