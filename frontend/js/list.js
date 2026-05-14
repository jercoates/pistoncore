// pistoncore/frontend/js/list.js
//
// Page 1 — Piston List
// The home screen. Loads all pistons, groups by folder, renders rows.
// Handles search, new piston, import, folder creation.

const ListPage = (() => {

  const container = document.getElementById('page-list');

  // ── Render ───────────────────────────────────────────────
  async function load() {
    renderShell();
    await refresh();
  }

  function renderShell() {
    if (!container) return;
    container.innerHTML = `
      <div class="list-header">
        <h1>PistonCore</h1>
        <div class="header-spacer"></div>
        <div class="list-header-actions">
          <button class="btn btn-ghost btn-sm" id="btn-globals">⚙ Globals</button>
          <button class="btn btn-ghost btn-sm" id="btn-ai-prompt">📋 Copy AI Prompt</button>
          <button class="btn btn-primary btn-sm" id="btn-new-piston">+ New</button>
        </div>
      </div>

      <div class="list-search">
        <input type="text" id="piston-search" placeholder="Search pistons..." autocomplete="off" />
      </div>

      <div id="piston-list-body">
        <div class="wizard-loading"><div class="spinner"></div> Loading pistons...</div>
      </div>

      <div class="list-footer">
        <button class="btn btn-ghost btn-sm" id="btn-new-folder">+ New Folder</button>
        <button class="btn btn-ghost btn-sm" id="btn-import">Import</button>
      </div>

      <div class="mode-notice">
        PistonCore manages automations in its own subfolder.
        Automations created directly in Home Assistant are not visible or managed here.
      </div>
    `;

    // Wire buttons
    document.getElementById('btn-new-piston')?.addEventListener('click', createNewPiston);
    document.getElementById('btn-new-folder')?.addEventListener('click', showNewFolderInput);
    document.getElementById('btn-import')?.addEventListener('click', showImportDialog);
    document.getElementById('btn-globals')?.addEventListener('click', () => GlobalsDrawer.open());
    document.getElementById('btn-ai-prompt')?.addEventListener('click', copyAIPrompt);

    // Search
    let _searchTimer = null;
    document.getElementById('piston-search')?.addEventListener('input', (e) => {
      clearTimeout(_searchTimer);
      _searchTimer = setTimeout(() => renderList(e.target.value.trim()), 200);
    });
  }

  let _allPistons = [];

  async function refresh() {
    _allPistons = await App.loadPistons();
    renderList('');
  }

  // ── List rendering ────────────────────────────────────────
  function renderList(searchQuery) {
    const body = document.getElementById('piston-list-body');
    if (!body) return;

    let pistons = _allPistons;

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      pistons = pistons.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.folder || '').toLowerCase().includes(q)
      );
    }

    if (pistons.length === 0 && _allPistons.length === 0) {
      body.innerHTML = `
        <div style="text-align:center; padding: 48px 0; color: var(--text-muted); font-size:13px">
          No pistons yet.<br><br>
          <button class="btn btn-primary" onclick="ListPage.createNewPiston()">+ Create your first piston</button>
        </div>
      `;
      return;
    }

    if (pistons.length === 0) {
      body.innerHTML = `<div style="color:var(--text-muted); font-size:13px; padding: 16px 0">No pistons match your search.</div>`;
      return;
    }

    // Group by folder
    const folders = _groupByFolder(pistons);
    const folderNames = Object.keys(folders).sort((a, b) => {
      if (a === 'Uncategorized') return 1;
      if (b === 'Uncategorized') return -1;
      return a.localeCompare(b);
    });

    body.innerHTML = folderNames.map(folder => {
      const items = folders[folder];
      return `
        <div class="folder-section">
          <div class="folder-header">
            <span class="folder-name">${_esc(folder)}</span>
            <span class="folder-count">(${items.length})</span>
            <div class="folder-divider"></div>
          </div>
          ${items.map(renderPistonRow).join('')}
        </div>
      `;
    }).join('');

    // Wire row clicks
    body.querySelectorAll('.piston-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.piston-pause-btn')) return;
        const id = row.dataset.pistonId;
        App.navigate('status', { pistonId: id });
      });

      row.querySelector('.piston-pause-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = row.dataset.pistonId;
        togglePause(id);
      });
    });
  }

  function renderPistonRow(piston) {
    const enabled = piston.enabled !== false;
    const result = _resultIcon(piston.last_result);
    const time = piston.last_ran ? _formatTime(piston.last_ran) : 'Never';
    const pauseLabel = enabled ? 'Pause' : 'Resume';

    return `
      <div class="piston-row" data-piston-id="${_esc(piston.id)}">
        <div class="piston-enabled-dot ${enabled ? 'enabled' : 'disabled'}"></div>
        <div class="piston-name">${_esc(piston.name || 'Untitled')}</div>
        <div class="piston-result">${result}</div>
        <div class="piston-time">${_esc(time)}</div>
        <button class="piston-pause-btn btn-ghost">${pauseLabel}</button>
      </div>
    `;
  }

  // ── Folder grouping ───────────────────────────────────────
  function _groupByFolder(pistons) {
    const folders = {};
    pistons.forEach(p => {
      const folder = p.folder && p.folder.trim() ? p.folder.trim() : 'Uncategorized';
      if (!folders[folder]) folders[folder] = [];
      folders[folder].push(p);
    });
    return folders;
  }

  // ── Actions ──────────────────────────────────────────────
  async function createNewPiston() {
    NewPistonModal.open();
  }

  async function togglePause(pistonId) {
    const piston = _allPistons.find(p => p.id === pistonId);
    if (!piston) return;
    try {
      const full = await API.getPiston(pistonId);
      full.enabled = !full.enabled;
      await API.savePiston(pistonId, full);
      piston.enabled = full.enabled;
      renderList(document.getElementById('piston-search')?.value || '');
    } catch (e) {
      showBanner('error', `Could not update piston: ${e.message}`);
    }
  }

  function showNewFolderInput() {
    const body = document.getElementById('piston-list-body');
    if (!body) return;
    // Remove any existing input
    document.getElementById('new-folder-row')?.remove();

    const row = document.createElement('div');
    row.id = 'new-folder-row';
    row.className = 'new-folder-row';
    row.innerHTML = `
      <input type="text" id="new-folder-input" placeholder="Folder name..." maxlength="64" autofocus />
      <button class="btn btn-sm btn-primary" id="new-folder-confirm">Create</button>
      <button class="btn btn-sm" id="new-folder-cancel">Cancel</button>
    `;

    const footer = container.querySelector('.list-footer');
    footer?.before(row);

    const input = document.getElementById('new-folder-input');
    input?.focus();

    document.getElementById('new-folder-confirm')?.addEventListener('click', () => {
      const name = input?.value.trim();
      if (name) {
        // Folder created — just shows in the list when a piston is assigned to it
        // Folders don't exist independently; they appear when pistons are in them
        row.remove();
        showBanner('info', `Folder "${name}" will appear when you assign a piston to it.`);
      }
    });

    document.getElementById('new-folder-cancel')?.addEventListener('click', () => {
      row.remove();
    });

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('new-folder-confirm')?.click();
      if (e.key === 'Escape') document.getElementById('new-folder-cancel')?.click();
    });
  }

  function showImportDialog() {
    // Delegates to Editor.openImport() — paste modal + role mapping flow.
    // DESIGN.md Section 6.3.
    Editor.openImport();
  }

  function copyAIPrompt() {
    // Placeholder — AI Prompt feature redesign pending (DESIGN.md Section 11)
    const msg = 'AI Prompt feature is being redesigned. Check DESIGN.md Section 11.';
    try {
      navigator.clipboard.writeText(msg);
      showBanner('info', 'AI Prompt copied to clipboard.');
    } catch {
      showBanner('info', msg);
    }
  }

  // ── Helpers ──────────────────────────────────────────────
  function _resultIcon(result) {
    if (result === true  || result === 'true'  || result === 'ok')    return '✅';
    if (result === false || result === 'false' || result === 'error') return '❌';
    return '—';
  }

  function _formatTime(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('en-US', { hour12: false });
    } catch { return iso; }
  }

  function _esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function showBanner(type, message) {
    const body = document.getElementById('piston-list-body');
    if (!body) return;
    const existing = container.querySelector('.page-banner');
    existing?.remove();
    const b = document.createElement('div');
    b.className = `banner banner-${type} page-banner`;
    b.textContent = message;
    container.querySelector('.list-header')?.after(b);
    setTimeout(() => b.remove(), 5000);
  }

  return { load, refresh, createNewPiston };

})();
