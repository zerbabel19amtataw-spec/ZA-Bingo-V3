// Standard 75-ball bingo: 5x5 grid, columns B-I-N-G-O, center is free.
const COLUMN_RANGES = [
  [1, 15],   // B
  [16, 30],  // I
  [31, 45],  // N
  [46, 60],  // G
  [61, 75],  // O
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Generates one bingo cartela: 25 cells, row-major, center (index 12) is FREE. */
function generateCartela() {
  const grid = [];
  for (const [min, max] of COLUMN_RANGES) {
    const pool = [];
    for (let n = min; n <= max; n++) pool.push(n);
    grid.push(shuffle(pool).slice(0, 5));
  }
  const cells = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      cells.push(row === 2 && col === 2 ? 'FREE' : grid[col][row]);
    }
  }
  return cells; // index = row * 5 + col
}

/**
 * Checks a cartela against called numbers for: any row, any column,
 * either diagonal, four corners, or full house. "One number left" is
 * NOT a win condition on its own — it's a UI hint (see isOneAway
 * below) that a player is close, matching the spec's "One Number Left"
 * indicator rather than a payable pattern.
 */
function checkWin(cells, calledNumbers) {
  const called = new Set(calledNumbers);
  const isMarked = (v) => v === 'FREE' || called.has(v);
  const at = (row, col) => cells[row * 5 + col];

  // Full house — check first since it implies everything else.
  if (cells.every(isMarked)) return { win: true, pattern: 'full_house' };

  // Four corners
  const corners = [at(0, 0), at(0, 4), at(4, 0), at(4, 4)];
  if (corners.every(isMarked)) return { win: true, pattern: 'four_corners' };

  for (let row = 0; row < 5; row++) {
    if ([0, 1, 2, 3, 4].every((col) => isMarked(at(row, col)))) {
      return { win: true, pattern: `row_${row}` };
    }
  }

  for (let col = 0; col < 5; col++) {
    if ([0, 1, 2, 3, 4].every((row) => isMarked(at(row, col)))) {
      return { win: true, pattern: `col_${col}` };
    }
  }

  if ([0, 1, 2, 3, 4].every((i) => isMarked(at(i, i)))) {
    return { win: true, pattern: 'diag_main' };
  }
  if ([0, 1, 2, 3, 4].every((i) => isMarked(at(i, 4 - i)))) {
    return { win: true, pattern: 'diag_anti' };
  }

  return { win: false };
}

/** UI hint only: true if any line is exactly one unmarked cell away. */
function isOneAway(cells, calledNumbers) {
  const called = new Set(calledNumbers);
  const isMarked = (v) => v === 'FREE' || called.has(v);
  const at = (row, col) => cells[row * 5 + col];

  const lines = [];
  for (let r = 0; r < 5; r++) lines.push([0, 1, 2, 3, 4].map((c) => at(r, c)));
  for (let c = 0; c < 5; c++) lines.push([0, 1, 2, 3, 4].map((r) => at(r, c)));
  lines.push([0, 1, 2, 3, 4].map((i) => at(i, i)));
  lines.push([0, 1, 2, 3, 4].map((i) => at(i, 4 - i)));

  return lines.some((line) => line.filter((v) => !isMarked(v)).length === 1);
}

module.exports = { generateCartela, checkWin, isOneAway };
