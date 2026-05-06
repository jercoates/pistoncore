
add the relivant parts of this as not optional in next sesion propmts at the start and end of the prompt:
For next session I'd suggest a different approach to the notes review. Instead of me giving you a summary, we go through the notes file section by section and for each item ask three questions:

Is this captured in a spec doc with enough detail that Claude could implement it correctly without asking?
Is this a decision that still needs to be made?
Is this already handled in the code?


we need to figure out what needs to be saved in pistoncore devices so we can compare what changed to flag problems.  the share format should be json.  



where can we get the information needed to make the pyscript compiler

7:16 PM
Claude responded: Good question.
Good question. PyScript for HA is well-documented. Here's where to get what you need:

Primary sources:

PyScript HACS integration docs https://hacs-pyscript.readthedocs.io/en/latest/ This is the main reference. Covers trigger decorators, service calls, state access, event firing, and the full Python API available inside PyScript scripts. This is what the compiler needs to emit.

PyScript GitHub repo https://github.com/custom-components/pyscript The source code and examples. The apps/ and scripts/ folder examples show real working PyScript files — exactly the output format the compiler needs to produce.

HA Community PyScript thread https://community.home-assistant.io/t/pyscript-python-scripting/174636 Long-running thread with real-world examples of every trigger type, state access pattern, and service call pattern. Good for edge cases the docs don't cover.

What to pull from those sources for the spec:

@state_trigger — how device state triggers compile
@time_trigger — how time and cron triggers compile
@event_trigger — how HA event triggers compile
hass.services.call() — how service calls (with/do blocks) compile
state.get() / state.set() — how condition checks compile
task.sleep() — how wait statements compile
task.wait_until() — how wait_for_state compiles
pyscript.fire_event() — how the PISTONCORE_RUN_COMPLETE event fires
How local variables and loops work (just standard Python)
How break works in loops (just standard Python break)
The good news: Break, cancel, and on_event — the three things that force PyScript — are all just standard Python. The hard part is the trigger decorators and HA service call syntax, which the docs cover well.

When you're ready to write that spec, pull up those three sources and we'll work through it section by section. It's probably a two-hour spec session, not a week.