# Assistant Feature Design

## Goal

Turn Sage from a local mock panel into a real spreadsheet assistant that understands the current workbook, explains probabilistic spreadsheet behavior, and proposes formulas or cell edits for uncertain distributions.

The first version should feel useful for model-building inside Maybe without taking on launch concerns. It should use the server environment variable `OPENAI_API_KEY` and avoid bring-your-own-key UI or client-side provider calls.

## Scope

This design covers:

- A server-side OpenAI integration through the Vercel AI SDK.
- Replacing the current mock Sage response with streamed assistant responses.
- Sending a compact workbook snapshot with each assistant request.
- Producing reviewable spreadsheet change proposals.
- Applying accepted proposals to the existing GaussFormula-backed spreadsheet.
- Tests for workbook snapshotting, proposal validation, and UI apply behavior.

This design does not cover:

- Bring-your-own-key flows.
- Account management, billing, or user authentication.
- Persisted chat history across reloads.
- Multi-sheet workbook support beyond representing the current `Sheet1`.
- New probabilistic math primitives inside GaussFormula.
- Provider switching or model settings UI.

## Recommended Approach

Use a local server endpoint plus AI SDK streaming.

The browser should never see `OPENAI_API_KEY`. Sage sends chat messages and workbook context to an app-owned endpoint. The endpoint calls OpenAI through the AI SDK OpenAI provider, which reads `OPENAI_API_KEY` from the server environment, and streams the response back to the client.

The UI remains diff-first. The assistant may explain, answer, or suggest a formula in prose, but any spreadsheet mutation must become a proposed change preview before it can be applied.

## Architecture

Add the AI SDK packages:

```text
ai
@ai-sdk/react
@ai-sdk/openai
zod
```

Because the current app is a Vite client application, add a small Node server boundary for local development and production preview. That boundary owns the assistant endpoint and serves the built client or proxies Vite during development.

Primary modules:

- `src/assistant/workbookSnapshot.ts`: builds a compact model-facing snapshot from the formula engine.
- `src/assistant/proposals.ts`: validates assistant-proposed spreadsheet edits.
- `src/server/assistantRoute.ts`: handles `/api/assistant` requests and streams AI SDK responses.
- `src/components/ai/AICopilotPanel.tsx`: renders streamed chat, proposal previews, and apply/dismiss actions.

The exact filenames can adjust to local conventions during implementation, but the boundaries should stay the same: snapshot logic, proposal validation, server route, and UI panel should not be mixed into one file.

## Workbook Context

Each assistant request includes a compact snapshot of the current sheet:

- Sheet name and dimensions.
- Selected cell address, when available.
- Non-empty cells only.
- For each non-empty cell:
  - A1 address.
  - Raw formula when the cell has a formula.
  - Display value or serialized evaluated value.
  - Detected value kind: empty, scalar, text, confidence interval, sampled distribution, error, or unknown object.
  - Confidence interval bounds and interpretation when available.
  - Sampled-distribution summary when available: sample count, mean, standard deviation, and a few percentiles, not the full sample vector.
- Optional dependency graph summary when available and small enough to include.

The snapshot must be size-capped. A first version can include all non-empty cells up to a conservative limit and then report truncation metadata. The assistant should be told when context is truncated so it does not pretend to have full workbook knowledge.

## Assistant Instructions

The server prompt should teach the assistant the product model:

- Maybe is a GaussFormula-backed spreadsheet for uncertain calculations.
- Users can enter confidence intervals like `CI[10, 20]`.
- Normal spreadsheet formulas can reference uncertain cells.
- Formulas should preserve uncertainty where possible instead of flattening values to single numbers.
- Suggested edits must use valid spreadsheet formulas or literal cell values.
- The assistant should explain uncertainty assumptions clearly, especially when choosing normal, lognormal, or uniform interpretations.
- The assistant should ask for clarification when the user request would require data that is not present in the workbook.
- The assistant must not claim that a proposed edit was applied until the user accepts it.

The first model can be fixed in code. Model selection can be revisited later.

## Proposal Model

Assistant-proposed spreadsheet edits should use a validated structure:

```ts
interface AssistantCellChange {
  cell: string;
  before: string;
  after: string;
  reason: string;
  kind: "add" | "update" | "review";
}

interface AssistantProposal {
  title: string;
  summary: string;
  changes: AssistantCellChange[];
}
```

Validation rules:

- `cell` must be a valid A1-style address within the current sheet bounds.
- `before` must match the current cell formula or display value captured when the proposal was generated, unless the change is marked for review only.
- `after` must be a string formula or literal accepted by the spreadsheet edit path.
- `reason` must be non-empty.
- `review` changes are informational and are not applied.

If validation fails, the UI should show the assistant text but disable Apply for the invalid proposal.

## UI Behavior

Sage keeps the current right-side panel and compact workflow.

Empty state:

- Explain that Sage can inspect the workbook and suggest formulas.
- No provider key field in this version.

Chat state:

- User messages appear in the panel.
- Assistant text streams into the panel.
- Errors are shown inline with a retry option.
- If `OPENAI_API_KEY` is missing server-side, show a clear setup error.

Proposal state:

- Proposed changes render as the existing diff-style rows.
- Apply writes add/update changes through existing spreadsheet context methods.
- Dismiss leaves the workbook unchanged.
- After apply, the panel marks the proposal as applied.
- The input remains available for follow-up prompts.

The UI should not expose raw JSON unless a developer mode is added later.

## Server Behavior

The assistant endpoint accepts:

- AI SDK UI messages.
- Workbook snapshot.
- Selected cell metadata.

The endpoint:

- Validates the request shape.
- Checks that `OPENAI_API_KEY` is configured.
- Calls `streamText` with the OpenAI provider.
- Converts UI messages to model messages.
- Includes the workbook snapshot and product instructions as context.
- Streams the response back using the AI SDK UI message stream response format.

The endpoint should return a normal error response for missing configuration or malformed input. Provider errors should be summarized without leaking secrets.

## Testing And Verification

Unit tests:

- Workbook snapshot includes non-empty cells, formulas, evaluated values, selected cell, and uncertainty metadata.
- Snapshot truncation reports that context was truncated.
- Proposal validation accepts valid add/update/review changes.
- Proposal validation rejects out-of-bounds cells, stale `before` values, and empty reasons.

UI or E2E tests:

- Sage opens from the toolbar.
- A mocked assistant response renders streamed text.
- A mocked proposal renders a diff preview.
- Applying a valid proposal updates the spreadsheet.
- Missing-key errors render as actionable panel errors.

Manual verification:

- Run typecheck, unit tests, build, and focused e2e tests.
- Start the dev server with `OPENAI_API_KEY` set and verify a real Sage request against the prompt-cost CI example.
- Verify that no OpenAI key is present in client bundles, browser local storage, or network payloads sent from browser to server.

## Follow-Up Work

After this version is working, revisit:

- BYOK or hosted key management.
- Persisted conversations.
- Tool-calling for targeted workbook reads instead of sending a snapshot every request.
- Rich structured streaming for proposal cards.
- Model selection and cost controls.
- Multi-sheet support.
