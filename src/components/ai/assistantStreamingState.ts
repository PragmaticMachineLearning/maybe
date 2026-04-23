import type { UIMessage } from "ai";

type AssistantStatus = "submitted" | "streaming" | "ready" | "error";

interface ToolLikePart {
  type: string;
  state?: string;
}

const getAssistantMessages = (messages: readonly UIMessage[]): UIMessage[] =>
  messages.filter((message) => message.role === "assistant");

export const isAssistantMessageStreaming = (
  message: UIMessage,
  assistantMessages: readonly UIMessage[],
  isBusy: boolean,
): boolean => {
  if (!isBusy || message.role !== "assistant") {
    return false;
  }

  const latestAssistantMessage = assistantMessages[assistantMessages.length - 1];
  return latestAssistantMessage?.id === message.id;
};

const getToolStatusLabel = (part: ToolLikePart): string | null => {
  switch (part.type) {
    case "tool-getWorkbookContext":
      return part.state === "output-available"
        ? "Reviewed workbook context"
        : "Inspecting workbook context";
    case "tool-validateFormula":
      return part.state === "output-available"
        ? "Formula validated"
        : "Validating formula";
    case "tool-proposeCellChanges":
      return part.state === "output-available"
        ? "Proposal prepared"
        : "Preparing proposal";
    case "tool-applyCellChanges":
      return part.state === "output-available"
        ? "Cell changes validated"
        : "Validating cell changes";
    default:
      return null;
  }
};

export const getAssistantActivityLabel = (
  messages: readonly UIMessage[],
  status: AssistantStatus,
): string => {
  if (status === "submitted") {
    return "Preparing workbook context";
  }

  if (status !== "streaming") {
    return "Sage is ready";
  }

  const assistantMessages = getAssistantMessages(messages);
  const latestAssistantMessage =
    assistantMessages[assistantMessages.length - 1];
  const latestParts = latestAssistantMessage?.parts ?? [];

  for (const part of [...latestParts].reverse()) {
    if (typeof part.type === "string" && part.type.startsWith("tool-")) {
      const toolStatus = getToolStatusLabel(part as ToolLikePart);
      if (toolStatus) {
        return toolStatus;
      }
    }

    if (part.type === "text" && part.text.trim().length > 0) {
      return "Drafting response";
    }

    if (part.type === "reasoning") {
      return "Planning next step";
    }
  }

  return "Sage is working";
};
