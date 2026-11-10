// Pixel art for Neon Defense.
// Every sprite is a grid of characters; each character maps to a palette colour.
// '.' is transparent. Sprites are pre-rendered to small canvases once at start-up.

const PALETTE = {
  c: '#29f6ff', // neon cyan
  C: '#0e8fa8', // dark cyan
  m: '#ff3ef2', // neon magenta
  M: '#8a1a8f', // dark magenta
  w: '#ffffff', // white
  y: '#ffe14d', // yellow
  o: '#ff9f1c', // orange
  r: '#ff4d6d', // neon red
  R: '#8f1f3a', // dark red
  G: '#39ff88', // virus green
  D: '#127a46', // dark green
  g: '#6b5b95', // steel purple
  k: '#1a1033', // near black
};

const SPRITE_DATA = {
  // --- Tower heads (barrels point right, rotated in game) -----------------
  laserHead: [
    '..cccc......',
    '.cCCCCc.....',
    'cCwwwwCcccc.',
    'cCwmmwCwwwwc',
    'cCwmmwCwwwwc',
    'cCwwwwCcccc.',
    '.cCCCCc.....',
    '..cccc......',
  ],
  cannonHead: [
    '..yyyy......',
    '.yooooyyyy..',
    'yooyyooooooy',
    'yoykkyoykkky',
    'yoykkyoykkky',
    'yooyyooooooy',
    '.yooooyyyy..',
    '..yyyy......',
  ],
  empHead: [
    '...mmmm...',
    '..mMMMMm..',
    '.mMmwwmMm.',
    'mMmwmmwmMm',
    'mMwmwwmwMm',
    'mMwmwwmwMm',
    'mMmwmmwmMm',
    '.mMmwwmMm.',
    '..mMMMMm..',
    '...mmmm...',
  ],

  // --- Viruses ------------------------------------------------------------
  bug1: [
    '..G....G..',
    '...G..G...',
    '..GGGGGG..',
    '.GGwGGwGG.',
    '.GGkGGkGG.',
    'GGGGGGGGGG',
    '.GDGGGGDG.',
    '.GGGDDGGG.',
    'G.G....G.G',
    '.G......G.',
  ],
  bug2: [
    '..G....G..',
    '..G....G..',
    '..GGGGGG..',
    '.GGwGGwGG.',
    '.GGkGGkGG.',
    'GGGGGGGGGG',
    '.GDGGGGDG.',
    '.GGGDDGGG.',
    '.G.G..G.G.',
    '..G....G..',
  ],
  worm1: [
    '....oooo..',
    'oo.oyyyyo.',
    'oyooywkyoo',
    'oyooyyyyoo',
    'oo.oyyyyo.',
    '....oooo..',
  ],
  worm2: [
    '....oooo..',
    '.oooyyyyo.',
    'oyyoywkyoo',
    'oyyoyyyyoo',
    '.oooyyyyo.',
    '....oooo..',
  ],
  trojan1: [
    '..rrrrrrrr..',
    '.rggggggggr.',
    'rgrrrrrrrrgr',
    'rgrwwrrwwrgr',
    'rgrwkrrwkrgr',
    'rgrrrrrrrrgr',
    'rggggggggggr',
    'rgRrRrRrRrgr',
    'rggggggggggr',
    '.rrrrrrrrrr.',
    '.r..r..r..r.',
  ],
  trojan2: [
    '..rrrrrrrr..',
    '.rggggggggr.',
    'rgrrrrrrrrgr',
    'rgrwwrrwwrgr',
    'rgrwkrrwkrgr',
    'rgrrrrrrrrgr',
    'rggggggggggr',
    'rgrRrRrRrRgr',
    'rggggggggggr',
    '.rrrrrrrrrr.',
    '..r..r..r..r',
  ],
  boss1: [
    '....mmmmmmmm....',
    '..mmMMMMMMMMmm..',
    '.mMMMMMMMMMMMMm.',
    'mMMwwwMMMMwwwMMm',
    'mMMwrwMMMMwrwMMm',
    'mMMwwwMMMMwwwMMm',
    'mMMMMMMmmMMMMMMm',
    '.mMMMMmmmmMMMMm.',
    '..mMMMMMMMMMMm..',
    '..mMwMwMwMwMMm..',
    '...mMMMMMMMMm...',
    '....mmmmmmmm....',
    '..m..m....m..m..',
    '.m...m....m...m.',
  ],
  boss2: [
    '....mmmmmmmm....',
    '..mmMMMMMMMMmm..',
    '.mMMMMMMMMMMMMm.',
    'mMMwwwMMMMwwwMMm',
    'mMMwwrMMMMwwrMMm',
    'mMMwwwMMMMwwwMMm',
    'mMMMMMMmmMMMMMMm',
    '.mMMMMmmmmMMMMm.',
    '..mMMMMMMMMMMm..',
    '..mMMwMwMwMwMm..',
    '...mMMMMMMMMm...',
    '....mmmmmmmm....',
    '...m..m..m..m...',
    '..m...m..m...m..',
  ],

  // --- HUD icons ----------------------------------------------------------
  chip: [
    '.y.y.y.',
    'yyyyyyy',
    '.yoooy.',
    'yyowoyy',
    '.yoooy.',
    'yyyyyyy',
    '.y.y.y.',
  ],
  heart: [
    '.cc.cc.',
    'cwccccc',
    'ccccccc',
    'ccccccc',
    '.ccccc.',
    '..ccc..',
    '...c...',
  ],
};

// Tower base plate; X = bright edge, x = dark edge.
const BASE_ROWS = [
  '..xxxxxxxxxxxx..',
  '.xXXkkkkkkkkXXx.',
  'xXkkkkkkkkkkkkXx',
  'xXkkkkkkkkkkkkXx',
  'xkkkkkkkkkkkkkkx',
  'xkkkkkkkkkkkkkkx',
  'xkkkkkkkkkkkkkkx',
  'xkkkkkkkkkkkkkkx',
  'xkkkkkkkkkkkkkkx',
  'xkkkkkkkkkkkkkkx',
  'xkkkkkkkkkkkkkkx',
  'xkkkkkkkkkkkkkkx',
  'xXkkkkkkkkkkkkXx',
  'xXkkkkkkkkkkkkXx',
  '.xXXkkkkkkkkXXx.',
  '..xxxxxxxxxxxx..',
];

function renderSprite(rows, extra = {}) {
  const pal = { ...PALETTE, ...extra };
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = pal[row[x]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return cv;
}

// Server core the player defends (16x16), with two light states for blinking.
function buildCore(lit) {
  const cv = document.createElement('canvas');
  cv.width = 16; cv.height = 16;
  const c = cv.getContext('2d');
  c.fillStyle = '#29f6ff'; c.fillRect(1, 0, 14, 16);
  c.fillStyle = '#12062a'; c.fillRect(2, 1, 12, 14);
  for (let i = 0; i < 4; i++) {
    const y = 2 + i * 3;
    c.fillStyle = '#0e8fa8'; c.fillRect(3, y, 10, 2);
    c.fillStyle = (lit + i) % 2 ? '#39ff88' : '#1d4a3a'; c.fillRect(4, y, 1, 1);
    c.fillStyle = (lit + i) % 3 ? '#ff3ef2' : '#5a1a5a'; c.fillRect(6, y, 1, 1);
    c.fillStyle = '#29f6ff'; c.fillRect(9, y + 1, 3, 1);
  }
  return cv;
}

const SPRITES = {};
for (const [name, rows] of Object.entries(SPRITE_DATA)) {
  SPRITES[name] = renderSprite(rows);
}
SPRITES.baseLaser = renderSprite(BASE_ROWS, { X: '#29f6ff', x: '#0e8fa8' });
SPRITES.baseEmp = renderSprite(BASE_ROWS, { X: '#ff3ef2', x: '#8a1a8f' });
SPRITES.baseCannon = renderSprite(BASE_ROWS, { X: '#ffe14d', x: '#a86a12' });
SPRITES.core = [buildCore(0), buildCore(1)];
