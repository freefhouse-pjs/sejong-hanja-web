/* =========================================================
 * 세종 한자 공부 — 아이패드(iOS 12 이상)용 웹앱
 * Flutter 안드로이드 앱(sejong_hanja)과 같은 기능 · 같은 Firestore 기록을 사용합니다.
 * iOS 12 Safari 에서 동작하도록 ES2017 문법까지만 사용했습니다.
 * ========================================================= */
(function () {
  'use strict';

  // ───────────────────────── 데이터 ─────────────────────────
  var LEVELS = [8, 7, 6, 5];
  var CATEGORIES = ['훈음읽기', '한자읽기', '한자찾기'];
  var PER_STAGE = { 8: 10, 7: 15, 6: 15, 5: 20 };
  var CATEGORY_STAGES = {
    8: { '훈음읽기': 5, '한자읽기': 3, '한자찾기': 3 },
    7: { '훈음읽기': 7, '한자읽기': 3, '한자찾기': 3 },
    6: { '훈음읽기': 10, '한자읽기': 3, '한자찾기': 3 },
    5: { '훈음읽기': 10, '한자읽기': 3, '한자찾기': 3 }
  };
  function toChar(a) { return { hanja: a[0], eum: a[1], hun: a[2], strokes: a[3] }; }
  function toWord(a) { return { word: a[0], reading: a[1], meaning: a[2] }; }
  var CHARS = {}, WORDS = {};
  LEVELS.forEach(function (lv) {
    CHARS[lv] = (HANJA_DATA.chars[lv] || []).map(toChar);
    WORDS[lv] = (HANJA_DATA.words[lv] || []).map(toWord);
  });
  var FOUR = HANJA_DATA.four.map(toWord);
  var THREE = HANJA_DATA.three.map(toWord);

  function getChars(lv) { return CHARS[lv] || []; }
  function getWords(lv) { return WORDS[lv] || []; }
  function getPerStage(lv) { return PER_STAGE[lv] || 10; }
  function totalStages(lv, c) { return (CATEGORY_STAGES[lv] && CATEGORY_STAGES[lv][c]) || 0; }
  function stageHanja(lv, stage) {
    var all = getChars(lv), per = getPerStage(lv), start = (stage - 1) * per;
    if (start >= all.length || start < 0) return [];
    return all.slice(start, Math.min(start + per, all.length));
  }

  // ───────────────────────── 유틸 ─────────────────────────
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function uniq(arr) {
    var seen = {}, out = [];
    arr.forEach(function (x) { if (!seen.hasOwnProperty(x)) { seen[x] = 1; out.push(x); } });
    return out;
  }
  function withDistractors(answer, pool) {
    var others = shuffle(uniq(pool.filter(function (p) { return p !== answer; })));
    return shuffle([answer].concat(others.slice(0, 3)));
  }
  function poolFor(w, levelWords) {
    if (w.word.length === 4) return FOUR;
    if (w.word.length === 3) return THREE;
    return levelWords;
  }

  /** h('div', {class:'a', onclick: fn}, [child, 'text']) */
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach(function (s) { el.style[s] = v[s]; });
        else if (k === 'value') el.value = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      });
    }
    append(el, children);
    return el;
  }
  function append(el, children) {
    if (children === null || children === undefined || children === false) return;
    if (!Array.isArray(children)) children = [children];
    children.forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) append(el, c);
      else if (typeof c === 'string' || typeof c === 'number') el.appendChild(document.createTextNode(String(c)));
      else el.appendChild(c);
    });
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ''; }, 2500);
  }

  /** 대화상자. buttons: [{label, color, onClick}] — onClick 은 닫힌 뒤 실행 */
  function showDialog(opt) {
    var back = h('div', { class: 'dlgBack' });
    function close() { if (back.parentNode) back.parentNode.removeChild(back); }
    var btns = (opt.buttons || []).map(function (b) {
      return h('button', {
        class: b.color ? 'pri' : '',
        style: b.color ? { background: b.color } : null,
        onclick: function () { close(); if (b.onClick) b.onClick(); }
      }, b.label);
    });
    var dlg = h('div', { class: 'dlg' }, [
      opt.title ? h('h3', { style: opt.titleColor ? { color: opt.titleColor } : null }, opt.title) : null,
      h('div', { class: 'dlgBody' }, opt.body),
      btns.length ? h('div', { class: 'dlgBtns' }, btns) : null
    ]);
    back.appendChild(dlg);
    if (opt.dismissible) back.addEventListener('click', function (e) { if (e.target === back) close(); });
    document.body.appendChild(back);
    return close;
  }
  function confirmDialog(title, message, okLabel, cancelLabel) {
    return new Promise(function (resolve) {
      showDialog({
        title: title, body: message,
        buttons: [
          { label: cancelLabel || '취소', onClick: function () { resolve(false); } },
          { label: okLabel || '확인', color: '#1A237E', onClick: function () { resolve(true); } }
        ]
      });
    });
  }
  function resultBody(passed, correct, total) {
    var rate = total ? Math.round(correct / total * 100) : 0;
    return [
      h('div', { class: 'bigIcon' }, passed ? '🏆' : '😢'),
      h('div', { style: { fontSize: '20px', fontWeight: '700', color: passed ? '#2e7d32' : '#c62828', margin: '8px 0' } },
        passed ? '통과입니다.' : '재도전하세요.'),
      h('div', { style: { fontSize: '18px', fontWeight: '700' } }, '정답: ' + correct + ' / ' + total),
      h('div', null, '정답률: ' + rate + '%')
    ];
  }

  // ───────────────────────── 소리 ─────────────────────────
  // iOS 는 화면을 터치한 뒤에만 소리를 낼 수 있어 첫 터치 때 소리 장치를 깨웁니다.
  var Audio2 = (function () {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    var ctx = null, buffers = {}, bgmNode = null, bgmGain = null;
    var fallback = {};
    var musicOn = false, wantBgm = false;

    function load(name) {
      if (!ctx) return;
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'audio/' + name, true);
      xhr.responseType = 'arraybuffer';
      xhr.onload = function () {
        if (xhr.status !== 200 && xhr.status !== 0) return;
        try {
          ctx.decodeAudioData(xhr.response, function (buf) {
            buffers[name] = buf;
            if (name === 'backmusic.mp3' && wantBgm) startBgm();
          }, function () {});
        } catch (e) {}
      };
      xhr.send();
    }
    function init() {
      if (Ctx) {
        try { ctx = new Ctx(); } catch (e) { ctx = null; }
      }
      if (ctx) {
        ['good.mp3', 'bad.mp3', 'backmusic.mp3'].forEach(load);
      } else {
        ['good.mp3', 'bad.mp3', 'backmusic.mp3'].forEach(function (n) {
          var a = new window.Audio('audio/' + n); a.preload = 'auto'; fallback[n] = a;
        });
        fallback['backmusic.mp3'].loop = true;
      }
      var unlock = function () {
        if (ctx && ctx.state === 'suspended' && ctx.resume) ctx.resume();
        if (ctx) { // 무음 버퍼 한 번 재생 (iOS 잠금 해제)
          try { var b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) {}
        }
      };
      document.addEventListener('touchend', unlock, true);
      document.addEventListener('click', unlock, true);
    }
    function play(name) {
      if (ctx) {
        if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
        var buf = buffers[name]; if (!buf) return;
        try { var s = ctx.createBufferSource(); s.buffer = buf; s.connect(ctx.destination); s.start(0); } catch (e) {}
      } else if (fallback[name]) {
        try { fallback[name].currentTime = 0; var p = fallback[name].play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
      }
    }
    function startBgm() {
      if (ctx) {
        if (bgmNode) return;
        var buf = buffers['backmusic.mp3'];
        if (!buf) return; // 다 받아지면 load() 에서 시작
        if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
        try {
          bgmGain = ctx.createGain(); bgmGain.gain.value = 0.6; bgmGain.connect(ctx.destination);
          bgmNode = ctx.createBufferSource(); bgmNode.buffer = buf; bgmNode.loop = true; bgmNode.connect(bgmGain); bgmNode.start(0);
        } catch (e) { bgmNode = null; }
      } else if (fallback['backmusic.mp3']) {
        var p = fallback['backmusic.mp3'].play(); if (p && p.catch) p.catch(function () {});
      }
    }
    function stopBgm() {
      wantBgm = false;
      if (bgmNode) { try { bgmNode.stop(0); } catch (e) {} bgmNode = null; }
      if (fallback['backmusic.mp3']) fallback['backmusic.mp3'].pause();
    }
    return {
      init: init,
      good: function () { play('good.mp3'); },
      bad: function () { play('bad.mp3'); },
      isMusicOn: function () { return musicOn; },
      toggleMusic: function () {
        musicOn = !musicOn;
        if (musicOn) { wantBgm = true; startBgm(); } else stopBgm();
        return musicOn;
      },
      stopMusic: function () { musicOn = false; stopBgm(); }
    };
  })();

  // ───────────────────────── Firestore (REST) ─────────────────────────
  // 안드로이드 앱과 같은 구조:
  //  students/{학년}/{반}/{번호_이름}            : grade, classNum, number, name, kingScores
  //  students/{학년}/{반}/{번호_이름}/levels/{급} : stageResults, totalPoints, status
  var FS = (function () {
    var BASE = 'https://firestore.googleapis.com/v1/projects/' + CONFIG.projectId + '/databases/(default)/documents';
    var useKey = false; // 먼저 키 없이 시도, 거절되면 API 키를 붙여 다시 시도

    function enc(v) {
      if (v === null || v === undefined) return { nullValue: null };
      if (typeof v === 'boolean') return { booleanValue: v };
      if (typeof v === 'number') return (Math.floor(v) === v) ? { integerValue: String(v) } : { doubleValue: v };
      if (typeof v === 'string') return { stringValue: v };
      if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
      return { mapValue: { fields: encFields(v) } };
    }
    function encFields(obj) {
      var f = {};
      Object.keys(obj).forEach(function (k) { f[k] = enc(obj[k]); });
      return f;
    }
    function dec(v) {
      if (!v) return null;
      if (v.hasOwnProperty('stringValue')) return v.stringValue;
      if (v.hasOwnProperty('integerValue')) return parseInt(v.integerValue, 10);
      if (v.hasOwnProperty('doubleValue')) return Number(v.doubleValue);
      if (v.hasOwnProperty('booleanValue')) return v.booleanValue;
      if (v.hasOwnProperty('nullValue')) return null;
      if (v.hasOwnProperty('timestampValue')) return v.timestampValue;
      if (v.hasOwnProperty('arrayValue')) return (v.arrayValue.values || []).map(dec);
      if (v.hasOwnProperty('mapValue')) return decFields(v.mapValue.fields || {});
      if (v.hasOwnProperty('referenceValue')) return v.referenceValue;
      return null;
    }
    function decFields(fields) {
      var o = {};
      Object.keys(fields || {}).forEach(function (k) { o[k] = dec(fields[k]); });
      return o;
    }
    function urlOf(segs, query) {
      var url = BASE + '/' + segs.map(function (s) { return encodeURIComponent(String(s)); }).join('/');
      var q = (query || []).slice();
      if (useKey && CONFIG.apiKey) q.push('key=' + encodeURIComponent(CONFIG.apiKey));
      return url + (q.length ? '?' + q.join('&') : '');
    }
    function withTimeout(p, ms) {
      return Promise.race([p, new Promise(function (_, rej) {
        setTimeout(function () { rej(new Error('시간 초과 — 인터넷 연결을 확인해 주세요.')); }, ms);
      })]);
    }
    async function req(method, segs, query, body, allow404) {
      var opts = { method: method, headers: {} };
      if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
      var res = await withTimeout(fetch(urlOf(segs, query), opts), 20000);
      if ((res.status === 401 || res.status === 403) && !useKey && CONFIG.apiKey) {
        useKey = true;
        res = await withTimeout(fetch(urlOf(segs, query), opts), 20000);
      }
      if (res.status === 404 && allow404) return null;
      if (!res.ok) {
        var txt = '';
        try { txt = await res.text(); } catch (e) {}
        throw new Error('서버 오류 ' + res.status + ' ' + txt.slice(0, 200));
      }
      return res.json();
    }
    function idOf(name) {
      var parts = String(name).split('/');
      var last = parts[parts.length - 1];
      try { return decodeURIComponent(last); } catch (e) { return last; }
    }
    return {
      /** 문서 읽기. 없으면 null */
      get: async function (segs) {
        var d = await req('GET', segs, null, null, true);
        return d ? decFields(d.fields) : null;
      },
      /** 문서 전체 쓰기 (덮어쓰기) */
      set: function (segs, obj) {
        return req('PATCH', segs, null, { fields: encFields(obj) });
      },
      /** 지정한 최상위 필드만 바꾸기 (나머지 필드는 그대로) */
      update: function (segs, obj) {
        var q = Object.keys(obj).map(function (k) { return 'updateMask.fieldPaths=' + encodeURIComponent(k); });
        return req('PATCH', segs, q, { fields: encFields(obj) });
      },
      /** 컬렉션의 문서 목록 [{id, data}] */
      list: async function (segs) {
        var out = [], token = null, guard = 0;
        do {
          var q = ['pageSize=300'];
          if (token) q.push('pageToken=' + encodeURIComponent(token));
          var d = await req('GET', segs, q, null, true);
          if (!d) break;
          (d.documents || []).forEach(function (doc) { out.push({ id: idOf(doc.name), data: decFields(doc.fields) }); });
          token = d.nextPageToken;
        } while (token && ++guard < 50);
        return out;
      }
    };
  })();

  // ───────────────────────── 학생 기록 ─────────────────────────
  function newLevelData() {
    return { stageResults: { '훈음읽기': [], '한자읽기': [], '한자찾기': [] }, totalPoints: 0, status: '미통과' };
  }
  function parseLevelData(map) {
    var raw = map && map.stageResults, results = {};
    if (raw && typeof raw === 'object') {
      Object.keys(raw).forEach(function (k) {
        if (Array.isArray(raw[k])) results[k] = raw[k].map(function (e) { return e === true; });
      });
    }
    CATEGORIES.forEach(function (c) { if (!results[c]) results[c] = []; });
    var tp = map && map.totalPoints;
    return {
      stageResults: results,
      totalPoints: typeof tp === 'number' ? Math.floor(tp) : 0,
      status: (map && typeof map.status === 'string') ? map.status : '미통과'
    };
  }
  function parseKingScores(raw) {
    var r = { '5': 0, '6': 0, '7': 0, '8': 0 };
    if (raw && typeof raw === 'object') {
      ['5', '6', '7', '8'].forEach(function (k) {
        var v = raw[k];
        if (typeof v === 'number') r[k] = Math.floor(v);
        else if (v !== null && v !== undefined) r[k] = parseInt(v, 10) || 0;
      });
    }
    return r;
  }
  function passedStages(ld, c) { return (ld.stageResults[c] || []).filter(function (b) { return b; }).length; }
  function isStagePassed(ld, c, stage) { var l = ld.stageResults[c] || []; return stage >= 1 && stage <= l.length && l[stage - 1]; }
  function curLevelData(s) {
    if (!s.levels[s.currentLevel]) s.levels[s.currentLevel] = newLevelData();
    return s.levels[s.currentLevel];
  }
  function allCategoriesComplete(s) {
    var ld = curLevelData(s);
    for (var i = 0; i < CATEGORIES.length; i++) {
      if (passedStages(ld, CATEGORIES[i]) < totalStages(s.currentLevel, CATEGORIES[i])) return false;
    }
    return true;
  }
  function studentPath(grade, classNum, docId) { return ['students', grade, classNum, docId]; }
  function levelPath(s, lv) { return studentPath(s.grade, s.classNum, s.docId).concat(['levels', String(lv)]); }

  var Service = {
    getOrCreateStudent: async function (grade, classNum, number, name, level) {
      var docId = number + '_' + name;
      var path = studentPath(grade, classNum, docId);
      var data = await FS.get(path);
      if (!data) {
        var kings = { '5': 0, '6': 0, '7': 0, '8': 0 };
        await FS.set(path, { grade: grade, classNum: classNum, number: number, name: name, kingScores: kings });
        var levels0 = {};
        for (var i = 0; i < 4; i++) {
          var lv0 = [5, 6, 7, 8][i];
          await FS.set(path.concat(['levels', String(lv0)]), newLevelData());
          levels0[lv0] = newLevelData();
        }
        return { grade: grade, classNum: classNum, number: number, name: name, docId: docId, currentLevel: level, levels: levels0, kingScores: kings };
      }
      var lvPath = path.concat(['levels', String(level)]);
      var lvData = await FS.get(lvPath);
      if (!lvData) await FS.set(lvPath, newLevelData());
      var docs = await FS.list(path.concat(['levels']));
      var levels = {};
      docs.forEach(function (d) { var lv = parseInt(d.id, 10); if (!isNaN(lv)) levels[lv] = parseLevelData(d.data); });
      LEVELS.forEach(function (lv) { if (!levels[lv]) levels[lv] = newLevelData(); });
      return {
        grade: String(data.grade !== undefined && data.grade !== null ? data.grade : grade),
        classNum: String(data.classNum !== undefined && data.classNum !== null ? data.classNum : classNum),
        number: String(data.number !== undefined && data.number !== null ? data.number : number),
        name: String(data.name !== undefined && data.name !== null ? data.name : name),
        docId: docId, currentLevel: level, levels: levels, kingScores: parseKingScores(data.kingScores)
      };
    },
    /** 단계 통과 기록. 이미 통과한 단계면 점수를 다시 더하지 않습니다. */
    updateScore: async function (s, category, stage, points) {
      var path = levelPath(s, s.currentLevel);
      var data = await FS.get(path);
      if (!data) return;
      var raw = (data.stageResults && typeof data.stageResults === 'object') ? data.stageResults : {};
      var list = Array.isArray(raw[category]) ? raw[category].map(function (e) { return e === true; }) : [];
      while (list.length < stage) list.push(false);
      if (list[stage - 1]) return;
      list[stage - 1] = true;
      var newTotal = (typeof data.totalPoints === 'number' ? Math.floor(data.totalPoints) : 0) + points;
      var newResults = {};
      Object.keys(raw).forEach(function (k) { newResults[k] = raw[k]; });
      newResults[category] = list;
      await FS.update(path, { stageResults: newResults, totalPoints: newTotal });
      var ld = curLevelData(s);
      ld.stageResults[category] = list;
      ld.totalPoints = newTotal;
    },
    updateStatus: async function (s) {
      await FS.update(levelPath(s, s.currentLevel), { status: '통과' });
      curLevelData(s).status = '통과';
    },
    updateKingScore: async function (s, level, score) {
      var path = studentPath(s.grade, s.classNum, s.docId);
      // 다른 기기에서 바뀐 기록을 지우지 않도록 최신 값을 읽어 합칩니다.
      var cur = await FS.get(path);
      var kings = parseKingScores(cur && cur.kingScores);
      kings[String(level)] = score;
      await FS.update(path, { kingScores: kings });
    },
    getClassStudents: async function (grade, classNum) {
      var docs = await FS.list(['students', grade, classNum]);
      docs = docs.filter(function (d) { return d.data.name !== '교사용'; });
      var result = await Promise.all(docs.map(async function (d) {
        var lv = await FS.list(['students', grade, classNum, d.id, 'levels']);
        var levels = {};
        lv.forEach(function (l) { levels[l.id] = l.data; });
        var o = {};
        Object.keys(d.data).forEach(function (k) { o[k] = d.data[k]; });
        o.levels = levels;
        return o;
      }));
      result.sort(function (a, b) { return (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0); });
      return result;
    }
  };

  // ───────────────────────── 로그인 정보 저장 ─────────────────────────
  var LoginStorage = {
    load: function () {
      try {
        if (localStorage.getItem('login_remember') !== '1') return null;
        return {
          grade: localStorage.getItem('login_grade') || '',
          classNum: localStorage.getItem('login_class') || '',
          number: localStorage.getItem('login_number') || '',
          name: localStorage.getItem('login_name') || '',
          level: parseInt(localStorage.getItem('login_level'), 10) || 8
        };
      } catch (e) { return null; }
    },
    save: function (i) {
      try {
        localStorage.setItem('login_remember', '1');
        localStorage.setItem('login_grade', i.grade);
        localStorage.setItem('login_class', i.classNum);
        localStorage.setItem('login_number', i.number);
        localStorage.setItem('login_name', i.name);
        localStorage.setItem('login_level', String(i.level));
      } catch (e) {}
    },
    clear: function () {
      try {
        ['login_remember', 'login_grade', 'login_class', 'login_number', 'login_name', 'login_level']
          .forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) {}
    }
  };

  // ───────────────────────── 화면 이동 ─────────────────────────
  var App = { student: null, isTeacher: false };
  var stack = [];
  var root = null;

  function showTop() {
    clear(root);
    var top = stack[stack.length - 1];
    if (!top) return;
    root.appendChild(top.el);
    if (top.onShow) top.onShow();
  }
  function push(screen) { stack.push(screen); showTop(); }
  function pop() { var s = stack.pop(); if (s && s.onLeave) s.onLeave(); showTop(); }
  function replaceAll(screen) {
    stack.forEach(function (s) { if (s.onLeave) s.onLeave(); });
    stack = [screen]; showTop();
  }

  /** 공통 화면 틀: 위쪽 색 막대 + 본문 */
  function frame(opts) {
    var titleEl = h('div', { class: 'title' }, opts.title || '');
    var actions = h('div', { class: 'row', style: { alignItems: 'center' } });
    var bar = h('div', { class: 'bar', style: { background: opts.color || '#1A237E' } }, [
      opts.back === false ? null : h('button', { class: 'ibtn', 'aria-label': '뒤로', onclick: opts.onBack || pop }, '←'),
      titleEl, actions
    ]);
    var body = h('div', { class: 'body' + (opts.bodyClass ? ' ' + opts.bodyClass : '') });
    var el = h('div', { class: 'screen' }, [bar, body]);
    return { el: el, bar: bar, titleEl: titleEl, actions: actions, body: body };
  }
  function progressBar(value, color) {
    return h('div', { class: 'progress' }, h('div', { style: { width: Math.round(value * 100) + '%', background: color } }));
  }
  function optionButtons(options, answerIndex, selected, onPick) {
    return options.map(function (text, i) {
      var cls = 'opt', mark = null;
      if (selected !== null) {
        if (i === answerIndex) { cls += ' right'; mark = 'O'; }
        else if (i === selected) { cls += ' wrong'; mark = 'X'; }
      }
      return h('button', { class: cls, onclick: function () { onPick(i); } }, [text, mark ? h('span', { class: 'mark' }, mark) : null]);
    });
  }

  // ───────────────────────── 로그인 화면 ─────────────────────────
  function LoginScreen() {
    var grades = ['1', '2', '3', '4', '5', '6'];
    var classes = CONFIG.classes || ['믿음', '사랑'];
    var saved = LoginStorage.load();
    var busy = false;

    function select(id, items, labelFn, value, placeholder) {
      var opts = [];
      if (placeholder) opts.push(h('option', { value: '' }, placeholder));
      items.forEach(function (it) {
        var o = h('option', { value: String(it) }, labelFn(it));
        if (String(it) === String(value)) o.selected = true;
        opts.push(o);
      });
      return h('div', { class: 'selWrap' }, h('select', { id: id }, opts));
    }
    var gradeSel = select('lg', grades, function (g) { return g + '학년'; }, saved && grades.indexOf(saved.grade) >= 0 ? saved.grade : '', '학년 선택');
    var classSel = select('lc', classes, function (c) { return c + '반'; }, saved && classes.indexOf(saved.classNum) >= 0 ? saved.classNum : '', '반 선택');
    var numInput = h('input', { type: 'text', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'off', placeholder: '번호', value: saved ? saved.number : '' });
    var nameInput = h('input', { type: 'text', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: '한글 입력', value: saved ? saved.name : '' });
    var levelSel = select('ll', LEVELS, function (l) { return l + '급'; }, saved && LEVELS.indexOf(saved.level) >= 0 ? saved.level : 8, null);
    var remember = h('input', { type: 'checkbox' }); remember.checked = true;
    var startBtn = h('button', { class: 'btn', type: 'submit' }, '시작하기');

    numInput.addEventListener('input', function () {
      var v = numInput.value.replace(/[^0-9]/g, '');
      if (v !== numInput.value) numInput.value = v;
    });

    async function login(e) {
      if (e) e.preventDefault();
      if (busy) return;
      var grade = gradeSel.firstChild.value, classNum = classSel.firstChild.value;
      var number = numInput.value.trim(), name = nameInput.value.trim();
      var level = parseInt(levelSel.firstChild.value, 10) || 8;
      if (!grade || !classNum || !number || !name) { toast('모든 항목을 입력해주세요.'); return; }
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      busy = true; startBtn.disabled = true; clear(startBtn); startBtn.appendChild(h('span', { class: 'spinner' }));
      var ok = true;
      try {
        if (name === '교사용') {
          App.isTeacher = true;
          App.student = { grade: grade, classNum: classNum, number: '0', name: '교사용', docId: '0_교사용', currentLevel: level, levels: {}, kingScores: parseKingScores(null) };
        } else {
          App.student = await Service.getOrCreateStudent(grade, classNum, number, name, level);
          App.isTeacher = false;
        }
      } catch (err) {
        ok = false;
        if (window.console) console.error('로그인 실패', err);
      }
      busy = false; startBtn.disabled = false; clear(startBtn); startBtn.appendChild(document.createTextNode('시작하기'));
      if (!ok) { toast('로그인에 실패했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.'); return; }
      if (remember.checked) LoginStorage.save({ grade: grade, classNum: classNum, number: number, name: name, level: level });
      else LoginStorage.clear();
      replaceAll(App.isTeacher ? AdminScreen() : MainScreen());
    }

    var form = h('form', { onsubmit: login, autocomplete: 'off' }, [
      h('label', { class: 'field' }, [h('span', { class: 'lab' }, '🏫 학년'), gradeSel]),
      h('label', { class: 'field' }, [h('span', { class: 'lab' }, '👥 반'), classSel]),
      h('label', { class: 'field' }, [h('span', { class: 'lab' }, '# 번호'), numInput]),
      h('label', { class: 'field' }, [h('span', { class: 'lab' }, '🙂 이름'), nameInput]),
      h('label', { class: 'field' }, [h('span', { class: 'lab' }, '🏅 급수'), levelSel]),
      h('label', { class: 'check' }, [remember, h('span', null, ['로그인 정보 저장', h('small', null, '다음에 앱을 열면 자동으로 채워집니다')])]),
      startBtn
    ]);
    var el = h('div', { class: 'screen loginBg' }, h('div', { class: 'body' }, h('div', { class: 'loginBox' }, [
      h('img', { class: 'logo', src: 'img/stitle2.png', alt: '세종 한자 공부' }),
      h('div', { class: 'card' }, [h('h2', null, '로그인'), form])
    ])));
    return { el: el };
  }

  // ───────────────────────── 메인 메뉴 ─────────────────────────
  function MainScreen() {
    var f = frame({ back: false, title: '' });
    var musicBtn = h('button', { class: 'ibtn', 'aria-label': '음악', onclick: function () { Audio2.toggleMusic(); updateMusic(); } });
    function updateMusic() { musicBtn.textContent = Audio2.isMusicOn() ? '🎵' : '🔇'; }
    var logoutBtn = h('button', { class: 'tbtn', style: { color: '#1A237E' }, 'aria-label': '로그아웃', onclick: async function () {
      var ok = await confirmDialog('로그아웃', '로그인 화면으로 나갑니다');
      if (!ok) return;
      Audio2.stopMusic();
      App.student = null; App.isTeacher = false;
      replaceAll(LoginScreen());
    } }, '로그아웃');
    append(f.actions, [musicBtn, logoutBtn]);
    f.body.className = 'body mainBg';
    function menu(label, icon, color, make) {
      return h('button', { class: 'menuBtn', style: { background: color }, onclick: function () { push(make()); } },
        [h('span', { class: 'ic' }, icon), label]);
    }
    append(f.body, h('div', { class: 'wrap', style: { paddingTop: '30px' } }, [
      h('img', { class: 'logo', src: 'img/stitle2.png', alt: '세종 한자 공부' }),
      menu('훈음읽기', '📖', 'rgba(66,165,245,.75)', HuneumScreen),
      menu('한자쓰기', '✏️', 'rgba(102,187,106,.75)', WritingScreen),
      menu('한자읽기', '🗣️', 'rgba(255,138,101,.8)', ReadingQuizScreen),
      menu('한자퀴즈', '❓', 'rgba(171,71,188,.75)', HanjaQuizScreen),
      menu('내 점수 보기', '🏆', 'rgba(38,166,154,.8)', ScoreScreen)
    ]));
    function onShow() {
      var s = App.student;
      f.titleEl.textContent = s ? (s.grade + '학년 ' + s.classNum + '반 ' + s.number + '번 ' + s.name + '  < ' + s.currentLevel + '급 >') : '세종 한자 공부';
      updateMusic();
    }
    return { el: f.el, onShow: onShow };
  }

  // ───────────────────────── 훈음읽기 ─────────────────────────
  function HuneumScreen() {
    var BLUE = '#1565C0', PAGE = 15;
    var level = App.student.currentLevel, all = getChars(level);
    var totalPages = all.length ? Math.floor((all.length - 1) / PAGE) + 1 : 1;
    var page = 0;
    var f = frame({ title: '훈음읽기 (' + level + '급)', color: BLUE });
    append(f.actions, h('button', { class: 'tbtn', style: { color: BLUE }, onclick: function () { push(HuneumQuizScreen()); } }, '❓ 퀴즈'));

    function detail(c) {
      function row(l, v) { return h('div', { class: 'drow' }, [h('span', null, l), h('b', null, v)]); }
      showDialog({
        dismissible: true,
        body: [h('div', { class: 'detailHz' }, c.hanja), row('독음', c.hun + ' ' + c.eum), row('훈', c.hun), row('음', c.eum), row('획수', c.strokes + '획')],
        buttons: [{ label: '닫기' }]
      });
    }
    function render() {
      clear(f.body);
      var items = all.slice(page * PAGE, page * PAGE + PAGE);
      append(f.body, h('div', { style: { maxWidth: '560px', margin: '0 auto' } }, [
        h('div', { class: 'pager' }, [
          h('button', { disabled: page <= 0, onclick: function () { page--; render(); } }, '‹'),
          h('span', null, (page + 1) + ' / ' + totalPages + ' 페이지'),
          h('button', { disabled: page >= totalPages - 1, onclick: function () { page++; render(); } }, '›')
        ]),
        h('div', { class: 'grid5' }, items.map(function (c) {
          return h('div', { class: 'hcell' }, h('button', { onclick: function () { detail(c); } }, [
            h('span', { class: 'hz' }, c.hanja), h('span', { class: 'hs' }, c.hun + ' ' + c.eum)
          ]));
        }))
      ]));
      f.body.scrollTop = 0;
    }
    render();
    return { el: f.el };
  }

  // ───────────────────────── 훈음읽기 퀴즈 (직접 입력) ─────────────────────────
  function HuneumQuizScreen() {
    var BLUE = '#1565C0', CAT = '훈음읽기';
    var s = App.student, level = s.currentLevel, total = totalStages(level, CAT);
    var passedCount = passedStages(curLevelData(s), CAT);
    var stage = passedCount >= total ? 1 : passedCount + 1;
    var questions = [], index = 0, correct = 0, answered = false, lastCorrect = null, saving = false;
    var f = frame({ title: '', color: BLUE });
    var hunInput, eumInput;

    function generate() {
      var stageItems = stageHanja(level, stage), per = getPerStage(level);
      var qs = stageItems.slice();
      if (qs.length < per) {
        var others = shuffle(getChars(level).filter(function (c) { return stageItems.indexOf(c) < 0; }));
        qs = qs.concat(others.slice(0, per - qs.length));
      }
      questions = shuffle(qs); index = 0; correct = 0; answered = false; lastCorrect = null;
      render();
    }
    function check() {
      if (answered || !questions.length) return;
      var hun = hunInput.value.trim(), eum = eumInput.value.trim();
      if (!hun || !eum) { toast('훈과 음을 모두 입력하세요.'); return; }
      var q = questions[index];
      var ok = hun === q.hun && eum === q.eum;
      answered = true; lastCorrect = ok; if (ok) correct++;
      if (ok) Audio2.good(); else Audio2.bad();
      render();
    }
    function next() {
      if (!answered) return;
      if (index < questions.length - 1) {
        index++; answered = false; lastCorrect = null; render();
        hunInput.focus(); // 터치한 순간에 바로 포커스 (iOS 키보드 유지)
      } else finish();
    }
    async function finish() {
      var passed = correct / questions.length >= 0.7;
      if (passed) {
        saving = true; render();
        try {
          await Service.updateScore(s, CAT, stage, correct);
          if (allCategoriesComplete(s) && curLevelData(s).status !== '통과') {
            await Service.updateStatus(s);
            saving = false; render();
            congrats(); return;
          }
        } catch (e) {
          if (window.console) console.error('점수 저장 실패', e);
          toast('점수를 저장하지 못했습니다. 인터넷 연결을 확인하세요.');
        }
        saving = false; render();
      }
      stageResult(passed);
    }
    function stageResult(passed) {
      var hasNext = passed && stage < total;
      var buttons = [];
      if (!passed) buttons.push({ label: '다시 도전', color: BLUE, onClick: generate });
      if (hasNext) buttons.push({ label: '다음 단계', color: BLUE, onClick: function () { stage++; generate(); } });
      buttons.push({ label: '나가기', onClick: pop });
      showDialog({ title: passed ? '단계 통과!' : '아쉽습니다', titleColor: passed ? '#2e7d32' : '#c62828', body: resultBody(passed, correct, questions.length), buttons: buttons });
    }
    function congrats() {
      showDialog({
        title: '축하합니다!',
        body: [h('div', { class: 'bigIcon' }, '🏆'), h('div', { style: { fontSize: '18px', marginTop: '8px' } }, level + '급의 모든 단계를 통과했습니다!')],
        buttons: [{ label: '메인으로', color: '#FFB300', onClick: pop }]
      });
    }
    function render() {
      f.titleEl.textContent = '훈음읽기 퀴즈 (' + level + '급) - ' + stage + '/' + total + '단계';
      var keepHun = hunInput ? hunInput.value : '', keepEum = eumInput ? eumInput.value : '';
      var fresh = !answered && lastCorrect === null;
      clear(f.body);
      if (!questions.length) { append(f.body, h('div', { class: 'loading' }, h('span', { class: 'spinner' }))); return; }
      var q = questions[index];
      hunInput = h('input', { class: 'tinput', type: 'text', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', disabled: answered, enterkeyhint: 'next' });
      eumInput = h('input', { class: 'tinput', type: 'text', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', disabled: answered, enterkeyhint: 'done' });
      if (!fresh) { hunInput.value = keepHun; eumInput.value = keepEum; }
      hunInput.addEventListener('keydown', function (e) { if (e.keyCode === 13) { e.preventDefault(); eumInput.focus(); } });
      eumInput.addEventListener('keydown', function (e) { if (e.keyCode === 13) { e.preventDefault(); check(); } });
      var label = saving ? h('span', { class: 'spinner' }) : (!answered ? '확인' : (index < questions.length - 1 ? '다음' : '결과 보기'));
      append(f.body, h('div', { class: 'wrap' }, [
        progressBar((index + 1) / questions.length, BLUE),
        h('div', { class: 'center muted mt8' }, (index + 1) + ' / ' + questions.length),
        h('div', { class: 'qcard mt16', style: { height: '190px', lineHeight: '150px' } }, h('span', { class: 'big', style: { fontSize: '120px' } }, q.hanja)),
        h('div', { class: 'center mt16', style: { fontSize: '17px' } }, '이 한자의 훈과 음을 입력하세요'),
        h('div', { class: 'mt12' }, lastCorrect === null ? null :
          h('div', { class: 'feedback ' + (lastCorrect ? 'ok' : 'ng') }, lastCorrect ? '✅ 정답입니다!' : '❌ 오답! 정답: ' + q.hun + ' ' + q.eum)),
        h('div', { class: 'row' }, [
          h('label', { class: 'grow' }, [h('span', { class: 'tlabel' }, '훈 (뜻)'), hunInput]),
          h('label', { class: 'grow' }, [h('span', { class: 'tlabel' }, '음 (소리)'), eumInput])
        ]),
        h('button', { class: 'btn mt16', style: { background: BLUE }, disabled: saving, onclick: function () { if (answered) next(); else check(); } }, label),
        h('div', { style: { height: '300px' } }) // 키보드가 올라와도 버튼이 보이도록 여유
      ]));
    }
    generate();
    return { el: f.el };
  }

  // ───────────────────────── 한자쓰기 ─────────────────────────
  function WritingScreen() {
    var GREEN = '#2E7D32';
    var level = App.student.currentLevel, list = getChars(level);
    var index = 0, strokes = [];
    var f = frame({ title: '한자쓰기 (' + level + '급)', color: GREEN });
    f.body.style.overflow = 'hidden';
    var head = h('div', { class: 'writeTop' });
    var prevB = h('button', { onclick: function () { if (index > 0) { index--; strokes = []; update(); } } }, '‹ 이전');
    var clearB = h('button', { onclick: function () { strokes = []; redraw(); } }, '🗑 지우기');
    var nextB = h('button', { onclick: function () { if (index < list.length - 1) { index++; strokes = []; update(); } } }, '다음 ›');
    var btns = h('div', { class: 'writeBtns' }, [prevB, clearB, nextB]);
    var ghost = h('div', { class: 'ghost' });
    var canvas = h('canvas');
    var pad = h('div', { class: 'padBox' }, [h('div', { class: 'guideH' }), h('div', { class: 'guideV' }), ghost, canvas]);
    append(f.body, [head, btns, pad]);
    var ctx = canvas.getContext('2d'), side = 300, ratio = window.devicePixelRatio || 1;

    function layout() {
      var bodyH = f.body.clientHeight, bodyW = f.body.clientWidth;
      if (!bodyH || !bodyW) return;
      var avail = bodyH - head.offsetHeight - btns.offsetHeight - 30;
      side = Math.max(200, Math.min(bodyW - 32, avail, 640));
      pad.style.width = side + 'px'; pad.style.height = side + 'px';
      canvas.width = Math.round(side * ratio); canvas.height = Math.round(side * ratio);
      canvas.style.width = side + 'px'; canvas.style.height = side + 'px';
      ghost.style.fontSize = Math.round(side * 0.82) + 'px';
      ghost.style.lineHeight = side + 'px';
      redraw();
    }
    function redraw() {
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, side, side);
      ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(8, side / 40); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      strokes.forEach(function (s) {
        ctx.beginPath();
        ctx.moveTo(s[0].x, s[0].y);
        if (s.length === 1) ctx.lineTo(s[0].x + 0.1, s[0].y + 0.1);
        for (var i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y);
        ctx.stroke();
      });
    }
    function pos(e) {
      var r = canvas.getBoundingClientRect();
      var t = e.touches ? (e.touches[0] || e.changedTouches[0]) : e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    }
    var drawing = false;
    function start(e) { e.preventDefault(); drawing = true; strokes.push([pos(e)]); redraw(); }
    function move(e) { if (!drawing) return; e.preventDefault(); strokes[strokes.length - 1].push(pos(e)); redraw(); }
    function end() { drawing = false; }
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end); canvas.addEventListener('touchcancel', end);
    canvas.addEventListener('mousedown', start); window.addEventListener('mousemove', move); window.addEventListener('mouseup', end);

    function update() {
      var c = list[index];
      clear(head);
      append(head, [h('h3', null, c.hun + ' ' + c.eum), h('div', { class: 'muted' }, c.strokes + '획   ·   ' + (index + 1) + ' / ' + list.length)]);
      ghost.textContent = c.hanja;
      prevB.disabled = index <= 0; nextB.disabled = index >= list.length - 1;
      redraw();
    }
    var onResize = function () { setTimeout(layout, 300); };
    if (!list.length) { clear(f.body); append(f.body, h('div', { class: 'loading' }, '한자 데이터가 없습니다.')); return { el: f.el }; }
    update();
    return {
      el: f.el,
      onShow: function () { window.addEventListener('resize', onResize); window.addEventListener('orientationchange', onResize); setTimeout(layout, 0); },
      onLeave: function () { window.removeEventListener('resize', onResize); window.removeEventListener('orientationchange', onResize); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', end); }
    };
  }

  // ───────────────────────── 한자읽기 ─────────────────────────
  function ReadingQuizScreen() {
    var ORANGE = '#E64A19';
    var level = App.student.currentLevel, words = getWords(level);
    var index = 0, correct = 0, lastCorrect = null;
    var options = null, answerIndex = null, selected = null, findHanja = false;
    var f = frame({ title: '', color: ORANGE });
    var input;

    function prepare() {
      var w = words[index];
      var pool = w.word.length === 4 ? FOUR : (w.word.length === 3 ? THREE : []);
      selected = null;
      if (!pool.length) { options = null; answerIndex = null; return; }
      findHanja = Math.random() < 0.5;
      var others;
      if (findHanja) {
        others = shuffle(pool.filter(function (p) { return p.word !== w.word; }));
        options = shuffle([w.word].concat(others.slice(0, 3).map(function (p) { return p.word; })));
        answerIndex = options.indexOf(w.word);
      } else {
        others = shuffle(pool.filter(function (p) { return p.reading !== w.reading; }));
        options = shuffle([w.reading].concat(others.slice(0, 3).map(function (p) { return p.reading; })));
        answerIndex = options.indexOf(w.reading);
      }
    }
    function check() {
      if (lastCorrect !== null) return;
      var v = input.value.trim();
      if (!v) return;
      var ok = v === words[index].reading;
      lastCorrect = ok; if (ok) correct++;
      if (ok) Audio2.good(); else Audio2.bad();
      render();
    }
    function pick(i) {
      if (selected !== null) return;
      var ok = i === answerIndex;
      selected = i; lastCorrect = ok; if (ok) correct++;
      if (ok) Audio2.good(); else Audio2.bad();
      render();
    }
    function next() {
      if (index < words.length - 1) { index++; lastCorrect = null; prepare(); render(); }
      else result();
    }
    function prev() { if (index <= 0) return; index--; lastCorrect = null; prepare(); render(); }
    function result() {
      var total = words.length, passed = total > 0 && correct / total >= 0.7;
      showDialog({
        body: resultBody(passed, correct, total),
        buttons: [
          { label: '처음부터 다시', color: ORANGE, onClick: function () { index = 0; correct = 0; lastCorrect = null; prepare(); render(); } },
          { label: '나가기', onClick: pop }
        ]
      });
    }
    function render() {
      f.titleEl.textContent = '한자읽기 (' + level + '급) - ' + (index + 1) + '/' + words.length;
      clear(f.body);
      var w = words[index], isChoice = options !== null;
      var question = isChoice && findHanja ? w.reading : w.word;
      var prompt = isChoice && findHanja ? '다음 한글단어의 한자를 찾으세요' : '다음 한자단어를 읽으세요';
      var isLast = index >= words.length - 1;
      var answerPart;
      if (isChoice) answerPart = optionButtons(options, answerIndex, selected, pick);
      else {
        input = h('input', { class: 'tinput', type: 'text', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: '한글 단어를 입력하세요', disabled: lastCorrect !== null, enterkeyhint: 'done' });
        input.addEventListener('keydown', function (e) { if (e.keyCode === 13) { e.preventDefault(); check(); } });
        answerPart = [input, h('button', { class: 'btn mt12', style: { background: ORANGE }, disabled: lastCorrect !== null, onclick: check }, '확인')];
      }
      append(f.body, h('div', { class: 'wrap' }, [
        progressBar((index + 1) / words.length, ORANGE),
        h('div', { class: 'center mt16', style: { fontSize: '17px' } }, prompt),
        h('div', { class: 'qcard mt12', style: { padding: '28px 12px' } }, [
          h('div', { class: 'big', style: { fontSize: question.length > 3 ? '56px' : '66px' } }, question),
          h('div', { class: 'sub' }, w.meaning)
        ]),
        h('div', { class: 'mt16' }, lastCorrect === null ? null :
          h('div', { class: 'feedback ' + (lastCorrect ? 'ok' : 'ng') }, lastCorrect ? '✅ 정답입니다!' : '❌ 오답! 정답: ' + (isChoice && findHanja ? w.word : w.reading))),
        answerPart,
        h('div', { class: 'row mt20' }, [
          h('button', { class: 'btn light grow', disabled: index <= 0, onclick: prev }, '이전'),
          h('button', { class: 'btn grow', style: { background: ORANGE }, onclick: next }, isLast ? '처음으로' : '다음')
        ]),
        h('div', { style: { height: '300px' } })
      ]));
    }
    if (!words.length) { f.titleEl.textContent = '한자읽기 (' + level + '급)'; append(f.body, h('div', { class: 'loading' }, '단어 데이터가 없습니다.')); return { el: f.el }; }
    prepare(); render();
    return { el: f.el };
  }

  // ───────────────────────── 한자퀴즈 ─────────────────────────
  function HanjaQuizScreen() {
    var TYPE_NAMES = ['훈음읽기', '한자읽기', '한자찾기'];
    var TYPE_COLORS = ['#1E88E5', '#43A047', '#8E24AA'];
    var PURPLE = '#6A1B9A';
    var s = App.student, level = s.currentLevel;
    var type = null, stage = null, items = [], index = 0, score = 0, selected = null, saving = false;
    var f = frame({ title: '한자퀴즈', color: PURPLE, onBack: goBack });

    function goBack() {
      if (stage !== null) { stage = null; items = []; render(); }
      else if (type !== null) { type = null; render(); }
      else pop();
    }
    function stageCount() {
      var per = getPerStage(level);
      var len = type === 0 ? getChars(level).length : getWords(level).length;
      return len ? Math.ceil(len / per) : 0;
    }
    function stageItems(all, st, per) {
      var start = (st - 1) * per;
      if (start >= all.length) return [];
      var its = all.slice(start, Math.min(start + per, all.length));
      if (its.length < per && all.length) {
        var rest = shuffle(all.filter(function (e) { return its.indexOf(e) < 0; }));
        for (var i = 0; i < rest.length && its.length < per; i++) its.push(rest[i]);
        while (its.length < per) its.push(all[Math.floor(Math.random() * all.length)]);
      }
      return its;
    }
    function startQuiz(st) {
      var per = getPerStage(level), out;
      if (type === 0) {
        var chars = getChars(level), pool = chars.map(function (c) { return c.hun + ' ' + c.eum; });
        out = stageItems(chars, st, per).map(function (c) {
          var ans = c.hun + ' ' + c.eum, opts = withDistractors(ans, pool);
          return { q: c.hanja, sub: '', options: opts, answer: opts.indexOf(ans) };
        });
      } else {
        var words = getWords(level);
        out = stageItems(words, st, per).map(function (w) {
          var ans = type === 1 ? w.reading : w.word;
          var pool2 = poolFor(w, words).map(function (p) { return type === 1 ? p.reading : p.word; });
          var opts = withDistractors(ans, pool2);
          return { q: type === 1 ? w.word : w.reading, sub: w.meaning, options: opts, answer: opts.indexOf(ans) };
        });
      }
      stage = st; items = shuffle(out); index = 0; score = 0; selected = null;
      render();
    }
    function pick(i) {
      if (selected !== null) return;
      var ok = i === items[index].answer;
      selected = i; if (ok) score++;
      if (ok) Audio2.good(); else Audio2.bad();
      render();
    }
    function next() {
      if (index < items.length - 1) { index++; selected = null; render(); f.body.scrollTop = 0; }
      else finish();
    }
    async function finish() {
      var passed = items.length > 0 && score / items.length >= 0.7;
      if (passed) {
        saving = true; render();
        try {
          await Service.updateScore(s, TYPE_NAMES[type], stage, score);
          if (allCategoriesComplete(s) && curLevelData(s).status !== '통과') await Service.updateStatus(s);
        } catch (e) {
          if (window.console) console.error('점수 저장 실패', e);
          toast('점수를 저장하지 못했습니다. 인터넷 연결을 확인하세요.');
        }
        saving = false; render();
      }
      showDialog({
        body: resultBody(passed, score, items.length),
        buttons: [
          { label: '다시 도전', onClick: function () { startQuiz(stage || 1); } },
          { label: '단계 선택', color: PURPLE, onClick: function () { stage = null; items = []; render(); } }
        ]
      });
    }
    function typeBtn(t, title, desc, icon) {
      return h('button', { class: 'typeBtn', style: { background: TYPE_COLORS[t] }, onclick: function () { type = t; render(); } }, [
        h('span', { class: 'ic' }, icon), h('span', { class: 'tx' }, [h('b', null, title), h('small', null, desc)]), h('span', { class: 'chev' }, '›')
      ]);
    }
    function render() {
      clear(f.body); clear(f.actions);
      var inQuiz = type !== null && stage !== null;
      f.titleEl.textContent = inQuiz ? TYPE_NAMES[type] + ' ' + stage + '단계' : '한자퀴즈';
      if (inQuiz) append(f.actions, h('span', { class: 'barText' }, '점수: ' + score));
      var inner;
      if (type === null) {
        inner = h('div', { class: 'wrap' }, [
          h('div', { class: 'center', style: { fontSize: '24px', fontWeight: '700', color: PURPLE } }, level + '급 한자퀴즈'),
          h('div', { class: 'center mt8 muted', style: { fontSize: '16px', marginBottom: '20px' } }, '퀴즈 유형을 선택하세요'),
          typeBtn(0, '훈음읽기 퀴즈', '한자를 보고 훈과 음 맞추기', '文'),
          typeBtn(1, '한자읽기 퀴즈', '한자단어를 보고 독음 맞추기', '🗣️'),
          typeBtn(2, '한자찾기 퀴즈', '독음을 보고 한자단어 찾기', '🔍'),
          h('button', { class: 'typeBtn mt12', style: { background: '#FFB300' }, onclick: function () { push(HanjaKingScreen()); } }, [
            h('span', { class: 'ic' }, '👑'), h('span', { class: 'tx' }, [h('b', null, '한자왕'), h('small', null, '급수별 종합 평가 (' + level + '급)')]), h('span', { class: 'chev' }, '›')
          ])
        ]);
      } else if (stage === null) {
        var color = TYPE_COLORS[type], ld = curLevelData(s), cnt = stageCount(), cells = [];
        for (var st = 1; st <= cnt; st++) {
          (function (st) {
            var done = isStagePassed(ld, TYPE_NAMES[type], st);
            cells.push(h('div', { class: 'stageCell' }, h('button', {
              style: { borderColor: color, background: done ? color : '#fff', color: done ? '#fff' : color },
              onclick: function () { startQuiz(st); }
            }, [h('b', null, String(st)), '단계', done ? h('div', null, '✔') : null])));
          })(st);
        }
        inner = h('div', { style: { maxWidth: '520px', margin: '0 auto', paddingTop: '20px' } }, [
          h('div', { class: 'center', style: { fontSize: '22px', fontWeight: '700', color: color } }, TYPE_NAMES[type] + ' - 단계 선택'),
          h('div', { class: 'center muted mt8' }, level + '급 · 단계당 ' + getPerStage(level) + '문제'),
          h('div', { class: 'stageGrid' }, cells)
        ]);
      } else {
        var it = items[index], c2 = TYPE_COLORS[type];
        var prompts = ['이 한자의 훈음은?', '이 한자단어의 독음은?', '이 독음의 한자단어를 찾으세요'];
        var isLast = index >= items.length - 1;
        inner = h('div', { class: 'wrap' }, [
          progressBar((index + 1) / items.length, c2),
          h('div', { class: 'center muted mt8' }, (index + 1) + ' / ' + items.length),
          h('div', { class: 'center mt12', style: { fontSize: '17px' } }, prompts[type]),
          h('div', { class: 'qcard mt12', style: { border: '2px solid ' + c2, boxShadow: 'none' } }, [
            h('div', { class: 'big', style: { fontSize: type === 0 ? '100px' : '56px' } }, it.q),
            it.sub ? h('div', { class: 'sub' }, it.sub) : null
          ]),
          h('button', { class: 'btn mt12', style: { background: c2 }, disabled: selected === null || saving, onclick: next },
            saving ? h('span', { class: 'spinner' }) : (isLast ? '결과 보기' : '다음')),
          h('div', { class: 'mt12' }, optionButtons(it.options, it.answer, selected, pick)),
          h('div', { style: { height: '60px' } })
        ]);
      }
      append(f.body, h('div', { class: 'purpleBg' }, inner));
    }
    render();
    return { el: f.el, onShow: function () { if (stage === null) render(); } };
  }

  // ───────────────────────── 한자왕 ─────────────────────────
  function HanjaKingScreen() {
    var GOLD = '#FF8F00';
    var s = App.student, level = s.currentLevel;
    var items = [], index = 0, score = 0, selected = null, finished = false, newRecord = false, prevBest = 0;
    var f = frame({ title: '한자왕 (' + level + '급)', color: GOLD });

    function pickN(all, n) {
      if (!all.length) return [];
      var res = [], bag = [];
      while (res.length < n) { if (!bag.length) bag = shuffle(all.slice()); res.push(bag.pop()); }
      return res;
    }
    function generate() {
      var chars = getChars(level), words = getWords(level), high = level === 5 || level === 6;
      function he(c) { return c.hun + '(' + c.eum + ')'; }
      var out = [], hePool = chars.map(he), hzPool = chars.map(function (c) { return c.hanja; });
      pickN(chars, 10).forEach(function (c) { var o = withDistractors(he(c), hePool); out.push({ q: c.hanja, sub: '이 한자의 훈음은?', options: o, answer: o.indexOf(he(c)) }); });
      pickN(chars, high ? 5 : 10).forEach(function (c) { var o = withDistractors(c.hanja, hzPool); out.push({ q: he(c), sub: '이 훈음의 한자는?', options: o, answer: o.indexOf(c.hanja) }); });
      pickN(words, high ? 10 : 15).forEach(function (w) {
        var o = withDistractors(w.reading, poolFor(w, words).map(function (p) { return p.reading; }));
        out.push({ q: w.word, sub: '이 한자단어의 독음은?', options: o, answer: o.indexOf(w.reading) });
      });
      pickN(words, 15).forEach(function (w) {
        var o = withDistractors(w.word, poolFor(w, words).map(function (p) { return p.word; }));
        out.push({ q: w.reading, sub: '이 독음의 한자단어를 찾으세요', options: o, answer: o.indexOf(w.word) });
      });
      items = shuffle(out); index = 0; score = 0; selected = null; finished = false; newRecord = false;
      render();
    }
    function pick(i) {
      if (selected !== null) return;
      var ok = i === items[index].answer;
      selected = i; if (ok) score++;
      if (ok) Audio2.good(); else Audio2.bad();
      render();
    }
    function next() {
      if (selected === null) return;
      if (index < items.length - 1) { index++; selected = null; render(); f.body.scrollTop = 0; }
      else finish();
    }
    async function finish() {
      var key = String(level);
      prevBest = s.kingScores[key] || 0;
      finished = true; newRecord = score > prevBest;
      render();
      if (score > prevBest) {
        s.kingScores[key] = score;
        try { await Service.updateKingScore(s, level, score); }
        catch (e) { if (window.console) console.error('한자왕 점수 저장 실패', e); toast('점수를 저장하지 못했습니다. 인터넷 연결을 확인하세요.'); }
      }
    }
    function render() {
      clear(f.body); clear(f.actions);
      if (finished) {
        f.titleEl.textContent = '한자왕 (' + level + '급) 결과';
        append(f.body, h('div', { class: 'wrap center', style: { paddingTop: '50px' } }, [
          h('div', { style: { fontSize: '90px' } }, '👑'),
          h('div', { style: { fontSize: '26px', fontWeight: '700' } }, '한자왕 퀴즈 완료!'),
          h('div', { style: { fontSize: '48px', fontWeight: '700', color: GOLD, margin: '16px 0' } }, score + ' / ' + items.length),
          newRecord ? h('div', { style: { fontSize: '22px', fontWeight: '700', color: '#ff5252' } }, '🎉 신기록 달성!') : null,
          h('div', { class: 'muted mt8' }, '이전 최고 점수: ' + prevBest),
          h('button', { class: 'btn', style: { background: GOLD, width: '200px', margin: '28px auto 0' }, onclick: pop }, '돌아가기')
        ]));
        return;
      }
      f.titleEl.textContent = '한자왕 (' + level + '급)';
      append(f.actions, h('span', { class: 'barText' }, '점수: ' + score));
      if (!items.length) { append(f.body, h('div', { class: 'loading' }, h('span', { class: 'spinner' }))); return; }
      var it = items[index];
      append(f.body, h('div', { class: 'wrap' }, [
        h('div', { class: 'center', style: { fontWeight: '700', fontSize: '16px' } }, '문제 ' + (index + 1) + ' / ' + items.length),
        h('div', { class: 'mt8' }, progressBar((index + 1) / items.length, GOLD)),
        h('div', { class: 'center muted mt8' }, '정답: ' + score),
        h('div', { class: 'center mt12', style: { fontSize: '17px' } }, it.sub),
        h('div', { class: 'qcard mt12', style: { background: '#FFF8E1', border: '2px solid ' + GOLD, boxShadow: 'none' } },
          h('div', { class: 'big', style: { fontSize: '52px', lineHeight: '1.3' } }, it.q)),
        h('button', { class: 'btn mt12', style: { background: GOLD }, disabled: selected === null, onclick: next }, index < items.length - 1 ? '다음' : '결과 보기'),
        h('div', { class: 'mt12' }, optionButtons(it.options, it.answer, selected, pick)),
        h('div', { style: { height: '60px' } })
      ]));
    }
    generate();
    return { el: f.el };
  }

  // ───────────────────────── 내 점수 보기 ─────────────────────────
  function ScoreScreen() {
    var TEAL = '#00695C';
    var loading = false;
    var f = frame({ title: '내 점수 보기', color: TEAL });
    var refreshBtn = h('button', { class: 'ibtn', 'aria-label': '새로고침', onclick: refresh }, '↻');
    append(f.actions, refreshBtn);

    async function refresh() {
      var s = App.student; if (!s || loading) return;
      loading = true; render();
      try { App.student = await Service.getOrCreateStudent(s.grade, s.classNum, s.number, s.name, s.currentLevel); }
      catch (e) { if (window.console) console.error(e); toast('기록을 불러오지 못했습니다. 인터넷 연결을 확인하세요.'); }
      loading = false; render();
    }
    function render() {
      clear(f.body);
      refreshBtn.disabled = loading;
      if (loading) { append(f.body, h('div', { class: 'loading' }, h('span', { class: 'spinner' }))); return; }
      var s = App.student, ld = curLevelData(s), passedAll = ld.status === '통과';
      append(f.body, h('div', { class: 'wrap', style: { paddingBottom: '80px' } }, [
        h('div', { class: 'sCard who' }, [
          h('div', { class: 'avatar' }, '👤'),
          h('div', { class: 'nm' }, [h('b', null, s.name), h('span', { class: 'muted' }, s.grade + '학년 ' + s.classNum + '반 ' + s.number + '번')]),
          h('div', { class: 'lv' }, s.currentLevel + '급')
        ]),
        h('div', { class: 'total' }, ['누적 활동 점수', h('b', null, ld.totalPoints + '점')]),
        h('div', { class: 'secTitle' }, '영역별 진행 상황'),
        CATEGORIES.map(function (c) {
          var total = totalStages(s.currentLevel, c), passed = passedStages(ld, c), done = total > 0 && passed >= total;
          return h('div', { class: 'sCard' }, [
            h('div', { class: 'prow' }, [h('b', null, c), done ? h('span', { class: 'badge' }, '완료') : null, h('span', null, passed + ' / ' + total + ' 단계')]),
            progressBar(total ? Math.min(1, passed / total) : 0, done ? '#43a047' : TEAL)
          ]);
        }),
        h('div', { class: 'sCard' }, [
          h('b', { style: { fontSize: '17px' } }, '한자왕 점수'),
          h('div', { class: 'kings mt12' }, ['5', '6', '7', '8'].map(function (lv) {
            return h('div', null, [h('span', { class: 'muted' }, lv + '급'), h('b', null, (s.kingScores[lv] || 0) + '점')]);
          }))
        ]),
        h('div', { class: 'status' + (passedAll ? ' pass' : '') }, passedAll ? '✅ 전체 통과' : '⏳ 전체 상태: ' + ld.status)
      ]));
    }
    render();
    refresh();
    return { el: f.el };
  }

  // ───────────────────────── 교사용 결과표 ─────────────────────────
  function AdminScreen() {
    var LVS = [5, 6, 7, 8];
    var t = App.student, students = [], loading = true, error = null;
    var f = frame({ title: '', onBack: logout });
    f.bar.firstChild.textContent = '로그아웃';
    f.bar.firstChild.className = 'tbtn';
    f.bar.firstChild.style.color = '#1A237E';
    f.bar.firstChild.style.marginLeft = '6px';
    var copyBtn = h('button', { class: 'ibtn', 'aria-label': '복사', onclick: copy }, '📋');
    var refreshBtn = h('button', { class: 'ibtn', 'aria-label': '새로고침', onclick: load }, '↻');
    append(f.actions, [copyBtn, refreshBtn]);

    function dateText() { var n = new Date(); return n.getFullYear() + '년 ' + (n.getMonth() + 1) + '월 ' + n.getDate() + '일 현재'; }
    function lvData(st, lv) { var l = st.levels && st.levels[String(lv)]; return (l && typeof l === 'object') ? l : {}; }
    function statusText(st, lv) { return (lvData(st, lv).status || '미통과') === '통과' ? '통과' : 'X'; }
    function pointsText(st, lv) { var p = lvData(st, lv).totalPoints; return String(p === undefined || p === null ? 0 : p); }
    function kingText(st, lv) { var k = st.kingScores; return (k && k[String(lv)] !== undefined && k[String(lv)] !== null) ? String(k[String(lv)]) : ''; }

    async function logout() {
      var ok = await confirmDialog('', '로그인 화면으로 나갑니다', '예', '아니오');
      if (!ok) return;
      App.student = null; App.isTeacher = false;
      replaceAll(LoginScreen());
    }
    async function load() {
      loading = true; error = null; render();
      try { students = await Service.getClassStudents(t.grade, t.classNum); }
      catch (e) { if (window.console) console.error(e); error = '데이터를 불러오지 못했습니다.'; }
      loading = false; render();
    }
    function tableText() {
      var lines = [t.grade + '학년 ' + t.classNum + '반 - 한자공부 - 활동 결과표', dateText(), ''];
      var head = '번호\t이름\t';
      LVS.forEach(function (lv) { head += lv + '급\t점수\t'; });
      lines.push(head + '왕5급\t왕6급\t왕7급\t왕8급');
      students.forEach(function (st) {
        var line = (st.number || '') + '\t' + (st.name || '') + '\t';
        LVS.forEach(function (lv) { line += statusText(st, lv) + '\t' + pointsText(st, lv) + '\t'; });
        lines.push(line + LVS.map(function (lv) { return kingText(st, lv); }).join('\t'));
      });
      return lines.join('\n') + '\n';
    }
    function copy() {
      if (!students.length) return;
      var text = tableText(), done = false;
      var ta = h('textarea', { readonly: true, style: { position: 'fixed', top: '0', left: '0', opacity: '0', fontSize: '16px' } });
      ta.value = text; document.body.appendChild(ta);
      try {
        var range = document.createRange(); range.selectNodeContents(ta);
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
        ta.setSelectionRange(0, text.length);
        done = document.execCommand('copy');
      } catch (e) { done = false; }
      document.body.removeChild(ta);
      if (done) { toast('텍스트가 클립보드에 복사되었습니다'); return; }
      // 복사가 막힌 경우: 직접 선택해서 복사할 수 있게 보여 줌
      var box = h('textarea', { style: { width: '100%', height: '220px', fontSize: '13px' } }); box.value = text;
      showDialog({ title: '결과표 텍스트', body: [h('div', { class: 'muted', style: { marginBottom: '8px' } }, '길게 눌러 전체 선택 → 복사하세요'), box], buttons: [{ label: '닫기' }] });
    }
    function render() {
      clear(f.titleEl);
      append(f.titleEl, [h('div', { style: { fontSize: '16px' } }, t.grade + '학년 ' + t.classNum + '반 - 한자공부 - 활동 결과표'), h('div', { style: { fontSize: '12px', fontWeight: '400' } }, dateText())]);
      copyBtn.disabled = !students.length || loading;
      clear(f.body);
      if (loading) { append(f.body, h('div', { class: 'loading' }, h('span', { class: 'spinner' }))); return; }
      if (error) { append(f.body, h('div', { class: 'loading' }, error)); return; }
      if (!students.length) { append(f.body, h('div', { class: 'loading' }, [h('div', { style: { fontSize: '50px' } }, '👥'), '아직 등록된 학생이 없습니다.'])); return; }
      var head = [h('th', null, '번호'), h('th', null, '이름')];
      LVS.forEach(function (lv) { head.push(h('th', null, lv + '급')); head.push(h('th', null, '점수')); });
      LVS.forEach(function (lv) { head.push(h('th', null, '왕' + lv + '급')); });
      var rows = students.map(function (st) {
        var tds = [h('td', null, String(st.number || '')), h('td', { style: { fontWeight: '700' } }, String(st.name || ''))];
        LVS.forEach(function (lv) {
          var stt = statusText(st, lv);
          tds.push(h('td', { class: stt === '통과' ? 'pass' : 'fail' }, stt));
          tds.push(h('td', null, pointsText(st, lv)));
        });
        LVS.forEach(function (lv) { tds.push(h('td', { class: 'king' }, kingText(st, lv))); });
        return h('tr', null, tds);
      });
      append(f.body, h('div', { class: 'tableWrap' }, h('table', { class: 'res' }, [h('thead', null, h('tr', null, head)), h('tbody', null, rows)])));
    }
    render();
    load();
    return { el: f.el };
  }

  // ───────────────────────── 시작 ─────────────────────────
  function boot() {
    root = document.getElementById('app');
    if (CONFIG.useExpiry && new Date() >= new Date(CONFIG.expiryYear, CONFIG.expiryMonth - 1, 1)) {
      clear(root);
      root.appendChild(h('div', { class: 'boot' }, '사용 기간이 끝났습니다.'));
      return;
    }
    Audio2.init();
    replaceAll(LoginScreen());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // 점검용 (화면 동작에는 영향 없음)
  window.__SEJONG = { FS: FS, Service: Service, App: App };
})();
