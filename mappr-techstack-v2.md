# MAPPR — TECH STACK LAYOUT REFINEMENT V2

We need to refine Mappr's existing Tech Stack view.

The previous redesign introduced a left-hand technology directory and a sticky right-hand inspector. While functional, this layout is unnecessarily repetitive across Mappr and isn't the best fit for the relatively short technology descriptions.

**New direction: Replace the master-detail layout with a full-width, structured Technology Inventory.**

## 1. Inspect before editing

Read the current TechStackView, relevant CSS modules, Mappr's tech-stack data model, shared motion tokens, and repository instructions.

Check Git status and preserve all existing uncommitted changes.

Do not rebuild the view from scratch if existing components can be reused.

## 2. New layout — Technology Inventory

Remove the side-by-side directory and inspector.

Create a full-width technology inventory organized into meaningful functional groups.

Recommended groups, where supported by actual data:

- Application & Runtime
- Data & Storage
- Processing & Background Services
- Integrations & External Services

Do not invent technology relationships or force inaccurate groupings. Preserve the original categories and technology names.

Each technology entry should clearly display:

- Technology name.
- Technical role/category.
- Existing description of why it is used.
- Any other relevant information actually available in the data.

Use compact structured rows rather than generic cards.

All technology names and their core descriptions should be visible without requiring a click.

## 3. Visual hierarchy

Use the following hierarchy:

1. **Technology name:** Primary white text, approximately 16px, semibold.
2. **Description:** Readable muted blue-gray, approximately 14px.
3. **Category/role:** Smaller subdued cyan or secondary text, approximately 12px.
4. **Supporting metadata:** Visually quiet and clearly subordinate.

Keep functional group headings distinct without making them visually compete with technology names.

Preserve Mappr's existing dark navy, amber, cyan, typography, and design tokens.

Use subtle separators, spacing, and alignment instead of surrounding every item with a large card.

Avoid excessive borders, decorative elements, and unnecessary empty space.

## 4. Interactions

Since the descriptions are short, avoid forcing users to select technologies merely to read them.

If a technology contains genuinely additional information, allow optional inline expansion.

Do not create a separate inspector, unnecessary dropdowns, or decorative interactions.

Use Mappr's existing motion tokens for meaningful state changes.

Respect keyboard accessibility, visible focus, and reduced-motion preferences.

Do not display loading indicators for synchronous local interactions.

If genuine asynchronous actions exist, reuse Mappr's existing ActionButton behavior: natural width when idle, smooth contraction, and a spinner only while pending.

## 5. Responsive behavior

The inventory must work on desktop, laptops, tablets, and mobile.

- Use the available content width effectively.
- Allow longer descriptions to wrap naturally.
- Maintain readable spacing on laptops.
- Prevent horizontal overflow.
- Preserve a clear hierarchy on smaller screens.

Do not introduce unnecessary internal scrolling.

## 6. Data integrity and scope

Preserve all existing technology data, descriptions, categories, and application functionality.

Do not modify:

- Architecture
- Database
- Overview
- Design System
- Dev Plan
- API Contract
- Other unrelated views
- Backend API contracts

Do not add new libraries unless absolutely necessary.

## 7. Verification and stop point

After implementation:

1. Run the available lint, TypeScript, and production build checks once.
2. Verify that all technologies and descriptions are present.
3. Confirm the side-by-side inspector has been removed.
4. Check responsiveness and readability.
5. Review the Git diff for unintended changes.

Avoid unnecessary browser automation scripts or repeated command approval requests.

I will personally inspect the rendered UI.

Report what changed, what was verified, and what remains unverified.

**STOP after Tech Stack. Do not proceed to ADRs, Dev Plan, or any other view.**

## Final objective

Make Tech Stack feel like a carefully organized technical inventory, not a dashboard of generic cards or another master-detail inspector.

Prioritize readability, clear grouping, and effortless scanning.

Preserve Mappr's shared interaction language while giving this view a layout suited to its information.