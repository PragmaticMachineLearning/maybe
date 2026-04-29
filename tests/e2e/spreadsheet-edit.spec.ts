import { expect, test } from "@playwright/test";

test("edits a spreadsheet cell directly", async ({ page }) => {
  await page.goto("/");

  const firstCell = page.locator("tbody tr:first-child td:nth-child(2) > div");
  await firstCell.dblclick();

  const editor = page.getByLabel("Cell A1");
  await expect(editor).toBeVisible();

  await editor.fill("456");
  await editor.press("Enter");

  await expect(firstCell).toHaveText("456");
  await expect(page.getByPlaceholder("Enter value or formula…")).toHaveValue(
    "456",
  );
});

test("persists spreadsheet edits across refresh", async ({ page }) => {
  await page.goto("/");

  const firstCell = page.locator("tbody tr:first-child td:nth-child(2) > div");
  await firstCell.dblclick();

  const editor = page.getByLabel("Cell A1");
  await expect(editor).toBeVisible();

  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/workbook") &&
      response.request().method() === "PUT",
  );
  await editor.fill("789");
  await editor.press("Enter");
  expect((await saveResponse).ok()).toBe(true);

  await page.reload();

  await expect(firstCell).toHaveText("789");
  await expect(page.getByPlaceholder("Enter value or formula…")).toHaveValue(
    "789",
  );
});

test("double-clicking an existing cell preserves the editor and formula bar values", async ({
  page,
}) => {
  await page.goto("/");

  const firstCell = page.locator("tbody tr:first-child td:nth-child(2) > div");
  const formulaBar = page.getByPlaceholder("Enter value or formula…");

  await firstCell.dblclick();

  const editor = page.getByLabel("Cell A1");
  await editor.fill("456");
  await editor.press("Enter");

  await expect(firstCell).toHaveText("456");
  await expect(formulaBar).toHaveValue("456");

  await firstCell.dblclick();

  await expect(page.getByLabel("Cell A1")).toHaveValue("456");
  await expect(formulaBar).toHaveValue("456");
});

test("opens an explicit distribution chart", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");

  const firstCell = page.locator("tbody tr:first-child td:nth-child(2) > div");
  await firstCell.dblclick();

  const editor = page.getByLabel("Cell A1");
  await editor.fill("N.CI(10, 20)");
  await editor.press("Enter");

  await expect(firstCell).toHaveText("N 95% CI [10, 20]");

  await firstCell.click({ button: "right" });

  await expect(page.locator(".echarts-for-react")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("opens Ask Maybe, receives a proposal, and applies it", async ({ page }) => {
  const promptText = "Add an output that doubles the selected input";
  const assistantText = [
    "I can add a dependent output that keeps the uncertainty from A1.",
    "",
    "```maybe-proposal",
    JSON.stringify({
      title: "Add review output",
      summary: "Adds an output based on the selected input.",
      changes: [
        {
          cell: "B1",
          before: "",
          after: "=A1*2",
          reason: "Creates an uncertainty-preserving dependent output.",
          kind: "add",
        },
      ],
    }),
    "```",
  ].join("\n");

  await page.route("**/api/assistant", async (route) => {
    const requestBody = route.request().postDataJSON() as {
      messages?: Array<{
        role?: string;
        parts?: Array<{ type?: string; text?: string }>;
      }>;
      workbookSnapshot?: {
        selectedCell?: string | null;
        cells?: Array<{
          address?: string;
          kind?: string;
          displayValue?: string;
        }>;
      };
    };

    expect(requestBody.workbookSnapshot).toBeTruthy();
    expect(requestBody.workbookSnapshot?.selectedCell).toBe("A1");
    expect(requestBody.workbookSnapshot?.cells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          address: "A1",
          kind: "distribution",
        }),
      ]),
    );
    expect(requestBody.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          parts: expect.arrayContaining([
            expect.objectContaining({ type: "text", text: promptText }),
          ]),
        }),
      ]),
    );

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: [
        { type: "start", messageId: "sage-test-proposal" },
        { type: "start-step" },
        { type: "text-start", id: "text-1" },
        { type: "text-delta", id: "text-1", delta: assistantText },
        { type: "text-end", id: "text-1" },
        { type: "finish-step" },
        { type: "finish", finishReason: "stop" },
      ]
        .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
        .join(""),
    });
  });

  await page.goto("/");

  const firstCell = page.locator("tbody tr:first-child td:nth-child(2) > div");
  const secondCell = page.locator("tbody tr:first-child td:nth-child(3) > div");
  const thirdCell = page.locator("tbody tr:first-child td:nth-child(4) > div");

  await firstCell.dblclick();

  let editor = page.getByLabel("Cell A1");
  await editor.fill("N.CI(10, 20)");
  await editor.press("Enter");

  // GaussFormula trims empty rightmost columns, so C1 keeps empty B1 in bounds.
  await thirdCell.dblclick();

  editor = page.getByLabel("Cell C1");
  await editor.fill("context");
  await editor.press("Enter");

  await firstCell.click();

  await expect(page.getByRole("button", { name: /Ask Maybe/i })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Assistant" })).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: /Ask Maybe/i }).click();
  await expect(page.getByRole("complementary", { name: "Assistant" })).toBeVisible();

  await page.getByLabel("Message assistant")
    .fill(promptText);
  await page.getByRole("button", { name: "Send" }).click();

  await expect(
    page.getByText("I can add a dependent output that keeps the uncertainty from A1."),
  ).toBeVisible();
  await expect(page.getByText("```maybe-proposal")).toHaveCount(0);
  await expect(page.getByText("=A1*2")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply 1 change" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Apply 1 change" }).click();
  await secondCell.dispatchEvent("click", { bubbles: true, cancelable: true });
  await expect(page.getByPlaceholder("Enter value or formula…")).toHaveValue(
    "=A1*2",
  );
  await expect(page.getByText("Applied", { exact: true })).toBeVisible();
});

test("resized Ask Maybe panel fills its allocated slot", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await page.getByRole("button", { name: /Ask Maybe/i }).click();
  const sageSlot = page.locator("#ai-copilot-panel");
  const sagePanel = page.getByRole("complementary", { name: "Assistant" });
  await expect(sagePanel).toBeVisible();

  const handle = page.getByRole("separator", { name: "Resize assistant panel" });
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();

  await page.mouse.move(
    handleBox!.x + handleBox!.width / 2,
    handleBox!.y + handleBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handleBox!.x - 220,
    handleBox!.y + handleBox!.height / 2,
  );
  await page.mouse.up();

  await expect
    .poll(async () => {
      const slotBox = await sageSlot.boundingBox();
      const panelBox = await sagePanel.boundingBox();

      if (!slotBox || !panelBox) {
        return Number.POSITIVE_INFINITY;
      }

      return Math.abs(slotBox.width - panelBox.width);
    })
    .toBeLessThanOrEqual(2);
});

test("focuses the Ask Maybe input when the panel opens", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Ask Maybe/i }).click();

  const sageInput = page.getByLabel("Message assistant");
  await expect(sageInput).toBeFocused();
  await expect(sageInput).toHaveAttribute(
    "placeholder",
    "Ask about formulas, uncertainty, or what to change next...",
  );
  await expect(page.getByLabel("Assistant mode", { exact: true }))
    .toHaveValue("ask");
  await expect(page.getByLabel("Assistant model", { exact: true }))
    .toHaveValue("gpt-5.4");

  await page.getByLabel("Assistant mode", { exact: true }).selectOption("write");
  await expect(sageInput).toHaveAttribute(
    "placeholder",
    "Tell Maybe what to change. Write mode can apply safe workbook edits directly...",
  );
});

test("renders Ask Maybe prose readably and applies proposals from json fences", async ({
  page,
}) => {
  const assistantText = [
    "**Inputs**",
    "",
    "- Add an uncertainty-preserving input in `A1`.",
    "",
    "```json",
    JSON.stringify({
      title: "Add uncertain input",
      summary: "Adds a starter uncertainty input.",
      changes: [
        {
          cell: "A1",
          before: "",
          after: "N.CI(100, 200)",
          reason: "Capture the uncertain source estimate as a distribution.",
          kind: "add",
        },
      ],
    }),
    "```",
  ].join("\n");

  await page.route("**/api/assistant", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: [
        { type: "start", messageId: "sage-json-proposal" },
        { type: "start-step" },
        { type: "text-start", id: "text-1" },
        { type: "text-delta", id: "text-1", delta: assistantText },
        { type: "text-end", id: "text-1" },
        { type: "finish-step" },
        { type: "finish", finishReason: "stop" },
      ]
        .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
        .join(""),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Ask Maybe/i }).click();

  await page.getByLabel("Message assistant")
    .fill("Set up a simple uncertain input");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Inputs", { exact: true })).toBeVisible();
  await expect(page.getByText("**Inputs**")).toHaveCount(0);
  await expect(page.getByText("```json")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Apply 1 change" }))
    .toBeVisible();
});

test("renders and applies proposals produced by Ask Maybe tools", async ({ page }) => {
  const proposal = {
    title: "Add tool proposal output",
    summary: "Adds a starter uncertainty input through the proposal tool.",
    changes: [
      {
        cell: "A1",
        before: "",
        after: "N.CI(100, 200)",
        reason: "Capture the uncertain source estimate as a distribution.",
        kind: "add",
      },
    ],
  };

  await page.route("**/api/assistant", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: [
        { type: "start", messageId: "sage-tool-proposal" },
        { type: "start-step" },
        { type: "text-start", id: "text-1" },
        {
          type: "text-delta",
          id: "text-1",
          delta: "I prepared one workbook change for review.",
        },
        { type: "text-end", id: "text-1" },
        {
          type: "tool-input-available",
          toolCallId: "proposal-tool-call",
          toolName: "proposeCellChanges",
          input: proposal,
        },
        {
          type: "tool-output-available",
          toolCallId: "proposal-tool-call",
          output: proposal,
        },
        { type: "finish-step" },
        { type: "finish", finishReason: "stop" },
      ]
        .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
        .join(""),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Ask Maybe/i }).click();

  await page.getByLabel("Message assistant")
    .fill("Use the proposal tool to set up A1");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(
    page.getByText("I prepared one workbook change for review."),
  ).toBeVisible();
  await expect(page.getByText("N.CI(100, 200)")).toBeVisible();
  await page.getByRole("button", { name: "Apply 1 change" }).click();
  await expect(page.getByText("Applied", { exact: true })).toBeVisible();

  await page.locator("tbody tr:first-child td:nth-child(2) > div").click();
  await expect(page.getByPlaceholder("Enter value or formula…")).toHaveValue(
    "N.CI(100.00, 200.00)",
  );
});

test("keeps proposal cards with the assistant messages that produced them", async ({
  page,
}) => {
  const firstProposal = {
    title: "Add uncertain input",
    summary: "Adds a starter uncertainty input.",
    changes: [
      {
        cell: "A1",
        before: "",
        after: "N.CI(100, 200)",
        reason: "Capture the uncertain source estimate as a distribution.",
        kind: "add",
      },
    ],
  };
  const secondProposal = {
    title: "Add scalar input",
    summary: "Adds a scalar fallback value.",
    changes: [
      {
        cell: "A1",
        before: "",
        after: "42",
        reason: "Capture a simple fallback value.",
        kind: "add",
      },
    ],
  };
  let assistantRequestCount = 0;

  await page.route("**/api/assistant", async (route) => {
    assistantRequestCount += 1;
    const proposal =
      assistantRequestCount === 1 ? firstProposal : secondProposal;

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: [
        {
          type: "start",
          messageId: `sage-history-proposal-${assistantRequestCount}`,
        },
        { type: "start-step" },
        { type: "text-start", id: "text-1" },
        {
          type: "text-delta",
          id: "text-1",
          delta: `Proposal ${assistantRequestCount} is ready.`,
        },
        { type: "text-end", id: "text-1" },
        {
          type: "tool-input-available",
          toolCallId: `proposal-tool-call-${assistantRequestCount}`,
          toolName: "proposeCellChanges",
          input: proposal,
        },
        {
          type: "tool-output-available",
          toolCallId: `proposal-tool-call-${assistantRequestCount}`,
          output: proposal,
        },
        { type: "finish-step" },
        { type: "finish", finishReason: "stop" },
      ]
        .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
        .join(""),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Ask Maybe/i }).click();

  await page.getByLabel("Message assistant")
    .fill("Prepare the first change");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("N.CI(100, 200)")).toBeVisible();

  await page.getByLabel("Message assistant")
    .fill("Prepare a second change");
  await page.getByRole("button", { name: "Send" }).click();

  const sagePanel = page.getByRole("complementary", { name: "Assistant" });
  await expect(page.getByText("N.CI(100, 200)")).toBeVisible();
  await expect(sagePanel.getByText("42", { exact: true })).toBeVisible();
  await expect(
    sagePanel.getByRole("button", { name: "Apply 1 change" }),
  ).toHaveCount(2);
});

test("auto-applies direct apply tool results in Write mode", async ({
  page,
}) => {
  const proposal = {
    title: "Apply tool output",
    summary: "Applies a starter uncertainty input through the apply tool.",
    changes: [
      {
        cell: "A1",
        before: "",
        after: "N.CI(100, 200)",
        reason: "Capture the uncertain source estimate as a distribution.",
        kind: "add",
      },
    ],
  };

  await page.route("**/api/assistant", async (route) => {
    const requestBody = route.request().postDataJSON() as {
      allowDirectCellChanges?: boolean;
      selectedModel?: string;
    };

    expect(requestBody.allowDirectCellChanges).toBe(true);
    expect(requestBody.selectedModel).toBe("gpt-5.4");

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: [
        { type: "start", messageId: "sage-apply-tool" },
        { type: "start-step" },
        { type: "text-start", id: "text-1" },
        {
          type: "text-delta",
          id: "text-1",
          delta: "I applied one workbook change.",
        },
        { type: "text-end", id: "text-1" },
        {
          type: "tool-input-available",
          toolCallId: "apply-tool-call",
          toolName: "applyCellChanges",
          input: proposal,
        },
        {
          type: "tool-output-available",
          toolCallId: "apply-tool-call",
          output: proposal,
        },
        { type: "finish-step" },
        { type: "finish", finishReason: "stop" },
      ]
        .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
        .join(""),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Ask Maybe/i }).click();
  await page.getByLabel("Assistant mode", { exact: true }).selectOption("write");
  await page.getByLabel("Assistant model", { exact: true }).selectOption("gpt-5.4");

  await page.getByLabel("Message assistant")
    .fill("Apply the setup directly");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Applied", { exact: true })).toBeVisible();
  await page.locator("tbody tr:first-child td:nth-child(2) > div").click();
  await expect(page.getByPlaceholder("Enter value or formula…")).toHaveValue(
    "N.CI(100.00, 200.00)",
  );
});

test("auto-applies proposal tool results in Write mode", async ({
  page,
}) => {
  const proposal = {
    title: "Proposal tool output",
    summary: "Adds a starter uncertainty input through the proposal tool.",
    changes: [
      {
        cell: "A1",
        before: "",
        after: "N.CI(100, 200)",
        reason: "Capture the uncertain source estimate as a distribution.",
        kind: "add",
      },
    ],
  };

  await page.route("**/api/assistant", async (route) => {
    const requestBody = route.request().postDataJSON() as {
      allowDirectCellChanges?: boolean;
      selectedModel?: string;
    };

    expect(requestBody.allowDirectCellChanges).toBe(true);
    expect(requestBody.selectedModel).toBe("gpt-5.4");

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: [
        { type: "start", messageId: "sage-allowed-proposal-tool" },
        { type: "start-step" },
        { type: "text-start", id: "text-1" },
        {
          type: "text-delta",
          id: "text-1",
          delta: "I prepared one workbook change.",
        },
        { type: "text-end", id: "text-1" },
        {
          type: "tool-input-available",
          toolCallId: "proposal-tool-call",
          toolName: "proposeCellChanges",
          input: proposal,
        },
        {
          type: "tool-output-available",
          toolCallId: "proposal-tool-call",
          output: proposal,
        },
        { type: "finish-step" },
        { type: "finish", finishReason: "stop" },
      ]
        .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
        .join(""),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Ask Maybe/i }).click();
  await page.getByLabel("Assistant mode", { exact: true }).selectOption("write");

  await page.getByLabel("Message assistant")
    .fill("Apply the setup directly");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Applied", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply 1 change" }),
  ).toHaveCount(0);
  await page.locator("tbody tr:first-child td:nth-child(2) > div").click();
  await expect(page.getByPlaceholder("Enter value or formula…")).toHaveValue(
    "N.CI(100.00, 200.00)",
  );
});

test("does not show proposal action buttons in Write mode", async ({
  page,
}) => {
  const proposal = {
    title: "Stale proposal output",
    summary: "This proposal cannot be applied because the before value is stale.",
    changes: [
      {
        cell: "A1",
        before: "stale",
        after: "N.CI(100, 200)",
        reason: "Capture the uncertain source estimate as a distribution.",
        kind: "add",
      },
    ],
  };

  await page.route("**/api/assistant", async (route) => {
    const requestBody = route.request().postDataJSON() as {
      allowDirectCellChanges?: boolean;
    };

    expect(requestBody.allowDirectCellChanges).toBe(true);

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: [
        { type: "start", messageId: "sage-stale-allowed-proposal" },
        { type: "start-step" },
        { type: "text-start", id: "text-1" },
        {
          type: "text-delta",
          id: "text-1",
          delta: "I prepared one workbook change.",
        },
        { type: "text-end", id: "text-1" },
        {
          type: "tool-input-available",
          toolCallId: "proposal-tool-call",
          toolName: "proposeCellChanges",
          input: proposal,
        },
        {
          type: "tool-output-available",
          toolCallId: "proposal-tool-call",
          output: proposal,
        },
        { type: "finish-step" },
        { type: "finish", finishReason: "stop" },
      ]
        .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
        .join(""),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Ask Maybe/i }).click();
  await page.getByLabel("Assistant mode", { exact: true }).selectOption("write");

  await page.getByLabel("Message assistant")
    .fill("Apply the setup directly");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("A1 has changed since Maybe prepared this proposal."))
    .toBeVisible();
  await expect(page.getByRole("button", { name: /Apply/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Dismiss" })).toHaveCount(0);
});

test("shows a setup error when the assistant server has no OpenAI key", async ({
  page,
}) => {
  await page.route("**/api/assistant", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error:
          "OpenAI key is not configured. Open assistant settings and add your OpenAI API key.",
      }),
    });
  });

  await page.goto("/");

  await page.getByRole("button", { name: /Ask Maybe/i }).click();
  await expect(page.getByRole("complementary", { name: "Assistant" })).toBeVisible();

  await page.getByLabel("Message assistant")
    .fill("What formulas should I add?");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(
    page.getByText(
      "OpenAI key is not configured. Open assistant settings and add your OpenAI API key.",
    ),
  ).toBeVisible();
});

test("sends a session-only OpenAI key with Ask Maybe requests", async ({
  page,
}) => {
  await page.route("**/api/assistant", async (route) => {
    expect(route.request().headers()["x-maybe-openai-api-key"]).toBe(
      "sk-session-test",
    );

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: [
        { type: "start", messageId: "sage-byok-test" },
        { type: "start-step" },
        { type: "text-start", id: "text-1" },
        { type: "text-delta", id: "text-1", delta: "BYOK is connected." },
        { type: "text-end", id: "text-1" },
        { type: "finish-step" },
        { type: "finish", finishReason: "stop" },
      ]
        .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
        .join(""),
    });
  });

  await page.goto("/");

  await page.getByRole("button", { name: /Ask Maybe/i }).click();
  await page.getByRole("button", { name: "Assistant settings" }).click();
  await expect(
    page.getByText(
      "The key stays in memory for this page only and is cleared on refresh, closing the panel, or leaving the app.",
    ),
  ).toBeVisible();
  await page.getByLabel("OpenAI API key").fill("sk-session-test");
  await page.getByRole("button", { name: "Back to chat" }).click();
  await page.getByLabel("Message assistant").fill("Check my workbook");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("BYOK is connected.")).toBeVisible();
});

test("starts with workstation side panels collapsed", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: /Ask Maybe/i })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Assistant" })).toHaveCount(
    0,
  );
  await expect(page.locator(".echarts-for-react")).toHaveCount(0);
});

test("editing a flow node does not pan the graph canvas", async ({ page }) => {
  await page.goto("/");

  const firstCell = page.locator("tbody tr:first-child td:nth-child(2) > div");
  await firstCell.dblclick();

  const editor = page.getByLabel("Cell A1");
  await editor.fill("123");
  await editor.press("Enter");

  await page.getByTitle("Show dependency graph").click();

  const flowPane = page.locator('div[class*="flowPane"]');
  const graphCanvas = flowPane
    .locator('div[class*="canvas"]:not([class*="canvasInner"])')
    .first();
  const canvasInner = flowPane.locator('div[class*="canvasInner"]');
  await expect(graphCanvas).toBeVisible();
  await expect(canvasInner).toBeVisible();

  await canvasInner.getByText("A1").first().dblclick();

  const nodeEditor = flowPane.locator('input[class*="nodeEditInput"]');
  await expect(nodeEditor).toBeVisible();

  const transformBeforeDrag = await canvasInner.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  const editorBox = await nodeEditor.boundingBox();
  expect(editorBox).not.toBeNull();

  await page.mouse.move(
    editorBox!.x + 8,
    editorBox!.y + editorBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    editorBox!.x + 48,
    editorBox!.y + editorBox!.height / 2,
  );
  await page.mouse.up();

  await expect
    .poll(() =>
      canvasInner.evaluate((element) => getComputedStyle(element).transform),
    )
    .toBe(transformBeforeDrag);
});

test("editing the sheet preserves the current flow graph viewport", async ({
  page,
}) => {
  await page.goto("/");

  const firstCell = page.locator("tbody tr:first-child td:nth-child(2) > div");
  await firstCell.dblclick();

  let editor = page.getByLabel("Cell A1");
  await editor.fill("123");
  await editor.press("Enter");

  const secondCell = page.locator("tbody tr:first-child td:nth-child(3) > div");
  await secondCell.dblclick();

  editor = page.getByLabel("Cell B1");
  await editor.fill("=A1+1");
  await editor.press("Enter");

  await page.getByTitle("Show dependency graph").click();

  const flowPane = page.locator('div[class*="flowPane"]');
  const graphCanvas = flowPane
    .locator('div[class*="canvas"]:not([class*="canvasInner"])')
    .first();
  const canvasInner = flowPane.locator('div[class*="canvasInner"]');
  await expect(graphCanvas).toBeVisible();
  await expect(canvasInner).toBeVisible();

  const transformBeforePan = await canvasInner.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  const canvasBox = await graphCanvas.boundingBox();
  expect(canvasBox).not.toBeNull();

  await page.mouse.move(
    canvasBox!.x + canvasBox!.width - 80,
    canvasBox!.y + canvasBox!.height - 80,
  );
  await page.mouse.down();
  await page.mouse.move(
    canvasBox!.x + canvasBox!.width - 40,
    canvasBox!.y + canvasBox!.height - 80,
  );
  await page.mouse.up();

  const transformAfterPan = await canvasInner.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  expect(transformAfterPan).not.toBe(transformBeforePan);

  await firstCell.dblclick();

  editor = page.getByLabel("Cell A1");
  await editor.fill("456");
  await editor.press("Enter");

  await expect(firstCell).toHaveText("456");
  await expect
    .poll(() =>
      canvasInner.evaluate((element) => getComputedStyle(element).transform),
    )
    .toBe(transformAfterPan);
});

test("shows explicit distribution nodes in the flow inspector", async ({
  page,
}) => {
  await page.goto("/");

  const firstCell = page.locator("tbody tr:first-child td:nth-child(2) > div");
  const secondCell = page.locator("tbody tr:first-child td:nth-child(3) > div");

  await secondCell.dblclick();

  let editor = page.getByLabel("Cell B1");
  await editor.fill("=A1*2");
  await editor.press("Enter");

  await firstCell.dblclick();

  editor = page.getByLabel("Cell A1");
  await editor.fill("N.CI(10, 20)");
  await editor.press("Enter");

  await page.getByTitle("Show dependency graph").click();

  const flowPane = page.locator('div[class*="flowPane"]');
  const canvasInner = flowPane.locator('div[class*="canvasInner"]');
  await expect(canvasInner).toBeVisible();

  await canvasInner.getByText("A1").first().click();

  const inspector = flowPane.getByLabel("Selected node inspector");
  await expect(inspector).toContainText("distribution");
  await expect(inspector).toContainText("normal");
  await expect(inspector.getByRole("button", { name: "uniform" }))
    .toHaveCount(0);
});

test("does not show reinterpretation controls for explicit distributions", async ({
  page,
}) => {
  await page.goto("/");

  const firstCell = page.locator("tbody tr:first-child td:nth-child(2) > div");
  const secondCell = page.locator("tbody tr:first-child td:nth-child(3) > div");

  await secondCell.dblclick();

  let editor = page.getByLabel("Cell B1");
  await editor.fill("=A1*2");
  await editor.press("Enter");

  await firstCell.dblclick();

  editor = page.getByLabel("Cell A1");
  await editor.fill("N.CI(0, 1)");
  await editor.press("Enter");

  await expect(firstCell.getByRole("button", { name: "Change view" }))
    .toHaveCount(0);

  await page.getByTitle("Show dependency graph").click();

  const flowPane = page.locator('div[class*="flowPane"]');
  const canvasInner = flowPane.locator('div[class*="canvasInner"]');
  await expect(canvasInner).toBeVisible();

  await canvasInner.getByText("A1").first().click();

  const inspector = flowPane.getByLabel("Selected node inspector");
  await expect(inspector.getByRole("button", { name: "normal" }))
    .toHaveCount(0);
  await expect(inspector.getByRole("button", { name: "uniform" }))
    .toHaveCount(0);
  await expect(inspector.getByRole("button", { name: "lognormal" }))
    .toHaveCount(0);
});
