
add the relivant parts of this as not optional in next sesion propmts at the start and end of the prompt:
For next session I'd suggest a different approach to the notes review. Instead of me giving you a summary, we go through the notes file section by section and for each item ask three questions:

Is this captured in a spec doc with enough detail that Claude could implement it correctly without asking?
Is this a decision that still needs to be made?
Is this already handled in the code?


Add to CLAUDE_SESSION_PROMPT.md — Project Context section, after Core Mission:
Jeremy is a Hubitat user first. HA is a backup/bridge, not a migration target. PistonCore exists so his pistons can run in HA if Hubitat ever has serious problems, and because he likes HA's local voice pipeline.
V1 bar is "most real pistons work correctly" — not "perfect parity with every WebCoRE edge case." Complex pistons that don't migrate perfectly are acceptable. Don't over-engineer for rare cases.
PyScript for complex pistons is locked for V1. No debate, don't relitigate it.
The four sample pistons (Low Battery, Door Chime, CO Alert, Water Leak) are the real V1 test. If those work, V1 is meaningful.
HA has real limitations compared to Hubitat. That's known and accepted. Document them, work around them where possible, warn users clearly where not. Don't pretend HA can do things it can't.

Match WebCoRE exactly for all dialog flow, field behavior, and data collection — the if/condition/action/task dialogs, the operand picker, the device selector, all of it.
PistonCore improvements are fine for the main screen layout, the debug/log screen, and globals being accessible from anywhere. Those aren't regressions from WebCoRE, they're upgrades.
I'll capture that as a note at the top of WIZARD_REBUILD_SPEC.md when W-0 runs so it's clear what's a target match and what's intentionally different. That way future sessions don't accidentally "fix" something that was deliberately changed