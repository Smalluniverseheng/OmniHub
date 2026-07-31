/* ==================== OmniHub TokenMeter - Token 计费统计 ====================
 * 累计 Token 消耗存 Store.state.chat.tokenUsage = { input, output, byModel: { model: {input, output} } }
 * 单价表内嵌（USD / 百万 token），后台尝试 BackendConfig.pricing() 更新（静默失败）
 * 暴露：TokenMeter.record(model, usage) / TokenMeter.summary(conv) / TokenMeter.refreshPricing()
 */

const TokenMeter = (() => {
  'use strict';

  /* 内嵌单价表：{ 模型前缀: [输入价, 输出价] }（USD / 1M tokens，按前缀匹配） */
  var PRICE_TABLE = {
    'gpt-4o-mini': [0.15, 0.6],
    'gpt-4o': [2.5, 10],
    'claude-3.7-sonnet': [3, 15],
    'claude-3-7-sonnet': [3, 15],
    'deepseek-chat': [0.27, 1.1],
    'deepseek-reasoner': [0.55, 2.19],
    'kimi-k2': [0.6, 2.5],
    'moonshot-v1': [1.6, 1.6]
  };
  var PRICE_DEFAULT = [1, 2];  // 缺省 1/2

  var pricingFetched = false;

  /* 取累计容器（不存在则初始化） */
  function usageStore() {
    var c = Store.state.chat;
    if (!c.tokenUsage) c.tokenUsage = { input: 0, output: 0, byModel: {} };
    if (!c.tokenUsage.byModel) c.tokenUsage.byModel = {};
    return c.tokenUsage;
  }

  /* 统一各厂商 usage 字段 → { input, output } */
  function normalizeUsage(usage) {
    if (!usage) return { input: 0, output: 0 };
    var input = usage.prompt_tokens || usage.input_tokens || usage.promptTokenCount || 0;
    var output = usage.completion_tokens || usage.output_tokens || usage.candidatesTokenCount || 0;
    if (!output && usage.total_tokens && input) output = Math.max(0, usage.total_tokens - input);
    return { input: input | 0, output: output | 0 };
  }

  /* 按前缀匹配单价（取最长命中前缀） */
  function priceOf(model) {
    var id = String(model || '').toLowerCase();
    var best = '';
    var price = null;
    var cached = Store.state.chat && Store.state.chat.pricingCache;
    if (cached && cached[id]) price = cached[id];
    if (!price) {
      for (var key in PRICE_TABLE) {
        if (id.indexOf(key) === 0 && key.length > best.length) {
          best = key;
          price = PRICE_TABLE[key];
        }
      }
    }
    return price || PRICE_DEFAULT;
  }

  /* 记录一次调用的 usage；conv 可选（同时累计到会话） */
  function record(model, usage, conv) {
    var n = normalizeUsage(usage);
    if (!n.input && !n.output) return n;
    var store = usageStore();
    store.input += n.input;
    store.output += n.output;
    var key = model || 'unknown';
    if (!store.byModel[key]) store.byModel[key] = { input: 0, output: 0 };
    store.byModel[key].input += n.input;
    store.byModel[key].output += n.output;
    if (conv) {
      if (!conv.tokenUsage) conv.tokenUsage = { input: 0, output: 0 };
      conv.tokenUsage.input += n.input;
      conv.tokenUsage.output += n.output;
    }
    try { Store.save(); } catch (e) { /* ignore */ }
    emitChanged();
    return n;
  }

  /* 汇总：conv 传入时算该会话 + 该会话模型费用，否则算全局累计 */
  function summary(conv) {
    var input = 0;
    var output = 0;
    var cost = 0;
    if (conv && conv.tokenUsage) {
      input = conv.tokenUsage.input | 0;
      output = conv.tokenUsage.output | 0;
      // 会话级费用按当前模型单价估算
      var price = priceOf(currentModelId());
      cost = input * price[0] / 1e6 + output * price[1] / 1e6;
    } else {
      var store = usageStore();
      input = store.input | 0;
      output = store.output | 0;
      for (var m in store.byModel) {
        var p = priceOf(m);
        cost += store.byModel[m].input * p[0] / 1e6 + store.byModel[m].output * p[1] / 1e6;
      }
    }
    return { input: input, output: output, cost: cost };
  }

  function currentModelId() {
    try {
      var c = Store.state.chat;
      return c.modelId || c.model || c.customModel || '';
    } catch (e) { return ''; }
  }

  /* 格式化费用：小于 0.01 显示 4 位小数 */
  function formatCost(cost) {
    if (!cost) return '$0.00';
    return cost < 0.01 ? '$' + cost.toFixed(4) : '$' + cost.toFixed(2);
  }

  /* 后台从 BackendConfig.pricing() 拉取最新单价（静默失败，仅尝试一次/会话） */
  function refreshPricing() {
    if (pricingFetched) return;
    pricingFetched = true;
    if (typeof BackendConfig === 'undefined' || !BackendConfig.pricing) return;
    if (typeof fetch !== 'function') return;
    fetch(BackendConfig.pricing()).then(function(res) {
      if (!res.ok) return null;
      return res.json();
    }).then(function(json) {
      if (!json) return;
      // 期望格式：{ "gpt-4o": [in, out], ... } 或 { models: { id: {input, output} } }
      var table = json.models || json;
      var cache = {};
      var count = 0;
      for (var id in table) {
        var v = table[id];
        var pair = null;
        if (v && typeof v === 'object' && !Array.isArray(v) && (v.input != null || v.output != null)) {
          pair = [Number(v.input) || 0, Number(v.output) || 0];
        } else if (Array.isArray(v) && v.length >= 2) {
          pair = [Number(v[0]) || 0, Number(v[1]) || 0];
        }
        if (pair && (pair[0] || pair[1])) { cache[String(id).toLowerCase()] = pair; count++; }
      }
      if (count) {
        Store.state.chat.pricingCache = cache;
        try { Store.save(); } catch (e) { /* ignore */ }
        emitChanged();
      }
    }).catch(function() { /* 静默失败 */ });
  }

  function emitChanged() {
    try {
      if (window.EventBus && typeof EventBus.emit === 'function') EventBus.emit('chat:tokenUsage', summary());
      document.dispatchEvent(new CustomEvent('chat:tokenUsage'));
    } catch (e) { /* ignore */ }
  }

  return {
    record: record,
    summary: summary,
    priceOf: priceOf,
    formatCost: formatCost,
    refreshPricing: refreshPricing
  };
})();
