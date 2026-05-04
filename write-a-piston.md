# PistonCore — Write a Piston Prompt

You are helping a user build a piston for PistonCore, a WebCoRE-style automation builder for Home Assistant.

**You are generating the AI import format** — a small JSON wrapper plus `piston_text`. The `piston_text` is plain text exactly as it appears in the PistonCore editor. No compiled values, no entity IDs, no HA-native syntax anywhere.

When the user imports this JSON into PistonCore, the AI Import dialog will walk them through mapping each `{role}` in curly braces to a real device from their Home Assistant. PistonCore then builds the internal structured format automatically. You never need to produce the internal format — just produce this import format and let PistonCore handle the rest.

---

## Strict Formatting Rules — Follow Exactly

| Value type | Correct format | Never use |
|---|---|---|
| Time | "8:00 AM" / "11:30 PM" | "08:00" / "8AM" / "20:00" |
| Duration | "5 minutes" / "1 hour" / "30 seconds" | "5m" / "300s" |
| Sun offset | "$sunrise + 30 minutes" | "sunrise+30" / "+30min" |
| Lux | "800 lux" | "800" / "800lx" |
| Percentage | "75%" | "0.75" / "75 percent" |
| Temperature | "40°F" / "22°C" | "40" / "40 degrees" |
| Binary state | "Detected" / "Clear" / "Open" / "Closed" | "on" / "off" / "true" |
| Service | "Turn on" / "Turn off" / "Speak text" | "light.turn_on" / "turn_on" |

---

## Output Format

```json
{
  "id": "8-char-hex-uuid",
  "name": "Piston Name",
  "compile_target": "native_script or pyscript",
  "device_map": {},
  "piston_text": "...full piston text..."
}
```

**compile_target:** Use `"pyscript"` if the piston uses `$currentEventDevice`, `break`, `cancel_pending_tasks`, or `on_event`. Otherwise use `"native_script"`.

**device_map:** Always `{}` — the user maps their real devices after import.

---

## piston_text Format

The `piston_text` is exactly what the PistonCore editor displays. It follows WebCoRE's text format.

### Header Block (always first)

```
/********************************************************/
/* Piston Name                                          */
/********************************************************/
/* Author   :                                           */
/* id       : [uuid]                                    */
/* mode     : single                                    */
/********************************************************/
```

**mode options:** `single` / `restart` / `queued` / `parallel`

### define Block

```
define
  device light = {Chicken Light};
  device motion_sensor = {Motion Sensor};
  string Message;
  device @Announcement_Sonos = {@Announcement Sonos};
end define;
```

* Roles shown in `{curly braces}` — user maps to real devices on import
* Global variables use `@` prefix
* Local piston variables use plain names for device type, or type keyword for others
* Variable types: `device`, `string`, `number`, `boolean`, `datetime`

### execute Block

```
execute
  [statements]
end execute;
```

---

## Statement Types

### if / then / else

```
if
  [condition]
then
  [statements]
else
  [statements]
end if;
```

### Conditions

```
Any of {Doors}'s contact changes to Open
Any of {lumen_sensor}'s illuminance is less than 800 lux
Time is between 8:00 AM and $sunrise + 30 minutes
Time is between 8:00 PM and 8:00 AM, but only on Mondays, Tuesdays, Wednesdays, Thursdays, or Fridays
{motion_sensor}'s motion is Detected
```

Multiple conditions:
```
  Any of {Doors}'s contact changes to Open
  or Any of {Windows}'s contact changes to Open
```
```
  Time is between 6:00 AM and $sunrise + 30 minutes
  and Any of {lumen_sensor}'s illuminance is less than 800 lux
```

### with / do / end with

```
with {light}
do
  Turn on;
end with;
```

```
with {@Announcement_Sonos}
do
  Set Volume to 70%;
  Speak text "{Message}";
end with;
```

### Set variable

```
do Set variable {Message} = {""};
do Set variable {Message} = {"$currentEventDevice Opened"};
do Set variable {count} = {0};
```

### Wait

```
do Wait 5 minutes;
do Wait until 11:00 PM;
```

### Log

```
do Log message {"Piston ran successfully"};
```

### Stop

```
do Stop;
```

### Repeat / For Each

```
repeat
  [statements]
until
  [condition]
end repeat;
```

```
for each {$device} in {@SmokeDetectors}
do
  [statements]
end for;
```

---

## Triggers

Triggers appear as conditions in the first `if` block with a ⚡ indicator in the display. In `piston_text` they look like conditions — the compiler identifies them by position (first if block) and operator type.

```
if
  Any of {Doors}'s or {Windows}'s contact changes to Open
then
```

```
if
  Time happens daily at 8:00 AM
then
```

```
if
  Any of {lumen_sensor}'s illuminance drops below 800 lux
then
```

```
if
  Time is between $sunset + 30 minutes and 8:00 PM
  and Any of {lumen_sensor}'s illuminance is less than 800 lux
then
```

---

## Global Variables

Global device variables use `@` prefix throughout:

In define block:
```
device @Announcement_Sonos = {@Announcement Sonos};
device @Smoke_Detectors = {@Smoke Detectors};
```

In conditions and actions:
```
Any of {@Smoke_Detectors}'s smoke is Detected
with {@Announcement_Sonos}
```

Non-device globals (string, number, boolean) are referenced by name with `@`:
```
do Set variable {@BatteryStatus} = {"Low"};
```

---

## System Variables

Use exactly as shown — compiler resolves them:

| Variable | Meaning |
|---|---|
| `$sunrise` | Today's sunrise time |
| `$sunset` | Today's sunset time |
| `$now` | Current date and time |
| `$currentEventDevice` | Device that triggered this run (PyScript only) |
| `$device` | Same as $currentEventDevice |
| `$index` | Loop counter |
| `$hour` | Current hour (0-23) |
| `$minute` | Current minute |

With offset: `$sunrise + 30 minutes` / `$sunset - 1 hour`

---

## Complete Example — Chicken Lights Lumen Sensor

```json
{
  "id": "c7a3f1b2",
  "name": "Chicken Lights Lumen Sensor",
  "compile_target": "native_script",
  "device_map": {},
  "piston_text": "/********************************************************/\n/* Chicken Lights Lumen Sensor                          */\n/********************************************************/\n/* Author   :                                           */\n/* id       : c7a3f1b2                                  */\n/* mode     : restart                                   */\n/********************************************************/\n\ndefine\n  device light = {Chicken Light};\n  device lumen_sensor = {Lumen Sensor};\nend define;\n\nexecute\n  if\n    Time is between 6:00 AM and $sunrise + 30 minutes\n    and Any of {lumen_sensor}'s illuminance is less than 800 lux\n  then\n    with {light}\n    do\n      Turn on;\n    end with;\n  else\n    with {light}\n    do\n      Turn off;\n    end with;\n  end if;\n  if\n    Time is between $sunset + 30 minutes and 8:00 PM\n    and Any of {lumen_sensor}'s illuminance is less than 800 lux\n  then\n    with {light}\n    do\n      Turn on;\n    end with;\n  else\n    with {light}\n    do\n      Turn off;\n    end with;\n  end if;\n  if\n    Time is 8:00 AM\n  then\n    with {light}\n    do\n      Turn off;\n    end with;\n  end if;\n  if\n    Time is 9:00 PM\n  then\n    with {light}\n    do\n      Turn off;\n    end with;\n  end if;\nend execute;"
}
```

---

## What to Tell the User After Generating

1. Copy the JSON above
2. In PistonCore, click **Import** on the main menu
3. Choose **AI Import** and paste the JSON
4. PistonCore will walk you through mapping each role `{in curly braces}` to a real device from your Home Assistant
5. Save and deploy

State any assumptions you made so the user knows what to verify.
