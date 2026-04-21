import "@xyflow/react/dist/style.css";

import {
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import type { Edge, Node, NodeProps } from "@xyflow/react";
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { SpreadsheetContext } from "../../context/SpreadsheetContext";
import type {
  VisualDependencyGraph,
  VisualDependencyNode,
  VisualDependencyNodeValue,
} from "../../types/visualDependencyGraph";
import {
  isConfidenceIntervalValue,
  isSampledDistributionValue,
  parseSampledDistributionValue,
} from "../../utils/distribution/distributionUtils";
import { formatVisualDependencyValue } from "../../utils/visual-dependency-graph/visualDependencyGraphFormatter";
import { MicroSparkline } from "../spreadsheet/cellFormatting";
import type { FormulaEngine } from "../../lib/formulaEngine";
import { getLayoutedNodes } from "./useLayoutNodes";
import styles from "./FlowDiag.module.css";

// ── Enriched node data type ─────────────────────────────────────────────────

interface FlowDiagramNodeData extends Record<string, unknown> {
  address: string;
  value: string;
  type: "formula" | "value";
  formula: string;
  row: number;
  col: number;
  valueKind: "scalar" | "confidence_interval" | "sampled_distribution";
  interpretation?: "normal" | "uniform" | "lognormal" | "auto";
  isSelected: boolean;
  onSelect: () => void;
  onEdit: (value: string) => void;
}

// ── Props ───────────────────────────────────────────────────────────────────

interface FlowDiagProps {
  selectedCell?: { row: number; col: number } | null;
  onCellSelect?: (row: number, col: number) => void;
}

// ── Build plain node/edge data from the dependency graph ────────────────────

interface PlainNodeData extends Record<string, unknown> {
  address: string;
  value: string;
  type: "formula" | "value";
  formula: string;
  row: number;
  col: number;
  valueKind: "scalar" | "confidence_interval" | "sampled_distribution";
  interpretation?: "normal" | "uniform" | "lognormal" | "auto";
}

function buildPlainElements(graph: VisualDependencyGraph): {
  nodes: Node<PlainNodeData>[];
  edges: Edge[];
} {
  const nodes: Node<PlainNodeData>[] = graph.nodes.map(
    (node: VisualDependencyNode) => {
      const nodeType: "formula" | "value" = node.formula ? "formula" : "value";
      const data: PlainNodeData = {
        address: node.address,
        value: formatVisualDependencyValue(node.value),
        type: nodeType,
        formula: node.formula ?? "",
        row: node.row,
        col: node.col,
        valueKind: node.value.kind,
      };
      if (node.value.kind === "confidence_interval") {
        data.interpretation = node.value.interpretation;
      }
      return {
        id: node.id,
        type: nodeType,
        position: { x: 0, y: 0 },
        data,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    },
  );

  const edges: Edge[] = graph.edges.map((edge) => ({
    id: `${edge.sourceId}->${edge.targetId}`,
    source: edge.sourceId,
    target: edge.targetId,
    animated: true,
  }));

  return { nodes, edges };
}

// ── Convert a raw cell value to a VisualDependencyNodeValue ─────────────────

function cellValueToNodeValue(raw: unknown): VisualDependencyNodeValue | null {
  if (raw === null || raw === undefined || raw === "") return null;

  if (typeof raw === "number") {
    return { kind: "scalar", value: raw };
  }

  if (typeof raw === "boolean") {
    return { kind: "scalar", value: raw ? 1 : 0 };
  }

  if (typeof raw === "string") {
    const num = Number(raw);
    if (!Number.isNaN(num)) {
      return { kind: "scalar", value: num };
    }
    // Non-numeric strings aren't visualisable in the graph
    return null;
  }

  if (typeof raw === "object" && raw !== null) {
    if (isConfidenceIntervalValue(raw)) {
      const obj = raw as {
        lower: number;
        upper: number;
        confidenceLevel: number;
        interpretation?: string;
      };
      return {
        kind: "confidence_interval",
        lower: obj.lower,
        upper: obj.upper,
        confidenceLevel: obj.confidenceLevel,
        interpretation:
          (obj.interpretation as "normal" | "lognormal" | "uniform" | "auto") ??
          "normal",
      };
    }

    if (isSampledDistributionValue(raw)) {
      const parsed = parseSampledDistributionValue(raw);
      if (parsed) {
        return {
          kind: "sampled_distribution",
          mean: parsed.mean,
          variance: parsed.std ** 2,
        };
      }
    }

    // Objects with a numeric `val` property (e.g. GaussianNumber)
    if ("val" in raw && typeof (raw as { val: unknown }).val === "number") {
      return { kind: "scalar", value: (raw as { val: number }).val };
    }
  }

  return null;
}

// ── Collect orphan cells (populated but not in the dependency graph) ─────────

function getColumnName(index: number): string {
  let result = "";
  let num = index;
  while (num >= 0) {
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26) - 1;
  }
  return result;
}

function collectOrphanNodes(
  engine: FormulaEngine,
  existingNodeIds: Set<string>,
): Node<PlainNodeData>[] {
  const { width, height } = engine.getSheetDimensions(0);
  const orphans: Node<PlainNodeData>[] = [];

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const nodeId = `0:${row}:${col}`;
      if (existingNodeIds.has(nodeId)) continue;

      const raw = engine.getCellValue({ sheet: 0, row, col });
      const nodeValue = cellValueToNodeValue(raw);
      if (!nodeValue) continue;

      const formula = engine.getCellFormula({ sheet: 0, row, col });
      const address = `${getColumnName(col)}${row + 1}`;
      const nodeType: "formula" | "value" = formula ? "formula" : "value";

      const data: PlainNodeData = {
        address,
        value: formatVisualDependencyValue(nodeValue),
        type: nodeType,
        formula: formula ?? "",
        row,
        col,
        valueKind: nodeValue.kind,
      };

      if (nodeValue.kind === "confidence_interval") {
        data.interpretation = nodeValue.interpretation;
      }

      orphans.push({
        id: nodeId,
        type: nodeType,
        position: { x: 0, y: 0 },
        data,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });
    }
  }

  return orphans;
}

// ── Enrich plain nodes with selection state & callbacks ─────────────────────

function enrichNodes(
  plainNodes: Node<PlainNodeData>[],
  selectedCell: { row: number; col: number } | null | undefined,
  onCellSelect: ((row: number, col: number) => void) | undefined,
  onEdit: (row: number, col: number, value: string) => void,
): Node<FlowDiagramNodeData>[] {
  return plainNodes.map((node) => {
    const isSelected =
      selectedCell != null &&
      selectedCell.row === node.data.row &&
      selectedCell.col === node.data.col;

    return {
      ...node,
      data: {
        ...node.data,
        isSelected,
        onSelect: () => onCellSelect?.(node.data.row, node.data.col),
        onEdit: (val: string) => onEdit(node.data.row, node.data.col, val),
      } as FlowDiagramNodeData,
    } as Node<FlowDiagramNodeData>;
  });
}

// ── Distribution CSS class helper ───────────────────────────────────────────

function getDistributionClass(data: FlowDiagramNodeData): string {
  if (data.valueKind === "confidence_interval" && data.interpretation) {
    switch (data.interpretation) {
      case "normal":
        return styles.nodeDistNormal;
      case "lognormal":
        return styles.nodeDistLognormal;
      case "uniform":
        return styles.nodeDistUniform;
      case "auto":
        return styles.nodeDistNormal;
    }
  }
  if (data.valueKind === "sampled_distribution") {
    return styles.nodeDistSampled;
  }
  return "";
}

// ── Sparkline props helper ──────────────────────────────────────────────────

function getSparklineProps(data: FlowDiagramNodeData): {
  type: "normal" | "lognormal" | "uniform" | "sampled";
  color: string;
} | null {
  if (data.valueKind === "confidence_interval") {
    const interp = data.interpretation ?? "normal";
    switch (interp) {
      case "normal":
      case "auto":
        return { type: "normal", color: "var(--dist-normal-accent)" };
      case "lognormal":
        return { type: "lognormal", color: "var(--dist-lognormal-accent)" };
      case "uniform":
        return { type: "uniform", color: "var(--dist-uniform-accent)" };
    }
  }
  if (data.valueKind === "sampled_distribution") {
    return { type: "sampled", color: "var(--dist-sampled-accent)" };
  }
  return null;
}

// ── Inline Edit Input ───────────────────────────────────────────────────────

const InlineEditInput: React.FC<{
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}> = ({ initialValue, onCommit, onCancel }) => {
  const [inputValue, setInputValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      className={styles.nodeEditInput}
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit(inputValue);
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      onBlur={onCancel}
    />
  );
};

// ── FormulaNode ─────────────────────────────────────────────────────────────

const FormulaNode: React.FC<NodeProps<Node<FlowDiagramNodeData>>> = ({
  data,
}) => {
  const [editing, setEditing] = useState(false);
  const distClass = getDistributionClass(data);
  const sparkline = getSparklineProps(data);

  const className = [
    styles.formulaNode,
    data.isSelected ? styles.nodeSelected : "",
    distClass,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      onClick={() => data.onSelect()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div className={styles.nodeHeader}>
        <span className={styles.nodeAddress}>{data.address}</span>
        <span className={styles.nodeTypeLabel}>formula</span>
      </div>
      <div className={styles.nodeValueRow}>
        <span className={styles.nodeValue}>{data.value}</span>
        {sparkline && (
          <MicroSparkline type={sparkline.type} color={sparkline.color} />
        )}
      </div>
      <div className={styles.nodeFormula}>{data.formula}</div>
      {editing && (
        <InlineEditInput
          initialValue={data.formula}
          onCommit={(val) => {
            data.onEdit(val);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

// ── ValueNode ───────────────────────────────────────────────────────────────

const ValueNode: React.FC<NodeProps<Node<FlowDiagramNodeData>>> = ({
  data,
}) => {
  const [editing, setEditing] = useState(false);
  const distClass = getDistributionClass(data);
  const sparkline = getSparklineProps(data);

  const className = [
    styles.valueNode,
    data.isSelected ? styles.nodeSelected : "",
    distClass,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      onClick={() => data.onSelect()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div className={styles.nodeHeader}>
        <span className={styles.nodeAddress}>{data.address}</span>
        <span className={styles.nodeTypeLabel}>value</span>
      </div>
      <div className={styles.nodeValueRow}>
        <span className={styles.nodeValue}>{data.value}</span>
        {sparkline && (
          <MicroSparkline type={sparkline.type} color={sparkline.color} />
        )}
      </div>
      {editing && (
        <InlineEditInput
          initialValue={data.value}
          onCommit={(val) => {
            data.onEdit(val);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

// ── Node type registry (MUST be outside component) ──────────────────────────

const nodeTypes = {
  formula: FormulaNode,
  value: ValueNode,
};

// ── MiniMap color helper ────────────────────────────────────────────────────

function minimapNodeColor(node: Node<FlowDiagramNodeData>): string {
  const { data } = node;
  if (data.valueKind === "confidence_interval") {
    switch (data.interpretation) {
      case "normal":
      case "auto":
        return "var(--dist-normal-accent)";
      case "lognormal":
        return "var(--dist-lognormal-accent)";
      case "uniform":
        return "var(--dist-uniform-accent)";
    }
  }
  if (data.valueKind === "sampled_distribution") {
    return "var(--dist-sampled-accent)";
  }
  if (data.type === "formula") {
    return "var(--resize-handle-active)";
  }
  return "var(--border-header)";
}

// ── Empty state icon ────────────────────────────────────────────────────────

const EmptyStateIcon: React.FC = () => (
  <svg
    className={styles.emptyStateIcon}
    width={48}
    height={48}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect
      x="6"
      y="10"
      width="14"
      height="10"
      rx="3"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="28"
      y="10"
      width="14"
      height="10"
      rx="3"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="17"
      y="28"
      width="14"
      height="10"
      rx="3"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M13 20L24 28"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M35 20L24 28"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

// ── FlowDiagInner ───────────────────────────────────────────────────────────

const FlowDiagInner: React.FC<FlowDiagProps> = ({
  selectedCell,
  onCellSelect,
}) => {
  const { formulaEngine, updateCell } = useContext(SpreadsheetContext);
  const [nodes, setNodes, onNodesChange] = useNodesState<
    Node<FlowDiagramNodeData>
  >([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isEmpty, setIsEmpty] = useState(true);
  const { fitView } = useReactFlow();
  const prevSelectedRef = useRef<{ row: number; col: number } | null>(null);

  // Keep a ref to the last laid-out plain nodes so we can cheaply re-enrich
  // them when only selection/callbacks change (no re-layout needed).
  const plainNodesRef = useRef<Node<PlainNodeData>[]>([]);

  // Store latest props/callbacks in refs so the stable updateGraph callback
  // can read them without including them in its dependency array.
  const selectedCellRef = useRef(selectedCell);
  const onCellSelectRef = useRef(onCellSelect);
  const updateCellRef = useRef(updateCell);

  useEffect(() => {
    selectedCellRef.current = selectedCell;
  }, [selectedCell]);

  useEffect(() => {
    onCellSelectRef.current = onCellSelect;
  }, [onCellSelect]);

  useEffect(() => {
    updateCellRef.current = updateCell;
  }, [updateCell]);

  // ── Stable graph refresh (only depends on formulaEngine) ──────────────────

  const refreshGraph = useCallback(() => {
    if (!formulaEngine) return;

    let graph: VisualDependencyGraph;
    try {
      graph = formulaEngine.getVisualDependencyGraph();
    } catch (err) {
      console.error("Failed to get dependency graph:", err);
      return;
    }

    const { nodes: graphNodes, edges: newEdges } = buildPlainElements(graph);

    // Find populated cells not already in the dependency graph
    const existingIds = new Set(graphNodes.map((n) => n.id));
    const orphans = collectOrphanNodes(formulaEngine, existingIds);
    const plain = [...graphNodes, ...orphans];

    if (plain.length === 0) {
      plainNodesRef.current = [];
      setNodes([]);
      setEdges([]);
      setIsEmpty(true);
      return;
    }

    // Synchronous layout — no race conditions
    const layouted = getLayoutedNodes(
      plain as Node[],
      newEdges,
    ) as unknown as Node<PlainNodeData>[];
    plainNodesRef.current = layouted;

    // Enrich with current selection & callbacks from refs
    const enriched = enrichNodes(
      layouted,
      selectedCellRef.current,
      onCellSelectRef.current,
      (row, col, val) => updateCellRef.current(row, col, val),
    );

    setNodes(enriched);
    setEdges(newEdges);
    setIsEmpty(false);
  }, [formulaEngine, setNodes, setEdges]);

  // ── Subscribe to formula engine changes ───────────────────────────────────

  useEffect(() => {
    if (!formulaEngine) return;

    refreshGraph();

    formulaEngine.on("valuesUpdated", refreshGraph);
    return () => {
      formulaEngine.off("valuesUpdated", refreshGraph);
    };
  }, [formulaEngine, refreshGraph]);

  // ── Sync selection & callbacks into nodes (no re-layout) ──────────────────

  useEffect(() => {
    if (plainNodesRef.current.length === 0) return;

    setNodes((current) => {
      const posMap = new Map<string, { x: number; y: number }>();
      for (const n of current) {
        posMap.set(n.id, n.position);
      }

      return enrichNodes(
        plainNodesRef.current,
        selectedCell,
        onCellSelect,
        (row, col, val) => updateCellRef.current(row, col, val),
      ).map((n) => ({
        ...n,
        position: posMap.get(n.id) ?? n.position,
      }));
    });

    // Pan to selected node if selection changed
    if (
      selectedCell &&
      (prevSelectedRef.current?.row !== selectedCell.row ||
        prevSelectedRef.current?.col !== selectedCell.col)
    ) {
      const target = plainNodesRef.current.find(
        (n) =>
          n.data.row === selectedCell.row && n.data.col === selectedCell.col,
      );
      if (target) {
        setTimeout(() => {
          fitView({ nodes: [{ id: target.id }], duration: 300, padding: 0.5 });
        }, 50);
      }
    }
    prevSelectedRef.current = selectedCell ?? null;
  }, [selectedCell, onCellSelect, setNodes, fitView]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!formulaEngine || isEmpty) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <EmptyStateIcon />
          <span>
            Add some data to your spreadsheet to see the dependency graph
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.flowContent}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          style={{ width: "100%", height: "100%" }}
          proOptions={{ hideAttribution: true }}
        >
          <Controls position="bottom-left" />
          <MiniMap
            position="bottom-right"
            nodeColor={minimapNodeColor}
            pannable
            zoomable
          />
        </ReactFlow>
      </div>
    </div>
  );
};

// ── FlowDiag (wraps inner in ReactFlowProvider) ────────────────────────────

export const FlowDiag: React.FC<FlowDiagProps> = (props) => (
  <ReactFlowProvider>
    <FlowDiagInner {...props} />
  </ReactFlowProvider>
);
