import { z } from "zod";

import { serializedCellContentSchema } from "./workbook";

export const saveWorkbookRequestSchema = z.object({
  serializedContent: z.array(z.array(serializedCellContentSchema)),
});

export type SaveWorkbookRequest = z.infer<typeof saveWorkbookRequestSchema>;
export type SerializedWorkbookContent = SaveWorkbookRequest["serializedContent"];
