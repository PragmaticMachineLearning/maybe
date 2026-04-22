export const ASSISTANT_MODEL_OPTIONS = [
  { id: "gpt-5.4", label: "GPT-5.4" },
  { id: "gpt-5.4-mini", label: "GPT-5.4 mini" },
  { id: "gpt-5.4-nano", label: "GPT-5.4 nano" },
  { id: "gpt-5-mini", label: "GPT-5 mini" },
  { id: "gpt-5-nano", label: "GPT-5 nano" },
  { id: "gpt-5", label: "GPT-5" },
  { id: "gpt-4.1", label: "GPT-4.1" },
] as const;

export type AssistantModelId = (typeof ASSISTANT_MODEL_OPTIONS)[number]["id"];

export const DEFAULT_ASSISTANT_MODEL_ID: AssistantModelId = "gpt-5.4-mini";

export const ASSISTANT_MODEL_IDS = ASSISTANT_MODEL_OPTIONS.map(
  (option) => option.id,
) as [AssistantModelId, ...AssistantModelId[]];
