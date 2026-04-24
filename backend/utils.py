"""
PistonCore Compiler Utilities
Slug generation, offset formatting, delay formatting.
All logic matches COMPILER_SPEC Sections 4 and 8.2.
"""

import re
from .exceptions import CompilerWarning


def slugify(name: str, existing_slugs: set = None, piston_id: str = None) -> tuple[str, list]:
    """
    Convert a piston name to a slug suitable for filenames and HA entity IDs.
    Returns (slug, warnings).

    Slug rules (COMPILER_SPEC Section 4):
    - Lowercase
    - Spaces and hyphens → underscores
    - All non-alphanumeric/underscore chars stripped
    - Leading/trailing underscores stripped
    - Max 50 characters
    - Collision: append first 4 chars of piston_id

    existing_slugs: set of slugs already in use (optional, for collision detection)
    piston_id: the piston's UUID (optional, needed only for collision resolution)
    """
    warnings = []

    s = name.lower()
    s = s.replace(" ", "_").replace("-", "_")
    s = re.sub(r"[^a-z0-9_]", "", s)
    s = s.strip("_")
    s = s[:50]

    if existing_slugs and s in existing_slugs:
        if not piston_id:
            raise ValueError("piston_id is required for slug collision resolution")
        suffix = piston_id[:4]
        s = f"{s}_{suffix}"[:50]
        warnings.append(CompilerWarning(
            f"Piston name '{name}' produces the same slug as another piston. "
            f"Appended piston ID prefix to disambiguate: '{s}'."
        ))

    return s, warnings


def format_offset(minutes: int) -> str:
    """
    Convert an offset in minutes to HA sun trigger offset string.
    COMPILER_SPEC Section 6.3 — Sun trigger.

    0   → "00:00:00"
    30  → "+00:30:00"
    -15 → "-00:15:00"
    """
    if minutes == 0:
        return "00:00:00"
    sign = "+" if minutes > 0 else "-"
    m = abs(minutes)
    h, rem = divmod(m, 60)
    return f"{sign}{h:02d}:{rem:02d}:00"


def format_delay(seconds: int) -> str:
    """
    Convert a duration in seconds to the most readable HA delay YAML fragment.
    COMPILER_SPEC Section 8.2 — wait (fixed duration).

    < 60       → "seconds: N"
    60–3599    → "minutes: N"
    3600+      → "hours: H" or "hours: H\n    minutes: M"
    """
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
