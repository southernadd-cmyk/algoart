// Interpret the solo editor's "Explore in Confluence" full-state link.
// Artist 1 receives the source drawing's starting settings; Confluence
// responds to existing marks and need not reproduce its pixels exactly.
const numeric = {
  elements: ['el', 8, 140], density: ['den', 0, 100], complexity: ['cx', 0, 100],
  negativeSpace: ['neg', 0, 100], phiStrength: ['phi', 0, 100], recursion: ['rec', 1, 9],
  spiralInfluence: ['spi', 0, 100], goldenAngle: ['ga', 0, 100], nesting: ['nest', 0, 100],
  thickness: ['th', 1, 28], wobble: ['wob', 0, 100], overdraw: ['od', 1, 10],
  opacity: ['op', 10, 100], pressure: ['pr', 0, 100], dryness: ['dry', 0, 100],
  curveBias: ['curve', 0, 100], shapeAmount: ['shape', 0, 100],
  overlap: ['overlap', 0, 100], rotation: ['rot', 0, 100],
  colourCount: ['cols', 1, 14], saturation: ['sat', 10, 100], brightness: ['bri', 20, 80]
};
const switches = {
  lines: 'ln', circles: 'ci', rectangles: 're', polygons: 'po', arcs: 'ar'
};
const tools = new Set(['felt', 'fine', 'broad', 'highlighter', 'dry', 'paint', 'scribble']);
const colours = /^#[0-9a-f]{6}$/i;

function materialFrom(params) {
  const name = params.get('material') || '';
  if (/^oil(?:-v\d+)?$/.test(name)) return 'oil';
  if (/^watercolour(?:-v2[rs t])?$/.test(name) || name.startsWith('watercolour-')) return 'watercolour';
  if (/^action(?:-v\d+)?$/.test(name)) return 'action';
  if (name === 'tissue' || /^tissue-v\d+(?:-layered)?$/.test(name) ||
      params.has('tissue') || params.has('watercolor')) return 'tissue';
  if (name === 'marker') return 'marker';
  return null;
}

export function importLeadFromURL(params, lead, sheet, catalog) {
  // No parameters means a normal self-contained three-artist studio.
  if (!params.has('seed')) return false;
  const sharedSeed = params.get('seed')?.trim();
  if (!sharedSeed) return false;
  sheet.seed.value = sharedSeed.slice(0, 64);
  // Artist 1 uses the original composition's seed rather than an offset stream.
  lead.settings.seed = sheet.seed.value;
  const system = params.get('mode') || params.get('system');
  if (system && catalog.systems.some(candidate => candidate.id === system)) {
    lead.system = system;
  }
  const palette = params.get('pal') || params.get('palette');
  if (palette && Object.hasOwn(catalog.palettes, palette)) lead.palette = palette;
  const material = materialFrom(params);
  if (material && Object.hasOwn(catalog.materials, material)) lead.material = material;
  if (params.has('fmt')) sheet.orientation.value = params.get('fmt') === 'portrait' ? 'portrait' : 'landscape';
  if (params.has('paper') && colours.test(params.get('paper'))) sheet.paper.value = params.get('paper');
  if (params.has('grain')) {
    const grain = Number(params.get('grain'));
    if (Number.isFinite(grain)) sheet.grain.value = Math.min(100, Math.max(0, grain));
  }
  for (const [key, [param, min, max]] of Object.entries(numeric)) {
    if (!params.has(param)) continue;
    const value = Number(params.get(param));
    if (Number.isFinite(value)) lead.settings[key] = Math.min(max, Math.max(min, value));
  }
  for (const [key, param] of Object.entries(switches)) {
    if (params.has(param)) lead.settings[key] = ['1', 'true'].includes(params.get(param));
  }
  if (params.has('pen') && tools.has(params.get('pen'))) lead.settings.pen = params.get('pen');
  // An explicit Fit to φ switch takes precedence over the legacy sheet
  // parameter. Solo editor links can contain sheet=phi&fit=0: those drawings
  // must NOT be reframed when handed to Confluence.
  if (params.has('fit')) lead.settings.fit = ['1', 'true'].includes(params.get('fit'));
  else if (params.get('sheet') === 'phi') lead.settings.fit = true;
  return true;
}
