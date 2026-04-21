import type { UIMessage } from "ai";
import { z } from "zod";

import type { WorkbookSnapshot } from "./workbookSnapshot";

export type MaybeAssistantMessage = UIMessage;

export const workbookSnapshotSchema = z.object({
  sheetName: z.string(),
  dimensions: z.object({
    width: z.number(),
    height: z.number(),
  }),
  selectedCell: z.string().nullable(),
  cells: z.array(z.record(z.string(), z.unknown())),
  includedCellCount: z.number(),
  totalNonEmptyCellCount: z.number(),
  truncated: z.boolean(),
});

export const assistantRequestSchema = z.object({
  messages: z.array(z.unknown()),
  workbookSnapshot: workbookSnapshotSchema,
});

export interface AssistantRequestBody {
  messages: MaybeAssistantMessage[];
  workbookSnapshot: WorkbookSnapshot;
}
