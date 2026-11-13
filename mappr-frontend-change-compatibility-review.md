# MAPPR — UNIVERSAL CHANGE SYSTEM: FRONTEND COMPATIBILITY REVIEW

We have finalized the proposed backend API contract for Mappr's universal natural-language change system.

Read BACKEND_CHANGE_CONTRACT.md from the current frontend repository.

IMPORTANT:
- This contract was designed in a separate backend VS Code environment.
- You only have access to the frontend repository.
- Treat the backend contract as proposed, not implemented.
- Perform a READ-ONLY compatibility review.
- Do not modify application code.

## 1. Inspect the frontend

Review:
- AGENTS.md and repository instructions.
- MapWorkSpace.tsx and canonical system state.
- IterationBar.tsx and ArchitectureCanvas.tsx.
- Overview.tsx.
- src/lib/api.ts.
- Artifact cache and generated-artifact hooks.
- Version history and diff components.
- Workspace navigation and view state preservation.
- Export and regeneration workflows.

## 2. Verify contract compatibility

Evaluate:

1. Does Overview actually render product.summary, meta.oneLineSummary, or both?

2. Can the existing frontend support the proposed preview/apply request and response schemas?

3. Which Mappr view identifiers must map to backend context.activeView values?

4. How should the shared change composer receive selected-item context?

5. What changes are needed to preserve drafts, pending requests, previews, and feedback when switching views?

6. How should MapWorkSpace manage canonical data and revision numbers together?

7. How will the frontend prevent older API responses, retries, and replays from overwriting newer state?

8. How should stale artifacts remain viewable with clear freshness indicators?

9. What changes are needed for export restrictions, regeneration, cache invalidation, and version history?

10. How should expired proposals, approval, rejected changes, conflicts, and retryable errors appear in the interface?

11. How does verified-owner editing affect the existing anonymous-session and shared-link experience?

12. What existing components, motion tokens, and interaction patterns can be reused?

## 3. Review the proposed user experience

Evaluate a shared change composer with:

- View-specific contextual placeholder.
- User instruction input.
- Change generation/pending state.
- Proposed change preview.
- Before/after differences.
- Affected views and warnings.
- Apply and Cancel actions.
- Success/error feedback.
- Preserved workspace state.

Keep the interface consistent with Mappr's existing design language.

Avoid introducing a chat interface, unrelated panels, excessive animations, or a new component framework.

## 4. Assess rollout safety

Identify frontend changes that must happen before the backend pilot launches.

Pay particular attention to:
- Revision ordering.
- Older Architecture iteration responses.
- Existing Overview change instructions.
- Cached generated artifacts.
- Map switching.
- Mobile responsiveness.
- Authentication cookies and origin configuration.
- Failed submissions losing user instructions.

Do not assume backend functionality exists until implemented.

## 5. Deliverable

Create FRONTEND_CHANGE_COMPATIBILITY.md containing:

1. Overall compatibility verdict.
2. Confirmed frontend findings with file paths.
3. Contract mismatches or required amendments.
4. Existing reusable components.
5. Required frontend architecture changes.
6. Proposed shared composer UX.
7. Revision and cache synchronization design.
8. Backend-facing questions and product decisions.
9. Recommended frontend implementation milestones.
10. First end-to-end pilot acceptance criteria.

Separate confirmed findings from proposed changes.

Do not implement anything.

STOP for architectural review before coding.