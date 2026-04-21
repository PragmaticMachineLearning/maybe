import type { streamText } from "ai";
import { describe, expect, it, vi } from "vitest";

import { createAssistantHandler } from "./assistantRoute";

type StreamTextOptions = Parameters<typeof streamText>[0];

const validAssistantRequestBody = {
  messages: [],
  workbookSnapshot: {
    sheetName: "Sheet1",
    dimensions: { width: 2, height: 2 },
    selectedCell: null,
    cells: [],
    includedCellCount: 0,
    totalNonEmptyCellCount: 0,
    truncated: false,
  },
};

const requestBodyWithWorkbookContext = {
  ...validAssistantRequestBody,
  messages: [
    {
      role: "user",
      parts: [{ type: "text", text: "Summarize the uncertainty." }],
    },
  ],
  workbookSnapshot: {
    ...validAssistantRequestBody.workbookSnapshot,
    cells: [
      {
        address: "A1",
        row: 0,
        col: 0,
        formula: null,
        displayValue: "CI[10, 20]",
        kind: "confidence_interval",
        confidenceInterval: {
          lower: 10,
          upper: 20,
          confidenceLevel: 95,
          interpretation: "normal",
        },
      },
    ],
    includedCellCount: 1,
    totalNonEmptyCellCount: 1,
  },
};

describe("assistant route", () => {
  it("returns a 500 error when OPENAI_API_KEY is missing", async () => {
    const streamTextFn = vi.fn(() => ({
      toUIMessageStreamResponse: () => new Response(),
    }));
    const handler = createAssistantHandler({
      getApiKey: () => undefined,
      streamTextFn,
    });

    const response = await handler(
      new Request("http://localhost/api/assistant", {
        method: "POST",
        body: JSON.stringify(validAssistantRequestBody),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "OPENAI_API_KEY is not configured for the assistant server.",
    });
    expect(response.status).toBe(500);
    expect(streamTextFn).not.toHaveBeenCalled();
  });

  it("returns a 400 error for malformed assistant requests", async () => {
    const streamTextFn = vi.fn(() => ({
      toUIMessageStreamResponse: () => new Response(),
    }));
    const handler = createAssistantHandler({
      getApiKey: () => "sk-test",
      streamTextFn,
    });

    const response = await handler(
      new Request("http://localhost/api/assistant", {
        method: "POST",
        body: JSON.stringify({ messages: [] }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "Invalid assistant request.",
    });
    expect(response.status).toBe(400);
    expect(streamTextFn).not.toHaveBeenCalled();
  });

  it("returns a 400 error when messages is not an array", async () => {
    const streamTextFn = vi.fn(() => ({
      toUIMessageStreamResponse: () => new Response(),
    }));
    const handler = createAssistantHandler({
      getApiKey: () => "sk-test",
      streamTextFn,
    });

    const response = await handler(
      new Request("http://localhost/api/assistant", {
        method: "POST",
        body: JSON.stringify({
          ...validAssistantRequestBody,
          messages: "not an array",
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "Invalid assistant request.",
    });
    expect(response.status).toBe(400);
    expect(streamTextFn).not.toHaveBeenCalled();
  });

  it("returns a 400 error when a UI message is missing parts", async () => {
    const streamTextFn = vi.fn(() => ({
      toUIMessageStreamResponse: () => new Response(),
    }));
    const handler = createAssistantHandler({
      getApiKey: () => "sk-test",
      streamTextFn,
    });

    const response = await handler(
      new Request("http://localhost/api/assistant", {
        method: "POST",
        body: JSON.stringify({
          ...validAssistantRequestBody,
          messages: [{ role: "user" }],
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "Invalid assistant request.",
    });
    expect(response.status).toBe(400);
    expect(streamTextFn).not.toHaveBeenCalled();
  });

  it("returns a 400 error when a text part is missing text", async () => {
    const streamTextFn = vi.fn(() => ({
      toUIMessageStreamResponse: () => new Response(),
    }));
    const handler = createAssistantHandler({
      getApiKey: () => "sk-test",
      streamTextFn,
    });

    const response = await handler(
      new Request("http://localhost/api/assistant", {
        method: "POST",
        body: JSON.stringify({
          ...validAssistantRequestBody,
          messages: [{ role: "user", parts: [{ type: "text" }] }],
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "Invalid assistant request.",
    });
    expect(response.status).toBe(400);
    expect(streamTextFn).not.toHaveBeenCalled();
  });

  it("accepts valid text messages before checking OPENAI_API_KEY", async () => {
    const streamTextFn = vi.fn(() => ({
      toUIMessageStreamResponse: () => new Response(),
    }));
    const handler = createAssistantHandler({
      getApiKey: () => undefined,
      streamTextFn,
    });

    const response = await handler(
      new Request("http://localhost/api/assistant", {
        method: "POST",
        body: JSON.stringify({
          ...validAssistantRequestBody,
          messages: [
            {
              role: "user",
              parts: [{ type: "text", text: "hello" }],
            },
          ],
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "OPENAI_API_KEY is not configured for the assistant server.",
    });
    expect(response.status).toBe(500);
    expect(streamTextFn).not.toHaveBeenCalled();
  });

  it("streams a response with converted messages and workbook context", async () => {
    const toUIMessageStreamResponse = vi.fn(() => new Response("ok"));
    const streamTextFn = vi.fn((options: StreamTextOptions) => ({
      options,
      toUIMessageStreamResponse,
    }));
    const handler = createAssistantHandler({
      getApiKey: () => "sk-test",
      streamTextFn,
    });

    const response = await handler(
      new Request("http://localhost/api/assistant", {
        method: "POST",
        body: JSON.stringify(requestBodyWithWorkbookContext),
      }),
    );

    await expect(response.text()).resolves.toBe("ok");
    expect(response.status).toBe(200);
    expect(streamTextFn).toHaveBeenCalledOnce();
    expect(toUIMessageStreamResponse).toHaveBeenCalledOnce();

    const options = streamTextFn.mock.calls[0]?.[0];
    expect(options).toBeDefined();
    if (!options) {
      throw new Error("streamTextFn was not called with options.");
    }

    expect(options.system).toContain("Current workbook snapshot");
    expect(options.system).toContain("CI[10, 20]");

    const sentMessages = options.messages;
    expect(sentMessages).toBeDefined();
    if (!sentMessages) {
      throw new Error("streamTextFn was not called with messages.");
    }

    expect(sentMessages).toEqual([
      expect.objectContaining({
        role: "user",
        content: [
          {
            type: "text",
            text: "Summarize the uncertainty.",
          },
        ],
      }),
    ]);
    expect(sentMessages[0]).not.toHaveProperty("parts");
  });

  it("accepts assistant history containing step-start parts", async () => {
    const toUIMessageStreamResponse = vi.fn(() => new Response("ok"));
    const streamTextFn = vi.fn((options: StreamTextOptions) => ({
      options,
      toUIMessageStreamResponse,
    }));
    const handler = createAssistantHandler({
      getApiKey: () => "sk-test",
      streamTextFn,
    });

    const response = await handler(
      new Request("http://localhost/api/assistant", {
        method: "POST",
        body: JSON.stringify({
          ...validAssistantRequestBody,
          messages: [
            {
              id: "previous-assistant",
              role: "assistant",
              parts: [
                { type: "step-start" },
                { type: "text", text: "Earlier workbook summary." },
              ],
            },
            {
              id: "new-user-message",
              role: "user",
              parts: [{ type: "text", text: "What should I change next?" }],
            },
          ],
        }),
      }),
    );

    await expect(response.text()).resolves.toBe("ok");
    expect(response.status).toBe(200);
    expect(streamTextFn).toHaveBeenCalledOnce();

    const options = streamTextFn.mock.calls[0]?.[0];
    expect(options).toBeDefined();
    if (!options) {
      throw new Error("streamTextFn was not called with options.");
    }

    expect(options.messages).toEqual([
      {
        role: "assistant",
        content: [
          {
            type: "text",
            text: "Earlier workbook summary.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "What should I change next?",
          },
        ],
      },
    ]);
  });
});
