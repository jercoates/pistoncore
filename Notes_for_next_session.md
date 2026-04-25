

Fix semicolons on end keywords across all HTML files before cousin picks them up

info frome notebooklm on webcore piston video
Technical Manual: Advanced HVAC & Smoke Response webCoRE Piston

1. Manual Overview & System Requirements

This technical manual outlines the configuration of a multi-purpose webCoRE piston designed for high-level HVAC management and emergency response. As a Technical Lead, I have structured this automation to handle three core operational objectives within a single logic framework:

* Energy Conservation: Real-time monitoring of contact sensors (doors/windows) to prevent thermal loss by notifying users and eventually suspending HVAC operations.
* Efficiency Comparison: Intelligent comparison of outdoor ambient temperatures against internal HVAC set points to suggest passive climate control alternatives.
* Emergency Smoke Response: High-priority integration with smart smoke detectors to immediately disable air circulation upon detection, mitigating the spread of smoke or fire through the ventilation system.

Hardware & Software Requirements

Successful deployment requires the following ecosystem components:

* Thermostat: An Ecobee thermostat (ideally integrated via Ecobee Suite Manager) or any thermostat device handler compatible with SmartThings/Hubitat that supports mode switching.
* Contact Sensors: Zigbee, Z-Wave, or Wi-Fi smart sensors for all perimeter doors and windows.
* Smoke Detectors: Integrated smart smoke detectors (e.g., Nest, First Alert, or Hub-connected sensors).
* Outdoor Temperature Data: Access to the $twcweather system variable or, as utilized in this specific build, the weather temperature attribute provided directly by the thermostat’s device handler.

The fire safety automations described herein are strictly ADDITIVE. These instructions are intended to provide secondary early detection and warning. This piston must not be relied upon as a primary life-safety mechanism. It is not a replacement for professional monitoring, local fire codes, or the native alerting functions of your smoke detectors. Always maintain your hardware according to manufacturer specifications.


--------------------------------------------------------------------------------


2. WebCoRE Interface & Navigation Essentials

To build this piston effectively, you must utilize three specific UI navigation elements that are often overlooked by novice users:

* The Cog Icon (Advanced Options): Found within the condition editor for a device. This is essential for storing the specific list of "matching devices" into a variable when multiple sensors are being monitored.
* The Orange Menu (Logic Evaluation): When selecting multiple devices for a single condition, an orange bar appears above the attribute. You must toggle this to switch between "any of the selected devices" (OR logic) and "all of the selected devices" (AND logic).
* The Double Arrow Icon (Task Reordering): Located in the top toolbar of the editor. This must be enabled to drag-and-drop tasks. In this piston, the order of operations is critical for variable capture; if you do not see these arrows, click the double-arrow icon in the toolbar to enable "Move" mode.


--------------------------------------------------------------------------------


3. Local Variable Initialization

Initialize the following 10 local variables at the top of your piston. These act as the "memory" of your automation.

Variable Name	Type	Initial Value / Setup
smoke detected	Boolean	(No initial value)
hvac manual mode	Boolean	(No initial value)
doors	Device	Select specific door sensors
windows	Device	Select specific window sensors
detectors	Device	Select specific smoke detectors
detector smoke	Device	(No initial value)
open contacts	Device	(No initial value)
open contacts list	String	(Leave empty)
detector smoke list	String	(Leave empty)
hvac state	Dynamic	(Leave empty)*

Senior Engineer’s Note on "Dynamic" Types: The hvac state variable is set to Dynamic because thermostat modes can return different data formats (Strings or Integers) depending on the specific device handler used. Using a Dynamic type ensures the value is captured and restored without type-mismatch errors.


--------------------------------------------------------------------------------


4. Logic Block 1: Initial Energy Conservation Alert (5-Minute Threshold)

This block provides a "soft" warning to occupants before the system takes corrective action.

1. Add Statement: Select "Add an if" under the execute block.
2. Conditions:
  * Device: Select the doors and windows variables.
  * Attribute/Comparison: Set attribute to contact, comparison to stays, and value to open for 5 minutes.
  * Advanced: Click the cog icon and set "Store the list of matching devices into variable" to open contacts.
  * Second Condition: Add the thermostat device. Attribute thermostat mode, comparison is any of, values: auto, cool, heat.
3. Actions:
  * Set Variable: Set open contacts list = open contacts.
  * Notification: Send push notification (Store and messages = true).
  * Syntax: Use the expression: "The following contacts are open: {open_contacts_list}. Please close them as the HVAC is running."


--------------------------------------------------------------------------------


5. Logic Block 2: Automated HVAC Shutdown (10-Minute Threshold)

This block enforces energy savings by disabling the system.

1. Duplicate: Right-click Logic Block 1 and select "Duplicate."
2. Modifications: Change the stays open duration to 10 minutes. Update the With block target to your specific Thermostat device.
3. Task Ordering (Critical): Use the double arrow icon to ensure tasks execute in this exact sequence:
  1. Set variable hvac manual mode = true (Locks the restoration logic).
  2. Set variable hvac state = thermostat mode (Must occur before shutdown to capture the current "cool" or "heat" state).
  3. Set variable open contacts list = open contacts.
  4. Send push notification: "HVAC shut down due to: {open_contacts_list}."
  5. Set thermostat mode to off.

Pro-Tip: If you set the mode to off before capturing the hvac state, the variable will save "off," and the system will never automatically turn back on when you close the windows.


--------------------------------------------------------------------------------


6. Logic Block 3: Automatic Status Restoration

This block handles the logic for resuming normal operations once the home is sealed.

1. Triggers:
  * Condition 1: doors and windows -> contact -> changes to -> closed (Orange menu: any of).
  * Condition 2: doors and windows -> contact -> are -> closed (Orange menu: all of).
2. Safety & State Checks:
  * smoke detected is not true.
  * thermostat mode is off.
  * hvac manual mode is true.
3. Actions:
  * Set hvac manual mode = false.
  * Set thermostat mode = {hvac_state} (Select "Expression" or "Variable" for the value, not a hard-coded string).
  * Send notification: "All contacts closed. HVAC restored to {hvac_state} mode."


--------------------------------------------------------------------------------


7. Logic Blocks 4 & 5: Efficiency Notifications

These blocks suggest opening windows when the outdoor climate is favorable.

1. Block 4 (Heating): Click "Add a new statement" -> "Add an if" -> "Add a group".
  * Set group to Logical OR.
  * Inside group: Thermostat mode changes to heat OR Thermostat operating state changes to heating.
  * Outside group: Weather temperature is greater than heating set point.
  * Action: Notification: "It is warmer outside than your heat set point. Consider opening a window."
2. Block 5 (Cooling): Duplicate Block 4. Update group to cool/cooling.
  * Change comparison: Weather temperature is less than cooling set point.
  * Action: Notification: "It is cooler outside than your AC set point. Consider opening a window."


--------------------------------------------------------------------------------


8. Logic Blocks 6 & 7: Smoke Detection & System Recovery

Logic Block 6 (Emergency Response)

1. Condition: detectors -> smoke -> changes to -> detected (Orange menu: any of).
2. Advanced: Click the cog icon and store matching devices in detector smoke.
3. Actions:
  * Set smoke detected = true.
  * Set detector smoke list = detector smoke.
  * Send SMS notification: "SMOKE DETECTED by: {detector_smoke_list}!" (Note: SMS availability depends on hub region; I recommend disabling "Store in history" for SMS to keep logs clean).
  * Send push notification: "SMOKE DETECTED by: {detector_smoke_list}!"
  * Turn off the thermostat.

Once smoke detected is set to true, the HVAC system is hard-locked in the off state for safety. Even if the smoke clears, the system will not resume normal operation until you manually enter the webCoRE dashboard and set the smoke detected boolean back to false.

Logic Block 7 (Clearance)

1. Condition:
  * detectors -> smoke -> changes to -> clear (any of).
  * detectors -> smoke -> are -> clear (all of).
2. Action: Push notification: "All smoke detectors report clear. Manual HVAC reset required."


--------------------------------------------------------------------------------


9. Testing & Validation Procedures

Standard engineering practice requires a rigorous test of all logic gates before the piston is considered "Production Ready."

1. Threshold Validation: Open one window. Verify the "Warning" notification arrives at exactly 5 minutes. Verify the "Shutdown" occurs at 10 minutes.
2. Persistence Test: While one window is open, open and close a secondary door. Verify the HVAC remains off until all contacts in the doors and windows variables are closed.
3. State Memory Test: Ensure that if the HVAC was in cool mode before shutdown, it returns to cool (and not heat or auto) upon restoration.
4. Smoke Simulation:
  * Temporarily change the trigger in Block 6 from detected to test.
  * Initiate a hardware test on your detector.
  * Verify the HVAC kills immediately and the SMS/Push includes the correct detector name via {detector_smoke_list}.
  * Important: Perform the manual reset of the smoke detected variable to confirm you can successfully exit the emergency lock state.
  * Revert the trigger from test back to detected.
Keep for future prompts:
NotebookLM prompt:
"From this video, extract only information about the webCoRE user interface and how it works. I want to know: how the editor looks and is laid out, how the wizard works step by step when adding a trigger, condition, or action, what happens when you click on something to add or edit a statement, how the device picker works, how the condition and operator selection works, what the different wizard steps look like and in what order they appear, how the document renders keywords and indentation, and any UI behaviors like right-click menus, drag to reorder, the cog icon, the orange menu, and ghost text insertion points. Do not include information about how to build any specific piston or what the piston does — only how the UI works.
or : For every action the user takes in the wizard, document the sequence: what they clicked to open it, what the first screen shows, what options were available, what they selected, what appeared next, and what the final result looked like in the editor document. Capture this as a step-by-step flow so it can be used to rebuild the exact wizard behavior.