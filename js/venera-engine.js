/* ==================== Venera JS 漫画图源引擎 (Web 移植版) ====================
 * 基于 https://github.com/venera-app/venera
 */

const VeneraEngine = (() => {
  'use strict';

  function Cookie({name, value, domain}) {
    this.name = name; this.value = value; this.domain = domain || '';
  }

  function Comic({id, title, subtitle, subTitle, cover, tags, description, maxPage, language, favoriteId, stars}) {
    this.id = id || ''; this.title = title || '';
    this.subtitle = subtitle || subTitle || ''; this.subTitle = this.subtitle;
    this.cover = cover || ''; this.tags = tags || [];
    this.description = description || ''; this.maxPage = maxPage || 0;
    this.language = language || ''; this.favoriteId = favoriteId || '';
    this.stars = stars || 0;
  }

  function ComicDetails({title, subtitle, subTitle, cover, description, tags, chapters, isFavorite, subId, thumbnails, recommend, commentCount, likesCount, isLiked, uploader, updateTime, uploadTime, url, stars, maxPage, comments}) {
    this.title = title || ''; this.subtitle = subtitle || subTitle || ''; this.subTitle = this.subtitle;
    this.cover = cover || ''; this.description = description || '';
    this.tags = tags || null; this.chapters = chapters || null;
    this.isFavorite = isFavorite ?? null; this.subId = subId || '';
    this.thumbnails = thumbnails || null; this.recommend = recommend || null;
    this.commentCount = commentCount || 0; this.likesCount = likesCount || 0;
    this.isLiked = isLiked || false; this.uploader = uploader || '';
    this.updateTime = updateTime || ''; this.uploadTime = uploadTime || '';
    this.url = url || ''; this.stars = stars || 0; this.maxPage = maxPage || 0;
    this.comments = comments || null;
  }

  function Comment({userName, avatar, content, time, replyCount, id, isLiked, score, voteStatus}) {
    this.userName = userName || ''; this.avatar = avatar || '';
    this.content = content || ''; this.time = time || '';
    this.replyCount = replyCount || 0; this.id = id || '';
    this.isLiked = isLiked || false; this.score = score || 0;
    this.voteStatus = voteStatus || 0;
  }

  function ImageLoadingConfig({url, method, data, headers, onResponse, modifyImage, onLoadFailed}) {
    this.url = url || ''; this.method = method || 'GET';
    this.data = data || null; this.headers = headers || null;
    this.onResponse = onResponse || null; this.modifyImage = modifyImage || null;
    this.onLoadFailed = onLoadFailed || null;
  }

  const Convert = {
    encodeUtf8(str) { return new TextEncoder().encode(str).buffer; },
    decodeUtf8(buf) { return new TextDecoder().decode(buf); },
    encodeBase64(buf) {
      const bytes = new Uint8Array(buf); let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    },
    decodeBase64(str) {
      const bin = atob(str); const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      return buf.buffer;
    },
    async md5(buf) { try { return await crypto.subtle.digest('MD5', buf); } catch(e) { return buf; } },
    async sha1(buf) { return await crypto.subtle.digest('SHA-1', buf); },
    async sha256(buf) { return await crypto.subtle.digest('SHA-256', buf); },
    async sha512(buf) { return await crypto.subtle.digest('SHA-512', buf); },
    async hmac(key, value, hash) {
      const algo = { name: 'HMAC', hash: hash.toUpperCase().replace('SHA', 'SHA-') };
      const k = await crypto.subtle.importKey('raw', key, algo, false, ['sign']);
      return await crypto.subtle.sign('HMAC', k, value);
    },
    async hmacString(key, value, hash) { return this.encodeBase64(await this.hmac(key, value, hash)); },
    async decryptAesEcb(value, key) { console.warn('AES ECB not supported'); return value; },
    async decryptAesCbc(value, key, iv) {
      return await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, await crypto.subtle.importKey('raw', key, 'AES-CBC', false, ['decrypt']), value);
    },
    async decryptAesCfb(value, key, iv) { console.warn('AES CFB not supported'); return value; },
    async decryptAesOfb(value, key, iv) { console.warn('AES OFB not supported'); return value; },
    async decryptRsa(value, key) { console.warn('RSA decrypt not supported'); return value; },
    hexEncode(buf) { return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''); }
  };

  async function doFetch(method, url, headers, data, asBytes) {
    const opts = { method: method || 'GET', headers: headers || {}, credentials: 'omit' };
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      if (data instanceof ArrayBuffer) opts.body = data;
      else if (typeof data === 'string') opts.body = data;
      else if (typeof data === 'object') { opts.body = JSON.stringify(data); opts.headers['Content-Type'] = 'application/json'; }
    }
    const tryFetch = async (target) => {
      const r = await fetch(target, opts);
      const h = {}; r.headers.forEach((v, k) => h[k] = v);
      if (asBytes) return { status: r.status, headers: h, body: await r.arrayBuffer() };
      return { status: r.status, headers: h, body: await r.text() };
    };
    try { return await tryFetch(url); }
    catch (e) {
      const proxies = [
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?'
      ];
      for (const p of proxies) { try { return await tryFetch(p + encodeURIComponent(url)); } catch(_) {} }
      throw e;
    }
  }

  const Network = {
    async fetchBytes(method, url, headers, data) { return await doFetch(method, url, headers, data, true); },
    async sendRequest(method, url, headers, data) { return await doFetch(method, url, headers, data, false); },
    async get(url, headers) { return await doFetch('GET', url, headers, null, false); },
    async post(url, headers, data) { return await doFetch('POST', url, headers, data, false); },
    async put(url, headers, data) { return await doFetch('PUT', url, headers, data, false); },
    async delete(url, headers) { return await doFetch('DELETE', url, headers, null, false); },
    async patch(url, headers, data) { return await doFetch('PATCH', url, headers, data, false); },
    setCookies(url, cookies) { if (!window.__veneraCookies) window.__veneraCookies = {}; window.__veneraCookies[url] = cookies; },
    getCookies(url) { return (window.__veneraCookies && window.__veneraCookies[url]) || []; },
    deleteCookies(url) { if (window.__veneraCookies) delete window.__veneraCookies[url]; }
  };

  const fetchCompat = async (url, opts) => {
    const r = await doFetch((opts && opts.method) || 'GET', url, opts && opts.headers, opts && opts.body, false);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, headers: { get: k => r.headers[k.toLowerCase()] }, text: async () => r.body, arrayBuffer: async () => r.body, json: async () => JSON.parse(r.body) };
  };

  class HtmlElement {
    constructor(el) { this._el = el; }
    querySelector(sel) { const r = this._el.querySelector(sel); return r ? new HtmlElement(r) : null; }
    querySelectorAll(sel) { return Array.from(this._el.querySelectorAll(sel)).map(e => new HtmlElement(e)); }
    getElementById(id) { const r = this._el.getElementById?.(id) || this._el.querySelector('#'+id); return r ? new HtmlElement(r) : null; }
    get text() { return this._el.textContent || ''; }
    get attributes() { const o = {}; if (this._el.attributes) Array.from(this._el.attributes).forEach(a => o[a.name] = a.value); return o; }
    get children() { return Array.from(this._el.children).map(c => new HtmlElement(c)); }
    get nodes() { return Array.from(this._el.childNodes).map(n => new HtmlNode(n)); }
    get parent() { return this._el.parentElement ? new HtmlElement(this._el.parentElement) : null; }
    get innerHtml() { return this._el.innerHTML || ''; }
    get classNames() { return Array.from(this._el.classList); }
    get id() { return this._el.id || null; }
    get localName() { return this._el.localName || ''; }
    get previousSibling() { return this._el.previousElementSibling ? new HtmlElement(this._el.previousElementSibling) : null; }
    get nextSibling() { return this._el.nextElementSibling ? new HtmlElement(this._el.nextElementSibling) : null; }
  }

  class HtmlNode {
    constructor(n) { this._n = n; }
    get type() { const t = this._n.nodeType; if (t === 3) return 'text'; if (t === 1) return 'element'; if (t === 8) return 'comment'; if (t === 9) return 'document'; return 'unknown'; }
    toElement() { return this._n.nodeType === 1 ? new HtmlElement(this._n) : null; }
    get text() { return this._n.textContent || ''; }
  }

  class HtmlDocument extends HtmlElement {
    constructor(html) { const parser = new DOMParser(); const doc = parser.parseFromString(html, 'text/html'); super(doc.documentElement); this._doc = doc; }
    dispose() { this._doc = null; }
  }

  const UI = {
    showMessage(msg) { if (window.Toast) Toast.show(msg); else console.log('[Venera]', msg); },
    showDialog(title, content, actions) { if (actions && actions.length) { const ok = confirm(title + '\n' + content); if (ok && actions[0]) actions[0].callback(); } },
    launchUrl(url) { window.open(url, '_blank'); },
    showLoading(onCancel) { if (window.Loading) return Loading.show(); return 1; },
    cancelLoading(id) { if (window.Loading) Loading.hide(); },
    showInputDialog(title, validator) { return prompt(title); },
    showSelectDialog(title, options, initialIndex) { const v = prompt(title + '\n' + options.map((o,i) => i + '. ' + o).join('\n')); const n = parseInt(v); return isNaN(n) ? null : n; }
  };

  function createUuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); }); }
  function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function randomDouble(min, max) { return Math.random() * (max - min) + min; }

  class ComicSource {
    constructor() { this.name = ''; this.key = ''; this.version = ''; this.minAppVersion = ''; this.url = ''; }
    loadData(dataKey) { const sk = 'venera_data_' + this.key + '_' + dataKey; return Store.state[sk] || null; }
    loadSetting(key) { const sk = 'venera_setting_' + this.key + '_' + key; return Store.state[sk] || null; }
    saveData(dataKey, data) { const sk = 'venera_data_' + this.key + '_' + dataKey; Store.state[sk] = data; Store.save(); }
    deleteData(dataKey) { const sk = 'venera_data_' + this.key + '_' + dataKey; delete Store.state[sk]; Store.save(); }
    get isLogged() { const sk = 'venera_account_' + this.key; return !!Store.state[sk]; }
    init() {}
    static sources = {};
  }

  function loadSource(jsCode, keyHint) {
    const sandbox = document.createElement('iframe');
    sandbox.style.display = 'none';
    document.body.appendChild(sandbox);
    const win = sandbox.contentWindow;

    win.ComicSource = ComicSource;
    win.Network = Network;
    win.HtmlDocument = HtmlDocument;
    win.HtmlElement = HtmlElement;
    win.HtmlNode = HtmlNode;
    win.UI = UI;
    win.Convert = Convert;
    win.Cookie = Cookie;
    win.Comic = Comic;
    win.ComicDetails = ComicDetails;
    win.Comment = Comment;
    win.ImageLoadingConfig = ImageLoadingConfig;
    win.createUuid = createUuid;
    win.randomInt = randomInt;
    win.randomDouble = randomDouble;
    win.fetch = fetchCompat;
    win.console = console;
    win.sendMessage = function(msg) {
      if (msg.method === 'load_data') { const sk = 'venera_data_' + msg.key + '_' + msg.data_key; return Store.state[sk] || null; }
      if (msg.method === 'save_data') { const sk = 'venera_data_' + msg.key + '_' + msg.data_key; Store.state[sk] = msg.data; Store.save(); return null; }
      if (msg.method === 'delete_data') { const sk = 'venera_data_' + msg.key + '_' + msg.data_key; delete Store.state[sk]; Store.save(); return null; }
      if (msg.method === 'load_setting') { const sk = 'venera_setting_' + msg.key + '_' + msg.setting_key; return Store.state[sk] || null; }
      if (msg.method === 'isLogged') { const sk = 'venera_account_' + msg.key; return !!Store.state[sk]; }
      return null;
    };

    try {
      // eval 中的 class 声明不会产生 window 属性（词法绑定），
      // 先从源码提取类名，追加导出语句在同一作用域内赋到 window.__omniSrc
      const m = jsCode.match(/class\s+([A-Za-z_$][\w$]*)\s+extends\s+ComicSource/);
      win.__omniSrc = null;
      win.eval(jsCode + (m ? '\n;__omniSrc = (typeof ' + m[1] + ' !== "undefined") ? ' + m[1] + ' : null;' : ''));
      let source = null;
      if (win.__omniSrc) {
        try { source = new win.__omniSrc(); } catch (e0) { console.warn('图源实例化失败:', e0); }
      }
      if (!source) {
        for (const k of Object.keys(win)) {
          const v = win[k];
          if (typeof v === 'function' && v.prototype && v.prototype instanceof win.ComicSource) { source = new v(); break; }
        }
      }
      if (!source && win.ComicSource.sources) {
        const keys = Object.keys(win.ComicSource.sources);
        if (keys.length) source = win.ComicSource.sources[keys[keys.length - 1]];
      }
      document.body.removeChild(sandbox);
      if (!source) throw new Error('未找到继承 ComicSource 的类');
      if (!source.key) source.key = keyHint || source.name || 'unknown_' + Date.now();
      if (!source.name) source.name = source.key;
      ComicSource.sources[source.key] = source;
      if (typeof source.init === 'function') { try { source.init(); } catch(e) { console.warn('Source init error:', e); } }
      return source;
    } catch(e) {
      document.body.removeChild(sandbox);
      throw e;
    }
  }

  async function search(sourceKey, keyword, options, page) {
    const src = ComicSource.sources[sourceKey];
    if (!src || !src.search || !src.search.load) throw new Error('图源不支持搜索');
    const res = await src.search.load(keyword, options || {}, page || 1);
    return (res || []).map(c => ({
      id: c.id, name: c.title, author: c.subtitle || '',
      cover: c.cover || '', tags: c.tags || [],
      description: c.description || '', stars: c.stars || 0,
      sourceKey: sourceKey, _venera: true
    }));
  }

  async function explore(sourceKey, explorePage, page) {
    const src = ComicSource.sources[sourceKey];
    if (!src || !src.explore) throw new Error('图源不支持探索');
    const pageData = src.explore[explorePage || 0];
    if (!pageData || !pageData.load) throw new Error('探索页不存在');
    const res = await pageData.load(page || 1);
    // 兼容三种返回：数组；multiPageComicList {comics, maxPage}；singlePageWithMultiPart {分区名: [comics]}
    let list = [];
    if (Array.isArray(res)) list = res;
    else if (res && Array.isArray(res.comics)) list = res.comics;
    else if (res && typeof res === 'object') {
      Object.keys(res).forEach(function(k) {
        if (Array.isArray(res[k])) {
          res[k].forEach(function(c) { if (c && typeof c === 'object') c._part = k; });
          list = list.concat(res[k]);
        }
      });
    }
    return list.map(c => ({
      id: c.id, name: c.title, author: c.subtitle || '',
      cover: c.cover || '', tags: (c.tags || []).concat(c._part ? [c._part] : []),
      description: c.description || '', stars: c.stars || 0,
      sourceKey: sourceKey, _venera: true
    }));
  }

  async function getComicDetails(sourceKey, comicId) {
    const src = ComicSource.sources[sourceKey];
    if (!src || !src.comic || !src.comic.loadInfo) throw new Error('图源不支持详情');
    const det = await src.comic.loadInfo(comicId);
    if (!det) return null;
    let chapters = [];
    if (det.chapters) {
      if (det.chapters instanceof Map) { det.chapters.forEach((title, id) => chapters.push({ id: id, name: title, url: id })); }
      else if (typeof det.chapters === 'object') { Object.entries(det.chapters).forEach(([id, title]) => chapters.push({ id: id, name: title, url: id })); }
    }
    return {
      id: comicId, title: det.title, subtitle: det.subtitle || '',
      cover: det.cover || '', description: det.description || '',
      tags: det.tags || [], chapters: chapters,
      isFavorite: det.isFavorite, stars: det.stars || 0,
      maxPage: det.maxPage || 0, sourceKey: sourceKey, _venera: true
    };
  }

  async function getImages(sourceKey, comicId, epId) {
    const src = ComicSource.sources[sourceKey];
    if (!src || !src.comic || !src.comic.loadEp) throw new Error('图源不支持章节加载');
    const res = await src.comic.loadEp(comicId, epId);
    if (!res) return [];
    return res.map(item => { if (typeof item === 'string') return item; if (item && item.url) return item.url; return ''; }).filter(Boolean);
  }

  async function verify(sourceKey) {
    const src = ComicSource.sources[sourceKey];
    if (!src) return { ok: false, err: '图源未加载' };
    try { const r = await Network.get(src.url); return { ok: r.status >= 200 && r.status < 400, status: r.status }; }
    catch(e) { return { ok: false, err: e.message }; }
  }

  function listSources() {
    return Object.values(ComicSource.sources).map(s => ({
      name: s.name, key: s.key, version: s.version || '', url: s.url || '',
      minAppVersion: s.minAppVersion || '',
      hasSearch: !!(s.search && s.search.load),
      hasExplore: !!(s.explore && s.explore.length),
      hasComic: !!(s.comic && s.comic.loadInfo),
      hasFavorites: !!(s.favorites), hasAccount: !!(s.account)
    }));
  }

  function unload(sourceKey) { delete ComicSource.sources[sourceKey]; }

  /* ---------- 网络 URL 下载书源（带进度回调） ----------
   * onProgress(ratioOrNull, loadedBytes)：有 content-length 时传 0-1 比例，
   * 无 content-length 时传 null（不确定态，仅累计字节数）。
   */
  async function loadSourceFromUrl(url, onProgress) {
    url = String(url || '').trim();
    if (!/^https?:/i.test(url)) throw new Error('请输入有效的 http(s) 地址');
    let text = '';
    try {
      const resp = await fetch(url, { credentials: 'omit' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const total = parseInt(resp.headers.get('content-length') || '0', 10) || 0;
      if (resp.body && typeof resp.body.getReader === 'function') {
        const reader = resp.body.getReader();
        const chunks = [];
        let loaded = 0;
        for (;;) {
          const r = await reader.read();
          if (r.done) break;
          chunks.push(r.value);
          loaded += r.value.length;
          if (typeof onProgress === 'function') {
            try { onProgress(total ? Math.min(0.99, loaded / total) : null, loaded); } catch (e) {}
          }
        }
        const buf = new Uint8Array(loaded);
        let off = 0;
        for (const c of chunks) { buf.set(c, off); off += c.length; }
        text = new TextDecoder().decode(buf);
      } else {
        text = await resp.text();
      }
      if (typeof onProgress === 'function') { try { onProgress(1, total || text.length); } catch (e) {} }
    } catch (e) {
      // 直连失败：NetFetch 代理兜底链（代理路径无法流式，给 indeterminate 进度）
      if (typeof NetFetch === 'undefined') throw e;
      if (typeof onProgress === 'function') { try { onProgress(null, 0); } catch (_) {} }
      text = await NetFetch.proxied(url, {});
      if (typeof onProgress === 'function') { try { onProgress(1, text.length); } catch (_) {} }
    }
    if (!text.trim()) throw new Error('下载内容为空');
    const source = loadSource(text, 'venera_url_' + Date.now());
    source._rawText = text;   // 供调用方持久化（重启后重新加载图源用）
    return source;
  }

  /* ---------- 四步连通测试：搜索 → 详情 → 章节 → 图片 ----------
   * 返回逐步结果数组 [{step, name, status:'pending'|'loading'|'ok'|'fail', msg}]，
   * onUpdate(results) 在每次状态变化时回调，供 UI 逐行渲染。
   * 某一步失败即终止，后续步骤保持 pending。
   */
  async function testSource(sourceKey, onUpdate) {
    const results = [
      { step: 1, name: '搜索', status: 'pending', msg: '' },
      { step: 2, name: '详情', status: 'pending', msg: '' },
      { step: 3, name: '章节', status: 'pending', msg: '' },
      { step: 4, name: '图片', status: 'pending', msg: '' }
    ];
    const notify = () => {
      if (typeof onUpdate === 'function') {
        try { onUpdate(results.map(r => ({ step: r.step, name: r.name, status: r.status, msg: r.msg }))); } catch (e) {}
      }
    };
    const run = async (idx, fn) => {
      results[idx].status = 'loading';
      notify();
      try {
        const out = await fn();
        results[idx].status = 'ok';
        results[idx].msg = out;
        notify();
        return true;
      } catch (e) {
        results[idx].status = 'fail';
        results[idx].msg = (e && e.message) || '失败';
        notify();
        return false;
      }
    };

    let comicId = null, epId = null;
    if (!(await run(0, async () => {
      const list = await search(sourceKey, 'a', {}, 1);
      if (!list || !list.length) throw new Error('搜索无结果');
      comicId = list[0].id;
      return '找到 ' + list.length + ' 条结果';
    }))) return results;

    if (!(await run(1, async () => {
      const det = await getComicDetails(sourceKey, comicId);
      if (!det || !det.title) throw new Error('详情为空');
      if (det.chapters && det.chapters.length) epId = det.chapters[0].url || det.chapters[0].id;
      return det.title;
    }))) return results;

    if (!(await run(2, async () => {
      if (!epId) throw new Error('该图源无章节数据');
      return '章节可用';
    }))) return results;

    await run(3, async () => {
      const imgs = await getImages(sourceKey, comicId, epId);
      if (!imgs || !imgs.length) throw new Error('图片为空');
      return imgs.length + ' 张图片';
    });
    return results;
  }

  return {
    ComicSource, Network, HtmlDocument, HtmlElement, HtmlNode,
    UI, Convert, Cookie, Comic, ComicDetails, Comment, ImageLoadingConfig,
    createUuid, randomInt, randomDouble, fetch: fetchCompat,
    loadSource, loadSourceFromUrl, testSource, unload, listSources, verify,
    search, explore, getComicDetails, getImages
  };
})();
