# MAPPR — README VIEW REDESIGN

Redesign Mappr's README view into a clean, GitHub-inspired Repository File Preview.

This is a documentation-reading experience, NOT another dashboard or master-detail layout.

## 1. Inspect first

Inspect:
- Current README component and related styling.
- Markdown rendering implementation and dependencies.
- Shared Mappr button components and motion tokens.
- Existing navigation behavior.
- AGENTS.md and current Git changes.

Preserve working functionality and uncommitted changes.

## 2. Remove nested scrolling

The current README has two vertical scrollbars: one for the application page and another inside the README content.

- Remove the internal vertical scrolling container.
- Allow the README to flow naturally with the main page.
- Preserve horizontal scrolling inside code blocks and wide tables when necessary.
- Avoid fixed-height reading panels.

## 3. Repository-style document layout

Replace the current oversized documentation container with:

**Compact file header**
- Display README.md with a subtle file icon.
- Preserve the existing version information.
- Keep Markdown Export and Regenerate actions aligned on the right.
- Avoid duplicate README headings and unnecessary subtitles.

**Rendered Markdown**
- Render the complete original README as one continuous document.
- Use a comfortable reading width, approximately 780–860px for prose.
- Center the document within the available workspace.
- Let wide tables and code blocks use additional space where appropriate.
- Use natural vertical spacing between Markdown sections.
- Avoid wrapping every section in a separate card.

## 4. Typography

Improve readability without replacing Mappr's global typography.

Recommended starting values:
- H1: 28–32px, weight 650–700.
- H2: 21–24px, weight 600.
- H3: 17–19px, weight 600.
- Body: 15–16px, line-height 1.6–1.75.
- Lists: consistent indentation and comfortable spacing.
- Inline code: existing project monospace font.

Use brighter neutral body text instead of excessively muted blue.

Reserve cyan for links and technical references.

Maintain accessible contrast on Mappr's dark background.

## 5. Optional heading outline

Add a compact "Outline" control near the file header if the existing Markdown renderer supports extracting headings reliably.

- Generate the outline from actual README headings.
- Clicking a heading scrolls to its section on the same page.
- Use stable, collision-safe heading IDs.
- Preserve keyboard accessibility.
- Do not create a permanent sidebar or large table-of-contents panel.
- Do not add a Markdown parser dependency solely for this feature.

If heading extraction would require substantial changes, omit the Outline and report why.

## 6. Preserve Markdown fidelity

Support the existing Markdown features:
- Headings
- Paragraphs
- Lists and nested lists
- Links
- Inline code
- Code fences
- Tables
- Blockquotes
- Emphasis

Do not rewrite, shorten, or restructure the generated README content.

Do not turn Features, Tech Stack, Architecture, or Dev Plan sections into interactive Mappr dashboards.

The README must remain faithful to the exported Markdown file.

## 7. Shared action buttons

Match Architecture and the other updated Mappr views.

- Reuse the shared action button implementation where appropriate.
- Match button height, typography, icon size, capitalization, and spacing.
- Regenerate must smoothly shrink into a circular button containing only a centered rotating spinner while pending.
- Do not display duplicate loaders.
- Export should not show an artificial loading state.
- Preserve existing regeneration and export behavior.

## 8. Scope and verification

Do not modify:
- README generation logic or backend contracts.
- Other Mappr views.
- Existing generated documentation data.
- Unrelated shared components.

Verify:
- Only one vertical page scrollbar.
- Full README renders correctly.
- Code blocks and wide tables remain usable.
- Heading links work if implemented.
- Exported Markdown remains unchanged.
- Regenerate preserves existing behavior.
- Responsive layout works on laptop and mobile widths.

Run essential checks once.

Report changed files, actual verification results, and any limitations.

STOP for my browser visual review.

GOAL: A polished repository-style README reader that feels native to Mappr while preserving the original generated Markdown.