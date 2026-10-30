
# MAPPR — FIX OVERVIEW DEPENDENCY INTERACTION & LAYOUT BALANCE

The current Overview dependency interaction is incorrect, and the two-column layout needs refinement.

You introduced a separate click interaction to display dependency connections instead of using the existing dependency links inside each feature card.

We also need to improve the visual balance between Capabilities and Requirements Gaps without forcing both sections to have equal heights.

Correct these issues while preserving Mappr's current design language and working functionality.

## 1. Reuse Existing Dependency Links

Inside an expanded feature card, we already display:

**Depends on (1)**  
→ Authentication & Account Setup

The existing "Authentication & Account Setup" link must trigger the relationship visualization.

When clicked:

- Keep the originating feature expanded.
- Automatically expand the referenced dependency feature.
- Draw a visible connection between both cards.
- Highlight both related cards subtly.
- Do not introduce another button, link, or toggle specifically for displaying connections.

Preserve the existing dependency label and styling.

Remove any redundant connection controls introduced during the previous implementation.

## 2. Keep Both Related Features Expanded

For example, clicking "Authentication & Account Setup" inside Client Directory must result in:

- Client Directory: expanded.
- Authentication & Account Setup: expanded.
- A cyan connector linking their left borders.
- Both cards receiving subtle relationship emphasis.

If the current accordion permits only one expanded card, update its state management to support multiple expanded cards.

Expanding one related feature must not collapse the other.

Do not automatically expand unrelated features.

Preserve manual expansion and collapse behavior.

## 3. Left-Side Connection Geometry

Reuse the existing left-side connection-rendering system.

Every active relationship must:

- Attach precisely to the originating card's left border.
- Extend horizontally into the reserved left gutter.
- Travel vertically toward the dependency card.
- Return horizontally to attach to the dependency card's left border.
- Use Mappr's cyan relationship color.
- Display subtle endpoint indicators where appropriate.
- Avoid crossing card content.
- Recalculate when cards expand, collapse, resize, or change position.

Use stable feature IDs and measured card geometry.

Do not introduce another graph-rendering system.

Avoid unnecessary layout recalculation.

## 4. Relationship Interaction Lifecycle

- Clicking a dependency activates that specific relationship.
- Both connected cards expand automatically.
- Clicking another dependency updates the active connection and ensures its endpoints are expanded.
- Previously expanded, unrelated cards may remain open unless manually closed.
- Manually collapsing either endpoint clears its active connection.
- If a dependency target is below the visible area, scroll it into view smoothly without unnecessary jumps.
- Preserve page state wherever possible.
- Respect reduced-motion preferences.

Do not draw connections to missing or unresolved dependency targets.

## 5. Improve Overview's Two-Column Layout

The current Capabilities and Requirements Gaps sections have significantly different content heights.

This is acceptable, but the layout should feel intentional rather than visually unbalanced.

Do not artificially stretch the shorter container to match the taller one.

### Recommended proportions

Use approximately:

- **65% width — Capabilities**
- **35% width — Requirements Gaps**

Account for the column gap so the actual layout remains within the available workspace width.

The Capabilities section is the primary workspace.

Requirements Gaps is the supporting analysis panel.

Keep both sections aligned at the top.

### Capabilities — Primary Workspace

- Use natural content height.
- Allow the feature list to grow as cards expand.
- Let the document scroll naturally.
- Preserve the reserved left gutter for dependency connectors.
- Ensure connectors remain correctly positioned during expansion and scrolling.
- Do not introduce unnecessary internal scrollbars.
- Avoid clipping connectors or expanded content.

### Requirements Gaps — Contextual Panel

- Use natural content height.
- Do not force it to match the height of Capabilities.
- On sufficiently large desktop viewports, make the panel sticky so it remains accessible while users explore features.
- Maintain an appropriate top offset beneath Mappr's persistent navigation.

**Important:** Sticky positioning must be conditional.

If the Requirements Gaps panel becomes taller than the available viewport because findings are expanded, allow normal page scrolling.

Do not trap users inside nested scrolling containers.

The panel must remain fully accessible.

## 6. Refine Visual Hierarchy

The current Overview contains large enclosed sections that can make the interface feel heavier than necessary.

Improve the hierarchy without changing Mappr's identity.

Requirements:

- Preserve the dark navy background and existing design tokens.
- Preserve amber for primary interaction emphasis.
- Preserve cyan for technical relationships.
- Avoid unnecessary large borders surrounding every section.
- Use spacing, typography, and subtle surface differences to distinguish primary content from supporting analysis.
- Reduce visual clutter without removing meaningful information.
- Keep Capabilities visually dominant.
- Keep Requirements Gaps clearly identifiable without making it compete with the primary workspace.

Do not introduce decorative gradients, excessive shadows, or unrelated colors.

The result should feel like one coherent engineering workspace, not two disconnected dashboard cards.

## 7. Responsive Behavior

The layout must adapt to available screen space.

### Desktop

- Approximately 65/35 column proportions.
- Capabilities remains the primary workspace.
- Requirements Gaps may use conditional sticky positioning.

### Smaller laptops and tablets

- Preserve readable feature titles, descriptions, dependency links, and review findings.
- Do not squeeze the columns to the point where content becomes difficult to read.
- Switch to a single-column layout when the available width is insufficient.

### Mobile

- Stack Capabilities and Requirements Gaps vertically.
- Disable sticky behavior.
- Preserve working dependency interactions.
- Prevent horizontal page overflow.
- Keep the left-side connector gutter usable.

Use sensible breakpoints based on actual content requirements rather than arbitrary device labels.

## 8. Preserve Existing Functionality

Do not change:

- Traceability data or backend contracts.
- Requirements finding generation or dismissal.
- Spinner-only button loading behavior.
- Architecture graph functionality.
- API Contract or Database views.
- Existing feature descriptions and implementation details.
- Mappr's shared motion conventions.

This task is limited to Overview's dependency interaction and the specified layout refinements.

## 9. Verification

Test the following interactions.

### Dependency behavior

1. Expand Client Directory.
2. Click its existing Authentication & Account Setup dependency link.
3. Verify both cards remain expanded.
4. Verify the connection attaches to the actual left borders.
5. Click another dependency and verify the relationship updates.
6. Collapse either endpoint and verify the connection disappears.
7. Test relationships between non-adjacent cards.
8. Confirm there are no duplicate connection controls.

### Layout behavior

1. Verify the desktop layout uses approximately 65/35 proportions.
2. Confirm both sections align at the top.
3. Confirm Requirements Gaps does not stretch to match Capabilities.
4. Scroll through the expanded feature list and verify conditional sticky behavior.
5. Expand enough requirements findings to exceed the viewport and verify all content remains accessible.
6. Test at 1366×768, 1440×900, and narrower widths.
7. Verify there are no unnecessary nested scrollbars or horizontal overflow.
8. Check that dependency connectors remain attached after scrolling, expanding, and resizing.

### Accessibility and regression

- Test keyboard interaction.
- Verify visible focus indicators.
- Verify reduced-motion behavior.
- Confirm existing Overview actions still work.
- Run lint, TypeScript checking, and the production build.

Inspect the actual rendered interface, not only the source code.

If browser verification tools are unavailable, clearly state what remains visually unverified.

## 10. Implementation Boundaries

Before editing, inspect:

- `Overview.tsx`
- Current Overview styles
- Existing dependency connector implementation
- Requirements findings components
- Shared motion tokens
- Relevant parent layout containers

Reuse existing components and functionality.

Do not introduce additional dependencies unless there is a demonstrated technical need.

Do not rewrite unrelated parts of Mappr.

Make the smallest maintainable changes that satisfy these requirements.

## 11. Completion and Stop Point

After implementation:

- Show the relevant code diff.
- Report which files changed.
- Report the tests that actually ran.
- Explain any remaining layout tradeoffs.
- Provide screenshots or browser verification evidence where available.

**STOP after these Overview improvements.**

Do not proceed to other Mappr views without approval.

### Final objective

Mappr's Overview should behave as a connected product blueprint.

Dependency links should reveal actual relationships, with both related features expanded and visually connected.

The layout should have a clear primary workspace and supporting analysis panel, with intentional asymmetry, readable content, and responsive behavior.

Preserve technical depth while making the interface easier to understand and navigate.
