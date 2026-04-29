import { eq } from "drizzle-orm";
import { drizzle, type AnyD1Database } from "drizzle-orm/d1";

import { workbooks, workspaces } from "../db/schema";
import type {
  SavedWorkbook,
  WorkbookRepository,
} from "./workbookRoute";

const toSavedWorkbook = (
  row: typeof workbooks.$inferSelect,
): SavedWorkbook => ({
  id: row.id,
  workspaceId: row.workspaceId,
  title: row.title,
  serializedContent: JSON.parse(row.serializedContent) as SavedWorkbook["serializedContent"],
  updatedAt: row.updatedAt.toISOString(),
});

export const createD1WorkbookRepository = (
  database: AnyD1Database,
): WorkbookRepository => {
  const db = drizzle(database);

  return {
    async ensureWorkspace(workspaceId, now) {
      await db
        .insert(workspaces)
        .values({
          id: workspaceId,
          createdAt: now,
          lastSeenAt: now,
        })
        .onConflictDoUpdate({
          target: workspaces.id,
          set: { lastSeenAt: now },
        });
    },

    async getDefaultWorkbook(workspaceId) {
      const workbookRows = await db
        .select()
        .from(workbooks)
        .where(eq(workbooks.workspaceId, workspaceId))
        .limit(1);

      const workbook = workbookRows[0];
      return workbook ? toSavedWorkbook(workbook) : null;
    },

    async saveDefaultWorkbook(input) {
      const updatedAt = new Date(input.updatedAt);

      await db
        .insert(workbooks)
        .values({
          id: input.id,
          workspaceId: input.workspaceId,
          title: input.title,
          serializedContent: JSON.stringify(input.serializedContent),
          updatedAt,
        })
        .onConflictDoUpdate({
          target: workbooks.id,
          set: {
            title: input.title,
            serializedContent: JSON.stringify(input.serializedContent),
            updatedAt,
          },
        });

      return input;
    },
  };
};
