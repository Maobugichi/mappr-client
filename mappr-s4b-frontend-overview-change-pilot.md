# MAPPR — S4B Frontend Overview AI Change Pilot

## Task and boundaries

You are operating in the **frontend** repository. The backend is in a *separate VS Code environment*, so do not assume you can read its repository, modify it, or call its unpublished routes. Implement the **Overview-only** frontend flow for the already-defined S4A Preview → Review → Apply contract, preserving existing Mappr functionality. This is a frontend implementation and offline verification task, **not** a release authorization.

The backend S4A foundation exists but is **intentionally disabled in production** by a release interlock; its provider adapter, credit policy, and artifact protections are not yet integrated. Do not switch it on or attempt to bypass it. Implement the UI so it can be exercised with mocked APIs and handles the real backend's 503 safely. S3 existing generation/iteration paths remain operational and unchanged.

## First: inspect current frontend truth

1. Inspect `git status`, branch, existing changes, `AGENTS.md`/`CLAUDE.md`/`README.md` (where present), `package.json`, scripts and tests.
2. Read the current workspace owner and navigation state (historically `MapWorkSpace.tsx`), Overview (`product.summary` vs `meta.oneLineSummary`), existing `IterationBar`, Architecture iteration interactions, API client (`src/lib/api.ts`) and `MapprSystem` types, map-loading/auth/session paths, and existing design/motion conventions.
3. Preserve all newer changes. This brief does not authorize rewriting the workspace shell, Architecture canvas, existing iteration, the API Contract view, or adding an animation library.
4. Report any incompatible backend contract assumption, but make best progress within frontend scope. Do not infer the backend repo is available.

## UX deliverable

Create a restrained **Describe a Change** composer for **Overview only**, anchored in a suitable workspace-level location so its draft and preview are not lost through normal Overview interactions. If existing workspace patterns make another placement clearly safer, use the smallest consistent adjustment. Do not replicate the Architecture-specific `IterationBar` code or remove its working behavior.

Flow:
1. An established map owner types an instruction proposing a change to the Overview **product summary**, which is `product.summary`. Do not accidentally edit `meta.oneLineSummary` (a distinct header field).
2. On Preview, show a pending state tied to the current map/session/revision. A successful preview displays the **actual server-returned diff**, proposed replacement summary, warnings, artifact impacts, and absolute expiry; **do not mutate the canonical map**.
3. Offer explicit **Apply approved change** and **Discard/Close** controls; clicking Apply sends approval, then installs the authoritative server response safely. The preview is read-only until Apply succeeds.
4. Preserve draft input on failed previews, failed apply, and non-destructive navigation. Never erase a draft simply because a request failed.
5. When edit eligibility cannot be established, show a truthful disabled/unknown state; shared-link readers must remain able to read the map. Do not imply that every visitor may edit.
6. Show that this is an **Overview pilot**, not universal support yet; preserve established views and navigation conventions.
7. Keep UI technically calm: existing palette/typography, minimal transitions, clear keyboard focus, no fake progress, reduced-motion support, usable mobile layout. A simple semantic diff is preferable to a complex new library.

## S4A API contract to use verbatim

All new request responses use `Cache-Control: no-store`; fetch from browser with `credentials: 'include'`, `cache: 'no-store'`, correct existing API base URL and Origin semantics. Server sets cookie policy. Check actual deployed domains: cross-site `SameSite=Lax` cookies may not work even with credentials; **do not silently alter cookie policy in frontend code**. If this prevents browser eligibility, surface as an integration blocker.

Eligibility: `GET /maps/:id/edit-eligibility` for existing signed-cookie owner, response `200 {mapId, canEdit:true}`; `401` for no established session; `404` for non-owner/unknown; errors may be unknown. Scope results by current map/session and discard obsolete responses.

Preview: `POST /maps/:id/changes/preview` with header `Idempotency-Key: <UUID>` and strictly:

```json
{"instruction":"Clarify the product summary.","context":{"activeView":"overview","selectedTarget":null},"expectedBaseRevision":1}
```

A 201 ready preview includes `contractVersion:1`, `mapId`, `proposalId`, `status:"ready"`, `baseRevision`, `createdAt`, `expiresAt`, server-authored `summary`, `operations` containing exactly one `set_field` at `product.summary`, full `diff` (existing SystemDiff), `affectedSections:["product"]`, `warnings`, `artifactImpacts`.

Apply: `POST /maps/:id/changes/:proposalId/apply` with strictly:

```json
{"approved":true,"expectedBaseRevision":1}
```

A 200 response includes `status:"applied"`, `previousRevision`, `revision`, `version`, `appliedAt`, `summary`, complete authoritative `data` (`MapprSystem`), stored `diff`, `affectedSections`, `warnings`, and `artifactFreshness`. The backend generates no AI during apply.

Errors use `{error,message,requestId,retry?,details?}`. Handle at minimum:
- `503 feature_disabled`, `preview_policy_not_configured`, `revision_not_ready`: clearly unavailable; do not fallback to `/iterate` or pretend the preview succeeded.
- `401 session_required`, `403 origin_not_allowed`, `404 not_found`: do not grant editing; handle privacy without exposing map existence.
- `409 revision_conflict`: invalidate obsolete preview, refetch; require a deliberate *new preview*, never auto-apply or auto-rebase.
- `409 preview_in_progress`: same request/key retry only after indicated delay or explicit Retry control; do not mint a new key for a retry of the identical operation.
- `409 idempotency_key_reused`, `proposal_mismatch`, `proposal_obsolete`, `proposal_not_ready`: explain corrective action; do not regenerate transparently.
- `410 proposal_expired`: retain preview for inspection, disable Apply, request explicit new preview.
- `422 unsupported_scope`, `no_changes`, `change_not_valid`; `502/504` generation problems; `500` uncertain result: offer safe retry according to the existing identity, never assume failure means no commit.

Keep client-generated UUID/idempotency identity stable for the same logical preview attempt and safe retry. New user-requested preview gets a new key. Do not store preview as canonical state.

## Canonical revision high-water behavior

Map/session-scoped canonical revision must be monotonic: accept a response only when it is newer than the current accepted revision; older responses—including stale GETs, legacy iteration results and replayed apply receipts—must not roll the workspace back. Equal revision must represent the same canonical data; do not blindly overwrite. Apply must install `{data, revision}` atomically in the shared workspace state and invalidate/refetch dependent history/artifact views as appropriate. Check whether other active components already own revisions and integrate there; avoid creating two competing canonical stores.

A preview based on revision N must become non-actionable when canonical data moves beyond N. On map change, session change, or owner-eligibility loss, discard/disable authorization-bound proposal actions safely; do not leak another map's draft or preview. Use server absolute `expiresAt` (server `Date` if available) and avoid treating client timer accuracy as permission to apply; the server decides expiry. UI may update its expired display while mounted.

Do not present saved artifact output as guaranteed current after apply. Show `artifactFreshness` / warnings conservatively; artifact current-only export gating belongs to backend S5 and is not yet complete.

## Verification and boundaries

- Prefer focused API helper(s), typed state and readable small components over a generic change-framework rewrite.
- Add/update offline tests for eligibility, invalid/unavailable backend state, preview without canonical mutation, apply approval, replay/stale revision, error recovery, preserving drafts, expiry and map switching. Use mocked HTTP; do not make billable or live writes.
- Run TypeScript, lint/build and focused tests available in this repo. Report what actually ran and what remains unverified, especially browser cookie delivery with actual domains.
- Do not modify backend code, run migration 014, turn on feature flags, wire AI/credits, change cookies, deploy, or start other-view change support.
- Deliver `FRONTEND_S4B_OVERVIEW_CHANGE_IMPLEMENTATION.md` with files changed, relevant UI behaviors, test results, any backend contract mismatches, and next limited action. STOP for review.
