# S4F Architecture frontend editing

Implemented in the frontend repository on 2026-11-12. Existing uncommitted Overview, S5 artifact-safety, Database, and other view changes were preserved. No backend files, activation flags, credit handling, dependencies, deployment configuration, or migrations were changed. Nothing was pushed or deployed. Deployment remains blocked until every Mappr view supports AI editing.

## Interface and request lifecycle

- Architecture now reuses the Overview Describe a Change composer, action buttons, accessibility treatment, server warnings, artifact-impact display, expiry display, and request lifecycle. The composer and full diff review sit below the canvas rather than covering its interactions.
- Native scope controls choose the whole architecture or the selected node's canonical ID. A selected target must resolve exactly once in the refreshed canonical data. Labels and React Flow display indexes are never sent as IDs. Clearing or losing a selected target cannot silently convert the request into a whole-architecture change.
- Each intentional new preview sends a fresh `crypto.randomUUID()` in `Idempotency-Key`. The body is `{instruction, context:{activeView:"architecture", selectedTarget:null|{kind:"architecture_node",id}}, expectedBaseRevision}`. Scope is captured at the Preview click, before asynchronous preflight; recovery retries preserve the captured body and key even if graph selection changes.
- Preview uses `POST /maps/:id/changes/preview`. Approval uses `POST /maps/:id/changes/:proposalId/apply` with `{approved:true,expectedBaseRevision}`. Rejection uses `POST /maps/:id/changes/:proposalId/reject` with `{rejected:true,expectedBaseRevision:<proposal base revision>}`. Rejection requires HTTP 200 with `contractVersion:1`, matching `mapId`, `proposalId`, `status:"rejected"`, matching `baseRevision`, and a valid `rejectedAt`. Empty/204 acknowledgements are not accepted.
- Preview does not install the proposal into canonical map data. Review shows complete server-returned added/updated/removed node fields, before/after values, added and removed connections, summary, warnings, predicted artifact impacts, and expiration. Server operations are opaque: the client never executes or rewrites them.
- An unresolved Architecture proposal requires explicit Apply or Reject before another preview. Closing a resolved review does not generate anything. Rejection preserves the draft and canonical map. Confirmed server expiry permits explicit closure without pretending rejection succeeded.
- Requests deduplicate pending actions, recheck edit authorization, and surface actual error codes/messages and request references. Uncertain preview, apply, and rejection outcomes retain their original identities and expose explicit recovery. `Retry-After` is enforced. An uncertain approval cannot be discarded or rejected. Interlock/policy failures never call `/iterate` as a fallback.

## Canonical state, graph, and artifact safety

- The existing workspace Overview controller remains the only canonical writer. Architecture delegates accepted data/revision to that owner and subscribes to its canonical snapshot; it does not allocate an independent revision.
- Apply validates the full authoritative receipt against the reviewed Architecture diff, original base, map/proposal identity, and revision. The diff validator rejects out-of-scope changes, missing sections, duplicate IDs, mismatched before-values, dangling edges, hidden connection-removal cascades, and no-op proposals.
- All existing canonical views receive the same accepted returned system. The existing high-water gate prevents stale GETs, delayed applies, and replayed receipts from replacing a newer revision or its artifact state. Post-commit refresh failures retain confirmed success rather than suggesting a new generation.
- Authorization loss invalidates both composers' authorization-bound proposals and retires the existing S5 session scope. A successful owner recheck through either composer restores the shared session state without reviving old proposals.
- S5 tracked reads, owner-only saved inspection, current-only exports, and revision/session-aware cache guards remain in place. Apply advances their existing canonical authority; commit-time artifact freshness is shown as historical receipt information, never used to bypass a fresh export check or regenerate output automatically.
- Architecture selection, manually moved node coordinates, and viewport live in the workspace and survive tab changes. Metadata-only node edits do not rerun Dagre. Real topology/edge-label changes use the existing layout/routing system, retaining manually moved positions by canonical ID. Ordinary preview/apply updates do not automatically reset the camera. Initial fit, canvas resizing, and explicit Fit/Readable controls retain their roles; fit bounds include manually moved nodes.
- Node inspection, Architecture Review and its S5 safeguards, version history, and version comparison remain available. The former immediate Architecture iteration input is replaced by the reviewed proposal flow; its existing history UI is retained in history-only mode. Overview's existing behavior remains available.

## Files changed for this task

| File | Change |
| --- | --- |
| `src/components/ArchitectureChangeComposer.tsx` | Architecture scope controls and complete server diff presentation using the shared composer. |
| `src/components/OverviewChangeComposer.tsx` | Shared Architecture presentation, explicit rejection/recovery, and scope-specific labels; existing Overview path preserved. |
| `src/components/OverviewChangeComposer.module.css` | Scoped target controls and responsive node/connection diff styling using existing tokens. |
| `src/components/MapWorkSpace.tsx` | Architecture lifecycle wiring to the canonical owner; persistent selection, scope, and canvas memory. |
| `src/components/ArchitectureCanvas.tsx` | Reviewed-edit entry integration, preserved canvas memory, metadata-independent layout, and retained history/inspection. |
| `src/components/IterationBar.tsx` | Optional history-only presentation, with existing comparison functionality. |
| `src/lib/change-protocol.ts` | Shared typed lifecycle interface for the existing Overview and new Architecture protocols. |
| `src/lib/architecture-change.ts` | Architecture controller, canonical target checks, and delegation to the shared owner. |
| `src/lib/architecture-change-contract.ts` | Architecture proposal/diff/receipt and rejection acknowledgement validation. |
| `src/lib/architecture-canvas-memory.ts` | Layout identity and fit-bounds helpers for canvas memory. |
| `src/lib/overview-change.ts` | Reused lifecycle with protocol delegation, explicit reject recovery, and shared authorization propagation. |
| `src/lib/api.ts` | Credentialed, uncached Architecture preview/apply/reject helpers; required rejection body and HTTP 200 receipt. |
| `src/lib/architecture-change.test.mjs` | Mocked API/controller integration, actual component-rendering, graph-memory, and artifact-scope tests. |
| `FRONTEND_S4F_ARCHITECTURE_EDITING.md` | This implementation and verification report. |

Other files in the working tree belong to pre-existing work and were not edited for this task.

## Verification

- `node --test src/lib/architecture-change.test.mjs src/lib/overview-change.test.mjs`: **53/53 passed** after the rejection-contract correction (24 Architecture and 29 existing Overview tests).
- Previous implementation verification: `node --test src/lib/artifact-safety.test.mjs src/lib/generated-artifact-cache.test.mjs src/lib/architecture-layout.test.mjs`: **68/68 passed** (48 artifact-safety, 8 generated-cache, and 12 layout tests). Those unrelated successful regressions were not rerun for the focused rejection correction.
- API traffic in the tests is mocked; unexpected routes fail the tests. No live AI generation was invoked.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: **passed after the rejection-contract correction**.
- `npm.cmd run lint`: **passed after the rejection-contract correction**.
- `npm.cmd run build`: **passed after the rejection-contract correction (exit 0)**; production compilation, Next.js TypeScript validation, page-data collection, and static-page generation completed. Next.js reported an existing external lockfile warning for `C:\Users\HomePC\package-lock.json`; no configuration was changed for that unrelated warning.
- `git diff --check`: **passed**, with existing Windows line-ending notices only.

Coverage includes whole/node request payloads and fresh keys, immutable preview, frozen scope, invalid targets, explicit rejection with the exact body and strict receipt validation, duplicate submissions, interlock failures, uncertain retries, Retry-After, expiry, conflicts, replays, late unmount responses, authorization loss/recovery, unreviewed receipt rejection, S5 revision invalidation, layout keys/bounds, actual rendered diff content, and retained history without legacy Architecture submission.

## Confirmed rejection-contract correction

The backend rejection contract was subsequently confirmed by the user and the bodyless/204 compatibility assumption was removed. This focused correction changes only `src/lib/api.ts`, `src/lib/change-protocol.ts`, `src/lib/architecture-change.ts`, `src/lib/architecture-change-contract.ts`, `src/lib/overview-change.ts`, `src/lib/architecture-change.test.mjs`, and this report. No view components were changed.

The shared rejection signature now requires the captured proposal base revision. Recovery sends the same proposal URL and exact body even if a newer canonical revision has arrived. Required response fields are validated before the proposal becomes locally rejected. Unexpected successful statuses (including 204), missing/mismatched fields, invalid timestamps, and malformed receipts preserve the unresolved proposal and rejection-recovery state without changing canonical data. Existing authorization rechecks, pending-action deduplication, Retry-After, preview idempotency, terminal-state guards, and canonical high-water protection are retained.

Focused tests cover the exact body, complete HTTP 200 receipt, HTTP 201/202/204 refusal, every missing required receipt field, mismatched identity/version/revision/status, invalid timestamps, successful recovery, rejection retries across canonical revision advancement, and blocked repeated rejection/approval after confirmed rejection. Focused tests, TypeScript, lint, and production build each ran once for this correction and passed; their final results are recorded in Verification above. No deployment or activation was performed.

## Remaining integration requirements and limitations

1. **No S4F backend handoff or implementation is present in this frontend repository.** Preview/apply use the existing S4B contract-v1 full `SystemDiff` and authoritative receipt envelopes, extended to `affectedSections:["architecture"]`. An optional echoed context must match the request. The backend operation registry is intentionally not guessed or executed client-side. Confirm these envelope details against the completed S4F backend before activation.
2. **The rejection request/receipt mismatch is corrected against the confirmed backend contract.** Live backend replay and rejection behavior still require integration verification; mocked tests do not establish production behavior.
3. Live cross-origin cookies/CORS, actual backend policy/interlock responses, real proposal expiration, actual persisted apply/reject replay, and artifact responses have **not** been exercised. Integration tests used mocked responses while leaving the activation interlock untouched.
4. Real-browser laptop/mobile layout, pointer dragging, retained viewport across structural edits, keyboard focus, and reduced-motion behavior remain for visual/integration QA. Native radio/form controls, existing focus treatment, responsive diff CSS, and shared reduced-motion-aware ActionButton are used. No browser automation scripts or extra UI animation were added. Structural edits still use the existing routed layout; routing around manually dragged nodes retains the existing canvas limitations.
5. AI editing is implemented here for Architecture alongside the existing Overview summary pilot. Other views are not newly enabled by this task. **Do not deploy or activate universal editing until all views are implemented and the backend contract/activation review is complete.**

## Redis receipt ordering correction — 2026-11-13

### Read-only incident evidence

The frontend development log identified map `57d205f9-c7e9-483c-8b34-b9d219d7a3ff`. Only the following live requests were made, all GETs against the existing local backend:

- `GET /maps/57d205f9-c7e9-483c-8b34-b9d219d7a3ff`: HTTP 200, canonical revision **2**, with a `cache` node labelled **Redis Cache** and an `api → cache` connection labelled **Cache**. The map's `updatedAt` was `2026-11-13T11:21:26.952Z`.
- `GET /maps/57d205f9-c7e9-483c-8b34-b9d219d7a3ff/versions`: HTTP 200, exactly revisions **1 and 2**. Revision 2 was recorded at `2026-11-13T11:21:25.585Z`, summary `Updated architecture: 1 node added, 1 edge added.`
- `GET /maps/57d205f9-c7e9-483c-8b34-b9d219d7a3ff/diff?from=1&to=2`: HTTP 200, exactly the Redis node and `api → cache` connection added, with all other diff sections empty.

These independent reads establish a durable revision containing the reported Redis change, with one corresponding history revision. No live Preview, Apply, Reject, generation, migration, or deployment action was submitted. The read responses do not expose the original proposal ID or original Apply receipt, so they cannot independently prove that proposal's identity or every field of its HTTP response. The failed Preview/Apply payloads and exact current S4F receipt handoff were requested; they are not stored in this frontend repository.

### Confirmed failing validation condition and fix

The old final condition in `assertArchitectureReceipt` required `sameData(value.data, architectureCandidate(base, proposal.diff))`. `sameData` compares arrays in order. The client projection appends added connections, but the observed authoritative graph places the new connection between existing ones:

```text
Client projection: web → api (HTTP), api → db (SQL), api → cache (Cache)
Committed backend: web → api (HTTP), api → cache (Cache), api → db (SQL)
```

The added connection cannot occupy the backend's middle position in any append-based projection. Consequently, the actual committed graph fails this validation condition despite containing exactly the documented graph changes. JSON object property order was already ignored and is not the problem.

Architecture receipt comparison now sorts copies of nodes by canonical ID and connections by their existing `(from,to,label)` identity before comparing the complete systems. It ignores graph collection ordering only. Every node/connection value, duplicate, missing identity, unrelated system section, proposal/map identity, original base revision, committed revision/version, complete diff, warning, timestamp, and artifact-freshness check remains enforced. Returned canonical arrays are not sorted or mutated; the workspace installs the validated authoritative data in its returned order.

The shared change controller and its canonical high-water gate were not modified. A verified receipt resolves the proposal as applied, clears pending/retry/error state and the submitted draft, and prevents another Apply. The existing applied review can then be closed. Genuine receipt/network failures remain uncertain; canonical content or a higher revision alone is never treated as proof that a specific proposal applied. Recovery retains the original proposal/request, and an older replay cannot replace newer canonical data or artifact state.

Only `src/lib/architecture-change-contract.ts`, `src/lib/architecture-change.test.mjs`, and this report changed for this correction. Overview, Tech Stack, canvas behavior, shared lifecycle, and S5 code were preserved.

### Verification and limits

- `node --test src/lib/architecture-change.test.mjs src/lib/overview-change.test.mjs src/lib/tech-stack-change.test.mjs src/lib/artifact-safety.test.mjs`: **127/127 passed** (28 Architecture, 29 Overview, 22 Tech Stack, 48 artifact-safety).
- Four new regression tests cover the observed Redis graph order, successful single-commit resolution and authoritative ordering, continued strict rejection of altered/duplicate/missing data, and uncertain-outcome recovery with one commit and newer-revision protection.
- The graph values/order in these tests come from the read-only evidence above. The test receipt envelope is a mock of the existing frontend contract, **not a captured original failed response**. The tests demonstrate the confirmed ordering mismatch; they do not rule out an additional envelope mismatch in the original response.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: **passed**.
- `npm.cmd run lint`: **passed**.
- `npm.cmd run build`: **passed (exit 0)**, including Next.js TypeScript validation and static-page generation. The existing external lockfile warning remains; no unrelated configuration changed.
- `git diff --check`: **passed**, with existing Windows line-ending notices only.

Live recovery of the original proposal was not attempted. Verifying every original receipt field or safely resolving that original uncertain UI state without another mutation still requires the original response/captured proposal identity or an existing backend read-only receipt source. No success is inferred from graph appearance alone. No features were activated, and nothing was deployed.
