export const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://southernadd-cmyk.github.io/algoart/';
export const LOCAL_URL = process.env.ALGOART_LOCAL_URL || 'http://127.0.0.1:4173/';
export const TIME_ZONE = 'Europe/London';

export const ACCOUNTS = {
  instagram: '@artalgorithm',
  threads: '@artalgorithm'
};

export const DAILY_COUNT = 10;

export const SCHEDULE = {
  instagram: ['09:00', '15:00', '20:30'],
  threads: ['08:15', '11:30', '14:30', '18:00', '21:00']
};

export const PLATFORM_SLOTS = {
  instagram: [0, 4, 8],
  threads: [1, 3, 5, 7, 9]
};

export const MODES = [
  ['field', 'Orbital Studies'],
  ['spiral', 'Golden Trajectories'],
  ['rects', 'Recursive Divisions'],
  ['burst', 'Radiant Systems'],
  ['network', 'Connected Fields'],
  ['organic', 'Growth Systems'],
  ['geometric', 'Constructed Forms'],
  ['scribble', 'Automatic Marks']
];

export const PALETTES = ['spectrum', 'golden', 'marker', 'cmyk', 'primary', 'neon', 'pastel', 'earth', 'warm', 'cold', 'mono'];
export const PENS = ['felt', 'fine', 'broad', 'dry', 'paint', 'scribble'];
