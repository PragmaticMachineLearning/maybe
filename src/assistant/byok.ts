export const ASSISTANT_BYOK_HEADER = "x-maybe-openai-api-key";

export const normalizeAssistantApiKey = (
  apiKey: string | null | undefined,
): string | undefined => {
  const trimmedApiKey = apiKey?.trim();
  return trimmedApiKey ? trimmedApiKey : undefined;
};
