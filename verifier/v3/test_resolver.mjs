/* verifier/v3/test_resolver.mjs
 * Node 环境单元测试：SourceUrlResolver.split + expand + candidates
 * 运行：node verifier/v3/test_resolver.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const SourceUrlResolver = require('../../js/source-url-resolver.js');

let failed = 0;
function assert(cond, label) {
  if (cond) { console.log('PASS', label); }
  else { failed++; console.log('FAIL', label); }
}

const input = 'https://www.yckceo.com/yuedu/rsshttps://www.spmxxqq.com:2087/1035.htmls/json/id/193.json';

// 1) split：连写串应在 https:// 边界切开为 2 个 URL
const urls = SourceUrlResolver.split(input);
console.log('split 输出:', urls);
assert(urls.length === 2, 'split 连写串输出 2 个 URL');
assert(urls[0] === 'https://www.yckceo.com/yuedu/rss', 'split[0] 为 yckceo RSS 页');
assert(urls[1] === 'https://www.spmxxqq.com:2087/1035.htmls/json/id/193.json', 'split[1] 为粘连串');

// 2) expand：yckceo 页 + 全串 context → 生成两个 JSON 候选
const exp = SourceUrlResolver.expand(urls[0], input);
console.log('expand(yckceo) 输出:', exp);
assert(exp.includes('https://www.yckceo.com/yuedu/shuyuan/json/id/193.json'), 'expand 含 shuyuan JSON 候选');
assert(exp.includes('https://www.yckceo.com/yuedu/rss/json/id/193.json'), 'expand 含 rss JSON 候选');

// 3) expand：.html 后粘连 s/json → 截断为页面 URL
const exp2 = SourceUrlResolver.expand(urls[1], input);
assert(exp2.includes('https://www.spmxxqq.com:2087/1035.html'), 'expand 截断 .html 页面 URL');

// 4) candidates：整串汇总候选必须包含两个 yckceo JSON
const cands = SourceUrlResolver.candidates(input);
console.log('candidates 输出:', cands);
assert(cands.length <= 8, '候选数 ≤ 8');
assert(cands.includes('https://www.yckceo.com/yuedu/shuyuan/json/id/193.json'), 'candidates 含 shuyuan JSON（验收门禁）');
assert(cands.includes('https://www.yckceo.com/yuedu/rss/json/id/193.json'), 'candidates 含 rss JSON（验收门禁）');
// JSON 候选应排在前面
assert(/\.json/.test(cands[0]), 'JSON 候选优先排序');

// 5) split 边界：带标点尾巴
const t2 = SourceUrlResolver.split('看这个：https://a.com/s.json，或者 https://b.com/x。');
assert(t2.length === 2 && t2[0] === 'https://a.com/s.json' && t2[1] === 'https://b.com/x', 'split 清理尾部标点');

console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
