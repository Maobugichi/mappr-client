# S4B Overview change pilot implementation

Implemented the frontend-only Overview pilot from `mappr-s4b-frontend-overview-change-pilot.md`. This is an implementation for review and offline testing, **not release authorization**. The backend was not inspected, modified, called, or enabled. No flags, cookies, migrations, provider adapters, credit rules, or dependencies were changed.

## UI and behavior

- Added **Describe a Change** to Overview only, scoped explicitly to `product.summary`. The separate `meta.oneLineSummary` header remains unchanged. Architecture's existing iteration and Overview's Add component fix still use their original endpoint/workflow.
- Eligibility is checked in the browser through `/maps/:id/edit-eligibility` on Overview entry, window focus while in Overview, and before each pilot write. Unknown, malformed, missing-session, origin-denied, and non-owner responses do not grant editing. Map reading remains available.
- The workspace owns the draft, request identity, preview, pending operation, errors, and accepted canonical snapshot. Switching tabs does not discard a draft or pending preview/apply. Unmounting/changing maps invalidates obsolete requests and authorization-bound proposal actions; no browser storage or module-global composer cache is used.
- Preview displays the actual server summary, complete before/after product summary, affected section, warnings, predicted artifact impacts, and absolute expiry. A preview never replaces canonical data. Invalid, incomplete, wrong-map, or out-of-pilot proposals cannot enable Apply.
- **Apply approved change** sends explicit approval for the stored proposal/base revision. Discard closes a ready preview without clearing the instruction or claiming server cancellation/refund. An uncertain approval retains its proposal for same-request outcome recovery.
- Shared `ActionButton` provides spinner-only pending behavior. The composer uses existing colors, fonts, motion/focus conventions, a labeled textarea, normal form submission, readable status/error messages, and a stacked mobile diff. Enter in the textarea remains a normal newline rather than an automatic submission.
- Expiry uses the server's absolute `expiresAt` and exposed `Date` when available. Expired previews remain readable with Apply disabled; replacement previews are explicit. A recovery retry may still retrieve an already-committed receipt after local expiry.
- Failed preview/apply preserves the instruction. Safe preview retries retain the exact body and UUID; deliberate new previews get a new UUID. Retry-After is observed. HTTP 500/network uncertainty does not imply rollback or authorize a second approval identity.
- `feature_disabled`, `preview_policy_not_configured`, and `revision_not_ready` display unavailable errors. There is **no fallback to `/iterate`**, fake successful preview, frontend flag override, or test-only production UI route.

## Revision and generated-output handling

The existing workspace now has one canonical `{data, revision}` owner, rather than a second competing store. Map loading passes through an optional S3 revision; legacy/unversioned maps remain readable, but no revision 1 is invented to permit editing.

All accepted browser map reads, pilot receipts, and existing iteration callbacks pass the same gate. Higher revisions install data/revision atomically; older responses cannot replace newer data or artifact metadata. Equal revisions require identical canonical data independent of object-key order; divergent equal-revision responses preserve accepted data and require refresh. Wrong-map/incomplete responses are rejected. A preview becomes non-actionable when its base is no longer current.

An older apply receipt can confirm its committed outcome while leaving a newer displayed map intact. Applying/recovering refetches the current map before another change. Revision conflicts retain the instruction/diff, refresh coherent data, and require a deliberate new preview; they never auto-rebase or auto-apply.

Accepted replacement data invalidates the existing source-scoped artifact cache through its established provider. Architecture history refreshes when the accepted canonical revision changes. No artifact is silently regenerated. Receipt freshness and apply warnings are displayed as commit-time information, and a workspace caution survives closing a review or starting another preview. These measures **do not implement or promise backend S5 current-only export protection**.

## Files changed by this task

| File | Change |
| --- | --- |
| [src/components/OverviewChangeComposer.tsx](src/components/OverviewChangeComposer.tsx) | Overview-only composer, semantic server diff, expiry, approval/discard, recovery, and freshness/warning presentation. |
| [src/components/OverviewChangeComposer.module.css](src/components/OverviewChangeComposer.module.css) | Scoped responsive typography, diff layout, focus and reduced-motion treatment. |
| [src/lib/overview-change.ts](src/lib/overview-change.ts) | Workspace-scoped canonical gate and pilot request/state lifecycle. |
| [src/lib/overview-change-contract.ts](src/lib/overview-change-contract.ts) | S4B types and runtime validation of pilot scope, full diff, canonical data, and apply receipts. |
| [src/lib/overview-change.test.mjs](src/lib/overview-change.test.mjs) | Mocked HTTP/controller tests and offline component rendering. |
| [src/lib/api.ts](src/lib/api.ts) | Additive revision/error metadata and uncached credentialed eligibility/map/preview/apply helpers; existing request routes remain unchanged. |
| [src/components/MapWorkSpace.tsx](src/components/MapWorkSpace.tsx) | Own pilot/canonical state above tab mounting and integrate the Overview composer. |
| [src/app/maps/[id]/page.tsx](src/app/maps/[id]/page.tsx) | Pass the server-provided revision to the existing workspace. |
| [src/components/ArchitectureCanvas.tsx](src/components/ArchitectureCanvas.tsx) | Forward existing iteration version/map ID to the gate; refresh history on canonical revision changes. No graph/composer redesign. |
| [src/components/Overview.tsx](src/components/Overview.tsx) | Forward version/map ID from the existing component-fix response to the gate. |
| [src/components/AllView.tsx](src/components/AllView.tsx) | Propagate that same existing callback signature. No view redesign. |
| This report | Implementation, verification, and integration limits. |

Preserved pre-existing work: the deleted `mappr-techstack-v2.md`, modified Database canvas, its untracked CSS, earlier audit/contract documents, and the S4B brief. No Database layout, API Contract, exports, or unrelated view implementation was edited.

## Verification

| Check | Actual result |
| --- | --- |
| `node --test src/lib/overview-change.test.mjs src/lib/generated-artifact-cache.test.mjs` | **37 passed, 0 failed**: 29 new pilot tests and 8 existing artifact-cache tests. All pilot HTTP is mocked to `https://api.mappr.test`; no live/billable writes. |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | **Passed**, exit 0 on the final source. |
| `npm.cmd run lint` | **Passed**, exit 0 on the final source. |
| `npm.cmd run build` | **Passed**, exit 0. Next.js 16.3.3 compiled successfully, completed TypeScript verification, and generated all 4 static pages; `/maps/[id]` remains dynamic. |
| Git diff review / `git diff --check` | Reviewed the scoped integration changes; no whitespace errors. |

Tests cover exact request bodies/credentials/cache behavior, owner/unknown eligibility, missing revisions, unavailable interlock states, no canonical preview mutation, explicit atomic approval, duplicate submissions, stable retry identity, Retry-After, failed submission draft retention, expiry/server clock, conflicts, stale/equal/replayed revisions, legacy callback ordering, wrong-map responses, map switching, session eligibility loss, malformed/out-of-scope data, post-commit refresh failure, and artifact warnings. Offline rendering verifies readable server-returned content, labels, expiry and approval controls. Existing cache tests check source isolation, invalidation, operation locking and failure retention.

During setup, the first native Node run rejected a TypeScript constructor parameter property; it was replaced with ordinary field initialization. One rendering test initially encountered Phosphor's CommonJS entry behavior under Node; it now uses the established direct-icon ESM testing pattern. Final tests pass. Native Node reports the existing package's typeless-module warning; no package-wide module change was made. PowerShell blocks `npm.ps1`, so checks used `npm.cmd` or the installed TypeScript executable without changing execution policy.

The production build also warned that it ignored a lockfile outside this repository (`C:\Users\HomePC\package-lock.json`). This did not fail the build; no unrelated root/configuration changes were made. The build log is retained at `%TEMP%\mappr-s4b-production-build.log`.

## Contract assumptions and remaining integration limits

- The S4B brief is authoritative for the new apply fields, including `version` and `warnings`. Responses matching only the older compatibility document's abbreviated example are not silently accepted. Ready proposals must contain the full existing SystemDiff with exactly the approved product-summary effect; apply must return the same diff and complete matching canonical snapshot.
- The currently configured API origin is **`http://localhost:4000`**. Production frontend/backend domains and their cookie delivery were not verified. `credentials:include` does not fix cross-site SameSite restrictions. No cookie or Origin header policy was changed; denied/unknown eligibility remains a visible integration blocker.
- Eligibility exposes only `mapId/canEdit`, not an observable session identity. HttpOnly cookie changes cannot be read directly by the frontend. The controller uses map/lifecycle isolation and repeated server eligibility checks; the backend must continue reauthorizing every preview/apply/replay. No frontend ownership recovery or claiming is inferred.
- A hidden/unavailable backend remains hidden/unavailable. Provider wiring, credits, S5 freshness/export enforcement, and production activation are separate gates. No quota/refund promises were added to the UI.
- The existing artifact cache still invalidates by canonical source object and reloads through existing artifact routes. Comprehensive tracked stale-artifact inspection/export gating was deliberately not implemented as part of S4B. Receipt freshness is not a live guarantee; apply can succeed while a subsequent refresh fails, in which case success is retained and another edit requires refresh.
- Full document reload, map unmount, or a lost browser session does not retain proposal identity in storage. Durable proposal discovery/recovery after that loss would need an agreed backend recovery contract and privacy policy.
- No actual browser automation, visual approval, physical mobile layout, focus restoration, assistive-technology run, reduced-motion browser emulation, production cookie/CORS test, or live S4A request was performed. Responsive/reduced-motion verification here is source/SSR-level only. Existing Architecture iteration's input/error behavior was preserved rather than independently redesigned.

## Next limited action

Review this diff and the Overview UI with authorized mocked responses. Then coordinate a separate controlled frontend/backend integration check only after the relevant backend gates are ready. This implementation does not authorize enabling the production interlock or extending support to another view.
