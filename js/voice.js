/* ==================== OmniHub Voice - TTS 语音播报 ====================
 * 引擎：browser（speechSynthesis）/ openai（POST {base}/v1/audio/speech）
 * openai 引擎复用 Store.state.chat.keys.openai 的 Key
 * 设置存 Store.state.chat.voice = {engine, voiceURI, ttsVoice, rate, autoSpeak}
 * 状态变化通过 Voice.onStateChange(msgId|null) 通知 UI（chat.js 挂载）
 */

const Voice = (() => {
  'use strict';

  var OPENAI_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

  var currentUtter = null;
  var audioEl = null;
  var speakingMsgId = null;

  function vs() {
    var c = Store.state.chat;
    if (!c.voice) {
      c.voice = { engine: 'browser', voiceURI: '', ttsVoice: 'alloy', rate: 1, autoSpeak: false };
    }
    return c.voice;
  }

  function openaiKey() {
    var keys = Store.state.chat.keys || {};
    return keys.openai || '';
  }

  function openaiBase() {
    var p = (typeof AIProviders !== 'undefined') ? AIProviders.get('openai') : null;
    return (p && p.base) || 'https://api.openai.com';
  }

  function notify() {
    if (typeof api.onStateChange === 'function') {
      try { api.onStateChange(speakingMsgId); } catch (e) { /* ignore */ }
    }
  }

  function ttsSupported() {
    return ('speechSynthesis' in window) || (typeof Audio !== 'undefined');
  }

  // 浏览器引擎可用音色（可选仅中文）
  function getVoices(zhOnly) {
    if (!('speechSynthesis' in window)) return [];
    var all = speechSynthesis.getVoices();
    if (!zhOnly) return all;
    return all.filter(function(v) { return /^zh/i.test(v.lang || ''); });
  }

  function pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    var all = speechSynthesis.getVoices();
    var uri = vs().voiceURI;
    if (uri) {
      for (var i = 0; i < all.length; i++) {
        if (all[i].voiceURI === uri) return all[i];
      }
    }
    var zh = getVoices(true);
    return zh[0] || all[0] || null;
  }

  // 清洗 markdown：代码块 → 「代码段」，去符号，截 1500 字
  function cleanText(text) {
    return String(text == null ? '' : text)
      .replace(/```[\s\S]*?```/g, '，代码段，')
      .replace(/[#*>`\-|[\](),.:;!?！？，。；：]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1500);
  }

  /* 统一入口：朗读 */
  function speak(text, msgId) {
    stopSpeak();
    var clean = cleanText(text);
    if (!clean) return false;
    if ((vs().engine || 'browser') === 'openai') {
      return speakOpenai(clean, msgId);
    }
    return speakBrowser(clean, msgId);
  }

  function speakBrowser(clean, msgId) {
    if (!('speechSynthesis' in window)) {
      if (typeof Toast !== 'undefined') Toast.show('当前浏览器不支持语音朗读', 'error');
      return false;
    }
    var u = new SpeechSynthesisUtterance(clean);
    var v = pickVoice();
    if (v) u.voice = v;
    u.lang = v ? v.lang : 'zh-CN';
    u.rate = vs().rate || 1;
    currentUtter = u;
    speakingMsgId = msgId || null;
    u.onend = u.onerror = function() {
      currentUtter = null;
      speakingMsgId = null;
      notify();
    };
    speechSynthesis.speak(u);
    notify();
    return true;
  }

  function speakOpenai(clean, msgId) {
    var key = openaiKey();
    if (!key) {
      if (typeof Toast !== 'undefined') Toast.show('请先在对话设置中配置 OpenAI 的 API Key', 'error');
      return false;
    }
    speakingMsgId = msgId || null;
    notify();
    fetch(openaiBase() + '/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key
      },
      body: JSON.stringify({ model: 'tts-1', input: clean, voice: vs().ttsVoice || 'alloy' })
    }).then(function(res) {
      if (!res.ok) {
        return res.text().then(function(t) {
          throw new Error('HTTP ' + res.status + '：' + (t || '').slice(0, 120));
        });
      }
      return res.blob();
    }).then(function(blob) {
      playUrl(URL.createObjectURL(blob), msgId);
    }).catch(function(err) {
      speakingMsgId = null;
      notify();
      if (typeof Toast !== 'undefined') Toast.show('语音合成失败：' + ((err && err.message) || '网络错误'), 'error');
    });
    return true;
  }

  function playUrl(url, msgId) {
    audioEl = new Audio(url);
    speakingMsgId = msgId || null;
    audioEl.onended = audioEl.onerror = function() {
      speakingMsgId = null;
      audioEl = null;
      notify();
    };
    audioEl.play().catch(function() {
      speakingMsgId = null;
      audioEl = null;
      notify();
    });
    notify();
  }

  function stopSpeak() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (audioEl) {
      try { audioEl.pause(); } catch (e) { /* ignore */ }
      audioEl = null;
    }
    currentUtter = null;
    if (speakingMsgId !== null) {
      speakingMsgId = null;
      notify();
    }
  }

  function isSpeaking(msgId) {
    if (!currentUtter && !audioEl && speakingMsgId === null) return false;
    return msgId ? speakingMsgId === msgId : true;
  }

  // 预热浏览器语音列表（部分浏览器需要）
  if ('speechSynthesis' in window) {
    speechSynthesis.getVoices();
    speechSynthesis.onvoiceschanged = function() { /* 仅预热 */ };
  }

  var api = {
    OPENAI_VOICES: OPENAI_VOICES,
    onStateChange: null,
    ttsSupported: ttsSupported,
    getVoices: getVoices,
    speak: speak,
    stopSpeak: stopSpeak,
    isSpeaking: isSpeaking
  };
  return api;
})();
