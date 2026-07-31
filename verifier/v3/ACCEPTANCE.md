# Verifier v3 — 验收标准（v8.2）

> 继承 v2 全部检查（node --check / 括号匹配 / 版本4处同步 / 资源引用存在）。
> 新增 v8.2 验收：以「模拟用户导入书源并搜索」为最高优先级（P0 门禁）。

## A. 静态检查（每次提交前）
1. `node --check` 全部 .js 通过
2. `python3 verifier/v1/check_brackets.py` 括号匹配 PASS
3. `python3 verifier/v2/check_version.py` 版本 4 处一致（x.y 格式）
4. `python3 verifier/v1/check_refs.py` index.html 引用存在
5. 新增 JS 文件必须加入 index.html（带 ?v=8.2）且 sw.js 缓存清单同步

## B. 书源链路 P0 门禁（模拟用户）
环境：本地 http://127.0.0.1:8788 + 线上 https://smalluniverseheng.github.io/OmniHub/
步骤（浏览器 e2e，verifier/v3/e2e-source-import.md 记录每步证据）：
1. 打开站点 → 同意免责声明 → 进入阅读模块（模块管理开启，或默认开启）
2. 书源管理 → 网络 URL 导入框粘贴**原串**：
   `https://www.yckceo.com/yuedu/rsshttps://www.spmxxqq.com:2087/1035.htmls/json/id/193.json`
3. 点击下载/导入：
   - 期望：识别出多个候选 URL，逐个探测；
   - 至少成功导入 1 个书源（纵横中文网）；RSS 源识别为订阅源提示或并存导入
   - 导入后该书源 enabled=true 出现在书源列表
4. 搜索页输入「斗破苍穹」→ 搜索：
   - 期望：结果列表 ≥1 条，含书名与书源名；无「网络请求失败」类错误
5. （延伸）点击「立即阅读」→ 目录加载 ≥1 章 → 第一章正文非空
降级判定：若纵横源因目标站原因失效，允许换用「官方源仓库」(Neon/Worker) 中任一源完成 4-5 步，但导入拆分逻辑必须演示成功。

## C. 引擎单元测试（Node）
`node verifier/v3/test_units.mjs`：
1. SourceUrlResolver.split 对原串输出 ≥2 个候选 URL，且包含两个 yckceo JSON 候选
2. SourceDetect.detect 对纵横 JSON 判型 legado、confidence≥0.7
3. LegadoConverter.convertAll 输出统一 schema（name/url/searchRule/raw 存在）
4. LegadoEngine.buildRequest 对 `http://search.zongheng.com/s?keyword={{key}}` 生成正确 GET
5. 版本号 x.y 正则（禁 x.y.z）扫描 js/*.js 无命中

## D. 后端联通（发布前）
1. `curl omnihub-proxy.../health` → ok:true
2. `/fetch?url=<纵横JSON>` → ok:true 且 text 含 bookSourceName
3. `/sources/official` → sources ≥1（Neon 播种生效）
4. Supabase error_logs 表存在且可 INSERT（匿名）

## E. 功能抽查（P1）
- 二级密码：查看 API Key 明文前弹验证；15 分钟内免验
- 设备管理页可打开并显示当前设备
- 高级设置页含 AI 生成工具/智能工具/消耗控制三组
- 多模型并行/辩论/协同入口存在且可发起
