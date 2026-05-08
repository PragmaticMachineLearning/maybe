import { z } from "zod";

import { assistantProposalSchema } from "./assistant";

export const workbookContextInputSchema = z
  .object({
    range: z.string().optional(),
    include: z
      .object({
        cells: z.boolean().optional(),
        formulas: z.boolean().optional(),
        distributions: z.boolean().optional(),
        selection: z.boolean().optional(),
        dependencyGraph: z.boolean().optional(),
      })
      .optional(),
  })
  .strict();

export const validateFormulaInputSchema = z
  .object({
    cell: z.string(),
    formula: z.string(),
  })
  .strict();

export type ValidateFormulaInput = z.infer<typeof validateFormulaInputSchema>;

export const reviewAssistantToolNames = [
  "getWorkbookContext",
  "validateFormula",
  "proposeCellChanges",
] as const;

export const writeAssistantToolNames = [
  ...reviewAssistantToolNames,
  "applyCellChanges",
] as const;

export const assistantToolInputSchemas = {
  getWorkbookContext: workbookContextInputSchema,
  validateFormula: validateFormulaInputSchema,
  proposeCellChanges: assistantProposalSchema,
  applyCellChanges: assistantProposalSchema,
} as const;

export type ReviewAssistantToolName =
  (typeof reviewAssistantToolNames)[number];
export type WriteAssistantToolName = (typeof writeAssistantToolNames)[number];
export type AssistantToolName = keyof typeof assistantToolInputSchemas;
