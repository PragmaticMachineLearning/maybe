import type {
  SavedWorkbook,
  WorkbookRepository,
} from "./workbookRoute";

type SqliteBinding = string | number | bigint | boolean | null | Uint8Array;

interface SqliteStatement<Row> {
  all: (...params: SqliteBinding[]) => Row[];
  run: (...params: SqliteBinding[]) => unknown;
}

interface SqliteDatabase {
  exec: (sql: string) => unknown;
  query: <Row>(sql: string) => SqliteStatement<Row>;
}

interface WorkbookRow {
  id: string;
  workspace_id: string;
  title: string;
  serialized_content: string;
  updated_at: number;
}

const initializeSchema = (database: SqliteDatabase): void => {
  database.exec(`
    pragma foreign_keys = on;

    create table if not exists workspaces (
      id text primary key,
      created_at integer not null,
      last_seen_at integer not null
    );

    create table if not exists workbooks (
      id text primary key,
      workspace_id text not null references workspaces(id) on delete cascade,
      title text not null,
      serialized_content text not null,
      updated_at integer not null
    );
  `);
};

const toSavedWorkbook = (row: WorkbookRow): SavedWorkbook => ({
  id: row.id,
  workspaceId: row.workspace_id,
  title: row.title,
  serializedContent: JSON.parse(
    row.serialized_content,
  ) as SavedWorkbook["serializedContent"],
  updatedAt: new Date(row.updated_at).toISOString(),
});

export const createSqliteWorkbookRepository = (
  database: SqliteDatabase,
): WorkbookRepository => {
  initializeSchema(database);

  const ensureWorkspaceStatement = database.query(`
    insert into workspaces (id, created_at, last_seen_at)
    values (?, ?, ?)
    on conflict(id) do update set last_seen_at = excluded.last_seen_at
  `);
  const getDefaultWorkbookStatement = database.query<WorkbookRow>(`
    select id, workspace_id, title, serialized_content, updated_at
    from workbooks
    where workspace_id = ?
    limit 1
  `);
  const saveDefaultWorkbookStatement = database.query(`
    insert into workbooks (
      id,
      workspace_id,
      title,
      serialized_content,
      updated_at
    )
    values (?, ?, ?, ?, ?)
    on conflict(id) do update set
      title = excluded.title,
      serialized_content = excluded.serialized_content,
      updated_at = excluded.updated_at
  `);

  return {
    async ensureWorkspace(workspaceId, now) {
      const timestamp = now.getTime();
      ensureWorkspaceStatement.run(workspaceId, timestamp, timestamp);
    },

    async getDefaultWorkbook(workspaceId) {
      const workbookRows = getDefaultWorkbookStatement.all(workspaceId);
      const workbook = workbookRows[0];
      return workbook ? toSavedWorkbook(workbook) : null;
    },

    async saveDefaultWorkbook(input) {
      saveDefaultWorkbookStatement.run(
        input.id,
        input.workspaceId,
        input.title,
        JSON.stringify(input.serializedContent),
        new Date(input.updatedAt).getTime(),
      );

      return input;
    },
  };
};
