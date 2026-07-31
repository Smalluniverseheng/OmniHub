/* ==================== OmniHub Voice - TTS 语音播报 + 语音输入 ====================
 * 播报引擎：browser（speechSynthesis）/ openai（POST {base}/v1/audio/speech）
 * openai 引擎复用 Store.state.chat.keys.openai 的 Key
 * 设置存 Store.state.chat.voice = {engine, voiceURI, ttsVoice, rate, autoSpeak}
 * 状态变化通过 Voice.onStateChange(msgId|null) 通知 UI（chat.js 挂载）
 * 语音输入：优先 webkitSpeechRecognition（免费实时），
 *   不可用时若配置了 OpenAI Key 则 MediaRecorder 采集 → POST /v1/audio/transcriptions(whisper-1)
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

  /* ==================== 语音输入（识别） ==================== */

  var recogActive = null;  // 当前识别控制器 {engine, stop, cancel}

  // 识别引擎优先级：speech（浏览器免费实时）→ whisper（OpenAI Key）→ null
  function recogEngine() {
    if (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) return 'speech';
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof MediaRecorder !== 'undefined' && openaiKey()) return 'whisper';
    return null;
  }

  /* 开始识别
   * callbacks = { onResult(text, isFinal), onState(state) }
   *   state: 'start' | 'processing'（whisper 转写中）| 'end' | 'error'
   * 返回控制器 { engine, stop(), cancel() }，失败返回 null
   */
  function startRecog(callbacks) {
    stopRecog();
    var engine = recogEngine();
    if (!engine) {
      if (typeof Toast !== 'undefined') Toast.show('当前环境不支持语音输入（可配置 OpenAI Key 使用 Whisper）', 'error');
      return null;
    }
    var ctrl = engine === 'speech' ? startSpeechRecog(callbacks) : startWhisperRecog(callbacks);
    recogActive = ctrl;
    return ctrl;
  }

  function stopRecog() {
    if (recogActive && recogActive.stop) {
      try { recogActive.stop(); } catch (e) { /* ignore */ }
    }
    recogActive = null;
  }

  function isRecognizing() {
    return !!recogActive;
  }

  // 浏览器 SpeechRecognition：实时出字
  function startSpeechRecog(callbacks) {
    var Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    var rec = new Ctor();
    rec.lang = ((Store.state.settings && Store.state.settings.language) || 'zh') === 'zh' ? 'zh-CN' : 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    var stopped = false;
    rec.onresult = function(e) {
      var text = '';
      var isFinal = false;
      for (var i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) isFinal = true;
      }
      if (callbacks && callbacks.onResult) callbacks.onResult(text, isFinal);
    };
    rec.onerror = function(e) {
      if (stopped) return;
      stopped = true;
      recogActive = null;
      if (callbacks && callbacks.onState) callbacks.onState('error', (e && e.error) || 'unknown');
    };
    rec.onend = function() {
      if (stopped) return;
      stopped = true;
      recogActive = null;
      if (callbacks && callbacks.onState) callbacks.onState('end');
    };
    try { rec.start(); } catch (e) { /* 重复 start 防护 */ }
    if (callbacks && callbacks.onState) callbacks.onState('start');
    return {
      engine: 'speech',
      stop: function() { stopped = true; try { rec.stop(); } catch (e) { /* ignore */ } },
      cancel: function() { stopped = true; try { rec.abort(); } catch (e) { /* ignore */ } }
    };
  }

  // Whisper 降级：MediaRecorder 采集 → POST /v1/audio/transcriptions
  function startWhisperRecog(callbacks) {
    var recorder = null;
    var chunks = [];
    var streamRef = null;
    var cancelled = false;
    var ctrl = {
      engine: 'whisper',
      stop: function() {
        if (recorder && recorder.state !== 'inactive') {
          try { recorder.stop(); } catch (e) { /* ignore */ }
        }
      },
      cancel: function() {
        cancelled = true;
        ctrl.stop();
      }
    };
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
      if (cancelled) {
        stream.getTracks().forEach(function(t) { t.stop(); });
        return;
      }
      streamRef = stream;
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = function(e) {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      recorder.onstop = function() {
        if (streamRef) streamRef.getTracks().forEach(function(t) { t.stop(); });
        recogActive = null;
        if (cancelled) {
          if (callbacks && callbacks.onState) callbacks.onState('end');
          return;
        }
        if (!chunks.length) {
          if (callbacks && callbacks.onState) callbacks.onState('error', 'empty');
          return;
        }
        if (callbacks && callbacks.onState) callbacks.onState('processing');
        var blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        transcribeWhisper(blob).then(function(text) {
          if (callbacks && callbacks.onResult) callbacks.onResult(text, true);
          if (callbacks && callbacks.onState) callbacks.onState('end');
        }).catch(function(err) {
          if (typeof Toast !== 'undefined') Toast.show('语音识别失败：' + ((err && err.message) || '网络错误'), 'error');
          if (callbacks && callbacks.onState) callbacks.onState('error', (err && err.message) || 'transcribe');
        });
      };
      recorder.start();
      if (callbacks && callbacks.onState) callbacks.onState('start');
    }).catch(function() {
      recogActive = null;
      if (typeof Toast !== 'undefined') Toast.show('无法访问麦克风，请检查授权', 'error');
      if (callbacks && callbacks.onState) callbacks.onState('error', 'mic');
    });
    return ctrl;
  }

  function transcribeWhisper(blob) {
    var fd = new FormData();
    fd.append('file', blob, 'voice.webm');
    fd.append('model', 'whisper-1');
    return fetch(openaiBase() + '/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + openaiKey() },
      body: fd
    }).then(function(res) {
      if (!res.ok) {
        return res.text().then(function(t) {
          throw new Error('HTTP ' + res.status + '：' + (t || '').slice(0, 120));
        });
      }
      return res.json();
    }).then(function(json) {
      return (json && json.text) || '';
    });
  }

  var api = {
    OPENAI_VOICES: OPENAI_VOICES,
    onStateChange: null,
    ttsSupported: ttsSupported,
    getVoices: getVoices,
    speak: speak,
    stopSpeak: stopSpeak,
    isSpeaking: isSpeaking,
    recogEngine: recogEngine,
    startRecog: startRecog,
    stopRecog: stopRecog,
    isRecognizing: isRecognizing
  };
  return api;
})();
