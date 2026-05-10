# SESSION_34_HANDOFF.md

**Session:** 34
**Created:** End of session — process at start of Session 35 before any task work
**Action:** Review items below, add anything not already tracked to TASKS.md, then move this file to reference/

---

## Grok Repo Audit — Items To Check Against TASKS.md

Grok reviewed the live repo (github.com/jercoates/pistoncore) at end of Session 34.
Most findings are already tracked. Two are potentially new:

### 1. _setup_ha_config() — No Atomic Write on configuration.yaml Append
**What Grok found:** `_setup_ha_config()` appends to `configuration.yaml` without
an atomic write (tempfile + replace). A failure mid-append could corrupt the file.
**Check:** Is this already in TASKS.md? It may be covered by the "add backup" comment
added in S1-5, but there may be no actual task entry for the atomic write fix.
**If not tracked:** Add to S4-15 (Operational Hardening) or as a standalone gap.
Grok's fix: write to a tempfile first, then replace — standard atomic write pattern.

### 2. UUID Truncated to 8 Chars in storage.py save_piston
**What Grok found:** Piston IDs are truncated to 8 hex chars. Flags low collision
risk and says "document it."
**Check:** PISTON_FORMAT.md already defines 8-char hex IDs as the spec — this is
intentional, not an oversight. Verify PISTON_FORMAT.md makes this explicit enough
that future reviewers don't flag it again. If not explicit enough, add one sentence.

### Already Tracked — No Action Needed
These Grok findings are already in TASKS.md and do not need new entries:
- CORS permissive — acceptable for local tool, documented
- API key optional / token plaintext — Gap F, S4-15
- _setup_ha_config() errors not surfaced to UI — GAP-S31-2
- ha_client.py thread pool fragility — Bug 26, S2-1
- Module-level cache breaks with multiple workers — Gap C, S4-15
- _scan_globals regex false-positive risk — Gap G, S4-15
- No tests — GAP-S28-4, blocked until S3-1
- Stubbed frontend API methods — expected WIP
- WebSocket reconnect mismatch — tracked
- docker-entrypoint.sh reliability — Gap D, S4-15
- No .dockerignore — Gap B, Minor/Cosmetic

---

## Grok Template System Audit — Items To Check Against TASKS.md

Grok reviewed the Jinja2 template system specifically. Most findings are already
handled. A few are worth adding to TASKS.md.

### Already Done — No Action Needed
- trim_blocks=True and lstrip_blocks=True — already in compiler.py Jinja Environment
- action: vs service: key — fixed in S1-8 template compliance pass
- Graceful failure on missing snippets — confirmed working
- AI-UPDATE-GUIDE.md maintained — updated Session 33/34

### New Items To Add To TASKS.md

**1. Whitespace control in snippets — add {%- ... -%} stripping**
Grok recommends explicit whitespace stripping in all snippet templates as a
complement to trim_blocks/lstrip_blocks. Makes deeply nested output more
reliable. Low priority — current approach works for most cases, and deeply
nested pistons will likely be PyScript-bound anyway.
Fits in: S4-15 (Operational Hardening) or a dedicated template cleanup pass.

**2. template_info.json metadata file**
Add a template_info.json to each template set with ha_min_version, last_updated,
and compatible_pistoncore_version. Fits naturally with the versioned template
folder structure already in DESIGN.md Section 14.
Fits in: S4-4 (Compiler Template System) — include when versioned folders are built.

**3. CLI test command — compile sample piston + validate with ruamel.yaml**
A command that compiles the test piston JSON and validates output is parseable
YAML. Tied to GAP-S28-4 (6 test pistons) — same prereq, same session.
Fits in: After S3-1 passes, alongside GAP-S28-4.
---


---

## Grok editor.js + wizard.js Flat Model Review — Items For TASKS.md

Grok reviewed editor.js and wizard.js specifically for flat statements array bugs.
Several real bugs found that will surface during S3-1 round-trip testing.
All fit into S3-1 — editor.js will be open and these are exactly the kind of
issues that produce "works until I do X then breaks confusingly" failures.

### Already Tracked — No Action Needed
- _blockId hack for if conditions (Bugs A, B, C) — tracked since Session 25 handoff
- Wizard skeleton objects correct structure — confirmed S1-2a
- _newId() ID generation — addressed S1-2b

### New Items To Add To TASKS.md (all fit S3-1)

**1. _insertAfter() returns early after first match — silent orphan bug**
If the target ID is not found in any parent child list, the new node is added
to the flat array but nothing references it — orphaned silently. The return
statement should not exit early; it should continue scanning all parents.
Fits in: S3-1 — fix editor.js when round-trip testing starts.

**2. _removeNode() leaves ghost references**
After removal, orphaned child IDs may still exist in parent child lists.
Renderer skips them silently (if (!node) return) but they survive save/load
and corrupt the JSON over time.
Fits in: S3-1 — fix editor.js when round-trip testing starts.

**3. tasks included in childKeys of _removeNode/_insertAfter**
Tasks are embedded objects inside action nodes, not flat IDs. Including 'tasks'
in the childKeys traversal of _removeNode and _insertAfter could corrupt task
arrays if any ID overlap occurs.
Fits in: S3-1 — fix editor.js when round-trip testing starts.

**4. No uniqueness check on ID generation**
Current ID generation uses Math.random() with no check against existing IDs.
Collision probability is low but non-zero, especially with future paste/duplicate.
Fix: wrap in a do/while that checks piston.statements for duplicates before returning.
Fits in: S3-1 — small fix, same file scope.

**5. No normalizePiston() on load**
No validation pass on load means orphaned references, missing IDs, and duplicate
IDs all pass through silently. A normalizePiston() function that strips orphaned
references and flags missing IDs would catch corrupted pistons early.
Fits in: S3-1 or S4-5 (Pre-Save Validation Pipeline) — decide at S3-1.

---

## Grok ha_client.py WebSocket Reliability Review — Items For TASKS.md

Grok reviewed ha_client.py for WebSocket reliability and reconnection edge cases.
Several real issues found. Most fit S2-1 which already has ha_client.py in scope.

### Already Tracked — No Action Needed
- ThreadPoolExecutor fragility — Bug 26, S2-1
- _run() sync bridge fragility — Bug 26, S2-1
- Module-level cache breaks with multiple workers — Gap C, S4-15

### New Items To Add To TASKS.md

**1. No retry logic on _ws_call — single failure is a hard user error**
Any transient issue (HA restart, network blip, Supervisor hiccup) produces an
immediate hard HAClientError with no retry. Fix: wrap _ws_call with exponential
backoff retry (3 attempts, 1s/2s/4s delays). Grok's pattern is correct.
Fits in: S2-1 — ha_client.py is already open for Bug 26 / _run() fix.

**2. Exception catching too narrow**
ConnectionResetError, ssl.SSLError, and JSON decode failures can leak through
current exception handling. No distinction between bad token vs HA restarting
vs network issue — all become generic HAClientError which gives the user no
actionable information.
Fits in: S2-1 — same file, same session.

**3. /api/ha/status health endpoint missing**
No way for the frontend to know if HA is reachable, reconnecting, or auth-failed.
Users see silent failures instead of "Reconnecting to Home Assistant...".
Backend: add GET /api/ha/status returning connection state and last error.
Frontend: read on load and show banner if not connected (ties to GAP-S31-2
and S4-0 error states inventory).
Fits in: S2-1 (backend endpoint), S4-0 (frontend banner).

**4. Persistent WebSocket manager — medium term**
Current short-lived connection-per-call model works in stable conditions but
is not production-grade. A singleton persistent client with reconnect loop,
jittered backoff, ping/pong keepalive, and subscription support would make
PistonCore resilient to HA restarts and network instability.
Not v1 blocking — current model works for local Docker use.
Fits in: Stage 4, own task after S4-9 (run status reporting via WebSocket).

---

## Grok Docker Security Review — Items For TASKS.md

Grok reviewed Docker deployment security — port exposure, token handling,
volume permissions. Most findings are already tracked. Five new items worth adding.
All are pre-v1 hardening, none are blocking for current development.

### Already Tracked — No Action Needed
- CORS wildcard — acceptable for local tool, documented
- API key optional / token plaintext — Gap F, S4-15
- _setup_ha_config() atomic write — in this handoff note (item 1 above)
- docker-entrypoint.sh reliability — Gap D, S4-15
- Dependency pinning — Gap C area, S4-15
- No .dockerignore — Gap B, Minor/Cosmetic

### New Items To Add To TASKS.md (all fit S4-15 unless noted)

**1. Run as non-root user in Dockerfile**
Currently runs as root — files created in volumes are root-owned on the host.
Causes permission headaches on Unraid specifically. Fix: add non-root user
(UID 1000) in Dockerfile and document recommended host chown commands.
High priority before v1 — affects every Unraid user.
Fits in: S4-15 (Operational Hardening).

**2. config.json permissions check at startup**
No check that config.json (contains HA long-lived token) is not world-readable.
Fix: add a startup warning in main.py if file permissions are too open.
Small addition, high security value.
Fits in: S4-15 or any session that touches main.py startup sequence.

**3. No HEALTHCHECK in Dockerfile/compose**
Unraid and other container managers use HEALTHCHECK for restart and monitoring.
Currently absent. Easy add — one line in Dockerfile, one block in compose.
Fits in: S4-15 (Operational Hardening).

**4. No resource limits in compose example**
No CPU/memory limits in the example docker-compose. Compile spam or a runaway
request could consume host resources. Document recommended limits in compose
comments as a minimum.
Fits in: S4-15 (Operational Hardening).

**5. Security headers middleware**
No X-Content-Type-Options, X-Frame-Options, or similar headers on API responses.
Low effort — add FastAPI middleware in main.py. Good practice before v1.
Fits in: S4-15 or any session that touches main.py.

## Processing Instructions for Session 35

1. Read CLAUDE_SESSION_PROMPT.md and TASKS.md first as always
2. Check item 1 (atomic write) against TASKS.md — add if missing
3. Check item 2 (8-char UUID) against PISTON_FORMAT.md — clarify if needed
4. Move this file to reference/ when done
5. Proceed with S2-0
