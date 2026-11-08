// Golden-ratio distributed default combinations for Confluence.
// A seed + optional visit variant determines a reproducible, low-discrepancy roster.
// Existing solo-editor lead and bookmarked three-artist states remain untouched.
const INVERSE_PHI = (Math.sqrt(5) - 1) / 2;
const fraction = number => number - Math.floor(number);

function hash(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export function makeGoldenRoster(seed, {systems, materials, palettes, defaultSettings, lead = null}) {
  const phase = name => hash(String(seed) + '|' + name) / 4294967296;
  const chooseDistinct = (items, count, name, excluded = []) => {
    const selected = [];
    const used = new Set(excluded);
    const start = phase(name);
    // Advance by 1/φ around the unit interval, not by adjacent array items.
    // Repeated hits are skipped so all three artists genuinely differ.
    for (let k = 0; selected.length < count && k < items.length * 32; k++) {
      const item = items[Math.floor(fraction(start + k * INVERSE_PHI) * items.length)];
      if (!used.has(item)) { used.add(item); selected.push(item); }
    }
    // Defensive completion for any unusually small future catalog.
    for (const item of items) {
      if (selected.length >= count) break;
      if (!used.has(item)) { used.add(item); selected.push(item); }
    }
    return selected;
  };

  const systemNames = chooseDistinct(systems.map(s => s.id), lead ? 2 : 3,
    'systems', lead ? [lead.system] : []);
  const materialNames = chooseDistinct(materials, lead ? 2 : 3,
    'materials', lead ? [lead.material] : []);
  // Colourful starters; monochrome is still available manually and preserved
  // exactly when imported from the main editor or restored from a shared link.
  const colourPalettes = palettes.filter(p => p !== 'mono');
  const paletteNames = chooseDistinct(colourPalettes, lead ? 2 : 3,
    'palettes', lead ? [lead.palette] : []);

  return [0, 1, 2].map(index => {
    if (index === 0 && lead) return lead;
    const slot = lead ? index - 1 : index;
    const system = systemNames[slot];
    const spec = systems.find(item => item.id === system);
    const setting = (key, min, max) =>
      Math.round(min + phase('artist-' + index + '-' + key) * (max - min));
    return {
      id: index + 1,
      system,
      material: materialNames[slot],
      palette: paletteNames[slot],
      settings: {
        ...defaultSettings(spec),
        elements: setting('elements', 28, 60),
        density: setting('density', 36, 65),
        complexity: setting('complexity', 42, 76),
        negativeSpace: setting('negativeSpace', 36, 60),
        phiStrength: setting('phiStrength', 65, 95),
        goldenAngle: setting('goldenAngle', 67, 100),
        wobble: setting('wobble', 15, 47),
        colourCount: setting('colourCount', 5, 10),
        saturation: setting('saturation', 62, 87),
        brightness: setting('brightness', 40, 63)
      }
    };
  });
}
