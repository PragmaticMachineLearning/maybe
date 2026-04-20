# Workstation UI Redesign Design

## Goal

Redesign Maybe into a spreadsheet-first probabilistic workstation that matches the dark, dense, technical direction in the provided reference. The redesign should make the app feel like a full working product, not a landing page.

## Scope

This design covers:

- The primary app shell and default desktop layout.
- The collapsible Insights analysis panel.
- The collapsible AI copilot panel as a UI-only prototype.
- Visual language for the spreadsheet, panels, controls, and distribution states.
- Moving and referencing the Maybe logo in the README.

This design does not cover:

- Real AI SDK integration or network calls.
- Applying AI-generated diffs to spreadsheet data.
- Reworking the formula engine or distribution math.
- Broad codebase refactors outside the UI redesign.

## App Shell

The first screen is the app itself. Remove footer and marketing-style text from the app surface.

Default desktop layout:

- Compact top toolbar.
- Formula bar above the grid.
- Spreadsheet grid as the primary workspace.
- Right-side vertical rail with icon and short label controls.
- Insights panel collapsed by default.
- AI copilot panel collapsed by default.

The rail contains at least:

- `Insights`: opens the selected-cell analysis panel.
- `AI`: opens the AI copilot panel.

Opening one panel expands it beside the spreadsheet. Opening both panels creates the full three-pane workstation:

1. Spreadsheet grid.
2. Insights analysis panel.
3. AI copilot panel.

On smaller screens, the side panels should behave like drawers or stacked panels so the spreadsheet remains usable.

## Visual Direction

The UI should use a dark, technical, high-density style:

- Deep charcoal and green-black surfaces.
- Thin borders and subtle shadows.
- Mint/teal for primary actions and active states.
- Purple for uncertainty, probabilistic highlights, and selected distribution states.
- Muted gray text for secondary metadata.
- Compact controls with roughly 5-8px radii.
- Clear selected-cell and selected-panel states.

The design should avoid decorative marketing sections, footer feature copy, and oversized landing-page spacing. The app should prioritize dense, scannable data and direct manipulation.

## Spreadsheet Workspace

The spreadsheet remains the main surface.

Expected behavior:

- The grid should occupy most of the viewport when panels are collapsed.
- Distribution cells should have stronger visual treatment than ordinary values.
- Selected distribution cells can use purple emphasis.
- Normal confidence interval or sampled-distribution cells can use mint/teal emphasis.
- Empty cells remain visually quiet.
- The formula bar stays visible above the grid and reflects the selected cell.

The spreadsheet should not be pushed below marketing text or documentation-like content.

## Insights Panel

The current analysis panel becomes the Insights panel.

Default state:

- Collapsed.
- Opened from the right rail.

When open, it functions as a selected-cell inspector for uncertainty analysis. It should show:

- Selected cell label and lineage/formula context where available.
- Distribution mode or type.
- Distribution chart.
- Parameters.
- Percentile controls.
- Confidence interval controls.
- Any relevant messages for non-distribution or unsupported cells.

The panel should feel attached to the active cell, not like a separate page. It should preserve existing analysis behavior while adopting the new visual system.

## AI Copilot Panel

The AI copilot is UI-only for now.

Default state:

- Collapsed.
- Opened from the right rail.

Interaction model:

- Diff-first.
- The user can type a prompt locally.
- Submitting produces a canned assistant response and a realistic diff preview.
- The diff preview includes `Confirm` and `Cancel` controls.
- Confirm and cancel do not call AI or mutate real spreadsheet data unless a later implementation plan explicitly adds a local demo action.

The panel should make future AI behavior clear without pretending a backend exists. It should be structured so a later AI SDK integration can replace the local mock response.

Future integration boundary:

- Keep chat-like user and assistant messages as UI state.
- Keep proposed spreadsheet changes as a separate diff-preview model.
- Do not tie the UI-only prototype directly to provider-specific APIs.
- When real AI is added later, use the AI SDK from a server/API boundary rather than calling providers from the client.

## README Logo

Move the local Maybe logo into:

```text
docs/assets/maybe-logo.png
```

Update `README.md` to reference that asset near the top of the document. The README should retain its technical project content while presenting the logo in a clean, conventional way.

## Component Boundaries

Implementation should keep the redesign scoped and maintainable:

- App shell layout belongs in the app layout layer.
- Right rail should be a focused component.
- Insights panel behavior should build on the existing analysis panel rather than duplicating analysis logic.
- AI copilot UI should be isolated behind a focused component and local state.
- README asset movement should not alter unrelated documentation.

Use clear names that describe product concepts, such as `WorkspaceRail`, `InsightsPanel`, `AICopilotPanel`, and `DiffPreview`, if those names fit the existing code structure.

## Testing And Verification

Verification should include:

- TypeScript build.
- Unit tests for any extracted pure logic.
- Existing E2E tests.
- A browser check of the redesigned app at desktop size.
- A browser check of the collapsed rail and opened panel states.
- A mobile or narrow viewport check to ensure panels do not make the spreadsheet unusable.

Existing package-update verification should continue to pass. The known Vite large chunk warning is acceptable unless this redesign materially worsens it.
