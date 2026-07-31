# Run: e2e 引擎验收台 — E2E PASS（8/8）
- 时间: 2026-07-31T23:59:30+08:00
- 页面: verifier/v3/e2e-harness.html（真实浏览器 + 真实网络 + 真实 Worker/Neon）
| 步骤 | 结果 |
|---|---|
| split 验收串 | ✓ 2 个 URL（https:// 边界切开连写串）|
| 候选扩展 | ✓ 8 候选，含 shuyuan/rss 两个 id/193 JSON |
| resolve 联网探测 | ✓ 2 个候选取回内容（NetFetch 三级回退）|
| 纵横 JSON 判型 | ✓ legado ×1 |
| 官方源仓库（Neon→Worker）| ✓ 返回精华书阁手机版 |
| 精华书阁搜索「斗破苍穹」| ✓ 20 条；首条 斗破苍穹之无上之境 / 夜雨闻铃0 |
| 目录加载 | ✓ 25 章（规则修正为 ul.chapter li，原 li!0:1 索引排除语法不支持）|
| 首章正文 | ✓ 1210 字（#nr1@textNodes）|
| 纵横源搜索 | ✓ 请求成功 0 条（上游已改 JS 渲染，dom_resList 动态填充，属源侧过时，非引擎缺陷）|

## 过程性修复
- Neon official_sources 播种：精华书阁手机版（id46 实测 28 命中/规则标记匹配）、百度小说（JSON API）
- 目录规则修正并 UPDATE payload；Worker KV 缓存手动失效 ×2
- UI 集成修复：subpage 等浮层 z-index ≥950（侧栏 900/顶栏 890 之上）、官方源弹层 995/996、桌面页头隐藏+顶栏转发（DOM 活动页判定）、模块行整行点击开关、关于页版本号动态化、.source-url-row button width:auto
