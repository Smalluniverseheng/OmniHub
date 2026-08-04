# Run: v9.0 阅读/我的模块规划文档缺口收尾 — PASS（静态）
- 时间: 2026-08-04
- 背景: 对照《OmniHub v8.0+ 全量技术规划文档》待办清单逐项核验 v8.9 代码，收敛出 4 个真实缺口并补齐
- 本次改动:
  1. 漫画阅读器亮度调节（文档 6.3）：悬浮工具钮新增 ☀，滑条弹层 + 黑色遮罩（与小说阅读器同方案），localStorage 持久化（omnihub_comic_brightness）
  2. 漫画阅读器方向锁定（文档 6.3）：悬浮工具钮新增 ⟳，auto→竖屏→横屏循环，screen.orientation.lock + 全屏配合；不支持时 Toast 降级；关闭阅读器自动解锁并退出全屏
  3. 面板方向规范（文档 6.3）：目录面板改左侧滑入（translateX(-100%)→0），阅读设置改底部弹窗（translateY(100%)→0）
  4. AI 流式 reveal 动画（文档 3.8）：updateBubble 重渲后将新增尾部字符包进 span.chat-reveal 做 opacity 0→1（正文限定，思考/工具卡不参与；首帧/超大 chunk 跳过防闪）
  5. 信任设备邮箱认证（文档 7.2）：SB.Auth 新增 sendEmailOtp/verifyEmailOtp（signInWithOtp shouldCreateUser:false + verifyOtp type:email）；开启信任先发 6 位验证码，弹窗支持「改用密码」降级与取消
- 静态校验:
  - node --check 全部 JS: PASS
  - check_version.py: APP_VERSION=9.0, index.html ?v= 41 处=9.0, sw.js=v9.0, changelog 末位=9.0 → SYNC OK
  - check_refs.py: 46 refs, missing []
  - check_brackets.py: reader/profile/supabase/changelog OK；chat.js 报 MISMATCH 为脚本对字符串剥离的既有误报（对 HEAD 旧版同样报错，node --check 通过为准）
- 已核验为「此前版本已完成」的文档待办（抽样代码证据）:
  - 阅读: 书架 Tab 下划线（readTabsIndicator）、空状态呼吸（readPulse）、3D 仿真翻页（rotateY/perspective）、双击 2 倍缩放/捏合、页码圆点、Continuous 懒加载+分隔条、四步测试、Legado 转换器、30s 进度同步（app.js startReadProgressSync）、发现页动态标签+状态点、三种书源导入
  - 我的: 三档会员+年 8 折、25 位卡密分段、宇宙等级+升级动画、设备管理（10/20 上限/踢出/地点）、8 预设头像+上传、数据管理聚合、双回收站总入口、设备日志+AI 诊断、changelog v1.0 起+正倒序、免责声明首开弹窗
- 遗留（未完成，待后续版本）:
  - 模块懒加载 import()（全局架构，改造面大）
  - 云端代理：AI API 转发计量、流式输出续接（需 Worker 扩展）
  - MCP stdio 连接（纯浏览器无法起本地进程，仅 HTTP 可行）
  - 黑夜模式对比度全面视觉验收（需真机过一遍）
  - 卡密后台一键生成（属 AI-admin 后台仓库）
