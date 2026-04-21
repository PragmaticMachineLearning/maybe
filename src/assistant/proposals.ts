import { z } from "zod";

import { cellAddressFromA1 } from "./address";
import type { WorkbookSnapshot } from "./workbookSnapshot";

export const assistantCellChangeSchema = z.object({
  cell: z.string(),
  before: z.string(),
  after: z.string(),
  reason: z.string(),
  kind: z.enum(["add", "update", "review"]),
}).strict();

export const assistantProposalSchema = z.object({
  title: z.string(),
  summary: z.string(),
  changes: z.array(assistantCellChangeSchema),
}).strict();

export type AssistantCellChange = z.infer<typeof assistantCellChangeSchema>;
export type AssistantProposal = z.infer<typeof assistantProposalSchema>;

export interface AssistantProposalValidationResult {
  valid: boolean;
  proposal: AssistantProposal | null;
  applyableChanges: AssistantCellChange[];
  errors: string[];
}

const maybeProposalBlockPattern = /```maybe-proposal\s*([\s\S]*?)```/g;

const normalizeCellAddress = (cell: string): string => cell.trim().toUpperCase();

const getCellTextFromSnapshot = (
  snapshot: WorkbookSnapshot,
  cell: string,
): string => {
  const snapshotCell = snapshot.cells.find((entry) => entry.address === cell);

  if (!snapshotCell) {
    return "";
  }

  if (snapshotCell.formula !== null) {
    return snapshotCell.formula;
  }

  return snapshotCell.displayValue;
};

const normalizeProposal = (proposal: AssistantProposal): AssistantProposal => ({
  ...proposal,
  changes: proposal.changes.map((change) => ({
    ...change,
    cell: normalizeCellAddress(change.cell),
  })),
});

export const extractAssistantProposalFromText = (
  text: string,
): AssistantProposal | null => {
  for (const match of text.matchAll(maybeProposalBlockPattern)) {
    const jsonText = match[1].trim();

    try {
      const parsed = JSON.parse(jsonText);
      const result = assistantProposalSchema.safeParse(parsed);

      if (result.success) {
        return normalizeProposal(result.data);
      }
    } catch {
      continue;
    }
  }

  return null;
};

export const stripAssistantProposalFromText = (text: string): string =>
  text.replace(maybeProposalBlockPattern, "").trim();

export const validateAssistantProposal = (
  proposal: AssistantProposal | null,
  snapshot: WorkbookSnapshot,
): AssistantProposalValidationResult => {
  if (proposal === null) {
    return {
      valid: false,
      proposal: null,
      applyableChanges: [],
      errors: ["Sage did not return a valid proposal."],
    };
  }

  const normalizedProposal = normalizeProposal(proposal);
  const applyableChanges: AssistantCellChange[] = [];
  const errors: string[] = [];

  for (const change of normalizedProposal.changes) {
    const normalizedCell = normalizeCellAddress(change.cell);
    const cellAddress = cellAddressFromA1(normalizedCell, snapshot.dimensions);

    if (!cellAddress) {
      errors.push(`${normalizedCell} is outside the current sheet.`);
      continue;
    }

    if (change.reason.trim().length === 0) {
      errors.push(`${normalizedCell} needs a reason before it can be applied.`);
      continue;
    }

    const currentCellText = getCellTextFromSnapshot(snapshot, normalizedCell);
    const isStale = change.before !== currentCellText;

    if (change.kind !== "review" && isStale) {
      errors.push(
        `${normalizedCell} has changed since Sage prepared this proposal.`,
      );
      continue;
    }

    if (change.kind !== "review") {
      applyableChanges.push(change);
    }
  }

  return {
    valid: errors.length === 0,
    proposal: normalizedProposal,
    applyableChanges,
    errors,
  };
};
