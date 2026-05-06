import { describe, expect, it, spyOn } from "bun:test";

import {
  createWorkbookHandler,
  type SavedWorkbook,
  type WorkbookRepository,
} from "../../../src/server/workbookRoute";

const validSerializedContent = [
  ["Revenue", "N.CI(10, 20)"],
  ["Output", "=B1*2"],
];

class InMemoryWorkbookRepository implements WorkbookRepository {
  readonly workspaces = new Set<string>();
  readonly workbooks = new Map<string, SavedWorkbook>();

  async ensureWorkspace(workspaceId: string): Promise<void> {
    this.workspaces.add(workspaceId);
  }

  async getDefaultWorkbook(workspaceId: string): Promise<SavedWorkbook | null> {
    return this.workbooks.get(workspaceId) ?? null;
  }

  async saveDefaultWorkbook(input: SavedWorkbook): Promise<SavedWorkbook> {
    this.workbooks.set(input.workspaceId, input);
    return input;
  }
}

describe("workbook route", () => {
  it("creates an anonymous workspace and returns an empty workbook", async () => {
    const repository = new InMemoryWorkbookRepository();
    const handler = createWorkbookHandler({
      createWorkspaceId: () => "workspace-1",
      now: () => new Date("2026-04-29T10:00:00.000Z"),
      repository,
    });

    const response = await handler(
      new Request("https://maybe.test/api/workbook"),
    );

    await expect(response.json()).resolves.toEqual({
      workbook: null,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(
      "maybe_workspace=workspace-1",
    );
    expect(repository.workspaces.has("workspace-1")).toBe(true);
  });

  it("uses the default workspace id generator without binding errors", async () => {
    const repository = new InMemoryWorkbookRepository();
    const handler = createWorkbookHandler({ repository });

    const response = await handler(
      new Request("https://maybe.test/api/workbook"),
    );

    await expect(response.json()).resolves.toEqual({
      workbook: null,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(
      /maybe_workspace=[0-9a-f-]{36}/,
    );
  });

  it("saves and reloads the workbook for the anonymous workspace", async () => {
    const repository = new InMemoryWorkbookRepository();
    const handler = createWorkbookHandler({
      createWorkspaceId: () => "unused-new-workspace",
      now: () => new Date("2026-04-29T10:00:00.000Z"),
      repository,
    });

    const saveResponse = await handler(
      new Request("https://maybe.test/api/workbook", {
        method: "PUT",
        headers: {
          cookie: "maybe_workspace=workspace-1",
          "content-type": "application/json",
        },
        body: JSON.stringify({ serializedContent: validSerializedContent }),
      }),
    );

    await expect(saveResponse.json()).resolves.toEqual({
      workbook: {
        id: "workspace-1:default",
        workspaceId: "workspace-1",
        title: "Untitled workbook",
        serializedContent: validSerializedContent,
        updatedAt: "2026-04-29T10:00:00.000Z",
      },
    });
    expect(saveResponse.status).toBe(200);

    const loadResponse = await handler(
      new Request("https://maybe.test/api/workbook", {
        headers: { cookie: "maybe_workspace=workspace-1" },
      }),
    );

    await expect(loadResponse.json()).resolves.toEqual({
      workbook: {
        id: "workspace-1:default",
        workspaceId: "workspace-1",
        title: "Untitled workbook",
        serializedContent: validSerializedContent,
        updatedAt: "2026-04-29T10:00:00.000Z",
      },
    });
    expect(loadResponse.status).toBe(200);
  });

  it("rejects malformed workbook payloads", async () => {
    const repository = new InMemoryWorkbookRepository();
    const handler = createWorkbookHandler({
      createWorkspaceId: () => "workspace-1",
      repository,
    });

    const response = await handler(
      new Request("https://maybe.test/api/workbook", {
        method: "PUT",
        body: JSON.stringify({ serializedContent: [["ok", { bad: true }]] }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "Invalid workbook request.",
    });
    expect(response.status).toBe(400);
  });

  it("returns a 405 for unsupported methods", async () => {
    const repository = new InMemoryWorkbookRepository();
    const handler = createWorkbookHandler({ repository });

    const response = await handler(
      new Request("https://maybe.test/api/workbook", {
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: "Workbook endpoint only supports GET and PUT.",
    });
    expect(response.status).toBe(405);
  });

  it("returns a 500 when no workbook repository is configured", async () => {
    const handler = createWorkbookHandler();
    const consoleError = spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await handler(
      new Request("https://maybe.test/api/workbook"),
    );

    await expect(response.json()).resolves.toEqual({
      error: "Workbook persistence is not configured.",
    });
    expect(response.status).toBe(500);
    consoleError.mockRestore();
  });

  it("returns a JSON 500 response when the repository fails", async () => {
    const repository = new InMemoryWorkbookRepository();
    repository.ensureWorkspace = async () => {
      throw new Error("missing migration");
    };
    const handler = createWorkbookHandler({
      createWorkspaceId: () => "workspace-1",
      repository,
    });
    const consoleError = spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await handler(
      new Request("https://maybe.test/api/workbook"),
    );

    await expect(response.json()).resolves.toEqual({
      error: "Workbook persistence failed.",
    });
    expect(response.status).toBe(500);
    consoleError.mockRestore();
  });
});
