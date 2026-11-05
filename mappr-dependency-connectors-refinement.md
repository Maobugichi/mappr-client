# MAPPR — FEATURE DEPENDENCY CONNECTOR REFINEMENT

Refine the feature dependency connection lines shown in Mappr's Overview feature explorer, especially on mobile screens.

IMPORTANT: This is a visual refinement of the existing dependency connections, NOT a layout redesign.

## 1. Inspect first

Inspect:
- The current feature dependency rendering component.
- Connector path calculations and positioning.
- Hover, selection, and expansion behavior.
- Existing design tokens and motion utilities.
- AGENTS.md and Git status.

Preserve existing functionality and uncommitted changes.

## 2. Softer connector geometry

The current bright cyan dependency lines are too rigid and visually dominant.

Give them a subtle, slightly whimsical character while maintaining Mappr's precise technical appearance.

Requirements:
- Use gently rounded corners and smooth joins.
- Prefer subtle Bézier transitions or rounded elbows where appropriate.
- Keep the overall connection path predictable and easy to trace.
- Use rounded line caps.
- Target approximately 1.5–2px stroke width.
- Preserve clear attachment points between connected features.
- Avoid exaggerated curves, loops, scribbles, or decorative flourishes.

The result should feel refined and organic, NOT playful or cartoonish.

## 3. Reduce visual intensity

Use a quieter default connector color.

Suggested starting palette:
- Default connector: #557D8C
- Hovered relationship: #72A7B4
- Focused/selected relationship: #8ABCC9
- Unrelated relationships during focus: subdued slate-blue.

These are starting values, not mandatory final colors.

Adjust them against the actual Mappr background to achieve sufficient readability without overpowering the content.

Do not use bright #7DD3E8 for every connector in its resting state.

Keep amber reserved for Mappr's existing selection behavior.

## 4. Context-sensitive emphasis

Default:
- Connections remain subdued but recognizable.

Hovering a related feature:
- Only the associated connection becomes slightly brighter.
- Use a restrained 100–160ms color transition.

Selecting a feature:
- Emphasize its actual dependency relationships.
- Keep unrelated connections visually secondary.

Deselection:
- Restore the original quiet appearance.

Do not introduce glowing, pulsing, breathing, or continuously animated lines.

Respect prefers-reduced-motion.

## 5. Preserve layout stability

The connector refinement must not:
- Move feature cards.
- Change card spacing or widths.
- Alter the current dependency expansion behavior.
- Trigger unnecessary graph or layout recalculations.
- Break existing dependency links.
- Introduce additional controls.

Maintain correct connector alignment when cards expand, collapse, resize, or change position.

## 6. Mobile responsiveness

Pay special attention to the narrow mobile layout shown in the screenshot.

Ensure:
- Connector lines stay aligned with the relevant feature cards.
- Curves and branches do not overlap feature text.
- Connectors remain visible without dominating the screen.
- Long dependency chains remain understandable.
- The connection gutter doesn't unnecessarily consume horizontal space.
- Existing tap targets and scrolling remain functional.

Do not hide meaningful relationships merely to improve appearance.

## 7. Accessibility

Check meaningful connector contrast against the actual background.

Use shape, position, and existing labels to communicate relationships, not color alone.

Preserve keyboard focus behavior and accessible dependency information.

## 8. Verification

Review:
- Desktop and mobile connector appearance.
- Default, hover, selected, and deselected states.
- Multiple visible dependencies.
- Card expansion and collapse.
- Window resizing.
- Reduced-motion behavior.

Run relevant checks once.

Report files changed, verification results, and any limitations.

STOP for my browser visual review.

GOAL: Quiet, elegant dependency connectors with gentle organic geometry. The relationships should support the feature content rather than compete for attention