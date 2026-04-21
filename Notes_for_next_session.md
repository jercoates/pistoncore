feedback from design claude:
What changed — the big picture
Session 7 was a genuine architecture pivot. The design went from YAML/PyScript → Native HA Script/PyScript. This simplified almost everything downstream. The notes file correctly identifies this as the root cause of most prior complexity.

The five key documents are now internally consistent with each other on the new architecture. That's a significant achievement — five spec documents staying in sync is hard.

What the three permanent questions find now
What technical assumptions are most likely to be wrong?

Native script variables: scope inside loops — COMPILER_SPEC.md Section 8.9 documents this honestly and says the compiler emits a warning. But the notes file's proposed Jinja2 namespace pattern solution is not actually in the COMPILER_SPEC yet — it says "compiler tracks this and warns" but doesn't say how it fixes it. A developer will need to know the actual pattern before writing the compiler.

wait until [time] waits until tomorrow if time has passed — COMPILER_SPEC.md Section 8.2 documents this correctly and says to show a UI tooltip. But wait_for_trigger with a time trigger does wait until tomorrow — this is actually correct HA behavior and worth verifying hasn't changed in recent HA versions.

Script entity ID format is script.pistoncore_<slug> — Section 4 of COMPILER_SPEC confirms this. However, the !include_dir_merge_named pattern requires the YAML key inside the file to match the script entity ID suffix. COMPILER_SPEC Section 7.1 shows the key as pistoncore_<slug>: which becomes script.pistoncore_<slug> — this is correct but fragile. If the key has any capitalization or special character the entity ID breaks silently. The slugify function in Section 4 handles this, but needs to be tested against edge cases.

System variables are PyScript-only — WIZARD_SPEC says $currentEventDevice, $device, etc. are PyScript-only. This is documented but feels like a significant limitation that users will hit quickly. Worth noting that HA triggers do expose some context data in native scripts via trigger variables — this might partially cover the gap, but it's not equivalent.

What features cannot work the way they are described?

Test button label discrepancy — DESIGN.md Section 7 and the status page mock show [▶ Test — Live Fire ⚠] for both compile targets. But FRONTEND_SPEC Page 2 still shows [▶ Test — Preview Mode] for YAML pistons with the old dry-run language. This is a direct contradiction between DESIGN.md v0.9 and FRONTEND_SPEC v0.2. The FRONTEND_SPEC was not fully updated to match — it still has the old two-mode test button. DESIGN.md is correct: both targets are live fire.

Devices variable in for_each — COMPILER_SPEC Section 8.7 says when collection_role resolves to a Devices variable it compiles to state_attr('group.smoke_detectors', 'entity_id'). But the open items list (Section 18, item 4) says the Devices variable storage format is not yet confirmed. If Devices globals aren't stored as HA groups, this compile output is wrong. This is flagged as an open item but it blocks the for_each compiler.

make a web request in WIZARD_SPEC system commands — listed as PyScript only. But native HA scripts can call rest_command or use notify.rest for HTTP requests. This may not actually need to be PyScript-only — worth checking before locking it in.

What has been left undefined that will block a developer?

Jinja2 namespace pattern for loop variable scope — COMPILER_SPEC acknowledges the problem and says it emits a warning, but never defines the actual solution. If a developer encounters a piston with a variable set inside a loop and read outside, what exactly does the compiler emit? The warning is defined, the fix is not. This is a real gap.

Devices variable storage format — COMPILER_SPEC open item 4, flagged in the notes. Blocks for_each compilation for Devices globals. No resolution path defined.

configuration.yaml addition for scripts — COMPILER_SPEC Section 2 and DESIGN.md Section 16 say the companion adds script pistoncore: !include_dir_merge_named scripts/pistoncore/. But DESIGN.md Section 17.5 companion setup section describes the confirmation screen without listing this specific line. A developer reading the companion setup section would miss it. The exact line should be in the confirmation screen list.

settings / end settings block — still undefined. Listed as an open item in COMPILER_SPEC Section 18 and DESIGN.md Section 26 (which DESIGN.md truncated before I could read, but the session prompt references it). A developer building the document renderer will encounter it and have nothing to render.

PyScript compiler — the session prompt lists it as open item 6. Nothing designed. Only relevant for break, cancel_pending_tasks, on_event — rare, but a developer hitting one of those statement types has nowhere to go.

Companion helper manifest storage — DESIGN.md Section 4.1 says the companion maintains a manifest of all PistonCore-managed helpers. Section 17.5 says it's stored in "the companion's own HA storage." Where exactly? What format? What happens if it's lost? A developer building the companion boot-time integrity check needs this defined.

One consistency issue to flag
FRONTEND_SPEC v0.2 still has some v0.1 language in the status page test button description — specifically the [▶ Test — Preview Mode] label in the mock layout diagram. DESIGN.md v0.9 is clear that both targets are live fire with no preview mode. The mock in FRONTEND_SPEC needs one more pass to remove the old YAML-preview language. Everything else is consistent.

The repo is in substantially better shape than the last verification. The architecture pivot landed cleanly in the specs. The remaining gaps are specific and finite.