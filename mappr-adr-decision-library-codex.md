# MAPPR — ADR DECISION LIBRARY + FULL-WIDTH READER

## Goal

Refine Mappr's ADR (Architecture Decision Records) tab into a **Decision Library with a dedicated full-width decision reader**.

This supersedes the earlier ADR proposals for (a) a side-by-side master-detail inspector and (b) a full-width accordion/dropdown register. **Do not implement either of those designs.**

We want a credible engineering documentation experience: users should quickly discover what was decided, then read one complete ADR in a comfortable reading layout. Reuse Mappr's existing dark technical visual language.

## 1. Inspect the current repository first

- Read applicable `AGENTS.md`, `CLAUDE.md`, and other existing project instructions.
- Check `git status` and the diff, and preserve all unrelated and uncommitted work.
- Inspect the actual ADR view/component, current ADR data types, generation/fetch state, Markdown export, loading/action buttons, shared styles and motion tokens, and workspace navigation.
- Determine whether the previous side-by-side or accordion implementation is present; adapt minimally instead of layering a third presentation on top.
- Keep backend contracts and generated ADR content unchanged.

## 2. Two-mode, full-width layout

### A. Library mode (default)

Display one full-width, compact, scannable decision register; **no sidebar inspector and no accordions**.

- Preserve the existing *Tech Stack Decisions* and *Architecture Decisions* groupings if present in the actual data.
- Each row should show the decision title, its actual status (when available), category/group (when available), and a **brief preview of the actual decision** (not a fabricated summary).
- Prefer an existing summary/decision field for preview; if none exists, show a short safely truncated excerpt of the existing decision text. Do not call AI or generate new claims merely to create summaries. Preserve the full text for reader mode.
- Use restrained separators, comfortable density, clear typography, and a small disclosure/navigation affordance (e.g. arrow). Avoid repetitive large cards and redundant headings.
- A record row should be a semantic, keyboard-accessible interactive control that opens its document.
- Show a small factual record count from current data, not invented statistics.
- Do not add search, filters, sorting, or new metadata just to decorate ten records.

### B. Reader mode (after selecting a record)

Replace the register content *within the ADR view* with one dedicated, full-width document reading surface. Keep the persistent Mappr workspace navigation and ADR actions intact.

- Include a clear **Back to all decisions** action.
- Show complete record title, actual status, and available metadata.
- Present the actual **Decision** prominently, followed by existing **Context / Rationale**, **Alternatives considered**, and **Consequences / Trade-offs**. Only display sections backed by the current data; keep all original details and wording.
- Use good reading-width control inside the full-width workspace (e.g. a moderately constrained text column) rather than stretching paragraphs across a huge monitor. Avoid generic nested cards for each paragraph.
- Optional **Previous / Next** navigation across the real ordered records is appropriate if simple to implement; do not invent a chronology or numerical IDs.
- Opening a record must not open a dropdown or a narrow right-hand inspector.
- Returning to the library should preserve the user's place/focus where practical, without stale records or jarring jumps.
- If ADRs refresh, keep the selected record when a stable matching record still exists; otherwise return to the library safely. Use stable IDs provided by the data, not array index as a durable identity when IDs are available.

## 3. Interaction and visual hierarchy

- Maintain Mappr's established dark navy surfaces, typography, amber for interactive focus, cyan for technical context, and semantic status colors. Do not color every title amber.
- A status like **Accepted** must only appear if present in Mappr's actual record data; do not silently classify AI-generated recommendations as user-approved.
- Make the title and decision easy to find; make explanations readable and alternatives/consequences distinct without overwhelming borders.
- Keep interaction predictable: click a library row to read; click Back to return; keyboard Enter/Space and focus visibility must work.
- Use existing motion tokens for a restrained transition (roughly 160–240ms where helpful). Don't delay information, force page fades, or replay construction animations. Respect `prefers-reduced-motion`.
- Avoid new dependencies unless there is a concrete need, and explain before adding one.

## 4. Header actions — exactly the established Mappr behavior

Preserve the existing **Regenerate** and **Markdown export** functionality, and make Regenerate match Architecture/Overview buttons:

- Idle: existing icon and label, natural content-based width, modest icon/text gap.
- Actual pending request: replace **all visible button content with one centered animated spinner only**. No visible loading label. Smoothly contract the same button into a compact circle while maintaining its height.
- Keep an accessible pending name/status for assistive technology; prevent duplicate submissions.
- **No separate loading card, panel spinner, overlay, or repeated 'Generating...' message for this same operation.**
- Keep currently available decisions readable while regenerating. On success, update to the actual result; on failure, restore the button and show the actual error while retaining previous decisions.
- Markdown export should have no loading animation for an immediate synchronous download; only show pending if genuinely asynchronous.
- Reuse existing shared ActionButton/Phosphor icons/motion utilities. Do not create another loader component unnecessarily.

## 5. Responsive layout

- Desktop/laptop: compact full-width register with a comfortable-width reader, no left/right master-detail split.
- Mobile: rows and metadata wrap cleanly; reader text maintains readable sizes; actions remain usable; no horizontal overflow.
- Avoid unnecessary nested scrollbars. Let the document scroll naturally.
- Preserve the current workspace shell, global navigation, and ADR view boundaries.

## 6. Preserve data, scope, and behavior

- Preserve every ADR, original title, decision, context, alternatives, consequences, status, grouping, and any other real data.
- Preserve Markdown generation/export, request/error flow, and existing backend APIs.
- Do **not** change the data model, backend, other Mappr tabs, or add ADR editing/approval functionality.
- If a field or interaction is unsupported by the actual repo, don't fabricate it; document the limitation.
- Remove obsolete ADR-only accordion/inspector presentation state and styling where safe. Do not delete shared utilities required by other views.

## 7. Verification and completion

- Run the relevant lint, type checking, and production build commands **once each** when available. If a check fails, fix the issue and rerun only the necessary check.
- Check: compact library rows; open/return; full content preserved; actual statuses; multiple groups; keyboard use; mobile; reduced motion; regeneration success/failure; Markdown export; pending button is spinner-only.
- Use browser tools only if available without repeated permission prompts. If visual verification isn't available, say so and let me review the running UI. **Do not make optional temporary browser automation scripts or enter endless approval/testing loops.**
- Review the final diff to ensure no unrelated modifications.
- Report **Completed / Verified / Outstanding / Next step** and **STOP** for visual approval.

**Success criterion:** ADRs feel like an organized decision library with proper, readable technical documents—not another dropdown list, another side inspector, or a card grid.
