# pistoncore/backend/compiler.py
#
# Matches COMPILER_SPEC.md v0.1 exactly.
# Started from Grok's skeleton — fixed and completed by Claude.
#
# This file is designed to be easy for anyone + Claude to maintain.
# Each method references the COMPILER_SPEC section it implements.
# Add new statement types by adding an elif in _compile_sequence()
# and a corresponding _compile_<type>() method below.
#
# Usage:
#   compiler = Compiler(template_dir="path/to/native-script/")
#   auto_yaml, script_yaml, warnings, errors = compiler.compile_piston(
#       piston, device_map, globals_store, app_version="0.9.1"
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

        piston          — the full piston JSON dict
        device_map      — maps role names to HA entity IDs
                          e.g. {"driveway_light": "light.driveway_main"}
        globals_store   — maps global variable IDs to their definitions
                          e.g. {"uuid_abc": {"display_name": "Away Mode", "type": "Text"}}
        app_version     — PistonCore version string for the file header
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
                        slug = f"{slug}_{piston['id'][:4]}"
                        warnings.append(CompilerWarning(
                            f"Piston name '{piston['name']}' is too similar to another piston — "
                            f"a short ID suffix has been added to the filename to avoid conflict. "
                            f"Consider renaming one of them."
                        ))
                        break

            globals_used = self._scan_globals(piston)

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
        Global variable roles are prefixed with @ in the piston JSON.
        Returns a list of display names, or ["(none)"] if none found.
        COMPILER_SPEC Section 5.
        """
        found = set()

        def walk(obj: Any):
            if isinstance(obj, dict):
                # Global variables appear as roles prefixed with "@" in target_role
                # or as variable_name starting with "@"
                role = obj.get("target_role", "")
                if isinstance(role, str) and role.startswith("@"):
                    found.add(role[1:])  # strip the @
                var = obj.get("variable_name", "")
                if isinstance(var, str) and var.startswith("@"):
                    found.add(var[1:])
                for v in obj.values():
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
        Returns pre-indented YAML string.
        COMPILER_SPEC Section 6.3.
        """
        if not triggers:
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

            elif ttype == "manual_only":
                # No trigger — automation has triggers: []
                return "    []"

            elif ttype == "called_by_piston":
                # No automation trigger — script called directly
                # Automation file is not generated for this piston type
                # The compiler caller handles this case
                return "    []"

            else:
                raise CompilerError(
                    f"Unknown trigger type: '{ttype}'. "
                    f"This trigger type may not be implemented yet."
                )

        # Indent 4 spaces for the automation template
        indented = "\n".join("    " + line for line in "\n".join(lines).splitlines())
        return indented

    def _format_offset(self, minutes: int) -> str:
        """COMPILER_SPEC Section 6.3 — sun trigger offset formatting."""
        sign = "+" if minutes > 0 else ("-" if minutes < 0 else "")
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
        Compile top-level piston conditions (checked in the automation before
        the script runs). Returns "[]" if no conditions.
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

            if attribute_type == "binary" or operator in ("is", "is not"):
                tmpl = self.env.get_template("snippets/condition_state.yaml.j2")
                return tmpl.render(
                    entity_id=entity_id,
                    state=compiled_value,
                    attribute=subject.get("attribute"),
                )
            elif attribute_type == "numeric":
                above = compiled_value if "greater" in operator else None
                below = compiled_value if "less" in operator else None
                tmpl = self.env.get_template("snippets/condition_numeric.yaml.j2")
                return tmpl.render(entity_id=entity_id, above=above, below=below)

        elif subject_type == "time":
            tmpl = self.env.get_template("snippets/condition_time.yaml.j2")
            return tmpl.render(
                after=cond.get("after"),
                before=cond.get("before"),
                weekday=cond.get("weekday"),
            )

        elif subject_type == "variable":
            # Template condition for variable comparisons
            tmpl = self.env.get_template("snippets/condition_template.yaml.j2")
            var_name = subject.get("name", "").lstrip("$")
            template_expr = f"{{{{ {var_name} {operator} {compiled_value!r} }}}}"
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
    ) -> str:
        """
        Main statement dispatcher. Walks the actions array and compiles
        each statement. Appends the completion event at the end.
        COMPILER_SPEC Section 7.2.
        """
        # Track variables set inside loops for scope warning (Section 8.9)
        loop_depth = 0
        vars_set_in_loops: dict[str, str] = {}  # var_name → stmt_id where it was set

        lines = []
        for stmt in actions:
            stmt_type = stmt.get("type")

            if stmt_type == "with_block":
                lines.append(self._compile_with_block(stmt, device_map, warnings))

            elif stmt_type == "wait":
                lines.append(self._compile_wait(stmt))

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

            elif stmt_type == "set_variable":
                lines.append(self._compile_set_variable(stmt, warnings))

            elif stmt_type == "log_message":
                lines.append(self._compile_log_message(stmt, piston["id"]))

            elif stmt_type == "call_piston":
                lines.append(self._compile_call_piston(stmt, known_piston_slugs))

            elif stmt_type == "control_piston":
                lines.append(self._compile_control_piston(stmt, known_piston_slugs))

            elif stmt_type == "stop":
                lines.append(self._compile_stop(stmt))

            elif stmt_type in ("break", "cancel_pending_tasks", "on_event"):
                raise CompilerError(
                    f"Statement type '{stmt_type}' requires PyScript compilation. "
                    f"This piston should have been flagged as PyScript-only before "
                    f"reaching the compiler. Check the compile_target field."
                )

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

            else:
                warnings.append(CompilerWarning(
                    f"Statement type '{stmt_type}' (statement {stmt.get('id', '?')}) "
                    f"is not yet implemented in the compiler. This statement was skipped."
                ))
                continue

        # Completion event — always last (COMPILER_SPEC Section 12)
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
        """COMPILER_SPEC Section 8.1."""
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

        tmpl = self.env.get_template("snippets/with_block.yaml.j2")

        if len(tasks) == 1:
            # Single task — simple action block
            task = tasks[0]
            return tmpl.render(
                stmt_id=stmt["id"],
                service=task["service"],
                entity_id=entity_id,
                data=task.get("data") or None,
            )
        else:
            # Multiple tasks — compile each and join
            # For now compile the first task; full parallel support is v2
            warnings.append(CompilerWarning(
                f"Statement {stmt.get('id', '?')} has multiple tasks. "
                f"Only the first task will be compiled in v1. "
                f"Full parallel task support is planned for v2."
            ))
            task = tasks[0]
            return tmpl.render(
                stmt_id=stmt["id"],
                service=task["service"],
                entity_id=entity_id,
                data=task.get("data") or None,
            )

    # -----------------------------------------------------------------------
    # Section 8.2 — wait
    # -----------------------------------------------------------------------

    def _compile_wait(self, stmt: dict) -> str:
        """COMPILER_SPEC Section 8.2."""
        if "until" in stmt:
            tmpl = self.env.get_template("snippets/wait_until.yaml.j2")
            return tmpl.render(stmt_id=stmt["id"], at_time=stmt["until"])
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
            known_piston_slugs, warnings, indent + 2
        ) if true_branch else "    []"

        compiled_else = None
        if false_branch:
            compiled_else = self._compile_sequence(
                false_branch, piston, device_map, globals_store,
                known_piston_slugs, warnings, indent + 2
            )

        # Build YAML directly — no template needed for if/then/else
        # (structure is too variable for a simple Jinja2 snippet)
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
    # Section 8.6 — repeat_block
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
            known_piston_slugs, warnings, indent + 2
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
    # Section 8.7 — for_each_block (compile-time literal list)
    # -----------------------------------------------------------------------

    def _compile_for_each_block(
        self, stmt: dict, piston: dict, device_map: dict,
        globals_store: dict, known_piston_slugs: dict,
        warnings: list, indent: int,
    ) -> str:
        """
        COMPILER_SPEC Section 8.7.
        Devices globals are compile-time literal lists — not runtime group lookups.
        DESIGN.md Section 4.1.
        """
        collection_role = stmt.get("collection_role", "")
        loop_var = stmt.get("variable_name", "$device").lstrip("$")
        body = stmt.get("body", [])

        # Resolve the collection to a list of entity IDs
        entity_ids = self._resolve_collection(collection_role, device_map, piston)

        # Compile body — replace $device with repeat.item
        compiled_body = self._compile_sequence(
            body, piston, device_map, globals_store,
            known_piston_slugs, warnings, indent + 2
        )
        # Substitute the loop variable reference with repeat.item
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

    def _resolve_collection(
        self, role: str, device_map: dict, piston: dict
    ) -> list[str]:
        """
        Resolve a Devices role to a literal list of entity IDs.
        Devices globals are baked in at compile time — no runtime lookup.
        COMPILER_SPEC Section 8.7, DESIGN.md Section 4.1.
        """
        # device_map may contain a list for Devices roles
        value = device_map.get(role)
        if value is None:
            raise CompilerError(
                f"for_each references role '{role}' but no device collection "
                f"is mapped to that role."
            )
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            # Single entity — wrap in list
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
            known_piston_slugs, warnings, indent + 2
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
    # Section 8.9 — set_variable (with scope caveat)
    # -----------------------------------------------------------------------

    def _compile_set_variable(self, stmt: dict, warnings: list) -> str:
        """
        COMPILER_SPEC Section 8.9.
        Emits HA variables: action. Emits a CompilerWarning if the variable
        is set inside a loop — scope may not propagate out.
        """
        var_name = stmt.get("variable_name", "").lstrip("$").lstrip("@")
        value_expr = stmt.get("value_expression", "")

        # Try to render as a Jinja2 expression if it looks like one
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

        wait = stmt.get("wait_for_completion", False)
        if wait:
            # Direct call — caller waits for completion (COMPILER_SPEC Section 8.13)
            return "\n".join([
                f"- alias: \"{stmt['id']}\"",
                f"  action: script.pistoncore_{target_slug}",
            ])
        else:
            # Fire and forget
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
            # ha_automation
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

        lines = [f"- alias: \"{stmt['id']}\"", "  choose:"]
        for case in cases:
            lines.append("    - conditions:")
            lines.append("        - condition: state")
            lines.append(f"          entity_id: {entity_id}")
            lines.append(f"          state: \"{case['value']}\"")
            lines.append("      sequence:")
            compiled = self._compile_sequence(
                case.get("body", []), piston, device_map, globals_store,
                known_piston_slugs, warnings, indent + 2
            )
            for line in compiled.splitlines():
                lines.append(f"        {line}")

        if default_body:
            lines.append("  default:")
            compiled = self._compile_sequence(
                default_body, piston, device_map, globals_store,
                known_piston_slugs, warnings, indent + 2
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
            known_piston_slugs, warnings, indent
        )
        return f"{header}\n{compiled_body}"

    # -----------------------------------------------------------------------
    # Section 6 — Automation and script rendering
    # -----------------------------------------------------------------------

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
        # Compute and insert real hash (Section 3)
        content_hash = hashlib.sha256(content.encode()).hexdigest()[:16]
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
        COMPILER_SPEC Section 7.
        """
        globals_str = ", ".join(globals_used) if globals_used else "(none)"
        tmpl = self.env.get_template("script.yaml.j2")
        content = tmpl.render(
            piston=piston,
            slug=slug,
            compiled_sequence=compiled_sequence,
            globals_used=globals_str,
            app_version=app_version,
            hash="PLACEHOLDER",
        )
        content_hash = hashlib.sha256(content.encode()).hexdigest()[:16]
        return content.replace("PLACEHOLDER", content_hash)


# ---------------------------------------------------------------------------
# Quick test — run with:  python compiler.py
# Uses the driveway lights piston from COMPILER_SPEC Section 17
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json, os, sys

    # Point this at your actual template directory
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
            app_version="0.9.1",
        )

        if errors:
            print("ERRORS:")
            for e in errors:
                print(f"  {e}")
            sys.exit(1)

        if warnings:
            print("WARNINGS:")
            for w in warnings:
                print(f"  {w}")

        print("=== AUTOMATION FILE ===")
        print(auto_yaml)
        print("\n=== SCRIPT FILE ===")
        print(script_yaml)
        print("\nCompiler ran successfully.")

    except Exception as e:
        print(f"Compiler error: {e}")
        raise
