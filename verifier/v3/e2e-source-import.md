# e2e 验收脚本：书源导入 + 搜索（v8.2 P0 门禁）

> 执行人：编排器（浏览器工具）。环境 A：本地 http://127.0.0.1:8788/；环境 B：线上 https://smalluniverseheng.github.io/OmniHub/
> 每步记录证据（截图/页面文本），结果写入 verifier/runs/<时间戳>_e2e.md。

## 前置
- 本地服务器运行中（python3 -m http.server 8788）
- 浏览器会话为全新状态（或已清 localStorage），确保走「首次打开」流程

## 步骤与断言
| # | 操作 | 断言 |
|---|---|---|
| 1 | 打开站点 | 免责声明弹窗从底部滑出；版本公告卡显示 v8.2 |
| 2 | 点「我已阅读并同意」+「知道了」 | 弹窗关闭，进入主页（我的） |
| 3 | 模块管理开启「阅读」模块（若未开）→ 悬浮球切到阅读 | 阅读页可见，底部独立导航存在 |
| 4 | 阅读页设置 → 书源管理 | 子页面右滑入；返回箭头**可见**（v3 修 data-icon） |
| 5 | 网络 URL 导入框粘贴原串：`https://www.yckceo.com/yuedu/rsshttps://www.spmxxqq.com:2087/1035.htmls/json/id/193.json` → 点下载/导入 | 出现候选 URL 列表（≥2）或自动逐个探测；探测状态可见 |
| 6 | 等待导入完成 | Toast/列表显示成功导入 ≥1 个书源（纵横中文网）；RSS 源提示识别为订阅源；spmxxqq 候选失败有明确提示但不阻塞 |
| 7 | 书源列表 | 纵横中文网在列、enabled、Legado 徽标；冒烟测试状态点可见 |
| 8 | 返回 → 搜索（页头搜索按钮）→ 输入「斗破苍穹」→ 搜索 | 结果 ≥1 条；每条含书名+书源名；无「网络请求失败」汇总 |
| 9 | （延伸）点「立即阅读」 | 目录加载 ≥1 章 |
| 10 | （延伸）点第一章 | 正文非空（≥100 字） |
| 11 | 降级路径：若纵横失效，书源管理 → 官方源仓库 → 导入书仓网/无限小说网 → 重复 8-10 | 官方源列表来自 Neon（经 omnihub-proxy） |

## 后端联通复核（curl）
- GET /health → ok:true
- GET /fetch?url=<纵横 json> → ok:true, text 含 bookSourceName
- GET /sources/official → sources ≥4
- GET /probe?url=<yckceo rss 页> → kind:html + jsonLinks ≥1

## 判定
- P0 门禁：5-8 全过（或 11 降级过）= PASS
- 任一失败 → 记录失败点截图+控制台错误 → 修复 → 重跑本脚本（runs/ 追加记录）
