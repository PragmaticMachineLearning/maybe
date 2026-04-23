import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import {
  getAssistantActivityLabel,
  isAssistantMessageStreaming,
} from "../../../../src/components/ai/assistantStreamingState";

const assistantMessage = (
  id: string,
  parts: UIMessage["parts"],
): UIMessage => ({
  id,
  role: "assistant",
  parts,
});

describe("assistant streaming state", () => {
  it("treats only the latest assistant message as streaming while busy", () => {
    const first = assistantMessage("first", [{ type: "text", text: "Done." }]);
    const second = assistantMessage("second", [
      { type: "text", text: "Working." },
    ]);

    expect(isAssistantMessageStreaming(first, [first, second], true)).toBe(
      false,
    );
    expect(isAssistantMessageStreaming(second, [first, second], true)).toBe(
      true,
    );
    expect(isAssistantMessageStreaming(second, [first, second], false)).toBe(
      false,
    );
  });

  it("describes the active assistant tool instead of generic thinking", () => {
    const messages: UIMessage[] = [
      assistantMessage("active", [
        { type: "text", text: "I will inspect the sheet." },
        {
          type: "tool-validateFormula",
          state: "input-available",
        } as UIMessage["parts"][number],
      ]),
    ];

    expect(getAssistantActivityLabel(messages, "streaming")).toBe(
      "Validating formula",
    );
  });

  it("falls back to response drafting when text is streaming", () => {
    expect(
      getAssistantActivityLabel(
        [assistantMessage("active", [{ type: "text", text: "Here is" }])],
        "streaming",
      ),
    ).toBe("Drafting response");
  });
});
