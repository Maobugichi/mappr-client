# MAPPR — S5B Frontend Artifact Safety Integration

**Implementation assignment — frontend repository only. Stop for review after offline verification.**

## Mission

Integrate the existing frontend with the S5A backend's tracked artifact reads, stale inspection, guarded downloads and provenance-based cache invalidation. Close frontend-only export paths that could present saved, stale or unknown-provenance artifacts as current. Preserve the S4B Overview “Describe a Change” pilot, Architecture iteration, established artifact UI, and all unrelated work.

**Do not deploy, activate S4, run database migrations, invoke billable AI or modify the backend.** The backend S5A code has passed offline tests, but migration `015_artifact_provenance.sql` has **not** run and S5A is **not deployed**. Implement and test against mocked responses; do not treat the currently deployed backend as supporting these new endpoints.

This is a self-contained frontend contract because the backend and frontend repositories run in **separate VS Code environments**. The frontend agent cannot assume access to `FRONTEND_S5_HANDOFF.md` in the backend environment. If that file is also copied to this repository, read it; the essential contract is recorded below.

## Starting rules

1. Inspect the frontend repository instructions, current branch/Git status/diffs and relevant current components/utilities before editing. **Preserve unrelated tracked/untracked changes**, including existing Database canvas work and S4B. Never overwrite current implementations with historical assumptions.
2. Inventory actual artifact view GETs, generation/regeneration flows, existing artifact-cache utilities, export/download/copy/print/share handlers, and aggregate ZIP/project exports. Only inspect the files required to identify and protect these routes. Record an actual-route checklist; do not invent filenames or UI functionality.
3. Use existing Mappr layout, styling, ActionButton, focus/reduced-motion conventions and request primitives. No new animation framework or broad app-shell rewrite; don't create a second canonical map state store.
4. Preserve public shared-map viewing and normal canonical-data exports. Restrict only outputs that rely on generated artifacts without verified currentness. Preserve S2 owner/Origin rules.
5. No new packages unless absolutely necessary and justified. No silent regeneration, surprise AI calls or invented billing/refund behavior.

## Backend contract — currentness and inspection

All ten **structured artifact GETs** support `?freshness=tracked`:

- `/maps/:id/api-contract`
- `/maps/:id/relational-schema`
- `/maps/:id/document-schema`
- `/maps/:id/readme`
- `/maps/:id/adrs`
- `/maps/:id/env-vars`
- `/maps/:id/deployment`
- `/maps/:id/critique`
- `/maps/:id/requirements`
- `/maps/:id/traceability`

Tracked current read: HTTP 200 with existing artifact payload **and additive metadata** such as `sourceRevision`, `currentRevision`, `generationId`, `sourceFingerprint`, `generatorVersion`, `publishedAt`, `freshness: { status: 'fresh', reason: 'inputs_unchanged' }`, `isCurrent: true`, `inspectionOnly: false`, `readMode: 'tracked'`. Validate required metadata at runtime before treating data as current. Optional provenance fields may be null for unknown output. A source generated at older revision 7 can still be fresh against current revision 8 if its **declared inputs** are unchanged. Do not infer freshness from revision equality, hash matching, or legacy version numbers.

Tracked lookup with only saved stale/legacy output: **409 `artifact_stale`** with metadata and `inspectionUrl`, **no artifact payload**. Missing artifact/map: 404. Revision/provenance schema not ready: 503. Show clear stale/missing/unavailable states; do not revert to unchecked legacy reads or cached Blob downloads. Treat unknown provenance as unverified, not current.

Explicit **owner-only saved inspection** uses `GET /maps/:id/<artifact>?freshness=tracked&includeStale=true` with `credentials:'include'` and no-store. Missing/invalid established session -> 401, nonowner/unknown map -> 404. If only saved stale content exists, 200 includes the artifact with `isCurrent:false`, `inspectionOnly:true` and status/reason. Label it **Saved / out of date — inspection only** and prevent its content being exported, copied as current, combined with other artifacts as a current document, or substituted into current state. Shared public users may read verified current output but must not gain stale inspection or editing rights.

Legacy structured GETs remain backward-compatible but carry `readMode:'legacy'`; they are **not** currentness proof. An older-revision artifact may be reusable in tracked mode even where a legacy current-version read returns 404.

Freshness reasons include `inputs_unchanged`, `source_changed`, `generator_changed`, `payload_changed`, `provenance_unknown`, `not_generated`. Status values: `fresh`, `stale`, `missing`.

## Backend exports — use guarded routes

Use the backend's existing **current-only** export URLs, not unchecked client-side reassembly, for their supported output:

| Output | GET route |
|---|---|
| Relational SQL | `/maps/:id/relational-schema/sql?dialect=postgres|mysql|sqlite` |
| Document/mongosh script | `/maps/:id/document-schema/script` |
| ADR Markdown | `/maps/:id/adrs/markdown` |
| README Markdown | `/maps/:id/readme/markdown` |
| Environment example file | `/maps/:id/env-vars/file` |
| Deployment runbook Markdown | `/maps/:id/deployment/markdown` |

All six routes reject stale/unknown provenance with **409**, missing with **404**, and fail closed on missing schema/readiness (**503**); `includeStale` is invalid (**400**). Never turn a JSON error into a downloaded `.sql`/`.md`/`.env` file. Fetch on user action, handle status/content type safely, keep the existing file naming and success behavior. `Cache-Control: no-store` and `Vary: Cookie` apply. Backend may include `X-Mappr-Current-Revision`, `X-Mappr-Artifact-Generation`, `X-Mappr-Render-Fingerprint`; treat them as snapshot metadata rather than perpetual currentness. Same-revision regeneration of README support or deployment support may change a rendered download: **do not cache exports solely by map revision**. Preserve explicit notes when optional stale/missing supporting artifacts have been omitted from server-rendered README/deployment.

## Frontend-only and bulk export audit

Inspect and protect, **where actually implemented**, all export/copy/print/share paths for:

- API Contract JSON and OpenAPI/YAML conversion (no backend API-contract export route exists).
- Critique, requirements and traceability JSON/CSV/Markdown/report output (no backend export endpoint exists).
- Relational/document schema, ADR/README, environment/deployment locally constructed Blob/text/clipboard alternatives.
- Full project / All / ZIP / PDF exports and menus that compose generated artifacts. Keep canonical map data exports working, but do not package stale/unknown generated artifacts as current.

For frontend-only generated formats, require verified tracked current artifact state **at the time of export**, and ensure that the exact output corresponds to that state. If the safety precondition cannot be proved, block with a useful explanation (or explicitly omit a stale member with an accurate note when the aggregate format supports that). Never silently export stale inspection data as current. Do not invent new backend endpoints; capture any unsupported format accurately in the handoff.

## Request ordering, cache and mutations

- Keep the S4B workspace's **single canonical `{data,revision}` state and revision high-water mark**. A lower `currentRevision` tracked response cannot replace newer map/artifact state; request a refresh. `sourceRevision` is provenance, **not** the current canonical revision.
- Scope caches by map, **session context**, artifact type, and tracked-current versus saved-inspection read mode, plus format/dialect where needed. Do not expose cookie bytes in cache keys, logs or debugging.
- Independent artifact generations can be published at the same map revision. Use per-artifact request epochs/cancellation to ignore superseded network responses. `generationId` UUIDs are opaque identities, **not sortable timestamps**. Avoid stale overwrites after tab switching, map switching, or fast repeat fetches.
- After successful artifact POST/PATCH, refetch a tracked GET before installing it as **current** or enabling exports. Existing POST/PATCH bodies are not freshness leases. On `artifact_source_changed` / `artifact_publication_conflict` (409), refetch and explain; do not silently launch another billable request. On lost POST response, inspect tracked state before an intentional retry.
- After S4 Apply, legacy `/iterate`, or other accepted canonical mutation, invalidate affected generated-artifact caches and downloads. S4 preview impacts are predictions; apply freshness is an observed transaction snapshot; an old replayed receipt cannot overwrite a newer map/artifact cache.
- A new API/schema/ADR generation can invalidate assembled README output/download at the **same canonical revision**. New environment generation can invalidate deployment downloads. Avoid relying on revision alone for dependencies. Preserve existing generated artifact cache tests and behavior where they remain safe.
- Do not silently regenerate missing/stale artifacts or consume credits when opening a view/inspecting stale content.

## UX requirements

- Clear view states for **Verified current**, **Saved (out of date) — inspection only**, **Not generated**, **Unavailable**. These are descriptive UI statuses, not decorative colored badges everywhere.
- Display provenance/affected source revision where available, but never fabricate it. Avoid exposing hashes/IDs in ordinary prose unnecessarily.
- Explicit owner action to inspect stale saved output; never do this automatically on public/shared view loads.
- Disable unsafe download/copy/print actions with accessible explanation, not an inert control. Preserve owner permissions and keyboard focus, mobile layout and reduced-motion behavior.
- On 401/404, retain safe public read-only behavior; on 409/503, show actionable stale/unavailable state without substituting legacy content. Keep unrelated UI functional.

## Acceptance checks (offline)

Add/extend focused mocked API/controller/component tests for:

1. All 10 tracked structured routes, metadata parsing, verified current at older source revision, and 409/404/503 behavior without legacy fallback.
2. Explicit owner-only `includeStale` inspection, session changes, map switches; stale payload cannot enter current cache or be downloaded as current.
3. All six backend export URLs, dialects, content-type/error handling, safe download names; 400/401/404/409/503 and no stale local Blob fallback.
4. Actual discovered client-only export and aggregate paths. Assert stale/unknown components are blocked or explicitly omitted and current-only output is preserved.
5. Same-revision republishing and dependent-generation changes, delayed responses, generation identity handling, canonical high-water ordering, stale old S4 receipts, and response ordering across tab/map switches.
6. Post-generation tracked refetch, conflict handling, lost-response behavior without automatic repeat AI.
7. Current README/deployment omission notes, unknown provenance labels, accessible disabled controls, and existing artifact cache/Architecture/S4B behavior.

Run the repository's relevant focused tests, TypeScript, lint and production build. Record exact counts and warnings. Do not claim real browser/mobile, live backend, PostgreSQL, or cross-origin cookie verification unless actually performed. Do not change frontend API origin or deployment config just to exercise unavailable endpoints.

## Deliverables and STOP boundary

Create **`FRONTEND_S5B_ARTIFACT_SAFETY_IMPLEMENTATION.md`** containing:

- Actual files changed and actual export/copy/share/print/bulk paths inventoried (supported, guarded, not present or explicitly deferred).
- Key request/cache/mutation behavior and preserved S4B/S3 behavior.
- Precise test commands/results and limitations.
- Remaining backend dependencies (migration 014/015 still unapplied, S4 interlock/provider/credit policy, deployed backend version), plus live browser/API verification needs.
- Any unsupported formats or API-contract ambiguities without inventing an endpoint.

**Do not** modify backend code, run SQL, deploy frontend, push without approval, activate S4, change billable provider behavior/credit policy or expand the pilot to another view. **STOP for review** after offline verification.
