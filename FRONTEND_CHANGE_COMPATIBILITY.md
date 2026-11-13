# Frontend change compatibility review

Scope: frontend source inspection against [the review instructions](mappr-frontend-change-compatibility-review.md) and [the proposed backend contract](BACKEND_CHANGE_CONTRACT.md). Read `AGENTS.md` and `CLAUDE.md`. Backend implementation, deployed migrations, authorization, cookies, and live responses were not independently inspected. All new backend behavior below remains **proposed**. No application code was changed; no builds, browser tests, or API calls were run.

## 1. Overall compatibility verdict

**Compatible with coordinated frontend changes; not ready to connect or release as-is.** The Overview pilot targets the correct field: `product.summary`. Existing canonical data and `SystemDiff` types provide a useful foundation, and the existing button/motion primitives can support the UI without another framework.

Release blockers are the missing atomic data/revision owner, response-ordering guards, durable-in-workspace composer state, tracked artifact inspection/export handling, and server-provided editing eligibility. Legacy Architecture iteration and Overview fixes must participate in the same revision safeguards. Adding only preview/apply helpers would leave overwrite and stale-output risks unresolved.

Backend stages S2–S5 and the frontend ordering/freshness gates must be operational before exposing the pilot. This audit does not establish their implementation status.

## 2. Confirmed frontend findings

| Area | Confirmed implementation and implication |
| --- | --- |
| Pilot field | [Overview.tsx:308](src/components/Overview.tsx#L308) renders `product.summary`; it receives no `meta` prop. The page header separately renders `meta.oneLineSummary` in [page.tsx:23](src/app/maps/[id]/page.tsx#L23). A summary-only edit should change Overview, not that header. |
| Canonical state | [MapWorkSpace.tsx:55](src/components/MapWorkSpace.tsx#L55) owns `useState(initialData)` and passes raw `setData` to Architecture, Overview, and All. It retains no revision, freshness, or permission metadata. The workspace is keyed by map ID, but same-map prop refreshes do not reinitialize that state. |
| Current submission | [api.ts:564](src/lib/api.ts#L564) posts only `{instruction}` to `/maps/:id/iterate`; [ArchitectureCanvas.tsx:218](src/components/ArchitectureCanvas.tsx#L218) immediately installs returned `data`, records its version summary, and refreshes local history. No preview/approval, revision gate, map-response validation, or synchronous iteration lock exists. |
| Draft-loss bug | [IterationBar.tsx:52](src/components/IterationBar.tsx#L52) clears its instruction after `onSubmit` resolves. Architecture catches errors without rethrowing, so a failed submission also clears the draft. Input has no length limit or explicit label and Enter does not check IME composition. |
| Overview fix scope | [Overview.tsx:22](src/components/Overview.tsx#L22) builds an instruction to add an Architecture component for a feature. [Its apply handler](src/components/Overview.tsx#L174) calls legacy iteration and installs full data. Its synchronous operation ref preserves a failed draft, but provides no cross-view revision coordination. This is not a product-summary edit. |
| Navigation | [MapWorkSpace.tsx:116](src/components/MapWorkSpace.tsx#L116) mounts only the active view. Architecture's local draft, pending state, feedback, history selection, and diff disappear on tab changes. Its request can continue and call the still-mounted parent's setter afterward. Returning can permit a second request. |
| API transport | [api.ts:438](src/lib/api.ts#L438) exposes error/status/message/details, but not typed `retry`, `requestId`, or response headers. Requests include browser credentials; successful JSON is cast without runtime validation. `MapRecord` lacks revision/freshness/capabilities, and no preview/apply helpers exist. |
| Cache lifetime | [artifact-workspace.tsx:8](src/lib/artifact-workspace.tsx#L8) recreates the entire cache whenever `data` changes identity. This discards artifact entries and unmounted views' saved UI state rather than marking results stale. Mounted `usePreservedViewState` values do not automatically reset with the cache. |
| Artifact operations | [generated-artifact-cache.ts:17](src/lib/generated-artifact-cache.ts#L17) deduplicates/locks per entry and retains prior records on failure. [use-generated-artifact.ts:20](src/lib/use-generated-artifact.ts#L20) lets generation survive reader unmount. There is no canonical-revision/session/freshness gate. `resultRevision` is a local operation counter, not a system revision. |
| History and diff | [IterationBar.tsx:35](src/components/IterationBar.tsx#L35) loads versions on open/local refresh; failures only log. [DiffView.tsx:124](src/components/DiffView.tsx#L124) is a fixed 420px canvas overlay; the product summary displays only “summary changed,” not before/after. It is retrospective comparison, not an approval reader. |
| Independent reviews | Architecture critique and Overview requirements/traceability use local controllers outside the shared artifact cache. Their saved results have no frontend freshness metadata and are not comprehensively invalidated after canonical edits. |

Existing frontend contract: `GET /maps/:id` expects `{id,createdAt,updatedAt,data}`; iteration expects `{mapId,version,summary,patch,data}`; history returns `{version,summary,createdAt}[]`; diff returns `{mapId,from,to,diff}` ([api.ts:45](src/lib/api.ts#L45), [api.ts:127](src/lib/api.ts#L127), [api.ts:571](src/lib/api.ts#L571)). Backend-only schema names in the proposal are not frontend runtime validators.

## 3. Contract mismatches and required agreements

**Wire integration:** add explicit proposal/apply types and helpers. Preview sends `{instruction,context,expectedBaseRevision}` plus a stable UUID `Idempotency-Key`; apply sends only `{approved:true,expectedBaseRevision}` to the proposal URL. Preserve returned `contractVersion`, context, operations, complete diff, warnings, impacts, expiry, and receipt metadata. Never submit an edited candidate/operations or interpret preview as canonical data. Existing `SystemDiff` matches the pilot example structurally; `IterationResult` does not match either new response.

**View mapping proposal:** backend identifiers are not the current tab IDs. Enable only the first row for the initial pilot; future mappings require enabled backend handlers.

| Frontend location | Backend `context.activeView` / scope |
| --- | --- |
| `overview` product summary | `overview`, `selectedTarget:null` |
| `overview` feature-specific editing | Future `features`; explicitly distinguish it from summary editing |
| `architecture` | Future `architecture` |
| `tech-stack` | Future `tech_stack` |
| `database` canonical entity graph | Future `data_model` |
| `design-system` | Future `design_system` |
| `dev-plan` | Future `development_plan` |
| `all` | No single mapping; an explicitly chosen canonical section could supply `users`, `features`, etc. later |
| `api-contract`, `database-schema`, `adrs`, `readme`, `env-vars`, `deployment` | Derived artifacts; no proposed editing handler. Preserve regeneration; do not pretend artifact prose/schema selection is canonical editing context. |
| `json` | No generic JSON-edit scope. Only a future, validated canonical target mapping could enable editing. |

Do not send hyphenated tab IDs directly, silently redirect unsupported instructions to Overview, or reinterpret Overview's existing Add component fix as summary approval.

**Required contract clarifications before integration:**

- Define the server-provided edit-capability signal, its placement in bootstrap/map responses, and refresh behavior. Do not expose anonymous IDs or infer ownership from a URL or successful read.
- Specify tracked artifact **POST** success metadata as precisely as tracked GETs, or require a tracked refetch before installing generated output. The ordering rule requires observed `currentRevision`; current generation types do not supply it.
- Enumerate tracked routes, artifact-type identifiers, stale-error details/inspection URLs, and shared-reader authorization. Owner-only inspection is distinct from the unresolved existing-link read policy.
- Confirm CORS allows `Idempotency-Key` and exposes `Date`, `Retry-After`, and `Idempotency-Replayed`; return usable metadata through the frontend transport. Revision gating must work even without a replay header.
- Resolve optional versus explicit-null `selectedTarget` wording; pilot callers can consistently send explicit null. Document capability discovery for disabled handlers rather than relying on failed requests as navigation policy.
- README/Deployment currently fetch structured data and Markdown separately. Agree on snapshot/provenance stamps or a coherent combined response so the pair cannot silently describe different artifact generations/render dependencies. Stale inspection must remain available without requiring a current-only Markdown export to succeed.
- Before broader domains launch, address preview completeness: `SystemDiff.developmentPlan.changed` has `titleChanged`, not old/new titles ([api.ts:173](src/lib/api.ts#L173)). Supply reviewable values through an agreed diff/operations reader; also retain the contract's prohibition on unsupported reorders.

These are integration agreements, not requests to implement a new platform or expand the pilot.

## 4. Existing reusable components

- [ActionButton](src/components/ActionButton.tsx) supports measured idle width, circular spinner-only pending, disabled submission, accessible pending labels, and reduced motion. Use it for Preview/Apply with appropriate labels/icons. [ArtifactActions](src/components/ArtifactActions.tsx) should retain its export/regeneration purpose.
- [MotionDisclosure](src/components/MotionDisclosure.tsx), global focus styling, and [motion tokens](src/app/globals.css#L27) supply restrained reveals and 160/240ms interactions. Preserve the existing button resizing convention.
- [WorkspaceTabs](src/components/WorkspaceTabs.tsx) already separates arrow-key focus from activation and supports horizontal overflow; preserve that behavior.
- `IterationBar` supplies instruction/history interaction patterns, and `getVersions`/`getDiff` supply historical comparison data. Decouple local state/Architecture wording and fix draft clearing before reuse. Do not reuse `DiffView` unchanged for approval or mobile presentation.
- Artifact cache/hooks provide useful subscription, request ownership, error retention, and focus restoration patterns. Extend their lifecycle deliberately; their current locks are not a workspace-wide change coordinator.

## 5. Required frontend architecture changes — proposed

Place a map/session-scoped canonical controller and change controller above conditional view mounting. Keep one accepted `{mapId,data,revision}` snapshot, a retained revision high-water mark, and separately refreshed capabilities/artifact metadata. Route every canonical result through one ingestion gate, including legacy iteration and map refetches. Preserve backend operation atomicity by replacing data/revision together.

Keep draft, captured instruction/context, preview key/body, proposal, pending operation, receipt, and feedback outside individual tabs. Scope them to the originating map/session. Navigation must not cancel approval context or create another submission; requests may complete for their originating scope without modifying another project's active UI. Clear sensitive state when session context changes. Full reload recovery is a separate decision: the two endpoints alone do not provide proposal discovery after the browser loses its key/body/proposal ID.

Expose selected context explicitly from views: Architecture node ID, Overview feature ID, or Database canonical entity ID. Multiple expanded features are not a unique selection. Clear unresolved/removed targets; never infer IDs from titles, row indexes, or stale DOM. Generated schema `entityId` requires validation against the canonical entity before any future link to editing. Technology, token, phase, endpoint, and ADR selections have no corresponding proposed target discriminator; do not fabricate one. Freeze request context at preview generation; switching tabs must not retarget an existing proposal.

Preserve approved layouts, selection, scroll positions, and graph UI state separately from canonical data. A summary edit must not remount/refit an unchanged graph. Do not write graph viewport or locally dragged positions into generated canonical data. Coordinate legacy writes and proposal state: a newer accepted edit obsoletes a ready preview; client request locking supplements, but never replaces, server conflict checks.

## 6. Proposed shared composer UX

Use a compact workspace-level composer, not a chat or another inspector. Initially expose it only for eligible Overview summary editing, with an explicit scope label and contextual placeholder. Unsupported/derived views keep their current functionality rather than advertising universal editing prematurely.

1. **Draft:** labeled input, 1–2000 trimmed-character validation, IME-safe submission, visible focus. Preserve text on failure and navigation.
2. **Generating preview:** one genuine pending action using the shared spinner. Retain current map content; prevent duplicate admission. Store the exact request/key for recovery.
3. **Review:** show current/base revision, server summary, complete old/new product summary, affected canonical sections/views, advisory warnings, predicted artifact impacts, and expiry. Use wrapping text on mobile. Render untrusted values as text. Do not replace the live Overview before approval.
4. **Apply / Cancel:** explicit approval binds to the immutable proposal ID/base revision. Apply has one pending spinner and no AI progress stages. Cancel dismisses the local proposal while preserving the draft; no cancellation endpoint exists, so do not imply server revocation, provider cancellation, or a refund.
5. **Success:** announce the applied revision, update through the gate, refresh metadata/history, and clear only the submitted draft if it has not since changed. An old receipt can confirm success without replacing a newer map.

| Condition | Required treatment |
| --- | --- |
| Expired proposal | Keep the readable diff, disable Apply, offer explicit new preview against refreshed data. Use `expiresAt` and server clock reference; never hardcode 900 seconds or auto-renew. |
| Revision conflict / obsolete proposal | Preserve instruction/diff, explain that the base changed, refresh coherent map data, then require an explicit new preview. A conflict's revision number alone cannot update canonical state. |
| No changes / invalid scope or output | Show actual error and preserve draft; no approval action or fabricated successful change. |
| Preview response lost / in progress | Retry identical key/body, honoring `Retry-After`. A saved expired response remains expired. New key only for an intentional new generation according to `retry`. |
| Apply response lost / uncertain failure | Preserve proposal/approval and retry the same proposal/body to recover its receipt. Do not generate another proposal or declare rollback from HTTP failure alone. |
| 401 / inaccessible map / origin rejection | Explain session/access/configuration issue without leaking ownership; refresh eligibility. A new cookie or shared link does not confer editing rights. |
| Quota / transient errors | Preserve draft, show actual message/request reference, honor retry classification/delay, restore controls appropriately. No automatic charged replacement preview. |

Preview credit charging, abandoned/declined/expired proposals, and replacement allowances remain product decisions. UI wording must match the approved policy, not the contract's recommended table treated as an existing entitlement.

## 7. Revision and cache synchronization design — proposed

**Canonical gate:** validate response shape, map/session identity, and positive revision. Higher revision replaces data/revision atomically. Lower revision changes neither canonical nor newer artifact state, even for ordinary success. Equal revision must represent identical immutable data; do not overwrite by arrival order. Conflicting equal-revision data is a protocol error requiring refetch. Retain the high-water mark across invalidation. Treat legacy `version` as revision only once the backend establishes that invariant; missing revision cannot silently fall back to last-arrival-wins.

Preview never enters this gate as data; mark it obsolete when its base falls behind. After apply/replay or conflict, refetch coherent map state before another edit. Request epochs protect superseded requests; timestamps and abort alone cannot guarantee ordering or undo server commits.

**Stable caches:** stop recreating the whole workspace cache on object identity changes. Separate canonical state, view UI state, current artifacts, and saved inspection. Key artifacts by map/session, type, read mode, relevant variant/provenance; use per-artifact request generations to reject superseded completions at the same canonical revision. Install tracked results only when observed `currentRevision` matches accepted state; otherwise refetch. Apply receipts carry commit-time freshness hints, not authority to overwrite a more recently regenerated artifact.

**Freshness:** migrate all artifact readers, including critique/requirements/traceability. Current reads use `freshness=tracked`; a stale result can be explicitly retrieved using `includeStale=true` into a separate inspection cache. Label stale/unknown provenance and source revision; never use it as current completeness or traceability evidence. Missing is distinct from load failure or stale saved content. An older source revision may legitimately be fresh when verified inputs match. Do not compare only stored `version` to current revision. Consume actual server impacts; the contract examples use narrower dependencies than the conservative pilot.

**Exports and regeneration:**

- SQL, mongosh, ADR Markdown, and `.env.example` already request server-rendered exports ([RelationalSchemaView.tsx:46](src/components/RelationalSchemaView.tsx#L46), [DocumentSchemaView.tsx:37](src/components/DocumentSchemaView.tsx#L37), [AdrView.tsx:194](src/components/AdrView.tsx#L194), [EnvVarsView.tsx:125](src/components/EnvVarsView.tsx#L125)). Handle new `409 artifact_stale`; preserve Env Vars secret/template validation. Never add `includeStale` to download URLs.
- [ApiContractView.tsx:296](src/components/ApiContractView.tsx#L296) serializes cached JSON locally. [ReadmeView.tsx:65](src/components/ReadmeView.tsx#L65) and [DeploymentView.tsx:45](src/components/DeploymentView.tsx#L45) download cached Markdown. These paths bypass a later server export guard: require current verification/refetch and disable stale inspection downloads. Agree on current-only JSON export enforcement as well as text exports.
- README/Deployment load wrappers currently require Markdown export after fetching their record. Split saved structured inspection from current rendered-document loading, so a stale export rejection cannot hide saved output. Refetch rendered documents when supporting artifacts change even if canonical revision does not.
- Regeneration remains explicit and preserves saved content on failure. Capture/validate result provenance; do not let a late generation publish into newer current state. No hidden regeneration or rollback of an applied canonical edit.
- Refresh history after every accepted canonical commit, not just Architecture's local counter. Historical comparison remains distinct from proposal review. No restore/undo capability is promised by this pilot.

The contract explicitly defers adding `product.summary` to README generation inputs. Do not promise README wording follows an Overview edit merely because freshness changes.

## 8. Backend-facing questions and product decisions

1. What is implemented and deployable for S2–S5, and how will frontend release gating detect compatible endpoints/contract versions? Confirm all legacy writers return coherent snapshots in the same revision sequence.
2. What exact edit-capability payload identifies verified-owner eligibility without exposing identity? How are missing cookies, unknown legacy ownership, and existing shared read links explained? No automatic claim, transfer, collaboration, or recovery is authorized.
3. Browser requests include credentials, but [the server map page](src/app/maps/[id]/page.tsx#L10) invokes the same helper without forwarding incoming cookies. If map reads/capabilities become session-sensitive, agree on request-scoped cookie forwarding or a client capability bootstrap. Verify actual frontend/backend origins, HTTPS, cookie SameSite settings, CORS headers, and strict mutation-origin checks in the deployment environment.
4. Confirm artifact generation envelopes, inspection authorization, current-only local JSON export strategy, and coherent rendered-document provenance discussed above. How are same-revision supporting-artifact changes detected/refetched?
5. Approve exact pilot scope/view mapping, server TTL/bounds/clock exposure, credit charge/refund/replacement policy, and user-visible wording. Optional later target kinds/handlers require a separate agreement.
6. Is reload recovery intentionally limited to retained client request identity, or is owner-only proposal/receipt retrieval planned later? Confirm Cancel means local dismissal and does not invalidate a ready server proposal.

## 9. Recommended frontend implementation milestones

1. **Agree interfaces:** resolve section 3/8 wire and product questions; freeze fixtures for map bootstrap, proposal/apply/error, tracked artifacts, and legacy conflicts. Keep pilot hidden.
2. **Revision foundation:** introduce atomic canonical ownership and the ingestion gate; integrate GET/generate/legacy iteration and both existing callers; fix failed-draft clearing and map/session isolation. Verify reordered responses before UI rollout.
3. **Artifact safety:** preserve UI state/saved artifacts, add current versus inspection reads, generation ordering, explicit freshness, guarded exports, review/history invalidation, and coherent README/Deployment loading. Verify stale inspection and failed regeneration independently.
4. **Overview pilot:** add the persistent shared composer, explicit before/after approval, expiry/idempotency/error UX, and approved credit wording. Preserve the existing Architecture component-fix workflow separately.
5. **Release gate:** verify the acceptance criteria below against the implemented backend, desktop/mobile, keyboard, and reduced motion. Enable only eligible owner maps and `overview` summary scope; broader handlers remain off.

## 10. First end-to-end pilot acceptance criteria

- Preview changes neither canonical content nor revision. It displays exact old/new `product.summary`; `meta.oneLineSummary`, features, and Architecture remain unchanged. Cancel/expiry creates no canonical revision; Apply is explicit.
- Apply persists one new revision across reload; Overview, All, and JSON agree on that snapshot. History/diff records only the actual summary edit. Shared-link/non-owner/cross-origin mutation attempts fail without losing read behavior approved by product.
- Double-clicks, preview response loss, terminal preview failure, apply response loss, expired receipt replay, and transaction failure obey idempotency and the approved credit policy. No automatic new charged preview or silent expiry renewal.
- Accept revision 9, then deliver revision 8 via GET, legacy iteration, ordinary apply success, and replay: no view or artifact regresses. Equal-revision divergent data is rejected. Concurrent legacy edits conflict safely; new proposals require refreshed bases.
- Switch views during draft, preview generation, review, and apply: state/feedback survive and request context stays fixed. Switch maps/session: no instruction, target, receipt, or response leaks into another scope. Failed submission preserves text.
- Saved stale/unknown-provenance artifacts remain inspectable and visibly distinct from current/missing results. All download paths reject stale current-looking output; regeneration success/failure and same-revision races preserve correct provenance. No promise of README semantic propagation before its generator change.
- On laptop and narrow mobile widths, preview text wraps, approval controls remain reachable, keyboard/focus/IME handling works, and reduced motion removes unnecessary transitions. Unchanged graph layout/viewport and approved view layouts remain intact.

Verification performed for this audit: source/contract tracing and Git-diff inspection only. Runtime API compatibility, ownership/cookie delivery, concurrency, credit settlement, export guards, and visual/mobile behavior remain unverified until implementation. Only this report was added; existing unrelated changes were preserved.
