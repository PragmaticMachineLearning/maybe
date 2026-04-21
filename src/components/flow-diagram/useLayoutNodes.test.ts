import { describe, expect, it } from "vitest";

import {
  getLayoutedNodes,
  preserveExistingNodePositions,
  shouldAutoFitAfterGraphRefresh,
  type LayoutEdge,
  type LayoutNode,
} from "./useLayoutNodes";

const node = (id: string): LayoutNode => ({
  id,
  position: { x: 0, y: 0 },
  data: { label: id },
});

describe("preserveExistingNodePositions", () => {
  it("keeps user-moved positions for existing nodes and uses layout positions for new nodes", () => {
    const edges: LayoutEdge[] = [
      { id: "A->B", source: "A", target: "B" },
      { id: "B->C", source: "B", target: "C" },
    ];
    const nextLayout = getLayoutedNodes([node("A"), node("B"), node("C")], edges);
    const previousNodes: LayoutNode[] = [
      { ...node("A"), position: { x: 420, y: 120 } },
      { ...node("B"), position: { x: 680, y: 240 } },
    ];

    const result = preserveExistingNodePositions(nextLayout, previousNodes);

    expect(result.find((n) => n.id === "A")?.position).toEqual({
      x: 420,
      y: 120,
    });
    expect(result.find((n) => n.id === "B")?.position).toEqual({
      x: 680,
      y: 240,
    });
    expect(result.find((n) => n.id === "C")?.position).toEqual(
      nextLayout.find((n) => n.id === "C")?.position,
    );
  });
});

describe("shouldAutoFitAfterGraphRefresh", () => {
  it("only auto-fits when the graph changes from empty to populated", () => {
    expect(shouldAutoFitAfterGraphRefresh(0, 2)).toBe(true);
    expect(shouldAutoFitAfterGraphRefresh(2, 2)).toBe(false);
    expect(shouldAutoFitAfterGraphRefresh(2, 0)).toBe(false);
    expect(shouldAutoFitAfterGraphRefresh(0, 0)).toBe(false);
  });
});
