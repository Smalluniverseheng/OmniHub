/* ==================== 后端端点配置（v8.2 引入） ====================
 * 三大后端：
 *  - Cloudflare Workers：ai-gateway（AI 代理/卡密/会员）+ omnihub-proxy（书源代理/内容 API/KV 缓存）
 *  - Supabase：用户体系/云同步/错误日志/设备管理（见 js/supabase.js）
 *  - Neon：运营数据库（官方书源/排行榜/定价/公告），由 omnihub-proxy 只读暴露
 */
const BackendConfig = (() => {
  'use strict';
  var workerBase = 'https://omnihub-proxy.1829487897.workers.dev';
  var aiGateway = 'https://ai-gateway.1829487897.workers.dev';
  return {
    workerBase: workerBase,
    aiGateway: aiGateway,
    /* 通用抓取代理（绕 CORS；返回 JSON {ok,status,contentType,text}） */
    fetchProxy: function(url) { return workerBase + '/fetch?url=' + encodeURIComponent(url); },
    /* URL 探测（判型 + HTML 页面 JSON 链接发现） */
    probe: function(url) { return workerBase + '/probe?url=' + encodeURIComponent(url); },
    /* 官方源仓库（Neon） */
    officialSources: function() { return workerBase + '/sources/official'; },
    /* 导入上报 */
    reportSource: function() { return workerBase + '/sources/report'; },
    /* 模型排行榜（Neon/KV 缓存） */
    leaderboard: function(board) { return workerBase + '/leaderboard?board=' + encodeURIComponent(board); },
    /* 模型定价（Neon） */
    pricing: function() { return workerBase + '/pricing'; }
  };
})();
