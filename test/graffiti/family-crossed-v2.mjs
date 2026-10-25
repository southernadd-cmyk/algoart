import {parseFamily} from './families/parse.mjs';

/**
 * Crossed-marker grammar, second full authoring pass.
 * Research anchor: Bombing Science complete alphabet sheets #7 and #9
 * (the user-supplied page export), with #22 and #42 as secondary references.
 *
 * Construction observations from those sheets:
 * - A: displaced centre axis and strongly crossing diagonal arms
 * - B/R/P: broad orbital upper bowl, oblique downstroke through the counter
 * - E/S/Z: backwards slash reversals instead of typeface-like shelves
 * - G/O/Q: near-round open enclosure cut by an aggressive horizontal bar
 * - H/K/X: sparse pointed diagonals using a common crossover zone
 * - M/N/U/V/W/Y: sharp hooked rising tails with detached rebound strokes
 * These paths are individually authored ORIGINAL studies, not tracings.
 */
export const crossedMarkerV2=parseFamily({
 id:'B',name:'Arrow-cross handstyle',primary:7,anchors:[7,9,22,42],
 technique:'fatmarker',ink:'#242724',weight:12.5,spacing:94,overlap:2,italic:-.045,
 notes:[
  'Heavy marker flicks and arrow-shaped reversals replace conventional font bowls',
  'Broad angular loops and transverse slashes are the defining letter anatomy',
  'Refined from the A–Z on reference sheets 7 and 9; no traced outlines'
 ],
 rows:String.raw`
A|$M 2 106 Q 13 62 47 3 L 80 103|M -8 72 L 67 35 L 91 61|M 6 37 Q 26 8 43 14 L 67 59|^M 41 -9 L 62 17
B|$M 9 -10 Q 35 23 15 56 L 11 110|M 10 16 C 53 -16 99 12 76 34 C 52 57 27 49 23 37|M 18 58 C 44 30 93 62 79 88 Q 62 116 5 97|M -5 59 L 56 57 L 87 79
C|$M 80 16 Q 32 -15 10 36 Q -2 53 49 61|M 48 61 L 13 86 L 30 112 L 89 100|M -2 77 L 44 56 L 72 76|^M 54 6 L 79 24
D|$M 18 114 L 19 -2|M 20 24 C 72 -22 109 26 82 74 Q 63 109 17 94|M 22 49 L 63 30 L 88 48|M 57 18 Q 35 42 63 82
E|$M 86 9 L 44 -5 L 11 29 L 67 37|M 9 30 L 43 56 L 75 41|M -5 63 L 61 62 L 87 89|$M 14 82 L 21 108 L 82 101|^M 42 11 L 79 20
F|$M 77 6 C 42 -13 16 12 27 34 Q 44 51 81 38|M 27 29 L 13 114|M -7 67 L 72 47 L 89 64|^M 7 102 L 38 116
G|$M 87 15 C 56 -13 14 6 11 31 L 8 85 L 41 110 L 82 93 L 91 54|M 38 53 L 98 46 L 76 64 L 57 60|M 0 78 L 71 78|^M 40 8 L 67 34
H|$M 8 -9 Q 35 40 6 112|M 80 -6 Q 60 56 90 115|M -5 53 L 95 46 L 75 31|$M 26 5 L 58 85|^M 57 64 L 86 96
I|$M 19 36 L 48 -7 L 77 33|M 45 7 L 39 107|M 5 102 L 73 97 L 96 116|^M 20 107 L 35 120
J|$M 2 13 C 31 -2 65 -12 88 10 Q 61 30 43 23|M 51 10 Q 83 62 47 83 L 10 101 L 54 116|M 3 52 L 64 50|^M 29 75 L 55 88
K|$M 11 -5 L 21 116|M 88 -4 L 27 67 L 93 107|M -9 56 L 83 45 L 71 19|M 40 13 Q 54 43 74 70|^M 4 109 L 23 122
L|$M 28 -9 L 8 60 L 20 97 L 92 105|M 10 61 L 44 40 L 80 79|M 7 94 L 61 84 L 103 107|^M 45 99 L 60 115
M|$M -4 116 L 20 2 L 46 66 L 68 -7 L 101 118|M -3 36 L 42 93 L 77 14|M 49 13 L 82 61 L 106 49|^M 8 92 L 22 121
N|$M 7 115 L 23 -5 L 86 114|M 13 26 L 61 84 L 78 -12|M -6 52 L 45 44 L 104 81|^M 64 15 L 84 37
O|$M 36 2 C 80 -16 100 24 91 64 C 85 111 27 124 8 81 Q -12 34 36 2|M -8 59 L 102 51 L 89 38|M 21 36 L 53 24 L 81 36|^M 28 69 L 62 68
P|$M 12 113 L 20 -9|M 16 16 C 61 -22 106 6 94 43 Q 79 75 35 61|M 34 19 L 56 63 L 80 99|M -6 60 L 58 55 L 90 66
Q|$M 34 5 C 77 -15 101 22 89 72 C 75 120 25 120 9 81 C -10 38 8 13 34 5|M -7 54 L 82 50 L 105 70|M 42 38 Q 56 72 98 112|^M 29 82 L 52 103
R|$M 15 116 L 22 -8|M 15 14 C 63 -20 107 18 84 45 C 69 63 27 57 16 43|M 23 31 L 62 60 L 92 111|M -8 58 L 78 49 L 96 72|^M 56 10 L 78 23
S|$M 80 10 Q 39 -19 11 23 L 42 54 L 84 48|M 17 50 L 72 82 L 51 109 L 3 90|M -9 72 L 93 57 L 78 44|^M 5 102 L 36 118
T|$M -13 33 C 31 -9 80 -3 102 21 Q 107 41 84 35|M 48 10 L 42 117 L 63 104|M 18 17 L 65 67 L 86 52|^M 71 94 L 89 114
U|$M 7 1 Q 0 48 19 105 L 51 115 L 79 83 L 75 -7|M -7 63 L 29 65 L 43 88|M 76 28 L 99 42 L 85 65|^M 46 90 L 69 96
V|$M -7 11 L 34 115 L 91 -7|M -12 72 L 42 92 L 60 70|M 66 14 L 99 19 L 84 42|^M 22 108 L 39 120
W|$M -8 3 L 14 113 L 41 51 L 59 112 L 95 -6|M -9 65 L 28 90 L 49 28 L 72 81|M 80 7 L 113 20 L 97 49
X|$M -6 1 L 92 115|M 87 -5 L 1 116|M -14 71 L 99 43 L 75 25|M 25 26 L 58 79
Y|$M -7 5 L 34 70 L 83 -7|M -13 69 L 45 60 L 80 93|M 45 52 Q 39 100 14 124 L 47 109|^M 76 3 L 100 25
Z|$M -5 15 L 93 5 L 73 31 L 10 91 L 91 101|M -9 55 L 82 42 L 103 59|M 16 74 Q 29 111 72 111 L 97 89|^M 22 4 L 47 20
`
});
