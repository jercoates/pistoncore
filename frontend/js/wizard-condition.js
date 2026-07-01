// frontend/js/wizard-condition.js
//
// Condition / Trigger / Restriction builder dialog.
// All menus are driven by the three runtime JSON files via WizardCore —
// no operator lists, enum options, attribute types, or ranges are hardcoded here.
//
// Entry points (called by editor.js):
//   WizardCondition.openAdd(parentArray, context, mode)
//   WizardCondition.openEdit(node, parentArray, context, mode)
//   WizardCondition.openEditGroup(groupNode, parentArray, context)
//
// mode: 'condition' | 'trigger' | 'restriction'
//
// On commit:
//   Calls Editor.insertCondition(parentArray, builtNode, context) for new nodes.
//   For edits: writes directly to node and calls Editor.refreshDisplay(context).
//
// Node shape per PISTON_JSON_STRUCTURE_MAP.md §4.

const WizardCondition = (() => {

  function _newId() {
    return 'cond_' + Math.random().toString(36).slice(2, 10);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public: open add dialog
  // ─────────────────────────────────────────────────────────────────────────
  function openAdd(parentArray, context, mode, startType) {
    mode = mode || 'condition';
    // startType: when caller already knows 'condition' or 'group' (e.g. IF block card button),
    // skip the type-picker page and go straight to page 1 with that type pre-set.
    const designer = WizardCore.newDesigner({
      isNew:        true,
      page:         startType ? 1 : 0,
      mode:         mode,
      type:         startType || '',
      groupOperator: parentArray && parentArray.length > 0 ? 'and' : 'and',

      // Condition fields
      comparison: WizardCore.newComparison(),

      // Left operand device-picker state (built as user selects)
      leftSourceType:    'device',  // 'device' | 'variable' | 'expression'
      selectedDeviceKeys: [],       // device_id or entity_id keys from groupEntitiesByDevice
      capKeys:           [],        // intersected capability/attribute keys
      selectedAttrKey:   '',        // chosen WebCoRE attribute key
      attrMeta:          null,      // from WizardCore.getAttrMeta(selectedAttrKey)

      // Right operand value(s) — type driven by attrMeta at runtime
      rightValue:  '',
      rightValue2: '',

      // Duration — shown when operator t:1 or t:2
      durationValue: '',
      durationUnit:  's',

      // Group type fields
      groupOp:  'and',
      groupNot: '0',

      // Advanced
      smode:       'auto',
      description: '',

      // Physical/Programmatic interaction filter — shown when attrMeta.p === true
      interactionFilter: 'any',
    });

    WizardCore.openDialog(designer, null, null);
    _renderDialog(designer, parentArray, context);
    WizardCore.showWizard();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public: open edit dialog (existing condition or group)
  // ─────────────────────────────────────────────────────────────────────────
  function openEdit(node, parentArray, context, mode) {
    mode = mode || 'condition';

    if (node.c) {
      // It's a group — open the group editor
      openEditGroup(node, parentArray, context);
      return;
    }

    const designer = WizardCore.newDesigner({
      isNew:        false,
      page:         1,
      mode:         mode,
      type:         'condition',
      $node:        node,
      groupOperator: node.group_operator || 'and',

      // Seed left operand display (role from node).
      // selectedDeviceKeys re-built from role_tokens so the device picker shows
      // existing selections checked when the dialog opens in edit mode.
      leftSourceType:    'device',
      selectedDeviceKeys: (node.role_tokens || []).slice(),
      capKeys:           [],
      selectedAttrKey:   node.attribute || '',
      attrMeta:          node.attribute ? WizardCore.getAttrMeta(node.attribute) : null,

      // Role info from node (for re-display)
      role:        node.role        || '',
      roleTokens:  (node.role_tokens || []).slice(),
      entityIds:   (node.entity_ids  || []).slice(),
      aggregation: node.aggregation  || 'any',

      // Right values from node
      rightValue:  node.display_value || '',
      rightValue2: node.value_to      || '',

      // Duration
      durationValue: node.duration      != null ? String(node.duration) : '',
      durationUnit:  node.duration_unit || 's',

      // Operator
      comparison: _buildComparisonFromNode(node, mode),

      // Advanced
      smode:       node.smode       || 'auto',
      description: node.description || '',
      interactionFilter: node.interaction || 'any',
    });

    WizardCore.openDialog(designer, null, null);
    _renderDialog(designer, parentArray, context);
    WizardCore.showWizard();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public: open group editor (existing group node)
  // ─────────────────────────────────────────────────────────────────────────
  function openEditGroup(groupNode, parentArray, context) {
    const designer = WizardCore.newDesigner({
      isNew:    false,
      page:     1,
      mode:     'group',
      type:     'group',
      $node:    groupNode,
      groupOp:  groupNode.o || 'and',
      groupNot: groupNode.n ? '1' : '0',
      description: groupNode.description || '',
    });

    WizardCore.openDialog(designer, null, null);
    _renderGroupDialog(designer, parentArray, context);
    WizardCore.showWizard();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Build a comparison object seeded from an existing condition node (edit mode)
  // ─────────────────────────────────────────────────────────────────────────
  function _buildComparisonFromNode(node, mode) {
    const comp = WizardCore.newComparison();
    comp.operator = node.operator || '';
    if (comp.operator) {
      WizardCore.updateComparisonForOperator(comp, mode === 'trigger' ? 'triggers' : 'conditions');
    }
    return comp;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render dispatcher
  // ─────────────────────────────────────────────────────────────────────────
  function _renderDialog(designer, parentArray, context) {
    const modal = WizardCore.getModalEl();
    if (!modal) return;

    if (designer.page === 0) {
      modal.innerHTML = _buildPage0HTML(designer);
      _bindPage0Events(modal, designer, parentArray, context);
    } else if (designer.type === 'group') {
      _renderGroupDialog(designer, parentArray, context);
    } else {
      modal.innerHTML = _buildPage1HTML(designer);
      _bindPage1Events(modal, designer, parentArray, context);
    }
  }

  function _renderGroupDialog(designer, parentArray, context) {
    const modal = WizardCore.getModalEl();
    if (!modal) return;
    modal.innerHTML = _buildGroupHTML(designer);
    _bindGroupEvents(modal, designer, parentArray, context);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Page 0: type picker — Condition card | Group card
  // Restrictions show a warning banner. Triggers show trigger note.
  // ─────────────────────────────────────────────────────────────────────────
  function _buildPage0HTML(designer) {
    const mode    = designer.mode;
    const isRestr = mode === 'restriction';
    const isTrig  = mode === 'trigger';

    const modeTitle = isTrig ? 'Add a Trigger' : isRestr ? 'Add a Restriction' : 'Add a Condition';

    const restrWarning = isRestr ? `
      <div class="wizard-warning">
        ⚠ Restrictions do NOT subscribe to events — they only check current state.
      </div>` : '';

    const trigNote = isTrig ? `
      <div class="wizard-info-note">
        Triggers subscribe to HA state changes. Any trigger firing causes the piston to run.
      </div>` : '';

    return `
      <div class="wizard-dialog" id="wizard-condition-dialog">
        <div class="wizard-header">
          <span class="wizard-title">${_esc(modeTitle)}</span>
          <button class="wizard-close btn-icon" id="wc-cancel">✕</button>
        </div>
        <div class="wizard-body">
          ${restrWarning}${trigNote}
          <div class="wizard-type-grid">
            <div class="wizard-type-card" data-type="condition">
              <div class="wizard-type-card-label">${isTrig ? 'Trigger' : isRestr ? 'Restriction' : 'Condition'}</div>
              <div class="wizard-type-card-desc">Compare a device attribute${isRestr ? ' (state only)' : ''}</div>
              <button class="btn btn-sm btn-primary wizard-type-select" data-type="condition">Add</button>
            </div>
            ${!isTrig ? `
            <div class="wizard-type-card" data-type="group">
              <div class="wizard-type-card-label">Group</div>
              <div class="wizard-type-card-desc">Nest conditions inside an All / Any / None group</div>
              <button class="btn btn-sm btn-primary wizard-type-select" data-type="group">Add</button>
            </div>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function _bindPage0Events(modal, designer, parentArray, context) {
    modal.querySelector('#wc-cancel')
      .addEventListener('click', () => WizardCore.closeDialog());

    modal.querySelectorAll('.wizard-type-select').forEach(btn => {
      btn.addEventListener('click', () => {
        designer.type = btn.dataset.type;
        designer.page = 1;
        _renderDialog(designer, parentArray, context);
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Page 1: Condition form
  // All menus are built from the three JSON files via WizardCore.
  // ─────────────────────────────────────────────────────────────────────────
  function _buildPage1HTML(designer) {
    const isNew   = designer.isNew;
    const mode    = designer.mode;
    const isTrig  = mode === 'trigger';
    const isRestr = mode === 'restriction';

    const title = isTrig ? (isNew ? 'Add Trigger' : 'Edit Trigger')
                : isRestr ? (isNew ? 'Add Restriction' : 'Edit Restriction')
                : (isNew ? 'Add Condition' : 'Edit Condition');

    const backBtn = isNew
      ? `<button class="btn btn-sm btn-secondary" id="wc-back">← Back</button>`
      : '';

    // Group operator (connects this node to the PREVIOUS condition)
    // Not shown for triggers (triggers are OR'd together automatically).
    const groupOpHtml = !isTrig ? `
      <div class="wc-section">
        <label>Connect to previous with</label>
        <select id="wc-group-operator" class="form-select form-select-sm" style="width:auto">
          <option value="and" ${designer.groupOperator === 'and' ? 'selected' : ''}>AND (All)</option>
          <option value="or"  ${designer.groupOperator === 'or'  ? 'selected' : ''}>OR (Any)</option>
        </select>
      </div>` : '';

    // Left operand — source type toggle
    const leftSourceHtml = _buildLeftSourceHTML(designer);

    // Attribute picker — shown after device(s) selected
    const attrHtml = _buildAttrPickerHTML(designer);

    // Operator picker — shown after attribute selected
    const opHtml = _buildOperatorHTML(designer, mode);

    // Right value(s) — shown when operator.p > 0
    const rightHtml = _buildRightValueHTML(designer);

    // Duration — shown when operator.t > 0
    const durHtml = _buildDurationHTML(designer);

    // Advanced section
    const advHtml = _buildAdvancedHTML(designer, isRestr);

    return `
      <div class="wizard-dialog" id="wizard-condition-dialog">
        <div class="wizard-header">
          <span class="wizard-title">${_esc(title)}</span>
          <button class="wizard-close btn-icon" id="wc-cancel">✕</button>
        </div>
        <div class="wizard-body">
          ${groupOpHtml}
          <div class="wc-section">
            <label class="wc-section-label">What to check</label>
            ${leftSourceHtml}
          </div>
          <div class="wc-section" id="wc-attr-section" style="${designer.selectedAttrKey || designer.role ? '' : 'display:none'}">
            <label class="wc-section-label">Attribute</label>
            ${attrHtml}
          </div>
          <div class="wc-section" id="wc-interaction-section" style="${designer.attrMeta && designer.attrMeta.p ? '' : 'display:none'}">
            <label class="wc-section-label">Which interaction</label>
            <select id="wc-interaction-select" class="form-select">
              <option value="any"          ${(designer.interactionFilter||'any') === 'any'          ? 'selected' : ''}>Any interaction</option>
              <option value="physical"     ${(designer.interactionFilter||'any') === 'physical'     ? 'selected' : ''}>Physical interaction</option>
              <option value="programmatic" ${(designer.interactionFilter||'any') === 'programmatic' ? 'selected' : ''}>Programmatic interaction</option>
            </select>
          </div>
          <div class="wc-section" id="wc-op-section" style="${designer.selectedAttrKey ? '' : 'display:none'}">
            <label class="wc-section-label">Operator</label>
            ${opHtml}
          </div>
          <div class="wc-section" id="wc-right-section" style="${designer.selectedAttrKey && designer.comparison.parameterCount > 0 ? '' : 'display:none'}">
            <label class="wc-section-label">Compare to</label>
            ${rightHtml}
          </div>
          <div class="wc-section" id="wc-dur-section" style="${designer.comparison.timed > 0 ? '' : 'display:none'}">
            ${durHtml}
          </div>
          <div class="wc-section">
            <label class="wc-section-label">Description (optional)</label>
            <textarea id="wc-description" class="form-input" rows="3"
              placeholder="Description for this statement">${_esc(designer.description)}</textarea>
          </div>
        </div>
        <div class="wizard-footer">
          ${backBtn}
          <button class="btn btn-sm btn-secondary" id="wc-cancel-footer">Cancel</button>
          <button class="btn btn-sm btn-primary" id="wc-commit">${isNew ? 'Add' : 'Save'}</button>
          ${isNew ? `<button class="btn btn-sm btn-success" id="wc-add-more">Add more</button>` : ''}
        </div>
      </div>
    `;
  }

  // Left source type — device picker, variable, or expression
  function _buildLeftSourceHTML(designer) {
    const src = designer.leftSourceType;
    const deviceData = WizardCore.getDeviceData() || [];
    const deviceMap  = WizardCore.groupEntitiesByDevice(deviceData);

    // Build device list HTML
    const deviceRows = [...deviceMap.entries()].map(([key, dev]) => `
      <label class="wc-device-row">
        <input type="checkbox" class="wc-device-check" data-key="${_esc(key)}"
          ${(designer.selectedDeviceKeys || []).includes(key) ? 'checked' : ''}>
        <span>${_esc(dev.label)}</span>
      </label>
    `).join('');

    const noDevices = deviceMap.size === 0
      ? `<p class="wizard-hint">No HA devices loaded. Check your HA connection.</p>` : '';

    // If editing and we have a role already set, show it
    const existingRole = designer.role && !designer.isNew
      ? `<div class="wc-existing-role">Currently: <strong>${_esc(designer.role)}</strong></div>`
      : '';

    return `
      <div class="wc-source-tabs">
        <button class="btn btn-sm ${src === 'device'     ? 'btn-primary' : 'btn-secondary'} wc-src-tab" data-src="device">Device</button>
        <button class="btn btn-sm ${src === 'variable'   ? 'btn-primary' : 'btn-secondary'} wc-src-tab" data-src="variable">Variable</button>
        <button class="btn btn-sm ${src === 'expression' ? 'btn-primary' : 'btn-secondary'} wc-src-tab" data-src="expression">Expression</button>
      </div>
      <div id="wc-src-device"  style="${src === 'device'     ? '' : 'display:none'}">
        ${existingRole}
        <div class="wc-device-list" id="wc-device-list" style="max-height:180px;overflow-y:auto">
          ${noDevices}${deviceRows}
        </div>
        <div id="wc-aggregation-row" style="${(designer.selectedDeviceKeys||[]).length > 1 ? '' : 'display:none'}">
          <label>Aggregation (multiple devices)</label>
          <select id="wc-aggregation" class="form-select form-select-sm">
            ${['any','all','avg','count','min','max'].map(a =>
              `<option value="${a}" ${(designer.aggregation||'any') === a ? 'selected' : ''}>${a}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div id="wc-src-variable" style="${src === 'variable' ? '' : 'display:none'}">
        <label>Variable name</label>
        <select id="wc-var-select" class="form-select">
          <option value="">— pick a variable —</option>
          ${_buildVariableOptions(designer)}
        </select>
      </div>
      <div id="wc-src-expression" style="${src === 'expression' ? '' : 'display:none'}">
        <label>Expression</label>
        <input type="text" id="wc-expression-input" class="form-input"
          placeholder="e.g. $device.switch == 'on'"
          value="${_esc(designer.expressionValue || '')}">
      </div>
    `;
  }

  function _buildVariableOptions(designer) {
    const vars    = WizardCore.getPistonVars()  || [];
    const globals = WizardCore.getGlobalsData() || [];
    const opts = [];
    for (const v of vars)    opts.push(`<option value="${_esc(v.name)}">${_esc(v.name)} (local)</option>`);
    for (const g of globals)  opts.push(`<option value="@${_esc(g.name)}">@${_esc(g.name)} (global)</option>`);
    return opts.join('');
  }

  // Attribute picker — built from intersected capKeys at runtime
  // Display names come from WizardCore.getAttrMeta(key).n
  function _buildAttrPickerHTML(designer) {
    const capKeys = designer.capKeys || [];
    if (capKeys.length === 0 && !designer.selectedAttrKey) {
      return `<p class="wizard-hint" id="wc-attr-hint">Select device(s) above to see available attributes.</p>`;
    }

    // Build options from capKeys using WizardCore (attrTrans at runtime)
    const options = capKeys.map(key => {
      const meta = WizardCore.getAttrMeta(key);
      const label = meta ? meta.n : key;
      return `<option value="${_esc(key)}" ${designer.selectedAttrKey === key ? 'selected' : ''}>${_esc(label)}</option>`;
    });

    // If editing with a pre-existing attribute not in current capKeys, still show it
    if (designer.selectedAttrKey && !capKeys.includes(designer.selectedAttrKey)) {
      const meta = WizardCore.getAttrMeta(designer.selectedAttrKey);
      const label = meta ? meta.n : designer.selectedAttrKey;
      options.unshift(`<option value="${_esc(designer.selectedAttrKey)}" selected>${_esc(label)}</option>`);
    }

    return `
      <select id="wc-attr-select" class="form-select">
        <option value="">— choose attribute —</option>
        ${options.join('')}
      </select>
    `;
  }

  // Operator picker — filtered from vocab.comparisons at runtime using attrMeta.t
  // Shows two optgroups: Conditions operators + Triggers operators (omits Triggers for restrictions)
  // Singular label (d) for one device, plural (dd) for multiple
  function _buildOperatorHTML(designer, mode) {
    if (!designer.selectedAttrKey || !designer.attrMeta) {
      return `<p class="wizard-hint">Choose an attribute first.</p>`;
    }

    const single = (designer.selectedDeviceKeys || []).length <= 1;

    function _makeOptions(ops) {
      return ops.map(op => {
        const label = single ? (op.d || op.key) : (op.dd || op.d || op.key);
        return `<option value="${_esc(op.key)}" ${designer.comparison.operator === op.key ? 'selected' : ''}>${_esc(label)}</option>`;
      }).join('');
    }

    const condOps = WizardCore.getOperatorsForAttrType(designer.attrMeta.t, 'conditions');
    const trigOps = mode !== 'restriction'
      ? WizardCore.getOperatorsForAttrType(designer.attrMeta.t, 'triggers')
      : [];

    if (condOps.length === 0 && trigOps.length === 0) {
      return `<p class="wizard-hint">No operators available for this attribute type.</p>`;
    }

    const condGroup = condOps.length > 0
      ? `<optgroup label="Conditions">${_makeOptions(condOps)}</optgroup>` : '';
    const trigGroup = trigOps.length > 0
      ? `<optgroup label="Triggers">${_makeOptions(trigOps)}</optgroup>` : '';

    return `
      <select id="wc-operator-select" class="form-select">
        <option value="">— choose operator —</option>
        ${condGroup}${trigGroup}
      </select>
    `;
  }

  // Right value widget — type and options driven entirely from attrMeta at runtime
  function _buildRightValueHTML(designer) {
    const meta = designer.attrMeta;
    if (!meta) return '';

    const val1 = _buildValueWidget('wc-right-val', designer.rightValue,  meta);
    const pc   = designer.comparison.parameterCount;

    if (pc === 2) {
      const val2 = _buildValueWidget('wc-right-val2', designer.rightValue2, meta);
      return `<div class="wizard-row">${val1}<span>and</span>${val2}</div>`;
    }
    return val1;
  }

  // Value widget — switches on attrMeta.t and attrMeta.o from the JSON
  function _buildValueWidget(id, currentVal, meta) {
    // Tier 1: enum — options from attrMeta.o (read from attrTrans.json at runtime)
    if (meta.o && meta.o.length > 0) {
      const opts = meta.o.map(opt =>
        `<option value="${_esc(opt)}" ${currentVal === opt ? 'selected' : ''}>${_esc(opt)}</option>`
      ).join('');
      return `<select id="${id}" class="form-select"><option value="">— pick value —</option>${opts}</select>`;
    }

    // Tier 2: numeric — range from attrMeta.r, unit from attrMeta.u (from attrTrans.json)
    if (meta.t === 'integer' || meta.t === 'decimal') {
      const min = (meta.r && meta.r[0] != null) ? `min="${meta.r[0]}"` : '';
      const max = (meta.r && meta.r[1] != null) ? `max="${meta.r[1]}"` : '';
      const unit = meta.u ? `<span class="wc-unit">${_esc(meta.u)}</span>` : '';
      const step = meta.t === 'decimal' ? 'step="0.1"' : '';
      return `<div class="wizard-row"><input type="number" id="${id}" class="form-input" ${min} ${max} ${step} value="${_esc(currentVal)}">${unit}</div>`;
    }

    // Boolean (from attrMeta.t)
    if (meta.t === 'boolean') {
      return `<select id="${id}" class="form-select">
        <option value="">— pick value —</option>
        <option value="true"  ${currentVal === 'true'  ? 'selected' : ''}>true</option>
        <option value="false" ${currentVal === 'false' ? 'selected' : ''}>false</option>
      </select>`;
    }

    // Tier 3: free text fallback (string, color, expression, etc.)
    return `<input type="text" id="${id}" class="form-input" placeholder="value" value="${_esc(currentVal)}">`;
  }

  // Duration widget — label and logic driven by operator.t flag from vocab
  function _buildDurationHTML(designer) {
    const timed = designer.comparison.timed;
    if (!timed) return '';

    const label = timed === 1 ? 'For at least...' : 'In the last...';
    return `
      <label>${_esc(label)}</label>
      <div class="wizard-row">
        <input type="number" id="wc-dur-val" class="form-input" min="0"
          value="${_esc(designer.durationValue)}">
        <select id="wc-dur-unit" class="form-select form-select-sm">
          <option value="ms"      ${designer.durationUnit === 'ms'      ? 'selected' : ''}>ms</option>
          <option value="s"       ${designer.durationUnit === 's'       ? 'selected' : ''}>seconds</option>
          <option value="m"       ${designer.durationUnit === 'm'       ? 'selected' : ''}>minutes</option>
          <option value="h"       ${designer.durationUnit === 'h'       ? 'selected' : ''}>hours</option>
          <option value="days"    ${designer.durationUnit === 'days'    ? 'selected' : ''}>days</option>
          <option value="weeks"   ${designer.durationUnit === 'weeks'   ? 'selected' : ''}>weeks</option>
          <option value="months"  ${designer.durationUnit === 'months'  ? 'selected' : ''}>months</option>
        </select>
      </div>
    `;
  }

  function _buildAdvancedHTML(designer, isRestriction) {
    const smodeHtml = !isRestriction ? `
      <label>Subscription mode</label>
      <select id="wc-smode" class="form-select">
        <option value="auto"   ${designer.smode === 'auto'   ? 'selected' : ''}>Auto</option>
        <option value="always" ${designer.smode === 'always' ? 'selected' : ''}>Always</option>
        <option value="never"  ${designer.smode === 'never'  ? 'selected' : ''}>Never</option>
      </select>` : '';

    return `
      ${smodeHtml}
      <label>Description (optional)</label>
      <input type="text" id="wc-description" class="form-input"
        placeholder="Description" value="${_esc(designer.description)}">
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Page 1 event binding
  // ─────────────────────────────────────────────────────────────────────────
  function _bindPage1Events(modal, designer, parentArray, context) {
    // Cancel
    [modal.querySelector('#wc-cancel'), modal.querySelector('#wc-cancel-footer')]
      .filter(Boolean).forEach(el => el.addEventListener('click', () => WizardCore.closeDialog()));

    // Back
    const backBtn = modal.querySelector('#wc-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        designer.page = 0;
        designer.type = '';
        _renderDialog(designer, parentArray, context);
      });
    }

    // Advanced toggle
    modal.querySelector('#wc-adv-toggle').addEventListener('click', () => {
      designer.showAdvancedOptions = !designer.showAdvancedOptions;
      const sec = modal.querySelector('#wc-advanced');
      if (sec) sec.style.display = designer.showAdvancedOptions ? '' : 'none';
      modal.querySelector('#wc-adv-toggle').textContent =
        designer.showAdvancedOptions ? '▲ Hide advanced' : '▼ Show advanced';
    });

    // Group operator (connect to previous)
    const groupOpSel = modal.querySelector('#wc-group-operator');
    if (groupOpSel) groupOpSel.addEventListener('change', () => {
      designer.groupOperator = groupOpSel.value;
    });

    // Left source type tabs
    modal.querySelectorAll('.wc-src-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        designer.leftSourceType = tab.dataset.src;
        designer.selectedDeviceKeys = [];
        designer.capKeys = [];
        designer.selectedAttrKey = '';
        designer.attrMeta = null;
        _rerenderLeft(modal, designer, parentArray, context);
      });
    });

    // Device checkboxes
    modal.querySelector('#wc-device-list') &&
      modal.querySelector('#wc-device-list').addEventListener('change', e => {
        if (!e.target.classList.contains('wc-device-check')) return;
        _onDeviceSelectionChange(modal, designer, parentArray, context);
      });

    // Attribute select
    const attrSel = modal.querySelector('#wc-attr-select');
    if (attrSel) attrSel.addEventListener('change', () => {
      designer.selectedAttrKey = attrSel.value;
      designer.attrMeta = attrSel.value ? WizardCore.getAttrMeta(attrSel.value) : null;
      designer.comparison.operator = '';
      designer.comparison.parameterCount = 0;
      designer.comparison.timed = 0;
      designer.rightValue = '';
      designer.rightValue2 = '';
      designer.durationValue = '';
      _rerenderOperatorAndBelow(modal, designer);
    });

    // Interaction filter select (shown when attrMeta.p === true)
    const interSel = modal.querySelector('#wc-interaction-select');
    if (interSel) interSel.addEventListener('change', () => {
      designer.interactionFilter = interSel.value;
    });

    // Operator select
    const opSel = modal.querySelector('#wc-operator-select');
    if (opSel) opSel.addEventListener('change', () => {
      designer.comparison.operator = opSel.value;
      const vocabMode = designer.mode === 'trigger' ? 'triggers' : 'conditions';
      WizardCore.updateComparisonForOperator(designer.comparison, vocabMode);
      designer.rightValue = '';
      designer.rightValue2 = '';
      designer.durationValue = '';
      _rerenderRightAndDuration(modal, designer);
    });

    // Commit and Add more
    const commitBtn  = modal.querySelector('#wc-commit');
    const addMoreBtn = modal.querySelector('#wc-add-more');

    if (commitBtn) commitBtn.addEventListener('click', () => {
      _readFields(modal, designer);
      _commit(designer, parentArray, context, false);
    });
    if (addMoreBtn) addMoreBtn.addEventListener('click', () => {
      _readFields(modal, designer);
      _commit(designer, parentArray, context, true);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Live re-render helpers (avoid full page rebuild on sub-field changes)
  // ─────────────────────────────────────────────────────────────────────────
  function _onDeviceSelectionChange(modal, designer, parentArray, context) {
    const deviceMap = WizardCore.groupEntitiesByDevice(WizardCore.getDeviceData() || []);
    const checked   = [...modal.querySelectorAll('.wc-device-check:checked')].map(cb => cb.dataset.key);
    designer.selectedDeviceKeys = checked;

    // Show/hide aggregation row
    const aggRow = modal.querySelector('#wc-aggregation-row');
    if (aggRow) aggRow.style.display = checked.length > 1 ? '' : 'none';

    if (checked.length === 0) {
      designer.capKeys = [];
      designer.selectedAttrKey = '';
      designer.attrMeta = null;
      const attrSec = modal.querySelector('#wc-attr-section');
      if (attrSec) attrSec.style.display = 'none';
      _rerenderOperatorAndBelow(modal, designer);
      return;
    }

    // Build entity meta arrays per device for intersection
    const devicesEntityArrays = checked.map(key => {
      const dev = deviceMap.get(key);
      if (!dev) return [];
      return dev.entities.map(e => _entityToMeta(e));
    });

    const { capKeys } = WizardCore.intersectCapKeys(devicesEntityArrays);
    designer.capKeys = [...capKeys];

    // If previously selected attr is no longer in the intersection, clear it
    if (designer.selectedAttrKey && !designer.capKeys.includes(designer.selectedAttrKey)) {
      designer.selectedAttrKey = '';
      designer.attrMeta = null;
    }

    // Re-render the attribute section
    const attrSec = modal.querySelector('#wc-attr-section');
    if (attrSec) {
      attrSec.style.display = '';
      attrSec.innerHTML = `<label class="wc-section-label">Attribute</label>${_buildAttrPickerHTML(designer)}`;

      const attrSel = attrSec.querySelector('#wc-attr-select');
      if (attrSel) attrSel.addEventListener('change', () => {
        designer.selectedAttrKey = attrSel.value;
        designer.attrMeta = attrSel.value ? WizardCore.getAttrMeta(attrSel.value) : null;
        designer.comparison.operator = '';
        designer.comparison.parameterCount = 0;
        designer.comparison.timed = 0;
        designer.rightValue = '';
        designer.rightValue2 = '';
        _rerenderOperatorAndBelow(modal, designer);
      });
    }

    _rerenderOperatorAndBelow(modal, designer);
  }

  function _rerenderLeft(modal, designer, parentArray, context) {
    const src = designer.leftSourceType;
    ['device','variable','expression'].forEach(s => {
      const el = modal.querySelector(`#wc-src-${s}`);
      if (el) el.style.display = s === src ? '' : 'none';
    });
    modal.querySelectorAll('.wc-src-tab').forEach(tab => {
      tab.className = `btn btn-sm ${tab.dataset.src === src ? 'btn-primary' : 'btn-secondary'} wc-src-tab`;
    });

    const attrSec = modal.querySelector('#wc-attr-section');
    if (attrSec) attrSec.style.display = 'none';
    _rerenderOperatorAndBelow(modal, designer);
  }

  function _rerenderOperatorAndBelow(modal, designer) {
    const interSec = modal.querySelector('#wc-interaction-section');
    if (interSec) {
      interSec.style.display = (designer.attrMeta && designer.attrMeta.p) ? '' : 'none';
    }

    const opSec = modal.querySelector('#wc-op-section');
    if (opSec) {
      opSec.style.display = designer.selectedAttrKey ? '' : 'none';
      opSec.innerHTML = `<label class="wc-section-label">Operator</label>${_buildOperatorHTML(designer, designer.mode)}`;

      const opSel = opSec.querySelector('#wc-operator-select');
      if (opSel) opSel.addEventListener('change', () => {
        designer.comparison.operator = opSel.value;
        const vocabMode = designer.mode === 'trigger' ? 'triggers' : 'conditions';
        WizardCore.updateComparisonForOperator(designer.comparison, vocabMode);
        designer.rightValue = '';
        designer.rightValue2 = '';
        designer.durationValue = '';
        _rerenderRightAndDuration(modal, designer);
      });
    }
    _rerenderRightAndDuration(modal, designer);
  }

  function _rerenderRightAndDuration(modal, designer) {
    const rightSec = modal.querySelector('#wc-right-section');
    if (rightSec) {
      const show = designer.selectedAttrKey && designer.comparison.parameterCount > 0;
      rightSec.style.display = show ? '' : 'none';
      if (show) {
        rightSec.innerHTML = `<label class="wc-section-label">Compare to</label>${_buildRightValueHTML(designer)}`;
      }
    }

    const durSec = modal.querySelector('#wc-dur-section');
    if (durSec) {
      const show = designer.comparison.timed > 0;
      durSec.style.display = show ? '' : 'none';
      if (show) {
        durSec.innerHTML = _buildDurationHTML(designer);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Read fields from DOM back into designer
  // ─────────────────────────────────────────────────────────────────────────
  function _readFields(modal, designer) {
    const gop = modal.querySelector('#wc-group-operator');
    if (gop) designer.groupOperator = gop.value;

    const aggSel = modal.querySelector('#wc-aggregation');
    if (aggSel) designer.aggregation = aggSel.value;

    const varSel = modal.querySelector('#wc-var-select');
    if (varSel) designer.variableRef = varSel.value;

    const exprIn = modal.querySelector('#wc-expression-input');
    if (exprIn) designer.expressionValue = exprIn.value.trim();

    const attrSel = modal.querySelector('#wc-attr-select');
    if (attrSel && attrSel.value) {
      designer.selectedAttrKey = attrSel.value;
      designer.attrMeta = WizardCore.getAttrMeta(attrSel.value);
    }

    const opSel = modal.querySelector('#wc-operator-select');
    if (opSel) {
      designer.comparison.operator = opSel.value;
      const vocabMode = designer.mode === 'trigger' ? 'triggers' : 'conditions';
      WizardCore.updateComparisonForOperator(designer.comparison, vocabMode);
    }

    const rv1 = modal.querySelector('#wc-right-val');
    if (rv1) designer.rightValue = rv1.value;

    const rv2 = modal.querySelector('#wc-right-val2');
    if (rv2) designer.rightValue2 = rv2.value;

    const durVal  = modal.querySelector('#wc-dur-val');
    const durUnit = modal.querySelector('#wc-dur-unit');
    if (durVal)  designer.durationValue = durVal.value;
    if (durUnit) designer.durationUnit  = durUnit.value;

    const interSel = modal.querySelector('#wc-interaction-select');
    if (interSel) designer.interactionFilter = interSel.value;

    const smode = modal.querySelector('#wc-smode');
    if (smode) designer.smode = smode.value;

    const desc = modal.querySelector('#wc-description');
    if (desc) designer.description = desc.value.trim();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Group dialog HTML + events
  // §6.1: surface All (and) / Any (or) / None (or+negate) only — no XOR
  // ─────────────────────────────────────────────────────────────────────────
  function _buildGroupHTML(designer) {
    const isNew = designer.isNew;
    // Map groupOp + groupNot to display choice
    let displayChoice = 'all';
    if (designer.groupOp === 'or' && designer.groupNot === '0')  displayChoice = 'any';
    if (designer.groupOp === 'or' && designer.groupNot === '1')  displayChoice = 'none';
    // 'all' = and + not=0; reverse-negate = and + not=1 (unusual, keep it)

    return `
      <div class="wizard-dialog" id="wizard-condition-dialog">
        <div class="wizard-header">
          <span class="wizard-title">${isNew ? 'Add' : 'Edit'} Condition Group</span>
          <button class="wizard-close btn-icon" id="wc-cancel">✕</button>
        </div>
        <div class="wizard-body">
          <label>Match logic</label>
          <select id="wc-group-logic" class="form-select">
            <option value="all"  ${displayChoice === 'all'  ? 'selected' : ''}>All (AND) — every condition must be true</option>
            <option value="any"  ${displayChoice === 'any'  ? 'selected' : ''}>Any (OR) — at least one must be true</option>
            <option value="none" ${displayChoice === 'none' ? 'selected' : ''}>None — not a single condition may be true</option>
          </select>
          <div class="wizard-advanced-toggle">
            <button class="btn btn-sm btn-link" id="wc-adv-toggle">▼ Show advanced</button>
          </div>
          <div id="wc-advanced" style="display:none">
            <label>Description (optional)</label>
            <input type="text" id="wc-description" class="form-input"
              placeholder="Description" value="${_esc(designer.description)}">
          </div>
        </div>
        <div class="wizard-footer">
          <button class="btn btn-sm btn-secondary" id="wc-cancel-footer">Cancel</button>
          <button class="btn btn-sm btn-primary" id="wc-commit">${isNew ? 'Add' : 'Save'}</button>
        </div>
      </div>
    `;
  }

  function _bindGroupEvents(modal, designer, parentArray, context) {
    [modal.querySelector('#wc-cancel'), modal.querySelector('#wc-cancel-footer')]
      .filter(Boolean).forEach(el => el.addEventListener('click', () => WizardCore.closeDialog()));

    modal.querySelector('#wc-adv-toggle').addEventListener('click', () => {
      designer.showAdvancedOptions = !designer.showAdvancedOptions;
      const sec = modal.querySelector('#wc-advanced');
      if (sec) sec.style.display = designer.showAdvancedOptions ? '' : 'none';
      modal.querySelector('#wc-adv-toggle').textContent =
        designer.showAdvancedOptions ? '▲ Hide advanced' : '▼ Show advanced';
    });

    modal.querySelector('#wc-commit').addEventListener('click', () => {
      const logicSel = modal.querySelector('#wc-group-logic');
      const logic = logicSel ? logicSel.value : 'all';
      // Map display choice back to o + n (§6.1)
      if (logic === 'all')  { designer.groupOp = 'and'; designer.groupNot = '0'; }
      if (logic === 'any')  { designer.groupOp = 'or';  designer.groupNot = '0'; }
      if (logic === 'none') { designer.groupOp = 'or';  designer.groupNot = '1'; }

      const desc = modal.querySelector('#wc-description');
      if (desc) designer.description = desc.value.trim();

      _commitGroup(designer, parentArray, context);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Commit — §9.4 Commit Sequence
  // ─────────────────────────────────────────────────────────────────────────
  function _commit(designer, parentArray, context, rearm) {
    WizardCore.autoSave();  // §0.5: snapshot BEFORE writing to live tree

    const node = designer.isNew
      ? _buildConditionNode(designer)
      : _applyToNode(designer);

    node.$$html = null;

    if (designer.isNew) {
      parentArray.push(node);
    }

    if (rearm) {
      // Add more: rebuild blank designer, keep dialog open
      designer.comparison    = WizardCore.newComparison();
      designer.rightValue    = '';
      designer.rightValue2   = '';
      designer.durationValue = '';
      designer.selectedAttrKey  = '';
      designer.attrMeta         = null;
      designer.selectedDeviceKeys = [];
      designer.capKeys          = [];
      _renderDialog(designer, parentArray, context);
    } else {
      WizardCore.closeDialog();
    }

    if (typeof Editor !== 'undefined' && Editor.refreshDisplay) {
      Editor.refreshDisplay(context);
    }
  }

  function _commitGroup(designer, parentArray, context) {
    WizardCore.autoSave();

    if (designer.isNew) {
      const groupNode = {
        id:          'cond_' + Math.random().toString(36).slice(2, 10),
        t:           'group',
        o:           designer.groupOp,
        n:           designer.groupNot === '1',
        c:           [],
        description: designer.description || null,
      };
      groupNode.$$html = null;
      parentArray.push(groupNode);
    } else {
      const node = designer.$node;
      node.o           = designer.groupOp;
      node.n           = designer.groupNot === '1';
      node.description = designer.description || null;
      node.$$html      = null;
    }

    WizardCore.closeDialog();
    if (typeof Editor !== 'undefined' && Editor.refreshDisplay) {
      Editor.refreshDisplay(context);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Build condition node from designer
  // Shape: PISTON_JSON_STRUCTURE_MAP.md §4
  // ─────────────────────────────────────────────────────────────────────────
  function _buildConditionNode(designer) {
    const isTrigger = designer.mode === 'trigger';
    const id        = _newId();

    // Resolve entity IDs from selected devices + chosen attribute
    const { role, roleTokens, entityIds } = _resolveEntities(designer);

    const attrMeta = designer.attrMeta || {};

    const node = {
      id,
      is_trigger:     isTrigger,
      role:           role,
      role_tokens:    roleTokens,
      entity_ids:     entityIds,
      aggregation:    designer.aggregation || 'any',
      attribute:      designer.selectedAttrKey || '',
      attribute_type: attrMeta.t || '',
      device_class:   null,
      operator:       designer.comparison.operator || '',
      display_value:  designer.rightValue  || '',
      compiled_value: designer.rightValue  || '',
      value_to:       designer.comparison.parameterCount === 2 ? (designer.rightValue2 || null) : null,
      duration:       designer.durationValue !== '' ? parseFloat(designer.durationValue) : null,
      duration_unit:  designer.durationValue !== '' ? (designer.durationUnit || 's') : null,
      interaction:    designer.interactionFilter || 'any',
      group_operator: designer.groupOperator || 'and',
    };

    // Expression subject override
    if (designer.leftSourceType === 'expression' && designer.expressionValue) {
      node.subject    = 'expression';
      node.role       = '';
      node.role_tokens = [];
      node.entity_ids  = [];
      node.value      = { type: 'expression', expression: designer.expressionValue };
    }

    // Variable subject override
    if (designer.leftSourceType === 'variable' && designer.variableRef) {
      node.subject  = 'variable';
      node.variable = designer.variableRef;
      node.role     = '';
      node.entity_ids = [];
      node.role_tokens = [designer.variableRef];
    }

    return node;
  }

  function _applyToNode(designer) {
    const node     = designer.$node;
    const attrMeta = designer.attrMeta || {};

    const { role, roleTokens, entityIds } = _resolveEntities(designer);
    if (entityIds.length > 0) {
      node.role        = role;
      node.role_tokens = roleTokens;
      node.entity_ids  = entityIds;
    }

    node.aggregation    = designer.aggregation || 'any';
    node.attribute      = designer.selectedAttrKey || node.attribute;
    node.attribute_type = attrMeta.t || node.attribute_type;
    node.operator       = designer.comparison.operator || node.operator;
    node.display_value  = designer.rightValue  || '';
    node.compiled_value = designer.rightValue  || '';
    node.value_to       = designer.comparison.parameterCount === 2 ? (designer.rightValue2 || null) : null;
    node.duration       = designer.durationValue !== '' ? parseFloat(designer.durationValue) : null;
    node.duration_unit  = designer.durationValue !== '' ? (designer.durationUnit || 's') : null;
    node.interaction    = designer.interactionFilter || 'any';
    node.group_operator = designer.groupOperator || node.group_operator;

    return node;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Entity resolution — §0.1 Load-Bearing Rule and §0.2
  // entity_ids: one entity per selected device for the chosen attribute key
  // role: friendly device name(s)
  // role_tokens: device keys (device_id or entity_id used as map key) for picker re-population.
  // NOT entity IDs — the picker restores checked boxes from role_tokens, so they must match
  // the keys in WizardCore.groupEntitiesByDevice()'s Map (i.e. designer.selectedDeviceKeys).
  // ─────────────────────────────────────────────────────────────────────────
  function _resolveEntities(designer) {
    if (designer.leftSourceType !== 'device' || designer.selectedDeviceKeys.length === 0) {
      return { role: '', roleTokens: [], entityIds: [] };
    }

    const deviceMap = WizardCore.groupEntitiesByDevice(WizardCore.getDeviceData() || []);
    const attrKey   = designer.selectedAttrKey;
    const labels    = [];
    const entityIds = [];

    for (const devKey of designer.selectedDeviceKeys) {
      const dev = deviceMap.get(devKey);
      if (!dev) continue;
      labels.push(dev.label);

      // For each entity in this device: include its entity_id if it maps to the chosen attr key
      for (const entity of dev.entities) {
        const meta = _entityToMeta(entity);
        const keys = WizardCore.getCapKeysForEntityRaw(meta);
        if (keys.has(attrKey)) {
          entityIds.push(entity.entity_id);
        }
      }
    }

    const role       = labels.join(', ');
    const roleTokens = designer.selectedDeviceKeys.slice();  // device keys, not entity IDs

    return { role, roleTokens, entityIds };
  }

  // Convert a raw HA entity object to the entityMeta shape intersectCapKeys expects
  function _entityToMeta(entity) {
    const attrs = entity.attributes || {};
    return {
      domain:                (entity.entity_id || '').split('.')[0],
      device_class:          attrs.device_class           || null,
      supported_features:    attrs.supported_features     || 0,
      supported_color_modes: attrs.supported_color_modes  || null,
      state_attributes:      attrs,
      unit_of_measurement:   attrs.unit_of_measurement    || null,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utility
  // ─────────────────────────────────────────────────────────────────────────
  function _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────
  return {
    openAdd,
    openEdit,
    openEditGroup,
  };

})();
