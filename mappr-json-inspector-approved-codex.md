MAPPR — JSON INSPECTOR UX REFINEMENT
Objective
Refine the existing JSON view into a focused, developer-friendly inspector. Preserve the existing Tree and Pretty modes and the underlying generated JSON. This is a targeted UI and interaction improvement, not a new JSON editor, dashboard, or data-model redesign.
Approved interaction decisions (implement exactly)
1. Find: The search input is always visible on desktop. On mobile, show a compact search icon button that reveals the search input on demand; focusing it immediately is preferable. This is not a new tab or modal.
2. Selection versus expansion: Clicking/tapping a property's label/row content selects it and updates the path. Its chevron separately expands/collapses objects or arrays; clicking the row must not accidentally expand/collapse. Keep the two actions clearly and accessibly distinct.
3. Contextual copy: On desktop, show a property's small copy affordance on row hover and keyboard focus. On touch devices, where hover does not exist, show copy actions for the selected row. Support both copying the exact JSON value and copying the property's path (if a value is present); do not crowd every row with persistent icons.
   These decisions are final. Do not invent a different interaction model or make the user choose during implementation.
1. Audit the actual implementation first
- Read AGENTS.md, relevant project instructions, and current Git status/diff.
- Inspect the JSON view, tree renderer, Pretty mode, existing expansion controls, copy behavior, scrolling, keyboard support, and styles.
- Check current shared UI primitives, icons, motion tokens, and any existing search/path helpers before adding abstractions.
- Preserve all working behavior and uncommitted changes. Do not assume historical repository snapshots match the working tree.
2. Simplify the toolbar
- Keep Tree / Pretty prominent as the existing mode switch.
- Add Find to locate keys and primitive values in the full JSON structure. Keep the input persistently visible on desktop.
- Preserve Expand all and Collapse all, but make them secondary controls.
- Group Level 2 / Level 3 and any existing depth presets under one compact Expand to level menu; retain their semantics and do not arbitrarily change their depth definition.
- Keep Copy JSON available and visually consistent with Mappr's shared toolbar controls.
- On mobile, replace the visible Find input with a recognizable search icon button; tapping it reveals a compact search field, automatically focuses it if possible, and exposes a close/clear action. If a search is active, communicate that state when the field is closed. Preserve the query during temporary closing; make clearing explicit. Avoid covering the JSON tree with the input.
- Keep search match count and Previous/Next controls usable without making the mobile toolbar wider than the viewport. Do not add nested tabs or a permanent side panel.
3. Find across nested JSON
- Search nested property names and primitive values (strings, numbers, booleans, null), including array elements. Match case-insensitively by default.
- Show a real match count and working Previous / Next match controls when results exist; show a clear no-results state otherwise.
- When navigating to a match in Tree mode, expand only the ancestors necessary to reveal it, scroll it into view, and highlight the matching entry without destroying surrounding structure.
- Preserve users' manually expanded branches where feasible. Clearing a search must not leave the entire tree gratuitously expanded or collapse unrelated branches unexpectedly.
- Avoid searching only currently visible nodes. Avoid rendering a flat list that loses the JSON hierarchy.
- Handle large/dynamic JSON without blocking the UI unnecessarily; reuse existing traversal/rendering infrastructure and avoid new dependencies where possible.
- In Pretty mode, either support find-in-text with reliable navigation or clearly scope Find to Tree mode. Do not pretend search works in both if it does not.
4. Show the selected JSON path
- In Tree mode, show a small, readable current-property-path row (e.g. $.features[2].name) for the selected node.
- Selection must be separate from expansion: clicking/tapping the property label (or non-chevron row content) selects the node and updates this path without expanding/collapsing it. Clicking its chevron toggles only that branch, without unintentionally changing the selected node. Implement as separate accessible interactive targets; do not nest buttons.
- Make the selected node visually identifiable without confusing it with a search match. If the selected node becomes hidden because an ancestor is collapsed, retain the valid selection/path or handle it consistently, without pretending it remains visually highlighted.
- Support valid path notation for array indexes and property names requiring bracket/quoted notation; avoid ambiguous or incorrect paths.
- Let the user copy the exact property path. Keep the path unobtrusive and horizontally usable on narrow viewports.
- The path should update when focus/selection moves; don't add a second detail inspector.
5. Contextual copying
- Preserve existing Copy JSON behavior, copying the complete, unmodified JSON.
- Add unobtrusive, accessible ways to copy an individual property path and value, when appropriate.
- Desktop: show a small contextual copy icon or compact action group on row hover and keyboard focus. Do not reserve prominent action controls on every unselected row.
- Mobile/touch: do not depend on hover. Tapping a row selects it and exposes copy path/value controls for that selected node (inline in that row, or in the already planned path row if it remains immediately discoverable); avoid persistent copy icons on every row.
- Distinguish Copy path and Copy value with clear accessible names. Provide keyboard access and focus visibility. Copying must not accidentally expand/collapse a branch.
- Copy values faithfully (use correct JSON serialization for objects/arrays; don't silently alter strings, truncate values, or copy visual ellipses).
- Provide brief success/failure feedback without intrusive toast spam.
- Do not change source data or expose secrets beyond the JSON the view already legitimately displays.
6. Visual treatment
- Keep Mappr's dark navy workspace, existing typography, and restrained cyan syntax accents.
- Improve indentation guides, collapsed-object/array summaries, hover/focus feedback, wrapping/overflow, and monospace readability without introducing cards around every property.
- Distinguish selected row, keyboard focus, hover, and search match with appropriately different treatments; use amber sparingly and consistently with existing Mappr conventions.
- Preserve clear type distinctions for keys, strings, numbers, booleans, and null values.
- Support keyboard navigation and visible focus; follow existing accessible tree behavior rather than bolting on incomplete ARIA roles. If it is implemented as an ARIA tree, honor its keyboard interaction model.
- Restrained transitions only where state meaningfully changes; respect prefers-reduced-motion.
7. Preserve state appropriately
- Keep the user's selected path, manually expanded branches, Tree/Pretty choice, and search context when switching away from and returning to the JSON tab where practical with the existing application state architecture.
- Inspect whether switching tabs currently unmounts the JSON view; use the existing map-scoped state mechanism rather than keeping every heavy view mounted.
- Reset or validate preserved paths/state when the actual JSON data or Mappr project changes. Never show another map's state/data.
- Do not add a new global state library or localStorage persistence merely for this refinement.
8. Strict scope
- Do not add JSON editing, mutation, code execution, JSONPath query builder, schema validation, AI explanations, extra dashboards, or persistent side panels.
- Do not alter the generated JSON, exports, backend contracts, unrelated tabs, or shared components beyond minimal necessary reuse.
- Do not rebuild existing working functionality or introduce unnecessary dependencies.
9. Verification and stop
- Verify Tree and Pretty modes, all existing expansion controls (including depth presets), and Copy JSON.
- Verify nested search hits, next/previous navigation, clear/reset behavior, arrays, long/escaped keys, no-results, and large JSON where feasible.
- Verify that desktop Find is always visible, mobile search icon reveals/focuses/dismisses the search field, and both modes communicate search scope honestly.
- Verify tapping a property label selects it without toggling expansion, tapping the chevron expands/collapses without accidentally selecting, and both controls work via keyboard.
- Verify contextual desktop copy on hover/focus, visible selected-row copy controls on mobile, accurate path/value copying, and failures/feedback.
- Verify mobile layout (including approximately 393px width), keyboard focus, and reduced-motion.
- Verify state restoration after navigating JSON → another tab → JSON, and reset on changed project/data.
- Run the relevant lint/type/build checks once using the repository's actual scripts. State what was tested versus not tested; do not repeatedly run optional browser scripts or ask unnecessary approvals.
- Summarize changed files, behavior, results, and remaining limitations. STOP for my browser visual review.
Goal: Keep JSON native to its format while making the viewer significantly easier to search, navigate, understand, and copy from.