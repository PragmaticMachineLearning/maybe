import { describe, expect, it } from "vitest";

import type { VisualDependencyGraph } from "../../types/visualDependencyGraph";
import {
  buildVisualGraphIndex,
  getDefaultFocusMode,
  getEdgeFocusState,
  getFocusCounts,
  getFocusState,
} from "./graphQueries";

const graph: VisualDependencyGraph = {
  nodes: [
    {
      id: "A1",
      sheet: 0,
      row: 0,
      col: 0,
      address: "A1",
      formula: undefined,
      value: { kind: "scalar", value: 1 },
    },
    {
      id: "B1",
      sheet: 0,
      row: 0,
      col: 1,
      address: "B1",
      formula: undefined,
      value: { kind: "scalar", value: 2 },
    },
    {
      id: "C1",
      sheet: 0,
      row: 0,
      col: 2,
      address: "C1",
      formula: "=A1+B1",
      value: { kind: "scalar", value: 3 },
    },
    {
      id: "D1",
      sheet: 0,
      row: 0,
      col: 3,
      address: "D1",
      formula: "=C1*2",
      value: { kind: "scalar", value: 6 },
    },
    {
      id: "E1",
      sheet: 0,
      row: 0,
      col: 4,
      address: "E1",
      formula: undefined,
      value: { kind: "scalar", value: 5 },
    },
  ],
  edges: [
    { sourceId: "A1", targetId: "C1" },
    { sourceId: "B1", targetId: "C1" },
    { sourceId: "C1", targetId: "D1" },
  ],
};

describe("buildVisualGraphIndex", () => {
  it("collects recursive upstream and downstream node ids", () => {
    const index = buildVisualGraphIndex(graph);

    expect(index.getAncestors("D1")).toEqual(new Set(["A1", "B1", "C1"]));
    expect(index.getDescendants("A1")).toEqual(new Set(["C1", "D1"]));
  });

  it("returns empty traversal sets for unknown and disconnected nodes", () => {
    const index = buildVisualGraphIndex(graph);

    expect(index.getAncestors("missing")).toEqual(new Set());
    expect(index.getDescendants("E1")).toEqual(new Set());
  });
});

describe("getFocusState", () => {
  it("marks selected, upstream, downstream, and unrelated nodes in both mode", () => {
    const index = buildVisualGraphIndex(graph);

    expect(getFocusState(index, "C1", "C1", "both")).toBe("selected");
    expect(getFocusState(index, "A1", "C1", "both")).toBe("upstream");
    expect(getFocusState(index, "D1", "C1", "both")).toBe("downstream");
    expect(getFocusState(index, "E1", "C1", "both")).toBe("unrelated");
  });

  it("treats non-selected nodes as visible in full mode", () => {
    const index = buildVisualGraphIndex(graph);

    expect(getFocusState(index, "A1", "C1", "full")).toBe("neutral");
    expect(getFocusState(index, "C1", "C1", "full")).toBe("selected");
    expect(getFocusState(index, "E1", "C1", "full")).toBe("neutral");
  });

  it("limits upstream and downstream focus to immediate neighbors in direct scope", () => {
    const index = buildVisualGraphIndex(graph);

    expect(getFocusState(index, "C1", "D1", "lineage", "direct")).toBe(
      "upstream",
    );
    expect(getFocusState(index, "A1", "D1", "lineage", "direct")).toBe(
      "unrelated",
    );
    expect(getFocusState(index, "C1", "A1", "impact", "direct")).toBe(
      "downstream",
    );
    expect(getFocusState(index, "D1", "A1", "impact", "direct")).toBe(
      "unrelated",
    );
  });
});

describe("getEdgeFocusState", () => {
  it("marks upstream and downstream edges around the selected node in both mode", () => {
    const index = buildVisualGraphIndex(graph);

    expect(getEdgeFocusState(index, "A1", "C1", "C1", "both")).toBe(
      "upstream",
    );
    expect(getEdgeFocusState(index, "C1", "D1", "C1", "both")).toBe(
      "downstream",
    );
    expect(getEdgeFocusState(index, "A1", "C1", "C1", "impact")).toBe(
      "unrelated",
    );
  });

  it("treats all edges as neutral in full mode", () => {
    const index = buildVisualGraphIndex(graph);

    expect(getEdgeFocusState(index, "A1", "C1", "C1", "full")).toBe(
      "neutral",
    );
  });

  it("limits edge focus to immediate selected-node edges in direct scope", () => {
    const index = buildVisualGraphIndex(graph);

    expect(getEdgeFocusState(index, "C1", "D1", "D1", "lineage", "direct")).toBe(
      "upstream",
    );
    expect(getEdgeFocusState(index, "A1", "C1", "D1", "lineage", "direct")).toBe(
      "unrelated",
    );
    expect(getEdgeFocusState(index, "A1", "C1", "A1", "impact", "direct")).toBe(
      "downstream",
    );
  });
});

describe("getFocusCounts", () => {
  it("returns upstream and downstream counts for the selected node", () => {
    const index = buildVisualGraphIndex(graph);

    expect(getFocusCounts(index, "C1")).toEqual({
      upstream: 2,
      downstream: 1,
    });
  });

  it("returns zero counts without a selected graph node", () => {
    const index = buildVisualGraphIndex(graph);

    expect(getFocusCounts(index, "missing")).toEqual({
      upstream: 0,
      downstream: 0,
    });
  });

  it("returns immediate counts in direct scope and recursive counts in all scope", () => {
    const index = buildVisualGraphIndex(graph);

    expect(getFocusCounts(index, "D1", "direct")).toEqual({
      upstream: 1,
      downstream: 0,
    });
    expect(getFocusCounts(index, "D1", "all")).toEqual({
      upstream: 3,
      downstream: 0,
    });
  });
});

describe("getDefaultFocusMode", () => {
  it("defaults inputs to impact, outputs to lineage, and middle cells to both", () => {
    const index = buildVisualGraphIndex(graph);

    expect(getDefaultFocusMode(index, "A1")).toBe("impact");
    expect(getDefaultFocusMode(index, "D1")).toBe("lineage");
    expect(getDefaultFocusMode(index, "C1")).toBe("both");
  });

  it("uses full mode when there is no selected graph node", () => {
    const index = buildVisualGraphIndex(graph);

    expect(getDefaultFocusMode(index, undefined)).toBe("full");
    expect(getDefaultFocusMode(index, "missing")).toBe("full");
  });
});
