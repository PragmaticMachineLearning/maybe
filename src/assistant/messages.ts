import type { UIMessage } from "ai";
import { z } from "zod";

import type { WorkbookSnapshot } from "./workbookSnapshot";

export type MaybeAssistantMessage = UIMessage;

export const uiMessagePartSchema = z
  .object({
    type: z.literal("text"),
    text: z.string(),
  })
  .passthrough();

export const maybeAssistantMessageSchema = z
  .object({
    id: z.string().optional(),
    role: z.enum(["system", "user", "assistant"]),
    parts: z.array(uiMessagePartSchema),
  })
  .passthrough();

export const workbookCellKindSchema = z.enum([
  "scalar",
  "text",
  "boolean",
  "confidence_interval",
  "sampled_distribution",
  "error",
  "unknown_object",
]);

export const workbookConfidenceIntervalSchema = z.object({
  lower: z.number(),
  upper: z.number(),
  confidenceLevel: z.number(),
  interpretation: z.string(),
});

export const workbookSampleSummarySchema = z.object({
  sampleCount: z.number(),
  mean: z.number(),
  standardDeviation: z.number(),
  p10: z.number(),
  p50: z.number(),
  p90: z.number(),
});

export const workbookCellSnapshotSchema = z.object({
  address: z.string(),
  row: z.number(),
  col: z.number(),
  formula: z.string().nullable(),
  displayValue: z.string(),
  kind: workbookCellKindSchema,
  confidenceInterval: workbookConfidenceIntervalSchema.optional(),
  sampleSummary: workbookSampleSummarySchema.optional(),
});

export const workbookSnapshotSchema = z.object({
  sheetName: z.string(),
  dimensions: z.object({
    width: z.number(),
    height: z.number(),
  }),
  selectedCell: z.string().nullable(),
  cells: z.array(workbookCellSnapshotSchema),
  includedCellCount: z.number(),
  totalNonEmptyCellCount: z.number(),
  truncated: z.boolean(),
});

export const assistantRequestSchema = z.object({
  messages: z.array(maybeAssistantMessageSchema),
  workbookSnapshot: workbookSnapshotSchema,
});

export interface AssistantRequestBody {
  messages: MaybeAssistantMessage[];
  workbookSnapshot: WorkbookSnapshot;
}
