// pistoncore/frontend/js/editor.js
//
// Page 3 — Piston Editor
// Renders the action tree as an editable document.
// Ghost text at every insertion point opens the Wizard modal.
// Right-click shows the context menu.
// Two distinct save operations: Save to PistonCore | Deploy to HA.

const Editor = (() => {

  const container = document.getElementById('page-editor');
  let _piston = null;       // full piston JSON in memory
  let _stmtCounter = 0;     // for generating unique stmt IDs

  // ── Load ─────────────────────────────────────────────────
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

  // ── Render ───────────────────────────────────────────────
  function render() {
    if (!container || !_piston) return;
    const p = _piston;
    const isSimple = App.state.simpleMode;
    const target = p.compile_target || 'Native HA Script';
    const isPyScript = target.toLowerCase().includes('pyscript');

    container.innerHTML = `
      <!-- Editor nav -->
      <div class="editor-nav">
        <button class="btn btn-ghost btn-sm" id="btn-status-return">← Status</button>
        <div style="flex:1"></div>
        <button class="btn btn-ghost btn-sm" id="btn-new-from-editor">+ New Piston</button>
      </div>

      <!-- Piston name and description -->
      <div class="editor-title-row">
        <div class="editor-field-group">
          <label class="editor-field-label">Piston Name</label>
          <input type="text" id="piston-name" value="${_esc(p.name || '')}" placeholder="Give this piston a name..." />
        </div>
        <div class="editor-field-group">
          <label class="editor-field-label">Description</label>
          <input type="text" id="piston-desc" value="${_esc(p.description || '')}" placeholder="Optional description..." />
        </div>
      </div>

      <!-- Editor meta row: folder, mode, enabled, simple/adv, compile target -->
      <div class="editor-meta-row">
        <div class="editor-field-group">
          <label class="editor-field-label">Folder</label>
          <select id="editor-folder">
            ${_folderOptions(p.folder)}
          </select>
        </div>
        <div class="editor-field-group">
          <label class="editor-field-label">Mode</label>
          <select id="editor-mode">
            <option value="single" ${p.mode === 'single' || !p.mode ? 'selected' : ''}>Single</option>
            <option value="queued" ${p.mode === 'queued' ? 'selected' : ''}>Queued</option>
            <option value="parallel" ${p.mode === 'parallel' ? 'selected' : ''}>Parallel</option>
          </select>
        </div>
        <div class="editor-field-group">
          <label class="editor-field-label">Status</label>
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer; padding-top:4px">
            <input type="checkbox" id="editor-enabled" ${p.enabled !== false ? 'checked' : ''} />
            <span style="font-size:13px">Enabled</span>
          </label>
        </div>
        <div class="simple-adv-toggle">
          <button class="${isSimple ? 'active' : ''}" id="toggle-simple">Simple</button>
          <button class="${!isSimple ? 'active' : ''}" id="toggle-advanced">Advanced</button>
        </div>
        <div class="compile-target-badge ${isPyScript ? 'pyscript' : ''}" id="compile-target-badge" title="Auto-detected compile target">
          ${_esc(target)}
        </div>
      </div>

      <!-- Piston Variables (Advanced only) -->
      <div class="editor-section" id="section-variables" ${isSimple ? 'style="display:none"' : ''}>
        <div class="editor-section-header">
          <span class="section-toggle">▼</span>
          <span class="section-name">Piston Variables</span>
          <button class="btn btn-ghost btn-sm section-add-btn" id="btn-add-variable">+ Add</button>
        </div>
        <div class="action-tree" id="tree-variables">
          ${_renderVariablesList(p.variables || [])}
        </div>
      </div>

      <!-- Triggers -->
      <div class="editor-section">
        <div class="editor-section-header">
          <span class="section-toggle">▼</span>
          <span class="section-name">Triggers</span>
        </div>
        <div class="action-tree" id="tree-triggers">
          ${_renderTriggers(p.triggers || [])}
          <div class="ghost-text" data-insert="trigger" data-index="${(p.triggers||[]).length}">+ add a new trigger</div>
        </div>
      </div>

      <!-- Conditions -->
      <div class="editor-section">
        <div class="editor-section-header">
          <span class="section-toggle">▼</span>
          <span class="section-name">Conditions</span>
        </div>
        <div class="action-tree" id="tree-conditions">
          ${_renderConditions(p.conditions || [])}
          <div class="ghost-text" data-insert="condition" data-index="${(p.conditions||[]).length}">+ add a new condition</div>
        </div>
      </div>

      <!-- Actions -->
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

      <!-- Bottom bar -->
      <div class="editor-bottom-bar">
        <button class="btn btn-danger" id="btn-test-editor">▶ Test — Live Fire ⚠</button>
        <div class="editor-bottom-bar-spacer"></div>
        <div class="log-level-selector">
          Log Level:
          <select id="editor-log-level">
            <option value="full" ${p.log_level === 'full' || !p.log_level ? 'selected' : ''}>Full</option>
            <option value="minimal" ${p.log_level === 'minimal' ? 'selected' : ''}>Minimal</option>
            <option value="none" ${p.log_level === 'none' ? 'selected' : ''}>None</option>
          </select>
        </div>
        <button class="btn btn-primary" id="btn-save" title="Save piston JSON to PistonCore storage">💾 Save to PistonCore</button>
        <button class="btn btn-teal" id="btn-deploy" title="Compile and deploy to Home Assistant" ${!p.id ? 'disabled' : ''}>🚀 Deploy to HA</button>
      </div>
    `;

    _wireEditorEvents();
    _markUnsaved(false);
  }

  // ── Tree rendering ───────────────────────────────────────
  function _renderTriggers(triggers) {
    if (!triggers.length) return '';
    return triggers.map((t, i) => {
      const icon = '⚡ ';
      const text = _conditionText(t);
      return `<div class="stmt-node" data-type="trigger" data-index="${i}" data-id="${_esc(t.id || '')}">
        <span class="stmt-num">${i+1}</span>
        <span class="trigger-icon">${icon}</span>${_esc(text)}
      </div>`;
    }).join('');
  }

  function _renderConditions(conditions) {
    if (!conditions.length) return '';
    return conditions.map((c, i) => {
      return `<div class="stmt-node" data-type="condition" data-index="${i}" data-id="${_esc(c.id || '')}">
        <span class="stmt-num">${i+1}</span>${_esc(_conditionText(c))}
      </div>`;
    }).join('');
  }

  let _stmtNum = 1;  // reset each full render

  function _renderActionNodes(nodes, depth) {
    const pad = `indent-${Math.min(depth, 5)}`;
    let html = '';

    nodes.forEach((node, i) => {
      const type = node.type;
      const id = node.id || '';
      const num = _stmtNum++;

      if (type === 'if_block') {
        html += `<div class="stmt-node ${pad}" data-type="if_block" data-id="${_esc(id)}">
          <span class="stmt-num">${num}</span><span class="kw">if</span>
        </div>`;
        (node.conditions || []).forEach(c => {
          html += `<div class="indent-${Math.min(depth+1,5)}">${_esc(_conditionText(c))}</div>`;
        });
        html += `<div class="${pad}"><span class="kw-brace">{</span></div>`;
        html += `<div class="indent-${Math.min(depth+1,5)}"><span class="kw">when true</span></div>`;
        html += _renderActionNodes(node.then_actions || [], depth + 2);
        html += `<div class="ghost-text indent-${Math.min(depth+2,5)}" data-insert="action" data-parent="${id}" data-branch="then">+ add a new statement</div>`;
        if (node.else_actions !== undefined) {
          html += `<div class="indent-${Math.min(depth+1,5)}"><span class="kw">when false</span></div>`;
          html += _renderActionNodes(node.else_actions || [], depth + 2);
          html += `<div class="ghost-text indent-${Math.min(depth+2,5)}" data-insert="action" data-parent="${id}" data-branch="else">+ add a new statement</div>`;
        }
        html += `<div class="${pad}"><span class="kw-brace">}</span></div>`;
        html += `<div class="${pad}"><span class="kw">end if;</span></div>`;

      } else if (type === 'with_block') {
        html += `<div class="stmt-node ${pad}" data-type="with_block" data-id="${_esc(id)}">
          <span class="stmt-num">${num}</span><span class="kw">with</span>
        </div>`;
        (node.devices || []).forEach(d => {
          html += `<div class="indent-${Math.min(depth+1,5)}">(${_esc(d)})</div>`;
        });
        html += `<div class="${pad}"><span class="kw">do</span></div>`;
        html += _renderActionNodes(node.actions || [], depth + 1);
        html += `<div class="ghost-text indent-${Math.min(depth+1,5)}" data-insert="task" data-parent="${id}">+ add a new task</div>`;
        html += `<div class="${pad}"><span class="kw">end with;</span></div>`;

      } else if (type === 'repeat_block') {
        html += `<div class="stmt-node ${pad}" data-type="repeat_block" data-id="${_esc(id)}">
          <span class="stmt-num">${num}</span><span class="kw">repeat</span>
        </div>`;
        html += `<div class="${pad}"><span class="kw">do</span></div>`;
        html += _renderActionNodes(node.actions || [], depth + 1);
        html += `<div class="ghost-text indent-${Math.min(depth+1,5)}" data-insert="action" data-parent="${id}">+ add a new statement</div>`;
        html += `<div class="${pad}"><span class="kw">until</span></div>`;
        html += `<div class="${pad}"><span class="kw">end repeat;</span></div>`;

      } else if (type === 'wait') {
        const waitText = _waitText(node);
        const tooltip = node.wait_type === 'time'
          ? `<span class="wait-tooltip-trigger">
              <span class="wait-info-icon">ⓘ</span>
              <span class="wait-tooltip">If this piston reaches this step after the target time has already passed today, it will wait until tomorrow. Make sure this step is always reached before the target time.</span>
             </span>` : '';
        html += `<div class="stmt-node ${pad}" data-type="wait" data-id="${_esc(id)}">
          <span class="stmt-num">${num}</span>${_esc(waitText)}${tooltip};
        </div>`;

      } else {
        // Generic statement (service_call, set_variable, log, stop, etc.)
        const label = _nodeLabel(node);
        html += `<div class="stmt-node ${pad}" data-type="${_esc(type)}" data-id="${_esc(id)}">
          <span class="stmt-num">${num}</span>${_esc(label)}
        </div>`;
      }

      // Insertion point between statements at this level
      html += `<div class="ghost-text ${pad}" data-insert="action" data-index="${i+1}">+ add a new statement</div>`;
    });

    return html;
  }

  // ── Variable list rendering ──────────────────────────────
  function _renderVariablesList(vars) {
    if (!vars || !vars.length) {
      return '<div class="ghost-text" data-insert="variable">+ add a new variable</div>';
    }
    return vars.map((v, i) =>
      `<div class="stmt-node" data-type="variable" data-index="${i}">
        $${_esc(v.name)} = ${_esc(String(v.default ?? ''))}
      </div>`
    ).join('') + '<div class="ghost-text" data-insert="variable">+ add a new variable</div>';
  }

  // ── Event wiring ─────────────────────────────────────────
  function _wireEditorEvents() {
    // Nav
    document.getElementById('btn-status-return')?.addEventListener('click', () => {
      App.navigate('status', { pistonId: _piston.id });
    });

    document.getElementById('btn-new-from-editor')?.addEventListener('click', () => {
      App.navigate('list');
      setTimeout(() => ListPage.createNewPiston(), 50);
    });

    // Simple/Advanced toggle
    document.getElementById('toggle-simple')?.addEventListener('click', () => {
      App.state.simpleMode = true;
      render();
    });
    document.getElementById('toggle-advanced')?.addEventListener('click', () => {
      App.state.simpleMode = false;
      render();
    });

    // Section collapse
    container.querySelectorAll('.editor-section-header').forEach(header => {
      header.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const section = header.closest('.editor-section');
        const body = section.querySelector('.action-tree');
        if (body) body.style.display = body.style.display === 'none' ? '' : 'none';
        const toggle = header.querySelector('.section-toggle');
        if (toggle) toggle.textContent = body.style.display === 'none' ? '▶' : '▼';
      });
    });

    // Ghost text — open wizard
    container.querySelectorAll('.ghost-text').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const context = el.dataset.insert || 'action';
        Wizard.open({
          context,
          parentId: el.dataset.parent || null,
          branch: el.dataset.branch || null,
          index: parseInt(el.dataset.index ?? '0'),
          onDone: (node) => _insertNode(node, el),
        });
      });
    });

    // Statement right-click
    container.querySelectorAll('.stmt-node').forEach(el => {
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const id = el.dataset.id;
        const items = [
          { label: 'Edit',      action: 'edit',      icon: '✎' },
          { label: 'Duplicate', action: 'duplicate',  icon: '⧉' },
          { label: 'Copy',      action: 'copy',       icon: '📋' },
          { label: 'Cut',       action: 'cut',        icon: '✂' },
          '---',
          { label: 'Delete',    action: 'delete',     icon: '🗑', danger: true },
        ];
        if (App.state.clipboard) {
          items.splice(5, 0, { label: 'Clear clipboard', action: 'clear_clipboard', icon: '✕' });
        }
        ContextMenu.show(e.clientX, e.clientY, items, (action) => {
          _handleStmtAction(action, id, el);
        });
      });

      // Click to select
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        container.querySelectorAll('.stmt-node').forEach(n => n.classList.remove('selected'));
        el.classList.add('selected');
      });
    });

    // Field changes → mark unsaved
    ['piston-name', 'piston-desc', 'editor-folder', 'editor-mode', 'editor-log-level'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => _markUnsaved(true));
      document.getElementById(id)?.addEventListener('change', () => _markUnsaved(true));
    });
    document.getElementById('editor-enabled')?.addEventListener('change', () => _markUnsaved(true));

    // Save and Deploy
    document.getElementById('btn-save')?.addEventListener('click', () => save());
    document.getElementById('btn-deploy')?.addEventListener('click', () => deploy());

    // Test
    document.getElementById('btn-test-editor')?.addEventListener('click', () => {
      Dialog.confirm({
        title: 'Live Fire ⚠',
        message: 'This will execute real actions on your devices. Are you sure?',
        buttons: [
          { label: 'Yes, run it', value: 'yes', primary: true },
          { label: 'Cancel', value: 'cancel' },
        ],
        onClose: async (choice) => {
          if (choice === 'yes') {
            _showEditorNotice('Piston fired. Check Home Assistant for results.', 'info');
          }
        },
      });
    });
  }

  // ── Statement actions ────────────────────────────────────
  function _handleStmtAction(action, stmtId, el) {
    const node = _findNode(_piston.actions, stmtId);
    if (!node && action !== 'clear_clipboard') return;

    switch (action) {
      case 'edit':
        // Open wizard in edit mode with existing node populated
        Wizard.open({
          context: 'action',
          editNode: node,
          onDone: (updated) => {
            _updateNode(_piston.actions, stmtId, updated);
            _markUnsaved(true);
            render();
          },
        });
        break;

      case 'copy':
        App.state.clipboard = JSON.parse(JSON.stringify(node));
        App.state.clipboard._cut = false;
        break;

      case 'cut':
        App.state.clipboard = JSON.parse(JSON.stringify(node));
        App.state.clipboard._cut = true;
        el.classList.add('cut');
        break;

      case 'duplicate': {
        const copy = JSON.parse(JSON.stringify(node));
        copy.id = _nextStmtId();
        _insertAfter(_piston.actions, stmtId, copy);
        _markUnsaved(true);
        render();
        break;
      }

      case 'delete':
        Dialog.confirm({
          title: 'Delete statement?',
          message: 'This statement will be removed from the piston.',
          buttons: [
            { label: 'Delete', value: 'delete', danger: true },
            { label: 'Cancel', value: 'cancel' },
          ],
          onClose: (choice) => {
            if (choice === 'delete') {
              _removeNode(_piston.actions, stmtId);
              _markUnsaved(true);
              render();
            }
          },
        });
        break;

      case 'clear_clipboard':
        App.state.clipboard = null;
        container.querySelectorAll('.stmt-node.cut').forEach(n => n.classList.remove('cut'));
        break;
    }
  }

  // ── Node insertion ───────────────────────────────────────
  function _insertNode(node, ghostEl) {
    const context = ghostEl.dataset.insert;
    const index = parseInt(ghostEl.dataset.index ?? '0');
    const parentId = ghostEl.dataset.parent;
    const branch = ghostEl.dataset.branch;

    node.id = node.id || _nextStmtId();

    if (context === 'trigger') {
      _piston.triggers = _piston.triggers || [];
      _piston.triggers.splice(index, 0, node);
    } else if (context === 'condition') {
      _piston.conditions = _piston.conditions || [];
      _piston.conditions.splice(index, 0, node);
    } else if (parentId) {
      const parent = _findNode(_piston.actions, parentId);
      if (parent) {
        const arr = branch === 'else' ? (parent.else_actions || []) : (parent.then_actions || parent.actions || []);
        arr.splice(index, 0, node);
        if (branch === 'else') parent.else_actions = arr;
        else if (parent.then_actions !== undefined) parent.then_actions = arr;
        else parent.actions = arr;
      }
    } else {
      _piston.actions = _piston.actions || [];
      _piston.actions.splice(index, 0, node);
    }

    _markUnsaved(true);
    render();
  }

  // ── Save / Deploy ────────────────────────────────────────
  async function save() {
    // Collect field values back into piston
    _piston.name = document.getElementById('piston-name')?.value.trim() || 'Untitled';
    _piston.description = document.getElementById('piston-desc')?.value.trim() || '';
    _piston.folder = document.getElementById('editor-folder')?.value || '';
    _piston.mode = document.getElementById('editor-mode')?.value || 'single';
    _piston.enabled = document.getElementById('editor-enabled')?.checked !== false;
    _piston.log_level = document.getElementById('editor-log-level')?.value || 'full';

    if (!_piston.name) {
      _showEditorNotice('Piston name is required.', 'error');
      document.getElementById('piston-name')?.focus();
      return false;
    }

    const btn = document.getElementById('btn-save');
    if (btn) btn.textContent = '💾 Saving...';

    try {
      const result = await API.savePiston(_piston.id, _piston);
      _piston = result.piston || _piston;
      _markUnsaved(false);

      // Show validation warnings from compile check
      const warnings = result.compile_check?.warnings || [];
      const errors = result.compile_check?.errors || [];
      const allMsgs = [
        ...errors.map(e => `⚠ ${e}`),
        ...warnings.map(w => `⚠ ${w}`),
      ];

      if (allMsgs.length) {
        _showEditorNotice(allMsgs.join(' | '), 'warn');
      }

      App.navigate('status', { pistonId: _piston.id });
      return true;

    } catch (e) {
      _showEditorNotice(`Save failed — your work is preserved. ${e.message}`, 'error');
      return false;
    } finally {
      if (btn) btn.textContent = '💾 Save to PistonCore';
    }
  }

  async function deploy() {
    const btn = document.getElementById('btn-deploy');
    if (btn) btn.textContent = '🚀 Deploying...';

    try {
      const result = await API.deployPiston(_piston.id);
      if (result.deployed) {
        _showEditorNotice('Deployed to Home Assistant successfully.', 'info');
      } else {
        const reason = result.reason || result.compile_result?.errors?.join(', ') || 'Deploy failed.';
        _showEditorNotice(`Deploy failed: ${reason}`, 'error');
      }
    } catch (e) {
      _showEditorNotice(`Deploy failed: ${e.message}`, 'error');
    } finally {
      if (btn) btn.textContent = '🚀 Deploy to HA';
    }
  }

  // ── Unsaved state ────────────────────────────────────────
  function _markUnsaved(hasChanges) {
    App.state.unsavedChanges = hasChanges;
    const nameInput = document.getElementById('piston-name');
    if (!nameInput) return;
    const dot = nameInput.parentElement.querySelector('.unsaved-dot');
    if (hasChanges && !dot) {
      const d = document.createElement('span');
      d.className = 'unsaved-dot';
      nameInput.parentElement.appendChild(d);
    } else if (!hasChanges && dot) {
      dot.remove();
    }
  }

  // ── Helpers — node tree operations ──────────────────────
  function _findNode(nodes, id) {
    if (!nodes) return null;
    for (const n of nodes) {
      if (n.id === id) return n;
      const inThen = _findNode(n.then_actions, id);
      if (inThen) return inThen;
      const inElse = _findNode(n.else_actions, id);
      if (inElse) return inElse;
      const inActions = _findNode(n.actions, id);
      if (inActions) return inActions;
    }
    return null;
  }

  function _removeNode(nodes, id) {
    if (!nodes) return false;
    const idx = nodes.findIndex(n => n.id === id);
    if (idx !== -1) { nodes.splice(idx, 1); return true; }
    for (const n of nodes) {
      if (_removeNode(n.then_actions, id)) return true;
      if (_removeNode(n.else_actions, id)) return true;
      if (_removeNode(n.actions, id)) return true;
    }
    return false;
  }

  function _updateNode(nodes, id, updated) {
    if (!nodes) return false;
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === id) { nodes[i] = updated; return true; }
      if (_updateNode(nodes[i].then_actions, id, updated)) return true;
      if (_updateNode(nodes[i].else_actions, id, updated)) return true;
      if (_updateNode(nodes[i].actions, id, updated)) return true;
    }
    return false;
  }

  function _insertAfter(nodes, id, newNode) {
    if (!nodes) return false;
    const idx = nodes.findIndex(n => n.id === id);
    if (idx !== -1) { nodes.splice(idx + 1, 0, newNode); return true; }
    for (const n of nodes) {
      if (_insertAfter(n.then_actions, id, newNode)) return true;
      if (_insertAfter(n.else_actions, id, newNode)) return true;
      if (_insertAfter(n.actions, id, newNode)) return true;
    }
    return false;
  }

  function _highestStmtId(piston) {
    let max = 0;
    function walk(nodes) {
      (nodes || []).forEach(n => {
        const m = parseInt((n.id || '').replace('stmt_', '')) || 0;
        if (m > max) max = m;
        walk(n.then_actions); walk(n.else_actions); walk(n.actions);
      });
    }
    walk(piston.triggers); walk(piston.conditions); walk(piston.actions);
    return max;
  }

  function _nextStmtId() {
    _stmtCounter++;
    return 'stmt_' + String(_stmtCounter).padStart(3, '0');
  }

  // ── Display helpers ──────────────────────────────────────
  function _conditionText(c) {
    if (!c) return '[condition]';
    const subject = c.subject?.role || c.subject?.type || '';
    const op = c.operator || '';
    const val = c.display_value || '';
    return `${subject} ${op} ${val}`.trim() || '[condition]';
  }

  function _waitText(node) {
    if (node.wait_type === 'duration') return `wait ${node.duration || ''}`;
    if (node.wait_type === 'time') return `wait until ${node.time || ''}`;
    return 'wait';
  }

  function _nodeLabel(node) {
    if (node.description) return node.description;
    if (node.type === 'service_call') return node.service || 'Call service';
    if (node.type === 'set_variable') return `Set ${node.variable || ''} = ${node.value ?? ''}`;
    if (node.type === 'log') return `Log: ${node.message || ''}`;
    if (node.type === 'stop') return `stop${node.reason ? ' — ' + node.reason : ''}`;
    if (node.type === 'call_piston') return `Call piston: ${node.target_name || ''}`;
    if (node.type === 'fire_event') return `Fire event: ${node.event || ''}`;
    return node.type || '[unknown]';
  }

  function _folderOptions(current) {
    const folders = ['', ...new Set(
      (App.state.pistons || []).map(p => p.folder).filter(f => f && f.trim())
    )].sort();
    return folders.map(f => {
      const label = f || 'Uncategorized';
      const selected = f === (current || '') ? 'selected' : '';
      return `<option value="${_esc(f)}" ${selected}>${_esc(label)}</option>`;
    }).join('');
  }

  function _esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _showEditorNotice(msg, type) {
    // Inject a banner above the bottom bar
    let notice = container.querySelector('.editor-notice');
    if (!notice) {
      notice = document.createElement('div');
      notice.className = 'editor-notice';
      container.querySelector('.editor-bottom-bar')?.before(notice);
    }
    notice.innerHTML = `<div class="banner banner-${type === 'error' ? 'error' : type === 'warn' ? 'warn' : 'info'}">${_esc(msg)}</div>`;
    if (type === 'info') setTimeout(() => { notice.innerHTML = ''; }, 6000);
  }

  return { load, save, deploy };

})();
