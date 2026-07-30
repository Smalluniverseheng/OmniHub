# Verifier 索引（append-only）

## v1 — 2026-07-30
- 测量内容：
  1. 所有 JS 文件 `node --check` 语法校验
  2. 括号/花括号/方括号匹配检查（check_brackets.py）
  3. 版本号 4 处一致性（providers.js / index.html ?v= / sw.js / changelog.js），x.y 格式
  4. index.html 引用资源存在性检查
- 与上一版差异：首版

## v2 — 2026-07-30
- 测量内容：同 v1，仅修正 check_version.py：sw.js 的 VERSION 允许可选 `v` 前缀（仓库基线格式为 `const VERSION = 'v7.8'`）
- 与上一版差异：v1 正则要求纯数字版本导致 sw.js 恒 FAIL（基线即误报），v2 修复
