// pistoncore/frontend/js/app.js
//
// SPA router and global application state.
// Handles page transitions (List → Status → Editor) via show/hide.
// No URL changes — single page app as per FRONTEND_SPEC.
//
// Usage:
//   App.navigate('list')
//   App.navigate('status', { pistonId: 'abc123' })
//   App.navigate('editor', { pistonId: 'abc123' })

const App = (() => {

  // ── State ────────────────────────────────────────────────
  const state = {
    currentPage: 'list',
    pistonId: null,          // currently viewed/edited piston
    pistons: [],             // cached list from backend
    clipboard: null,         // cut/copied statement node
    unsavedChanges: false,   // editor has unsaved changes
    simpleMode: true,        // Simple / Advanced toggle (default Simple)
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
    // Guard unsaved changes when leaving editor
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
          // cancel — do nothing
        },
      });
      return;
    }
    _doNavigate(page, params);
  }

  function _doNavigate(page, params = {}) {
    // Hide all pages
    Object.values(pages).forEach(p => p && p.classList.remove('active'));

    state.currentPage = page;
    if (params.pistonId !== undefined) state.pistonId = params.pistonId;

    const el = pages[page];
    if (el) el.classList.add('active');

    // Persist navigation state for browser refresh
    _saveNavState();

    // Trigger page-specific load
    switch (page) {
      case 'list':
        ListPage.load();
        break;
      case 'status':
        StatusPage.load(state.pistonId);
        break;
      case 'editor':
        Editor.load(state.pistonId);
        break;
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
      if (!saved) return;
      const { page, pistonId } = JSON.parse(saved);
      if (page && pages[page]) {
        navigate(page, { pistonId });
        return;
      }
    } catch {}
    navigate('list');
  }

  // ── WebSocket connection ─────────────────────────────────
  let _ws = null;
  let _wsReconnectTimer = null;

  function _connectWebSocket() {
    // /ws endpoint — live log updates, run status events
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
      _setWsStatus(true);
      if (_wsReconnectTimer) {
        clearTimeout(_wsReconnectTimer);
        _wsReconnectTimer = null;
      }
    };

    _ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        _handleWsMessage(msg);
      } catch {}
    };

    _ws.onclose = () => {
      _setWsStatus(false);
      _scheduleWsReconnect();
    };

    _ws.onerror = () => {
      _setWsStatus(false);
    };
  }

  function _scheduleWsReconnect() {
    if (_wsReconnectTimer) return;
    _wsReconnectTimer = setTimeout(() => {
      _wsReconnectTimer = null;
      _connectWebSocket();
    }, 5000);
  }

  function _setWsStatus(connected) {
    state.wsConnected = connected;
    const banner = document.getElementById('ws-banner');
    const headerStatus = document.getElementById('header-status');

    if (banner) {
      banner.classList.toggle('visible', !connected);
    }

    if (headerStatus) {
      headerStatus.className = 'header-status ' + (connected ? 'connected' : 'disconnected');
      headerStatus.textContent = connected ? 'HA Connected' : 'HA Disconnected';
    }
  }

  function _handleWsMessage(msg) {
    // Route WebSocket messages to the appropriate page handler
    if (msg.type === 'run_complete' || msg.type === 'run_log') {
      if (state.currentPage === 'status') {
        StatusPage.onWsMessage(msg);
      }
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
    // Wire header buttons
    document.getElementById('btn-globals')?.addEventListener('click', () => {
      GlobalsDrawer.open();
    });

    // Set up context menu dismiss
    document.addEventListener('click', () => {
      ContextMenu.hide();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        ContextMenu.hide();
        Wizard.close();
        Dialog.close();
      }
    });

    // Start WebSocket (will silently fail if /ws not implemented yet)
    _connectWebSocket();

    // Restore navigation state from last session
    _restoreNavState();
  }

  return {
    state,
    navigate,
    loadPistons,
    getPistonFromCache,
    init,
  };

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
      if (entries.length === 0) {
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

  function close() {
    drawer?.classList.remove('open');
  }

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
      // Fallback to native confirm for missing DOM
      const ok = window.confirm(`${title}\n\n${message}`);
      onClose && onClose(ok ? buttons[0]?.value : 'cancel');
      return;
    }

    _onClose = onClose;

    const titleEl = box.querySelector('.dialog-title');
    const msgEl = box.querySelector('.dialog-message');
    const actionsEl = box.querySelector('.dialog-actions');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;

    if (actionsEl) {
      actionsEl.innerHTML = '';
      (buttons || [{ label: 'OK', value: 'ok', primary: true }, { label: 'Cancel', value: 'cancel' }])
        .forEach(btn => {
          const el = document.createElement('button');
          el.textContent = btn.label;
          el.className = btn.primary ? 'btn btn-primary' : btn.danger ? 'btn btn-danger' : 'btn';
          el.addEventListener('click', () => {
            close();
            _onClose && _onClose(btn.value);
          });
          actionsEl.appendChild(el);
        });
    }

    backdrop.classList.add('open');
  }

  function close() {
    backdrop?.classList.remove('open');
    _onClose = null;
  }

  // Backdrop click closes
  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      close();
      _onClose && _onClose('cancel');
    }
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
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        hide();
        _onAction && _onAction(item.action);
      });
      menu.appendChild(el);
    });

    // Position — keep on screen
    menu.style.display = 'block';
    menu.classList.add('visible');
    const rect = menu.getBoundingClientRect();
    const finalX = Math.min(x, window.innerWidth - rect.width - 8);
    const finalY = Math.min(y, window.innerHeight - rect.height - 8);
    menu.style.left = finalX + 'px';
    menu.style.top = finalY + 'px';
  }

  function hide() {
    menu?.classList.remove('visible');
    _onAction = null;
  }

  return { show, hide };
})();
