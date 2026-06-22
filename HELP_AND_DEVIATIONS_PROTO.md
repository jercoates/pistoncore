# PistonCore — Help & Deviations (Proto)

**Purpose of this file (one document, both sides):**
1. **Deviations** — every place PistonCore intentionally differs from WebCoRE, with the WebCoRE behavior it overrides and the workaround. Stops deliberate cuts from being "fixed" back to WebCoRE by a future session or AI.
2. **Help ideas / best practices** — user-facing guidance to push good habits (defines, globals, naming). Captured now so they're locked before forgotten; polished into real help files later.
3. **Technical containment** — the real mechanics behind each item, so the actual help files AND the AI prompt files can be written from THIS document without re-deriving anything.

**How entries are structured:** each entry can carry up to three layers —
- `DEVIATION` (what changed vs WebCoRE + workaround), and/or
- `HELP IDEA` (the user-facing point to make), and/or
- `TECH` (the mechanics, for whoever writes the help/prompt files).

**Status tags:** `[LOCKED]` decided, `[IDEA]` capture-only not yet decided, `[DRAFT]` being shaped.

**AI prompt note:** entries tagged `→ AI PROMPT` should also seed the AI help-prompt files. The AI prompt serves double duty: (a) a memory prompt reminding Jeremy this guidance exists and should be surfaced to users, and (b) technical containment so the assistant has the mechanics on hand when generating help.

---

## PART A — DEVIATIONS FROM WEBCORE

### D-1 — Action command menu is intersection-only (no partial group) `[LOCKED]`

**DEVIATION**
PistonCore's action command menu shows a command ONLY if every selected device supports it. If any selected device cannot do a command, that command does not appear.

**WebCoRE behavior overridden**
WebCoRE (WIZARD_MAP Part 30) splits commands into **Common** (all selected devices) and **Partial** (only some). Partial commands appear in a separate group and apply only to the devices that support them. PistonCore does NOT implement the partial group.

**Workaround (this is also a HELP IDEA — see H-?)**
To act on a subset, split the devices into separate device variables/defines — one per capability group. Each variable's intersection then exposes the commands its members share. Example: 6 downstairs lights, 4 dimmable + 2 on/off-only → make one define for the 4 dimmable (exposes set level) and one for all 6 (on/off only).

**TECH**
- Command list is derived from **capabilities**, not from `getServices`. (getServices returns HA's collapsed services — `light.turn_on` carries brightness as an optional field, which makes "supports brightness" invisible at the service level and breaks the intersection.)
- Existing intersect logic in `wizard-action.js` (`intersectedNames`) already deletes any command not supported by all selected devices — that IS the intersection-only rule. The change is pointing it at capability-derived commands instead of services.
- Picker firewall untouched: device cross (`_groupDevices`, `_getGroupedEntityIdsForTokens`) stays frozen; this is the capability-read/command-derivation layer AFTER it, same position as `_loadCapsIntoSelect` is for conditions.

**Why this is fine for Jeremy's use:** never hit the partial case when writing real pistons — acted on single devices or pre-grouped same-capability devices. The two-variable workaround matches how he already thinks about device groups.

→ AI PROMPT: when a user selects mixed-capability devices and a command seems "missing," explain intersection-only and suggest splitting into capability-grouped defines.

---

### D-2 — (reserved) Aggregation bar Any/All/None only `[LOCKED]`
Precedent deviation worth recording here for consistency. WebCoRE aggregation bar = 12 options; PistonCore v1 implements Any / All / None only.
*(Expand later — pulled from project history, confirm exact wording before writing help.)*

---

## PART B — HELP IDEAS / BEST PRACTICES

### H-1 — Push "defines" for devices `[IDEA]`

**HELP IDEA**
Encourage users to use defines (device variables) for devices rather than picking raw devices each time. Reasons to give the user:
- Easier maintenance — change the device in one place, every piston using the define updates.
- Pistons become readable — the define name says what the device IS.
- Enables the D-1 workaround naturally (capability-grouped defines).

**TECH**
*(to fill: how defines resolve at commit time — friendly name stored, entity_ids resolved on the node; the maintenance benefit is real because the define is the single resolution point.)*

→ AI PROMPT: nudge toward defines whenever a user hand-picks the same device across multiple pistons.

---

### H-2 — Good reasons to use globals `[IDEA]`

**HELP IDEA**
Give genuinely good reasons to use globals (not just "you can"):
*(to fill: shared state across pistons, single source of truth for things like notification targets, change-once-affect-all.)*

**TECH**
*(to fill: how globals store/resolve; device globals store entity_ids; stale/redeploy audit flow when a global changes after save.)*

---

### H-3 — Naming conventions: defines describe what the device IS `[IDEA]`

**HELP IDEA**
Push define names that describe the device's role/nature, not its location or model. The name should tell you what it does at a glance.

---

### H-4 — Suggested global naming patterns `[IDEA]`

**HELP IDEA**
Give concrete, copyable global-name suggestions so users start with good habits:
- `@push` — push notification target(s)
- `@door_sensors` — contact sensors on doors
- *(add more: `@lights_all`, `@locks`, `@alarm`, etc. — build the list)*

**TECH**
The `@name` token is the global reference resolved at commit/compile time.

→ AI PROMPT: when a user creates a global, offer a naming suggestion from this pattern list.

---

### H-5 — How to use the AI prompt (meta) `[IDEA]`

**HELP IDEA / TECH**
Document how the AI prompt files work so the AI help system is itself explained. The AI prompt serves two roles:
1. **Memory prompt** — reminds Jeremy to add/surface a given piece of guidance.
2. **Technical containment** — holds the mechanics so the assistant can write accurate help files and answer user questions without re-deriving.

*(to fill: where AI prompt files live — backend-managed location, served via API, separate from user help files; how an entry here flows into an AI prompt file.)*

---

## CAPTURE ZONE (dump ideas here, sort later)

*Raw ideas go here the moment you think of them — don't stop to structure. Move into A/B above when ready.*

-
-
-
