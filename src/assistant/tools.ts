import { tool } from "ai";

import { validateFormulaAgainstSnapshot } from "./formulaValidation";
import {
  assistantProposalSchema,
  type AssistantProposal,
} from "../schemas/assistant";
import {
  validateFormulaInputSchema,
  workbookContextInputSchema,
} from "../schemas/tools";
import type { WorkbookSnapshot } from "../schemas/workbook";
import {
  normalizeAssistantProposal,
  validateAssistantProposal,
} from "./proposals";

interface CreateAssistantToolsOptions {
  allowDirectCellChanges?: boolean;
}

const assertApplyableProposal = (
  workbookSnapshot: WorkbookSnapshot,
  proposal: AssistantProposal,
): AssistantProposal => {
  const normalizedProposal = normalizeAssistantProposal(proposal);
  const validation = validateAssistantProposal(
    normalizedProposal,
    workbookSnapshot,
  );

  if (!validation.valid || !validation.proposal) {
    throw new Error(
      [
        "The direct edit could not be validated against the workbook snapshot.",
        "Do not describe the cell as locked or being edited by another session.",
        "Return a reviewable proposal instead.",
        validation.errors.join(" "),
      ].join(" "),
    );
  }

  return validation.proposal;
};

export const createAssistantTools = (
  workbookSnapshot: WorkbookSnapshot,
  { allowDirectCellChanges = false }: CreateAssistantToolsOptions = {},
) => {
  const reviewTools = {
    getWorkbookContext: tool({
      description:
        "Inspect the current Maybe workbook snapshot, including cells, formulas, selected cell, and distribution summaries.",
      inputSchema: workbookContextInputSchema,
      execute: async () => workbookSnapshot,
    }),
    validateFormula: tool({
      description:
        "Validate a Maybe/GaussFormula cell formula or value against the current workbook before proposing it.",
      inputSchema: validateFormulaInputSchema,
      execute: async (input) =>
        validateFormulaAgainstSnapshot(workbookSnapshot, input),
    }),
    proposeCellChanges: tool({
      description:
        "Return typed spreadsheet cell changes for the user to review and apply. This tool does not mutate the workbook.",
      inputSchema: assistantProposalSchema,
      execute: async (proposal) => normalizeAssistantProposal(proposal),
    }),
  };

  if (!allowDirectCellChanges) {
    return reviewTools;
  }

  return {
    ...reviewTools,
    applyCellChanges: tool({
      description:
        "Return validated spreadsheet cell changes for immediate client-side application. Only use this when Write mode is enabled.",
      inputSchema: assistantProposalSchema,
      execute: async (proposal) =>
        assertApplyableProposal(workbookSnapshot, proposal),
    }),
  };
};
