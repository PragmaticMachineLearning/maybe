import { describe, expect, it } from "vitest";

import { createSqliteWorkbookRepository } from "../../../src/server/sqliteWorkbookRepository";

const savedWorkbook = {
  id: "workspace-1:default",
  workspaceId: "workspace-1",
  title: "Untitled workbook",
  serializedContent: [
    ["Revenue", "N.CI(10, 20)"],
    ["Output", "=B1*2"],
  ],
  updatedAt: "2026-05-06T10:00:00.000Z",
};

interface WorkspaceRow {
  id: string;
  created_at: number;
  last_seen_at: number;
}

interface WorkbookRow {
  id: string;
  workspace_id: string;
  title: string;
  serialized_content: string;
  updated_at: number;
}

class FakeSqliteDatabase {
  readonly executedSql: string[] = [];
  readonly workspaces = new Map<string, WorkspaceRow>();
  readonly workbooks = new Map<string, WorkbookRow>();

  exec(sql: string): void {
    this.executedSql.push(sql);
  }

  query(sql: string) {
    return {
      all: (...params: unknown[]) => this.select(sql, params),
      run: (...params: unknown[]) => this.run(sql, params),
    };
  }

  private select(sql: string, params: unknown[]) {
    if (sql.includes("from workbooks")) {
      const [workspaceId] = params;
      return Array.from(this.workbooks.values()).filter(
        (workbook) => workbook.workspace_id === workspaceId,
      );
    }

    throw new Error(`Unexpected select: ${sql}`);
  }

  private run(sql: string, params: unknown[]): void {
    if (sql.includes("insert into workspaces")) {
      const [id, createdAt, lastSeenAt] = params as [string, number, number];
      this.workspaces.set(id, {
        id,
        created_at: this.workspaces.get(id)?.created_at ?? createdAt,
        last_seen_at: lastSeenAt,
      });
      return;
    }

    if (sql.includes("insert into workbooks")) {
      const [id, workspaceId, title, serializedContent, updatedAt] = params as [
        string,
        string,
        string,
        string,
        number,
      ];
      this.workbooks.set(id, {
        id,
        workspace_id: workspaceId,
        title,
        serialized_content: serializedContent,
        updated_at: updatedAt,
      });
      return;
    }

    throw new Error(`Unexpected run: ${sql}`);
  }
}

describe("sqlite workbook repository", () => {
  it("initializes the workbook schema", () => {
    const database = new FakeSqliteDatabase();

    createSqliteWorkbookRepository(database);

    expect(database.executedSql.join("\n")).toContain(
      "create table if not exists workspaces",
    );
    expect(database.executedSql.join("\n")).toContain(
      "create table if not exists workbooks",
    );
  });

  it("saves and loads the default workbook", async () => {
    const database = new FakeSqliteDatabase();
    const repository = createSqliteWorkbookRepository(database);

    await repository.ensureWorkspace(
      "workspace-1",
      new Date("2026-05-06T09:00:00.000Z"),
    );
    await repository.saveDefaultWorkbook(savedWorkbook);

    await expect(repository.getDefaultWorkbook("workspace-1")).resolves.toEqual(
      savedWorkbook,
    );
  });

  it("updates the workspace last seen time without changing creation time", async () => {
    const database = new FakeSqliteDatabase();
    const repository = createSqliteWorkbookRepository(database);

    await repository.ensureWorkspace(
      "workspace-1",
      new Date("2026-05-06T09:00:00.000Z"),
    );
    await repository.ensureWorkspace(
      "workspace-1",
      new Date("2026-05-06T10:00:00.000Z"),
    );

    expect(database.workspaces.get("workspace-1")).toEqual({
      id: "workspace-1",
      created_at: new Date("2026-05-06T09:00:00.000Z").getTime(),
      last_seen_at: new Date("2026-05-06T10:00:00.000Z").getTime(),
    });
  });
});
