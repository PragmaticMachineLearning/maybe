import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  streamText,
  type StreamTextResult,
  type ToolSet,
} from "ai";

import {
  assistantRequestSchema,
  type AssistantRequestBody,
  type MaybeAssistantMessage,
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
    "Do not use LaTeX. Use Maybe spreadsheet formulas such as =A1*B1, CI[10, 20], P10(A1), P50(A1), and P90(A1).",
    "Keep visible responses concise and readable: a short summary, the key formulas, and any caveats. Do not expose raw JSON to the user.",
    "When the user asks you to add, update, or set up worksheet content, use the hidden proposal block. Return exactly one valid JSON object inside exactly one hidden block fenced as ```maybe-proposal.",
    "The visible response should explain the recommendation. The proposed edits belong only in that hidden JSON block.",
    "Each proposal change must use before fields that exactly match the current formula when a formula exists, otherwise the current display value.",
    "Do not say that you will implement changes, have implemented changes, or that the user should look for a hidden proposal. The user must click Apply before any proposed edit changes the workbook.",
    "A proposal block must match this shape exactly:",
    [
      "```maybe-proposal",
      JSON.stringify({
        title: "Add cost review outputs",
        summary: "Adds formulas that preserve uncertainty through the cost estimate.",
        changes: [
          {
            cell: "B7",
            before: "",
            after: "=A1*A2",
            reason: "Combine uncertain source inputs without flattening them.",
            kind: "add",
          },
        ],
      }),
      "```",
    ].join("\n"),
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
    messages: result.data.messages as MaybeAssistantMessage[],
    workbookSnapshot: result.data.workbookSnapshot,
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
      model: openaiProvider(process.env.OPENAI_MODEL ?? "gpt-4o-mini"),
      system: buildSystemPrompt(body.workbookSnapshot),
      messages: await convertToModelMessages(body.messages),
    });

    return result.toUIMessageStreamResponse({
      onError: getErrorMessage,
    });
  };

export const handleAssistantRequest = createAssistantHandler();
