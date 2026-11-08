const pens = [
  ['felt', 'Felt Tip'], ['fine', 'Fine Marker'], ['broad', 'Broad Marker'],
  ['highlighter', 'Highlighter'], ['dry', 'Dry Marker'], ['paint', 'Paint Pen'], ['scribble', 'Scribble Pen']
];

function slider(key, label, value, min = 0, max = 100, step = 1) {
  return {key, label, value, min, max, step, type: 'range'};
}

function check(key, label, value = true) {
  return {key, label, value, type: 'checkbox'};
}

const categories = [
  ['Compose', [
    slider('elements', 'Elements', 42, 8, 140),
    slider('density', 'Scale', 44),
    slider('complexity', 'Bend', 56),
    slider('negativeSpace', 'Negative space', 47),
    {key: 'seed', label: 'Artist seed', value: '', type: 'text'}
  ]],
  ['φ', [
    slider('phiStrength', 'Additional φ pull', 76, 0, 100, .1),
    slider('recursion', 'Recursion', 4, 1, 9),
    slider('spiralInfluence', 'Spiral influence', 71),
    slider('goldenAngle', 'Golden angle', 84),
    slider('nesting', 'Nesting', 32),
    check('fit', 'Fit this artist to φ', false)
  ]],
  ['Marks', [
    {key: 'pen', label: 'Mark-making tool', value: 'felt', type: 'select', options: pens},
    slider('thickness', 'Stroke width', 10, 1, 28),
    slider('wobble', 'Wobble', 21),
    slider('overdraw', 'Repeat passes', 2, 1, 10),
    slider('opacity', 'Opacity', 77, 10, 100),
    slider('pressure', 'Stroke pressure', 39),
    slider('dryness', 'Dry texture', 10)
  ]],
  ['Shape', [
    slider('curveBias', 'Curved ↔ straight', 49),
    slider('shapeAmount', 'Shape amount', 63),
    slider('overlap', 'Overlap', 56),
    slider('rotation', 'Rotation', 82),
    check('lines', 'Lines'), check('circles', 'Ellipses'), check('rectangles', 'Rectangles'),
    check('polygons', 'Polygons'), check('arcs', 'Arcs')
  ]],
  ['Colour', [
    slider('colourCount', 'Colours', 6, 1, 14),
    slider('saturation', 'Saturation', 68, 10, 100),
    slider('brightness', 'Brightness', 45, 20, 80)
  ]]
];

export function defaultSettings(system) {
  return {...Object.fromEntries(categories.flatMap(([, specs]) => specs.map(({key, value}) => [key, value]))),
    pen: system.pen, thickness: system.width};
}

function field(spec, artist) {
  const {key, type} = spec;
  const value = artist.settings[key];
  const label = document.createElement('label');
  label.className = 'inspector-' + type;
  const caption = document.createElement('span');
  caption.textContent = spec.label;
  const input = document.createElement(type === 'select' ? 'select' : 'input');
  input.dataset.setting = key;
  if (type !== 'select') input.type = type;
  if (type === 'range') {
    input.min = spec.min;
    input.max = spec.max;
    input.step = spec.step;
    const output = document.createElement('output');
    output.value = value;
    label.append(caption, output, input);
  } else if (type === 'checkbox') {
    input.checked = value;
    label.append(input, caption);
  } else {
    if (type === 'select') {
      for (const [option, name] of spec.options) input.add(new Option(name, option));
    } else {
      input.placeholder = 'From shared seed';
      input.maxLength = 64;
      input.autocomplete = 'off';
      input.spellcheck = false;
    }
    label.append(caption, input);
  }
  if (type !== 'checkbox') input.value = value;
  return label;
}

export function artistInspector(artist) {
  const details = document.createElement('details');
  details.className = 'artist-inspector';
  details.name = 'artist-controls';
  const summary = document.createElement('summary');
  summary.textContent = 'Drawing controls';
  const navigation = document.createElement('div');
  navigation.className = 'segmented inspector-tabs';
  navigation.setAttribute('role', 'group');
  navigation.setAttribute('aria-label', 'Drawing control groups');
  const panels = categories.map(([name, specs], index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = name;
    button.dataset.category = index;
    button.setAttribute('aria-pressed', index === 0);
    navigation.append(button);
    const panel = document.createElement('fieldset');
    panel.hidden = index !== 0;
    const legend = document.createElement('legend');
    legend.className = 'sr-only';
    legend.textContent = name;
    panel.append(legend, ...specs.map(spec => field(spec, artist)));
    return panel;
  });
  navigation.addEventListener('click', event => {
    const selected = event.target.closest('button[data-category]');
    if (!selected) return;
    for (const [index, button] of [...navigation.children].entries()) {
      button.setAttribute('aria-pressed', button === selected);
      panels[index].hidden = button !== selected;
    }
  });
  details.append(summary, navigation, ...panels);
  return details;
}
