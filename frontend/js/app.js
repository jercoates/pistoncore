// pistoncore/frontend/js/app.js
//
// SPA router and global application state.
// Handles page transitions (List → Status → Editor) via show/hide.
// No URL changes — single page app as per FRONTEND_SPEC.

const App = (() => {

  // ── State ────────────────────────────────────────────────
  const state = {
    currentPage: 'list',
    pistonId: null,
    pistons: [],
    clipboard: null,
    unsavedChanges: false,
    simpleMode: true,
    wsConnected: false,
  };

  // ── Page registry ────────────────────────────────────────
  const pages = {
    list:   document.getElementById('page-list'),
    status: document.getElementById('page-status'),
    editor: document.getElementById('page-editor'),
  };

  // ── Navigation ───────────────────────────────────────────
  function navigate(page, params = {}) {
    if (state.currentPage === 'editor' && state.unsavedChanges && page !== 'editor') {
      Dialog.confirm({
        title: 'Unsaved changes',
        message: 'You have unsaved changes. What would you like to do?',
        buttons: [
          { label: 'Save',    value: 'save',    primary: true },
          { label: 'Discard', value: 'discard', danger: true  },
          { label: 'Cancel',  value: 'cancel'                 },
        ],
        onClose: async (choice) => {
          if (choice === 'save') {
            const saved = await Editor.save();
            if (saved) _doNavigate(page, params);
          } else if (choice === 'discard') {
            state.unsavedChanges = false;
            _doNavigate(page, params);
          }
        },
      });
      return;
    }
    _doNavigate(page, params);
  }

  function _doNavigate(page, params = {}) {
    Object.values(pages).forEach(p => p && p.classList.remove('active'));
    state.currentPage = page;
    if (params.pistonId !== undefined) state.pistonId = params.pistonId;
    const el = pages[page];
    if (el) el.classList.add('active');
    _saveNavState();

    switch (page) {
      case 'list':   ListPage.load(); break;
      case 'status': StatusPage.load(state.pistonId); break;
      case 'editor': Editor.load(state.pistonId); break;
    }
  }

  // ── Browser refresh restore ──────────────────────────────
  function _saveNavState() {
    try {
      localStorage.setItem('pistoncore_nav', JSON.stringify({
        page: state.currentPage,
        pistonId: state.pistonId,
      }));
    } catch {}
  }

  function _restoreNavState() {
    try {
      const saved = localStorage.getItem('pistoncore_nav');
      if (saved) {
        const { page, pistonId } = JSON.parse(saved);
        if (page && pages[page]) {
          navigate(page, { pistonId });
          return;
        }
      }
    } catch {}
    navigate('list');
  }

  // ── WebSocket connection ─────────────────────────────────
  // /ws doesn't exist yet — connects silently, backs off exponentially,
  // stops retrying after 5 attempts until the user reloads.
  let _ws = null;
  let _wsReconnectTimer = null;
  let _wsAttempts = 0;
  const _WS_MAX_ATTEMPTS = 5;
  const _WS_BACKOFF = [2000, 5000, 10000, 30000, 60000];

  function _connectWebSocket() {
    if (_wsAttempts >= _WS_MAX_ATTEMPTS) {
      // Give up silently — /ws not implemented yet
      console.info('PistonCore: WebSocket not available (/ws not implemented). Live updates disabled.');
      return;
    }

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/ws`;

    try {
      _ws = new WebSocket(url);
    } catch {
      _setWsStatus(false);
      _scheduleWsReconnect();
      return;
    }

    _ws.onopen = () => {
      _wsAttempts = 0;
      _setWsStatus(true);
      if (_wsReconnectTimer) { clearTimeout(_wsReconnectTimer); _wsReconnectTimer = null; }
    };

    _ws.onmessage = (event) => {
      try { _handleWsMessage(JSON.parse(event.data)); } catch {}
    };

    _ws.onclose = () => {
      _setWsStatus(false);
      _scheduleWsReconnect();
    };

    _ws.onerror = () => {
      // Suppress error — onclose will fire next and schedule reconnect
    };
  }

  function _scheduleWsReconnect() {
    if (_wsReconnectTimer) return;
    _wsAttempts++;
    if (_wsAttempts >= _WS_MAX_ATTEMPTS) {
      console.info('PistonCore: WebSocket gave up after', _WS_MAX_ATTEMPTS, 'attempts.');
      return;
    }
    const delay = _WS_BACKOFF[Math.min(_wsAttempts - 1, _WS_BACKOFF.length - 1)];
    _wsReconnectTimer = setTimeout(() => {
      _wsReconnectTimer = null;
      _connectWebSocket();
    }, delay);
  }

  function _setWsStatus(connected) {
    state.wsConnected = connected;
    const banner = document.getElementById('ws-banner');
    const headerStatus = document.getElementById('header-status');
    if (banner) banner.classList.toggle('visible', !connected && _wsAttempts < _WS_MAX_ATTEMPTS);
    if (headerStatus) {
      headerStatus.className = 'header-status ' + (connected ? 'connected' : 'disconnected');
      headerStatus.textContent = connected ? 'HA Connected' : 'HA Disconnected';
    }
  }

  function _handleWsMessage(msg) {
    if (msg.type === 'run_complete' || msg.type === 'run_log') {
      if (state.currentPage === 'status') StatusPage.onWsMessage(msg);
    }
  }

  // ── Piston cache helpers ─────────────────────────────────
  async function loadPistons() {
    try {
      state.pistons = await API.getPistons();
    } catch (e) {
      state.pistons = [];
      console.error('Failed to load pistons:', e.message);
    }
    return state.pistons;
  }

  function getPistonFromCache(id) {
    return state.pistons.find(p => p.id === id) || null;
  }

  // ── Init ─────────────────────────────────────────────────
  function init() {
    document.getElementById('btn-globals')?.addEventListener('click', () => GlobalsDrawer.open());

    document.addEventListener('click', () => ContextMenu.hide());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        ContextMenu.hide();
        Wizard.close();
        Dialog.close();
      }
    });

    // Start WebSocket with a short delay so it doesn't block initial render
    setTimeout(_connectWebSocket, 2000);

    // Navigate after a tick so all page modules (list.js, status.js etc.) are defined
    setTimeout(_restoreNavState, 0);
  }

  return { state, navigate, loadPistons, getPistonFromCache, init };

})();

// ── Globals Drawer ───────────────────────────────────────
const GlobalsDrawer = (() => {
  const drawer = document.getElementById('globals-drawer');

  async function open() {
    drawer?.classList.add('open');
    const body = document.getElementById('globals-drawer-body');
    if (!body) return;
    body.innerHTML = '<div class="wizard-loading"><div class="spinner"></div> Loading...</div>';
    try {
      const globals = await API.getGlobals();
      const entries = Object.values(globals);
      if (!entries.length) {
        body.innerHTML = '<p class="text-muted" style="font-size:12px">No global variables defined.</p>';
        return;
      }
      body.innerHTML = entries.map(g => `
        <div class="global-row">
          <div class="global-name">@${g.display_name}</div>
          <div class="global-value">${g.current_value ?? '—'}</div>
          <div class="global-type">${g.type}</div>
        </div>
      `).join('');
    } catch (e) {
      body.innerHTML = `<div class="wizard-error">${e.message}</div>`;
    }
  }

  function close() { drawer?.classList.remove('open'); }

  document.getElementById('globals-drawer-close')?.addEventListener('click', close);

  return { open, close };
})();

// ── Dialog ───────────────────────────────────────────────
const Dialog = (() => {
  const backdrop = document.getElementById('dialog-backdrop');
  const box = document.getElementById('dialog-box');
  let _onClose = null;

  function confirm({ title, message, buttons, onClose }) {
    if (!backdrop || !box) {
      const ok = window.confirm(`${title}\n\n${message}`);
      onClose && onClose(ok ? (buttons?.[0]?.value || 'ok') : 'cancel');
      return;
    }
    _onClose = onClose;
    box.querySelector('.dialog-title').textContent = title;
    box.querySelector('.dialog-message').textContent = message;
    const actionsEl = box.querySelector('.dialog-actions');
    actionsEl.innerHTML = '';
    (buttons || [{ label: 'OK', value: 'ok', primary: true }, { label: 'Cancel', value: 'cancel' }])
      .forEach(btn => {
        const el = document.createElement('button');
        el.textContent = btn.label;
        el.className = btn.primary ? 'btn btn-primary' : btn.danger ? 'btn btn-danger' : 'btn';
        el.addEventListener('click', () => { close(); _onClose && _onClose(btn.value); });
        actionsEl.appendChild(el);
      });
    backdrop.classList.add('open');
  }

  function close() { backdrop?.classList.remove('open'); _onClose = null; }

  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) { close(); _onClose && _onClose('cancel'); }
  });

  return { confirm, close };
})();

// ── Context Menu ─────────────────────────────────────────
const ContextMenu = (() => {
  const menu = document.getElementById('context-menu');
  let _onAction = null;

  function show(x, y, items, onAction) {
    if (!menu) return;
    _onAction = onAction;
    menu.innerHTML = '';
    items.forEach(item => {
      if (item === '---') {
        const d = document.createElement('div');
        d.className = 'context-menu-divider';
        menu.appendChild(d);
        return;
      }
      const el = document.createElement('div');
      el.className = 'context-menu-item' + (item.danger ? ' danger' : '');
      el.textContent = (item.icon ? item.icon + ' ' : '') + item.label;
      el.addEventListener('click', (e) => { e.stopPropagation(); hide(); _onAction && _onAction(item.action); });
      menu.appendChild(el);
    });
    menu.classList.add('visible');
    const rect = menu.getBoundingClientRect();
    menu.style.left = Math.min(x, window.innerWidth - rect.width - 8) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - rect.height - 8) + 'px';
  }

  function hide() { menu?.classList.remove('visible'); _onAction = null; }

  return { show, hide };
})();
