<!--
  PASTE THIS BLOCK AT THE VERY TOP OF BOTH:
    - COMPILER_SPEC.md
    - PYSCRIPT_COMPILER_SPEC.md
  (immediately under the H1 title, before the version line)
-->

> # ⚠ INTENTIONALLY STALE — DO NOT TREAT AS AUTHORITATIVE
>
> **This compiler spec is frozen on purpose until the piston JSON structure is final.**
>
> The piston JSON format is still stabilizing (Session 69b: device_map fully retired,
> top-level trigger/condition/restriction arrays confirmed, variable field names
> corrected to `var_type`/`initial_value`, logic_version 1 abandoned and all pistons
> regenerated fresh as v2). Updating this compiler spec in parallel with every JSON
> change has produced false confidence and wasted session time.
>
> **Until the JSON structure is locked, this document is directionally correct only.**
> The authoritative sources for the current data model are:
> - **PISTON_FORMAT.md** — wrapper, node schemas, field names, the Data Preservation Invariant
> - **STATEMENT_TYPES.md** — per-statement JSON schemas
> - **REFERENCE_PISTON_V2.json** — a known-good v2 piston covering every device-backed node type
>
> **One rule from this document IS current and load-bearing:** the compiler never resolves
> device tokens or friendly names. The wizard resolves devices to real HA entity IDs at
> selection time and writes them onto every node (`entity_ids`). The compiler reads
> `entity_ids` directly and never performs a role lookup, a variable lookup, or any
> name→entity resolution. Do not add resolution logic to the compiler.
>
> A dedicated session (B-1 / D-S6) will rewrite this document in full against the final
> JSON structure. Do not update compiler output examples here before then — fixing them
> piecemeal against a moving format is what this freeze exists to stop.
>
> ---
