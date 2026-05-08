import { z } from "zod";

export const serializedCellContentSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

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

export const workbookSnapshotSchema = z.object({
  sheetName: z.string(),
  dimensions: z.object({
    width: z.number(),
    height: z.number(),
  }),
  selectedCell: z.string().nullable(),
  serializedContent: z.array(z.array(serializedCellContentSchema)),
  cells: z.array(workbookCellSnapshotSchema),
  includedCellCount: z.number(),
  totalNonEmptyCellCount: z.number(),
  truncated: z.boolean(),
});

export type SerializedCellContent = z.infer<typeof serializedCellContentSchema>;
export type WorkbookCellKind = z.infer<typeof workbookCellKindSchema>;
export type WorkbookSampleSummary = z.infer<typeof workbookSampleSummarySchema>;
export type WorkbookCellSnapshot = z.infer<typeof workbookCellSnapshotSchema>;
export type WorkbookSnapshot = z.infer<typeof workbookSnapshotSchema>;
