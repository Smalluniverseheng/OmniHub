/* ==================== 书源格式自动识别 ====================
 * 粘贴内容 → 识别为 Legado JSON / Venera JS / CSS 选择器配置
 * detect(text) 返回 Promise<{type, confidence, sources, message}>
 * type: 'legado' | 'venera' | 'venera-index' | 'css-config' | 'legado-js' | 'unknown'
 */

const SourceDetect = (() => {
  'use strict';

  function clean(text) {
    return String(text == null ? '' : text)
      .replace(/^\uFEFF/, '')
      .replace(/[\u200B\u200C\u200D\u200E\u200F]/g, '')
      .trim();
  }

  function result(type, confidence, sources, message) {
    return { type: type, confidence: confidence, sources: sources || [], message: message || '' };
  }

  /* ---------- Legado 特征打分 ---------- */
  function legadoScore(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return 0;
    var score = 0;
    if (obj.bookSourceName && obj.bookSourceUrl) score += 5;
    ['ruleSearch', 'ruleBookInfo', 'ruleToc', 'ruleContent', 'searchUrl'].forEach(function(k) {
      if (obj[k]) score += 2;
    });
    return score;
  }

  /* ---------- CSS 裸选择器配置判定 ---------- */
  function looksLikeCssConfig(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    if (!obj.name || !obj.url) return false;
    var selectorKeys = ['bookList', 'name', 'author', 'chapterList', 'selectors', 'searchList', 'searchName', 'images', 'chapterUrl'];
    var keys = Object.keys(obj);
    var hit = 0;
    for (var i = 0; i < keys.length; i++) {
      var v = obj[keys[i]];
      if (typeof v !== 'string') continue;
      if (selectorKeys.indexOf(keys[i]) > -1) hit++;
      // 值里出现规则符号 → 不是裸选择器配置（{{keyword}} 搜索占位符除外）
      var probe = v.split('{{keyword}}').join('');
      if (probe.indexOf('@') > -1 || probe.indexOf('##') > -1 || probe.indexOf('{{') > -1 || probe.indexOf('<js>') > -1) return false;
    }
    return hit > 0 || keys.some(function(k) { return ['searchUrl', 'searchList', 'chapterList', 'mediaType'].indexOf(k) > -1; });
  }

  function toCssSource(obj) {
    return {
      name: obj.name || '',
      url: obj.url || '',
      mediaType: obj.mediaType || 'novel',
      searchUrl: obj.searchUrl || '',
      searchList: obj.searchList || obj.bookList || '',
      searchName: obj.searchName || obj.name2 || '',
      chapterList: obj.chapterList || '',
      images: obj.images || ''
    };
  }

  /* ---------- Venera 源索引判定 ---------- */
  function looksLikeVeneraIndex(items) {
    return items.every(function(o) {
      return o && typeof o === 'object' && o.name && o.url &&
        (o.filename || o.version) &&
        !o.ruleSearch && !o.ruleBookInfo && !o.ruleToc && !o.ruleContent;
    });
  }

  /* ---------- JSON 修复 ---------- */
  function tryRepairJson(text) {
    var fixed = text
      .replace(/,\s*([}\]])/g, '$1')                 // 尾逗号
      .replace(/'/g, '"');                            // 单引号 → 双引号
    try { return JSON.parse(fixed); } catch (e) { return undefined; }
  }

  /* ---------- 压缩格式解压 ---------- */
  async function tryDecompress(text) {
    var b64 = text;
    if (b64.toLowerCase().indexOf('fox://') === 0) b64 = b64.substring(6);
    b64 = b64.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/=_-]+$/.test(b64) || b64.length < 64) return null;
    try {
      var bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      // gzip 魔数 1f 8b → 尝试解压
      if (bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b && typeof DecompressionStream !== 'undefined') {
        var ds = new DecompressionStream('gzip');
        var stream = new Blob([bytes]).stream().pipeThrough(ds);
        var buf = await new Response(stream).arrayBuffer();
        return new TextDecoder().decode(buf);
      }
      // 非压缩：直接按文本解码
      var plain = new TextDecoder().decode(bytes);
      if (/^[\s]*[{[]/.test(plain)) return plain;
      return null;
    } catch (e) {
      return null;
    }
  }

  function parseJsonContent(data) {
    var items = Array.isArray(data) ? data : [data];

    // Legado 书源（单个或合集）
    var scores = items.map(legadoScore);
    var maxScore = Math.max.apply(null, scores.concat([0]));
    if (maxScore >= 7) {
      var valid = items.filter(function(o) { return legadoScore(o) >= 7 && o.bookSourceName && o.bookSourceUrl; });
      var skipped = items.length - valid.length;
      return result('legado', Math.min(0.99, 0.5 + maxScore * 0.04), valid,
        skipped > 0 ? ('已跳过 ' + skipped + ' 个无效书源') : '');
    }

    // Venera 源索引
    if (Array.isArray(data) && items.length && looksLikeVeneraIndex(items)) {
      return result('venera-index', 0.85, [], '检测到 Venera 源索引文件，请粘贴单个图源的 JS 脚本内容');
    }

    // CSS 裸选择器配置
    if (!Array.isArray(data) && looksLikeCssConfig(data)) {
      return result('css-config', 0.75, [toCssSource(data)], '');
    }
    if (Array.isArray(data) && items.length && items.every(looksLikeCssConfig)) {
      return result('css-config', 0.7, items.map(toCssSource), '');
    }

    return result('unknown', 0.2, [], 'JSON 格式正确，但未识别出已知书源特征');
  }

  async function detect(text) {
    var t = clean(text);
    if (!t) return result('unknown', 0, [], '内容为空');

    var first = t.charAt(0);

    // JSON 分支
    if (first === '{' || first === '[') {
      try {
        return parseJsonContent(JSON.parse(t));
      } catch (e) {
        var repaired = tryRepairJson(t);
        if (repaired !== undefined) return parseJsonContent(repaired);
        return result('unknown', 0.1, [], 'JSON 内容损坏，无法解析：' + e.message);
      }
    }

    // Venera JS 图源脚本
    if (/class\s+\w+\s+extends\s+ComicSource/.test(t)) {
      return result('venera', 0.95, [], '');
    }
    if ((/key\s*[=:]/.test(t) && /version\s*[=:]/.test(t)) && (/loadInfo|loadEp/.test(t))) {
      return result('venera', 0.8, [], '');
    }

    // Legado JS 片段（不是完整书源）
    if (/bookSourceUrl|java\.ajax/.test(t)) {
      return result('legado-js', 0.7, [], '检测到 Legado JS 片段，这不是完整书源，请粘贴完整的书源 JSON');
    }

    // fox:// 或长 Base64 压缩格式
    if (/^fox:\/\//i.test(t) || (/^[A-Za-z0-9+/=\s_-]+$/.test(t) && t.replace(/\s+/g, '').length > 200)) {
      var decoded = await tryDecompress(t);
      if (decoded) return detect(decoded);
      return result('unknown', 0.15, [], '压缩格式无法识别，请粘贴原始书源文本');
    }

    return result('unknown', 0.1, [], '无法识别的书源格式，支持 Legado JSON / Venera JS / CSS 选择器配置');
  }

  return { detect: detect };
})();
