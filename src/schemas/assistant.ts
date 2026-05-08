import { z } from "zod";

import {
  ASSISTANT_MODEL_IDS,
  DEFAULT_ASSISTANT_MODEL_ID,
} from "../assistant/modelOptions";
import { workbookSnapshotSchema } from "./workbook";

export const assistantCellChangeSchema = z
  .object({
    cell: z.string(),
    before: z.string(),
    after: z.string(),
    reason: z.string(),
    kind: z.enum(["add", "update", "review"]),
  })
  .strict();

export const assistantProposalSchema = z
  .object({
    title: z.string(),
    summary: z.string(),
    changes: z.array(assistantCellChangeSchema),
  })
  .strict();

const uiMessagePartSchema = z.union([
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

export const assistantRequestSchema = z.object({
  messages: z.array(maybeAssistantMessageSchema),
  workbookSnapshot: workbookSnapshotSchema,
  allowDirectCellChanges: z.boolean().optional().default(false),
  selectedModel: z
    .enum(ASSISTANT_MODEL_IDS)
    .optional()
    .default(DEFAULT_ASSISTANT_MODEL_ID),
});

export type AssistantCellChange = z.infer<typeof assistantCellChangeSchema>;
export type AssistantProposal = z.infer<typeof assistantProposalSchema>;
export type AssistantRequestBody = z.output<typeof assistantRequestSchema>;
