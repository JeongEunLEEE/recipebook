/* 정원이의 레시피북 — Supabase 연결층
   레시피북 화면 코드는 Claude 아티팩트와 똑같이 두고, 저장소(db)·사진(assets)·사용자(user)만 Supabase로 바꿔 줍니다.
   - docs 테이블: (col, id, data jsonb) 한 줄 = 문서 하나
   - photos 버킷: 파일 이름 = 사진 id (비공개, 로그인한 멤버만 서명된 주소로 열람)
   - AI(sample)는 웹사이트 버전에서 꺼져 있어요. */
(function () {
  var cfg = window.RECIPEBOOK_CONFIG || {};
  var configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !/YOUR-/.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY);
  var sb = configured && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  window.__sb = sb;

  /* ---------- 사진 주소 (서명된 URL, 7일) ---------- */
  var signed = {}, requested = {}, queue = [], timer = null, BUCKET = 'photos';
  function flush() {
    timer = null;
    var ids = queue.splice(0, queue.length);
    if (!ids.length || !sb) return;
    var chunks = [];
    for (var i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
    Promise.all(chunks.map(function (c) {
      return sb.storage.from(BUCKET).createSignedUrls(c, 60 * 60 * 24 * 7).then(function (r) {
        (r.data || []).forEach(function (d) { if (d && d.signedUrl) signed[d.path] = d.signedUrl; });
      });
    })).then(function () { window.dispatchEvent(new Event('media-signed')); });
  }
  window.__mediaUrl = function (id) {
    if (!id) return '';
    if (signed[id]) return signed[id];
    if (!requested[id]) { requested[id] = 1; queue.push(id); if (!timer) timer = setTimeout(flush, 30); }
    return '';
  };

  /* ---------- 공통 ---------- */
  function q(p) { return p.then(function (r) { if (r && r.error) throw r.error; return r ? r.data : null; }); }
  var cols = {};
  function colState(col) {
    if (!cols[col]) cols[col] = { map: new Map(), subs: [] };
    return cols[col];
  }
  function emit(col) {
    var st = colState(col);
    var snap = { docs: Array.from(st.map, function (e) { var d = e[1]; return { id: e[0], exists: true, data: function () { return d; } }; }), metadata: { fromCache: false } };
    st.subs.forEach(function (cb) { try { cb(snap); } catch (e) { console.error(e); } });
  }
  function refetch(col, id) {
    return sb.from('docs').select('id,data').eq('col', col).eq('id', id).maybeSingle().then(function (r) {
      var st = colState(col);
      if (r.data) st.map.set(id, r.data.data); else st.map.delete(id);
      emit(col);
    });
  }

  /* ---------- db: 아티팩트와 같은 모양 ---------- */
  var db = {
    collection: function (col) {
      return {
        doc: function (id) {
          return {
            set: function (data) { return q(sb.from('docs').upsert({ col: col, id: id, data: data })).then(function () { return refetch(col, id); }); },
            update: function (data) { return q(sb.rpc('merge_doc', { p_col: col, p_id: id, p_patch: data })).then(function () { return refetch(col, id); }); },
            delete: function () { return q(sb.from('docs').delete().eq('col', col).eq('id', id)).then(function () { return refetch(col, id); }); }
          };
        },
        onSnapshot: function (cb, onErr) {
          var st = colState(col);
          st.subs.push(cb);
          if (!st.started) {
            st.started = true;
            sb.from('docs').select('id,data').eq('col', col).limit(5000).then(function (r) {
              if (r.error) { if (onErr) onErr(r.error); return; }
              (r.data || []).forEach(function (row) { st.map.set(row.id, row.data); });
              emit(col);
            });
            sb.channel('docs-' + col)
              .on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter: 'col=eq.' + col }, function (p) {
                if (p.eventType === 'DELETE') { if (p.old && p.old.id) st.map.delete(p.old.id); }
                else if (p.new) st.map.set(p.new.id, p.new.data);
                emit(col);
              })
              .subscribe();
          } else if (st.map.size) { setTimeout(function () { emit(col); }, 0); }
          return function () { st.subs = st.subs.filter(function (f) { return f !== cb; }); };
        }
      };
    }
  };

  /* ---------- 사진 업로드 ---------- */
  function newId() { return (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()).replace(/[^a-z0-9]/gi, '').slice(0, 32); }
  var assets = {
    upload: function (blob) {
      var id = newId();
      return q(sb.storage.from(BUCKET).upload(id, blob, { contentType: blob.type || 'image/jpeg', upsert: false }))
        .then(function () { return sb.storage.from(BUCKET).createSignedUrl(id, 60 * 60 * 24 * 7); })
        .then(function (r) { if (r && r.data && r.data.signedUrl) signed[id] = r.data.signedUrl; requested[id] = 1; return { id: id, url: null }; });
    }
  };

  /* ---------- 사용자 ---------- */
  var me = null, profilesCache = null;
  function loadProfiles() {
    if (profilesCache) return Promise.resolve(profilesCache);
    return q(sb.from('profiles').select('user_id,legacy_id,name')).then(function (rows) { profilesCache = rows || []; return profilesCache; });
  }
  var user = {
    id: function () { return Promise.resolve(me ? (me.legacy_id || me.user_id) : null); },
    profiles: function (ids) {
      return loadProfiles().then(function (rows) {
        var out = {};
        (ids || []).forEach(function (i) {
          var p = rows.find(function (r) { return r.legacy_id === i || r.user_id === i; });
          if (p) out[i] = { name: p.name || '' };
        });
        return out;
      });
    }
  };

  /* ---------- 로그인 화면 ---------- */
  var readyResolve, ready = new Promise(function (r) { readyResolve = r; });
  function css() {
    var st = document.createElement('style');
    st.textContent = '.aibox,[data-act=reffill],[data-act=refpend],#bkbtn{display:none!important}' +
      '#sb-login{position:fixed;inset:0;z-index:100;background:var(--wall,#faf7f1);display:grid;place-items:center;padding:20px}' +
      '#sb-login form{background:#fff;border:1px solid #e8e3da;border-radius:14px;padding:28px 24px;width:min(380px,100%);display:grid;gap:12px}' +
      '#sb-login h1{font-family:"Noto Serif KR",serif;font-weight:400;font-size:26px;margin:0 0 4px}' +
      '#sb-login p{margin:0;color:#8b8590;font-size:13.5px;line-height:1.6}' +
      '#sb-login input{height:44px;border:1px solid #e8e3da;border-radius:10px;padding:0 12px;font-size:16px}' +
      '#sb-login button{height:46px;border:0;border-radius:999px;background:#f7b9cb;font-weight:600;font-size:15px;cursor:pointer}' +
      '#sb-err{color:#c2416b;font-size:13px;min-height:18px}' +
      '#sb-out{position:fixed;right:12px;bottom:12px;z-index:30;border:1px solid #e8e3da;background:#fff;border-radius:999px;padding:6px 12px;font-size:12px;color:#8b8590;cursor:pointer}';
    document.head.appendChild(st);
  }
  function showLogin(msg) {
    var el = document.getElementById('sb-login');
    if (!el) {
      el = document.createElement('div'); el.id = 'sb-login';
      el.innerHTML = '<form><h1>♡ 정원이의 레시피북</h1><p>둘만 쓰는 레시피북이에요. 등록된 이메일과 비밀번호로 로그인해 주세요.</p>' +
        '<input type="email" id="sb-email" placeholder="이메일" autocomplete="username" required>' +
        '<input type="password" id="sb-pw" placeholder="비밀번호" autocomplete="current-password" required>' +
        '<div id="sb-err"></div><button type="submit">로그인</button></form>';
      document.body.appendChild(el);
      el.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        var err = document.getElementById('sb-err'); err.textContent = '로그인 중…';
        sb.auth.signInWithPassword({ email: document.getElementById('sb-email').value.trim(), password: document.getElementById('sb-pw').value })
          .then(function (r) { if (r.error) { err.textContent = '이메일이나 비밀번호가 맞지 않아요.'; return; } afterLogin(r.data.session); });
      });
    }
    el.hidden = false;
    document.getElementById('sb-err').textContent = msg || '';
  }
  function afterLogin(session) {
    if (!session) { showLogin(); return; }
    sb.from('profiles').select('user_id,legacy_id,name').eq('user_id', session.user.id).maybeSingle().then(function (r) {
      if (!r.data) {
        sb.auth.signOut();
        showLogin('이 계정은 아직 레시피북 멤버로 등록되지 않았어요. (README 4단계)');
        return;
      }
      me = r.data;
      var el = document.getElementById('sb-login'); if (el) el.hidden = true;
      if (!document.getElementById('sb-out')) {
        var b = document.createElement('button'); b.id = 'sb-out'; b.textContent = (me.name || '나') + ' · 로그아웃';
        b.onclick = function () { sb.auth.signOut().then(function () { location.reload(); }); };
        document.body.appendChild(b);
      }
      readyResolve(true);
    });
  }
  function start() {
    css();
    if (!sb) {
      var el = document.createElement('div'); el.id = 'sb-login';
      el.innerHTML = '<form><h1>설정이 필요해요</h1><p>config.js에 Supabase 주소와 anon key를 넣어 주세요. (README 3단계)</p></form>';
      document.body.appendChild(el);
      return;
    }
    sb.auth.getSession().then(function (r) { afterLogin(r.data && r.data.session); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  /* ---------- 레시피북이 부르는 입구 ---------- */
  window.claude = {
    use: function (name) {
      if (!sb) return new Promise(function () {});
      return ready.then(function () {
        return { db: db, user: user, assets: assets }[name] || null;
      });
    }
  };
})();
