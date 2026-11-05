# MAPPR — DEV PLAN STICKY ROADMAP & RESPONSIVE REFINEMENT

Improve the existing Development Roadmap's navigation, sticky behavior, and responsiveness.

IMPORTANT: The current visual design is approved. This is an interaction and responsive-layout refinement, NOT a redesign.

## 1. Inspect before editing

Inspect:
- Current DevPlanView and related styles.
- Existing phase selection and timeline-fill logic.
- Mappr's main navigation and scrolling containers.
- Shared buttons, motion tokens, and responsive conventions.
- AGENTS.md and current Git status/diff.

Preserve all working functionality and uncommitted changes.

## 2. Sticky roadmap

Make the existing horizontal phase roadmap sticky.

Requirements:
- Initially display the roadmap in its normal position beneath the Development Roadmap introduction.
- When scrolling down through the selected phase's tasks, keep the roadmap pinned near the top of the viewport.
- Position it correctly beneath any persistent Mappr navigation.
- Do not let it overlap the navigation, task headings, or other content.
- Preserve the numbered circles, connecting line, animated amber selection/fill, phase titles, and existing visual styling.
- Use the existing navy background with subtle separation from scrolling content.
- Avoid creating an additional vertical scrollbar.
- Ensure CSS overflow, stacking contexts, and sticky positioning work together correctly.

The roadmap should remain interactive while sticky.

## 3. Previous / Next phase navigation

At the END of the selected phase's complete task list, add Previous and Next phase buttons.

Behavior:
- First phase: show only "Next phase".
- Middle phases: show both "Previous phase" and "Next phase".
- Last phase: show only "Previous phase".
- Single-phase plans: show neither button.

Use the existing Mappr shared button styling.

When either button is clicked:
1. Update the selected phase.
2. Update the roadmap's active circle and filled connector.
3. Update the phase heading, task count, and complete task list.
4. Scroll to the beginning of the newly selected phase's content, ensuring its heading is visible below the sticky roadmap.

Navigation must also work when users directly select numbered roadmap phases.

Do not add navigation buttons beside every task or inside the phase circles.

## 4. Desktop responsiveness — above approximately 1100px

Preserve the current approved layout:
- Full horizontal connected timeline.
- Numbered circles.
- Full phase titles beneath the circles.
- Existing amber selection.
- Even spacing across the available width.

Do not redesign the phase indicators into cards or pills.

## 5. Tablet responsiveness — approximately 640–1100px

Adapt the existing roadmap:
- Maintain the horizontal connecting line and numbered circles.
- Reduce horizontal spacing appropriately.
- Allow phase labels to wrap or truncate cleanly when necessary.
- Avoid overlapping or clipped titles.
- Preserve the full selected phase title in the content heading.
- Keep touch targets comfortable and accessible.

Do not hardcode shortened phase names.

## 6. Mobile responsiveness — below approximately 640px

Use a compact version of the SAME roadmap.

Requirements:
- Display a horizontal connected sequence of numbered circles.
- Hide the long phase titles beneath individual circles.
- Show the complete selected phase title in the regular content heading below the roadmap.
- Keep the compact numbered timeline sticky as users scroll.
- Keep the sticky area as short as practical, without pinning the large page introduction.
- Maintain approximately 44×44px interactive touch targets even if circles are visually smaller.
- Avoid horizontal overflow of the entire page.

If there are more phases than can comfortably fit:
- Allow horizontal scrolling within the roadmap.
- Keep connecting lines visually continuous.
- Ensure the selected phase remains visible when navigating.
- Support any number of generated phases rather than assuming four.

Do not introduce an additional mobile navigation system, dropdown, or accordion.

## 7. Scrolling and interaction

Ensure:
- Switching phases from the bottom navigation moves the reader to the new phase heading.
- The heading never gets hidden behind the sticky roadmap.
- Clicking a roadmap phase also reveals the corresponding content clearly.
- Rapid phase switching always resolves to the latest selection.
- Selecting the already-active phase does not cause unnecessary animations or scroll jumps.
- Smooth scrolling is restrained and respects prefers-reduced-motion.
- Keyboard navigation and visible focus indicators work correctly.

Use existing motion tokens and avoid new animation libraries.

## 8. Preserve the current visual design

Do NOT introduce:
- "View tasks" labels beneath every phase.
- Extra directional arrows beside phase titles.
- Large clickable cards.
- A second navigation bar.
- New explanatory banners.
- Fake progress indicators.
- Completion checkmarks.
- Additional nested tabs.

Preserve the original roadmap geometry, typography, line treatment, amber selection, and task-row design wherever possible.

The filled connector indicates the selected phase's position, NOT actual development progress.

## 9. Preserve data and functionality

Do not alter:
- Generated phase names or order.
- Task descriptions.
- Task counts.
- Feature references.
- Existing task interactions.
- Backend contracts.
- Other Mappr views.

## 10. Verification

Check the following:

- Desktop roadmap looks essentially unchanged.
- Sticky behavior works without overlapping Mappr navigation.
- First, middle, last, and single-phase button conditions.
- Previous/Next navigation updates the correct phase.
- Automatic scrolling positions the content correctly.
- Tablet labels remain readable.
- Mobile shows compact numbered circles with the correct connecting line.
- Long and dynamically generated phase lists remain usable.
- No nested vertical scrolling.
- No fake completion status.
- Keyboard and reduced-motion behavior work correctly.

Run essential lint/type/build checks once.

Report:
- Files modified.
- What was implemented.
- What was actually verified.
- Any remaining limitations.

STOP for my browser visual review.

GOAL: Preserve the current beautiful Development Roadmap while making it sticky, responsive, and effortless to navigate on every screen size.