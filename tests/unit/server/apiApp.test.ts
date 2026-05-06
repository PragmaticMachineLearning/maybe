import { describe, expect, it, vi } from "vitest";

import { createApiApp } from "../../../src/server/apiApp";
import type {
  SavedWorkbook,
  WorkbookRepository,
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

describe("api app", () => {
  it("serves workbook requests from Hono-owned API routes", async () => {
    const repository = new InMemoryWorkbookRepository();
    const app = createApiApp({
      workbook: {
        createWorkspaceId: () => "workspace-1",
        now: () => new Date("2026-05-06T10:00:00.000Z"),
        repository,
      },
    });

    const response = await app.request("/api/workbook", {
      method: "PUT",
      headers: {
        cookie: "maybe_workspace=workspace-1",
        "content-type": "application/json",
      },
      body: JSON.stringify({ serializedContent: validSerializedContent }),
    });

    await expect(response.json()).resolves.toEqual({
      workbook: {
        id: "workspace-1:default",
        workspaceId: "workspace-1",
        title: "Untitled workbook",
        serializedContent: validSerializedContent,
        updatedAt: "2026-05-06T10:00:00.000Z",
      },
    });
    expect(response.status).toBe(200);
    expect(repository.workspaces.has("workspace-1")).toBe(true);
  });

  it("delegates assistant requests through Hono-owned API routes", async () => {
    const assistantHandler = vi.fn(
      async () => new Response("assistant response", { status: 202 }),
    );
    const app = createApiApp({ assistantHandler });

    const response = await app.request("/api/assistant", { method: "POST" });

    await expect(response.text()).resolves.toBe("assistant response");
    expect(response.status).toBe(202);
    expect(assistantHandler).toHaveBeenCalledOnce();
    expect(assistantHandler.mock.calls[0][0]).toBeInstanceOf(Request);
  });

  it("returns a JSON 404 for unknown API routes", async () => {
    const app = createApiApp();

    const response = await app.request("/api/missing");

    await expect(response.json()).resolves.toEqual({
      error: "API route not found.",
    });
    expect(response.status).toBe(404);
  });
});
