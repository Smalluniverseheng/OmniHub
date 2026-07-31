# Run: 线上 e2e 验收（smalluniverseheng.github.io/OmniHub）— PASS
- 时间: 2026-07-31T10:57:00+08:00
- 前置: 用户报告 verseheng.github.io 上「下载失败 Failed to fetch / 图标缺失 / 无更新公告」
- 根因确认: ①v8.2 修复此前未推送（线上仍 v8.1）②verseheng.github.io 域名已失效（GitHub Pages "Site not found"），用户端为 SW 僵尸缓存
- 推送: b1c704e v8.2 → Pages built ✅

## 线上实测步骤与结果（全部通过）
1. 打开线上 → v8.2 更新公告卡显示（含全部新特性）✅
2. 模块管理开启阅读（整行点击开关生效）✅
3. 书源管理粘贴验收串 → 识别 8 候选，2 JSON + 6 网页，纵横中文网导入成功 ✅
4. 搜索「斗破苍穹」→ 纵横 成功 0 条（上游JS渲染，请求成功无报错）✅
5. 官方源仓库（Neon→omnihub-proxy）弹层正常显示 6 源 → 导入精华书阁手机版 ✅
6. 再次搜索 → 精华书阁手机版 成功 20 条（书名/作者/封面/加入书架/立即阅读）✅

## 用户诉求映射
- 本地发送: NetFetch 顺序 = 设备直连 → omnihub-proxy → 公共代理，默认本地优先，无需后端可用；会员云端代理配额为后续计费增强
- 图标缺失: [data-icon] ×16 已接入 SVG 渲染（返回/搜索/设置）
- 更新公告: v8.2 公告卡正常弹出
- verseheng.github.io: 域名不存在，需引导用户改用 https://smalluniverseheng.github.io/OmniHub/
