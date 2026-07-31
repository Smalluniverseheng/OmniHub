# Run: Stage 0 侦察记录
- 时间: 2026-07-31T09:20:00+08:00
- 命令: curl 多候选 URL 探测 + GitHub/Supabase/Neon/CF API 侦察

## 书源 URL 探测（用户粘贴串拆分）
输入串: https://www.yckceo.com/yuedu/rsshttps://www.spmxxqq.com:2087/1035.htmls/json/id/193.json
| 候选 | 结果 |
|---|---|
| yckceo.com/yuedu/rss | 200 HTML（源仓库RSS列表页）|
| yckceo.com/yuedu/shuyuan/json/id/193.json | 200 JSON（Legado书源：纵横中文网，含searchUrl/ruleSearch/ruleToc/ruleContent）|
| yckceo.com/yuedu/rss/json/id/193.json | 200 JSON（Legado RSS订阅源：源仓库官方纯净）|
| spmxxqq.com:2087/1035.html | 200 HTML（仅移动端访问的分享页，桌面浏览器显示二维码提示）|
| spmxxqq.com:2087/s/json/id/193.json | 404 HTML |
| 原串整串 | 404 HTML（必须拆分）|
结论：可导入载荷 = yckceo 书源JSON + RSS源JSON；导入器需多URL拆分+候选探测+HTML页JSON发现。

## 仓库现状
- main HEAD 7e42ce6 = v8.1（规划文档基线 v7.8 已过时）
- 版本4处同步正常（v2 verifier 通过记录）
- GitHub Pages: 已配置 main/root，status=built，URL https://smalluniverseheng.github.io/OmniHub/（沙箱 curl github.io 间歇性 TLS 失败，用浏览器工具复核）

## 后端现状
- Supabase mxvxlgjzeboktufumxbp：21 表在（user_devices/card_keys/membership_levels/error_logs缺?...）；RLS 全开
- Neon：新建 omnihub-ops（project gentle-meadow-53403083）
- CF：已有 ai-gateway worker（23.7KB，AI代理+Supabase持久化+卡密验证）；无 KV；需新建 omnihub-proxy

## 差距盘点（4 explore 代理）
- 对话/模型/Key：已收报告（P0：三种对话模式/独立Key管理页/自定义厂商15字段/联网搜索/高级设置重构/模型详情页/二级密码）
- 我的/安全：已收报告（P0：两层密码/设备管理；P1：云同步diff/消息持久化/代理配额/流式续接）
- 阅读/全局：待收
