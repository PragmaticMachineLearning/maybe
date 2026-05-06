import { describe, expect, it } from "bun:test";

import {
  createBlankSheetContent,
  getSerializedContentFromWorkbookResponse,
} from "../../../src/workbook/persistence";

describe("workbook persistence helpers", () => {
  it("creates blank sheet content with the requested dimensions", () => {
    expect(createBlankSheetContent({ rows: 2, columns: 3 })).toEqual([
      [null, null, null],
      [null, null, null],
    ]);
  });

  it("extracts serialized content from a saved workbook response", () => {
    const serializedContent = [
      ["Input", "N.CI(10, 20)"],
      ["Output", "=B1*2"],
    ];

    expect(
      getSerializedContentFromWorkbookResponse({
        workbook: {
          serializedContent,
        },
      }),
    ).toEqual(serializedContent);
  });

  it("returns null when no saved workbook exists", () => {
    expect(
      getSerializedContentFromWorkbookResponse({ workbook: null }),
    ).toBeNull();
  });
});
