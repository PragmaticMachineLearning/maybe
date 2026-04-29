import type {
  SavedWorkbook,
  WorkbookRepository,
} from "./workbookRoute";

export const createInMemoryWorkbookRepository = (): WorkbookRepository => {
  const workbooks = new Map<string, SavedWorkbook>();

  return {
    async ensureWorkspace() {
      return;
    },

    async getDefaultWorkbook(workspaceId) {
      return workbooks.get(workspaceId) ?? null;
    },

    async saveDefaultWorkbook(input) {
      workbooks.set(input.workspaceId, input);
      return input;
    },
  };
};
