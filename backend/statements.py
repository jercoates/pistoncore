"""
PistonCore Statement Compiler
Compiles piston action statements to HA YAML strings.
COMPILER_SPEC Section 7.2 and 8.x.
"""

from .exceptions import CompilerError, CompilerWarning
from .conditions import compile_condition
from .utils import format_delay


# Accumulator for warnings — populated during compile_statement calls.
# The top-level compile_piston() collects these after each compile pass.
_warnings: list = []


def get_and_clear_warnings() -> list:
    """Return accumulated warnings and reset the list."""
    global _warnings
    result = list(_warnings)
    _warnings = []
    return result


def _warn(msg: str):
    _warnings.append(CompilerWarning(msg))


def compile_statement(stmt: dict, device_map: dict, piston: dict, indent: int = 4) -> str:
    """
    Dispatch a statement to the appropriate compiler.
    Returns an indented YAML string.
    Raises CompilerError on unrecoverable problems.
    """
    dispatch = {
        "with_block":           _compile_with_block,
        "wait":                 _compile_wait,
        "wait_for_state":       _compile_wait_for_state,
        "if_block":             _compile_if_block,
        "repeat_block":         _compile_repeat_block,
        "for_each_block":       _compile_for_each_block,
        "while_block":          _compile_while_block,
        "for_loop":             _compile_for_loop,
        "set_variable":         _compile_set_variable,
        "log_message":          _compile_log_message,
        "call_piston":          _compile_call_piston,
        "control_piston":       _compile_control_piston,
        "stop":                 _compile_stop,
        "switch_block":         _compile_switch_block,
        "do_block":             _compile_do_block,
        "cancel_pending_tasks": _pyscript_only_error,
        "break":                _pyscript_only_error,
        "on_event":             _pyscript_only_error,
    }

    fn = dispatch.get(stmt.get("type"))
    if fn is None:
        raise CompilerError(f"Unknown statement type: '{stmt.get('type')}'")

    return fn(stmt, device_map, piston, indent)


def compile_statements(stmts: list, device_map: dict, piston: dict, indent: int = 4) -> str:
    """Compile a list of statements and join them with blank lines between."""
    parts = []
    for stmt in stmts:
        parts.append(compile_statement(stmt, device_map, piston, indent))
    return "\n\n".join(parts)


# --- Statement compilers ---

def _compile_with_block(stmt: dict, device_map: dict, piston: dict, indent: int) -> str:
    """
    COMPILER_SPEC Section 8.1
    Single task → direct action block with continue_on_error: true
    Multiple tasks → parallel block, each with continue_on_error: true
    """
    stmt_id = stmt["id"]
    role = stmt.get("target_role")
    tasks = stmt.get("tasks", [])
    pad = " " * indent

    if not tasks:
        raise CompilerError(
            f"Statement {stmt_id} (with_block) has no tasks defined."
        )

    entity_id = _resolve_role(role, device_map, stmt_id)

    # Compile any only_when restrictions first
    restriction_yaml = _compile_only_when(stmt, device_map, piston, indent)

    if len(tasks) == 1:
        task = tasks[0]
        block = _compile_single_task(stmt_id, task, entity_id, pad)
        return restriction_yaml + block if restriction_yaml else block
    else:
        # Multiple tasks → parallel block
        lines = [
            f"{pad}- alias: \"{stmt_id}\"",
            f"{pad}  parallel:",
        ]
        inner = " " * (indent + 4)
        for task in tasks:
            task_entity = entity_id  # same role for all tasks in one with_block
            lines.append(_compile_single_task(None, task, task_entity, inner))
        result = "\n".join(lines)
        return restriction_yaml + result if restriction_yaml else result


def _compile_single_task(stmt_id, task: dict, entity_id: str, pad: str) -> str:
    service = task.get("service", "")
    data = task.get("data") or {}

    lines = []
    if stmt_id:
        lines.append(f"{pad}- alias: \"{stmt_id}\"")
    else:
        lines.append(f"{pad}-")
    lines.append(f"{pad}  action: {service}")
    lines.append(f"{pad}  target:")
    lines.append(f"{pad}    entity_id: {entity_id}")
    if data:
        lines.append(f"{pad}  data:")
        for k, v in data.items():
            lines.append(f"{pad}    {k}: {v}")
    lines.append(f"{pad}  continue_on_error: true")
    return "\n".join(lines)


def _compile_wait(stmt: dict, device_map: dict, piston: dict, indent: int) -> str:
    """
    COMPILER_SPEC Section 8.2
    wait until time → wait_for_trigger with CompilerWarning always
    wait duration   → delay block
    """
    stmt_id = stmt["id"]
    pad = " " * indent

    if "until" in stmt and stmt["until"] is not None:
        at_time = stmt["until"]
        _warn(
            f"'Wait until {at_time}' will pause until that time today. "
            f"If this step is reached after {at_time} has already passed, "
            f"the piston will wait until {at_time} tomorrow. This is expected "
            f"HA behavior — structure your piston so this step is reached before "
            f"the target time, or use a fixed duration delay instead."
        )
        return (
            f"{pad}- alias: \"{stmt_id}\"\n"
            f"{pad}  wait_for_trigger:\n"
            f"{pad}    - trigger: time\n"
            f"{pad}      at: \"{at_time}\""
        )

    elif "duration_seconds" in stmt:
        delay_yaml = format_delay(stmt["duration_seconds"])
        # format_delay may return multi-line for hours+minutes
        delay_lines = delay_yaml.splitlines()
        if len(delay_lines) == 1:
            return (
                f"{pad}- alias: \"{stmt_id}\"\n"
                f"{pad}  delay:\n"
                f"{pad}    {delay_lines[0]}"
            )
        else:
            # hours + minutes case
            return (
                f"{pad}- alias: \"{stmt_id}\"\n"
                f"{pad}  delay:\n"
                f"{pad}    {delay_lines[0]}\n"
                f"{pad}    {delay_lines[1].strip()}"
            )

    else:
        raise CompilerError(
            f"Statement {stmt_id} (wait) has neither 'until' nor 'duration_seconds'."
        )


def _compile_wait_for_state(stmt: dict, device_map: dict, piston: dict, indent: int) -> str:
    """COMPILER_SPEC Section 8.3"""
    stmt_id = stmt["id"]
    role = stmt.get("target_role")
    entity_id = _resolve_role(role, device_map, stmt_id)
    value = stmt.get("compiled_value") or stmt.get("value", "")
    timeout = stmt.get("timeout_seconds", 60)
    pad = " " * indent

    return (
        f"{pad}- alias: \"{stmt_id}\"\n"
        f"{pad}  wait_for_trigger:\n"
        f"{pad}    - trigger: state\n"
        f"{pad}      entity_id: {entity_id}\n"
        f"{pad}      to: \"{value}\"\n"
        f"{pad}  timeout:\n"
        f"{pad}    seconds: {timeout}\n"
        f"{pad}  continue_on_timeout: true"
    )


def _compile_if_block(stmt: dict, device_map: dict, piston: dict, indent: int) -> str:
    """COMPILER_SPEC Section 8.4"""
    stmt_id = stmt["id"]
    condition = stmt.get("condition")
    true_branch = stmt.get("true_branch", [])
    false_branch = stmt.get("false_branch", [])
    pad = " " * indent
    inner = indent + 4

    cond_yaml = compile_condition(condition, device_map, indent + 4)

    lines = [
        f"{pad}- alias: \"{stmt_id}\"",
        f"{pad}  if:",
        cond_yaml,
        f"{pad}  then:",
    ]

    if true_branch:
        lines.append(compile_statements(true_branch, device_map, piston, inner))
    else:
        lines.append(f"{pad}    []")

    if false_branch:
        lines.append(f"{pad}  else:")
        lines.append(compile_statements(false_branch, device_map, piston, inner))

    return "\n".join(lines)


def _compile_repeat_block(stmt: dict, device_map: dict, piston: dict, indent: int) -> str:
    """COMPILER_SPEC Section 8.6 — repeat/do/until"""
    stmt_id = stmt["id"]
    condition = stmt.get("condition")
    body = stmt.get("body", [])
    pad = " " * indent
    inner = indent + 4
    seq_inner = indent + 6

    cond_yaml = compile_condition(condition, device_map, inner + 2)

    lines = [
        f"{pad}- alias: \"{stmt_id}\"",
        f"{pad}  repeat:",
        f"{pad}    sequence:",
        compile_statements(body, device_map, piston, seq_inner),
        f"{pad}    until:",
        cond_yaml,
    ]
    return "\n".join(lines)


def _compile_for_each_block(stmt: dict, device_map: dict, piston: dict, indent: int) -> str:
    """
    COMPILER_SPEC Section 8.7
    Devices global resolves to a literal list of entity IDs at compile time.
    """
    stmt_id = stmt["id"]
    collection_role = stmt.get("collection_role")
    body = stmt.get("body", [])
    pad = " " * indent
    seq_inner = indent + 6

    # Resolve collection to entity ID list
    entity_list = _resolve_devices_collection(collection_role, device_map, stmt_id)

    lines = [
        f"{pad}- alias: \"{stmt_id}\"",
        f"{pad}  repeat:",
        f"{pad}    for_each:",
    ]
    for entity_id in entity_list:
        lines.append(f"{pad}      - {entity_id}")

    lines.append(f"{pad}    sequence:")
    lines.append(compile_statements(body, device_map, piston, seq_inner))

    return "\n".join(lines)


def _compile_while_block(stmt: dict, device_map: dict, piston: dict, indent: int) -> str:
    """COMPILER_SPEC Section 8.8"""
    stmt_id = stmt["id"]
    condition = stmt.get("condition")
    body = stmt.get("body", [])
    pad = " " * indent
    inner = indent + 4
    seq_inner = indent + 6

    cond_yaml = compile_condition(condition, device_map, inner + 2)

    lines = [
        f"{pad}- alias: \"{stmt_id}\"",
        f"{pad}  repeat:",
        f"{pad}    while:",
        cond_yaml,
        f"{pad}    sequence:",
        compile_statements(body, device_map, piston, seq_inner),
    ]
    return "\n".join(lines)


def _compile_for_loop(stmt: dict, device_map: dict, piston: dict, indent: int) -> str:
    """
    COMPILER_SPEC Section 8.9
    Simple counted loop using HA repeat: count:
    Complex from/step → emits variables: block inside sequence.
    """
    stmt_id = stmt["id"]
    from_val = stmt.get("from", 1)
    to_expr = stmt.get("to_expression", "10")
    step = stmt.get("step", 1)
    body = stmt.get("body", [])
    pad = " " * indent
    seq_inner = indent + 6

    # HA repeat.index is 1-based, repeat.index0 is 0-based
    simple = (from_val in (0, 1)) and (step == 1)

    lines = [
        f"{pad}- alias: \"{stmt_id}\"",
        f"{pad}  repeat:",
        f"{pad}    count: {to_expr}",
        f"{pad}    sequence:",
    ]

    if not simple:
        # Emit a variables: block at top of sequence to compute the correct index
        var_name = stmt.get("variable_name", "$i").lstrip("$")
        lines.append(
            f"{pad}      - variables:\n"
            f"{pad}          {var_name}: \"{{{{ {from_val} + (repeat.index0 * {step}) }}}}\""
        )

    lines.append(compile_statements(body, device_map, piston, seq_inner))

    return "\n".join(lines)


def _compile_set_variable(stmt: dict, device_map: dict, piston: dict, indent: int) -> str:
    """
    COMPILER_SPEC Section 8.9 (set_variable)
    Emits HA variables: action. Warns on cross-scope usage (detected externally by scan).
    Global variable writes compile to service calls, not variables: assignments.
    """
    stmt_id = stmt["id"]
    var_name = stmt.get("variable_name", "$unknown")
    value_expr = stmt.get("value_expression", "")
    pad = " " * indent

    if var_name.startswith("@"):
        # Global variable write — compile as service call
        return _compile_global_write(stmt_id, var_name, value_expr, pad)

    # Local variable
    clean_name = var_name.lstrip("$")
    return (
        f"{pad}- alias: \"{stmt_id}\"\n"
        f"{pad}  variables:\n"
        f"{pad}    {clean_name}: {value_expr}"
    )


def _compile_global_write(stmt_id: str, var_name: str, value_expr: str, pad: str) -> str:
    """
    Global variable writes compile to HA helper service calls.
    COMPILER_SPEC Section 10.
    The global var metadata (type, helper entity id) must be in value_expr or stmt.
    For now we emit a placeholder — the backend resolves global IDs before compiling.
    """
    # The value_expr for globals is expected to be pre-resolved by the backend
    # into the format: {"helper_type": "input_text", "helper_id": "pistoncore_abc123", "value": "..."}
    # This path is a stub — full global write compilation requires global registry lookup.
    return (
        f"{pad}- alias: \"{stmt_id}\"\n"
        f"{pad}  # GLOBAL WRITE: {var_name} → {value_expr}\n"
        f"{pad}  # Backend must resolve global helper entity before compile"
    )


def _compile_log_message(stmt: dict, device_map: dict, piston: dict, indent: int) -> str:
    """COMPILER_SPEC Section 8.12"""
    stmt_id = stmt["id"]
    piston_id = piston.get("id", "unknown")
    level = stmt.get("level", "info")
    message = stmt.get("message", "")
    pad = " " * indent

    return (
        f"{pad}- alias: \"{stmt_id}\"\n"
        f"{pad}  event: PISTONCORE_LOG\n"
        f"{pad}  event_data:\n"
        f"{pad}    piston_id: \"{piston_id}\"\n"
        f"{pad}    stmt_id: \"{stmt_id}\"\n"
        f"{pad}    level: \"{level}\"\n"
        f"{pad}    message: \"{message}\""
    )


def _compile_call_piston(stmt: dict, device_map: dict, piston: dict, indent: int) -> str:
    """COMPILER_SPEC Section 8.13"""
    stmt_id = stmt["id"]
    target_slug = stmt.get("_resolved_target_slug")  # backend resolves before compile
    wait_for_completion = stmt.get("wait_for_completion", False)
    pad = " " * indent

    if not target_slug:
        target_id = stmt.get("target_piston_id", "unknown")
        raise CompilerError(
            f"Statement {stmt_id} calls piston '{target_id}' but the target slug "
            f"was not resolved. The backend must resolve target_piston_id → slug "
            f"before compiling."
        )

    if wait_for_completion:
        # Direct script call — calling script waits for completion
        return (
            f"{pad}- alias: \"{stmt_id}\"\n"
            f"{pad}  action: script.pistoncore_{target_slug}"
        )
    else:
        # Fire and forget
        return (
            f"{pad}- alias: \"{stmt_id}\"\n"
            f"{pad}  action: script.turn_on\n"
            f"{pad}  target:\n"
            f"{pad}    entity_id: script.pistoncore_{target_slug}"
        )


def _compile_control_piston(stmt: dict, device_map: dict, piston: dict, indent: int) -> str:
    """COMPILER_SPEC Section 8.14"""
    stmt_id = stmt["id"]
    target_type = stmt.get("target_type", "piston")
    target_id = stmt.get("target_id", "")
    action = stmt.get("action", "trigger")
    target_slug = stmt.get("_resolved_target_slug", "")
    pad = " " * indent

    if target_type == "piston":
        entity_id = f"script.pistoncore_{target_slug}"
        service_map = {
            "trigger": "script.turn_on",
            "start":   "script.turn_on",
            "stop":    "script.turn_off",
            "enable":  "script.turn_on",
            "disable": "script.turn_off",
        }
    else:
        # ha_automation
        entity_id = target_id  # passed in directly by backend
        service_map = {
            "trigger": "automation.trigger",
            "start":   "automation.turn_on",
            "stop":    "automation.turn_off",
            "enable":  "automation.turn_on",
            "disable": "automation.turn_off",
        }

    service = service_map.get(action)
    if not service:
        raise CompilerError(
            f"Statement {stmt_id} (control_piston) has unknown action: '{action}'."
        )

    return (
        f"{pad}- alias: \"{stmt_id}\"\n"
        f"{pad}  action: {service}\n"
        f"{pad}  target:\n"
        f"{pad}    entity_id: {entity_id}"
    )


def _compile_stop(stmt: dict, device_map: dict, piston: dict, indent: int) -> str:
    """COMPILER_SPEC Section 8.15"""
    stmt_id = stmt["id"]
    pad = " " * indent
    return (
        f"{pad}- alias: \"{stmt_id}\"\n"
        f"{pad}  stop: \"Stopped by piston logic\""
    )


def _compile_switch_block(stmt: dict, device_map: dict, piston: dict, indent: int) -> str:
    """COMPILER_SPEC Section 8.10"""
    stmt_id = stmt["id"]
    subject = stmt.get("subject", {})
    cases = stmt.get("cases", [])
    default_body = stmt.get("default_body", [])
    pad = " " * indent
    inner = indent + 4
    seq_inner = indent + 8

    # Resolve entity from subject
    role = subject.get("role")
    entity_id = _resolve_role(role, device_map, stmt_id)
    attribute = subject.get("attribute")
    capability = subject.get("capability")

    lines = [
        f"{pad}- alias: \"{stmt_id}\"",
        f"{pad}  choose:",
    ]

    for case in cases:
        value = case.get("value", "")
        body = case.get("body", [])

        lines.append(f"{pad}    - conditions:")
        if attribute:
            lines.append(
                f"{pad}        - condition: state\n"
                f"{pad}          entity_id: {entity_id}\n"
                f"{pad}          attribute: {attribute}\n"
                f"{pad}          state: \"{value}\""
            )
        else:
            lines.append(
                f"{pad}        - condition: state\n"
                f"{pad}          entity_id: {entity_id}\n"
                f"{pad}          state: \"{value}\""
            )
        lines.append(f"{pad}      sequence:")
        lines.append(compile_statements(body, device_map, piston, seq_inner))

    if default_body:
        lines.append(f"{pad}  default:")
        lines.append(compile_statements(default_body, device_map, piston, inner))

    return "\n".join(lines)


def _compile_do_block(stmt: dict, device_map: dict, piston: dict, indent: int) -> str:
    """
    COMPILER_SPEC Section 8.11
    HA has no native 'block' concept — emit a comment label and compile body inline.
    """
    stmt_id = stmt["id"]
    label = stmt.get("label", "")
    body = stmt.get("body", [])
    pad = " " * indent

    comment = f"{pad}# do_block: {label} ({stmt_id})"
    body_yaml = compile_statements(body, device_map, piston, indent)
    return f"{comment}\n{body_yaml}"


def _compile_only_when(stmt: dict, device_map: dict, piston: dict, indent: int) -> str:
    """
    COMPILER_SPEC Section 8.16
    only_when restrictions compile to condition: action(s) before the main statement.
    """
    restrictions = stmt.get("only_when", [])
    if not restrictions:
        return ""

    pad = " " * indent
    lines = []
    for i, cond in enumerate(restrictions):
        alias = f"{stmt['id']}_restriction_{i+1}"
        cond_yaml = compile_condition(cond, device_map, indent)
        # Wrap with alias
        lines.append(f"{pad}- alias: \"{alias}\"")
        # Strip the leading '- ' from compiled condition and re-add under alias
        cond_inner = cond_yaml.lstrip().lstrip("- ")
        lines.append(f"{pad}  {cond_inner}")

    return "\n".join(lines) + "\n"


def _pyscript_only_error(stmt: dict, device_map: dict, piston: dict, indent: int) -> str:
    raise CompilerError(
        f"Statement type '{stmt.get('type')}' requires PyScript compilation. "
        f"This piston should have been flagged as PyScript-only before reaching the compiler."
    )


# --- Helpers ---

def _resolve_role(role: str, device_map: dict, stmt_id: str) -> str:
    if role not in device_map:
        raise CompilerError(
            f"Statement {stmt_id} references role '{role}' but no device is mapped to that role."
        )
    return device_map[role]


def _resolve_devices_collection(role: str, device_map: dict, stmt_id: str) -> list:
    """
    Resolve a collection role to a list of entity IDs for for_each.
    The device_map stores Devices variables as lists under their role key.
    COMPILER_SPEC Section 8.7.
    """
    value = device_map.get(role)
    if value is None:
        raise CompilerError(
            f"Statement {stmt_id} (for_each) references collection role '{role}' "
            f"but no device collection is mapped to that role."
        )
    if isinstance(value, list):
        return value
    # Single entity treated as a one-item collection
    return [value]
