export const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://southernadd-cmyk.github.io/algoart/';
export const LOCAL_URL = process.env.ALGOART_LOCAL_URL || 'http://127.0.0.1:4173/';
export const TIME_ZONE = 'Europe/London';

export const ACCOUNTS = {
  instagram: '@artalgorithm',
  threads: '@artalgorithm',
  bluesky: '@artalgorithm.bsky.social'
};

export const DAILY_COUNT = 5;

export const SCHEDULE = {
  instagram: ['09:00', '15:00', '20:30', '12:00'],
  threads: ['09:00', '15:00', '20:30', '12:00']
};

export const PLATFORM_SLOTS = {
  instagram: [0, 2, 4, 1],
  threads: [0, 2, 4, 1]
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
