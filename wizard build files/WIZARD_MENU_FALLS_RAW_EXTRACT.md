# RAW EXTRACT — WebCoRE Menu Fall Data (staging for spec build)

**Source:** ady624/webCoRE `webcore.groovy` (preserved as webcore_source_reference.groovy).
**Purpose:** All data needed to build the three fall-tables (TRIGGER / CONDITION / ACTION) that lock the user-facing wizard menus to WebCoRE, per device type. This is captured raw so the spec-building session formats it without re-pulling source.

---

## THE FALL RULE (how menus fall as the user selects)

1. User picks a **device** → its **capabilities** determine which **attributes** and **commands** exist (Capability Map).
2. User picks an **attribute** (for trigger/condition) → the attribute's **datatype** (`t:`) determines which **operators** appear (Operator Group Match).
3. User picks an **operator** → its `p:` (param count), `t:` (timed), `m:` (multi) determine which **value/duration/interaction fields fall in**.
4. For **actions**: user picks a **command** → its `p:` array determines which **parameter fields fall in**.

### Datatype → operator-group-letter mapping (drives step 2)
Attribute `t:` value → the letter that must appear in an operator's `g:` string for it to show:
- `enum`, `color`, `hexcolor`, `object`, `vector3` → **s** (string group)
- `integer`, `decimal` → **d** and **i** (decimal/integer group)
- `boolean` → **b**
- `image` → **f** (binary file)
- `time`, `date`, `datetime` → **t**
- momentary attribute → **m**
- presence/event → **e**, piston → **v**
(Confirmed against WIZARD_MAP Part 26 + comparison g: codes.)

### Operator field-fall codes (drives step 3)
- `p: 0/1/2` → number of value fields that fall in (0=none, 1=one "compare to", 2=range "between/and")
- `t: 1` → timed "stays" style → **For...** duration field falls in
- `t: 2` → timed "was" style → **In the last...** duration field falls in
- `m: true` → multi-value (any-of) select
- trigger operators also reveal **Which interaction** (Any/Physical/Programmatic) when attribute supports it (`p: true` on attribute)

---

## LAYER 1 — CAPABILITY MAP (device → attributes + commands)
(from capabilities(); a:=attribute, c:=commands)

switch/light/bulb/outlet/relaySwitch: a:switch  c:[on,off]
switchLevel: a:level  c:[setLevel]
colorControl: a:color  c:[setColor,setHue,setSaturation]
colorTemperature: a:colorTemperature  c:[setColorTemperature]
infraredLevel: a:infraredLevel  c:[setInfraredLevel]
lock: a:lock  c:[lock,unlock]  (s:numberOfCodes i:usedCode)
lockOnly: a:lock  c:[lock]
doorControl/garageDoorControl: a:door  c:[close,open]
valve: a:valve  c:[close,open]
windowShade: a:windowShade  c:[close,open,presetPosition]
alarm: a:alarm  c:[off,strobe,siren,both]
momentary: c:[push]
tone: c:[beep]
imageCapture: a:image  c:[take]
thermostat: a:thermostatMode  c:[auto,cool,emergencyHeat,fanAuto,fanCirculate,fanOn,heat,off,setCoolingSetpoint,setHeatingSetpoint,setSchedule,setThermostatFanMode,setThermostatMode]
thermostatCoolingSetpoint: a:coolingSetpoint  c:[setCoolingSetpoint]
thermostatHeatingSetpoint: a:heatingSetpoint  c:[setHeatingSetpoint]
thermostatFanMode: a:thermostatFanMode  c:[fanAuto,fanCirculate,fanOn,setThermostatFanMode]
thermostatMode: a:thermostatMode  c:[auto,cool,emergencyHeat,heat,off,setThermostatMode]
musicPlayer: a:status  c:[mute,nextTrack,pause,play,playTrack,previousTrack,restoreTrack,resumeTrack,setLevel,setTrack,stop,unmute]
audioNotification: c:[playText,playTextAndResume,playTextAndRestore,playTrack,playTrackAndResume,playTrackAndRestore]
speechSynthesis: c:[speak]
notification: c:[deviceNotification]
mediaController: a:currentActivity  c:[startActivity,getAllActivities,getCurrentActivity]
timedSession: a:sessionStatus  c:[cancel,pause,setTimeRemaining,start,stop]
indicator: a:indicatorStatus  c:[indicatorNever,indicatorWhenOn,indicatorWhenOff]
consumable: a:consumableStatus  c:[setConsumableStatus]
configuration: c:[configure]
refresh: c:[refresh]
polling: c:[poll]

SENSOR-ONLY (no commands — condition/trigger subjects only):
accelerationSensor(a:acceleration), contactSensor(a:contact), motionSensor(a:motion),
presenceSensor(a:presence), waterSensor(a:water), smokeDetector(a:smoke),
carbonMonoxideDetector(a:carbonMonoxide), temperatureMeasurement(a:temperature),
relativeHumidityMeasurement(a:humidity), illuminanceMeasurement(a:illuminance),
battery(a:battery), powerMeter(a:power), energyMeter(a:energy), shockSensor(a:shock),
soundSensor(a:sound), tamperAlert(a:tamper), touchSensor(a:touch), button(a:button),
threeAxis(a:orientation), signalStrength(a:rssi), valve(a:valve), uvIndex(a:ultravioletIndex)

---

## LAYER 2 — ATTRIBUTE MAP (attribute → datatype/options/range/unit)
(from attributes(); t:=type o:=options r:=range u:=unit p:=interaction-capable)

ENUM attributes (→ group s; options are the value dropdown):
  switch[off,on](p:true)  contact[closed,open]  motion[active,inactive]
  presence[not present,present]  door[closed,closing,open,opening,unknown](p:true)
  lock[locked,unknown,unlocked,unlocked with timeout]  water[dry,wet]
  smoke[clear,detected,tested]  carbonMonoxide[clear,detected,tested]
  shock[clear,detected]  sound[detected,not detected]  tamper[clear,detected]
  touch[touched]  acceleration[active,inactive]  alarm[both,off,siren,strobe]
  mute[muted,unmuted]  powerSource[battery,dc,mains,unknown]  sleeping[not sleeping,sleeping]
  valve[closed,open]  windowShade[closed,closing,open,opening,partially open,unknown]
  thermostatMode[auto,cool,emergency heat,heat,off]  thermostatFanMode[auto,circulate,on]
  thermostatOperatingState[cooling,fan only,heating,idle,pending cool,pending heat,vent economizer]
  sessionStatus[canceled,paused,running,stopped]  consumableStatus[good,maintenance_required,missing,order,replace]
  indicatorStatus[never,when off,when on]  button[pushed,held](m:true)  orientation[6 values]

INTEGER attributes (→ group d,i; numeric widget with range/unit):
  level[0-100]%  hue[0-360]°  saturation[0-100]%  colorTemperature[1000-30000]°K
  infraredLevel[0-100]%  battery[0-100]%  humidity[0-100]%  illuminance[0+]lux
  rssi[0-100]%  lqi[0-255]  steps[0+]  goal[0+]  timeRemaining[0+]s
  soundPressureLevel[0+]dB  uvIndex[0+]  axisX/Y/Z[-1024..1024]

DECIMAL attributes (→ group d,i; numeric widget):
  temperature[-460..10000]°  power[W]  energy[0+]kWh  voltage[V]  pH[0-14]
  carbonDioxide[0+]  coolingSetpoint/heatingSetpoint/thermostatSetpoint[-127..127]°
  distance/speed/altitude/latitude/longitude/bearing (presence sensor metrics)

STRING attributes (→ group s; free text):
  currentActivity  status  phraseSpoken  trackDescription  currentPlace
  previousPlace  closestPlace  arrivingAtPlace  leavingPlace  places

SPECIAL types:
  color → t:color (color picker)   hex → t:hexcolor   image → t:image(group f)
  threeAxis → t:vector3   schedule/activities/trackData → t:object   eta → t:datetime

---

## LAYER 3 — CONDITION OPERATORS (current-state checks)
(g:=group letters, p:=param count, t:=timed, m:=multi. Show operator if attribute's group-letter ∈ g)

changed g:bdfis t:1 | did_not_change g:bdfis t:1
is g:bs p:1 | is_not g:bs p:1
is_any_of g:s p:1 m | is_not_any_of g:s p:1 m
is_equal_to g:di p:1 | is_different_than g:di p:1
is_less_than g:di p:1 | is_less_than_or_equal_to g:di p:1
is_greater_than g:di p:1 | is_greater_than_or_equal_to g:di p:1
is_inside_of_range g:di p:2 | is_outside_of_range g:di p:2
is_even g:di | is_odd g:di
was g:bs p:1 t:2 | was_not g:bs p:1 t:2
was_any_of g:s p:1 m t:2 | was_not_any_of g:s p:1 m t:2
was_equal_to g:di p:1 t:2 | was_different_than g:di p:1 t:2
was_less_than g:di p:1 t:2 | was_less_than_or_equal_to g:di p:1 t:2
was_greater_than g:di p:1 t:2 | was_greater_than_or_equal_to g:di p:1 t:2
was_inside_of_range g:di p:2 t:2 | was_outside_of_range g:di p:2 t:2
was_even g:di t:2 | was_odd g:di t:2
is_any g:t p:0 | is_before g:t p:1 | is_after g:t p:1
is_between g:t p:2 | is_not_between g:t p:2

---

## LAYER 4 — TRIGGER OPERATORS (change detection)
(same code meaning; t:1=stays/"For...", these fire on change)

gets g:m p:1 | happens_daily_at g:t p:1 | arrives g:e p:2 | executes g:v p:1
changes g:bdfis
changes_to g:bdis p:1 | changes_away_from g:bdis p:1
changes_to_any_of g:dis p:1 m | changes_away_from_any_of g:dis p:1 m
drops g:di | does_not_drop g:di
drops_below g:di p:1 | drops_to_or_below g:di p:1
remains_below g:di p:1 | remains_below_or_equal_to g:di p:1
rises g:di | does_not_rise g:di
rises_above g:di p:1 | rises_to_or_above g:di p:1
remains_above g:di p:1 | remains_above_or_equal_to g:di p:1
enters_range g:di p:2 | exits_range g:di p:2
remains_outside_of_range g:di p:2 | remains_inside_of_range g:di p:2
becomes_even g:di | remains_even g:di | becomes_odd g:di | remains_odd g:di
stays_unchanged g:bdfis t:1
stays g:bdis p:1 t:1 | stays_away_from g:bdis p:1 t:1
stays_any_of g:dis p:1 m t:1 | stays_away_from_any_of g:bdis p:1 m t:1
stays_equal_to g:di p:1 t:1 | stays_different_than g:di p:1 t:1
stays_less_than g:di p:1 t:1 | stays_less_than_or_equal_to g:di p:1 t:1
stays_greater_than g:di p:1 t:1 | stays_greater_than_or_equal_to g:di p:1 t:1
stays_inside_of_range g:di p:2 t:1 | stays_outside_of_range g:di p:2 t:1
stays_even g:di t:1 | stays_odd g:di t:1

---

## LAYER 5 — ACTION COMMAND PARAMS (command → fields that fall in)
(see WIZARD_ACTION_COMMAND_SPEC.md Part 4.3 — already specced. Param types ref Layer 2 attributes for widget/range.)
Key examples:
  on/off/lock/unlock/open/close/push/beep/take → NO params
  setLevel → Level:level(0-100%) + opt "Only if switch is" enum[on,off]
  setColor → Color:color + opt on/off
  setHue → Hue:hue(0-360°) + opt on/off
  setColorTemperature → ColorTemp:colorTemperature(1000-30000) + opt on/off
  setThermostatMode → mode:thermostatMode(enum)
  speak → Message:string ; playText → Text:string + opt Volume:level

---

## DEVIATIONS already decided (carry into spec):
- Action commands: intersection-only, no Common/Partial (D-1).
- Aggregation bar: Any/All/None only (not WebCoRE's 12).
- Value input: 3-tier resolution, Tier-3 free-input escape hatch with current-state hint (unknowns lock).

## STILL-OPEN decisions for the fall-spec build:
- NO OPERATOR CUTS. The wizard surface is ALL of WebCoRE. v1 cuts are COMPILER-SIDE ONLY, never wizard-side. Every operator in Layers 3 & 4 is carried in the menu document. (If you see "v1" applied to wizard scope anywhere, it is an error — strike it.)
- Trigger vs condition presentation: in PistonCore these are one merged operator dropdown (per current code) split into ⚡Triggers / Conditions optgroups — confirm that UI presentation stays. (This is a presentation question, NOT a cut.)
- Time/virtual-device subjects (happens_daily_at, arrives, executes): confirm how they surface for the appropriate subject types. (In scope — all of WebCoRE. Question is only how they surface, not whether.)
