// Separately authored Greek phi signatures for all ten original A-Z families.
// These are NOT a transformed single generic circle-and-stem.
const RAW=Object.freeze({
 A:[
  '$M 48 -14 L 30 118',
  '$M 47 14 L 79 34 L 89 65 L 54 103 L 13 88 L 2 50 L 39 20',
  'M -7 66 L 94 46'
 ],
 B:[
  'M 53 -14 C 44 31 34 80 44 121',
  'M 35 18 C 91 -4 107 54 77 79 C 45 108 -5 95 3 48 C 7 29 28 22 46 34',
  'M -9 62 Q 44 47 98 59'
 ],
 C:[
  '!M 45 -13 L 67 -5 L 53 22 L 44 113 L 22 124 L 27 91 Z',
  '!M 48 15 L 83 22 L 99 58 L 78 96 L 45 104 L 7 86 L -3 49 L 23 21 Z M 43 35 L 20 49 L 22 72 L 45 82 L 65 71 L 72 48 L 55 36 Z'
 ],
 D:[
  'M 46 -13 L 46 123',
  'M 25 20 L 68 20 L 91 43 L 91 78 L 68 103 L 24 103 L 1 79 L 1 43 L 25 20',
  'M 28 36 L 63 36 L 75 46 L 75 75 L 61 87 L 27 87'
 ],
 E:[
  '!M 40 -14 L 56 -5 L 46 115 L 29 123 L 20 109 Z',
  '!M 43 14 L 67 8 L 84 23 L 80 86 L 58 111 L 32 99 L 13 108 L -2 79 L 5 26 L 29 8 Z M 27 33 L 23 78 L 37 88 L 57 80 L 61 35 L 44 25 Z',
  '^M 5 38 Q 33 14 69 30'
 ],
 F:[
  'M 54 -14 C 41 37 46 81 36 120',
  'M 47 18 C 84 -1 104 31 91 74 C 75 118 23 115 7 87 C -8 60 11 24 47 18',
  '^M 7 59 C 28 34 64 33 85 47',
  '^M 38 113 Q 48 125 64 116'
 ],
 G:[
  'M 51 -13 C 40 22 37 75 42 119',
  'M 32 17 C 91 -10 106 55 75 86 C 40 124 -6 97 7 48 C 12 30 30 25 53 30',
  'M 27 48 C 58 26 78 51 65 73 C 49 91 19 77 27 61',
  '^M 41 105 Q 62 118 89 94'
 ],
 H:[
  '!M 42 -16 L 62 -9 L 47 45 L 30 47 Z',
  '!M 29 60 L 48 54 L 38 117 L 20 125 Z',
  '!M 29 16 L 69 20 L 85 39 L 68 52 L 56 35 L 27 33 Z',
  '!M 79 57 L 96 63 L 74 96 L 46 106 L 48 89 L 65 82 Z',
  '!M 16 39 L 29 53 L 19 74 L 30 86 L 15 105 L -2 74 Z'
 ],
 I:[
  'M 48 -13 C 37 26 41 76 43 122',
  'M 49 12 L 71 26 L 76 69 L 57 100 L 24 90 L 11 49 L 35 22',
  'M 22 43 L 36 33',
  '^M 48 103 Q 62 120 82 106'
 ],
 J:[
  'M 55 -15 C 40 13 48 91 32 126',
  'M 45 16 C 80 -13 109 27 96 73 C 87 111 35 126 9 97 C -23 61 13 12 49 23',
  'M 9 49 C 29 20 64 23 78 40 Q 88 63 71 74',
  '^M 30 111 Q 52 135 86 102'
 ]
});
function read(path){
 const kind=path[0]==='!'?'fill':path[0]==='^'?'hairline':path[0]==='$'?'heavy':'stroke';
 const d=kind==='stroke'?path:path.slice(1);
 return Object.freeze({kind,d});
}
export const PHI_BY_FAMILY=Object.freeze(Object.fromEntries(
 Object.entries(RAW).map(([id,shapes])=>[id,Object.freeze({letter:'Φ',shapes:Object.freeze(shapes.map(read))})])));
if(Object.keys(PHI_BY_FAMILY).join('')!=='ABCDEFGHIJ')throw new Error('Missing phi study');
