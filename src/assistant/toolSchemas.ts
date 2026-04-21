import { z } from "zod";

export const workbookContextInputSchema = z.object({
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
}).strict();

export const validateFormulaInputSchema = z.object({
  cell: z.string(),
  formula: z.string(),
}).strict();

export type ValidateFormulaInput = z.infer<typeof validateFormulaInputSchema>;
