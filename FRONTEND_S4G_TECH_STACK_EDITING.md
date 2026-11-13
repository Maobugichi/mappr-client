# S4G Tech Stack frontend editing

Implemented in the frontend repository on 2026-11-13. Existing Overview, Architecture, S5 artifact-safety, and unrelated uncommitted work were preserved. No backend files, migrations, credit handling, activation settings, dependencies, or deployment preparation were changed. Nothing was pushed or deployed. Deployment remains deferred until every Mappr view supports AI editing.

## Interface

- Tech Stack now includes Describe a Change below its existing full-width inventory. `TechStackView.tsx`, its CSS, technology logos, names, categories, descriptions, and compact responsive rows are unchanged.
- The new composer reuses the Overview/Architecture form, shared ActionButton, spinner-only pending behavior, review area, explicit Apply/Reject controls, accessible labels, visible focus styling, responsive diff layout, and reduced-motion conventions.
- Review renders every item in `diff.techStack.added`, `removed`, and `changed`. Each entry shows its complete category, choice, and rationale. Changed entries include complete Before/Proposed values and `changedFields`, including rationale-only updates. Category renames appear as removal plus addition; the client does not rename or normalize identities implicitly.
- Server summary, warnings and affected sections, predicted artifact impacts, and absolute proposal expiration remain visible. Commit-time artifact freshness/warnings are shown after Apply without claiming output was regenerated or is currently exportable.
- No technology-selection UI, dropdowns, inspector, or invented technology IDs were added. The change scope is the whole Tech Stack, as required by the backend context.

## API and validation

All requests retain browser credentials and `cache:"no-store"`. The frontend does not fabricate an Origin/session or bypass the backend interlock.

| Action | Request |
| --- | --- |
| Preview | `POST /maps/:id/changes/preview`, body `{instruction,context:{activeView:"tech-stack",selectedTarget:null},expectedBaseRevision}`, with a fresh UUID `Idempotency-Key` for each distinct request. |
| Apply | `POST /maps/:id/changes/:proposalId/apply`, body `{approved:true,expectedBaseRevision:<proposal base revision>}`. |
| Reject | `POST /maps/:id/changes/:proposalId/reject`, body `{rejected:true,expectedBaseRevision:<proposal base revision>}`. Requires HTTP 200 and a validated `{contractVersion:1,mapId,proposalId,status:"rejected",baseRevision,rejectedAt}` receipt. HTTP 204 is not accepted. |

- Preview rechecks edit eligibility and refreshes the accepted canonical revision before generation. Each intentional request receives a new UUID; uncertain-outcome recovery retains its captured instruction, context, base revision, and key. No automatic generation/retry or `/iterate` fallback is introduced.
- The canonical technology model remains exactly `{category,choice,rationale}[]`. Category identity is case-sensitive and is never trimmed, folded, converted to an enum, or replaced with an invented ID. Distinct `Frontend` and `frontend` entries remain distinct.
- Duplicate exact categories block generation rather than guessing an identity or modifying the visible data. No-op, malformed, incomplete, out-of-scope, duplicate/conflicting, mismatched-before, renamed-in-place, or incorrectly described changed-field diffs cannot enable Apply.
- The validator builds a separate review-only projection to verify the authoritative Apply receipt. It does not execute server operations or install that projection. Returned canonical data must match the reviewed effects, including the unchanged remainder of the system, before the shared revision gate accepts it.
- Ready proposals require an explicit Apply or Reject. Failed/uncertain approval or rejection retains the same proposal and recovery identity. Pending-action deduplication, Retry-After, server-confirmed expiry/rejection, authorization rechecks, and terminal-state protections are reused.
- Revision conflicts refresh the shared map and disable the stale proposal without rebasing or auto-applying. The user resolves the old proposal explicitly before generating another. Daily/attempt allowance errors display the actual server message, code, and request reference; no allowance counter, charge/refund claim, or credit policy is invented.

## Canonical state and S5 safety

- `TechStackChangeController` delegates every canonical write to the existing workspace owner used by Overview and Architecture. It has no independent revision counter or second canonical store.
- Apply installs the server's full validated data and revision atomically. Every existing view consumes that same canonical snapshot. Older GETs, delayed approvals, and replayed old receipts cannot overwrite a newer accepted revision or its artifact state.
- Drafts, proposal review, and uncertain outcomes live in the workspace controller and survive view switching; late responses from a released map cannot publish into another workspace.
- Authorization loss invalidates authorization-bound proposals across all subscribed controllers and retires S5's shared session scope. A successful owner recheck restores access without reviving old proposals.
- Existing S5 tracked artifact reads, owner-only saved inspection, current-only downloads/copy, session/revision cache boundaries, and export guards remain unchanged. Tech Stack Apply advances their existing canonical authority, invalidating obsolete scopes. Receipt freshness is historical metadata, not permission to export stale generated output.
- Architecture canvas state, selection, layout, and other view interactions were not changed by S4G.

## Files changed

| File | Purpose |
| --- | --- |
| `src/components/TechStackChangeComposer.tsx` | Tech Stack review renderer using the existing Describe a Change composer. |
| `src/components/OverviewChangeComposer.tsx` | Tech Stack labels/diff slot and existing explicit decision/recovery controls. |
| `src/components/MapWorkSpace.tsx` | Workspace-scoped Tech Stack controller, subscriptions, active-view access checks, and composer mounting. |
| `src/lib/tech-stack-change.ts` | Tech Stack protocol using the shared lifecycle and canonical owner. |
| `src/lib/tech-stack-change-contract.ts` | Case-sensitive category diff and authoritative receipt validation. |
| `src/lib/change-protocol.ts` | Tech Stack context type; shared empty SystemDiff and exact rejection receipt validator. |
| `src/lib/architecture-change-contract.ts` | Compatibility re-exports of the shared helpers; Architecture-specific validation preserved. |
| `src/lib/api.ts` | Tech Stack Preview helper and shared Apply/Reject adapters, retaining Architecture exports. |
| `src/lib/overview-change.ts` | Scope-specific eligibility text and reuse of the explicit-decision protection for protocols supporting Reject. |
| `src/lib/tech-stack-change.test.mjs` | Mocked API/controller integration, receipt/diff checks, S5 invalidation, and actual component rendering tests. |
| `FRONTEND_S4G_TECH_STACK_EDITING.md` | This implementation and verification report. |

Other existing changes in the working tree belong to earlier work and were not overwritten.

## Verification

`node --test src/lib/tech-stack-change.test.mjs src/lib/architecture-change.test.mjs src/lib/overview-change.test.mjs src/lib/artifact-safety.test.mjs`: **123/123 passed**, comprising 22 Tech Stack, 24 Architecture, 29 Overview, and 48 artifact-safety tests.

Coverage includes exact context/body/UUIDs, category case sensitivity, rationale-only changes, category rename presentation, immutable Preview, authoritative atomic Apply, cross-controller synchronization, malformed/out-of-scope data, explicit rejection, strict rejection receipt/status checks, duplicate submissions, uncertain retries and replays, expiry, conflicts, authorization loss/recovery, missing revisions, map release, backend unavailability, allowance errors, Retry-After, S5 scope retirement, and complete rendered diff/inventory content. All API responses are mocked; unexpected routes fail the tests. No live AI request was made.

- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: **passed**.
- `npm.cmd run lint`: **passed**.
- `npm.cmd run build`: **passed (exit 0)**; production compilation, Next.js TypeScript checking, page-data collection, and static generation completed. The existing external `C:\Users\HomePC\package-lock.json` warning remains; no unrelated configuration was changed.
- `git diff --check`: **passed** (existing Windows line-ending notices only).
- Confirmed no changes to `TechStackView.tsx` or `TechStackView.module.css`.

## Contract compatibility and remaining verification

No mismatch with the supplied S4G request/model/diff requirements or the confirmed shared Apply/Reject contract was found in the mocked checks. The route context is exactly **`tech-stack`**, while the canonical/diff/affected-section key is **`techStack`**. Rejection uses the confirmed body and complete HTTP 200 receipt, with the original proposal base revision on recovery.

Backend files and live S4G responses were not inspected; the backend resides in a separate repository. The frontend uses the existing contract-v1 full SystemDiff/proposal/Apply receipt envelope and `affectedSections:["techStack"]`. Server operations remain opaque. Unexpected envelopes fail closed and preserve recovery rather than silently falling back to immediate iteration. Live cross-origin authentication, actual server policy/allowance responses, persisted Apply/Reject replays, and artifact freshness responses remain integration checks with the backend interlock intact.

Real-browser laptop/mobile appearance, keyboard focus behavior, spinner geometry, and reduced-motion behavior remain for visual QA. Native controls, the established ActionButton, and existing responsive/reduced-motion CSS are reused. No browser automation scripts or new animation were introduced.

Stop here for review. Do not deploy or activate features; other Mappr views still require their AI editing implementations.
