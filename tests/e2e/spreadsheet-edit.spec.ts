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

test("opens the local AI copilot and reviews a mock diff", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: /Sage/i })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Sage" })).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: /Sage/i }).click();
  await expect(page.getByRole("complementary", { name: "Sage" })).toBeVisible();

  await page
    .getByPlaceholder("Describe what to change…")
    .fill("Add 95% confidence interval outputs");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("I prepared a local preview")).toContainText(
    "Add 95% confidence interval outputs",
  );
  await expect(
    page.getByRole("button", { name: /Apply \d+ changes/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Dismiss" })).toBeVisible();

  await page.getByRole("button", { name: /Apply \d+ changes/ }).click();
  await expect(page.getByText("Applied")).toBeVisible();
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
