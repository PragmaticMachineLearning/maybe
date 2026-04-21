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

test("opens a confidence interval distribution chart", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");

  const firstCell = page.locator("tbody tr:first-child td:nth-child(2) > div");
  await firstCell.dblclick();

  const editor = page.getByLabel("Cell A1");
  await editor.fill("CI[10, 20]");
  await editor.press("Enter");

  await expect(firstCell).toHaveText("N(μ=15.00, σ=2.55)");

  await firstCell.click({ button: "right" });

  await expect(page.locator(".echarts-for-react")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("opens Sage, receives a proposal, and applies it", async ({ page }) => {
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
          kind: "confidence_interval",
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
  await editor.fill("CI[10, 20]");
  await editor.press("Enter");

  // GaussFormula trims empty rightmost columns, so C1 keeps empty B1 in bounds.
  await thirdCell.dblclick();

  editor = page.getByLabel("Cell C1");
  await editor.fill("context");
  await editor.press("Enter");

  await firstCell.click();

  await expect(page.getByRole("button", { name: /Sage/i })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Sage" })).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: /Sage/i }).click();
  await expect(page.getByRole("complementary", { name: "Sage" })).toBeVisible();

  await page
    .getByPlaceholder("Describe what to change…")
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
  await expect(page.getByText("Applied")).toBeVisible();
});

test("resized Sage panel fills its allocated slot", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await page.getByRole("button", { name: /Sage/i }).click();
  const sageSlot = page.locator("#ai-copilot-panel");
  const sagePanel = page.getByRole("complementary", { name: "Sage" });
  await expect(sagePanel).toBeVisible();

  const handle = page.getByRole("separator", { name: "Resize Sage panel" });
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

test("renders Sage prose readably and applies proposals from json fences", async ({
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
      summary: "Adds a starter confidence interval.",
      changes: [
        {
          cell: "A1",
          before: "",
          after: "CI[100, 200]",
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
  await page.getByRole("button", { name: /Sage/i }).click();

  await page
    .getByPlaceholder("Describe what to change…")
    .fill("Set up a simple uncertain input");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Inputs", { exact: true })).toBeVisible();
  await expect(page.getByText("**Inputs**")).toHaveCount(0);
  await expect(page.getByText("```json")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Apply 1 change" }))
    .toBeVisible();
});

test("shows a setup error when the assistant server has no OpenAI key", async ({
  page,
}) => {
  await page.route("**/api/assistant", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: "OPENAI_API_KEY is not configured for the assistant server.",
      }),
    });
  });

  await page.goto("/");

  await page.getByRole("button", { name: /Sage/i }).click();
  await expect(page.getByRole("complementary", { name: "Sage" })).toBeVisible();

  await page
    .getByPlaceholder("Describe what to change…")
    .fill("What formulas should I add?");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(
    page.getByText("OPENAI_API_KEY is not configured for the assistant server."),
  ).toBeVisible();
});

test("starts with workstation side panels collapsed", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: /Sage/i })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Sage" })).toHaveCount(
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

test("changing a CI node distribution persists in the flow inspector", async ({
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
  await editor.fill("CI[10, 20]");
  await editor.press("Enter");

  await page.getByTitle("Show dependency graph").click();

  const flowPane = page.locator('div[class*="flowPane"]');
  const canvasInner = flowPane.locator('div[class*="canvasInner"]');
  await expect(canvasInner).toBeVisible();

  await canvasInner.getByText("A1").first().click();

  const inspector = flowPane.getByLabel("Selected node inspector");
  await expect(inspector).toContainText("confidence interval");
  await expect(inspector).toContainText("normal");

  await inspector.getByRole("button", { name: "uniform" }).click();

  await expect(inspector).toContainText("uniform");
});

test("hides lognormal distribution for CI cells with non-positive bounds", async ({
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
  await editor.fill("CI[0, 1]");
  await editor.press("Enter");

  await firstCell.getByRole("button", { name: "Change view" }).click();

  await expect(
    page.getByRole("button", { name: "Normal Distribution", exact: true }),
  )
    .toBeVisible();
  await expect(
    page.getByRole("button", { name: "Uniform Distribution", exact: true }),
  )
    .toBeVisible();
  await expect(
    page.getByRole("button", { name: "Log-Normal Distribution", exact: true }),
  )
    .toHaveCount(0);

  await page.getByTitle("Show dependency graph").click();

  const flowPane = page.locator('div[class*="flowPane"]');
  const canvasInner = flowPane.locator('div[class*="canvasInner"]');
  await expect(canvasInner).toBeVisible();

  await canvasInner.getByText("A1").first().click();

  const inspector = flowPane.getByLabel("Selected node inspector");
  await expect(inspector.getByRole("button", { name: "normal" }))
    .toBeVisible();
  await expect(inspector.getByRole("button", { name: "uniform" }))
    .toBeVisible();
  await expect(inspector.getByRole("button", { name: "lognormal" }))
    .toHaveCount(0);
});
