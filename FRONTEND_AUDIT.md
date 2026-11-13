# Architecture change composer: frontend audit

Scope: frontend source inspection only. Read `AGENTS.md` and `CLAUDE.md` (which delegates to `AGENTS.md`). No backend files, services, or live contracts were inspected; no API calls, runtime tests, or builds were run. Application code and pre-existing Database canvas changes were preserved. Backend behavior below is an **expected frontend contract**, not verified server behavior.

## Confirmed flow

- **Input:** [IterationBar.tsx:30](src/components/IterationBar.tsx#L30) owns a single-line draft. Enter or the arrow submits trimmed, nonempty text; the input and submit button disable while `isRunning`. There is no length limit, explicit input label, or IME composition guard. The composer sits inside Architecture's bottom-center React Flow panel ([ArchitectureCanvas.tsx:500](src/components/ArchitectureCanvas.tsx#L500)).
- **Apply:** [ArchitectureCanvas.tsx:218](src/components/ArchitectureCanvas.tsx#L218) sets pending, clears the prior error, and awaits `runIteration`. Success records `v{version}: {summary}`, increments a local history refresh counter, and calls `onSystemUpdated(result.data)`. The frontend does **not** apply `result.patch` itself or validate the returned map ID, version, or data shape.
- **Errors/loading:** API errors show `body.message ?? body.error`; other failures use a generic message. Pending resets in `finally`; the existing graph remains visible. This composer uses disabled controls, not the shared spinner-only button or an announced busy state.
- **Confirmed draft-loss bug:** the parent catches errors without rethrowing, while [IterationBar.tsx:52](src/components/IterationBar.tsx#L52) clears the draft after any resolved `onSubmit`. Failed requests therefore clear the instruction too.
- **Review/confirmation:** submission applies immediately from the frontend's perspective. No proposal, preview, approval, or undo step is wired. Architecture Review is a separate critique workflow, not mutation approval ([ArchitectureCanvas.tsx:125](src/components/ArchitectureCanvas.tsx#L125), [ArchitectureReview.tsx:44](src/components/ArchitectureReview.tsx#L44)). Existing critique/highlights are not refreshed after iteration; an open historical diff is retained.
- **History:** opening history fetches versions; successful local iterations refresh an already-open list. Two versions can be selected, with a third replacing the oldest selection; comparison sorts the pair numerically. Fetch failures only log to console, and there is no history-loading state. `DiffView` summarizes historical changes across the base system, not full before/after documents or separate generated artifacts. There is no restore action ([IterationBar.tsx:35](src/components/IterationBar.tsx#L35), [DiffView.tsx:112](src/components/DiffView.tsx#L112)).

## Existing frontend-to-backend contract

Base URL: `NEXT_PUBLIC_API_URL`. Requests use JSON content type and `credentials: 'include'`. Non-2xx responses become `ApiError(status, { error, message?, details? })`; malformed error JSON falls back to `unknown_error`. Successful JSON is TypeScript-cast, without runtime validation ([api.ts:438](src/lib/api.ts#L438)).

| Request | Payload | Expected result |
| --- | --- | --- |
| `POST /maps/{mapId}/iterate` | `{ "instruction": "<trimmed text>" }` | `{ mapId: string, version: number, summary: string, patch: ArchitecturePatch, data: MapprSystem }` |
| `GET /maps/{mapId}/versions` | None | `{ version: number, summary: string, createdAt: string }[]` |
| `GET /maps/{mapId}/diff?from={number}&to={number}` | None | `{ mapId, from, to, diff: SystemDiff }` |
| `GET /maps/{mapId}` | None | `MapRecord { id, createdAt, updatedAt, data }`; no current-version field in this frontend type |
| `GET` / `POST /maps/{mapId}/critique` | None | `ArchitectureReview`; GET maps HTTP 404 to `null` |
| `PATCH /maps/{mapId}/critique/findings/{findingId}` | `{ dismissed: boolean }` | Updated `ArchitectureReview` |

Sources: [api.ts:119](src/lib/api.ts#L119), [api.ts:507](src/lib/api.ts#L507), [api.ts:564](src/lib/api.ts#L564).

`ArchitecturePatch` supports node add/remove/update and edge add/remove only. `MapprSystem` covers meta, product, users, features, tech stack, architecture, data model, design system, and development plan. Iteration sends no view/scope, target IDs, artifact content, base revision, or idempotency key. Its helpers expose no cancellation/job/streaming protocol.

## Shared state, navigation, and persistence

- [MapWorkSpace.tsx:55](src/components/MapWorkSpace.tsx#L55) owns the full client system in `useState(initialData)`. Architecture and Overview receive `setData`; other base-system views read this shared snapshot. Replacing it updates those views. The owner is keyed by map ID, isolating projects; it does not retain the iteration's version number.
- Only the active view mounts. Switching tabs destroys Architecture's draft, pending/error/summary, history selection, review, and diff state. Keyboard tab-list navigation moves focus before activation ([WorkspaceTabs.tsx](src/components/WorkspaceTabs.tsx)).
- [artifact-workspace.tsx:7](src/lib/artifact-workspace.tsx#L7) provides memory-only, map-scoped artifact/UI caching. Any new `data` object replaces the entire cache. `usePreservedViewState` restores on mount; mounted hook values do not automatically reset when that cache changes. The Architecture composer does not use it.
- [generated-artifact-cache.ts:17](src/lib/generated-artifact-cache.ts#L17) deduplicates loads and locks operations **per artifact entry**, retains successful content on failure, and caches successful empty results. [use-generated-artifact.ts:20](src/lib/use-generated-artifact.ts#L20) subscribes to entries; generation can finish after its reader unmounts. This is not a workspace-wide mutation coordinator.
- API Contract, relational/document schemas, ADRs, README, Env Vars, and Deployment have separate records/endpoints. Frontend types use `version` or `techArchHash`; comments describe dependency rules that require backend confirmation. Updating `MapprSystem` clears the frontend cache but does not itself regenerate these artifacts ([api.ts:236](src/lib/api.ts#L236)).
- The page title/summary remain server-rendered outside the client state owner. A future meta change would leave them stale until refresh ([maps/[id]/page.tsx:22](src/app/maps/[id]/page.tsx#L22)).

## Reuse and integration risks

| Reusable frontend piece | Qualification |
| --- | --- |
| [IterationBar.tsx](src/components/IterationBar.tsx) | Input/history wiring; decouple architecture wording and canvas placement, and fix failure draft clearing first. |
| [ActionButton.tsx](src/components/ActionButton.tsx), [MotionDisclosure.tsx](src/components/MotionDisclosure.tsx), [motion tokens](src/app/globals.css#L27) | Existing pending, accessibility, disclosure, and reduced-motion primitives. [ArtifactActions.tsx](src/components/ArtifactActions.tsx) specifically encodes generation/export icons. |
| `getVersions`, `getDiff`, [DiffView.tsx](src/components/DiffView.tsx) | Existing retrospective comparison; the reader is a fixed-width canvas overlay and provides summaries rather than approval-quality field diffs. |
| [artifact-workspace.tsx](src/lib/artifact-workspace.tsx), [generated-artifact hook](src/lib/use-generated-artifact.ts) | Persistence/request-lifecycle patterns; iteration needs shared ownership rather than a per-artifact lock. |
| [Overview.tsx:174](src/components/Overview.tsx#L174) | Already calls the same iteration endpoint for editable component-fix instructions, using a synchronous operation ref and shared `onSystemUpdated`. |

**Principal integration risks:** Architecture iteration has only a render-time submission guard, no synchronous request lock, abort, or stale-response epoch. Navigating away leaves its POST running; success can still replace the mounted workspace's data, while feedback is lost. Returning allows another submission; out-of-order full-system responses can overwrite newer client state. Critique, comparison, Overview fixes, and artifact generation are not coordinated globally. Open history refreshes only from Architecture's own counter, not every shared-system update. A universal composer therefore needs workspace-level draft/request/result/revision ownership, explicit target context, and agreed artifact invalidation semantics; merely mounting the current bar in every tab is insufficient.

## Questions for the backend audit

1. Is `/iterate` architecture-only or capable of changing every base-system section? What invariants and stable-ID guarantees does it enforce?
2. How should requests target a view, selected entity/feature, schema mode, or separate generated artifact? Are new endpoints or typed scope fields required?
3. Are persistence, version creation, and the returned full `data` snapshot atomic and authoritative? Can responses be partial or mismatched with `patch`?
4. What concurrency, base-version/conflict detection, and idempotency guarantees exist, including races with artifact regeneration and retries after uncertain network failures?
5. Which reviews, traces, schemas, contracts, ADRs, README, Env Vars, and Deployment records become stale after each change? Are version/hash rules and invalidation metadata documented?
6. Is execution synchronous, asynchronous, or streamable? What are timeout, cancellation, commit-after-disconnect, and operation-status recovery semantics?
7. Is there a proposal/preview/confirm/reject protocol, and does it bind approval to an unchanged base revision?
8. What do history versions snapshot, how are they ordered/paginated, and are historical retrieval, restoration, or undo supported?
9. What ownership/authentication, cookie/CORS/CSRF requirements, instruction limits, validation schemas, and typed/retryable error responses must a universal frontend honor?
