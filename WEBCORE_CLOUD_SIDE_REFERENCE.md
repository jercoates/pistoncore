WebCoRE Cloud Side

What it does and how it does it — a from-scratch reference for framing a new version (PistonCore)

**Framing.** The cloud side of WebCoRE is a browser-based IDE that produces and manages one data structure: the piston. It does not run automations. Its entire job is to let a person author a program, then store, version, and ship that program to a hub that runs it. Three responsibilities only — author, persist, deliver — with manipulate and port layered on top. Every piece of UI reduces to a safe way to fill one node of a typed, recursive, context-portable JSON tree.

**The seam.** The author's browser and the hub never talk directly. The cloud is the broker. So the cloud side has two faces — one toward the human (the editor) and one toward the hub (the sync/delivery API) — with a store in the middle. The JSON is the only thing that crosses: intent goes down to the hub, device catalog and execution state come back up.

# 1. What the cloud side fundamentally is

A browser single-page app plus a cloud store plus a hub-bridge API. It authors intent, holds it as the system of record, and delivers it. It never executes. The hub executes; the cloud never authors. Understanding the cloud side means understanding the shape it is trying to build, because every control is a means of populating some field of that shape.

# 2. The data structure it exists to produce

Everything orbits one artifact: the piston, expressed as nested JSON. It decomposes into:

- **Metadata** — id, name, author, category, modified time, enable/pause state.

- **A tree of statements** — not a list, a tree. Each statement is a node with a type and, depending on type, a child array of more statements. This recursion is the whole model: a statement can contain statements, indefinitely. Types divide into restrictions (conditions/groups that gate), actions (do something to devices), and control flow (if/else, switch/case, loops of every kind, wait, break/exit).

- **Conditions and condition groups** — themselves a parallel tree. A group holds an AND/OR operator and a list of children, each child either a leaf comparison or another group. Arbitrary nesting, same as statements.

- **Comparisons** — the leaves of conditions. Each is a left operand, a comparison operator, and zero/one/two right operands (some operators take a range).

- **Operands** — the atomic value carriers, and the most important detail in the whole structure. An operand has a type, and the type determines how it resolves: physical device + attribute, variable, global variable, constant literal, expression, preset/enumerated value, argument, or system value. The operand dialog is a type switch — pick the type and the input controls reshape to match. Values are typed at authoring time, and that type travels with them. This is the single most load-bearing concept in WebCoRE.

- **Expressions** — strings parsed and evaluated at runtime, with their own grammar: operators, functions, variable interpolation via {…}, datatype coercion rules.

- **Variables and globals** — named value holders. Locals scoped to the piston; globals shared across pistons (@ regular, @@ cloud-synced). The author declares them; the runtime carries them.

**Deepest truth:** every editor interaction is a guided way to fill one node of this tree with valid, typed content. The dialogs are scaffolding around the JSON shape.

# 3. How the editor works — the authoring face

A single-page app that holds the entire piston in memory as a JS object and re-renders it. The loop:

## Render

Walk the statement tree and draw it as the indented block view. Each node renders according to type — an if draws its condition summary and its nested body indented beneath, a device action draws device + commands, a loop draws its bounds and body. The tree structure is the visual indentation. Multi-nesting renders for free because rendering is recursive over the same recursive structure.

## Edit via dialogs

Clicking any node opens a modal specific to its type — edit-condition, edit-action/task, edit-statement, edit-event, edit-variable. Each dialog is a form whose fields map to that node's JSON fields. The dialog's job is to constrain input so only valid JSON can be produced: dropdowns populated from known capabilities, operand type switches that reshape inputs, operator lists filtered to what the left operand's datatype supports. You cannot type a malformed piston because the dialogs only emit well-formed nodes.

## The “Add more” / re-arm primitive

Many dialogs let you append additional items to a list — another comparison in a group, another command in an action, another task. This is the chain-building mechanism, and it appears anywhere the underlying JSON field is an array. It feels like a UI convenience but it is structural: it is how the author grows the repeated-element arrays of the tree. Because it lives in its own surface and applies across many dialogs, it is exactly the kind of thing that gets dropped if authoring is directed menu-by-menu.

## Device / capability knowledge

The editor knows what devices exist and what each can do because the hub reported its device list (capabilities, attributes, commands) up to the cloud at install/sync time. The editor reads this catalog to populate pickers — choose a capability, then a device that has it, then the attribute or command. Authoring is capability-aware because the catalog was delivered from the hub. Critically: the editor authors against a snapshot of hub knowledge, not a live hub.

## Local state, commit on save

All edits mutate the in-memory piston object. Nothing leaves the browser until save. Save serializes the object to JSON and posts it to the cloud store.

# 4. Persistence and delivery — the hub face

This is the half that “cloud” actually buys, and the half a from-scratch rebuild must consciously decide about.

- **The install handshake** — the hub runs a companion app. At install it registers with the cloud against the user's account and exchanges tokens: the hub learns the cloud endpoint, the cloud learns how to reach (or be polled by) the hub. This binds a hub instance to a cloud account.

- **Device catalog upload** — the hub enumerates its devices and their capabilities/attributes/commands and sends that catalog to the cloud. This is what makes the editor's pickers know reality. It refreshes on change. Without it the editor authors blind.

- **Piston storage** — the cloud stores pistons per account; the authoritative copy lives in the cloud, keyed to the user. The dashboard lists them, shows state, allows enable/pause/delete. A per-user document store, but the system of record.

- **Delivery / sync** — when a piston is saved, the cloud makes it available to the hub, and the hub fetches the piston JSON to execute locally. The split is absolute: the cloud holds authored intent, the hub pulls it and runs it.

- **Feedback upward** — the hub reports execution state, logs, variable values, and piston status back to the cloud so the dashboard shows what's happening and the debugging view displays live traces. This return path is what makes the cloud feel live even though it runs nothing.

# 5. Structural manipulation — operating on the tree, not the fields

These change how the tree is shaped rather than what any one node's fields hold, which is why they sit apart from the dialogs.

- **Drag and drop / reordering** — statements within a block reorder; nodes move between blocks (into an if body, out of a loop, up to root). Mechanically a subtree detach-and-reinsert: lift a node and everything nested under it out of its parent's child array and splice it into another parent's array at a drop index. The constraint that matters: some moves are illegal by structure (a break only means something inside a loop; conditions belong in restriction slots, not action slots), so valid drop targets must be computed from node type, not “anywhere.”

- **Copy / cut / paste** — copy serializes a node-subtree to a clipboard buffer (in-memory, or serialized JSON for cross-piston paste); paste deserializes and inserts at the target. Two non-obvious problems: 

- ID collision — every node carries a stable id; pasting a subtree means regenerating ids for the whole pasted subtree while preserving internal references between them.

- Reference portability — a pasted node may reference a device, variable, or global that doesn't exist in the destination context. Paste must carry those dependencies, flag them as unresolved, or degrade gracefully — the same missing-reference problem edit-load reconciliation handles, arriving through the clipboard.

- **Duplicate** — copy+paste shorthand on a single node; same id-regeneration concern, same-context so references usually survive.

- **Disable / enable a node** — toggle a node (and its subtree) inactive without deleting it; it stays in the JSON with a disabled flag, renders dimmed, and the hub skips it at execution. Pure tree-state, no field editing.

- **Collapse / expand** — pure view state over the tree; fold a node's children for navigability on large pistons. Doesn't touch the JSON (or stores collapse-state as non-semantic UI metadata).

# 6. Portability — moving pistons across the seam by hand

- **Export** — serialize a whole piston to a portable form (a backup code/string or JSON blob) capturing the entire tree, variable declarations, and metadata. Same serialization as save, aimed at a human/file, and it must be self-contained: everything needed to reconstruct the piston independent of the account it came from.

- **Import** — the inverse: paste a backup code or load a blob, deserialize into a new piston. Same dependency problem as paste, at whole-piston scale: imported pistons reference devices and globals by name/id that may not exist in the importing account. The importer reconciles — match by friendly name where it can, flag what it can't, produce interactive ⚠ rows rather than silently dropping. This is why the name-as-lookup-key rule is load-bearing: it is what makes a piston portable across hubs. An entity-id-only reference does not survive export to a different hub; a friendly-name reference does, then re-binds on import.

- **Sharing / community import** — pistons published by id, imported by others. Same import machinery, plus the recognition that author and importer have entirely different device sets, so an imported community piston is expected to arrive with unresolved references the importer rebinds. Reconciliation here is the normal path, not an error path.

**Why this belongs in the contract, not beside it.** Copy/paste, import/export, and drag all force the same question the contract must answer anyway: what does a node mean when detached from its original context? Drag tests whether a subtree is self-contained enough to relocate. Copy/paste tests whether ids and references survive duplication and cross-context insertion. Export/import tests whether a piston is self-contained enough to leave its account and rebind elsewhere. If the reference model is correct (friendly-name lookup key vs. committed entity_id), all of these are cheap — serialize, regenerate ids, reinsert, reconcile-by-name. If it's wrong, every one breaks in a different way, discovered feature by feature. They are the stress test that proves the reference model holds.

# 7. The architecture in one frame

Three components, two interfaces, one contract.

- **Component — Editor** (browser SPA): authors the piston tree, reads the device catalog to guide authoring, emits JSON.

- **Component — Store** (cloud): per-account system of record for pistons, dashboard, state.

- **Component — Bridge API** (cloud↔hub): install/token handshake, catalog upload, piston delivery, execution feedback.

- **Interface 1 (human↔cloud)**: the editor UI, whose every dialog is a constrained JSON-node builder.

- **Interface 2 (cloud↔hub)**: the sync API, across which only the piston JSON (down) and catalog + state (up) travel.

- **The contract**: the piston JSON shape — the typed, recursive statement/condition/operand tree — which both the editor (emits) and the hub (consumes) are accountable to, and which neither owns alone.

# 8. Decisions that matter most when framing a new version

- **Lock the JSON contract first** — especially the operand type system, since it is what carries meaning across the seam.

- **Decide whether the broker stays cloud or collapses** — if author and runtime can talk directly, the entire bridge API and its handshake disappear and the store can be local.

- **Build the editor as a recursive renderer + per-type constrained dialogs** over the in-memory tree.

- **Make the device catalog the editor's source of authoring truth**, however it is delivered.

- **Keep execution entirely on the other side of the JSON**, so the authoring half never knows or cares how the program runs.

**PistonCore mapping.** PistonCore reproduces this same boundary: the cloud side (what you are building now) makes the JSON; Home Assistant is the hub that consumes it; the compiler turns JSON into YAML/pyscript HA executes, and HA state feeds back. The JSON is the cloud/hub contract, exactly as in WebCoRE. Lock the contract and both halves can be built independently against it.
