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

console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed === 0 ? 0 : 1);
