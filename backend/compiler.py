# pistoncore/backend/compiler.py
#
# Matches COMPILER_SPEC.md Section 8 entry point and Section 13 result contract.
# Started from Grok's skeleton — fixed and completed by Claude (Sessions 8-9).
# Session 10: five bug fixes — hash, globals writes, _scan_globals, only_when, for_loop substitution.
# Session 28: S1-2c flat statements array — stmt_map lookup, all control-flow methods updated.
# Session 28: S1-7 session 1 — Bugs 1-7, 11, 13, 14, 19, 22, 23, 24 fixed.
#
# This file is designed to be easy for anyone + Claude to maintain.
# Each method references the COMPILER_SPEC section it implements.
# Add new statement types by adding an elif in _compile_sequence()
# and a corresponding _compile_<type>() method below.
#
# Usage:
#   compiler = Compiler(template_dir="path/to/native-script/")
#   result = compiler.compile_piston(context)
#   # context is the fat compiler context object — COMPILER_SPEC Section 7
#   # result is a CompilerResult — COMPILER_SPEC Section 13

import re
import hashlib
from dataclasses import dataclass, field
from typing import Any
from jinja2 import Environment, FileSystemLoader, select_autoescape


# ---------------------------------------------------------------------------
# Compiler result types — COMPILER_SPEC Section 13
# ---------------------------------------------------------------------------

@dataclass
class CompilerMessage:
    """
    A single compiler error or warning.
    level:   "error" | "warning" | "info"
    code:    SCREAMING_SNAKE_CASE identifier — used by frontend and tests
    message: plain English, shown directly to user
    context: which statement caused this (optional)
    COMPILER_SPEC Section 13.
    """
    level: str
    code: str
    message: str
    context: str | None = None

    def __str__(self):
        return f"[{self.code}] {self.message}"


@dataclass
class CompilerResult:
    """
    Return value from compile_piston().
    automation_yaml: automation file content, or None if omitted/error
    script_yaml:     script file content, or None on error
    errors:          list of CompilerMessage with level="error"
    warnings:        list of CompilerMessage with level="warning"
    COMPILER_SPEC Section 13.
    """
    automation_yaml: str | None = None
    script_yaml: str | None = None
    errors: list = field(default_factory=list)
    warnings: list = field(default_factory=list)


class CompilerError(Exception):
    """
    Raised internally to abort compilation on unrecoverable problems.
    Always caught in compile_piston() and converted to a CompilerMessage.
    Never propagates to the caller — caller always receives a CompilerResult.
    COMPILER_SPEC Section 13.
    """
    def __init__(self, message: str, code: str = "COMPILER_ERROR", context: str | None = None):
        super().__init__(message)
        self.code = code
        self.context = context


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

    # -----------------------------------------------------------------------
    # Section 8 — Main entry point
    # -----------------------------------------------------------------------

    def compile_piston(self, context: dict) -> CompilerResult:
        """
        Main entry point. Accepts fat compiler context object, returns CompilerResult.

        context keys (COMPILER_SPEC Section 7):
          piston             — full piston JSON dict (includes device_map, statements)
          global_variables   — list of global variable definition objects
          known_piston_ids   — maps piston IDs to themselves (for call_piston resolution)
          pistoncore_version — version string for file header

        COMPILER_SPEC Section 8.
        """
        result = CompilerResult()

        try:
            piston           = context["piston"]
            device_map       = piston.get("device_map", {})
            globals_store    = {
                g["name"]: g
                for g in context.get("global_variables", [])
                if "name" in g
            }
            known_piston_ids = context.get("known_piston_ids", {})
            app_version      = context.get("pistoncore_version", "1.0")

            slug = self.slugify(piston["name"])

            # Slug collision check — alias field only, COMPILER_SPEC Section 4
            if known_piston_ids:
                other_names = {
                    pid: p.get("name", "") if isinstance(p, dict) else ""
                    for pid, p in known_piston_ids.items()
                    if pid != piston["id"]
                }
                for pid, other_name in other_names.items():
                    if self.slugify(other_name) == slug:
                        slug = f"{slug}_{piston['id'][:4]}"[:50]
                        result.warnings.append(CompilerMessage(
                            level="warning",
                            code="SLUG_COLLISION",
                            message=(
                                f"Piston name '{piston['name']}' produces the same alias slug "
                                f"as another piston. Appended piston ID prefix to disambiguate: '{slug}'."
                            ),
                        ))
                        break

            globals_used = self._scan_globals(piston)

            # Build stmt_map for flat array lookups
            stmt_map = {s["id"]: s for s in piston.get("statements", [])}

            # Collect triggers — condition objects with is_trigger:true
            # COMPILER_SPEC Section 9.3
            trigger_conditions = self._collect_triggers(piston, stmt_map)

            # called_by_piston — no automation file generated
            omit_automation = any(
                c.get("subject") == "called_by_piston"
                for c in trigger_conditions
            )

            # manual_only — automation file gets empty trigger list, no error
            manual_only = any(
                c.get("subject") == "manual_only"
                for c in trigger_conditions
            )

            # NO_TRIGGERS validation — COMPILER_SPEC Section 13
            if not trigger_conditions and not omit_automation and not manual_only:
                raise CompilerError(
                    "This piston has no triggers defined. It will never run automatically. "
                    "Add at least one trigger in the Triggers section.",
                    code="NO_TRIGGERS",
                )

            compiled_triggers = self._compile_triggers(
                trigger_conditions, device_map, result.warnings
            )
            compiled_conditions = self._compile_conditions(
                piston.get("conditions", []), device_map, result.warnings
            )
            compiled_sequence = self._compile_sequence(
                piston.get("statements", []),
                piston,
                device_map,
                globals_store,
                known_piston_ids,
                result.warnings,
                stmt_map=stmt_map,
            )

            if omit_automation:
                result.automation_yaml = ""
            else:
                result.automation_yaml = self._render_automation(
                    piston, slug, compiled_triggers, compiled_conditions, app_version
                )

            result.script_yaml = self._render_script(
                piston, slug, compiled_sequence, globals_used, app_version
            )

        except CompilerError as e:
            result.errors.append(CompilerMessage(
                level="error",
                code=e.code,
                message=str(e),
                context=e.context,
            ))
            result.automation_yaml = None
            result.script_yaml = None

        return result

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
    # Section 9.3 — Trigger collection and compilation
    # -----------------------------------------------------------------------

    def _collect_triggers(self, piston: dict, stmt_map: dict) -> list:
        """
        Walk the flat statements array and collect every condition object
        where is_trigger is True. Triggers can appear in any if block
        anywhere in the piston — not just the top level.
        COMPILER_SPEC Section 9.3.
        """
        found = []
        for stmt in piston.get("statements", []):
            for cond in stmt.get("conditions", []):
                if cond.get("is_trigger"):
                    found.append(cond)
        return found

    def _compile_triggers(
        self, trigger_conditions: list, device_map: dict, warnings: list
    ) -> str:
        """
        Compile collected trigger condition objects to YAML trigger blocks.
        Each trigger gets an id: field injected as line 2 of the template output.
        All trigger templates start with '- trigger: X' — id: goes on line 2.
        Returns pre-indented YAML string (4 spaces).
        COMPILER_SPEC Section 9.3.
        """
        if not trigger_conditions:
            return "    []"

        if any(c.get("subject") in ("manual_only", "called_by_piston")
               for c in trigger_conditions):
            return "    []"

        lines = []
        for cond in trigger_conditions:
            subject  = cond.get("subject", "")
            operator = cond.get("operator", "")
            role     = cond.get("role", "")
            value    = cond.get("value")
            cond_id  = cond.get("id", "")

            if subject == "time" and operator == "happens daily at":
                if isinstance(value, dict) and "preset" in value:
                    preset    = value.get("preset", "sunset")
                    offset    = value.get("offset", 0)
                    direction = value.get("offset_direction", "+")
                    unit      = value.get("offset_unit", "minutes")
                    offset_minutes = offset if unit == "minutes" else offset * 60
                    if direction == "-":
                        offset_minutes = -offset_minutes
                    tmpl = self.env.get_template("snippets/trigger_sun.yaml.j2")
                    rendered = tmpl.render(
                        event=preset,
                        offset=self._format_offset(offset_minutes),
                    )
                else:
                    at_time = value if isinstance(value, str) else cond.get("compiled_value", "")
                    tmpl = self.env.get_template("snippets/trigger_time.yaml.j2")
                    rendered = tmpl.render(at_time=at_time)
                lines.append(self._inject_trigger_id(rendered, cond_id))

            elif subject == "system_start":
                tmpl = self.env.get_template("snippets/trigger_homeassistant.yaml.j2")
                rendered = tmpl.render(event="start")
                lines.append(self._inject_trigger_id(rendered, cond_id))

            elif role and operator in ("changes to", "changes from", "changes"):
                entity_ids = self._resolve_role_entities(role, device_map, cond_id)
                compiled_value = cond.get("compiled_value", value or "")
                for entity_id in entity_ids:
                    tmpl = self.env.get_template("snippets/trigger_state.yaml.j2")
                    rendered = tmpl.render(
                        entity_id=entity_id,
                        to=compiled_value if operator in ("changes to", "changes") else None,
                        from_state=cond.get("from_state"),
                        for_seconds=cond.get("for_seconds"),
                    )
                    lines.append(self._inject_trigger_id(rendered, cond_id))

            elif role and operator in ("drops below", "rises above"):
                entity_ids = self._resolve_role_entities(role, device_map, cond_id)
                compiled_value = cond.get("compiled_value", value)
                for entity_id in entity_ids:
                    tmpl = self.env.get_template("snippets/trigger_numeric.yaml.j2")
                    rendered = tmpl.render(
                        entity_id=entity_id,
                        above=compiled_value if operator == "rises above" else None,
                        below=compiled_value if operator == "drops below" else None,
                    )
                    lines.append(self._inject_trigger_id(rendered, cond_id))

            else:
                warnings.append(CompilerMessage(
                    level="warning",
                    code="UNKNOWN_TRIGGER",
                    message=(
                        f"Trigger condition '{cond_id}' has subject='{subject}' "
                        f"operator='{operator}' which is not yet implemented. "
                        f"This trigger was skipped."
                    ),
                    context=cond_id,
                ))

        if not lines:
            return "    []"

        indented = "\n".join(
            "    " + line for line in "\n".join(lines).splitlines()
        )
        return indented

    def _inject_trigger_id(self, rendered: str, cond_id: str) -> str:
        """
        Insert id: as the second line of a rendered trigger template block.
        All trigger templates start with '- trigger: something' on line 1.
        The id: field is injected immediately after, indented to match.
        This is correct HA YAML — id: is a sibling key under the list item,
        not a nested structure.
        COMPILER_SPEC Section 9.3 (Bug 2 fix).
        """
        template_lines = rendered.rstrip("\n").splitlines()
        if not template_lines:
            return rendered
        return "\n".join(
            [template_lines[0], f'  id: "{cond_id}"'] + template_lines[1:]
        )

    def _resolve_role_entities(
        self, role: str, device_map: dict, context_id: str = ""
    ) -> list:
        """
        Resolve a role name to a list of entity IDs.
        Raises CompilerError with UNMAPPED_ROLE if role not in device_map.
        """
        entity_ids = device_map.get(role)
        if not entity_ids:
            raise CompilerError(
                f"Role '{role}' is referenced but no device is mapped to that role.",
                code="UNMAPPED_ROLE",
                context=context_id,
            )
        if isinstance(entity_ids, str):
            return [entity_ids]
        return list(entity_ids)

    def _format_offset(self, minutes: int) -> str:
        """COMPILER_SPEC Section 9.3 — sun trigger offset formatting."""
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
        Each compiled condition gets a leading "- " prepended here.
        COMPILER_SPEC Section 6.4 and 8.5.
        """
        if not conditions:
            return "[]"

        lines = []
        for cond in conditions:
            body = self._compile_single_condition(cond, device_map)
            # _compile_single_condition returns body WITHOUT leading "- "
            # Add it here for the top-level conditions list
            lines.append("- " + body)
        return "\n".join(lines)

    def _compile_single_condition(self, cond: dict, device_map: dict) -> str:
        """
        Compile one condition object to a HA condition YAML block.
        Returns the YAML body WITHOUT a leading "- " dash.
        Callers are responsible for prepending "- " where needed.
        This prevents the double-dash bug (- - condition: state).
        Bug 4/5 fix — COMPILER_SPEC Section 8.5.

        Bug 11 fix: boolean state values (on/off/true/false) are always
        quoted in YAML output to prevent HA from misreading them as booleans.
        """
        ctype = cond.get("type")

        # AND / OR groups — Bug 4/5: sub-conditions also get "- " prepended here
        if ctype == "and":
            lines = ["condition: and", "  conditions:"]
            for sub in cond.get("conditions", []):
                sub_body = self._compile_single_condition(sub, device_map)
                lines.append("    - " + sub_body)
            return "\n".join(lines)

        if ctype == "or":
            lines = ["condition: or", "  conditions:"]
            for sub in cond.get("conditions", []):
                sub_body = self._compile_single_condition(sub, device_map)
                lines.append("    - " + sub_body)
            return "\n".join(lines)

        # Flat format (PISTON_FORMAT.md): role at top level, no nested subject object
        if "role" in cond and not isinstance(cond.get("subject"), dict):
            subject = {
                "type": "device",
                "role": cond.get("role", ""),
                "attribute": cond.get("attribute", ""),
                "attribute_type": cond.get("attribute_type", ""),
            }
        else:
            subject = cond.get("subject", {})

        subject_type = subject.get("type") or ("device" if subject.get("role") else None)
        operator = cond.get("operator", "is")
        compiled_value = cond.get("compiled_value", cond.get("value", ""))

        # Bug 11 — quote boolean state strings so YAML doesn't interpret them as booleans
        BOOLEAN_STATES = {"on", "off", "true", "false", "yes", "no", "home", "not_home"}
        def _quote_state(val):
            if isinstance(val, str) and val.lower() in BOOLEAN_STATES:
                return f'"{val}"'
            return val

        if subject_type == "device":
            role = subject.get("role", "")
            entity_ids = self._resolve_role_entities(role, device_map, cond.get("id", ""))
            entity_id = entity_ids[0]
            attribute_type = subject.get("attribute_type", "")

            if attribute_type == "numeric" or "greater" in operator or "less" in operator:
                above = compiled_value if ("greater" in operator or "above" in operator) else None
                below = compiled_value if ("less" in operator or "below" in operator) else None
                tmpl = self.env.get_template("snippets/condition_numeric.yaml.j2")
                return self._strip_leading_dash(tmpl.render(entity_id=entity_id, above=above, below=below))
            else:
                tmpl = self.env.get_template("snippets/condition_state.yaml.j2")
                return self._strip_leading_dash(tmpl.render(
                    entity_id=entity_id,
                    state=_quote_state(compiled_value),
                    attribute=subject.get("attribute") or None,
                ))

        elif subject_type == "time":
            tmpl = self.env.get_template("snippets/condition_time.yaml.j2")
            return self._strip_leading_dash(tmpl.render(
                after=cond.get("after"),
                before=cond.get("before"),
                weekday=cond.get("weekday"),
            ))

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
            return self._strip_leading_dash(tmpl.render(template_expression=template_expr))

        raise CompilerError(
            f"Cannot compile condition — unknown subject type '{subject_type}'.",
            code="UNKNOWN_CONDITION_TYPE",
        )

    def _strip_leading_dash(self, rendered: str) -> str:
        """
        Remove the leading '- ' from a rendered condition template.
        All condition templates start with '- condition: X'.
        _compile_single_condition returns body WITHOUT the leading dash.
        Callers prepend '- ' where needed (in _compile_conditions,
        _compile_if_block, _compile_repeat_block, _compile_while_block).
        This prevents the double-dash bug (- - condition: state).
        Bug 4/5 fix.
        """
        stripped = rendered.rstrip("\n")
        if stripped.startswith("- "):
            stripped = stripped[2:]
        return stripped

    # -----------------------------------------------------------------------
    # Section 7.2 — Statement dispatcher
    # -----------------------------------------------------------------------

    def _compile_sequence(
        self,
        child_ids: list,
        piston: dict,
        device_map: dict,
        globals_store: dict,
        known_piston_ids: dict,
        warnings: list,
        indent: int = 4,
        _append_completion_event: bool = True,
        stmt_map: dict = None,
    ) -> str:
        """
        Main statement dispatcher. Walks the child_ids list, resolves each ID
        to a statement object via stmt_map, and compiles each statement.
        Appends the PISTONCORE_RUN_COMPLETE event at end of the top-level
        sequence only.
        COMPILER_SPEC Section 7.2.
        Flat model: child_ids is a list of statement ID strings. Each is looked
        up in stmt_map. stmt_map is built once at the top-level call and passed
        through all recursive calls. PISTON_FORMAT.md: statements is a flat
        array; control-flow nodes reference children by ID only.
        """
        # Build stmt_map at the top-level call; recursive calls receive it pre-built.
        if stmt_map is None:
            stmt_map = {s['id']: s for s in piston.get('statements', [])}

        # Resolve child_ids to statement objects.
        # Each item should be a string ID in the flat model. The embedded-object
        # fallback handles legacy data or the top-level call from compile_piston
        # which still passes the raw statements list (list of dicts).
        stmts = []
        for item in child_ids:
            if isinstance(item, str):
                s = stmt_map.get(item)
                if s is None:
                    warnings.append(CompilerMessage(
                        level="warning",
                        code="MISSING_STATEMENT_ID",
                        message=(
                            f"Statement ID '{item}' referenced in a child list "
                            f"was not found in piston.statements — skipped."
                        ),
                    ))
                    continue
                stmts.append(s)
            else:
                # Embedded object (top-level call passes dicts directly, or legacy data)
                stmts.append(item)

        lines = []
        for stmt in stmts:
            stmt_type = stmt.get("type")

            # only_when — COMPILER_SPEC Section 8.16
            # If the statement has an only_when condition, emit a HA condition: action
            # immediately before the statement itself. The statement is skipped at
            # runtime if the condition is not met.
            if "only_when" in stmt and stmt["only_when"]:
                try:
                    # _compile_single_condition returns body without "- "; prepend it here
                    cond_body = self._compile_single_condition(
                        stmt["only_when"], device_map
                    )
                    lines.append("- " + cond_body)
                except CompilerError as e:
                    warnings.append(CompilerMessage(
                        level="warning",
                        code="ONLY_WHEN_COMPILE_FAILED",
                        message=(
                            f"Statement {stmt.get('id', '?')} has an only_when condition "
                            f"that could not be compiled and was skipped: {e}"
                        ),
                        context=stmt.get("id"),
                    ))

            if stmt_type == "action":
                lines.append(self._compile_with_block(stmt, device_map, warnings))

            elif stmt_type == "wait":
                lines.append(self._compile_wait(stmt, warnings))

            elif stmt_type == "wait_for_state":
                lines.append(self._compile_wait_for_state(stmt, device_map))

            elif stmt_type == "if":
                lines.append(self._compile_if_block(
                    stmt, piston, device_map, globals_store,
                    known_piston_ids, warnings, indent, stmt_map
                ))

            elif stmt_type == "repeat":
                lines.append(self._compile_repeat_block(
                    stmt, piston, device_map, globals_store,
                    known_piston_ids, warnings, indent, stmt_map
                ))

            elif stmt_type == "for_each":
                lines.append(self._compile_for_each_block(
                    stmt, piston, device_map, globals_store,
                    known_piston_ids, warnings, indent, stmt_map
                ))

            elif stmt_type == "while":
                lines.append(self._compile_while_block(
                    stmt, piston, device_map, globals_store,
                    known_piston_ids, warnings, indent, stmt_map
                ))

            elif stmt_type == "for":
                lines.append(self._compile_for_loop(
                    stmt, piston, device_map, globals_store,
                    known_piston_ids, warnings, indent, stmt_map
                ))

            elif stmt_type == "set_variable":
                lines.append(self._compile_set_variable(stmt, globals_store, warnings))

            elif stmt_type == "log_message":
                lines.append(self._compile_log_message(stmt, piston["id"]))

            elif stmt_type == "call_piston":
                lines.append(self._compile_call_piston(stmt, known_piston_ids))

            elif stmt_type == "control_piston":
                lines.append(self._compile_control_piston(stmt, known_piston_ids))

            elif stmt_type == "exit":
                lines.append(self._compile_stop(stmt))

            elif stmt_type == "switch":
                lines.append(self._compile_switch_block(
                    stmt, piston, device_map, globals_store,
                    known_piston_ids, warnings, indent, stmt_map
                ))

            elif stmt_type == "do":
                lines.append(self._compile_do_block(
                    stmt, piston, device_map, globals_store,
                    known_piston_ids, warnings, indent, stmt_map
                ))

            elif stmt_type in ("break", "cancel_pending_tasks", "on_event"):
                raise CompilerError(
                    f"Statement type '{stmt_type}' requires PyScript compilation. "
                    f"This piston should have been flagged as PyScript-only before "
                    f"reaching the compiler. Check the compile_target field.",
                    code="PYSCRIPT_REQUIRED",
                    context=stmt.get("id"),
                )

            else:
                warnings.append(CompilerMessage(
                    level="warning",
                    code="UNIMPLEMENTED_STATEMENT",
                    message=(
                        f"Statement type '{stmt_type}' (statement {stmt.get('id', '?')}) "
                        f"is not yet implemented in the compiler. This statement was skipped."
                    ),
                    context=stmt.get("id"),
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
        Bug 7 fix: compile for ALL entities in the role, not just devices[0]/entity_ids[0].
        Single entity + single task → simple action block.
        Multiple entities or multiple tasks → parallel block, each branch with
        continue_on_error: true at both the branch and action level.
        continue_on_error: true is always emitted — matches WebCoRE fire-and-forget behavior.
        """
        # PISTON_FORMAT.md: devices is an array of role names
        devices = stmt.get("devices") or []
        target_role = devices[0] if devices else ""
        entity_ids = self._resolve_role_entities(target_role, device_map, stmt.get("id", ""))

        tasks = stmt.get("tasks", [])
        if not tasks:
            raise CompilerError(
                f"Statement {stmt.get('id', '?')} (action) has no tasks defined.",
                code="NO_TASKS",
                context=stmt.get("id"),
            )

        inner_tmpl = self.env.get_template("snippets/with_block.yaml.j2")

        # Simple case: one entity, one task → flat action block
        if len(entity_ids) == 1 and len(tasks) == 1:
            task = tasks[0]
            return inner_tmpl.render(
                stmt_id=stmt["id"],
                service=task.get("ha_service") or task.get("command", ""),
                entity_id=entity_ids[0],
                data=task.get("parameters") or None,
            )

        # Complex case: multiple entities or multiple tasks → parallel block.
        # Each branch gets continue_on_error: true at the sequence level so a
        # single offline device doesn't kill the whole parallel block.
        # COMPILER_SPEC Section 8.1 (parallel sequences note).
        branches = []
        for entity_id in entity_ids:
            for task in tasks:
                rendered = inner_tmpl.render(
                    stmt_id=None,
                    service=task.get("ha_service") or task.get("command", ""),
                    entity_id=entity_id,
                    data=task.get("parameters") or None,
                )
                branches.append(rendered)

        lines = [f"- alias: \"{stmt['id']}\"", "  parallel:"]
        for branch in branches:
            branch_lines = branch.splitlines()
            lines.append("    - continue_on_error: true")
            lines.append("      sequence:")
            for line in branch_lines:
                lines.append(f"        {line}")
        return "\n".join(lines)

    # -----------------------------------------------------------------------
    # Section 8.2 — wait
    # -----------------------------------------------------------------------

    def _compile_wait(self, stmt: dict, warnings: list) -> str:
        """
        COMPILER_SPEC Section 8.2.
        wait until time → wait_for_trigger, always emits WAIT_UNTIL_PAST_TIME warning.
        wait duration   → delay block.
        """
        if "until" in stmt and stmt["until"] is not None:
            at_time = stmt["until"]
            # Always emit past-time warning — COMPILER_SPEC Section 8.2, code WAIT_UNTIL_PAST_TIME
            warnings.append(CompilerMessage(
                level="warning",
                code="WAIT_UNTIL_PAST_TIME",
                message=(
                    f"'Wait until {at_time}' will pause until that time today. "
                    f"If this step is reached after {at_time} has already passed, "
                    f"the piston will wait until {at_time} tomorrow. Structure your "
                    f"piston so this step is reached before the target time, or use "
                    f"a fixed duration delay instead."
                ),
                context=stmt.get("id"),
            ))
            # Bug 3 fix: emit timeout (default 1 hour) and continue_on_timeout
            timeout_seconds = stmt.get("timeout_seconds", 3600)
            tmpl = self.env.get_template("snippets/wait_until.yaml.j2")
            return tmpl.render(
                stmt_id=stmt["id"],
                at_time=at_time,
                timeout_seconds=timeout_seconds,
                continue_on_timeout=stmt.get("continue_on_timeout", True),
            )

        elif "duration" in stmt and stmt["duration"] is not None:
            # PISTON_FORMAT.md: duration + duration_unit fields
            # Convert to seconds for _format_delay
            duration = int(stmt["duration"])
            unit = stmt.get("duration_unit", "seconds")
            unit_map = {"seconds": 1, "s": 1, "minutes": 60, "m": 60, "hours": 3600, "h": 3600}
            seconds = duration * unit_map.get(unit, 1)
            delay_yaml = self._format_delay(seconds)
            tmpl = self.env.get_template("snippets/wait_duration.yaml.j2")
            return tmpl.render(stmt_id=stmt["id"], delay_yaml=delay_yaml)

        else:
            raise CompilerError(
                f"Statement {stmt.get('id', '?')} (wait) has neither 'until' "
                f"nor 'duration' defined.",
                code="INVALID_WAIT",
                context=stmt.get("id"),
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
        # PISTON_FORMAT.md: conditions array with standard condition objects
        conditions = stmt.get("conditions", [])
        if not conditions:
            raise CompilerError(
                f"Statement {stmt.get('id', '?')} (wait_for_state) has no conditions defined.",
                code="INVALID_WAIT_FOR_STATE",
                context=stmt.get("id"),
            )
        cond = conditions[0]
        entity_ids = self._resolve_role_entities(
            cond.get("role", ""), device_map, stmt.get("id", "")
        )
        tmpl = self.env.get_template("snippets/wait_for_state.yaml.j2")
        return tmpl.render(
            stmt_id=stmt["id"],
            entity_id=entity_ids[0],
            to_state=cond.get("compiled_value", ""),
            timeout_seconds=stmt.get("timeout_seconds", 60),
        )

    # -----------------------------------------------------------------------
    # Section 8.4 — if_block
    # -----------------------------------------------------------------------

    def _compile_if_block(
        self, stmt: dict, piston: dict, device_map: dict,
        globals_store: dict, known_piston_ids: dict,
        warnings: list, indent: int, stmt_map: dict,
    ) -> str:
        """COMPILER_SPEC Section 8.4 — recursive."""
        # PISTON_FORMAT.md: conditions is an array; compile all, join with condition_operator
        conditions = stmt.get("conditions", [])
        true_branch = stmt.get("then", [])
        false_branch = stmt.get("else", [])

        # Compile all conditions and join — for now compile first non-trigger condition only
        # (full multi-condition support requires condition template builder, S1-7 session 2)
        # Skip is_trigger conditions — those compiled as automation triggers, not if conditions
        non_trigger = [c for c in conditions if not c.get("is_trigger")]
        if non_trigger:
            # _compile_single_condition returns body WITHOUT "- "; prepend it here (Bug 4 fix)
            cond_body = self._compile_single_condition(non_trigger[0], device_map)
            compiled_condition = "- " + cond_body
        else:
            # No conditions (trigger-only if block) — always true in script context
            compiled_condition = "- condition: template\n  value_template: \"{{ true }}\""

        compiled_true = self._compile_sequence(
            true_branch, piston, device_map, globals_store,
            known_piston_ids, warnings, indent + 2,
            _append_completion_event=False,
            stmt_map=stmt_map,
        ) if true_branch else "[]"

        compiled_else = None
        if false_branch:
            compiled_else = self._compile_sequence(
                false_branch, piston, device_map, globals_store,
                known_piston_ids, warnings, indent + 2,
                _append_completion_event=False,
                stmt_map=stmt_map,
            )

        lines = [
            f"- alias: \"{stmt['id']}\"",
            f"  if:",
            f"    {compiled_condition}",
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
        globals_store: dict, known_piston_ids: dict,
        warnings: list, indent: int, stmt_map: dict,
    ) -> str:
        """COMPILER_SPEC Section 8.6 — repeat/do/until."""
        # PISTON_FORMAT.md: until_conditions array + statements array
        until_conditions = stmt.get("until_conditions", [])
        body = stmt.get("statements", [])

        condition = until_conditions[0] if until_conditions else {}
        # Bug 4/5 fix: _compile_single_condition returns body without "- "; prepend here
        cond_body = self._compile_single_condition(condition, device_map)
        compiled_body = self._compile_sequence(
            body, piston, device_map, globals_store,
            known_piston_ids, warnings, indent + 2,
            _append_completion_event=False,
            stmt_map=stmt_map,
        )

        lines = [
            f"- alias: \"{stmt['id']}\"",
            "  repeat:",
            "    sequence:",
        ]
        for line in compiled_body.splitlines():
            lines.append(f"      {line}")
        lines.append("    until:")
        lines.append(f"      - {cond_body}")
        return "\n".join(lines)

    # -----------------------------------------------------------------------
    # Section 8.7 — for_each_block
    # -----------------------------------------------------------------------

    def _compile_for_each_block(
        self, stmt: dict, piston: dict, device_map: dict,
        globals_store: dict, known_piston_ids: dict,
        warnings: list, indent: int, stmt_map: dict,
    ) -> str:
        """
        COMPILER_SPEC Section 8.7.
        Bug 6 fix: body actions targeting the loop role must use {{ repeat.item }}
        as the entity_id at runtime. Compile the body with a sentinel device_map
        entry for the loop role that maps to {{ repeat.item }}, so action
        compilation resolves correctly. Text substitution on compiled output is
        unreliable — instead we inject the sentinel before compiling the body.
        """
        # PISTON_FORMAT.md: list_role, variable, statements
        collection_role = stmt.get("list_role", "")
        body = stmt.get("statements", [])

        entity_ids = self._resolve_collection(collection_role, device_map)

        # Bug 6 fix: override device_map for body compilation so the loop role
        # resolves to the repeat.item sentinel, not a baked entity_id list.
        body_device_map = dict(device_map)
        body_device_map[collection_role] = ["{{ repeat.item }}"]

        compiled_body = self._compile_sequence(
            body, piston, body_device_map, globals_store,
            known_piston_ids, warnings, indent + 2,
            _append_completion_event=False,
            stmt_map=stmt_map,
        )

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
                f"is mapped to that role.",
                code="UNMAPPED_ROLE",
            )
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            return [value]
        raise CompilerError(
            f"Role '{role}' resolved to an unexpected value type. "
            f"Expected a list of entity IDs.",
            code="UNMAPPED_ROLE",
        )

    # -----------------------------------------------------------------------
    # Section 8.8 — while_block
    # -----------------------------------------------------------------------

    def _compile_while_block(
        self, stmt: dict, piston: dict, device_map: dict,
        globals_store: dict, known_piston_ids: dict,
        warnings: list, indent: int, stmt_map: dict,
    ) -> str:
        """COMPILER_SPEC Section 8.8."""
        # PISTON_FORMAT.md: conditions array + statements array
        conditions = stmt.get("conditions", [])
        body = stmt.get("statements", [])

        condition = conditions[0] if conditions else {}
        # Bug 4/5 fix: _compile_single_condition returns body without "- "; prepend here
        cond_body = self._compile_single_condition(condition, device_map)
        compiled_body = self._compile_sequence(
            body, piston, device_map, globals_store,
            known_piston_ids, warnings, indent + 2,
            _append_completion_event=False,
            stmt_map=stmt_map,
        )

        lines = [
            f"- alias: \"{stmt['id']}\"",
            "  repeat:",
            "    while:",
            f"      - {cond_body}",
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
        globals_store: dict, known_piston_ids: dict,
        warnings: list, indent: int, stmt_map: dict,
    ) -> str:
        """
        COMPILER_SPEC Section 8.9.
        Simple (from 0 or 1, step 1) → repeat count: directly.
        Complex (other from/step) → variables: block at top of sequence.
        """
        # PISTON_FORMAT.md: start, end, step, counter_variable, statements
        from_val = stmt.get("start", 1)
        to_expr = stmt.get("end", "10")
        step = stmt.get("step", 1)
        var_name = stmt.get("counter_variable", "$i").lstrip("$")
        body = stmt.get("statements", [])

        compiled_body = self._compile_sequence(
            body, piston, device_map, globals_store,
            known_piston_ids, warnings, indent + 2,
            _append_completion_event=False,
            stmt_map=stmt_map,
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
        # PISTON_FORMAT.md: variable is the name string, value is an operand object
        var_name_raw = stmt.get("variable", "")

        if var_name_raw.startswith("@"):
            var_name = var_name_raw.lstrip("@")
            # Resolve the value operand
            value_obj = stmt.get("value", {})
            value_expr = self._resolve_operand(value_obj)

            global_def = globals_store.get(var_name, {})
            helper_entity = global_def.get("helper_entity_id", "")
            global_type = global_def.get("type", "Text")

            if not helper_entity:
                warnings.append(CompilerMessage(
                    level="warning",
                    code="UNRESOLVED_GLOBAL",
                    message=(
                        f"Global variable '{var_name_raw}' is referenced in statement "
                        f"{stmt.get('id', '?')} but has no helper entity ID in globals_store. "
                        f"Define this global in PistonCore and redeploy."
                    ),
                    context=stmt.get("id"),
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
                # Bug 19 fix: correct indentation for choose/default block
                if "{{" in str(value_expr):
                    val_template = value_expr
                elif str(value_expr).lower() in ("true", "yes", "on", "1"):
                    val_template = "true"
                else:
                    val_template = value_expr
                return "\n".join([
                    f"- alias: \"{stmt['id']}\"",
                    "  choose:",
                    "    - conditions:",
                    "        - condition: template",
                    f"          value_template: \"{{{{ {val_template} | bool }}}}\"",
                    "      sequence:",
                    "        - action: input_boolean.turn_on",
                    "          target:",
                    f"            entity_id: {helper_entity}",
                    "          continue_on_error: true",
                    "  default:",
                    "    - action: input_boolean.turn_off",
                    "      target:",
                    f"        entity_id: {helper_entity}",
                    "      continue_on_error: true",
                ])

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

        # Piston variable ($ prefix or bare name)
        var_name = var_name_raw.lstrip("$")
        value_obj = stmt.get("value", {})
        value_expr = self._resolve_operand(value_obj)

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
    # Operand resolver — PISTON_FORMAT.md Operand/Value Schema
    # -----------------------------------------------------------------------

    def _resolve_operand(self, value_obj: Any) -> Any:
        """
        Resolve a PISTON_FORMAT.md operand object to a Python value or Jinja2 expression.
        Handles: literal, variable, global_variable, system_variable, expression.
        """
        if not isinstance(value_obj, dict):
            # Raw value (legacy or bare string/number)
            return value_obj

        vtype = value_obj.get("type", "literal")

        if vtype == "literal":
            return value_obj.get("data", "")

        if vtype == "variable":
            name = value_obj.get("name", "").lstrip("$")
            return f"{{{{ {name} }}}}"

        if vtype == "global_variable":
            name = value_obj.get("name", "").lstrip("@")
            # Will be resolved to helper entity at runtime — emit as template
            return f"{{{{ states('input_text.pistoncore_{name}') }}}}"

        if vtype == "system_variable":
            sys_map = {
                "$now": "now()",
                "$sunrise": "state_attr('sun.sun', 'next_rising')",
                "$sunset": "state_attr('sun.sun', 'next_setting')",
                "$hour": "now().hour",
                "$minute": "now().minute",
                "$second": "now().second",
                "$index": "repeat.index",
                "$weekday": "now().isoweekday()",
                "$currentEventDevice": "var_name",
            }
            name = value_obj.get("name", "")
            expr = sys_map.get(name, name.lstrip("$"))
            offset = value_obj.get("offset", 0)
            if offset:
                unit = value_obj.get("offset_unit", "minutes")
                direction = value_obj.get("offset_direction", "+")
                offset_map = {"minutes": "timedelta(minutes=", "hours": "timedelta(hours=", "seconds": "timedelta(seconds="}
                td = offset_map.get(unit, "timedelta(minutes=")
                return f"{{{{ {expr} {direction} {td}{offset}) }}}}"
            return f"{{{{ {expr} }}}}"

        if vtype == "expression":
            return value_obj.get("expression", "")

        return value_obj.get("data", "")

    # -----------------------------------------------------------------------


    def _compile_log_message(self, stmt: dict, piston_id: str) -> str:
        """COMPILER_SPEC Section 8.12."""
        tmpl = self.env.get_template("snippets/log_message.yaml.j2")
        # PISTON_FORMAT.md: message is an operand object
        message_obj = stmt.get("message", {})
        message = self._resolve_operand(message_obj) if isinstance(message_obj, dict) else str(message_obj)
        return tmpl.render(
            stmt_id=stmt["id"],
            piston_id=piston_id,
            level=stmt.get("level", "info"),
            message=message,
        )

    # -----------------------------------------------------------------------
    # Section 8.13 — call_piston
    # -----------------------------------------------------------------------

    def _compile_call_piston(self, stmt: dict, known_piston_ids: dict) -> str:
        """
        COMPILER_SPEC Section 8.13.
        Bug 13 fix: script entity ID uses piston UUID, not slug.
        Format: script.pistoncore_{target_piston_id}
        """
        target_id = stmt.get("target_piston_id", "")
        if not target_id or target_id not in known_piston_ids:
            raise CompilerError(
                f"Statement {stmt.get('id', '?')} calls piston '{target_id}' "
                f"but that piston was not found. It may have been deleted.",
                code="CALLED_PISTON_NOT_FOUND",
                context=stmt.get("id"),
            )

        if stmt.get("wait_for_completion", False):
            return "\n".join([
                f"- alias: \"{stmt['id']}\"",
                f"  action: script.pistoncore_{target_id}",
            ])
        else:
            return "\n".join([
                f"- alias: \"{stmt['id']}\"",
                "  action: script.turn_on",
                "  target:",
                f"    entity_id: script.pistoncore_{target_id}",
            ])

    # -----------------------------------------------------------------------
    # Section 8.14 — control_piston
    # -----------------------------------------------------------------------

    def _compile_control_piston(self, stmt: dict, known_piston_ids: dict) -> str:
        """
        COMPILER_SPEC Section 8.14.
        Bug 13 fix: uses piston UUID for entity ID, not slug.
        """
        target_type = stmt.get("target_type", "piston")
        action = stmt.get("action", "trigger")

        if target_type == "piston":
            target_id = stmt.get("target_id", "")
            if not target_id or target_id not in known_piston_ids:
                raise CompilerError(
                    f"Statement {stmt.get('id', '?')} controls piston '{target_id}' "
                    f"but that piston was not found.",
                    code="CALLED_PISTON_NOT_FOUND",
                    context=stmt.get("id"),
                )
            entity_id = f"script.pistoncore_{target_id}"
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
        globals_store: dict, known_piston_ids: dict,
        warnings: list, indent: int, stmt_map: dict,
    ) -> str:
        """COMPILER_SPEC Section 8.10 — compiles to HA choose:"""
        # PISTON_FORMAT.md: expression object, cases array (with statements), default array
        expression = stmt.get("expression", {})
        cases = stmt.get("cases", [])
        default_stmts = stmt.get("default", [])

        # Resolve expression to entity_id for state comparison if it's a device role
        entity_id = ""
        if expression.get("type") == "variable":
            # Variable expression — will be used in template
            var_name = expression.get("name", "").lstrip("$@")
        else:
            var_name = ""

        lines = [f"- alias: \"{stmt['id']}\"", "  choose:"]
        for case in cases:
            case_val = case.get("value", "")
            lines.append("    - conditions:")
            lines.append("        - condition: template")
            if var_name:
                lines.append(f"          value_template: \"{{{{ {var_name} == {repr(case_val)} }}}}\"")
            else:
                lines.append(f"          value_template: \"{{{{ false }}}}\"")
            lines.append("      sequence:")
            compiled = self._compile_sequence(
                case.get("statements", []), piston, device_map, globals_store,
                known_piston_ids, warnings, indent + 2,
                _append_completion_event=False,
                stmt_map=stmt_map,
            )
            for line in compiled.splitlines():
                lines.append(f"        {line}")

        if default_stmts:
            lines.append("  default:")
            compiled = self._compile_sequence(
                default_stmts, piston, device_map, globals_store,
                known_piston_ids, warnings, indent + 2,
                _append_completion_event=False,
                stmt_map=stmt_map,
            )
            for line in compiled.splitlines():
                lines.append(f"    {line}")

        return "\n".join(lines)

    # -----------------------------------------------------------------------
    # Section 8.11 — do_block
    # -----------------------------------------------------------------------

    def _compile_do_block(
        self, stmt: dict, piston: dict, device_map: dict,
        globals_store: dict, known_piston_ids: dict,
        warnings: list, indent: int, stmt_map: dict,
    ) -> str:
        """COMPILER_SPEC Section 8.11 — inline comment + body."""
        # PISTON_FORMAT.md: description field, statements array
        label = stmt.get("description", "") or ""
        body = stmt.get("statements", [])
        header = f"# do_block: {label} ({stmt['id']})" if label else f"# do_block ({stmt['id']})"
        compiled_body = self._compile_sequence(
            body, piston, device_map, globals_store,
            known_piston_ids, warnings, indent,
            _append_completion_event=False,
            stmt_map=stmt_map,
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
        COMPILER_SPEC Section 9 (Bug 14 fix).

        Template variable guide:
          piston_id — piston UUID. Used for: automation id:, action script entity_id,
                      filename (pistoncore_{piston_id}.yaml). NEVER use slug here.
          slug      — name-derived slug. Used ONLY for alias: (human label in HA UI).
          piston    — full piston dict (piston.name, piston.description, piston.mode etc.)
        """
        tmpl = self.env.get_template("automation.yaml.j2")
        content = tmpl.render(
            piston=piston,
            piston_id=piston["id"],
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
        COMPILER_SPEC Section 10 (Bug 14 fix).

        Template variable guide:
          piston_id — piston UUID. Used for: script key name (pistoncore_{piston_id}:),
                      filename (pistoncore_{piston_id}.yaml). NEVER use slug here.
          slug      — name-derived slug. Used ONLY for alias: (human label in HA UI).
          piston    — full piston dict.
        """
        globals_str = ", ".join(globals_used) if globals_used != ["(none)"] else "(none)"
        tmpl = self.env.get_template("script.yaml.j2")
        content = tmpl.render(
            piston=piston,
            piston_id=piston["id"],
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
        "id": "a3f8c2d1",
        "name": "Driveway Lights at Sunset",
        "description": "Turns on driveway lights at sunset and off at 11pm",
        "mode": "single",
        "compile_target": "native_script",
        "device_map": {
            "driveway_light": ["light.driveway_main"]
        },
        "variables": [],
        "conditions": [],
        # Flat statements array — COMPILER_SPEC Section 18 format.
        # Trigger is a condition object with is_trigger:True inside the if block.
        # then/else contain statement ID strings, not embedded objects.
        "statements": [
            {
                "id": "stmt_001",
                "type": "if",
                "conditions": [
                    {
                        "id": "cond_001",
                        "is_trigger": True,
                        "subject": "time",
                        "operator": "happens daily at",
                        "value": {"preset": "sunset", "offset": 0,
                                  "offset_unit": "minutes", "offset_direction": "+"},
                    }
                ],
                "condition_operator": "and",
                "then": ["stmt_002", "stmt_003", "stmt_004"],
                "else_ifs": [],
                "else": [],
            },
            {
                "id": "stmt_002",
                "type": "action",
                "devices": ["driveway_light"],
                "tasks": [{"id": "task_001", "command": "turn_on", "domain": "light",
                            "ha_service": "light.turn_on",
                            "parameters": {"brightness_pct": 100}}],
            },
            {"id": "stmt_003", "type": "wait", "wait_type": "until", "until": "23:00:00"},
            {
                "id": "stmt_004",
                "type": "action",
                "devices": ["driveway_light"],
                "tasks": [{"id": "task_002", "command": "turn_off", "domain": "light",
                            "ha_service": "light.turn_off", "parameters": {}}],
            },
        ],
    }

    # Fat compiler context — COMPILER_SPEC Section 7
    test_context = {
        "piston": test_piston,
        "global_variables": [],
        "known_piston_ids": {},
        "pistoncore_version": "0.9",
        "entity_states": {},
        "ha_version": "unknown",
    }

    try:
        compiler = Compiler(template_dir=template_dir)
        result = compiler.compile_piston(test_context)

        if result.errors:
            print("ERRORS:")
            for e in result.errors:
                print(f"  [{e.code}] {e.message}")
            sys.exit(1)

        if result.warnings:
            print("WARNINGS:")
            for w in result.warnings:
                print(f"  ⚠  [{w.code}] {w.message}")

        print("=== AUTOMATION FILE ===")
        print(result.automation_yaml)
        print("\n=== SCRIPT FILE ===")
        print(result.script_yaml)
        print("\nCompiler ran successfully.")

    except Exception as e:
        print(f"Unexpected error: {e}")
        raise
