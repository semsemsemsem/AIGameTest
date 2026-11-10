// Pixel art for Neon Dash.
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
  g: '#6b5b95', // steel purple
  k: '#1a1033', // near black
};

const SPRITE_DATA = {
  // --- Player: a little neon runner bot -----------------------------------
  run1: [
    '...cccccc...',
    '..cwwwwwwc..',
    '..cmmmmmmc..',
    '..cwwwwwwc..',
    '...cccccc...',
    '....CccC....',
    '..ccCccCcc..',
    '.c..cccc..c.',
    '....cmmc....',
    '....cccc....',
    '...cc..cc...',
    '..cc....cc..',
    '.cc......cc.',
    '............',
  ],
  run2: [
    '...cccccc...',
    '..cwwwwwwc..',
    '..cmmmmmmc..',
    '..cwwwwwwc..',
    '...cccccc...',
    '....CccC....',
    '...cCccCc...',
    '...ccccc.c..',
    '....cmmc....',
    '....cccc....',
    '....c..c....',
    '...cc..cc...',
    '...c....c...',
    '............',
  ],
  run3: [
    '...cccccc...',
    '..cwwwwwwc..',
    '..cmmmmmmc..',
    '..cwwwwwwc..',
    '...cccccc...',
    '....CccC....',
    '..ccCccCc...',
    '.c..cccc.c..',
    '....cmmc....',
    '....cccc....',
    '....cc.c....',
    '....c..cc...',
    '...cc...c...',
    '............',
  ],
  jump: [
    '...cccccc...',
    '..cwwwwwwc..',
    '..cmmmmmmc..',
    '.ccwwwwwwcc.',
    'c..cccccc..c',
    '....CccC....',
    '...cCccCc...',
    '....cccc....',
    '....cmmc....',
    '....cccc....',
    '...cc..cc...',
    '..cc....cc..',
    '..c......c..',
    '............',
  ],
  duck1: [
    '......cccccc..',
    '.....cwwwwwwc.',
    '.....cmmmmmmc.',
    '..cccccccccc..',
    '.ccCccccCccc..',
    'cc..cmmc....c.',
    '....cccc......',
    '...cc..cc.....',
    '..cc....cc....',
  ],
  duck2: [
    '......cccccc..',
    '.....cwwwwwwc.',
    '.....cmmmmmmc.',
    '..cccccccccc..',
    '.ccCccccCccc..',
    'cc..cmmc....c.',
    '....cccc......',
    '....c.cc......',
    '...cc..c......',
  ],
  dead: [
    '...rrrrrr...',
    '..rwwwwwwr..',
    '..rw.ww.wr..',
    '..rwwwwwwr..',
    '...rrrrrr...',
    '....rrrr....',
    '..rrrrrrrr..',
    '.r..rrrr..r.',
    '....rwwr....',
    '....rrrr....',
    '...rr..rr...',
    '..rr....rr..',
    '.rr......rr.',
    '............',
  ],

  // --- Obstacles ----------------------------------------------------------
  // Firewall pieces: a cap, a repeatable body row pair and a base.
  wallCap: [
    '...mm...',
    '..mwwm..',
    '..mwwm..',
    '.mmmmmm.',
  ],
  wallBody: [
    '.mkmmkm.',
    '.mmmmmm.',
  ],
  wallBase: [
    'mmmmmmmm',
    'MMMMMMMM',
  ],
  drone1: [
    'rr..........rr',
    '.rrrr....rrrr.',
    '....gggggg....',
    '...gwwwwwwg...',
    '..gwryyyyrwg..',
    '...gwwwwwwg...',
    '....gggggg....',
    '.....r..r.....',
  ],
  drone2: [
    '..............',
    'rrrrr....rrrrr',
    '....gggggg....',
    '...gwwwwwwg...',
    '..gwyrrrrywg..',
    '...gwwwwwwg...',
    '....gggggg....',
    '......rr......',
  ],

  // --- Pickups ------------------------------------------------------------
  chip: [
    '.y.y.y.',
    'yyyyyyy',
    '.yoooy.',
    'yyowoyy',
    '.yoooy.',
    'yyyyyyy',
    '.y.y.y.',
  ],
};

function renderSprite(rows) {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = PALETTE[row[x]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return cv;
}

// Builds a firewall sprite with `segments` body sections.
function buildWall(segments) {
  const rows = [...SPRITE_DATA.wallCap];
  for (let i = 0; i < segments; i++) rows.push(...SPRITE_DATA.wallBody);
  rows.push(...SPRITE_DATA.wallBase);
  return renderSprite(rows);
}

const SPRITES = {};
for (const [name, rows] of Object.entries(SPRITE_DATA)) {
  SPRITES[name] = renderSprite(rows);
}
SPRITES.walls = [1, 2, 3, 4].map(buildWall);
