import type { SerializedCellContent } from "../assistant/workbookSnapshot";

export type SerializedWorkbookContent = SerializedCellContent[][];

interface SheetDimensionsInput {
  rows: number;
  columns: number;
}

interface PersistedWorkbookResponse {
  workbook: {
    serializedContent: SerializedWorkbookContent;
  } | null;
}

export const createBlankSheetContent = ({
  rows,
  columns,
}: SheetDimensionsInput): SerializedWorkbookContent =>
  Array.from({ length: rows }, () => Array(columns).fill(null));

export const getSerializedContentFromWorkbookResponse = (
  response: PersistedWorkbookResponse,
): SerializedWorkbookContent | null =>
  response.workbook?.serializedContent ?? null;
