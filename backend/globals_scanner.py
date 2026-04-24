"""
PistonCore Global Variable Scanner
Walks the entire piston JSON and collects names of every global variable (@varname)
referenced anywhere — triggers, conditions, or actions.
COMPILER_SPEC Section 5.
"""

import json


def scan_globals(piston: dict) -> list[str]:
    """
    Walk the piston JSON and return a sorted list of unique global variable names
    referenced anywhere in the piston (triggers, conditions, actions, nested bodies).
    Global variables use the '@' prefix in piston JSON.
    """
    found = set()
    _walk(piston, found)
    return sorted(found)


def _walk(obj, found: set):
    """Recursively walk any JSON-compatible structure looking for @-prefixed variable references."""
    if isinstance(obj, dict):
        for key, value in obj.items():
            if key in ("variable_name",) and isinstance(value, str) and value.startswith("@"):
                found.add(value)
            # Also scan inside string values for template-embedded globals
            if isinstance(value, str):
                _scan_string(value, found)
            else:
                _walk(value, found)
    elif isinstance(obj, list):
        for item in obj:
            _walk(item, found)
    elif isinstance(obj, str):
        _scan_string(obj, found)


def _scan_string(s: str, found: set):
    """
    Scan a string for @-prefixed variable references.
    Handles cases like "@temp_sensor" or "{{ @brightness > 75 }}" in expressions.
    """
    import re
    # Match @word_characters (global variable names)
    for match in re.finditer(r'@([a-zA-Z_][a-zA-Z0-9_]*)', s):
        found.add(f"@{match.group(1)}")
