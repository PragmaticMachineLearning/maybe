import type { UIMessage } from "ai";
import { z } from "zod";

import {
  ASSISTANT_MODEL_IDS,
  DEFAULT_ASSISTANT_MODEL_ID,
  type AssistantModelId,
} from "./modelOptions";
import type { WorkbookSnapshot } from "./workbookSnapshot";

export type MaybeAssistantMessage = UIMessage;

const uiMessagePartSchema = z
  .union([
    z
      .object({
        type: z.literal("text"),
        text: z.string(),
      })
      .passthrough(),
    z
      .object({
        type: z.string().min(1),
      })
      .passthrough()
      .refine((part) => part.type !== "text"),
  ]);

const maybeAssistantMessageSchema = z
  .object({
    id: z.string().optional(),
    role: z.enum(["system", "user", "assistant"]),
    parts: z.array(uiMessagePartSchema),
  })
  .passthrough();

const workbookCellKindSchema = z.enum([
  "scalar",
  "text",
  "boolean",
  "distribution",
  "sampled_distribution",
  "error",
  "unknown_object",
]);

const workbookDistributionSchema = z.object({
  kind: z.enum(["normal", "lognormal", "uniform"]),
  source: z.enum(["parameters", "ci"]),
  mean: z.number().optional(),
  variance: z.number().optional(),
  mu: z.number().optional(),
  sigma: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  lower: z.number().optional(),
  upper: z.number().optional(),
  confidenceLevel: z.number().optional(),
});

const workbookSampleSummarySchema = z.object({
  sampleCount: z.number(),
  mean: z.number(),
  standardDeviation: z.number(),
  p10: z.number(),
  p50: z.number(),
  p90: z.number(),
});

const workbookCellSnapshotSchema = z.object({
  address: z.string(),
  row: z.number(),
  col: z.number(),
  formula: z.string().nullable(),
  displayValue: z.string(),
  kind: workbookCellKindSchema,
  distribution: workbookDistributionSchema.optional(),
  sampleSummary: workbookSampleSummarySchema.optional(),
});

const workbookSnapshotSchema = z.object({
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
  allowDirectCellChanges: z.boolean().optional().default(false),
  selectedModel: z
    .enum(ASSISTANT_MODEL_IDS)
    .optional()
    .default(DEFAULT_ASSISTANT_MODEL_ID),
});

export interface AssistantRequestBody {
  messages: MaybeAssistantMessage[];
  workbookSnapshot: WorkbookSnapshot;
  allowDirectCellChanges: boolean;
  selectedModel: AssistantModelId;
}
