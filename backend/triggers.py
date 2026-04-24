"""
PistonCore Trigger Compiler
Compiles piston trigger objects to HA YAML strings.
COMPILER_SPEC Sections 6.3 and 9.
"""

from .exceptions import CompilerError
from .utils import format_offset


def compile_trigger(trigger: dict, device_map: dict) -> str:
    """
    Compile a single trigger object to a YAML string (no leading indent).
    The caller is responsible for indentation when assembling the list.
    Returns a YAML block string starting with '- trigger: ...'
    """
    t = trigger.get("type")

    if t == "sun":
        return _compile_sun(trigger)
    elif t == "state":
        return _compile_state(trigger, device_map)
    elif t == "time":
        return _compile_time(trigger)
    elif t == "time_pattern":
        return _compile_time_pattern(trigger)
    elif t == "numeric_state":
        return _compile_numeric_state(trigger, device_map)
    elif t == "event":
        return _compile_event(trigger)
    elif t == "webhook":
        return _compile_webhook(trigger)
    elif t == "manual_only":
        return None  # No trigger emitted — automation gets triggers: []
    elif t == "called_by_piston":
        return None  # No automation trigger — automation file omitted
    elif t == "device_event":
        return _compile_device_event(trigger, device_map)
    else:
        raise CompilerError(f"Unknown trigger type: '{t}'")


def compile_triggers(triggers: list, device_map: dict) -> tuple[str, bool]:
    """
    Compile all triggers for a piston.
    Returns (triggers_yaml, omit_automation_file).

    omit_automation_file is True when trigger type is 'called_by_piston'.
    triggers_yaml is '[]' when trigger type is 'manual_only'.
    """
    if not triggers:
        raise CompilerError("Piston has no triggers defined.")

    # called_by_piston means no automation file at all
    if any(t.get("type") == "called_by_piston" for t in triggers):
        return "", True

    lines = []
    for trigger in triggers:
        result = compile_trigger(trigger, device_map)
        if result is not None:
            lines.append(result)

    if not lines:
        # manual_only — all triggers returned None
        return "[]", False

    # Indent each block 4 spaces and join
    indented = []
    for block in lines:
        indented_block = "\n".join("    " + line for line in block.splitlines())
        indented.append(indented_block)

    return "\n".join(indented), False


# --- Individual trigger compilers ---

def _compile_sun(trigger: dict) -> str:
    event = trigger.get("event", "sunset")
    offset_minutes = trigger.get("offset_minutes", 0)
    offset_str = format_offset(offset_minutes)
    return (
        f"- trigger: sun\n"
        f"  event: {event}\n"
        f"  offset: \"{offset_str}\""
    )


def _compile_state(trigger: dict, device_map: dict) -> str:
    role = trigger.get("target_role")
    entity_id = _resolve_entity(role, device_map)

    lines = [
        f"- trigger: state",
        f"  entity_id: {entity_id}",
    ]

    to = trigger.get("to")
    if to is not None:
        lines.append(f"  to: \"{to}\"")

    from_state = trigger.get("from")
    if from_state is not None:
        lines.append(f"  from: \"{from_state}\"")

    for_seconds = trigger.get("for_seconds")
    if for_seconds is not None:
        lines.append(f"  for:")
        lines.append(f"    seconds: {for_seconds}")

    return "\n".join(lines)


def _compile_time(trigger: dict) -> str:
    at = trigger.get("at", "00:00:00")
    return (
        f"- trigger: time\n"
        f"  at: \"{at}\""
    )


def _compile_time_pattern(trigger: dict) -> str:
    lines = ["- trigger: time_pattern"]
    for key in ("hours", "minutes", "seconds"):
        val = trigger.get(key)
        if val is not None:
            lines.append(f"  {key}: \"{val}\"")
    return "\n".join(lines)


def _compile_numeric_state(trigger: dict, device_map: dict) -> str:
    role = trigger.get("target_role")
    entity_id = _resolve_entity(role, device_map)

    lines = [
        f"- trigger: numeric_state",
        f"  entity_id: {entity_id}",
    ]

    above = trigger.get("above")
    if above is not None:
        lines.append(f"  above: {above}")

    below = trigger.get("below")
    if below is not None:
        lines.append(f"  below: {below}")

    return "\n".join(lines)


def _compile_event(trigger: dict) -> str:
    event_type = trigger.get("event_type", "")
    lines = [
        f"- trigger: event",
        f"  event_type: {event_type}",
    ]
    event_data = trigger.get("event_data")
    if event_data:
        lines.append("  event_data:")
        for k, v in event_data.items():
            lines.append(f"    {k}: {v}")
    return "\n".join(lines)


def _compile_webhook(trigger: dict) -> str:
    webhook_id = trigger.get("webhook_id", "")
    return (
        f"- trigger: webhook\n"
        f"  webhook_id: {webhook_id}\n"
        f"  allowed_methods:\n"
        f"    - GET\n"
        f"    - POST"
    )


def _compile_device_event(trigger: dict, device_map: dict) -> str:
    """
    Device event trigger (button/momentary).
    Requires device_id from HA device registry — backend responsibility.
    COMPILER_SPEC Section 9 / Open Item 3.
    """
    role = trigger.get("target_role")
    device_id = device_map.get(f"__device_id__{role}")
    if not device_id:
        raise CompilerError(
            f"Trigger for role '{role}' requires a device ID from the HA device registry, "
            f"but none was provided. This is a backend resolution error."
        )
    event_type = trigger.get("event_type", "pressed")
    domain = trigger.get("domain", "")
    return (
        f"- trigger: device\n"
        f"  device_id: {device_id}\n"
        f"  domain: {domain}\n"
        f"  type: {event_type}"
    )


# --- Helper ---

def _resolve_entity(role: str, device_map: dict) -> str:
    if role not in device_map:
        raise CompilerError(
            f"Trigger references role '{role}' but no device is mapped to that role."
        )
    return device_map[role]
