# PistonCore — Test Strategy

**Version:** 1.0
**Status:** Authoritative
**Last Updated:** May 2026 (Session 60 — written from MISSING_SPECS Item 6)

---

## Manual vs Automated

v1 has no automated test suite. All testing is manual.

Post v1 smoke test: add automated compiler unit tests — one per statement type,
following the hand-verification pattern in COMPILER_SPEC.md Section 18.

---

## Round-Trip Test Cases

Use the three pistons in SAMPLE_PISTONS.md plus the four production candidates
described in MISSING_SPECS.md Item 11. Together they cover every statement type,
every compiler pattern, and every PyScript-forcing condition.

**Test procedure for each piston:**
1. Open PistonCore. Import the piston JSON.
2. Open in editor — verify all statements render correctly (no Unknown statement rows).
3. Click Deploy to HA. Verify success.
4. Trigger the piston manually (Test button). Verify the log shows the expected sequence.
5. Check HA developer tools — verify the compiled YAML matches the expected output
   from COMPILER_SPEC.md Section 18.

---

## HA Version Matrix

Test against current HA stable and one version back before v1 release.
Log which HA version was tested against in the release notes.

Minimum HA version for PistonCore: currently 2023.1 — consider raising to 2025.3
before v1 to avoid the variable scoping bug. See HA_LIMITATIONS.md.

---

## Known Edge Cases to Verify

From HA_LIMITATIONS.md — these must be explicitly tested, not assumed:

- **Boolean value quoting** — verify `on`/`off` are always quoted in compiled output.
  HA silently parses unquoted `on`/`off` as booleans causing state checks to silently fail.
- **Multi-entity triggers** — verify one trigger block (not expanded) in compiled YAML.
- **Midnight-crossing time conditions** — verify the OR expansion in compiled YAML.
- **PyScript on_event blocking behavior** — include a warning in test notes.
- **Variable scoping in loops** — verify that variables mutated inside a `repeat` or
  `for_each` body correctly update the outer scope (requires HA 2025.3+).

---

## "Done" Definition Per Stage

| Stage | Done When |
|---|---|
| D-S4 | All spec files updated, no items in MISSING_SPECS without a resolution plan |
| W-S8 | All wizard flows produce correct JSON per PISTON_FORMAT.md v2.1 on commit |
| B-1 | compiler.py reads entity_ids directly, emits MISSING_ENTITY on missing entities |
| S3-1 | Piston 1 from SAMPLE_PISTONS.md round-trips: wizard → JSON → compile → deploy → trigger → log |
| S3-2 | All four production sample pistons pass the round-trip test |
| v1 ship | All above plus HA version matrix check |
