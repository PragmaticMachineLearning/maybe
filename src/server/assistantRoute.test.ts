import { describe, expect, it, vi } from "vitest";

import { createAssistantHandler } from "./assistantRoute";

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
});
