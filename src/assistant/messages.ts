import type { UIMessage } from "ai";

import type { AssistantModelId } from "./modelOptions";
import type { WorkbookSnapshot } from "../schemas/workbook";

export { assistantRequestSchema } from "../schemas/assistant";

export type MaybeAssistantMessage = UIMessage;

export interface AssistantRequestBody {
  messages: MaybeAssistantMessage[];
  workbookSnapshot: WorkbookSnapshot;
  allowDirectCellChanges: boolean;
  selectedModel: AssistantModelId;
}
