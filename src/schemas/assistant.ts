import { z } from "zod";

import {
  ASSISTANT_MODEL_IDS,
  DEFAULT_ASSISTANT_MODEL_ID,
} from "../assistant/modelOptions";
import { workbookSnapshotSchema } from "./workbook";

const assistantCellChangeSchema = z
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
  z.looseObject({
    type: z.literal("text"),
    text: z.string(),
  }),
  z
    .looseObject({
      type: z.string().min(1),
    })
    .refine((part) => part.type !== "text"),
]);

const maybeAssistantMessageSchema = z.looseObject({
  id: z.string().optional(),
  role: z.enum(["system", "user", "assistant"]),
  parts: z.array(uiMessagePartSchema),
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

export type AssistantCellChange = z.infer<typeof assistantCellChangeSchema>;
export type AssistantProposal = z.infer<typeof assistantProposalSchema>;
