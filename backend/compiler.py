# pistoncore/backend/compiler.py
#
# Matches COMPILER_SPEC.md v0.2 exactly.
# # Started from Grok's skeleton — fixed and completed by Claude (Sessions 8-9).
# Session 10: five bug fixes — hash, globals writes, _scan_globals, only_when, for_loop substitution.
#
# This file is designed to be easy for anyone + Claude to maintain.
# Each method references the COMPILER_SPEC section it implements.
# Add new statement types by adding an elif in _compile_sequence()
# and a corresponding _compile_<type>() method below.
#
# Usage:
#   compiler = Compiler(template_dir="path/to/native-script/")
#   auto_yaml, script_yaml, warnings, errors = compiler.compile_piston(
#       piston, device_map, globals_store, app_version="0.9"
#   )

import re
import hashlib
from typing import Any
from jinja2 import Environment, FileSystemLoader, select_autoescape


# ---------------------------------------------------------------------------
# Compiler result types
# ---------------------------------------------------------------------------

class CompilerError(Exception):
    """
    Fatal error — compilation cannot continue.
    Message must be plain English. Never show a stack trace to the user.
    COMPILER_SPEC Section 14.
    """
    pass


class CompilerWarning:
    """
    Non-fatal — compilation continues but user should be informed.
    Shown in the PistonCore validation banner after save.
    COMPILER_SPEC Section 14.
    """
    def __init__(self, message: str):
        self.message = message

    def __str__(self):
        return self.message


# ---------------------------------------------------------------------------
# Compiler class
# ---------------------------------------------------------------------------

class Compiler:

    def __init__(
        self,
        template_dir: str = "/pistoncore-customize/compiler-templates/native-script/",
    ):
        self.env = Environment(
            loader=FileSystemLoader(template_dir),
            autoescape=select_autoescape(),
            trim_blocks=True,
            lstrip_blocks=True,
        )

    # -----------------------------------------------------------------------
    # Section 4 — Slug generation
    # -----------------------------------------------------------------------

    def slugify(self, name: str) -> str:
        """
        Convert a piston name to a safe slug for filenames and entity IDs.
        COMPILER_SPEC Section 4.
        """
        s = name.lower()
        s = s.replace(" ", "_").replace("-", "_")
        s = re.sub(r"[^a-z0-9_]", "", s)
        s = s.strip("_")
        s = s[:50]
        return s

    # -----------------------------------------------------------------------
    # Section 5 — Main entry point
    # -----------------------------------------------------------------------

    def compile_piston(
        self,
        piston: dict,
        device_map: dict,
        globals_store: dict,
        app_version: str,
        known_piston_slugs: dict | None = None,
    ) -> tuple[str, str, list, list]:
        """
        Main entry point. Returns (automation_yaml, script_yaml, warnings, errors).

        piston             — the full piston JSON dict
        device_map         — maps role names to HA entity IDs or lists of IDs
                             e.g. {"driveway_light": "light.driveway_main"}
        globals_store      — maps global variable IDs to their definitions
                             e.g. {"uuid_abc": {"display_name": "Away Mode", "type": "Text"}}
        app_version        — PistonCore version string for the file header
        known_piston_slugs — maps piston IDs to their slugs, for call_piston compilation

        COMPILER_SPEC Section 5.
        """
        warnings: list[CompilerWarning] = []
        errors: list[str] = []

        try:
            slug = self.slugify(piston["name"])

            # Slug collision check — COMPILER_SPEC Section 4
            if known_piston_slugs:
                for pid, pslug in known_piston_slugs.items():
                    if pslug == slug and pid != piston["id"]:
                        slug = f"{slug}_{piston['id'][:4]}"[:50]
                        warnings.append(CompilerWarning(
                            f"Piston name '{piston['name']}' produces the same slug as another "
                            f"piston. Appended piston ID prefix to disambiguate: '{slug}'."
                        ))
                        break

            globals_used = self._scan_globals(piston)

            # called_by_piston trigger — no automation file generated
            omit_automation = any(
                t.get("type") == "called_by_piston"
                for t in piston.get("triggers", [])
            )

            compiled_triggers = self._compile_triggers(
                piston.get("triggers", []), device_map
            )
            compiled_conditions = self._compile_conditions(
                piston.get("conditions", []), device_map, warnings
            )
            compiled_sequence = self._compile_sequence(
                piston.get("actions", []),
                piston,
                device_map,
                globals_store,
                known_piston_slugs or {},
                warnings,
            )

            if omit_automation:
                automation_yaml = ""
            else:
                automation_yaml = self._render_automation(
                    piston, slug, compiled_triggers, compiled_conditions, app_version
                )

            script_yaml = self._render_script(
                piston, slug, compiled_sequence, globals_used, app_version
            )

            return automation_yaml, script_yaml, warnings, errors

        except CompilerError as e:
            errors.append(str(e))
            return "", "", warnings, errors

    # -----------------------------------------------------------------------
    # Section 5 — scan_globals
    # -----------------------------------------------------------------------

    def _scan_globals(self, piston: dict) -> list[str]:
        """
        Walk the entire piston JSON and collect every global variable name
        referenced anywhere (triggers, conditions, actions).
        Global variables appear in two ways:
          1. As a dict value for known keys like "variable_name" or "target_role" → "@name"
          2. Embedded in expression strings → any substring matching @word_chars
        Returns a sorted list of names, or ["(none)"] if none found.
        COMPILER_SPEC Section 5.
        """
        found = set()
        # Matches @identifier anywhere in a string (e.g. in value_expression, conditions)
        _global_ref_re = re.compile(r"@([A-Za-z_]\w*)")

        def walk(obj: Any):
            if isinstance(obj, dict):
                # Check known structured keys explicitly
                role = obj.get("target_role", "")
                if isinstance(role, str) and role.startswith("@"):
                    found.add(role[1:])
                var = obj.get("variable_name", "")
                if isinstance(var, str) and var.startswith("@"):
                    found.add(var[1:])
                # Scan all string values for embedded @references
                for v in obj.values():
                    if isinstance(v, str):
                        for m in _global_ref_re.finditer(v):
                            found.add(m.group(1))
                    else:
                        walk(v)
            elif isinstance(obj, list):
                for item in obj:
                    walk(item)

        walk(piston)
        return sorted(found) if found else ["(none)"]

    # -----------------------------------------------------------------------
    # Section 6.3 — Trigger compilation
    # -----------------------------------------------------------------------

    def _compile_triggers(self, triggers: list, device_map: dict) -> str:
        """
        Compile each trigger in the piston.triggers array.
        Returns pre-indented YAML string (4 spaces).
        COMPILER_SPEC Section 6.3.
        """
        if not triggers:
            return "    []"

        # manual_only → empty trigger list
        if any(t.get("type") == "manual_only" for t in triggers):
            return "    []"

        # called_by_piston → automation omitted entirely; return empty
        if any(t.get("type") == "called_by_piston" for t in triggers):
            return "    []"

        lines = []
        for t in triggers:
            ttype = t.get("type")

            if ttype == "sun":
                tmpl = self.env.get_template("snippets/trigger_sun.yaml.j2")
                lines.append(tmpl.render(
                    event=t["event"],
                    offset=self._format_offset(t.get("offset_minutes", 0)),
                ))

            elif ttype == "state":
                entity_id = device_map.get(t.get("target_role", ""))
                if not entity_id:
                    raise CompilerError(
                        f"Trigger references role '{t.get('target_role')}' "
                        f"but no device is mapped to that role."
                    )
                tmpl = self.env.get_template("snippets/trigger_state.yaml.j2")
                lines.append(tmpl.render(
                    entity_id=entity_id,
                    to=t.get("to"),
                    from_state=t.get("from"),
                    for_seconds=t.get("for_seconds"),
                ))

            elif ttype == "time":
                tmpl = self.env.get_template("snippets/trigger_time.yaml.j2")
                lines.append(tmpl.render(at_time=t["at"]))

            elif ttype == "time_pattern":
                tmpl = self.env.get_template("snippets/trigger_time_pattern.yaml.j2")
                lines.append(tmpl.render(
                    minutes=t.get("minutes"),
                    hours=t.get("hours"),
                ))

            elif ttype == "numeric_state":
                entity_id = device_map.get(t.get("target_role", ""))
                if not entity_id:
                    raise CompilerError(
                        f"Trigger references role '{t.get('target_role')}' "
                        f"but no device is mapped to that role."
                    )
                tmpl = self.env.get_template("snippets/trigger_numeric.yaml.j2")
                lines.append(tmpl.render(
                    entity_id=entity_id,
                    above=t.get("above"),
                    below=t.get("below"),
                ))

            elif ttype == "event":
                tmpl = self.env.get_template("snippets/trigger_event.yaml.j2")
                lines.append(tmpl.render(
                    event_type=t["event_type"],
                    event_data=t.get("event_data", {}),
                ))

            elif ttype == "webhook":
                tmpl = self.env.get_template("snippets/trigger_webhook.yaml.j2")
                lines.append(tmpl.render(webhook_id=t["webhook_id"]))

            else:
                raise CompilerError(
                    f"Unknown trigger type: '{ttype}'. "
                    f"This trigger type may not be implemented yet."
                )

        indented = "\n".join("    " + line for line in "\n".join(lines).splitlines())
        return indented

    def _format_offset(self, minutes: int) -> str:
        """COMPILER_SPEC Section 6.3 — sun trigger offset formatting."""
        if minutes == 0:
            return "00:00:00"
        sign = "+" if minutes > 0 else "-"
        m = abs(minutes)
        h, rem = divmod(m, 60)
        return f"{sign}{h:02d}:{rem:02d}:00"

    # -----------------------------------------------------------------------
    # Section 6.4 + 8.5 — Condition compilation
    # -----------------------------------------------------------------------

    def _compile_conditions(
        self, conditions: list, device_map: dict, warnings: list
    ) -> str:
        """
        Compile top-level piston conditions.
        Returns "[]" if no conditions.
        COMPILER_SPEC Section 6.4 and 8.5.
        """
        if not conditions:
            return "[]"

        lines = []
        for cond in conditions:
            lines.append(self._compile_single_condition(cond, device_map))
        return "\n".join(lines)

    def _compile_single_condition(self, cond: dict, device_map: dict) -> str:
        """
        Compile one condition object to a HA condition YAML block.
        COMPILER_SPEC Section 8.5.
        """
        ctype = cond.get("type")

        # AND / OR groups
        if ctype == "and":
            lines = ["- condition: and", "  conditions:"]
            for sub in cond.get("conditions", []):
                lines.append(f"    {self._compile_single_condition(sub, device_map)}")
            return "\n".join(lines)

        if ctype == "or":
            lines = ["- condition: or", "  conditions:"]
            for sub in cond.get("conditions", []):
                lines.append(f"    {self._compile_single_condition(sub, device_map)}")
            return "\n".join(lines)

        subject = cond.get("subject", {})
        subject_type = subject.get("type")
        operator = cond.get("operator", "is")
        compiled_value = cond.get("compiled_value", cond.get("value", ""))

        if subject_type == "device":
            entity_id = device_map.get(subject.get("role", ""))
            if not entity_id:
                raise CompilerError(
                    f"Condition references role '{subject.get('role')}' "
                    f"but no device is mapped to that role."
                )
            attribute_type = subject.get("attribute_type", "")

            if attribute_type == "numeric" or "greater" in operator or "less" in operator:
                above = compiled_value if ("greater" in operator or "above" in operator) else None
                below = compiled_value if ("less" in operator or "below" in operator) else None
                tmpl = self.env.get_template("snippets/condition_numeric.yaml.j2")
                return tmpl.render(entity_id=entity_id, above=above, below=below)
            else:
                # State condition (binary or named state)
                # Always use compiled_value — never display_value (COMPILER_SPEC Section 11)
                tmpl = self.env.get_template("snippets/condition_state.yaml.j2")
                return tmpl.render(
                    entity_id=entity_id,
                    state=compiled_value,
                    attribute=subject.get("attribute"),
                )

        elif subject_type == "time":
            tmpl = self.env.get_template("snippets/condition_time.yaml.j2")
            return tmpl.render(
                after=cond.get("after"),
                before=cond.get("before"),
                weekday=cond.get("weekday"),
            )

        elif subject_type == "variable":
            tmpl = self.env.get_template("snippets/condition_template.yaml.j2")
            var_name = subject.get("name", "").lstrip("$")
            op_map = {
                "is": "==", "is not": "!=",
                "is greater than": ">", "is less than": "<",
                "is greater than or equal to": ">=", "is less than or equal to": "<=",
            }
            op = op_map.get(operator, "==")
            if isinstance(compiled_value, str):
                template_expr = f"{{{{ {var_name} {op} '{compiled_value}' }}}}"
            else:
                template_expr = f"{{{{ {var_name} {op} {compiled_value} }}}}"
            return tmpl.render(template_expression=template_expr)

        raise CompilerError(
            f"Cannot compile condition — unknown subject type '{subject_type}'."
        )

    # -----------------------------------------------------------------------
    # Section 7.2 — Statement dispatcher
    # -----------------------------------------------------------------------

    def _compile_sequence(
        self,
        actions: list,
        piston: dict,
        device_map: dict,
        globals_store: dict,
        known_piston_slugs: dict,
        warnings: list,
        indent: int = 4,
        _append_completion_event: bool = True,
    ) -> str:
        """
        Main statement dispatcher. Walks the actions array and compiles
        each statement. Appends the PISTONCORE_RUN_COMPLETE event at end
        of the top-level sequence only.
        COMPILER_SPEC Section 7.2.
        """
        lines = []
        for stmt in actions:
            stmt_type = stmt.get("type")

            # only_when — COMPILER_SPEC Section 8.16
            # If the statement has an only_when condition, emit a HA condition: action
            # immediately before the statement itself. The statement is skipped at
            # runtime if the condition is not met.
            if "only_when" in stmt and stmt["only_when"]:
                try:
                    compiled_only_when = self._compile_single_condition(
                        stmt["only_when"], device_map
                    )
                    lines.append(compiled_only_when)
                except CompilerError as e:
                    warnings.append(CompilerWarning(
                        f"Statement {stmt.get('id', '?')} has an only_when condition "
                        f"that could not be compiled and was skipped: {e}"
                    ))

            if stmt_type == "with_block":
                lines.append(self._compile_with_block(stmt, device_map, warnings))

            elif stmt_type == "wait":
                lines.append(self._compile_wait(stmt, warnings))

            elif stmt_type == "wait_for_state":
                lines.append(self._compile_wait_for_state(stmt, device_map))

            elif stmt_type == "if_block":
                lines.append(self._compile_if_block(
                    stmt, piston, device_map, globals_store,
                    known_piston_slugs, warnings, indent
                ))

            elif stmt_type == "repeat_block":
                lines.append(self._compile_repeat_block(
                    stmt, piston, device_map, globals_store,
                    known_piston_slugs, warnings, indent
                ))

            elif stmt_type == "for_each_block":
                lines.append(self._compile_for_each_block(
                    stmt, piston, device_map, globals_store,
                    known_piston_slugs, warnings, indent
                ))

            elif stmt_type == "while_block":
                lines.append(self._compile_while_block(
                    stmt, piston, device_map, globals_store,
                    known_piston_slugs, warnings, indent
                ))

            elif stmt_type == "for_loop":
                lines.append(self._compile_for_loop(
                    stmt, piston, device_map, globals_store,
                    known_piston_slugs, warnings, indent
                ))

            elif stmt_type == "set_variable":
                lines.append(self._compile_set_variable(stmt, globals_store, warnings))

            elif stmt_type == "log_message":
                lines.append(self._compile_log_message(stmt, piston["id"]))

            elif stmt_type == "call_piston":
                lines.append(self._compile_call_piston(stmt, known_piston_slugs))

            elif stmt_type == "control_piston":
                lines.append(self._compile_control_piston(stmt, known_piston_slugs))

            elif stmt_type == "stop":
                lines.append(self._compile_stop(stmt))

            elif stmt_type == "switch_block":
                lines.append(self._compile_switch_block(
                    stmt, piston, device_map, globals_store,
                    known_piston_slugs, warnings, indent
                ))

            elif stmt_type == "do_block":
                lines.append(self._compile_do_block(
                    stmt, piston, device_map, globals_store,
                    known_piston_slugs, warnings, indent
                ))

            elif stmt_type in ("break", "cancel_pending_tasks", "on_event"):
                raise CompilerError(
                    f"Statement type '{stmt_type}' requires PyScript compilation. "
                    f"This piston should have been flagged as PyScript-only before "
                    f"reaching the compiler. Check the compile_target field."
                )

            else:
                warnings.append(CompilerWarning(
                    f"Statement type '{stmt_type}' (statement {stmt.get('id', '?')}) "
                    f"is not yet implemented in the compiler. This statement was skipped."
                ))
                continue

        # Completion event — always last in the top-level sequence only
        # (COMPILER_SPEC Section 12)
        if _append_completion_event:
            tmpl = self.env.get_template("snippets/completion_event.yaml.j2")
            lines.append(tmpl.render(
                piston_id=piston["id"],
                piston_name=piston["name"],
            ))

        return "\n\n".join(lines)

    # -----------------------------------------------------------------------
    # Section 8.1 — with_block
    # -----------------------------------------------------------------------

    def _compile_with_block(
        self, stmt: dict, device_map: dict, warnings: list
    ) -> str:
        """
        COMPILER_SPEC Section 8.1.
        Single task → simple action block with continue_on_error: true.
        Multiple tasks → parallel block, each with continue_on_error: true.
        continue_on_error: true is always emitted on every service call — matches
        WebCoRE fire-and-forget resilience behavior.
        """
        target_role = stmt.get("target_role", "")
        entity_id = device_map.get(target_role)
        if not entity_id:
            raise CompilerError(
                f"Statement {stmt.get('id', '?')} references role '{target_role}' "
                f"but no device is mapped to that role."
            )

        tasks = stmt.get("tasks", [])
        if not tasks:
            raise CompilerError(
                f"Statement {stmt.get('id', '?')} (with_block) has no tasks defined."
            )

        if len(tasks) == 1:
            task = tasks[0]
            tmpl = self.env.get_template("snippets/with_block.yaml.j2")
            return tmpl.render(
                stmt_id=stmt["id"],
                service=task["service"],
                entity_id=entity_id,
                data=task.get("data") or None,
            )
        else:
            # Multiple tasks → parallel block
            # COMPILER_SPEC Section 8.1
            inner_tmpl = self.env.get_template("snippets/with_block.yaml.j2")
            task_blocks = []
            for task in tasks:
                rendered = inner_tmpl.render(
                    stmt_id=None,
                    service=task["service"],
                    entity_id=entity_id,
                    data=task.get("data") or None,
                )
                task_blocks.append(rendered)

            lines = [f"- alias: \"{stmt['id']}\"", "  parallel:"]
            for block in task_blocks:
                for line in block.splitlines():
                    lines.append(f"    {line}")
            return "\n".join(lines)

    # -----------------------------------------------------------------------
    # Section 8.2 — wait
    # -----------------------------------------------------------------------

    def _compile_wait(self, stmt: dict, warnings: list) -> str:
        """
        COMPILER_SPEC Section 8.2.
        wait until time → wait_for_trigger, always emits CompilerWarning (past-time hang).
        wait duration   → delay block.
        """
        if "until" in stmt and stmt["until"] is not None:
            at_time = stmt["until"]
            # Always emit past-time warning — COMPILER_SPEC Section 8.2 and 14
            warnings.append(CompilerWarning(
                f"'Wait until {at_time}' will pause until that time today. "
                f"If this step is reached after {at_time} has already passed, "
                f"the piston will wait until {at_time} tomorrow. This is expected "
                f"HA behavior — structure your piston so this step is reached before "
                f"the target time, or use a fixed duration delay instead."
            ))
            tmpl = self.env.get_template("snippets/wait_until.yaml.j2")
            return tmpl.render(stmt_id=stmt["id"], at_time=at_time)

        elif "duration_seconds" in stmt:
            delay_yaml = self._format_delay(stmt["duration_seconds"])
            tmpl = self.env.get_template("snippets/wait_duration.yaml.j2")
            return tmpl.render(stmt_id=stmt["id"], delay_yaml=delay_yaml)

        else:
            raise CompilerError(
                f"Statement {stmt.get('id', '?')} (wait) has neither 'until' "
                f"nor 'duration_seconds' defined."
            )

    def _format_delay(self, seconds: int) -> str:
        """COMPILER_SPEC Section 8.2 — readable delay format."""
        if seconds < 60:
            return f"seconds: {seconds}"
        elif seconds < 3600:
            return f"minutes: {seconds // 60}"
        else:
            h = seconds // 3600
            m = (seconds % 3600) // 60
            if m:
                return f"hours: {h}\n    minutes: {m}"
            return f"hours: {h}"

    # -----------------------------------------------------------------------
    # Section 8.3 — wait_for_state
    # -----------------------------------------------------------------------

    def _compile_wait_for_state(self, stmt: dict, device_map: dict) -> str:
        """COMPILER_SPEC Section 8.3."""
        entity_id = device_map.get(stmt.get("target_role", ""))
        if not entity_id:
            raise CompilerError(
                f"Statement {stmt.get('id', '?')} (wait_for_state) references "
                f"role '{stmt.get('target_role')}' but no device is mapped."
            )
        tmpl = self.env.get_template("snippets/wait_for_state.yaml.j2")
        return tmpl.render(
            stmt_id=stmt["id"],
            entity_id=entity_id,
            to_state=stmt.get("compiled_value", stmt.get("value", "")),
            timeout_seconds=stmt.get("timeout_seconds", 60),
        )

    # -----------------------------------------------------------------------
    # Section 8.4 — if_block
    # -----------------------------------------------------------------------

    def _compile_if_block(
        self, stmt: dict, piston: dict, device_map: dict,
        globals_store: dict, known_piston_slugs: dict,
        warnings: list, indent: int,
    ) -> str:
        """COMPILER_SPEC Section 8.4 — recursive."""
        condition = stmt.get("condition", {})
        true_branch = stmt.get("true_branch", [])
        false_branch = stmt.get("false_branch", [])

        compiled_condition = self._compile_single_condition(condition, device_map)
        compiled_true = self._compile_sequence(
            true_branch, piston, device_map, globals_store,
            known_piston_slugs, warnings, indent + 2,
            _append_completion_event=False,
        ) if true_branch else "[]"

        compiled_else = None
        if false_branch:
            compiled_else = self._compile_sequence(
                false_branch, piston, device_map, globals_store,
                known_piston_slugs, warnings, indent + 2,
                _append_completion_event=False,
            )

        lines = [
            f"- alias: \"{stmt['id']}\"",
            f"  if:",
            f"    - {compiled_condition}",
            f"  then:",
        ]
        for line in compiled_true.splitlines():
            lines.append(f"    {line}")

        if compiled_else:
            lines.append("  else:")
            for line in compiled_else.splitlines():
                lines.append(f"    {line}")

        return "\n".join(lines)

    # -----------------------------------------------------------------------
    # Section 8.6 — repeat_block (repeat/do/until)
    # -----------------------------------------------------------------------

    def _compile_repeat_block(
        self, stmt: dict, piston: dict, device_map: dict,
        globals_store: dict, known_piston_slugs: dict,
        warnings: list, indent: int,
    ) -> str:
        """COMPILER_SPEC Section 8.6 — repeat/do/until."""
        condition = stmt.get("condition", {})
        body = stmt.get("body", [])

        compiled_condition = self._compile_single_condition(condition, device_map)
        compiled_body = self._compile_sequence(
            body, piston, device_map, globals_store,
            known_piston_slugs, warnings, indent + 2,
            _append_completion_event=False,
        )

        lines = [
            f"- alias: \"{stmt['id']}\"",
            "  repeat:",
            "    sequence:",
        ]
        for line in compiled_body.splitlines():
            lines.append(f"      {line}")
        lines.append("    until:")
        lines.append(f"      - {compiled_condition}")
        return "\n".join(lines)

    # -----------------------------------------------------------------------
    # Section 8.7 — for_each_block
    # -----------------------------------------------------------------------

    def _compile_for_each_block(
        self, stmt: dict, piston: dict, device_map: dict,
        globals_store: dict, known_piston_slugs: dict,
        warnings: list, indent: int,
    ) -> str:
        """
        COMPILER_SPEC Section 8.7.
        Devices globals are compile-time literal lists — not runtime group lookups.
        """
        collection_role = stmt.get("collection_role", "")
        loop_var = stmt.get("variable_name", "$device").lstrip("$")
        body = stmt.get("body", [])

        entity_ids = self._resolve_collection(collection_role, device_map)

        compiled_body = self._compile_sequence(
            body, piston, device_map, globals_store,
            known_piston_slugs, warnings, indent + 2,
            _append_completion_event=False,
        )
        # Substitute loop variable reference with repeat.item
        compiled_body = compiled_body.replace(f"{{{{ {loop_var} }}}}", "{{ repeat.item }}")

        lines = [
            f"- alias: \"{stmt['id']}\"",
            "  repeat:",
            "    for_each:",
        ]
        for eid in entity_ids:
            lines.append(f"      - {eid}")
        lines.append("    sequence:")
        for line in compiled_body.splitlines():
            lines.append(f"      {line}")
        return "\n".join(lines)

    def _resolve_collection(self, role: str, device_map: dict) -> list[str]:
        """
        Resolve a Devices role to a literal list of entity IDs.
        COMPILER_SPEC Section 8.7.
        """
        value = device_map.get(role)
        if value is None:
            raise CompilerError(
                f"for_each references role '{role}' but no device collection "
                f"is mapped to that role."
            )
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            return [value]
        raise CompilerError(
            f"Role '{role}' resolved to an unexpected value type. "
            f"Expected a list of entity IDs."
        )

    # -----------------------------------------------------------------------
    # Section 8.8 — while_block
    # -----------------------------------------------------------------------

    def _compile_while_block(
        self, stmt: dict, piston: dict, device_map: dict,
        globals_store: dict, known_piston_slugs: dict,
        warnings: list, indent: int,
    ) -> str:
        """COMPILER_SPEC Section 8.8."""
        condition = stmt.get("condition", {})
        body = stmt.get("body", [])

        compiled_condition = self._compile_single_condition(condition, device_map)
        compiled_body = self._compile_sequence(
            body, piston, device_map, globals_store,
            known_piston_slugs, warnings, indent + 2,
            _append_completion_event=False,
        )

        lines = [
            f"- alias: \"{stmt['id']}\"",
            "  repeat:",
            "    while:",
            f"      - {compiled_condition}",
            "    sequence:",
        ]
        for line in compiled_body.splitlines():
            lines.append(f"      {line}")
        return "\n".join(lines)

    # -----------------------------------------------------------------------
    # Section 8.9 — for_loop (counted loop)
    # -----------------------------------------------------------------------

    def _compile_for_loop(
        self, stmt: dict, piston: dict, device_map: dict,
        globals_store: dict, known_piston_slugs: dict,
        warnings: list, indent: int,
    ) -> str:
        """
        COMPILER_SPEC Section 8.9.
        Simple (from 0 or 1, step 1) → repeat count: directly.
        Complex (other from/step) → variables: block at top of sequence.
        """
        from_val = stmt.get("from", 1)
        to_expr = stmt.get("to_expression", "10")
        step = stmt.get("step", 1)
        var_name = stmt.get("variable_name", "$i").lstrip("$")
        body = stmt.get("body", [])

        compiled_body = self._compile_sequence(
            body, piston, device_map, globals_store,
            known_piston_slugs, warnings, indent + 2,
            _append_completion_event=False,
        )

        simple = (from_val in (0, 1)) and (step == 1)

        if simple:
            # Simple case: use repeat.index (1-based) or repeat.index0 (0-based)
            # to substitute the loop variable directly in the body.
            repeat_ref = "repeat.index0" if from_val == 0 else "repeat.index"
            compiled_body = compiled_body.replace(
                f"{{{{ {var_name} }}}}", f"{{{{ {repeat_ref} }}}}"
            )
        else:
            # Complex case: the variables: block at the top of the sequence sets
            # var_name to the computed value. The body already references {{ var_name }}
            # which HA resolves at runtime from the variables: block — no substitution needed.
            pass

        lines = [
            f"- alias: \"{stmt['id']}\"",
            "  repeat:",
            f"    count: {to_expr}",
            "    sequence:",
        ]

        if not simple:
            # Emit a variables: block to compute the adjusted index
            lines.append(
                f"      - variables:\n"
                f"          {var_name}: \"{{{{ {from_val} + (repeat.index0 * {step}) }}}}\""
            )

        for line in compiled_body.splitlines():
            lines.append(f"      {line}")

        return "\n".join(lines)

    # -----------------------------------------------------------------------
    # Section 8.9 — set_variable
    # -----------------------------------------------------------------------

    def _compile_set_variable(
        self, stmt: dict, globals_store: dict, warnings: list
    ) -> str:
        """
        COMPILER_SPEC Section 8.9.
        Local variables  → HA variables: action.
        Global variables (@) → HA helper service calls (input_text, input_number,
                               input_boolean, input_datetime depending on type).
        globals_store maps global variable names to their definitions:
            { "away_mode": { "display_name": "Away Mode", "type": "Yes/No",
                             "helper_entity_id": "input_boolean.pistoncore_away_mode" } }
        """
        var_name_raw = stmt.get("variable_name", "")

        if var_name_raw.startswith("@"):
            var_name = var_name_raw.lstrip("@")
            value_expr = stmt.get("value_expression", "")
            global_def = globals_store.get(var_name, {})
            helper_entity = global_def.get("helper_entity_id", "")
            global_type = global_def.get("type", "Text")

            if not helper_entity:
                warnings.append(CompilerWarning(
                    f"Global variable '{var_name_raw}' is referenced in statement "
                    f"{stmt.get('id', '?')} but has no helper entity ID in globals_store. "
                    f"Deploy the companion integration and define this global before deploying."
                ))
                # Emit a safe no-op comment so the file is still valid YAML
                return "\n".join([
                    f"- alias: \"{stmt['id']}\"",
                    f"  # UNRESOLVED GLOBAL WRITE: {var_name_raw} = {value_expr}",
                    f"  # Define this global in PistonCore and redeploy.",
                ])

            # Choose the correct HA service and field name by helper type
            type_map = {
                "Text":      ("input_text.set_value",     "value"),
                "Number":    ("input_number.set_value",   "value"),
                "Yes/No":    (None,                       None),    # special — see below
                "Date/Time": ("input_datetime.set_datetime", "datetime"),
            }
            service, field = type_map.get(global_type, ("input_text.set_value", "value"))

            if global_type == "Yes/No":
                # input_boolean uses turn_on / turn_off — value must be truthy/falsy
                # We emit a choose: block to handle both cases cleanly.
                if "{{" in str(value_expr):
                    val_template = value_expr
                elif str(value_expr).lower() in ("true", "yes", "on", "1"):
                    val_template = "true"
                else:
                    val_template = value_expr  # let it be evaluated at runtime
                return "\n".join([
                    f"- alias: \"{stmt['id']}\"",
                    "  choose:",
                    "    - conditions:",
                    f"        - condition: template",
                    f"          value_template: \"{{{{ {val_template} | bool }}}}\"",
                    "      sequence:",
                    f"        - action: input_boolean.turn_on",
                    "          target:",
                    f"            entity_id: {helper_entity}",
                    "          continue_on_error: true",
                    "  default:",
                    f"    - action: input_boolean.turn_off",
                    "      target:",
                    f"        entity_id: {helper_entity}",
                    "      continue_on_error: true",
                ])

            # Format the value expression
            if "{{" in str(value_expr):
                formatted_value = f'"{value_expr}"'
            elif isinstance(value_expr, str):
                formatted_value = f'"{value_expr}"'
            else:
                formatted_value = value_expr

            return "\n".join([
                f"- alias: \"{stmt['id']}\"",
                f"  action: {service}",
                "  target:",
                f"    entity_id: {helper_entity}",
                "  data:",
                f"    {field}: {formatted_value}",
                "  continue_on_error: true",
            ])

        var_name = var_name_raw.lstrip("$")
        value_expr = stmt.get("value_expression", "")

        if "{{" in str(value_expr):
            value = value_expr
        elif isinstance(value_expr, str):
            value = f'"{value_expr}"'
        else:
            value = value_expr

        return "\n".join([
            f"- alias: \"{stmt['id']}\"",
            "  variables:",
            f"    {var_name}: {value}",
        ])

    # -----------------------------------------------------------------------
    # Section 8.12 — log_message
    # -----------------------------------------------------------------------

    def _compile_log_message(self, stmt: dict, piston_id: str) -> str:
        """COMPILER_SPEC Section 8.12."""
        tmpl = self.env.get_template("snippets/log_message.yaml.j2")
        return tmpl.render(
            stmt_id=stmt["id"],
            piston_id=piston_id,
            level=stmt.get("level", "info"),
            message=stmt.get("message", ""),
        )

    # -----------------------------------------------------------------------
    # Section 8.13 — call_piston
    # -----------------------------------------------------------------------

    def _compile_call_piston(self, stmt: dict, known_piston_slugs: dict) -> str:
        """COMPILER_SPEC Section 8.13."""
        target_id = stmt.get("target_piston_id", "")
        target_slug = known_piston_slugs.get(target_id)
        if not target_slug:
            raise CompilerError(
                f"Statement {stmt.get('id', '?')} calls piston '{target_id}' "
                f"but that piston was not found. It may have been deleted."
            )

        if stmt.get("wait_for_completion", False):
            return "\n".join([
                f"- alias: \"{stmt['id']}\"",
                f"  action: script.pistoncore_{target_slug}",
            ])
        else:
            return "\n".join([
                f"- alias: \"{stmt['id']}\"",
                "  action: script.turn_on",
                "  target:",
                f"    entity_id: script.pistoncore_{target_slug}",
            ])

    # -----------------------------------------------------------------------
    # Section 8.14 — control_piston
    # -----------------------------------------------------------------------

    def _compile_control_piston(self, stmt: dict, known_piston_slugs: dict) -> str:
        """COMPILER_SPEC Section 8.14."""
        target_type = stmt.get("target_type", "piston")
        action = stmt.get("action", "trigger")

        if target_type == "piston":
            target_id = stmt.get("target_id", "")
            target_slug = known_piston_slugs.get(target_id)
            if not target_slug:
                raise CompilerError(
                    f"Statement {stmt.get('id', '?')} controls piston '{target_id}' "
                    f"but that piston was not found."
                )
            entity_id = f"script.pistoncore_{target_slug}"
            service_map = {
                "trigger": "script.turn_on",
                "start":   "script.turn_on",
                "stop":    "script.turn_off",
                "enable":  "script.turn_on",
                "disable": "script.turn_off",
            }
        else:
            entity_id = stmt.get("target_id", "")
            service_map = {
                "trigger": "automation.trigger",
                "start":   "automation.turn_on",
                "stop":    "automation.turn_off",
                "enable":  "automation.turn_on",
                "disable": "automation.turn_off",
            }

        service = service_map.get(action, "script.turn_on")
        return "\n".join([
            f"- alias: \"{stmt['id']}\"",
            f"  action: {service}",
            "  target:",
            f"    entity_id: {entity_id}",
        ])

    # -----------------------------------------------------------------------
    # Section 8.15 — stop
    # -----------------------------------------------------------------------

    def _compile_stop(self, stmt: dict) -> str:
        """COMPILER_SPEC Section 8.15."""
        tmpl = self.env.get_template("snippets/stop.yaml.j2")
        return tmpl.render(stmt_id=stmt["id"])

    # -----------------------------------------------------------------------
    # Section 8.10 — switch_block
    # -----------------------------------------------------------------------

    def _compile_switch_block(
        self, stmt: dict, piston: dict, device_map: dict,
        globals_store: dict, known_piston_slugs: dict,
        warnings: list, indent: int,
    ) -> str:
        """COMPILER_SPEC Section 8.10 — compiles to HA choose:"""
        subject = stmt.get("subject", {})
        cases = stmt.get("cases", [])
        default_body = stmt.get("default_body", [])

        entity_id = device_map.get(subject.get("role", ""), "")
        attribute = subject.get("attribute")

        lines = [f"- alias: \"{stmt['id']}\"", "  choose:"]
        for case in cases:
            lines.append("    - conditions:")
            lines.append("        - condition: state")
            lines.append(f"          entity_id: {entity_id}")
            if attribute:
                lines.append(f"          attribute: {attribute}")
            lines.append(f"          state: \"{case['value']}\"")
            lines.append("      sequence:")
            compiled = self._compile_sequence(
                case.get("body", []), piston, device_map, globals_store,
                known_piston_slugs, warnings, indent + 2,
                _append_completion_event=False,
            )
            for line in compiled.splitlines():
                lines.append(f"        {line}")

        if default_body:
            lines.append("  default:")
            compiled = self._compile_sequence(
                default_body, piston, device_map, globals_store,
                known_piston_slugs, warnings, indent + 2,
                _append_completion_event=False,
            )
            for line in compiled.splitlines():
                lines.append(f"    {line}")

        return "\n".join(lines)

    # -----------------------------------------------------------------------
    # Section 8.11 — do_block
    # -----------------------------------------------------------------------

    def _compile_do_block(
        self, stmt: dict, piston: dict, device_map: dict,
        globals_store: dict, known_piston_slugs: dict,
        warnings: list, indent: int,
    ) -> str:
        """COMPILER_SPEC Section 8.11 — inline comment + body."""
        label = stmt.get("label", "")
        body = stmt.get("body", [])
        header = f"# do_block: {label} ({stmt['id']})" if label else f"# do_block ({stmt['id']})"
        compiled_body = self._compile_sequence(
            body, piston, device_map, globals_store,
            known_piston_slugs, warnings, indent,
            _append_completion_event=False,
        )
        return f"{header}\n{compiled_body}"

    # -----------------------------------------------------------------------
    # Section 6 + 7 — Automation and script rendering
    # -----------------------------------------------------------------------

    def _compute_content_hash(self, content: str) -> str:
        """
        Hash the content below the header block only.
        The header ends at the first blank line after the opening comment block.
        This matches COMPILER_SPEC Section 5 — the hash covers the compiled
        YAML body, not the comment header that contains the hash itself.
        """
        # Split into lines; skip lines that are part of the comment header
        # (lines starting with '#' or blank lines before real YAML begins).
        lines = content.splitlines()
        body_start = 0
        in_header = True
        for i, line in enumerate(lines):
            stripped = line.strip()
            if in_header and (stripped.startswith("#") or stripped == ""):
                body_start = i + 1
            else:
                in_header = False
                break
        body = "\n".join(lines[body_start:])
        return hashlib.sha256(body.encode()).hexdigest()

    def _render_automation(
        self,
        piston: dict,
        slug: str,
        compiled_triggers: str,
        compiled_conditions: str,
        app_version: str,
    ) -> str:
        """
        Render the automation wrapper file using automation.yaml.j2.
        Hash covers only the YAML body below the comment header.
        COMPILER_SPEC Section 6.
        """
        tmpl = self.env.get_template("automation.yaml.j2")
        content = tmpl.render(
            piston=piston,
            slug=slug,
            compiled_triggers=compiled_triggers,
            compiled_conditions=compiled_conditions,
            app_version=app_version,
            hash="PLACEHOLDER",
        )
        content_hash = self._compute_content_hash(content)
        return content.replace("PLACEHOLDER", content_hash)

    def _render_script(
        self,
        piston: dict,
        slug: str,
        compiled_sequence: str,
        globals_used: list,
        app_version: str,
    ) -> str:
        """
        Render the script body file using script.yaml.j2.
        Hash covers only the YAML body below the comment header.
        COMPILER_SPEC Section 7.
        """
        globals_str = ", ".join(globals_used) if globals_used != ["(none)"] else "(none)"
        tmpl = self.env.get_template("script.yaml.j2")
        content = tmpl.render(
            piston=piston,
            slug=slug,
            compiled_sequence=compiled_sequence,
            globals_used=globals_str,
            app_version=app_version,
            hash="PLACEHOLDER",
        )
        content_hash = self._compute_content_hash(content)
        return content.replace("PLACEHOLDER", content_hash)


# ---------------------------------------------------------------------------
# Quick test — run with:
#   cd backend
#   PISTONCORE_TEMPLATE_DIR=../pistoncore-customize/compiler-templates/native-script/ python compiler.py
# Uses the driveway lights piston from COMPILER_SPEC Section 17.
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import os, sys

    template_dir = os.environ.get(
        "PISTONCORE_TEMPLATE_DIR",
        "/pistoncore-customize/compiler-templates/native-script/"
    )

    test_piston = {
        "pistoncore_version": "1.0",
        "id": "a3f8c2d1",
        "name": "Driveway Lights at Sunset",
        "description": "Turns on driveway lights at sunset and off at 11pm",
        "mode": "single",
        "compile_target": "native_script",
        "roles": {
            "driveway_light": {"label": "Driveway Light", "domain": "light", "required": True}
        },
        "variables": [],
        "triggers": [{"type": "sun", "event": "sunset", "offset_minutes": 0}],
        "conditions": [],
        "actions": [
            {
                "id": "stmt_001",
                "type": "with_block",
                "target_role": "driveway_light",
                "tasks": [{"type": "call_service", "service": "light.turn_on",
                            "data": {"brightness_pct": 100}}],
            },
            {"id": "stmt_002", "type": "wait", "until": "23:00:00"},
            {
                "id": "stmt_003",
                "type": "with_block",
                "target_role": "driveway_light",
                "tasks": [{"type": "call_service", "service": "light.turn_off", "data": {}}],
            },
        ],
    }

    test_device_map = {"driveway_light": "light.driveway_main"}

    try:
        compiler = Compiler(template_dir=template_dir)
        auto_yaml, script_yaml, warnings, errors = compiler.compile_piston(
            piston=test_piston,
            device_map=test_device_map,
            globals_store={},
            app_version="0.9",
        )

        if errors:
            print("ERRORS:")
            for e in errors:
                print(f"  {e}")
            sys.exit(1)

        if warnings:
            print("WARNINGS:")
            for w in warnings:
                print(f"  ⚠  {w}")

        print("=== AUTOMATION FILE ===")
        print(auto_yaml)
        print("\n=== SCRIPT FILE ===")
        print(script_yaml)
        print("\nCompiler ran successfully.")

    except Exception as e:
        print(f"Unexpected error: {e}")
        raise
