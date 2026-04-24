"""
PistonCore Compiler Verification Test
Verifies the driveway lights piston compiles to the expected output
defined in COMPILER_SPEC Section 17.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from compiler.compiler import compile_piston

# --- Driveway lights piston (DESIGN.md Section 18 / COMPILER_SPEC Section 17) ---

DRIVEWAY_PISTON = {
    "pistoncore_version": "1.0",
    "id": "a3f8c2d1",
    "name": "Driveway Lights at Sunset",
    "description": "Turns on driveway lights at sunset and off at 11pm",
    "mode": "single",
    "compile_target": "native_script",
    "triggers": [
        {"type": "sun", "event": "sunset", "offset_minutes": 0}
    ],
    "conditions": [],
    "actions": [
        {
            "id": "stmt_001",
            "type": "with_block",
            "target_role": "driveway_light",
            "tasks": [
                {"type": "call_service", "service": "light.turn_on",
                 "data": {"brightness_pct": 100}}
            ]
        },
        {
            "id": "stmt_002",
            "type": "wait",
            "until": "23:00:00"
        },
        {
            "id": "stmt_003",
            "type": "with_block",
            "target_role": "driveway_light",
            "tasks": [
                {"type": "call_service", "service": "light.turn_off", "data": {}}
            ]
        }
    ]
}

DEVICE_MAP = {
    "driveway_light": "light.driveway_main"
}

# --- Expected outputs from COMPILER_SPEC Section 17 ---

EXPECTED_AUTOMATION = """\
# !!! DO NOT EDIT MANUALLY - MANAGED BY PISTONCORE !!!
# pc_piston_id: a3f8c2d1 | pc_version: 0.9 | pc_hash: """  # hash appended dynamically

EXPECTED_AUTOMATION_BODY = """\
- id: pistoncore_a3f8c2d1
  alias: "Driveway Lights at Sunset"
  description: "Turns on driveway lights at sunset and off at 11pm"
  mode: single
  triggers:
    - trigger: sun
      event: sunset
      offset: "00:00:00"
  conditions: []
  actions:
    - action: script.pistoncore_driveway_lights_at_sunset"""

EXPECTED_SCRIPT_CONTAINS = [
    'pistoncore_driveway_lights_at_sunset:',
    'alias: "Driveway Lights at Sunset (PistonCore)"',
    'mode: single',
    'sequence:',
    '- alias: "stmt_001"',
    'action: light.turn_on',
    'entity_id: light.driveway_main',
    'brightness_pct: 100',
    'continue_on_error: true',
    '- alias: "stmt_002"',
    'wait_for_trigger:',
    '- trigger: time',
    'at: "23:00:00"',
    '- alias: "stmt_003"',
    'action: light.turn_off',
    'continue_on_error: true',
    'PISTONCORE_RUN_COMPLETE',
    'piston_id: "a3f8c2d1"',
    'piston_name: "Driveway Lights at Sunset"',
    'status: "success"',
]


def run_test():
    print("=" * 60)
    print("PistonCore Compiler Verification — Driveway Lights Piston")
    print("=" * 60)

    automation_yaml, script_yaml, warnings = compile_piston(
        DRIVEWAY_PISTON, DEVICE_MAP
    )

    # --- Check slug ---
    assert "driveway_lights_at_sunset" in automation_yaml, "Slug incorrect in automation"
    assert "driveway_lights_at_sunset" in script_yaml, "Slug incorrect in script"
    print("✓ Slug: driveway_lights_at_sunset")

    # --- Check automation structure ---
    assert "- id: pistoncore_a3f8c2d1" in automation_yaml
    assert 'alias: "Driveway Lights at Sunset"' in automation_yaml
    assert "mode: single" in automation_yaml
    assert "trigger: sun" in automation_yaml
    assert 'event: sunset' in automation_yaml
    assert 'offset: "00:00:00"' in automation_yaml
    assert "conditions: []" in automation_yaml
    assert "action: script.pistoncore_driveway_lights_at_sunset" in automation_yaml
    print("✓ Automation file structure correct")

    # --- Check headers ---
    assert "DO NOT EDIT MANUALLY" in automation_yaml
    assert "pc_piston_id: a3f8c2d1" in automation_yaml
    assert "pc_version: 0.9" in automation_yaml
    assert "pc_hash:" in automation_yaml
    assert "pc_globals_used: (none)" in script_yaml
    print("✓ File headers correct")

    # --- Check script contents ---
    for expected in EXPECTED_SCRIPT_CONTAINS:
        assert expected in script_yaml, f"Missing in script: {expected!r}"
    print("✓ Script file structure correct")

    # --- Check continue_on_error ---
    # Count occurrences — should be on both service calls
    assert script_yaml.count("continue_on_error: true") == 2, \
        f"Expected 2 continue_on_error: true, got {script_yaml.count('continue_on_error: true')}"
    print("✓ continue_on_error: true on both service calls")

    # --- Check past-time warning was emitted ---
    assert len(warnings) == 1, f"Expected 1 warning (past-time), got {len(warnings)}"
    assert "23:00:00" in warnings[0].message
    print("✓ Past-time CompilerWarning emitted for wait until")

    # --- Print outputs ---
    print("\n--- AUTOMATION YAML ---")
    print(automation_yaml)
    print("\n--- SCRIPT YAML ---")
    print(script_yaml)
    print("\n--- WARNINGS ---")
    for w in warnings:
        print(f"  ⚠  {w.message}")

    print("\n" + "=" * 60)
    print("ALL CHECKS PASSED ✓")
    print("=" * 60)


if __name__ == "__main__":
    run_test()
