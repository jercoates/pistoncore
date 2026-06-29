// frontend/js/wizard-action.js
//
// Task dialog — picks a command and fills in its parameters.
// All command lists and parameter definitions come from webcore_vocab.json via WizardCore.
// No command names, parameter types, or enum options are hardcoded here.
//
// Entry points (called by editor.js):
//   WizardAction.openAddTask(actionNode, context)
//     — opens the task dialog to add a task to an action block
//   WizardAction.openEditTask(taskNode, actionNode, context)
//     — opens the task dialog to edit an existing task
//
// On commit: writes task node into actionNode.tasks at insertIndex.
// Calls Editor.refreshDisplay(context) to redraw the action block.
//
// Task node shape: PISTON_JSON_STRUCTURE_MAP.md §20

const WizardAction = (() => {

  function _newId() {
    return 'task_' + Math.random().toString(36).slice(2, 10);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public: open to add a new task inside an action block
  // ─────────────────────────────────────────────────────────────────────────
  function openAddTask(actionNode, context) {
    const designer = _newTaskDesigner(actionNode, true, null);
    WizardCore.openDialog(designer, null, null);
    _renderDialog(designer, actionNode, context);
    WizardCore.showWizard();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public: open to edit an existing task
  // ─────────────────────────────────────────────────────────────────────────
  function openEditTask(taskNode, actionNode, context) {
    const designer = _newTaskDesigner(actionNode, false, taskNode);
    designer.command    = taskNode.command || '';
    designer.paramVals  = Object.assign({}, taskNode.parameters || {});
    designer.description = taskNode.description || '';

    // Seed insertIndex to this task's position so the before/after preview
    // reflects the current task location
    const idx = (actionNode.tasks || []).indexOf(taskNode);
    if (idx >= 0) designer.insertIndex = idx;

    WizardCore.openDialog(designer, null, null);
    _renderDialog(designer, actionNode, context);
    WizardCore.showWizard();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Build a blank task designer for the given action node
  // ─────────────────────────────────────────────────────────────────────────
  function _newTaskDesigner(actionNode, isNew, existingTask) {
    return WizardCore.newDesigner({
      isNew:        isNew,
      page:         0,
      $node:        existingTask,
      $action:      actionNode,
      command:      '',
      paramVals:    {},      // { "0": value, "1": value, ... } keyed by param position
      insertIndex:  (actionNode.tasks || []).length,  // append by default
      description:  '',
      showAdvancedOptions: false,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render the dialog into #wizard-modal
  // ─────────────────────────────────────────────────────────────────────────
  function _renderDialog(designer, actionNode, context) {
    const modal = WizardCore.getModalEl();
    if (!modal) return;
    modal.innerHTML = _buildDialogHTML(designer, actionNode);
    _bindEvents(modal, designer, actionNode, context);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Build the full dialog HTML
  // ─────────────────────────────────────────────────────────────────────────
  function _buildDialogHTML(designer, actionNode) {
    const isNew   = designer.isNew;
    const role    = actionNode.role || 'device';

    // Compute available commands from vocab.json at runtime
    const { deviceCmds, virtualCmds } = _getAvailableCommands(actionNode);

    const cmdListHtml  = _buildCommandListHTML(deviceCmds, virtualCmds, designer.command);
    const paramHtml    = designer.command ? _buildParamHTML(designer) : '';
    const taskListHtml = _buildTaskListHTML(actionNode, designer.insertIndex);

    const advHtml = `
      <label>Description (optional)</label>
      <input type="text" id="wa-description" class="form-input"
        placeholder="Description" value="${_esc(designer.description)}">
    `;

    return `
      <div class="wizard-dialog" id="wizard-action-dialog">
        <div class="wizard-header">
          <span class="wizard-title">${isNew ? 'Add Task' : 'Edit Task'}: ${_esc(role)}</span>
          <button class="wizard-close btn-icon" id="wa-cancel">✕</button>
        </div>
        <div class="wizard-body">

          ${taskListHtml ? `
          <div class="wc-section">
            <label class="wc-section-label">Task order</label>
            ${taskListHtml}
          </div>` : ''}

          <div class="wc-section">
            <label class="wc-section-label">Choose a command</label>
            ${cmdListHtml}
          </div>

          <div class="wc-section" id="wa-params-section" style="${designer.command ? '' : 'display:none'}">
            <label class="wc-section-label">Parameters</label>
            ${paramHtml}
          </div>

          <div class="wizard-advanced-toggle">
            <button class="btn btn-sm btn-link" id="wa-adv-toggle">
              ${designer.showAdvancedOptions ? '▲ Hide advanced' : '▼ Show advanced'}
            </button>
          </div>
          <div id="wa-advanced" style="${designer.showAdvancedOptions ? '' : 'display:none'}">
            ${advHtml}
          </div>
        </div>
        <div class="wizard-footer">
          <button class="btn btn-sm btn-secondary" id="wa-cancel-footer">Cancel</button>
          <button class="btn btn-sm btn-primary" id="wa-commit"
            ${designer.command ? '' : 'disabled'}>${isNew ? 'Add' : 'Save'}</button>
          ${isNew ? `<button class="btn btn-sm btn-success" id="wa-add-more"
            ${designer.command ? '' : 'disabled'}>Add more</button>` : ''}
        </div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Get available commands for an action node — all from vocab.json at runtime
  //
  // deviceCmds: intersection of commands across all selected devices' capabilities
  // virtualCmds: all virtualCommands from vocab.json (§5.1 — full set, no curation)
  // ─────────────────────────────────────────────────────────────────────────
  function _getAvailableCommands(actionNode) {
    const entityIds  = actionNode.entity_ids || [];
    const deviceData = WizardCore.getDeviceData() || [];

    // Find which entities are in this action, group them by device
    const relevantEntities = deviceData.filter(e => entityIds.includes(e.entity_id));
    const deviceMap        = WizardCore.groupEntitiesByDevice(relevantEntities);

    let deviceCmds = [];

    if (deviceMap.size > 0) {
      // Build entity meta arrays per device
      const devicesEntityArrays = [...deviceMap.values()].map(dev =>
        dev.entities.map(e => _entityToMeta(e))
      );

      // Intersect capability keys across all devices
      const { capKeys } = WizardCore.intersectCapKeys(devicesEntityArrays);

      // Intersect command keys across all capability keys — only commands
      // available for ALL selected devices (Deviation D-1 §7.2)
      const cmdKeys = WizardCore.intersectCommandKeys(capKeys);

      // Build command list from vocab.json at runtime
      deviceCmds = cmdKeys.map(key => {
        const meta = WizardCore.getCommandMeta(key);
        return meta ? { key, ...meta } : { key, n: key };
      }).filter(c => c.n);
    }

    // All virtual commands from vocab.json — §5.1: full set, no curation
    const virtualCmds = WizardCore.getAllVirtualCommands();

    return { deviceCmds, virtualCmds };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Build the command picker — two groups, all content from vocab.json
  // ─────────────────────────────────────────────────────────────────────────
  function _buildCommandListHTML(deviceCmds, virtualCmds, selectedCmd) {
    const deviceRows = deviceCmds.length > 0
      ? deviceCmds.map(cmd => _cmdRow(cmd, selectedCmd)).join('')
      : '<p class="wizard-hint">No commands available for this device combination.</p>';

    const virtualRows = virtualCmds.map(cmd => _cmdRow(cmd, selectedCmd)).join('');

    return `
      <div class="wa-cmd-group">
        <div class="wa-cmd-group-label">Device commands</div>
        ${deviceRows}
      </div>
      <div class="wa-cmd-group">
        <div class="wa-cmd-group-label">Location commands (non-device)</div>
        ${virtualRows}
      </div>
    `;
  }

  function _cmdRow(cmd, selectedCmd) {
    const label   = cmd.n || cmd.key;
    const checked = selectedCmd === cmd.key;
    return `
      <label class="wa-cmd-row ${checked ? 'wa-cmd-selected' : ''}">
        <input type="radio" name="wa-command" class="wa-cmd-radio"
          value="${_esc(cmd.key)}" ${checked ? 'checked' : ''}>
        <span>${_esc(label)}</span>
      </label>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Build parameter inputs — driven entirely by vocab.json command.p at runtime
  //
  // Each parameter has: n (label), t (type), o (enum options), d (optional marker)
  // Parameters with a `d` field are optional — shown as optional inputs.
  // ─────────────────────────────────────────────────────────────────────────
  function _buildParamHTML(designer) {
    const cmdMeta = WizardCore.getCommandMeta(designer.command);
    if (!cmdMeta || !cmdMeta.p || cmdMeta.p.length === 0) {
      return '<p class="wizard-hint">No parameters needed for this command.</p>';
    }

    return cmdMeta.p.map((param, idx) => {
      const isOptional = !!param.d;
      const currentVal = designer.paramVals[String(idx)] || '';
      const widget     = _buildParamWidget(`wa-param-${idx}`, param, currentVal);

      return `
        <div class="wa-param-row ${isOptional ? 'wa-param-optional' : ''}">
          <label>${_esc(param.n)}${isOptional ? ' <span class="wa-optional">(optional)</span>' : ''}</label>
          ${widget}
        </div>
      `;
    }).join('');
  }

  // Render one parameter input widget — type-driven from vocab.json param.t and param.o
  function _buildParamWidget(id, param, currentVal) {
    // Enum options directly on parameter (t:'enum' with o array)
    if (param.o && param.o.length > 0) {
      const opts = param.o.map(opt =>
        `<option value="${_esc(opt)}" ${currentVal === opt ? 'selected' : ''}>${_esc(opt)}</option>`
      ).join('');
      return `<select id="${id}" class="form-select wa-param-input" data-idx="${id.split('-').pop()}">
        <option value="">— pick value —</option>${opts}
      </select>`;
    }

    // Named enum type — look up options from attrTrans at runtime
    const attrMeta = WizardCore.getAttrMeta(param.t);
    if (attrMeta && attrMeta.o && attrMeta.o.length > 0) {
      const opts = attrMeta.o.map(opt =>
        `<option value="${_esc(opt)}" ${currentVal === opt ? 'selected' : ''}>${_esc(opt)}</option>`
      ).join('');
      return `<select id="${id}" class="form-select wa-param-input" data-idx="${id.split('-').pop()}">
        <option value="">— pick value —</option>${opts}
      </select>`;
    }

    // Numeric types — level, saturation, hue, percentage and named numeric attrs
    const numericTypes = ['level', 'saturation', 'hue', 'integer', 'decimal', 'number', 'percentage'];
    if (numericTypes.includes(param.t) || (attrMeta && (attrMeta.t === 'integer' || attrMeta.t === 'decimal'))) {
      const min  = (attrMeta && attrMeta.r && attrMeta.r[0] != null) ? `min="${attrMeta.r[0]}"` : 'min="0"';
      const max  = (attrMeta && attrMeta.r && attrMeta.r[1] != null) ? `max="${attrMeta.r[1]}"` : (param.t === 'level' ? 'max="100"' : '');
      const unit = (attrMeta && attrMeta.u) ? `<span class="wc-unit">${_esc(attrMeta.u)}</span>` : '';
      const step = (attrMeta && attrMeta.t === 'decimal') ? 'step="0.1"' : '';
      return `<div class="wizard-row">
        <input type="number" id="${id}" class="form-input wa-param-input" ${min} ${max} ${step} value="${_esc(currentVal)}">
        ${unit}
      </div>`;
    }

    // Boolean
    if (param.t === 'boolean') {
      return `<select id="${id}" class="form-select wa-param-input">
        <option value="">—</option>
        <option value="true"  ${currentVal === 'true'  ? 'selected' : ''}>true</option>
        <option value="false" ${currentVal === 'false' ? 'selected' : ''}>false</option>
      </select>`;
    }

    // URI, string, object, and everything else → text input
    return `<input type="text" id="${id}" class="form-input wa-param-input"
      placeholder="${_esc(param.n)}" value="${_esc(currentVal)}">`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Show existing tasks above/below the insert cursor (§7.3 insertIndex)
  // ─────────────────────────────────────────────────────────────────────────
  function _buildTaskListHTML(actionNode, insertIndex) {
    const tasks = actionNode.tasks || [];
    if (tasks.length === 0) return '';

    const rows = tasks.map((t, i) => {
      const label    = WizardCore.renderTaskDisplay(t.command, t.parameters || {});
      const position = i < insertIndex ? 'above' : 'below';
      return `<div class="wa-existing-task wa-task-${position}">${_esc(label)}</div>`;
    });

    // Insert marker
    rows.splice(insertIndex, 0, `<div class="wa-insert-marker">▶ inserting here</div>`);

    return `<div class="wa-task-list">${rows.join('')}</div>`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event binding
  // ─────────────────────────────────────────────────────────────────────────
  function _bindEvents(modal, designer, actionNode, context) {
    // Cancel
    [modal.querySelector('#wa-cancel'), modal.querySelector('#wa-cancel-footer')]
      .filter(Boolean)
      .forEach(el => el.addEventListener('click', () => WizardCore.closeDialog()));

    // Advanced toggle
    modal.querySelector('#wa-adv-toggle').addEventListener('click', () => {
      designer.showAdvancedOptions = !designer.showAdvancedOptions;
      const sec = modal.querySelector('#wa-advanced');
      if (sec) sec.style.display = designer.showAdvancedOptions ? '' : 'none';
      modal.querySelector('#wa-adv-toggle').textContent =
        designer.showAdvancedOptions ? '▲ Hide advanced' : '▼ Show advanced';
    });

    // Command selection — when user picks a command, param section appears
    modal.querySelectorAll('.wa-cmd-radio').forEach(radio => {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        designer.command   = radio.value;
        designer.paramVals = {};
        _renderDialog(designer, actionNode, context);
      });
    });

    // Commit
    const commitBtn  = modal.querySelector('#wa-commit');
    const addMoreBtn = modal.querySelector('#wa-add-more');

    if (commitBtn && !commitBtn.disabled) {
      commitBtn.addEventListener('click', () => {
        _readFields(modal, designer);
        _commit(designer, actionNode, context, false);
      });
    }
    if (addMoreBtn && !addMoreBtn.disabled) {
      addMoreBtn.addEventListener('click', () => {
        _readFields(modal, designer);
        _commit(designer, actionNode, context, true);
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Read parameter values from DOM back into designer
  // ─────────────────────────────────────────────────────────────────────────
  function _readFields(modal, designer) {
    // Parameter values — indexed by position
    modal.querySelectorAll('.wa-param-input').forEach(el => {
      const idx = el.id.replace('wa-param-', '');
      designer.paramVals[idx] = el.value;
    });

    const desc = modal.querySelector('#wa-description');
    if (desc) designer.description = desc.value.trim();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Commit — §9.4 Commit Sequence + §10.1 re-arm for Add more
  // ─────────────────────────────────────────────────────────────────────────
  function _commit(designer, actionNode, context, rearm) {
    WizardCore.autoSave();  // §0.5: snapshot BEFORE writing to live tree

    const tasks = actionNode.tasks || (actionNode.tasks = []);

    if (designer.isNew) {
      const task = _buildTaskNode(designer, actionNode);
      tasks.splice(designer.insertIndex, 0, task);
      designer.insertIndex++;  // advance cursor for Add more
    } else {
      _applyToTask(designer);
    }

    actionNode.$$html = null;

    if (rearm) {
      // Add more: reset command + params, keep dialog open at new insert position
      designer.command   = '';
      designer.paramVals = {};
      designer.description = '';
      _renderDialog(designer, actionNode, context);
    } else {
      WizardCore.closeDialog();
    }

    if (typeof Editor !== 'undefined' && Editor.refreshDisplay) {
      Editor.refreshDisplay(context);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Build a new task node — §20 shape
  // Parameters stored positionally; compiler maps to HA parameter names.
  // ─────────────────────────────────────────────────────────────────────────
  function _buildTaskNode(designer, actionNode) {
    const cmdKey  = designer.command;
    const cmdMeta = WizardCore.getCommandMeta(cmdKey);

    // Determine domain from action node's entity_ids
    const domain  = _domainFromAction(actionNode);
    const service = domain ? `${domain}.${cmdKey}` : cmdKey;

    // Build parameters object — skip empty optional values
    const parameters = _buildParameters(cmdMeta, designer.paramVals);

    return {
      id:          _newId(),
      command:     cmdKey,
      domain:      domain || 'virtual',
      ha_service:  service,
      parameters:  parameters,
      description: designer.description || null,
    };
  }

  function _applyToTask(designer) {
    const task    = designer.$node;
    const cmdMeta = WizardCore.getCommandMeta(designer.command);
    task.command     = designer.command;
    task.parameters  = _buildParameters(cmdMeta, designer.paramVals);
    task.description = designer.description || null;
    task.$$html      = null;
    return task;
  }

  // Build parameters object from positional values + vocab command definition
  // Skips optional parameters (those with a `d` field) when value is empty
  function _buildParameters(cmdMeta, paramVals) {
    if (!cmdMeta || !cmdMeta.p || cmdMeta.p.length === 0) return {};
    const result = {};
    cmdMeta.p.forEach((param, idx) => {
      const val       = (paramVals[String(idx)] || '').trim();
      const isOptional = !!param.d;
      if (isOptional && val === '') return;  // skip empty optional params
      result[String(idx)] = val;
    });
    return result;
  }

  // Get domain from action node's entity_ids (first entity's domain prefix)
  function _domainFromAction(actionNode) {
    const ids = actionNode.entity_ids || [];
    if (ids.length === 0) return null;
    return ids[0].split('.')[0] || null;
  }

  // Convert raw HA entity to entityMeta shape for WizardCore.intersectCapKeys
  function _entityToMeta(entity) {
    const attrs = entity.attributes || {};
    return {
      domain:                (entity.entity_id || '').split('.')[0],
      device_class:          attrs.device_class          || null,
      supported_features:    attrs.supported_features    || 0,
      supported_color_modes: attrs.supported_color_modes || null,
      state_attributes:      attrs,
      unit_of_measurement:   attrs.unit_of_measurement   || null,
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
    openAddTask,
    openEditTask,
  };

})();
