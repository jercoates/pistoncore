# AI Update Guide — Validation Rules

**Folder:** `/pistoncore-customize/validation-rules/`
**PistonCore version:** 0.9

---

## What This Folder Is

This folder contains two JSON files that control what PistonCore checks when you save a piston,
and how it explains errors to you in plain English. You can edit these files to add new checks,
fix error messages, or add plain English explanations for errors that currently show raw
technical output.

Changes take effect after restarting the PistonCore container. No code changes needed.

---

## How to Use This Guide

Paste this entire file into any AI assistant and describe what you want to change. Examples:
- "Add a validation check that warns when a piston has more than 50 statements"
- "The error message for a missing role is confusing — help me rewrite it"
- "HA is giving me a new error I don't recognize — help me add a plain English translation"

---

## File: internal-checks.json

Controls Stage 1 validation — checks PistonCore runs internally before any HA involvement.
Runs on every save. Fast. No network required.

### Structure

```json
{
  "checks": [
    {
      "id": "check_id",
      "description": "What this check does (for your reference)",
      "severity": "error | warning",
      "message": "Plain English message shown to the user when this check fails"
    }
  ]
}
```

### Current Checks

```json
{
  "checks": [
    {
      "id": "no_triggers",
      "description": "Piston has no triggers defined",
      "severity": "warning",
      "message": "This piston has no triggers. It will never run automatically. Add at least one trigger, or set the trigger to Manual Only if you only want to run it from the Test button."
    },
    {
      "id": "missing_device_map",
      "description": "A statement references a role that has no device mapped to it",
      "severity": "error",
      "message": "One or more statements reference a device that hasn't been mapped yet. Open the piston and assign a real device to each placeholder before deploying."
    },
    {
      "id": "undefined_global",
      "description": "A statement references a global variable that does not exist",
      "severity": "error",
      "message": "This piston references a global variable that hasn't been defined. Go to Settings > Global Variables and create it before deploying."
    },
    {
      "id": "pyscript_feature_in_native_script",
      "description": "Piston contains break, cancel_pending_tasks, or on_event but compile_target is native_script",
      "severity": "error",
      "message": "This piston uses a feature that requires PyScript (break, cancel all pending tasks, or on event). Change the compile target to PyScript in the editor header."
    },
    {
      "id": "variable_scope_loop_warning",
      "description": "A variable is set inside a loop body and referenced outside it",
      "severity": "warning",
      "message": "Variable '{{variable_name}}' is set inside a loop but used outside it. Home Assistant may not reliably carry that value out of the loop. Your piston may not behave as expected — consider restructuring to avoid this pattern."
    },
    {
      "id": "wait_time_past",
      "description": "A wait-until-time statement may refer to a time already passed",
      "severity": "warning",
      "message": "This piston waits until {{time}}. If the piston runs after that time today, it will wait until {{time}} tomorrow. This is expected behavior — just something to be aware of."
    },
    {
      "id": "slug_collision",
      "description": "Two pistons produce the same slug (filename collision)",
      "severity": "warning",
      "message": "This piston's name is too similar to '{{other_piston_name}}' — they would produce the same filename. PistonCore has added a short ID suffix to disambiguate. Consider renaming one of them."
    },
    {
      "id": "no_name",
      "description": "Piston has no name",
      "severity": "error",
      "message": "Every piston needs a name. Give this piston a name before saving."
    },
    {
      "id": "call_piston_target_missing",
      "description": "A call_piston statement references a piston ID that does not exist",
      "severity": "error",
      "message": "This piston calls another piston that can't be found. It may have been deleted. Update or remove the Call Another Piston statement."
    },
    {
      "id": "wait_for_completion_native_script",
      "description": "call_piston with wait_for_completion across a PyScript boundary",
      "severity": "warning",
      "message": "Waiting for a PyScript piston to finish from a native script piston is not supported. The call will fire without waiting. Convert this piston to PyScript if you need to wait for the result."
    }
  ]
}
```

---

## File: error-translations.json

Controls how raw compiler or HA errors are translated into plain English.
When PistonCore encounters a raw error it doesn't recognize, it shows the raw text.
Adding an entry here means users see a plain English explanation instead.

### Structure

```json
{
  "translations": [
    {
      "id": "translation_id",
      "match": "substring or pattern to find in the raw error text",
      "match_type": "contains | startswith | exact",
      "plain_english": "What this error means in plain English",
      "suggestion": "Optional: what the user should do to fix it"
    }
  ]
}
```

### Current Translations

```json
{
  "translations": [
    {
      "id": "yaml_indent_error",
      "match": "could not find expected ':'",
      "match_type": "contains",
      "plain_english": "The compiled YAML has a formatting problem — a colon is missing or in the wrong place.",
      "suggestion": "This is a PistonCore compiler bug. Please report it at github.com/jercoates/pistoncore/issues with your piston JSON attached."
    },
    {
      "id": "yaml_tab_error",
      "match": "found character '\\t'",
      "match_type": "contains",
      "plain_english": "The compiled YAML contains a tab character, which YAML does not allow.",
      "suggestion": "This is a PistonCore compiler bug. Please report it at github.com/jercoates/pistoncore/issues."
    },
    {
      "id": "unknown_action",
      "match": "is not a valid action",
      "match_type": "contains",
      "plain_english": "The compiled file references a Home Assistant action that HA doesn't recognize.",
      "suggestion": "The device capability may have changed. Try removing and re-adding the action in the editor to refresh the capability data from HA."
    },
    {
      "id": "entity_not_found",
      "match": "Entity not found",
      "match_type": "contains",
      "plain_english": "A device referenced in this piston no longer exists in Home Assistant.",
      "suggestion": "Go to the editor and update the device mapping. The device may have been renamed or removed from HA."
    },
    {
      "id": "script_reload_invalid",
      "match": "Invalid config for [script]",
      "match_type": "contains",
      "plain_english": "Home Assistant rejected the compiled script. The YAML structure may not match what your version of HA expects.",
      "suggestion": "Check your HA version (minimum 2023.1 required). If your HA is up to date, this may be a compiler bug — please report it."
    },
    {
      "id": "mode_invalid",
      "match": "valid modes are",
      "match_type": "contains",
      "plain_english": "The piston run mode is not valid for this type of compiled file.",
      "suggestion": "Open the piston editor and check the Mode setting in the header."
    },
    {
      "id": "duplicate_script_key",
      "match": "duplicate key",
      "match_type": "contains",
      "plain_english": "Two pistons are producing the same script key name. This usually means two pistons have very similar names.",
      "suggestion": "Rename one of the conflicting pistons so their names are distinct enough to produce different filenames."
    }
  ]
}
```

---

## Adding a New Internal Check

To add a check, add a new entry to the `checks` array in `internal-checks.json`.

**Rules:**
- `id` must be unique across all checks
- `severity` must be exactly `"error"` or `"warning"`
- `message` must be plain English — no technical terms, no YAML, no entity IDs
- Use `{{variable_name}}` placeholders in messages where the Python compiler substitutes values
  (the compiler must also be updated to pass those values — coordinate with a developer)
- `"error"` severity blocks saving. `"warning"` allows saving but shows in the validation banner.

---

## Adding a New Error Translation

To add a translation, add a new entry to the `translations` array in `error-translations.json`.

**Rules:**
- `match_type: "contains"` — the raw error text contains this substring (case-insensitive)
- `match_type: "startswith"` — the raw error text starts with this string
- `match_type: "exact"` — the raw error text matches exactly
- Translations are checked in order — first match wins
- `suggestion` is optional but strongly encouraged

**To add a translation for a new HA error you're seeing:**
1. Copy the full raw error text from the PistonCore validation banner
2. Find a distinctive substring that identifies this error
3. Add a new entry with a clear plain English explanation

---

## What NOT to Change

- Do not remove existing check IDs — other parts of the system may reference them
- Do not change `match` strings to be overly broad — a match of `"error"` would catch
  every error message and replace it with one translation
- Do not add checks that require network access — Stage 1 runs without HA involvement

---

*PistonCore is an independent open-source project. Not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.*
