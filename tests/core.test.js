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

console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed === 0 ? 0 : 1);
