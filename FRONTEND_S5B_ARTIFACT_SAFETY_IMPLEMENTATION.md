# S5B frontend artifact safety implementation

Implemented the frontend integration described in `mappr-s5b-frontend-artifact-safety-integration.md`. The brief supplied the S5A contract; no separate `FRONTEND_S5_HANDOFF.md` was present. Backend implementation/deployment and database state were not independently inspected.

**Offline implementation for review, not release authorization.** No backend code, migrations, deployment configuration, API origin, cookies, S4 flags, provider behavior, or credit policy was changed. No live or billable API writes were made. All HTTP in the tests uses mocked `https://api.mappr.test` responses.

## Actual route inventory

All structured readers below now request `?freshness=tracked`, with credentials included and `cache:no-store`. There is no fallback to default/legacy GETs when tracking is unavailable.

| Artifact / actual view | Structured route under `/maps/:id` | Existing mutations retained |
| --- | --- | --- |
| API Contract | `/api-contract` | POST generation |
| Relational Schema | `/relational-schema` | POST generation |
| Document Schema | `/document-schema` | POST generation |
| README | `/readme` | POST generation |
| ADRs | `/adrs` | POST generation |
| Environment Variables | `/env-vars` | POST generation |
| Deployment | `/deployment` | POST generation |
| Architecture Review | `/critique` | POST review; PATCH `/critique/findings/:findingId` |
| Requirements Gaps | `/requirements` | POST check; PATCH `/requirements/findings/:findingId` |
| Traceability | `/traceability` | POST trace |

Current responses require valid map/revision metadata, `readMode:tracked`, consistent freshness/current/inspection flags, and the expected artifact payload root fields. A fresh source revision 7 may be used against current revision 8; equality of legacy `version` or `techArchHash` is never currentness proof. Unknown source provenance cannot satisfy current mode. Optional generation IDs, fingerprints, generator versions, and publication dates are validated when supplied; generation UUIDs are opaque identities, not sortable versions.

HTTP 409 `artifact_stale` produces a stale state; 404 produces a privacy-preserving “Not generated / not available” state; 503 and missing/invalid tracking metadata produce unavailable/unverified states. Known source/reason metadata from stale errors is displayed without treating the error as an artifact payload. Untrusted `inspectionUrl` values are never fetched.

Saved inspection is an explicit **Inspect saved output (owner only)** action. It verifies `/edit-eligibility`, then requests the known artifact route with `?freshness=tracked&includeStale=true`. The backend must still authorize that GET. A 401/404 never grants access or triggers a public-read fallback. Saved payloads occupy separate inspection entries and cannot satisfy current-output actions.

## Actual output/download/copy inventory

| Existing output | Current implementation |
| --- | --- |
| PostgreSQL / MySQL / SQLite SQL | Fresh request to `/relational-schema/sql?dialect=postgres|mysql|sqlite`; only the supported dialects are accepted. |
| Document/mongosh JavaScript | Fresh request to `/document-schema/script`. |
| ADR Markdown | Fresh request to `/adrs/markdown`. |
| README Markdown | Fresh request to `/readme/markdown`; cached preview bytes are no longer downloaded. |
| `.env.example` | Fresh request to `/env-vars/file`; existing template/sensitive-example validation remains in place and uses the freshly verified variable record. |
| Deployment Markdown | Fresh request to `/deployment/markdown`; cached preview bytes are no longer downloaded. |
| OpenAPI JSON | Existing client-side converter is retained. It receives the freshly verified tracked contract, with verification again before delivery. No backend API-contract export endpoint was invented. |
| README code-block copy | Revalidates the exact displayed document before copying; disabled for inspection/unverified output. |
| Deployment code-block copy | Same protection, preserving exact code text and line breaks. |
| Environment variable-name / safe-example copy | Revalidates the displayed current record, retains the existing sensitive-example policy, and disables inspection copies. |
| Canonical JSON Inspector copy | Preserved: its input is the accepted canonical `MapprSystem`, not generated artifact output. |
| Design System token copy | Preserved: tokens belong to canonical map data. |
| Canonical Markdown/PDF | `ExportMenu` and `MapPdfDocument` consume only `MapprSystem`. They do not assemble generated artifacts. The menu exists in source, but no mounted `ExportMenu` reference was found in the current workspace. |
| All / project / ZIP / print / share | All remains a canonical-data view. No generated-artifact aggregate/ZIP builder or application print/share action was found. None was added. |
| YAML; critique/requirements/traceability JSON/CSV/Markdown export | No such UI handlers or backend routes were found. They remain unsupported; no endpoint was invented. |

All six server-rendered output routes remain current-only. Requests never append `includeStale`. Non-2xx responses are errors, and unexpected content types, JSON error documents, HTML error pages, and invalid/mismatched supplied export snapshot headers cannot become downloads. Existing filenames/formats are retained and filenames reject path/control characters. Optional current-revision/generation/render headers are snapshot metadata, not reusable export leases.

Frontend downloads revalidate around rendering, reject observed content/scope changes, and deliver no file after map/session replacement. No export text or Blob is cached by revision. The network-backed OpenAPI/README/Deployment actions now use the existing spinner-only pending button behavior during their actual verification/download requests.

## View, cache and mutation behavior

- Added light status text for **Verified current**, **Saved (out of date) — inspection only**, **Not generated / not available**, and **Unavailable**. Disabled controls have visible explanation and accessible descriptions, with a non-billable refresh action.
- Saved README/Deployment inspection displays stored structured fields only. It never invokes a current-only renderer or joins stale prose to current nodes, relationships, environment data, or supporting artifacts. Current previews preserve the server's exact Markdown, including optional-support omission notes.
- Saved Env Vars inspection also reuses the existing sensitive-looking example masking. The projection does not rewrite the saved record, metadata, or export structure.
- Stale/inspection critique, requirements, and traceability do not drive current graph highlights, completeness counts, or finding mutations. Their stored fields remain readable through explicit owner inspection. Finding PATCH results are no longer optimistically promoted as verified current data.
- S4B remains the **single canonical `{data,revision}` owner**. The artifact provider uses its revision getter and public map-refresh gate; it does not create another canonical revision store. S4 preview/apply and legacy iteration retain their original endpoints and approval behavior.
- Cache scopes include map, canonical revision, an in-memory session boundary, artifact kind, and current versus inspection mode. No cookie bytes or raw owner IDs are keys or logs. Foreground/pageshow transitions and observed S4B access loss retire private inspection and pending output scopes. Reader remounts revalidate through GET, without AI generation.
- A lower tracked `currentRevision` cannot replace newer artifact/map state. A higher observation refreshes canonical data through S4B's gate; it cannot be combined with the old view's captured labels. The replacement workspace scope must load it. `sourceRevision` remains provenance only.
- Per-entry epochs discard superseded responses and late map/session responses. A synchronous authority/scope check also runs at artifact installation and file/copy delivery, covering revision advancement before React retires an old cache. UUID ordering is never used to choose a result.
- Every artifact POST/PATCH ignores its raw response as currentness evidence and refetches tracked output. Publication conflicts and lost POST responses also trigger a tracked check, preserve the actual error, and never launch another AI request automatically. Recovered output is installed only after verification.
- Canonical snapshot changes retire artifact/download scopes. API/schema/ADR attempts and completion invalidate assembled README state; environment generation similarly invalidates Deployment state. Invalidating both before and after publication prevents an intervening read from retaining old support at the same map revision.
- Previously verified public content may remain visible after a failed operation, clearly unverified/read only. It cannot be exported/copied as current. Private stale payloads are obtained only by the explicit owner action and never substituted into the current entry.

Existing approved view layouts, schema selectors/grid/relationships, Markdown fidelity, generation formats, Architecture graph layout/controls, and S4B draft/approval/retry behavior were preserved. No new dependency or animation framework was introduced.

## Files changed by S5B

New files:

- [src/lib/artifact-safety.ts](src/lib/artifact-safety.ts): route catalog, metadata/currentness validation, errors, provenance parsing and export expectations.
- [src/lib/tracked-artifact-cache.ts](src/lib/tracked-artifact-cache.ts): bridge to the canonical authority and immutable revision scope.
- [src/lib/artifact-output.ts](src/lib/artifact-output.ts): verified download/copy delivery guards.
- [src/lib/artifact-document.ts](src/lib/artifact-document.ts): coherent current-document loading and isolated saved inspection.
- [src/components/ArtifactSafety.tsx](src/components/ArtifactSafety.tsx): shared status, accessible restrictions, and stored-field inspection.
- [src/lib/artifact-safety.test.mjs](src/lib/artifact-safety.test.mjs): 48 mocked safety/controller/component tests.
- This implementation report.

Modified files:

| Area | Files |
| --- | --- |
| Transport and shared lifecycle | [api.ts](src/lib/api.ts), [generated-artifact-cache.ts](src/lib/generated-artifact-cache.ts), [artifact-workspace.tsx](src/lib/artifact-workspace.tsx), [use-generated-artifact.ts](src/lib/use-generated-artifact.ts), [use-schema-artifact.ts](src/lib/use-schema-artifact.ts) |
| Canonical authority bridge | [overview-change.ts](src/lib/overview-change.ts), [MapWorkSpace.tsx](src/components/MapWorkSpace.tsx) |
| Shared actions | [ArtifactActions.tsx](src/components/ArtifactActions.tsx) |
| Artifact views | [ApiContractView.tsx](src/components/ApiContractView.tsx), [RelationalSchemaView.tsx](src/components/RelationalSchemaView.tsx), [DocumentSchemaView.tsx](src/components/DocumentSchemaView.tsx), [AdrView.tsx](src/components/AdrView.tsx), [ReadmeView.tsx](src/components/ReadmeView.tsx), [EnvVarsView.tsx](src/components/EnvVarsView.tsx), [DeploymentView.tsx](src/components/DeploymentView.tsx) |
| Reviews/traceability | [ArchitectureCanvas.tsx](src/components/ArchitectureCanvas.tsx), [ArchitectureReview.tsx](src/components/ArchitectureReview.tsx), [Overview.tsx](src/components/Overview.tsx), [MissingRequirements.tsx](src/components/MissingRequirements.tsx) |
| Copy and sensitive-example handling | [ReadmeMarkdown.tsx](src/components/ReadmeMarkdown.tsx), [DeploymentMarkdown.tsx](src/components/DeploymentMarkdown.tsx), [env-vars-reference.ts](src/lib/env-vars-reference.ts) |

Preserved unrelated work includes the pre-existing Database canvas/CSS changes, deleted `mappr-techstack-v2.md`, earlier audit/contract documents, and S4B implementation. Existing dirty `page.tsx`/`AllView.tsx` and the S4B composer/contracts/tests were not rewritten for S5B. No commits or pushes were made.

## Actual verification

**106 distinct tests passed; zero failures.** Final focused results:

| Command | Result |
| --- | --- |
| `node --test src/lib/artifact-safety.test.mjs src/lib/generated-artifact-cache.test.mjs src/lib/overview-change.test.mjs` | **85 passed**: 48 S5B tests, 8 existing cache tests, 29 S4B tests. |
| `node --test src/lib/readme-markdown.test.mjs src/lib/deployment-runbook.test.mjs src/lib/env-vars-reference.test.mjs` | **21 passed**: Markdown/table fidelity, complete deployment procedures/warnings/code, and existing environment example/template protection. |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | **Passed**, exit 0. The final production build also verified TypeScript on the final source. |
| `npm.cmd run lint` | **Passed**, exit 0, no remaining warnings after dependency fixes. Later changed view/helper/test files were also linted directly; all those checks passed. |
| `npm.cmd run build` | **Passed**, exit 0 on final source. Next.js 16.3.3 compiled, completed TypeScript, generated all four static pages, and retained `/maps/[id]` as dynamic. |
| Git diff review / `git diff --check` | Reviewed scoped changes and export inventory; no whitespace errors. |

Tests cover every structured route, explicit owner inspection and denial, malformed/legacy provenance, older fresh sources, missing/stale/unavailable handling, all six export URLs/all SQL dialects, content types/error documents, snapshot headers, same-revision republishing, dependent invalidation, delayed responses and scope retirement, canonical revision ordering, stale S4/legacy snapshots, POST/PATCH tracked refetch, lost/conflicted publication, exact fresh OpenAPI input, blocked copy/file delivery, omission notes, secret masking, and accessible disabled/pending controls. Component tests render offline; they do not simulate a real browser.

Final review found and corrected an Env Vars inspection masking gap and an old-view/new-revision scope race. Relevant tests/lint/build were rerun after the corrections. Existing cache and S4B tests were preserved.

Non-failing warnings: native Node reports `MODULE_TYPELESS_PACKAGE_JSON` for the repository's existing package/module setup; no package-wide module setting was changed. Next.js ignored an external lockfile at `C:\Users\HomePC\package-lock.json`; no unrelated Turbopack root/config change was made. The final build log is retained at `%TEMP%\mappr-s5b-production-build.log`.

## Remaining integration requirements

1. **Backend readiness:** the assignment says S5A is not deployed and migration `015_artifact_provenance.sql` has not run; the 014/015 rollout remains a backend-owner prerequisite. No SQL/database verification occurred here. Confirm actual migration/version readiness before live integration. The existing deployed backend is not assumed to support tracking; missing metadata intentionally produces unavailable states.
2. **S4 stays disabled:** the interlock, provider integration and approved credit policy remain separate prerequisites. This work does not authorize S4 activation or expand the Overview pilot.
3. **Wire agreement:** required metadata is map/current/source revisions, known freshness status/reason, tracked read mode and consistent current/inspection flags. Optional non-null generation IDs must be UUIDs; fingerprints/generator versions are strings and publication times parse as dates. Confirm these types and stale-error metadata placement against the deployed S5A serialization. No client hash/version inference is a fallback.
4. **Cookies, Origin and CORS:** verify actual frontend/backend domains, signed owner-cookie delivery/SameSite policy, allowed credentialed origins, and response `no-store`/`Vary:Cookie`. Expose optional `X-Mappr-*` headers to browser JavaScript if supplied. No origin or cookie settings were changed. Public tracked reads must remain public under the agreed shared-link policy; stale inspection must remain owner-only.
5. **Session signals:** HttpOnly cookies are not directly observable. Current protection uses lifecycle/session boundaries, foreground retirement, explicit owner verification and server authorization. If account switching is added, connect its explicit session-change signal to cache retirement rather than keying on cookie bytes.
6. **Snapshot limits:** client-only OpenAPI export represents an observed verified tracked snapshot; it is not a perpetual freshness lease. The contract provides no server OpenAPI/YAML/report export endpoint or artifact-mutation idempotency receipt. No such functionality was invented. The backend must enforce current-only text exports and coherent support rendering; ambiguous mutation outcomes require tracked inspection and an intentional subsequent generation request.
7. **Unverified live behavior:** no live backend/API, PostgreSQL, migration, cross-origin browser cookies, actual clipboard/download, mobile visual layout, keyboard/assistive-technology run, or browser reduced-motion emulation was tested. Focus/status semantics and responsive existing layouts were checked through source/SSR, TypeScript, lint and build. Native browser selection/print behavior is not an application export control.

Next limited action: review the diff/UI with authorized mocked responses, then coordinate live read/inspection/export checks with the backend owner after the required backend rollout. **Stopped for review; no deployment or activation performed.**
