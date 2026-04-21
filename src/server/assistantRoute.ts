import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  streamText,
  type StreamTextResult,
  type ToolSet,
} from "ai";

import {
  assistantRequestSchema,
  type AssistantRequestBody,
} from "../assistant/messages";
import type { WorkbookSnapshot } from "../assistant/workbookSnapshot";

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

const buildSystemPrompt = (workbookSnapshot: WorkbookSnapshot): string =>
  [
    "You are Sage, the assistant inside Maybe, a spreadsheet for probabilistic modeling powered by GaussFormula.",
    "Help users understand and edit the current workbook while preserving uncertainty instead of collapsing it to false precision.",
    "The workbook can contain confidence intervals such as CI[10, 20], sampled distributions, formulas, scalar values, text, booleans, and errors.",
    "When proposing edits, every proposed edit must include exactly one hidden maybe-proposal JSON block fenced as ```maybe-proposal.",
    "The visible response should explain the recommendation, but the proposed edits belong only in that hidden JSON block.",
    "Each proposal change must use before fields that exactly match the current formula when a formula exists, otherwise the current display value.",
    "The user must click Apply before any proposed edit changes the workbook.",
    "If the workbook snapshot is truncated, say that the recommendation is based on partial context and ask for confirmation before relying on omitted cells.",
    "Current workbook snapshot:",
    JSON.stringify(workbookSnapshot, null, 2),
  ].join("\n\n");

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
    messages: result.data.messages as AssistantRequestBody["messages"],
    workbookSnapshot: result.data
      .workbookSnapshot as unknown as AssistantRequestBody["workbookSnapshot"],
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

    if (!getApiKey()) {
      return jsonResponse(
        {
          error: "OPENAI_API_KEY is not configured for the assistant server.",
        },
        500,
      );
    }

    const result = streamTextFn({
      model: openai(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
      system: buildSystemPrompt(body.workbookSnapshot),
      messages: await convertToModelMessages(body.messages),
    });

    return result.toUIMessageStreamResponse({
      onError: getErrorMessage,
    });
  };

export const handleAssistantRequest = createAssistantHandler();
