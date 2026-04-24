"""
PistonCore Condition Compiler
Compiles piston condition objects to HA YAML strings.
COMPILER_SPEC Section 8.5.
"""

from .exceptions import CompilerError


def compile_condition(condition: dict, device_map: dict, indent: int = 0) -> str:
    """
    Compile a single condition object to an indented YAML string.
    Used in both automation-level conditions and script-body if/when blocks.
    """
    ctype = condition.get("type")

    if ctype == "state":
        return _compile_state_condition(condition, device_map, indent)
    elif ctype == "numeric_state":
        return _compile_numeric_condition(condition, device_map, indent)
    elif ctype == "template":
        return _compile_template_condition(condition, indent)
    elif ctype == "time":
        return _compile_time_condition(condition, indent)
    elif ctype == "and":
        return _compile_group_condition("and", condition, device_map, indent)
    elif ctype == "or":
        return _compile_group_condition("or", condition, device_map, indent)
    else:
        raise CompilerError(f"Unknown condition type: '{ctype}'")


def compile_conditions(conditions: list, device_map: dict, indent: int = 4) -> str:
    """
    Compile a list of conditions (top-level automation conditions).
    Returns '[]' if empty, otherwise indented YAML list.
    """
    if not conditions:
        return "[]"

    parts = []
    for cond in conditions:
        parts.append(compile_condition(cond, device_map, indent))

    return "\n".join(parts)


# --- Individual condition compilers ---

def _compile_state_condition(condition: dict, device_map: dict, indent: int) -> str:
    subject = condition.get("subject", {})
    entity_id = _resolve_subject_entity(subject, device_map)

    # Binary sensors: always use compiled_value ("on"/"off"), never display_value
    # Non-binary: compiled_value == display_value (HA returns the real named state)
    value = condition.get("compiled_value") or condition.get("value", "")

    pad = " " * indent
    lines = [
        f"{pad}- condition: state",
        f"{pad}  entity_id: {entity_id}",
    ]

    attribute = subject.get("attribute")
    if attribute:
        lines.append(f"{pad}  attribute: {attribute}")

    lines.append(f"{pad}  state: \"{value}\"")

    return "\n".join(lines)


def _compile_numeric_condition(condition: dict, device_map: dict, indent: int) -> str:
    subject = condition.get("subject", {})
    entity_id = _resolve_subject_entity(subject, device_map)
    operator = condition.get("operator", "")
    value = condition.get("value")

    pad = " " * indent
    lines = [
        f"{pad}- condition: numeric_state",
        f"{pad}  entity_id: {entity_id}",
    ]

    if "greater" in operator or "above" in operator:
        lines.append(f"{pad}  above: {value}")
    elif "less" in operator or "below" in operator:
        lines.append(f"{pad}  below: {value}")
    else:
        raise CompilerError(
            f"Unsupported numeric condition operator: '{operator}'. "
            f"Expected 'is greater than' or 'is less than'."
        )

    return "\n".join(lines)


def _compile_template_condition(condition: dict, indent: int) -> str:
    subject = condition.get("subject", {})
    var_name = subject.get("name", "$unknown").lstrip("$")
    operator = condition.get("operator", "is")
    value = condition.get("value")

    # Build a simple Jinja2 expression
    op_map = {
        "is": "==",
        "is not": "!=",
        "is greater than": ">",
        "is less than": "<",
        "is greater than or equal to": ">=",
        "is less than or equal to": "<=",
    }
    op = op_map.get(operator, "==")

    # String vs numeric quoting
    if isinstance(value, str):
        expr = f"{{{{ {var_name} {op} '{value}' }}}}"
    else:
        expr = f"{{{{ {var_name} {op} {value} }}}}"

    pad = " " * indent
    return (
        f"{pad}- condition: template\n"
        f"{pad}  value_template: \"{expr}\""
    )


def _compile_time_condition(condition: dict, indent: int) -> str:
    operator = condition.get("operator", "")
    value = condition.get("value", "")
    weekday = condition.get("weekday")

    pad = " " * indent
    lines = [f"{pad}- condition: time"]

    if "after" in operator:
        lines.append(f"{pad}  after: \"{value}\"")
    elif "before" in operator:
        lines.append(f"{pad}  before: \"{value}\"")

    if weekday:
        lines.append(f"{pad}  weekday:")
        for day in weekday:
            lines.append(f"{pad}    - {day}")

    return "\n".join(lines)


def _compile_group_condition(group_type: str, condition: dict, device_map: dict, indent: int) -> str:
    subconditions = condition.get("conditions", [])
    pad = " " * indent
    inner_indent = indent + 4

    lines = [
        f"{pad}- condition: {group_type}",
        f"{pad}  conditions:",
    ]

    for sub in subconditions:
        lines.append(compile_condition(sub, device_map, inner_indent))

    return "\n".join(lines)


# --- Helper ---

def _resolve_subject_entity(subject: dict, device_map: dict) -> str:
    subject_type = subject.get("type")

    if subject_type == "device":
        role = subject.get("role")
        if role not in device_map:
            raise CompilerError(
                f"Condition references role '{role}' but no device is mapped to that role."
            )
        return device_map[role]
    elif subject_type == "variable":
        # Template conditions handle variables differently — this path is only
        # reached if a non-template condition incorrectly references a variable.
        raise CompilerError(
            f"Variable '{subject.get('name')}' cannot be used in a state or numeric condition. "
            f"Use a template condition instead."
        )
    else:
        raise CompilerError(f"Unknown condition subject type: '{subject_type}'")
