// pistoncore/frontend/js/editor.js
// Updated for WebCoRE-style top-to-bottom flow (screenshots 9, 16, 37)

const Editor = (() => {

  const container = document.getElementById('page-editor');
  let _piston = null;
  let _stmtCounter = 0;

  async function load(pistonId) {
    if (!container) return;
    container.innerHTML = `<div class="wizard-loading"><div class="spinner"></div> Loading...</div>`;

    try {
      _piston = await API.getPiston(pistonId);
      _stmtCounter = _highestStmtId(_piston);
      App.state.unsavedChanges = false;
      render();
    } catch (e) {
      container.innerHTML = `<div class="banner banner-error">Could not load piston: ${_esc(e.message)}</div>`;
    }
  }

  function render() {
    if (!container || !_piston) return;
    const p = _piston;
    const isSimple = App.state.simpleMode;

    container.innerHTML = `
      <!-- Editor nav, title, meta... (unchanged from current) -->
      <div class="editor-nav">...</div>
      <div class="editor-title-row">...</div>
      <div class="editor-meta-row">...</div>

      <!-- Variables section (unchanged) -->
      <div class="editor-section" id="section-variables" ${isSimple ? 'style="display:none"' : ''}>...</div>

      <!-- Triggers & Conditions (unchanged) -->
      <div class="editor-section">... Triggers ...</div>
      <div class="editor-section">... Conditions ...</div>

      <!-- Actions — Main focus -->
      <div class="editor-section">
        <div class="editor-section-header">
          <span class="section-toggle">▼</span>
          <span class="section-name">Actions</span>
        </div>
        <div class="action-tree" id="tree-actions">
          <div><span class="kw">execute</span></div>
          ${_renderActionNodes(p.actions || [], 1)}
          <div class="ghost-text" data-insert="action" data-index="${(p.actions||[]).length}">+ add a new statement</div>
          <div><span class="kw">end execute;</span></div>
        </div>
      </div>

      <!-- Bottom bar (unchanged) -->
      <div class="editor-bottom-bar">...</div>
    `;

    _wireEditorEvents();
    _markUnsaved(false);
  }

  // ── Improved Action Rendering (WebCoRE style) ─────────────────────────────
  let _stmtNum = 1;

  function _renderActionNodes(nodes, depth = 1) {
    const pad = `indent-${Math.min(depth, 6)}`;
    let html = '';

    nodes.forEach((node, i) => {
      const id = node.id || `stmt-${Date.now()}-${i}`;
      const num = _stmtNum++;

      if (node.type === 'if_block') {
        html += `<div class="stmt-node ${pad}" data-type="if_block" data-id="${_esc(id)}">
          <span class="stmt-num">${num}</span><span class="kw">if</span>
        </div>`;

        (node.conditions || []).forEach(c => {
          html += `<div class="stmt-node indent-${depth+1} condition-inline">${_conditionText(c)}</div>`;
        });

        html += `<div class="${pad}"><span class="kw">then</span></div>`;
        html += _renderActionNodes(node.then_actions || [], depth + 2);

        if (node.else_if_actions && node.else_if_actions.length) {
          node.else_if_actions.forEach((elif, idx) => {
            html += `<div class="${pad}"><span class="kw">else if</span></div>`;
            (elif.conditions || []).forEach(c => {
              html += `<div class="stmt-node indent-${depth+2} condition-inline">${_conditionText(c)}</div>`;
            });
            html += _renderActionNodes(elif.actions || [], depth + 3);
          });
        }

        if (node.else_actions && node.else_actions.length) {
          html += `<div class="${pad}"><span class="kw">else</span></div>`;
          html += _renderActionNodes(node.else_actions, depth + 2);
        }

        html += `<div class="${pad}"><span class="kw">end if;</span></div>`;

      } else if (node.type === 'with_block') {
        html += `<div class="stmt-node ${pad}" data-type="with_block" data-id="${_esc(id)}">
          <span class="stmt-num">${num}</span><span class="kw">with</span> ${node.devices?.map(d => `(${d})`).join(', ') || ''}
        </div>`;
        html += `<div class="${pad}"><span class="kw">do</span></div>`;
        html += _renderActionNodes(node.actions || [], depth + 1);
        html += `<div class="${pad}"><span class="kw">end with;</span></div>`;

      } else {
        // Simple statements (Turn on light, etc.)
        html += `<div class="stmt-node ${pad}" data-type="${_esc(node.type)}" data-id="${_esc(id)}">
          <span class="stmt-num">${num}</span>${_nodeLabel(node)}
        </div>`;
      }

      // Ghost insertion point after every statement
      html += `<div class="ghost-text ${pad}" data-insert="action" data-parent="${id}" data-index="${i+1}">+ add a new statement</div>`;
    });

    return html;
  }

  // ... rest of the file (helpers, event wiring, etc.) stays the same ...
  // Just make sure _conditionText, _nodeLabel, _waitText, etc. are defined.

  return { load, render /* + other public methods */ };
})();