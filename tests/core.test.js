// 零依赖核心逻辑测试：从 index.html 提取 CORE 段并在 Node 中执行
'use strict';
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/\/\* CORE-START \*\/([\s\S]*?)\/\* CORE-END \*\//);
if (!m) {
  console.error('✗ 未在 index.html 中找到 CORE-START / CORE-END 标记段');
  process.exit(1);
}
const NAMES = ['createBoard', 'slideLine', 'move', 'planMove', 'spawnTile', 'applyMove', 'canMove', 'isWin', 'isOver', 'tileColor'];
const core = new Function(
  m[1] +
  '\n;return {' +
  NAMES.map(n => JSON.stringify(n) + ': typeof ' + n + ' !== "undefined" ? ' + n + ' : undefined').join(', ') +
  '};'
)();
const { createBoard, slideLine, move, planMove, spawnTile, applyMove, canMove, isWin, isOver, tileColor } = core;
const missing = NAMES.filter(n => typeof core[n] !== 'function');
if (missing.length) {
  console.warn('⚠ 以下核心函数尚未实现，相关用例将失败: ' + missing.join(', '));
}

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (err) {
    failed++;
    console.error('  ✗ ' + name + '\n    ' + (err && err.message));
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || '断言失败');
}
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error((msg || '值不相等') + '\n    期望: ' + e + '\n    实际: ' + a);
}

// ---------- 测试用例（各任务追加于此） ----------
test('createBoard: 4x4 全零', () => {
  eq(core.createBoard(4), [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]);
});
test('slideLine: 2+2 合并得 4 分', () => {
  eq(slideLine([2, 2, 0, 0]), { line: [4, 0, 0, 0], gained: 4 });
});
test('slideLine: 每格最多合并一次 [2,2,4]', () => {
  eq(slideLine([2, 2, 4, 0]), { line: [4, 4, 0, 0], gained: 4 });
});
test('slideLine: 靠 0 侧优先 [2,2,2,2]', () => {
  eq(slideLine([2, 2, 2, 2]), { line: [4, 4, 0, 0], gained: 8 });
});
test('slideLine: 先滑后并 [2,0,2]', () => {
  eq(slideLine([2, 0, 2, 0]), { line: [4, 0, 0, 0], gained: 4 });
});
test('slideLine: 无合并只滑动', () => {
  eq(slideLine([2, 4, 0, 0]), { line: [2, 4, 0, 0], gained: 0 });
});
test('slideLine: 空行不变', () => {
  eq(slideLine([0, 0, 0, 0]), { line: [0, 0, 0, 0], gained: 0 });
});
test('slideLine: 不修改入参数组', () => {
  const input = [2, 2, 4, 0];
  slideLine(input);
  eq(input, [2, 2, 4, 0]);
});
test('move: 左移整板（合并+滑动混合）', () => {
  const b = [[2,0,2,0],[0,0,0,0],[2,2,4,0],[0,0,0,0]];
  const r = move(b, 'left');
  eq(r.board, [[4,0,0,0],[0,0,0,0],[4,4,0,0],[0,0,0,0]]);
  eq(r.moved, true);
  eq(r.gained, 8);
});
test('move: 右移合并', () => {
  const b = [[2,0,2,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  const r = move(b, 'right');
  eq(r.board, [[0,0,0,4],[0,0,0,0],[0,0,0,0],[0,0,0,0]]);
  eq(r.gained, 4);
});
test('move: 上移合并', () => {
  const b = [[2,0,0,0],[2,0,0,0],[0,0,0,0],[0,0,0,0]];
  const r = move(b, 'up');
  eq(r.board, [[4,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]);
  eq(r.gained, 4);
});
test('move: 下移不合并仅滑动', () => {
  const b = [[2,0,0,0],[0,0,0,0],[0,0,0,0],[4,0,0,0]];
  const r = move(b, 'down');
  eq(r.board, [[0,0,0,0],[0,0,0,0],[2,0,0,0],[4,0,0,0]]);
  eq(r.gained, 0);
});
test('move: 贴墙移动 moved=false', () => {
  const b = [[2,0,0,0],[4,0,0,0],[0,0,0,0],[0,0,0,0]];
  eq(move(b, 'left').moved, false);
});
test('move: 5x5 左移合并', () => {
  const b = [[0,2,0,2,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0]];
  eq(move(b, 'left').board[0], [4,0,0,0,0]);
});
test('move: 不修改入参棋盘', () => {
  const b = [[2,0,2,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  move(b, 'left');
  eq(b, [[2,0,2,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]);
});
test('planMove: 左移 [2,0,2] 合并落点', () => {
  const p = planMove([[2,0,2,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], 'left');
  const find = (r, c) => p.find(x => x.from.r === r && x.from.c === c);
  eq(find(0,0), { from: { r:0, c:0 }, to: { r:0, c:0 }, merged: false });
  eq(find(0,2), { from: { r:0, c:2 }, to: { r:0, c:0 }, merged: true });
});
test('planMove: [2,2,4] 合并后 4 补位', () => {
  const p = planMove([[2,2,4,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], 'left');
  const find = (r, c) => p.find(x => x.from.r === r && x.from.c === c);
  eq(find(0,0), { from: { r:0, c:0 }, to: { r:0, c:0 }, merged: false });
  eq(find(0,1), { from: { r:0, c:1 }, to: { r:0, c:0 }, merged: true });
  eq(find(0,2), { from: { r:0, c:2 }, to: { r:0, c:1 }, merged: false });
});
test('planMove: 下移合并，靠边者为 keeper', () => {
  const p = planMove([[2,0,0,0],[2,0,0,0],[0,0,0,0],[0,0,0,0]], 'down');
  const find = (r, c) => p.find(x => x.from.r === r && x.from.c === c);
  eq(find(1,0), { from: { r:1, c:0 }, to: { r:3, c:0 }, merged: false });
  eq(find(0,0), { from: { r:0, c:0 }, to: { r:3, c:0 }, merged: true });
});
test('planMove: 右移不合并仅滑动', () => {
  const p = planMove([[2,4,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], 'right');
  const find = (r, c) => p.find(x => x.from.r === r && x.from.c === c);
  eq(find(0,0), { from: { r:0, c:0 }, to: { r:0, c:2 }, merged: false });
  eq(find(0,1), { from: { r:0, c:1 }, to: { r:0, c:3 }, merged: false });
});
test('spawnTile: 只落空白格，rng=0 落第一个空格值为 2', () => {
  const b = [[2,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  const r = spawnTile(b, () => 0);
  eq(r.tile, { row: 0, col: 1, value: 2 });
  eq(r.board[0][1], 2);
  eq(r.board[0][0], 2);
});
test('spawnTile: rng>=0.9 生成 4', () => {
  const r = spawnTile(createBoard(4), () => 0.95);
  eq(r.tile.value, 4);
});
test('spawnTile: 不修改原棋盘', () => {
  const b = createBoard(4);
  spawnTile(b, () => 0.5);
  eq(b, createBoard(4));
});
test('spawnTile: 满棋盘返回 tile:null', () => {
  const b = [[2,4,2,4],[4,2,4,2],[2,4,2,4],[4,2,4,2]];
  const r = spawnTile(b, () => 0.5);
  eq(r.tile, null);
});
test('spawnTile: 2/4 比例约 9:1（1000 次统计）', () => {
  let twos = 0, fours = 0;
  for (let i = 0; i < 1000; i++) {
    const r = spawnTile(createBoard(4), Math.random);
    if (r.tile.value === 2) twos++; else fours++;
  }
  assert(twos > 850 && twos < 950, '2 出现 ' + twos + ' 次，应在 850~950');
  assert(fours > 50 && fours < 150, '4 出现 ' + fours + ' 次，应在 50~150');
});
test('applyMove: 有效移动 → 计分 + 生成新块', () => {
  const s = { board: [[2,0,0,0],[2,0,0,0],[0,0,0,0],[0,0,0,0]], score: 0 };
  const r = applyMove(s, 'up', () => 0);
  eq(r.moved, true);
  eq(r.gained, 4);
  eq(r.score, 4);
  eq(r.board[0][0], 4);
  eq(r.tile, { row: 0, col: 1, value: 2 });
});
test('applyMove: 无效移动 → 不生成不计分', () => {
  const s = { board: [[2,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], score: 10 };
  const r = applyMove(s, 'left', () => 0);
  eq(r.moved, false);
  eq(r.score, 10);
  eq(r.tile, null);
  eq(r.board, s.board);
});

console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed === 0 ? 0 : 1);
