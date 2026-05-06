import { z } from "zod";

import type { FormulaEngine } from "../lib/formulaEngine";
import { cellAddressFromA1 } from "./address";
import {
  buildWorkbookSnapshot,
  type WorkbookSnapshot,
} from "./workbookSnapshot";

const assistantCellChangeSchema = z.object({
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

interface AssistantProposalValidationResult {
  valid: boolean;
  proposal: AssistantProposal | null;
  applyableChanges: AssistantCellChange[];
  errors: string[];
}

const proposalBlockPattern = /```(maybe-proposal|json)\s*([\s\S]*?)```/g;

interface AssistantToolProposalPart {
  type: string;
  state?: string;
  output?: unknown;
  input?: unknown;
}

type AssistantProposalSource =
  | "text"
  | "tool-proposeCellChanges"
  | "tool-applyCellChanges";

export interface AssistantProposalResult {
  proposal: AssistantProposal;
  source: AssistantProposalSource;
}

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

export const normalizeAssistantProposal = (
  proposal: AssistantProposal,
): AssistantProposal => ({
  ...proposal,
  changes: proposal.changes.map((change) => ({
    ...change,
    cell: normalizeCellAddress(change.cell),
  })),
});

const parseProposalJson = (jsonText: string): AssistantProposal | null => {
  try {
    const parsed = JSON.parse(jsonText);
    const result = assistantProposalSchema.safeParse(parsed);

    return result.success ? normalizeAssistantProposal(result.data) : null;
  } catch {
    return null;
  }
};

const parseProposalValue = (value: unknown): AssistantProposal | null => {
  const result = assistantProposalSchema.safeParse(value);

  return result.success ? normalizeAssistantProposal(result.data) : null;
};

const getDuplicateNonReviewCells = (
  changes: AssistantCellChange[],
): Set<string> => {
  const seenCells = new Set<string>();
  const duplicateCells = new Set<string>();

  for (const change of changes) {
    if (change.kind === "review") {
      continue;
    }

    const normalizedCell = normalizeCellAddress(change.cell);

    if (seenCells.has(normalizedCell)) {
      duplicateCells.add(normalizedCell);
    }

    seenCells.add(normalizedCell);
  }

  return duplicateCells;
};

export const extractAssistantProposalFromText = (
  text: string,
): AssistantProposal | null => {
  for (const match of text.matchAll(proposalBlockPattern)) {
    const proposal = parseProposalJson(match[2].trim());

    if (proposal !== null) {
      return proposal;
    }
  }

  return null;
};

export const stripAssistantProposalFromText = (text: string): string =>
  text
    .replace(proposalBlockPattern, (block, fenceType: string, jsonText: string) => {
      if (fenceType === "maybe-proposal") {
        return "";
      }

      return parseProposalJson(jsonText.trim()) === null ? block : "";
    })
    .trim();

export const extractAssistantProposalResultFromParts = (
  parts: readonly AssistantToolProposalPart[],
): AssistantProposalResult | null => {
  for (const part of parts) {
    if (
      part.type !== "tool-proposeCellChanges" &&
      part.type !== "tool-applyCellChanges"
    ) {
      continue;
    }

    if (part.state !== "output-available") {
      continue;
    }

    const proposal = parseProposalValue(part.output);
    if (proposal !== null) {
      return {
        proposal,
        source: part.type,
      };
    }
  }

  return null;
};

export const validateAssistantProposal = (
  proposal: AssistantProposal | null,
  snapshot: WorkbookSnapshot,
): AssistantProposalValidationResult => {
  if (proposal === null) {
    return {
      valid: false,
      proposal: null,
      applyableChanges: [],
      errors: ["Maybe did not return a valid proposal."],
    };
  }

  const normalizedProposal = normalizeAssistantProposal(proposal);
  const applyableChanges: AssistantCellChange[] = [];
  const errors: string[] = [];
  const duplicateNonReviewCells = getDuplicateNonReviewCells(
    normalizedProposal.changes,
  );

  for (const duplicateCell of duplicateNonReviewCells) {
    errors.push(`${duplicateCell} has more than one proposed edit.`);
  }

  for (const change of normalizedProposal.changes) {
    const normalizedCell = normalizeCellAddress(change.cell);
    const cellAddress = cellAddressFromA1(normalizedCell, snapshot.dimensions);

    if (
      change.kind !== "review" &&
      duplicateNonReviewCells.has(normalizedCell)
    ) {
      continue;
    }

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
        `${normalizedCell} has changed since Maybe prepared this proposal.`,
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

export const applyAssistantChangesToEngine = (
  formulaEngine: FormulaEngine,
  dimensions: WorkbookSnapshot["dimensions"],
  changes: AssistantCellChange[],
): void => {
  const currentSnapshot = buildWorkbookSnapshot({
    formulaEngine,
    selectedCell: null,
    maxCells: dimensions.width * dimensions.height,
  });
  const validationSnapshot = {
    ...currentSnapshot,
    dimensions,
  };
  const validationResult = validateAssistantProposal(
    {
      title: "Apply assistant changes",
      summary: "",
      changes,
    },
    validationSnapshot,
  );

  if (!validationResult.valid) {
    throw new Error(validationResult.errors.join(" "));
  }

  for (const change of validationResult.applyableChanges) {
    const address = cellAddressFromA1(change.cell, dimensions);
    if (!address) {
      throw new Error(`${change.cell} is outside the current sheet.`);
    }

    formulaEngine.setCellContents(
      { sheet: 0, row: address.row, col: address.col },
      change.after,
    );
  }
};
