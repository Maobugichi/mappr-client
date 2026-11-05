# ADDITIONAL REQUIREMENT — DATABASE GRAPH TOUCH INTERACTIONS

Improve the existing Database graph's mobile panning, zooming, and touch responsiveness.

Preserve all requirements in the original Database Initial Fit prompt.

## 1. Investigate touch responsiveness

Inspect:
- React Flow interaction props and current configuration.
- panOnDrag, zoomOnPinch, nodesDraggable, and preventScrolling.
- Any interaction-lock state.
- CSS touch-action, pointer-events, and overflow rules.
- Custom EntityNode touch and pointer handlers.
- Graph controls and viewport state updates.

Identify why mobile dragging sometimes feels unresponsive before making changes.

## 2. Natural mobile gestures

Ensure:
- One-finger dragging on empty canvas pans the graph immediately.
- Two-finger pinch smoothly controls zoom.
- Normal dragging does not move database nodes out of their calculated positions.
- Tapping an entity still selects it.
- Touch interactions do not accidentally activate unrelated controls.
- The graph follows finger movement directly without artificial animation delays.

Use React Flow's existing interaction features.

Avoid custom gesture libraries unless absolutely necessary.

## 3. Prevent gesture conflicts

Inspect and correct conflicts involving:
- Page scrolling versus graph panning.
- Touch-action CSS.
- Unintended pointer-event interception.
- Custom node interactions.
- Overlays covering the graph.
- Viewport updates overriding active gestures.

Apply touch behavior only where appropriate within the graph canvas.

Keep the surrounding Mappr page scrollable.

Do not solve the issue by disabling all scrolling or touch input across the page.

## 4. Improve zoom controls

Preserve the existing control layout and styling.

Ensure:
- Comfortable mobile touch targets, approximately 44px.
- Immediate visual feedback when controls are pressed.
- Smooth but restrained programmatic zoom transitions.
- Zoom In and Zoom Out work consistently.
- Fit View restores the entire graph.
- Controls do not obstruct essential graph content.

## 5. Preserve viewport stability

Do not reset zoom or pan during:
- Node selection.
- Relationship highlighting.
- Ordinary component rerenders.
- Touch gestures.
- Inspector interactions.

Preserve user-adjusted viewport position when switching away and returning to an unchanged graph, where supported.

Only calculate a new fit when appropriate, such as on initial graph load or genuine structural changes.

## 6. Performance

Avoid unnecessary React rerenders during continuous panning.

Inspect whether controlled viewport state or layout recalculation is causing gesture lag.

Use existing React Flow mechanisms rather than implementing competing animation or gesture systems.

No fake inertia, bounce, decorative motion, or unnecessary dependencies.

## 7. Verification

Test with actual mobile touch interactions where possible, not only desktop mouse simulation.

Verify:
- One-finger panning.
- Two-finger pinch zoom.
- Entity tapping and selection.
- No accidental entity movement.
- Zoom buttons and Fit View.
- Fast repeated gestures.
- Page scrolling outside the graph.
- First-load complete graph fit.

Report clearly which interactions were actually tested and which still require physical-device testing.

Run essential checks once and STOP for visual review.