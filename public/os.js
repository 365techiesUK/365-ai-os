/* 365 Techies AI OS — front-end (vanilla JS) */
(function () {
  "use strict";

  // ---------- API ----------
  async function api(method, url, body) {
    const opt = { method, headers: {} };
    if (body !== undefined) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
    const r = await fetch(url, opt);
    let data = {}; try { data = await r.json(); } catch (_) {}
    if (!r.ok) throw new Error(data.error || ("Request failed (" + r.status + ")"));
    return data;
  }

  // ---------- allow-lists (mirror the server) ----------
  const ACCENTS = ["#37c2c2", "#7c5cff", "#3fae6b", "#e2654a", "#e2b34a", "#4a9be2"];
  const WALLPAPERS = ["aurora", "dusk", "ocean", "slate"];

  // ---------- icons ----------
  const IC = {
    assistant: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="8" width="16" height="11" rx="3"/><circle cx="9" cy="13" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="13" r="1.3" fill="currentColor" stroke="none"/><path d="M12 4v4M8 19v2M16 19v2"/></svg>',
    notes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    tasks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7l2 2 3-3"/><path d="M4 17l2 2 3-3"/><path d="M12 8h8M12 18h8"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 2.6a7 7 0 0 0-1.7 1l-2.3-1-2 3.4L3 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.4 2.6h5l.4-2.6a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5a7 7 0 0 0 .1-1z"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7M12 17h.01"/></svg>',
    calc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 11v6"/></svg>',
    viewer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 16-5-5L5 21"/></svg>',
    about: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/></svg>',
    victron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="8" cy="7.5" r="2.6"/><path d="M8 2.4v1.3M8 11.3v1.3M2.4 7.5h1.3M12.3 7.5h1.3M4.4 3.9l.9.9M10.7 10.2l.9.9M11.6 3.9l-.9.9M5.3 10.2l-.9.9"/><rect x="12.5" y="13" width="9" height="7.5" rx="1.6"/><path d="M21.5 15.5v2.5M15 16.2l2 2 3-3.4"/></svg>',
  };

  const APPS = {
    assistant: { title: "AI Assistant", w: 400, h: 480, build: buildAssistant },
    notes:     { title: "Notes",        w: 360, h: 360, build: buildNotes },
    tasks:     { title: "Tasks",        w: 340, h: 430, build: buildTasks },
    calc:      { title: "Calculator",   w: 260, h: 360, build: buildCalc },
    viewer:    { title: "Image Viewer", w: 420, h: 380, build: buildViewer },
    victron:   { title: "Off-Grid",     w: 460, h: 540, build: buildVictron },
    settings:  { title: "Settings",     w: 390, h: 430, build: buildSettings },
    help:      { title: "Get Help",     w: 380, h: 440, build: buildHelp },
    about:     { title: "About",        w: 360, h: 320, build: buildAbout },
  };

  // ---------- state ----------
  let me = null, zTop = 10, saveTimer = null, lastSaveToast = 0, focusedId = null;
  const openWins = {};
  const $ = (id) => document.getElementById(id);
  const loginEl = $("login"), desktopEl = $("desktop");

  // ---------- toasts ----------
  function toast(msg, type) {
    const wrap = $("toasts"); if (!wrap) return;
    const t = document.createElement("div");
    t.className = "toast toast--" + (["success", "info", "error"].includes(type) ? type : "info");
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 250); }, 3000);
  }

  // ================= AUTH =================
  let mode = "login";
  const form = $("auth-form"), errEl = $("auth-error");
  $("switch-link").addEventListener("click", (e) => {
    e.preventDefault();
    mode = mode === "login" ? "signup" : "login";
    $("auth-submit").textContent = mode === "login" ? "Sign in" : "Create account";
    $("switch-text").textContent = mode === "login" ? "New here?" : "Already have an account?";
    $("switch-link").textContent = mode === "login" ? "Create an account" : "Sign in";
    $("password").setAttribute("autocomplete", mode === "login" ? "current-password" : "new-password");
    errEl.hidden = true;
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); errEl.hidden = true;
    try {
      const res = await api("POST", mode === "login" ? "/api/login" : "/api/signup", { email: $("email").value.trim(), password: $("password").value });
      me = res.user; boot();
    } catch (err) { errEl.textContent = err.message; errEl.hidden = false; }
  });
  $("logout").addEventListener("click", async () => { try { await api("POST", "/api/logout"); } catch (_) {} location.reload(); });

  // ================= BOOT =================
  async function tryResume() {
    try { const res = await api("GET", "/api/me"); me = res.user; boot(); }
    catch (_) { loginEl.hidden = false; }
  }
  function boot() {
    me.profile = me.profile || {}; me.state = me.state || {};
    me.state.windows = me.state.windows || {}; me.state.chat = me.state.chat || [];
    me.state.tasks = me.state.tasks || []; me.state.activity = me.state.activity || [];
    if (typeof me.state.notes !== "string") me.state.notes = "";
    applyTheme();
    loginEl.hidden = true; desktopEl.hidden = false;
    setHello();
    renderIcons(); renderStartMenu(); startClock(); buildPalette();
    Object.keys(me.state.windows).forEach((id) => { if (me.state.windows[id] && me.state.windows[id].open && APPS[id]) openApp(id, true); });
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
  function setHello() { $("hello").textContent = "Hi, " + (me.profile.displayName || me.email.split("@")[0]); }
  function applyTheme() {
    document.documentElement.style.setProperty("--accent", ACCENTS.includes(me.profile.accent) ? me.profile.accent : "#37c2c2");
    document.body.dataset.wall = WALLPAPERS.includes(me.profile.wallpaper) ? me.profile.wallpaper : "aurora";
  }
  function renderIcons() {
    const wrap = $("icons"); wrap.innerHTML = "";
    Object.keys(APPS).forEach((id) => {
      const d = document.createElement("div"); d.className = "icon"; d.title = APPS[id].title;
      d.innerHTML = '<div class="icon__glyph">' + IC[id] + '</div>';
      const lbl = document.createElement("div"); lbl.className = "icon__label"; lbl.textContent = APPS[id].title; d.appendChild(lbl);
      d.addEventListener("dblclick", () => openApp(id));
      d.addEventListener("click", () => { d._t = (d._t || 0) + 1; setTimeout(() => { if (d._t === 1) openApp(id); d._t = 0; }, 220); });
      wrap.appendChild(d);
    });
  }
  function renderStartMenu() {
    const list = $("start-list"); list.innerHTML = "";
    Object.keys(APPS).forEach((id) => {
      const b = document.createElement("div"); b.className = "start-item";
      b.innerHTML = IC[id]; const s = document.createElement("span"); s.textContent = APPS[id].title; b.appendChild(s);
      b.addEventListener("click", () => { openApp(id); toggleStart(false); });
      list.appendChild(b);
    });
  }
  const startMenu = $("start-menu");
  $("start-btn").addEventListener("click", (e) => { e.stopPropagation(); toggleStart(startMenu.hidden); });
  document.addEventListener("click", () => toggleStart(false));
  function toggleStart(show) { startMenu.hidden = !show; }
  function startClock() {
    const el = $("clock");
    const tick = () => { const n = new Date(); el.innerHTML = n.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + "<br>" + n.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }); };
    tick(); setInterval(tick, 10000);
  }

  // ================= WINDOW MANAGER =================
  const TOPBAR = 52, TASKBAR = 52;
  function clampRect(r) {
    const maxW = window.innerWidth, maxH = window.innerHeight;
    r.w = Math.max(240, Math.min(r.w, maxW)); r.h = Math.max(160, Math.min(r.h, maxH - TOPBAR - TASKBAR));
    r.x = Math.max(0, Math.min(r.x, maxW - 80)); r.y = Math.max(TOPBAR, Math.min(r.y, maxH - 80));
    return r;
  }
  function openApp(id, fromRestore) {
    if (openWins[id]) { restore(id); focusWin(openWins[id].el); return; }
    const app = APPS[id]; const saved = me.state.windows[id] || {};
    const rect = clampRect({ x: saved.x != null ? saved.x : 100 + Object.keys(openWins).length * 26, y: saved.y != null ? saved.y : 84 + Object.keys(openWins).length * 24, w: saved.w || app.w, h: saved.h || app.h });
    const win = document.createElement("div"); win.className = "win";
    win.style.left = rect.x + "px"; win.style.top = rect.y + "px"; win.style.width = rect.w + "px"; win.style.height = rect.h + "px"; win.style.zIndex = ++zTop;
    win.innerHTML =
      '<div class="win__bar"><span class="win__title">' + app.title + '</span>' +
      '<div class="win__btns"><button class="win__btn win__btn--min" title="Minimise"></button>' +
      '<button class="win__btn win__btn--max" title="Maximise"></button>' +
      '<button class="win__btn win__btn--close" title="Close"></button></div></div>' +
      '<div class="win__body"></div><div class="win__resize" title="Resize"></div>';
    $("windows").appendChild(win);
    app.build(win.querySelector(".win__body"), win);

    win.addEventListener("mousedown", () => focusWin(win));
    win.querySelector(".win__btn--close").addEventListener("click", () => closeApp(id));
    win.querySelector(".win__btn--min").addEventListener("click", (e) => { e.stopPropagation(); minimize(id); });
    win.querySelector(".win__btn--max").addEventListener("click", (e) => { e.stopPropagation(); toggleMax(id); });
    const bar = win.querySelector(".win__bar");
    bar.addEventListener("dblclick", () => toggleMax(id));
    makeDraggable(win, bar, id);
    makeResizable(win, win.querySelector(".win__resize"), id);

    const taskBtn = document.createElement("button"); taskBtn.className = "task-app"; taskBtn.textContent = app.title;
    taskBtn.addEventListener("click", () => { if (win.classList.contains("is-min")) restore(id); else minimize(id); });
    $("task-apps").appendChild(taskBtn);

    openWins[id] = { el: win, taskBtn };
    me.state.windows[id] = Object.assign({}, saved, rect, { open: true, max: !!saved.max });
    if (saved.max) applyMax(id, true);
    focusWin(win);
    if (!fromRestore) saveState();
  }
  function closeApp(id) {
    const w = openWins[id]; if (!w) return;
    if (w.el._onClose) try { w.el._onClose(); } catch (_) {}
    (w.el._cleanups || []).forEach((fn) => { try { fn(); } catch (_) {} }); // detach window-level drag/resize listeners
    const cur = me.state.windows[id] || {};
    me.state.windows[id] = { open: false, x: parseInt(w.el.style.left), y: parseInt(w.el.style.top), w: parseInt(w.el.style.width), h: parseInt(w.el.style.height), max: !!cur.max, prevRect: cur.prevRect };
    w.el.remove(); w.taskBtn.remove(); delete openWins[id];
    if (focusedId === id) focusedId = null;
    saveState();
  }
  function minimize(id) { const w = openWins[id]; if (!w) return; w.el.classList.add("is-min"); w.taskBtn.classList.remove("is-active"); }
  function restore(id) { const w = openWins[id]; if (!w) return; w.el.classList.remove("is-min"); focusWin(w.el); }
  function focusWin(el) {
    el.style.zIndex = ++zTop;
    Object.entries(openWins).forEach(([id, w]) => {
      const active = w.el === el && !el.classList.contains("is-min");
      w.el.classList.toggle("is-focused", active);
      w.taskBtn.classList.toggle("is-active", active);
      if (active) focusedId = id;
    });
  }
  function applyMax(id, on) {
    const w = openWins[id]; if (!w) return; const el = w.el; const st = me.state.windows[id];
    if (on) {
      st.prevRect = { x: parseInt(el.style.left), y: parseInt(el.style.top), w: parseInt(el.style.width), h: parseInt(el.style.height) };
      el.classList.add("is-max");
      el.style.left = "0px"; el.style.top = TOPBAR + "px"; el.style.width = window.innerWidth + "px"; el.style.height = (window.innerHeight - TOPBAR - TASKBAR) + "px";
      st.max = true;
    } else {
      el.classList.remove("is-max");
      const r = clampRect(st.prevRect || { x: 100, y: 90, w: APPS[id].w, h: APPS[id].h });
      el.style.left = r.x + "px"; el.style.top = r.y + "px"; el.style.width = r.w + "px"; el.style.height = r.h + "px";
      st.max = false;
    }
  }
  function toggleMax(id) { const st = me.state.windows[id]; applyMax(id, !st.max); saveState(); }

  let snapPreview = null;
  function regCleanup(win, fn) { (win._cleanups = win._cleanups || []).push(fn); }
  function makeDraggable(win, handle, id) {
    let sx, sy, ox, oy, dragging = false, snapTo = null;
    handle.addEventListener("mousedown", (e) => {
      if (e.target.classList.contains("win__btn")) return;
      if (me.state.windows[id].max) return; // don't drag a maximised window
      dragging = true; sx = e.clientX; sy = e.clientY; ox = parseInt(win.style.left); oy = parseInt(win.style.top);
      win.classList.add("is-dragging"); document.body.style.userSelect = "none";
    });
    const onMove = (e) => {
      if (!dragging) return;
      let nx = Math.max(0, Math.min(window.innerWidth - 80, ox + (e.clientX - sx)));
      let ny = Math.max(TOPBAR, Math.min(window.innerHeight - 80, oy + (e.clientY - sy)));
      win.style.left = nx + "px"; win.style.top = ny + "px";
      // edge-snap preview
      snapTo = null; let prev = null;
      if (e.clientX <= 8) { snapTo = "left"; prev = { x: 0, y: TOPBAR, w: window.innerWidth / 2, h: window.innerHeight - TOPBAR - TASKBAR }; }
      else if (e.clientX >= window.innerWidth - 8) { snapTo = "right"; prev = { x: window.innerWidth / 2, y: TOPBAR, w: window.innerWidth / 2, h: window.innerHeight - TOPBAR - TASKBAR }; }
      else if (e.clientY <= TOPBAR + 2) { snapTo = "max"; prev = { x: 0, y: TOPBAR, w: window.innerWidth, h: window.innerHeight - TOPBAR - TASKBAR }; }
      showSnap(prev);
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false; win.classList.remove("is-dragging"); document.body.style.userSelect = ""; showSnap(null);
      if (snapTo === "max") { applyMax(id, true); }
      else if (snapTo) {
        const half = snapTo === "left" ? { x: 0, y: TOPBAR } : { x: Math.round(window.innerWidth / 2), y: TOPBAR };
        win.style.left = half.x + "px"; win.style.top = half.y + "px";
        win.style.width = Math.round(window.innerWidth / 2) + "px"; win.style.height = (window.innerHeight - TOPBAR - TASKBAR) + "px";
      }
      snapTo = null; persistRect(id, win); saveState();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    regCleanup(win, () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); });
  }
  function showSnap(rect) {
    if (!rect) { if (snapPreview) { snapPreview.remove(); snapPreview = null; } return; }
    if (!snapPreview) { snapPreview = document.createElement("div"); snapPreview.className = "snap-preview"; $("windows").appendChild(snapPreview); }
    snapPreview.style.left = rect.x + "px"; snapPreview.style.top = rect.y + "px"; snapPreview.style.width = rect.w + "px"; snapPreview.style.height = rect.h + "px";
  }
  function makeResizable(win, handle, id) {
    let sx, sy, ow, oh, resizing = false;
    handle.addEventListener("mousedown", (e) => {
      e.stopPropagation(); if (me.state.windows[id].max) return;
      resizing = true; sx = e.clientX; sy = e.clientY; ow = parseInt(win.style.width); oh = parseInt(win.style.height);
      win.classList.add("is-dragging"); document.body.style.userSelect = "none";
    });
    const onMove = (e) => {
      if (!resizing) return;
      const left = parseInt(win.style.left), top = parseInt(win.style.top);
      win.style.width = Math.max(240, Math.min(ow + (e.clientX - sx), window.innerWidth - left)) + "px";
      win.style.height = Math.max(160, Math.min(oh + (e.clientY - sy), window.innerHeight - top)) + "px";
    };
    const onUp = () => { if (!resizing) return; resizing = false; win.classList.remove("is-dragging"); document.body.style.userSelect = ""; persistRect(id, win); saveState(); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    regCleanup(win, () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); });
  }
  function persistRect(id, win) {
    const s = me.state.windows[id] || {};
    if (!s.max) { s.x = parseInt(win.style.left); s.y = parseInt(win.style.top); s.w = parseInt(win.style.width); s.h = parseInt(win.style.height); }
    me.state.windows[id] = s;
  }

  // ================= PERSISTENCE =================
  function saveState() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      api("PUT", "/api/state", { state: me.state, profile: me.profile }).catch(() => {
        const now = Date.now(); if (now - lastSaveToast > 8000) { lastSaveToast = now; toast("Couldn't save changes — check your connection.", "error"); }
      });
    }, 500);
  }

  // ================= AGENTIC ACTIONS =================
  async function applyActions(list) {
    if (!Array.isArray(list)) return;
    let needsRefresh = false;
    for (const a of list) {
      if (!a || typeof a.type !== "string") continue;
      if (a.type === "openApp" && APPS[a.app]) openApp(a.app);
      else if (a.type === "closeApp" && openWins[a.app]) closeApp(a.app);
      else if (a.type === "toast") toast(String(a.text || "").slice(0, 120), "info");
      else if (a.type === "refreshState") needsRefresh = true;
    }
    if (needsRefresh) await refreshState();
  }
  async function refreshState() {
    try {
      const res = await api("GET", "/api/me"); me = res.user;
      me.state = me.state || {}; me.state.tasks = me.state.tasks || []; me.state.windows = me.state.windows || {};
      applyTheme(); setHello();
      // re-render open data windows (never the assistant — keep its chat)
      ["notes", "tasks", "settings", "help", "about"].forEach((id) => { if (openWins[id]) rerender(id); });
    } catch (_) {}
  }
  function rerender(id) { const w = openWins[id]; if (!w) return; const body = w.el.querySelector(".win__body"); body.innerHTML = ""; APPS[id].build(body, w.el); }

  // ================= APPS =================
  function buildAssistant(body) {
    body.innerHTML =
      '<div class="ai"><div class="ai__log"></div>' +
      '<div class="ai__row"><textarea class="ai__input" placeholder="Ask me anything, or tell me to do something…" rows="1"></textarea>' +
      '<button class="btn btn--primary ai__send">Send</button></div></div>';
    const log = body.querySelector(".ai__log"), input = body.querySelector(".ai__input"), send = body.querySelector(".ai__send");
    function bubble(role, text) {
      const d = document.createElement("div");
      d.className = "msg msg--" + (role === "user" ? "user" : role === "note" ? "note" : "ai");
      d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
    }
    function chips(activity) {
      if (!activity || !activity.length) return;
      const row = document.createElement("div"); row.className = "chips";
      activity.forEach((a) => { const c = document.createElement("span"); c.className = "chip"; c.textContent = "✓ " + a.summary; row.appendChild(c); });
      log.appendChild(row); log.scrollTop = log.scrollHeight;
    }
    if (me.state.chat.length) me.state.chat.forEach((m) => bubble(m.role, m.content));
    else bubble("note", "Hi! I'm your built-in assistant. Ask me things, or tell me to do them — e.g. “add a task to call the plumber” or “set my accent to purple”.");

    async function doSend() {
      const text = input.value.trim(); if (!text) return;
      input.value = ""; bubble("user", text);
      me.state.chat.push({ role: "user", content: text }); saveState();
      const thinking = bubble("note", "…thinking"); send.disabled = true;
      try {
        const res = await api("POST", "/api/ai", { messages: me.state.chat.filter((m) => m.role === "user" || m.role === "assistant") });
        thinking.remove();
        bubble("assistant", res.reply);
        me.state.chat.push({ role: "assistant", content: res.reply });
        chips(res.activity);
        await applyActions(res.actions);
        saveState();
      } catch (err) { thinking.remove(); bubble("note", "⚠️ " + err.message); }
      finally { send.disabled = false; input.focus(); }
    }
    send.addEventListener("click", doSend);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } });
    setTimeout(() => input.focus(), 30);
  }

  function buildNotes(body) {
    const ta = document.createElement("textarea"); ta.className = "notes";
    ta.placeholder = "Jot something down… saved to your profile automatically.";
    ta.value = me.state.notes || "";
    ta.addEventListener("input", () => { me.state.notes = ta.value; saveState(); });
    body.appendChild(ta);
  }

  function buildTasks(body) {
    body.innerHTML = '<div class="app-pad" style="display:flex;flex-direction:column;height:100%;padding:.9rem">' +
      '<div class="cov-row" style="display:flex;gap:.5rem;margin-bottom:.7rem"><input class="task-input" placeholder="Add a task…" style="flex:1;padding:.55rem .7rem;border-radius:9px;border:1px solid var(--line);background:rgba(0,0,0,.25);color:var(--text)"/><button class="btn btn--primary task-add">Add</button></div>' +
      '<div class="task-list" style="flex:1;overflow:auto"></div></div>';
    const input = body.querySelector(".task-input"), listEl = body.querySelector(".task-list");
    function render() {
      listEl.innerHTML = "";
      if (!me.state.tasks.length) { const e = document.createElement("p"); e.style.color = "var(--muted)"; e.textContent = "No tasks yet. Add one, or ask the assistant to."; listEl.appendChild(e); return; }
      me.state.tasks.forEach((t) => {
        const row = document.createElement("div"); row.className = "task-item" + (t.done ? " done" : "");
        const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = !!t.done;
        cb.addEventListener("change", () => { t.done = cb.checked; saveState(); render(); });
        const title = document.createElement("span"); title.className = "task-title"; title.textContent = t.title; // textContent: XSS-safe
        const del = document.createElement("button"); del.className = "task-del"; del.textContent = "✕";
        del.addEventListener("click", () => { me.state.tasks = me.state.tasks.filter((x) => x.id !== t.id); saveState(); render(); });
        row.append(cb, title, del); listEl.appendChild(row);
      });
    }
    function add() {
      const v = input.value.trim(); if (!v) return;
      if (me.state.tasks.length >= 200) { toast("Task list is full (200).", "error"); return; }
      me.state.tasks.push({ id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), title: v.slice(0, 300), done: false, createdAt: Date.now() });
      input.value = ""; saveState(); render();
    }
    body.querySelector(".task-add").addEventListener("click", add);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
    render();
  }

  function buildSettings(body) {
    const wrap = document.createElement("div"); wrap.className = "app-pad";
    wrap.innerHTML = '<h2>Settings</h2>' +
      '<div class="set-row"><label>Display name</label><input id="set-name" style="width:170px;padding:.45rem .6rem;border-radius:8px;border:1px solid var(--line);background:rgba(0,0,0,.25);color:var(--text)"/></div>' +
      '<div class="set-row"><label>Accent colour</label><div class="swatches"></div></div>' +
      '<div class="set-row" style="align-items:flex-start"><label>Wallpaper</label><div class="walls"></div></div>' +
      '<div class="set-row" style="align-items:flex-start"><label>Sessions</label><button class="btn logout-all">Sign out everywhere</button></div>';
    body.appendChild(wrap);
    const name = wrap.querySelector("#set-name"); name.value = me.profile.displayName || "";
    name.addEventListener("input", () => { me.profile.displayName = name.value.slice(0, 60); setHello(); saveState(); });
    const sw = wrap.querySelector(".swatches");
    ACCENTS.forEach((c) => { const s = document.createElement("div"); s.className = "swatch" + (c === me.profile.accent ? " is-on" : ""); s.style.background = c; s.title = c;
      s.addEventListener("click", () => { me.profile.accent = c; applyTheme(); saveState(); sw.querySelectorAll(".swatch").forEach((x) => x.classList.remove("is-on")); s.classList.add("is-on"); }); sw.appendChild(s); });
    const ww = wrap.querySelector(".walls");
    [["aurora", "Aurora"], ["dusk", "Dusk"], ["ocean", "Ocean"], ["slate", "Slate"]].forEach(([id, label]) => {
      const w = document.createElement("div"); w.className = "wall" + (id === me.profile.wallpaper ? " is-on" : ""); w.title = label; w.style.background = wallPreview(id);
      w.addEventListener("click", () => { me.profile.wallpaper = id; applyTheme(); saveState(); ww.querySelectorAll(".wall").forEach((x) => x.classList.remove("is-on")); w.classList.add("is-on"); }); ww.appendChild(w);
    });
    wrap.querySelector(".logout-all").addEventListener("click", async () => { try { await api("POST", "/api/logout-all"); } catch (_) {} location.reload(); });
  }
  function wallPreview(id) {
    return { aurora: "radial-gradient(40px 30px at 20% 20%,#10325a,transparent),radial-gradient(40px 30px at 80% 30%,#2a1450,transparent),#0b1020", dusk: "linear-gradient(160deg,#1a1030,#0b1020)", ocean: "radial-gradient(40px 30px at 30% 80%,#0b5566,transparent),linear-gradient(160deg,#06243a,#0a1020)", slate: "linear-gradient(160deg,#10151f,#0a0d14)" }[id];
  }

  function buildHelp(body) {
    body.innerHTML = '<div class="app-pad">' +
      '<h2>Get Help</h2>' +
      '<p>Stuck on something? Your built-in assistant can help right here — or reach the real 365 Techies team.</p>' +
      '<p><strong>365 Techies</strong> — friendly IT support for homes & businesses across <strong>Bournemouth & Dorset</strong>.</p>' +
      '<p style="color:var(--text)">When we help you, we look after you properly:</p>' +
      '<ul style="color:var(--muted);line-height:1.7;margin:.3rem 0 .6rem;padding-left:1.1rem">' +
      '<li>We call you before we connect — never out of the blue</li>' +
      '<li>We call ahead with an ETA for any visit</li>' +
      '<li>If you’d like, we can text you a reminder when your backup’s due</li>' +
      '<li>You deal with the same friendly faces who get to know you</li></ul>' +
      '<p><a href="mailto:info@365techies.co.uk">info@365techies.co.uk</a></p>' +
      '<p style="margin-top:1rem"><button class="btn btn--primary help-ask">Ask the assistant</button></p>' +
      '<p style="color:var(--muted);font-size:.78rem;margin-top:.8rem">This is a prototype desktop. For real support, email us above.</p></div>';
    body.querySelector(".help-ask").addEventListener("click", () => {
      openApp("assistant");
      setTimeout(() => { const inp = document.querySelector(".ai__input"); if (inp) { inp.value = "I need help with "; inp.focus(); } }, 60);
    });
  }

  function buildCalc(body) {
    body.innerHTML = '<div class="calc"><div class="calc__disp">0</div><div class="calc__grid"></div></div>';
    const disp = body.querySelector(".calc__disp"), grid = body.querySelector(".calc__grid");
    let expr = "";
    const keys = ["C", "(", ")", "/", "7", "8", "9", "*", "4", "5", "6", "-", "1", "2", "3", "+", "0", ".", "⌫", "="];
    function update() { disp.textContent = expr || "0"; }
    function press(k) {
      if (k === "C") expr = "";
      else if (k === "⌫") expr = expr.slice(0, -1);
      else if (k === "=") { try { const v = calcEval(expr); expr = (v == null) ? "Error" : String(v); } catch (_) { expr = "Error"; } }
      else { if (expr === "Error") expr = ""; expr += k; }
      update();
    }
    keys.forEach((k) => { const b = document.createElement("button"); b.className = "calc__key" + (["=", "+", "-", "*", "/"].includes(k) ? " calc__key--op" : "") + (k === "=" ? " calc__key--eq" : ""); b.textContent = k; b.addEventListener("click", () => press(k)); grid.appendChild(b); });
    update();
  }
  // safe arithmetic evaluator (no eval): tokenise -> shunting-yard -> RPN.
  // Unary minus is a real right-associative operator "u" (binds tighter than * /),
  // so e.g. 5*-2 = -10 and -5+2 = -3 evaluate correctly.
  function calcEval(s) {
    const toks = (s.match(/\d+\.?\d*|[()+\-*/]/g) || []);
    if (!toks.length) return null;
    const out = [], ops = [], prec = { "+": 1, "-": 1, "*": 2, "/": 2, "u": 3 };
    let prev = null;
    for (const t of toks) {
      if (/^\d/.test(t)) { out.push(parseFloat(t)); prev = t; continue; }
      if (t === "(") { ops.push(t); prev = t; continue; }
      if (t === ")") {
        while (ops.length && ops[ops.length - 1] !== "(") out.push(ops.pop());
        if (ops.pop() !== "(") return null;
        prev = t; continue;
      }
      // operator
      let op = t;
      const isUnary = (t === "-" || t === "+") && (prev === null || prev === "(" || prev in prec);
      if (isUnary) { if (t === "+") { prev = t; continue; } op = "u"; } // unary + is a no-op
      const right = op === "u"; // right-associative
      while (ops.length && ops[ops.length - 1] !== "(" &&
             (prec[ops[ops.length - 1]] > prec[op] || (prec[ops[ops.length - 1]] === prec[op] && !right)))
        out.push(ops.pop());
      ops.push(op);
      prev = t;
    }
    while (ops.length) { const o = ops.pop(); if (o === "(") return null; out.push(o); }
    const st = [];
    for (const t of out) {
      if (typeof t === "number") st.push(t);
      else if (t === "u") { const a = st.pop(); if (a == null) return null; st.push(-a); }
      else { const b = st.pop(), a = st.pop(); if (a == null || b == null) return null; st.push(t === "+" ? a + b : t === "-" ? a - b : t === "*" ? a * b : a / b); }
    }
    const r = st.pop();
    if (r == null || !isFinite(r) || st.length) return null;
    return Math.round(r * 1e10) / 1e10;
  }

  function buildViewer(body, win) {
    body.innerHTML = '<div class="viewer"><div class="viewer__drop">Drop an image here, or <label class="viewer__pick">choose a file<input type="file" accept="image/*" hidden></label></div><div class="viewer__stage"></div><div class="viewer__bar" hidden><button class="btn viewer__out">−</button><button class="btn viewer__in">+</button><span class="viewer__name"></span></div></div>';
    const stage = body.querySelector(".viewer__stage"), drop = body.querySelector(".viewer__drop"), bar = body.querySelector(".viewer__bar"), nameEl = body.querySelector(".viewer__name");
    let url = null, zoom = 1, img = null;
    function load(file) {
      if (!file || !file.type.startsWith("image/")) { toast("That's not an image file.", "error"); return; }
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(file); zoom = 1;
      stage.innerHTML = ""; img = document.createElement("img"); img.className = "viewer__img"; img.src = url; stage.appendChild(img);
      nameEl.textContent = file.name; drop.hidden = true; bar.hidden = false;
    }
    body.querySelector('input[type=file]').addEventListener("change", (e) => load(e.target.files[0]));
    body.querySelector(".viewer__in").addEventListener("click", () => { zoom = Math.min(zoom + 0.2, 5); if (img) img.style.transform = "scale(" + zoom + ")"; });
    body.querySelector(".viewer__out").addEventListener("click", () => { zoom = Math.max(zoom - 0.2, 0.2); if (img) img.style.transform = "scale(" + zoom + ")"; });
    body.addEventListener("dragover", (e) => { e.preventDefault(); });
    body.addEventListener("drop", (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) load(e.dataTransfer.files[0]); });
    win._onClose = () => { if (url) URL.revokeObjectURL(url); };
  }

  function buildAbout(body) {
    body.innerHTML = '<div class="app-pad">' +
      '<h2>365 Techies AI&nbsp;OS</h2>' +
      '<p>A working prototype of a browser desktop with sign-in, your own saved profile, and a built-in <strong>agentic</strong> AI assistant — it can actually <em>do</em> things on your desktop (notes, tasks, settings), not just chat.</p>' +
      '<p>Everything you change is saved to your account. The assistant is powered by Claude; without a server API key it runs in a clearly-labelled demo mode that still runs simple commands.</p>' +
      '<p style="margin-top:.8rem;color:var(--muted)">Tip: press <strong>Ctrl/⌘ + K</strong> for the command palette.</p>' +
      '<p style="margin-top:.6rem;color:var(--accent)">Built by 365 Techies — Bournemouth & Dorset.</p></div>';
  }

  // App: Off-Grid (Victron VRM) — monitors a Victron system. Live via /api/victron
  // when a VRM token+site are configured on the server; otherwise honest demo data.
  function buildVictron(body, win) {
    body.innerHTML =
      '<div class="vrm">' +
      '<div class="vrm__bar"><span class="vrm__site">Off-Grid</span><span class="vrm__badge">…</span></div>' +
      '<div class="vrm__grid"></div>' +
      '<p class="vrm__note"></p></div>';
    const siteEl = body.querySelector(".vrm__site"), badgeEl = body.querySelector(".vrm__badge");
    const grid = body.querySelector(".vrm__grid"), noteEl = body.querySelector(".vrm__note");
    let pollTimer = null, animTimer = null, closed = false;

    function esc(s) { const d = document.createElement("div"); d.textContent = String(s == null ? "" : s); return d.innerHTML; }
    function bar(pct, cls) { pct = Math.max(0, Math.min(100, Number(pct) || 0)); return '<div class="vrm__track"><span class="vrm__fill ' + (cls || "") + '" style="width:' + pct + '%"></span></div>'; }
    function pickStr(fmt, num, unit) { return fmt != null ? fmt : (num != null ? num + " " + unit : "–"); }

    function render(d) {
      d = d || {};
      const b = d.battery || {}, pv = d.pv || {}, dc = d.dc || {}, ac = d.acLoads || {}, inv = d.inverter || {}, gen = d.generator || {};
      siteEl.textContent = d.siteName || "Off-Grid System";
      const soc = (b.socPct != null) ? Number(b.socPct) : null;
      const cards = [];
      cards.push(
        '<div class="vrm__card vrm__card--wide"><div class="vrm__ch"><span>Battery</span>' +
        '<span class="vrm__tag ' + (/charg/i.test(b.state || "") ? "vrm__tag--g" : "") + '">' + esc(b.state || "—") + '</span></div>' +
        '<div class="vrm__big">' + (soc != null ? soc.toFixed(1) : "–") + '<i>%</i></div>' + bar(soc, "vrm__fill--g") +
        '<div class="vrm__kv">' +
        '<div><span>Voltage</span><b>' + esc(pickStr(b.voltageFmt, b.voltageV, "V")) + '</b></div>' +
        '<div><span>Current</span><b>' + esc(pickStr(b.currentFmt, b.currentA, "A")) + '</b></div>' +
        '<div><span>Time to go</span><b>' + esc(pickStr(b.timeToGoFmt, b.timeToGoH, "h")) + '</b></div>' +
        '</div></div>');
      cards.push('<div class="vrm__card"><div class="vrm__ch"><span>Solar</span>' + (pv.name ? '<span class="vrm__sub">' + esc(pv.name) + '</span>' : '') + '</div>' +
        '<div class="vrm__mid">' + esc(pickStr(pv.powerFmt, pv.powerW, "W")) + '</div>' + (pv.extra ? '<p class="vrm__x">' + esc(pv.extra) + '</p>' : '') + '</div>');
      cards.push('<div class="vrm__card"><div class="vrm__ch"><span>DC Power</span></div><div class="vrm__mid">' + esc(pickStr(dc.powerFmt, dc.powerW, "W")) + '</div></div>');
      const acTxt = (ac.powerFmt != null) ? ac.powerFmt : (ac.powerW ? ac.powerW + " W" : "Off");
      cards.push('<div class="vrm__card"><div class="vrm__ch"><span>AC Loads</span></div><div class="vrm__mid">' + esc(acTxt) + '</div></div>');
      cards.push('<div class="vrm__card"><div class="vrm__ch"><span>Inverter</span></div><div class="vrm__mid vrm__mid--sm">' + esc(inv.state || "—") + '</div></div>');
      cards.push('<div class="vrm__card"><div class="vrm__ch"><span>Generator</span></div><div class="vrm__mid vrm__mid--sm">' + esc(gen.label || "Off") + '</div></div>');
      (d.tanks || []).slice(0, 4).forEach(function (t) {
        cards.push('<div class="vrm__card"><div class="vrm__ch"><span>' + esc(t.name) + '</span><b class="vrm__pct">' + (t.pct != null ? t.pct + "%" : "–") + '</b></div>' + bar(t.pct, "vrm__fill--b") + '</div>');
      });
      if (d.weather && d.weather.tempC != null) {
        cards.push('<div class="vrm__card"><div class="vrm__ch"><span>Weather</span></div><div class="vrm__mid vrm__mid--sm">' + esc(d.weather.tempC + "°C") + '</div><p class="vrm__x">' + esc(d.weather.condition || "") + '</p></div>');
      }
      grid.innerHTML = cards.join("");
    }

    function demoData() {
      const t = Date.now() / 1000;
      const dcW = Math.round(215 + Math.sin(t / 7) * 18 + Math.sin(t / 2.3) * 4);
      const amps = -(dcW / 13.22);
      const volt = 13.22 + Math.sin(t / 11) * 0.05;
      const soc = 87.3 - ((t % 3600) / 3600) * 0.3;
      return {
        siteName: "365 Crafter",
        battery: { socPct: Math.round(soc * 10) / 10, state: "Discharging", voltageFmt: volt.toFixed(2) + " V", currentFmt: amps.toFixed(1) + " A", timeToGoFmt: "42h 8m", currentA: amps },
        dc: { powerFmt: dcW + " W", powerW: dcW },
        pv: { powerFmt: "0 W", powerW: 0, name: "MPPT-277", extra: "0.03 V · 0 A" },
        acLoads: { powerFmt: "Off", powerW: 0 },
        inverter: { state: "Off" }, generator: { label: "Off" },
        tanks: [{ name: "Fresh water", pct: 33 }, { name: "Waste water", pct: 0 }],
        weather: { tempC: 19, condition: "Cloudy" },
      };
    }
    function startDemo() {
      badgeEl.textContent = "DEMO DATA"; badgeEl.className = "vrm__badge vrm__badge--demo";
      noteEl.textContent = "Illustrative demo data. Connect Victron VRM (an access token + site id on the server) to show your real system live.";
      render(demoData());
      animTimer = setInterval(function () { render(demoData()); }, 2500);
    }
    function startLive(data) {
      badgeEl.textContent = "LIVE · VRM"; badgeEl.className = "vrm__badge vrm__badge--live";
      noteEl.textContent = "Live from your Victron VRM — refreshing every 10s.";
      render(data);
      pollTimer = setInterval(function () {
        api("GET", "/api/victron").then(function (r) { if (closed) { clearInterval(pollTimer); return; } if (r && !r.demo && r.data) render(r.data); }).catch(function () {});
      }, 10000);
    }
    api("GET", "/api/victron").then(function (r) {
      if (closed) return;
      if (r && !r.demo && r.data) startLive(r.data); else startDemo();
    }).catch(function () { if (closed) return; startDemo(); });

    win._onClose = function () { closed = true; if (pollTimer) clearInterval(pollTimer); if (animTimer) clearInterval(animTimer); };
  }

  // ================= COMMAND PALETTE + SHORTCUTS =================
  let palette;
  function buildPalette() {
    palette = document.createElement("div"); palette.className = "palette"; palette.hidden = true;
    palette.innerHTML = '<div class="palette__box"><input class="palette__input" placeholder="Type a command…"/><div class="palette__list"></div></div>';
    document.body.appendChild(palette);
    const input = palette.querySelector(".palette__input"), list = palette.querySelector(".palette__list");
    function commands() {
      const c = Object.keys(APPS).map((id) => ({ label: "Open " + APPS[id].title, run: () => openApp(id) }));
      WALLPAPERS.forEach((w) => c.push({ label: "Wallpaper: " + w, run: () => { me.profile.wallpaper = w; applyTheme(); saveState(); } }));
      c.push({ label: "Sign out", run: async () => { try { await api("POST", "/api/logout"); } catch (_) {} location.reload(); } });
      return c;
    }
    function render(filter) {
      const f = (filter || "").toLowerCase(); list.innerHTML = "";
      commands().filter((c) => c.label.toLowerCase().includes(f)).slice(0, 8).forEach((c, i) => {
        const d = document.createElement("div"); d.className = "palette__item" + (i === 0 ? " is-sel" : ""); d.textContent = c.label;
        d.addEventListener("click", () => { c.run(); close(); }); list.appendChild(d);
      });
    }
    function open() { palette.hidden = false; input.value = ""; render(""); setTimeout(() => input.focus(), 20); }
    function close() { palette.hidden = true; }
    input.addEventListener("input", () => render(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") return close();
      if (e.key === "Enter") { const sel = list.querySelector(".is-sel") || list.firstChild; if (sel) sel.click(); }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); const items = [...list.children]; let i = items.findIndex((x) => x.classList.contains("is-sel"));
        items.forEach((x) => x.classList.remove("is-sel")); i = e.key === "ArrowDown" ? Math.min(i + 1, items.length - 1) : Math.max(i - 1, 0); if (items[i]) items[i].classList.add("is-sel");
      }
    });
    palette.addEventListener("click", (e) => { if (e.target === palette) close(); });
    palette._open = open; palette._close = close;
  }
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if (palette) (palette.hidden ? palette._open() : palette._close()); return; }
    if (e.key === "Escape" && palette && !palette.hidden) return;
    if (e.key === "Escape" && focusedId && openWins[focusedId]) {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag !== "input" && tag !== "textarea") closeApp(focusedId);
    }
  });

  tryResume();
})();
