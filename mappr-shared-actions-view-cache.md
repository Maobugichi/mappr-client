# MAPPR — SHARED ARTIFACT ACTIONS & VIEW STATE PRESERVATION

Implement two improvements across Mappr's generated-artifact views.

## Stage 1 — Standardize Regenerate and Export

Inspect the existing shared ActionButton, toolbar implementations, icons, motion tokens, and related CSS.

Create one consistent action pattern across API Contract, DB Schema, ADRs, README, Env Vars, Deployment, and other applicable generated-artifact views.

Requirements:
- Use the same Phosphor ArrowsClockwise icon for every Regenerate action.
- Use the same Phosphor DownloadSimple icon for every Export action.
- Match button shape, height, padding, radius, spacing, hover, and focus states.
- Desktop may display icon + label following the established shared pattern.
- Mobile uses compact icon-only controls.
- Preserve descriptive aria-labels and tooltips.
- Reuse the existing shared ActionButton; create a small ArtifactActions wrapper only if useful.
- Preserve each view's existing export format and functionality.
- Preserve the spinner-only pending behavior for actual regeneration.
- Do not add artificial loading states to synchronous downloads.

Avoid separate duplicated button styles across views.

## Stage 2 — Prevent unnecessary loading when revisiting views

Investigate why generated views such as DB Schema load again when the user navigates away and returns.

Inspect:
- MapWorkSpace and view-switching behavior.
- Component mount/unmount lifecycle.
- Existing generated-artifact fetching and state management.
- Existing caching or query utilities.
- Schema selection state and regeneration lifecycle.

Identify the actual cause before changing anything.

Desired behavior:
1. The first visit loads the generated artifact normally.
2. Switching to another Mappr view does not discard the successful result.
3. Returning to a previously loaded view displays its existing artifact immediately without a blocking loader.
4. Preserve meaningful selection state, such as the selected DB Schema table, where practical.
5. Preserve the last successful artifact while regeneration is pending.
6. After successful regeneration, replace/invalidate the relevant cached data.
7. Errors must not permanently invalidate working cached content.
8. Loading a different Mappr project must never display artifacts from the previous project.
9. Prevent duplicate in-flight requests and unnecessary repeated fetching.

Prefer existing shared state or query-cache mechanisms.

If an existing query library is available, configure its cache and invalidation appropriately.

Do not install a new state-management library unnecessarily.

Do not keep all graph-heavy views mounted merely to preserve their state.

Do not persist credentials or sensitive configuration values to localStorage.

Do not change backend contracts or introduce new AI generation calls during ordinary navigation.

## Verification

Check:
- Consistent action icons and responsive styling across applicable views.
- Regenerate and Export still perform their original actions.
- DB Schema loads normally on the first visit.
- DB Schema reopens immediately after switching away.
- Previously selected schema table remains selected where supported.
- Regeneration updates the cached artifact.
- Different project IDs never share stale data.
- Other views do not regress.
- No duplicate requests during rapid navigation.

Read AGENTS.md, inspect Git status, and preserve existing work.

uuy