import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type StreamTextResult,
  type ToolSet,
} from "ai";

import {
  assistantRequestSchema,
  type AssistantRequestBody,
  type MaybeAssistantMessage,
} from "../assistant/messages";
import { createAssistantTools } from "../assistant/tools";
import { buildAssistantSystemPrompt } from "./assistantSystemPrompt";

const jsonResponse = (body: unknown, status: number): Response =>
  Response.json(body, { status });

const invalidRequestResponse = (): Response =>
  jsonResponse({ error: "Invalid assistant request." }, 400);

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return `Assistant provider error: ${error.name}`;
  }

  return "Assistant provider error.";
};

type AssistantStreamTextResult = Pick<
  StreamTextResult<ToolSet, never>,
  "toUIMessageStreamResponse"
>;

type AssistantStreamTextFn = (
  options: Parameters<typeof streamText>[0],
) => AssistantStreamTextResult;

interface CreateAssistantHandlerOptions {
  getApiKey?: () => string | undefined;
  streamTextFn?: AssistantStreamTextFn;
}

const parseAssistantRequest = async (
  request: Request,
): Promise<AssistantRequestBody | null> => {
  let parsedJson: unknown;

  try {
    parsedJson = await request.json();
  } catch {
    return null;
  }

  const result = assistantRequestSchema.safeParse(parsedJson);
  if (!result.success) {
    return null;
  }

  return {
    messages: result.data.messages as MaybeAssistantMessage[],
    workbookSnapshot: result.data.workbookSnapshot,
    allowDirectCellChanges: result.data.allowDirectCellChanges,
    selectedModel: result.data.selectedModel,
  };
};

export const createAssistantHandler = ({
  getApiKey = () => process.env.OPENAI_API_KEY,
  streamTextFn = streamText as AssistantStreamTextFn,
}: CreateAssistantHandlerOptions = {}) =>
  async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return jsonResponse(
        { error: "Assistant endpoint only supports POST." },
        405,
      );
    }

    const body = await parseAssistantRequest(request);
    if (body === null) {
      return invalidRequestResponse();
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return jsonResponse(
        {
          error: "OPENAI_API_KEY is not configured for the assistant server.",
        },
        500,
      );
    }

    const openaiProvider = createOpenAI({ apiKey });
    const result = streamTextFn({
      model: openaiProvider(body.selectedModel),
      system: buildAssistantSystemPrompt({
        workbookSnapshot: body.workbookSnapshot,
        allowDirectCellChanges: body.allowDirectCellChanges,
      }),
      messages: await convertToModelMessages(body.messages),
      tools: createAssistantTools(body.workbookSnapshot, {
        allowDirectCellChanges: body.allowDirectCellChanges,
      }),
      stopWhen: stepCountIs(4),
    });

    return result.toUIMessageStreamResponse({
      onError: getErrorMessage,
    });
  };
