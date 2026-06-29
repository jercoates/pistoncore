// frontend/js/wizard-core.js
//
// Shared wizard infrastructure. All three runtime JSON data files are loaded here
// at startup; all operator lists, capability menus, attribute metadata, and command
// display strings are derived from those files at runtime — nothing is hardcoded.
//
// Load order (HTML must preserve this):
//   wizard-core.js         ← this file (first)
//   wizard-statement.js
//   wizard-condition.js
//   wizard-loops.js
//   wizard-action.js
//   wizard-variable.js
//
// Public namespace: WizardCore
// Used by all other wizard files.

const WizardCore = (() => {

  // ── Runtime data (populated by init()) ───────────────────────────────────
  let _vocab     = null;   // webcore_vocab.json
  let _capMap    = null;   // picker_capability_map.json
  let _attrTrans = null;   // pistoncore_attribute_translation.json
  let _ready     = false;

  // ── Editor-supplied state (set at editor open) ────────────────────────────
  let _deviceData      = null;   // raw HA entity list
  let _globalsData     = null;   // global variable objects
  let _pistonVars      = null;   // current piston's local variables
  let _autoSaveFn      = null;   // registered autoSave() from editor.js

  // ── Active dialog state (§0.4 Edit-Isolation Contract) ───────────────────
  let _designer        = null;
  let _onCommit        = null;
  let _onCancel        = null;

  // ─────────────────────────────────────────────────────────────────────────
  // Statement types — structural list from PISTON_JSON_STRUCTURE_MAP.md §5–27
  // These are the piston tree node types, not vocabulary data; they live in
  // code because the spec defines them, not webcore_vocab.json.
  // §5: ELSE_IF is excluded — added via "+ add else if" inside an IF block.
  // ─────────────────────────────────────────────────────────────────────────
  const STATEMENT_TYPES = [
    { type: 'if',                   label: 'If Block',              desc: 'Execute different actions based on conditions you define' },
    { type: 'action',               label: 'Action',                desc: 'A collection of tasks for devices to perform' },
    { type: 'every',                label: 'Every (Timer)',          desc: 'Repeat statements at a regular interval' },
    { type: 'switch',               label: 'Switch',                desc: 'Compare an expression against multiple possible values' },
    { type: 'do',                   label: 'Do Block',              desc: 'Group statements into a single named block' },
    { type: 'on_event',             label: 'On Event',              desc: 'Execute statements only when a specific event occurs' },
    { type: 'for',                  label: 'For Loop',              desc: 'Repeat statements for a fixed number of iterations' },
    { type: 'for_each',             label: 'For Each Loop',         desc: 'Repeat statements for each device in a list' },
    { type: 'while',                label: 'While Loop',            desc: 'Repeat while a condition remains true' },
    { type: 'repeat',               label: 'Repeat Loop',           desc: 'Repeat until a condition is met' },
    { type: 'set_variable',         label: 'Set Variable',          desc: 'Assign a value to a piston variable' },
    { type: 'wait',                 label: 'Wait',                  desc: 'Pause execution for a duration or until a condition' },
    { type: 'wait_for_state',       label: 'Wait for State',        desc: 'Pause until device conditions are met' },
    { type: 'log_message',          label: 'Log Message',           desc: 'Write a message to the log at a chosen level' },
    { type: 'call_piston',          label: 'Call Piston',           desc: 'Execute another piston' },
    { type: 'cancel_pending_tasks', label: 'Cancel Pending Tasks',  desc: 'Cancel all pending scheduled tasks in this piston' },
    { type: 'break',                label: 'Break',                 desc: 'Exit the innermost loop or switch block' },
    { type: 'exit',                 label: 'Exit',                  desc: 'End the piston run' },
  ];

  // Calendar constants — standard, not from vocab
  const WEEKDAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // ─────────────────────────────────────────────────────────────────────────
  // Initialization — load all three runtime JSON data files
  // All other wizard operations depend on these being loaded first.
  // ─────────────────────────────────────────────────────────────────────────

  async function init() {
    const base = window.location.origin;
    const [vocabRes, capMapRes, attrRes] = await Promise.all([
      fetch(base + '/webcore_vocab.json'),
      fetch(base + '/picker_capability_map.json'),
      fetch(base + '/pistoncore_attribute_translation.json'),
    ]);

    if (!vocabRes.ok)    throw new Error('WizardCore: failed to load webcore_vocab.json');
    if (!capMapRes.ok)   throw new Error('WizardCore: failed to load picker_capability_map.json');
    if (!attrRes.ok)     throw new Error('WizardCore: failed to load pistoncore_attribute_translation.json');

    _vocab     = await vocabRes.json();
    _capMap    = await capMapRes.json();
    _attrTrans = await attrRes.json();
    _ready     = true;
  }

  function isReady() { return _ready; }

  // ─────────────────────────────────────────────────────────────────────────
  // Capability detection — picker_capability_map.json lookup algorithm
  //
  // Per §8.2 five-step pipeline and picker_capability_map.json _meta.usage:
  //   (1) look up by domain
  //   (2) apply sub-rules: always → by_device_class → by_supported_color_modes
  //                        → by_supported_features → by_declaration_attr
  //   (3) union keys within one device (across its entities)
  //   (4) intersect keys across all selected devices
  //   (5) menu is built from the resulting key set via webcore_vocab.json
  //
  // entityMeta fields the caller must supply (from backend HA entity data):
  //   domain, device_class, supported_features (int), supported_color_modes (array),
  //   state_attributes (object of attr names present on the entity), unit_of_measurement
  // ─────────────────────────────────────────────────────────────────────────

  function _getCapKeysForEntityRaw(entityMeta) {
    const keys = new Set();
    if (!_capMap || !_capMap.domains) return keys;

    const domainRules = _capMap.domains[entityMeta.domain];
    if (!domainRules) return keys;

    // always rules
    if (domainRules.always) {
      for (const k of (domainRules.always.attributes || [])) keys.add(k);
    }

    // by_device_class
    if (domainRules.by_device_class && entityMeta.device_class) {
      const rule = domainRules.by_device_class[entityMeta.device_class];
      if (rule) for (const k of (rule.attributes || [])) keys.add(k);
    }

    // by_supported_color_modes — primary detection for lights (HA 2022.5+)
    if (domainRules.by_supported_color_modes && Array.isArray(entityMeta.supported_color_modes)) {
      for (const mode of entityMeta.supported_color_modes) {
        const rule = domainRules.by_supported_color_modes[mode];
        if (rule) for (const k of (rule.attributes || [])) keys.add(k);
      }
    }

    // by_supported_features — integer bitmask
    if (domainRules.by_supported_features && entityMeta.supported_features != null) {
      const bits = parseInt(entityMeta.supported_features, 10) || 0;
      for (const rule of Object.values(domainRules.by_supported_features)) {
        if (rule.bit && (bits & rule.bit)) {
          for (const k of (rule.attributes || [])) keys.add(k);
        }
      }
    }

    // by_declaration_attr — attribute name present in entity's state_attributes
    if (domainRules.by_declaration_attr && entityMeta.state_attributes) {
      for (const [attrName, rule] of Object.entries(domainRules.by_declaration_attr)) {
        if (Object.prototype.hasOwnProperty.call(entityMeta.state_attributes, attrName)) {
          for (const k of (rule.attributes || [])) keys.add(k);
        }
      }
    }

    // legacy_by_supported_features — only when supported_color_modes is absent (older HA)
    if (domainRules.legacy_by_supported_features &&
        !Array.isArray(entityMeta.supported_color_modes) &&
        entityMeta.supported_features != null) {
      const bits = parseInt(entityMeta.supported_features, 10) || 0;
      for (const rule of Object.values(domainRules.legacy_by_supported_features)) {
        if (rule.bit && (bits & rule.bit)) {
          for (const k of (rule.attributes || [])) keys.add(k);
        }
      }
    }

    // by_unit_fallback — when device_class is null, match on unit_of_measurement
    if (domainRules.by_unit_fallback &&
        !entityMeta.device_class &&
        entityMeta.unit_of_measurement) {
      for (const rule of Object.values(domainRules.by_unit_fallback)) {
        if (rule.unit_match && entityMeta.unit_of_measurement === rule.unit_match) {
          for (const k of (rule.attributes || [])) keys.add(k);
        }
      }
    }

    return keys;  // may include 'speak_gate' — caller decides what to do with it
  }

  // Union keys across all entities belonging to one physical device.
  // Also detects the speak_gate signal for §7.5 (PLAY_MEDIA bit).
  // Returns { keys: Set<string>, speakGate: boolean }
  function _getCapKeysForDevice(entitiesMetaArray) {
    const keys = new Set();
    let speakGate = false;

    for (const entityMeta of (entitiesMetaArray || [])) {
      const raw = _getCapKeysForEntityRaw(entityMeta);
      if (raw.has('speak_gate')) speakGate = true;
      for (const k of raw) {
        if (k !== 'speak_gate') keys.add(k);
      }
    }

    return { keys, speakGate };
  }

  // Intersect capability keys across all selected devices.
  // devicesArray: array of entity-meta arrays, one inner array per device.
  // Returns { capKeys: Set<string>, speakGate: boolean }
  // speakGate is true only when ALL devices signal PLAY_MEDIA (§7.5 intersection rule).
  function intersectCapKeys(devicesArray) {
    if (!Array.isArray(devicesArray) || devicesArray.length === 0) {
      return { capKeys: new Set(), speakGate: false };
    }

    let resultKeys  = null;
    let allSpeakGate = true;

    for (const deviceEntities of devicesArray) {
      const { keys, speakGate } = _getCapKeysForDevice(deviceEntities);
      if (!speakGate) allSpeakGate = false;

      if (resultKeys === null) {
        resultKeys = new Set(keys);
      } else {
        for (const k of resultKeys) {
          if (!keys.has(k)) resultKeys.delete(k);
        }
      }
    }

    return { capKeys: resultKeys || new Set(), speakGate: allSpeakGate };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Attribute metadata — pistoncore_attribute_translation.json
  // Direction: WebCoRE attribute key → type, enum options, range, unit
  // ─────────────────────────────────────────────────────────────────────────

  function getAttrMeta(attrKey) {
    return (_attrTrans && _attrTrans.attributes && _attrTrans.attributes[attrKey]) || null;
  }

  // Maps attribute type string → operator group code used to filter comparisons.
  // E.g. 'enum' → 's', 'integer' → 'di', 'boolean' → 'b', 'time' → 't'
  // Source: pistoncore_attribute_translation.json attributeTypeToOperatorGroup section.
  function getOperatorGroupForType(attrType) {
    if (!_attrTrans || !_attrTrans.attributeTypeToOperatorGroup) return 's';
    return _attrTrans.attributeTypeToOperatorGroup[attrType] || 's';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Operator lists — derived from webcore_vocab.json comparisons at runtime
  //
  // An operator appears for an attribute type when the operator's 'g' field
  // contains at least one character that appears in the attribute type's
  // operator group code (from attributeTypeToOperatorGroup).
  //
  // mode: 'conditions' | 'triggers'
  // Returns array of { key, d, dd, g, p, t, m } objects.
  // ─────────────────────────────────────────────────────────────────────────

  function getOperatorsForAttrType(attrType, mode) {
    if (!_vocab || !_vocab.comparisons) return [];
    const group = getOperatorGroupForType(attrType);
    const comparisons = _vocab.comparisons[mode] || {};

    return Object.entries(comparisons)
      .filter(([, op]) => {
        if (!op.g) return false;
        return group.split('').some(gc => op.g.includes(gc));
      })
      .map(([key, op]) => ({ key, ...op }));
  }

  // Returns metadata for a single operator key, or null if not found.
  function getOperatorMeta(opKey, mode) {
    if (!_vocab || !_vocab.comparisons) return null;
    const op = (_vocab.comparisons[mode] || {})[opKey];
    return op ? { key: opKey, ...op } : null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Capability and command lookup — webcore_vocab.json
  // ─────────────────────────────────────────────────────────────────────────

  function getCapabilityInfo(capKey) {
    return (_vocab && _vocab.capabilities && _vocab.capabilities[capKey]) || null;
  }

  // Get vocab attribute display metadata (from vocab.attributes, the display layer).
  // Different from getAttrMeta() which reads the translation table (compiler direction).
  function getVocabAttrInfo(attrKey) {
    return (_vocab && _vocab.attributes && _vocab.attributes[attrKey]) || null;
  }

  // Returns the list of command keys advertised by a capability (cap.c array).
  function getCommandKeysForCap(capKey) {
    const cap = getCapabilityInfo(capKey);
    return (cap && cap.c) ? cap.c : [];
  }

  // Intersect command keys across all capability keys.
  // Only commands present for ALL capabilities are returned (per Deviation D-1 §7.2).
  function intersectCommandKeys(capKeys) {
    const arr = Array.isArray(capKeys) ? capKeys : [...capKeys];
    if (arr.length === 0) return [];

    let result = null;
    for (const capKey of arr) {
      const cmds = new Set(getCommandKeysForCap(capKey));
      if (result === null) {
        result = cmds;
      } else {
        for (const k of result) {
          if (!cmds.has(k)) result.delete(k);
        }
      }
    }
    return result ? [...result] : [];
  }

  // Returns command metadata from vocab.commands or vocab.virtualCommands.
  function getCommandMeta(cmdKey) {
    if (!_vocab) return null;
    return (_vocab.commands && _vocab.commands[cmdKey]) ||
           (_vocab.virtualCommands && _vocab.virtualCommands[cmdKey]) || null;
  }

  // Returns all virtual commands as array of { key, n, d, p } — §5.1.
  function getAllVirtualCommands() {
    if (!_vocab || !_vocab.virtualCommands) return [];
    return Object.entries(_vocab.virtualCommands).map(([key, meta]) => ({ key, ...meta }));
  }

  // Returns all physical commands as array of { key, n, d, p }.
  function getAllCommands() {
    if (!_vocab || !_vocab.commands) return [];
    return Object.entries(_vocab.commands).map(([key, meta]) => ({ key, ...meta }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Command display rendering — §2.2 renderTask
  // Replaces {0}, {1}, {2}... placeholders with actual parameter values.
  // Falls back to command.n when no d field, then to the key itself.
  // ─────────────────────────────────────────────────────────────────────────

  function renderTaskDisplay(cmdKey, paramValues) {
    const meta = getCommandMeta(cmdKey);
    if (!meta) return cmdKey;
    if (!meta.d) return meta.n || cmdKey;
    return meta.d.replace(/\{(\d+)\}/g, (_, idx) => {
      const v = paramValues && paramValues[parseInt(idx, 10)];
      return (v !== undefined && v !== null && v !== '') ? String(v) : '…';
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Operand helpers — §4.7 Operand Data Shape
  // ─────────────────────────────────────────────────────────────────────────

  function newOperand(overrides) {
    return Object.assign(
      { t: '', a: '', c: '', v: '', e: '', x: '', d: [], g: 'any', f: 'l' },
      overrides || {}
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Comparison template — §9.6 Comparison Template
  // Used by edit-condition, edit-restriction, edit-event designer objects.
  // ─────────────────────────────────────────────────────────────────────────

  function newComparison() {
    return {
      left:           newOperand(),
      operator:       '',
      right:          newOperand(),
      right2:         newOperand(),
      time:           newOperand(),
      time2:          newOperand(),
      within:         newOperand(),
      withinOpt:      'l',
      parameterCount: 0,    // computed from operator.p
      timed:          0,    // computed from operator.t
      event:          false,
      valid:          false,
    };
  }

  // Recompute parameterCount and timed on a comparison after operator changes.
  // mode: 'conditions' | 'triggers'
  function updateComparisonForOperator(comparison, mode) {
    const opMeta = getOperatorMeta(comparison.operator, mode);
    if (!opMeta) {
      comparison.parameterCount = 0;
      comparison.timed = 0;
      return;
    }
    comparison.parameterCount = (opMeta.p != null) ? opMeta.p : 0;
    comparison.timed           = (opMeta.t != null) ? opMeta.t : 0;
  }

  // Set comparison.valid based on current state.
  // Rules: left type must be chosen, operator must be set,
  // and right type must be set when parameterCount > 0.
  function validateComparison(comparison) {
    const leftOk  = !!(comparison.left && comparison.left.t);
    const opOk    = !!comparison.operator;
    const rightOk = comparison.parameterCount === 0 || !!(comparison.right && comparison.right.t);
    comparison.valid = leftOk && opOk && rightOk;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Designer scratch buffer — §0.4 Edit-Isolation Contract
  // Dialogs edit a designer copy, never the live node.
  // ─────────────────────────────────────────────────────────────────────────

  function newDesigner(overrides) {
    return Object.assign(
      { isNew: true, page: 0, showAdvancedOptions: false, description: '' },
      overrides || {}
    );
  }

  function getDesigner()  { return _designer; }
  function setDesigner(d) { _designer = d; }

  // ─────────────────────────────────────────────────────────────────────────
  // autoSave — §0.5 Commit Bracket
  // Editor registers its autoSave function here. Every wizard commit calls
  // WizardCore.autoSave() BEFORE writing to the live tree.
  // ─────────────────────────────────────────────────────────────────────────

  function registerAutoSave(fn) { _autoSaveFn = fn; }
  function autoSave()           { if (_autoSaveFn) _autoSaveFn(); }

  // ─────────────────────────────────────────────────────────────────────────
  // Editor-supplied state — set at editor open
  // ─────────────────────────────────────────────────────────────────────────

  function setDeviceData(data)     { _deviceData = data; }
  function setGlobalsData(data)    { _globalsData = data; }
  function setPistonVars(vars)     { _pistonVars = vars; }

  function getDeviceData()         { return _deviceData; }
  function getGlobalsData()        { return _globalsData; }
  function getPistonVars()         { return _pistonVars; }

  // Group raw entity array into a Map<deviceKey, { label, entities[] }>.
  // Keyed by device_id when present, otherwise by entity_id.
  function groupEntitiesByDevice(rawEntities) {
    const map = new Map();
    for (const e of (rawEntities || [])) {
      const key   = e.device_id || e.entity_id;
      const label = e.friendly_name || e.entity_id;
      if (!map.has(key)) map.set(key, { label, entities: [] });
      map.get(key).entities.push(e);
    }
    return map;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Dialog management — single #wizard-modal container populated dynamically
  // ─────────────────────────────────────────────────────────────────────────

  function getModalEl() {
    return document.getElementById('wizard-modal');
  }

  function showWizard() {
    const bd = document.getElementById('wizard-backdrop');
    if (bd) bd.style.display = 'flex';
  }

  function hideWizard() {
    const bd = document.getElementById('wizard-backdrop');
    if (bd) bd.style.display = 'none';
    const modal = document.getElementById('wizard-modal');
    if (modal) modal.innerHTML = '';
  }

  // Each wizard file: (1) calls openDialog to register state, (2) injects HTML
  // into getModalEl(), (3) calls showWizard().
  function openDialog(designer, onCommit, onCancel) {
    _designer = designer;
    _onCommit = onCommit || null;
    _onCancel = onCancel || null;
  }

  function closeDialog() {
    _designer = null;
    _onCommit = null;
    _onCancel = null;
    hideWizard();
  }

  function commitDialog(commitData) {
    const cb = _onCommit;
    closeDialog();
    if (cb) cb(commitData);
  }

  function cancelDialog() {
    const cb = _onCancel;
    closeDialog();
    if (cb) cb();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utility: deep clone a plain object (for designer scratch buffers)
  // ─────────────────────────────────────────────────────────────────────────
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  return {
    // Startup
    init,
    isReady,

    // Raw data accessors (when a wizard file needs the full JSON)
    getVocab:            () => _vocab,
    getCapMap:           () => _capMap,
    getAttrTranslation:  () => _attrTrans,

    // Capability detection pipeline (§8.2)
    intersectCapKeys,

    // Attribute metadata (pistoncore_attribute_translation.json — compiler direction)
    getAttrMeta,
    getOperatorGroupForType,

    // Operator lists (derived from webcore_vocab.json at runtime)
    getOperatorsForAttrType,
    getOperatorMeta,

    // Capability and command lookup (webcore_vocab.json)
    getCapabilityInfo,
    getVocabAttrInfo,
    getCommandKeysForCap,
    intersectCommandKeys,
    getCommandMeta,
    getAllVirtualCommands,
    getAllCommands,

    // Command display
    renderTaskDisplay,

    // Operand / comparison helpers
    newOperand,
    newComparison,
    updateComparisonForOperator,
    validateComparison,

    // Designer scratch buffer
    newDesigner,
    getDesigner,
    setDesigner,

    // autoSave (§0.5 Commit Bracket)
    registerAutoSave,
    autoSave,

    // Editor-supplied runtime state
    setDeviceData,
    setGlobalsData,
    setPistonVars,
    getDeviceData,
    getGlobalsData,
    getPistonVars,
    groupEntitiesByDevice,

    // Dialog management
    getModalEl,
    showWizard,
    hideWizard,
    openDialog,
    closeDialog,
    commitDialog,
    cancelDialog,

    // Utilities
    deepClone,

    // Structural constants (spec-defined, not from vocab.json)
    STATEMENT_TYPES,
    WEEKDAYS,
    MONTHS,
  };

})();
