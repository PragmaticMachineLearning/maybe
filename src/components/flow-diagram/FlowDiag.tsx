import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  getAvailableDistributionViews,
  isConfidenceIntervalValue,
  isSampledDistributionValue,
  parseSampledDistributionValue,
} from "../../utils/distribution/distributionUtils";
import {
  buildVisualGraphIndex,
  getDefaultFocusMode,
  getEdgeFocusState,
  getFocusCounts,
  getFocusState,
  type GraphFocusMode,
  type GraphFocusScope,
  type GraphFocusState,
  type VisualGraphIndex,
} from "../../utils/visual-dependency-graph/graphQueries";
import { formatVisualDependencyValue } from "../../utils/visual-dependency-graph/visualDependencyGraphFormatter";
import { MicroSparkline } from "../spreadsheet/cellFormatting";
import type { FormulaEngine } from "../../lib/formulaEngine";
import {
  getLayoutedNodes,
  NODE_WIDTH,
  NODE_HEIGHT,
  preserveExistingNodePositions,
  shouldAutoFitAfterGraphRefresh,
  type LayoutNode,
  type LayoutEdge,
} from "./useLayoutNodes";
import styles from "./FlowDiag.module.css";

// ── Node data types ─────────────────────────────────────────────────────────

interface FlowDiagramNodeData extends Record<string, unknown> {
  address: string;
  value: string;
  type: "formula" | "value";
  formula: string;
  row: number;
  col: number;
  valueKind: "scalar" | "confidence_interval" | "sampled_distribution";
  interpretation?: "normal" | "uniform" | "lognormal" | "auto";
  confidenceIntervalBounds?: { lower: number; upper: number };
  isSelected: boolean;
  focusState: GraphFocusState;
  onSelect: () => void;
  onEdit: (value: string) => void;
}

interface FlowNode extends LayoutNode {
  data: FlowDiagramNodeData;
  type: "formula" | "value";
}

interface FlowDiagProps {
  selectedCell?: { row: number; col: number } | null;
  onCellSelect?: (row: number, col: number) => void;
}

// ── Plain node data (before enrichment) ─────────────────────────────────────

interface PlainNodeData extends Record<string, unknown> {
  address: string;
  value: string;
  type: "formula" | "value";
  formula: string;
  row: number;
  col: number;
  valueKind: "scalar" | "confidence_interval" | "sampled_distribution";
  interpretation?: "normal" | "uniform" | "lognormal" | "auto";
  confidenceIntervalBounds?: { lower: number; upper: number };
}

interface PlainNode extends LayoutNode {
  data: PlainNodeData;
  type: "formula" | "value";
}

interface FocusedLayoutEdge extends LayoutEdge {
  focusState: GraphFocusState;
}

// ── Build plain elements from dependency graph ──────────────────────────────

function buildPlainElements(graph: VisualDependencyGraph): {
  nodes: PlainNode[];
  edges: LayoutEdge[];
} {
  const nodes: PlainNode[] = graph.nodes.map((node: VisualDependencyNode) => {
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
      data.confidenceIntervalBounds = {
        lower: node.value.lower,
        upper: node.value.upper,
      };
    }
    return {
      id: node.id,
      type: nodeType,
      position: { x: 0, y: 0 },
      data,
    };
  });

  const edges: LayoutEdge[] = graph.edges.map((edge) => ({
    id: `${edge.sourceId}->${edge.targetId}`,
    source: edge.sourceId,
    target: edge.targetId,
    animated: true,
  }));

  return { nodes, edges };
}

// ── Cell value → VisualDependencyNodeValue ──────────────────────────────────

function cellValueToNodeValue(raw: unknown): VisualDependencyNodeValue | null {
  if (raw === null || raw === undefined || raw === "") return null;

  if (typeof raw === "number") return { kind: "scalar", value: raw };
  if (typeof raw === "boolean") return { kind: "scalar", value: raw ? 1 : 0 };

  if (typeof raw === "string") {
    const num = Number(raw);
    if (!Number.isNaN(num)) return { kind: "scalar", value: num };
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

    if ("val" in raw && typeof (raw as { val: unknown }).val === "number") {
      return { kind: "scalar", value: (raw as { val: number }).val };
    }
  }

  return null;
}

// ── Column name helper ──────────────────────────────────────────────────────

function getColumnName(index: number): string {
  let result = "";
  let num = index;
  while (num >= 0) {
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26) - 1;
  }
  return result;
}

// ── Collect orphan cells ────────────────────────────────────────────────────

function collectOrphanNodes(
  engine: FormulaEngine,
  existingNodeIds: Set<string>,
): PlainNode[] {
  const { width, height } = engine.getSheetDimensions(0);
  const orphans: PlainNode[] = [];

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
      data.confidenceIntervalBounds = {
        lower: nodeValue.lower,
        upper: nodeValue.upper,
      };
    }

      orphans.push({
        id: nodeId,
        type: nodeType,
        position: { x: 0, y: 0 },
        data,
      });
    }
  }

  return orphans;
}

// ── Enrich plain nodes with selection + callbacks ───────────────────────────

function enrichNodes(
  plainNodes: PlainNode[],
  selectedCell: { row: number; col: number } | null | undefined,
  onCellSelect: ((row: number, col: number) => void) | undefined,
  onEdit: (row: number, col: number, value: string) => void,
  graphIndex: VisualGraphIndex | null,
  selectedNodeId: string | undefined,
  focusMode: GraphFocusMode,
  focusScope: GraphFocusScope,
): FlowNode[] {
  return plainNodes.map((node) => {
    const isSelected =
      selectedCell != null &&
      selectedCell.row === node.data.row &&
      selectedCell.col === node.data.col;
    const focusState = graphIndex
      ? getFocusState(graphIndex, node.id, selectedNodeId, focusMode, focusScope)
      : "neutral";

    return {
      ...node,
      data: {
        ...node.data,
        isSelected,
        focusState,
        onSelect: () => onCellSelect?.(node.data.row, node.data.col),
        onEdit: (val: string) => onEdit(node.data.row, node.data.col, val),
      } as FlowDiagramNodeData,
    } as FlowNode;
  });
}

function getSelectedNodeId(
  selectedCell: { row: number; col: number } | null | undefined,
): string | undefined {
  if (!selectedCell) return undefined;
  return `0:${selectedCell.row}:${selectedCell.col}`;
}

function createGraphIndex(
  nodes: PlainNode[],
  edges: LayoutEdge[],
): VisualGraphIndex {
  return buildVisualGraphIndex({
    nodes: nodes.map((node) => ({ id: node.id })),
    edges: edges.map((edge) => ({
      sourceId: edge.source,
      targetId: edge.target,
    })),
  });
}

function enrichEdges(
  edges: LayoutEdge[],
  graphIndex: VisualGraphIndex | null,
  selectedNodeId: string | undefined,
  focusMode: GraphFocusMode,
  focusScope: GraphFocusScope,
): FocusedLayoutEdge[] {
  return edges.map((edge) => {
    const focusState = graphIndex
      ? getEdgeFocusState(
          graphIndex,
          edge.source,
          edge.target,
          selectedNodeId,
          focusMode,
          focusScope,
        )
      : "neutral";

    return {
      ...edge,
      animated:
        focusState === "neutral"
          ? edge.animated
          : focusState === "upstream" || focusState === "downstream",
      focusState,
    };
  });
}

function getValueKindLabel(
  valueKind: FlowDiagramNodeData["valueKind"],
): string {
  switch (valueKind) {
    case "confidence_interval":
      return "confidence interval";
    case "sampled_distribution":
      return "sampled distribution";
    case "scalar":
      return "scalar";
  }
}

function getSelectedNodeInspectorDetails(
  nodes: FlowNode[],
  edges: FocusedLayoutEdge[],
  selectedNodeId: string | undefined,
):
  | {
      node: FlowNode;
      role: string;
      directInputs: FlowNode[];
      directOutputs: FlowNode[];
    }
  | null {
  if (!selectedNodeId) return null;

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const node = nodeById.get(selectedNodeId);
  if (!node) return null;

  const directInputs = edges
    .filter((edge) => edge.target === selectedNodeId)
    .map((edge) => nodeById.get(edge.source))
    .filter((input): input is FlowNode => input !== undefined);
  const directOutputs = edges
    .filter((edge) => edge.source === selectedNodeId)
    .map((edge) => nodeById.get(edge.target))
    .filter((output): output is FlowNode => output !== undefined);

  const role =
    directInputs.length === 0 && directOutputs.length > 0
      ? "input"
      : directInputs.length > 0 && directOutputs.length === 0
        ? "output"
        : directInputs.length > 0 && directOutputs.length > 0
          ? "transform"
          : "standalone";

  return { node, role, directInputs, directOutputs };
}

// ── CSS class helpers ───────────────────────────────────────────────────────

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
  if (data.valueKind === "sampled_distribution") return styles.nodeDistSampled;
  return "";
}

function getNodeFocusClass(data: FlowDiagramNodeData): string {
  switch (data.focusState) {
    case "upstream":
      return styles.nodeFocusUpstream;
    case "downstream":
      return styles.nodeFocusDownstream;
    case "unrelated":
      return styles.nodeFocusUnrelated;
    case "selected":
    case "neutral":
      return "";
  }
}

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
  if (data.valueKind === "sampled_distribution")
    return { type: "sampled", color: "var(--dist-sampled-accent)" };
  return null;
}

// ── Inline edit input ───────────────────────────────────────────────────────

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

// ── Node component ──────────────────────────────────────────────────────────

const FlowNodeView: React.FC<{
  node: FlowNode;
  zoom: number;
  onMove: (id: string, x: number, y: number) => void;
}> = ({ node, zoom, onMove }) => {
  const { data } = node;
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0 });
  const hasMoved = useRef(false);
  const distClass = getDistributionClass(data);
  const focusClass = getNodeFocusClass(data);
  const sparkline = getSparklineProps(data);
  const isFormula = data.type === "formula";

  const className = [
    isFormula ? styles.formulaNode : styles.valueNode,
    data.isSelected ? styles.nodeSelected : "",
    dragging ? styles.nodeDragging : "",
    distClass,
    focusClass,
  ]
    .filter(Boolean)
    .join(" ");

  const handleNodePointerDown = (e: React.PointerEvent) => {
    // Only left button; editing controls should not bubble into canvas panning.
    if (e.button !== 0 || editing) {
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    isDraggingRef.current = true;
    setDragging(true);
    hasMoved.current = false;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      nodeX: node.position.x,
      nodeY: node.position.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleNodePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    const dx = (e.clientX - dragStart.current.x) / zoom;
    const dy = (e.clientY - dragStart.current.y) / zoom;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasMoved.current = true;
    }
    onMove(node.id, dragStart.current.nodeX + dx, dragStart.current.nodeY + dy);
  };

  const handleNodePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    // If we didn't drag, treat as a click → select
    if (!hasMoved.current) {
      data.onSelect();
    }
  };

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        left: node.position.x,
        top: node.position.y,
        width: NODE_WIDTH,
      }}
      onPointerDown={handleNodePointerDown}
      onPointerMove={handleNodePointerMove}
      onPointerUp={handleNodePointerUp}
      onPointerCancel={() => {
        isDraggingRef.current = false;
        setDragging(false);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      <div className={styles.nodeHeader}>
        <span className={styles.nodeAddress}>{data.address}</span>
        <span className={styles.nodeTypeLabel}>
          {isFormula ? "formula" : "value"}
        </span>
      </div>
      <div className={styles.nodeValueRow}>
        <span className={styles.nodeValue}>{data.value}</span>
        {sparkline && (
          <MicroSparkline type={sparkline.type} color={sparkline.color} />
        )}
      </div>
      {isFormula && <div className={styles.nodeFormula}>{data.formula}</div>}
      {editing && (
        <InlineEditInput
          initialValue={isFormula ? data.formula : data.value}
          onCommit={(val) => {
            data.onEdit(val);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
};

const RelationshipList: React.FC<{
  label: string;
  nodes: FlowNode[];
}> = ({ label, nodes }) => (
  <div className={styles.inspectorRelationGroup}>
    <span className={styles.inspectorRelationLabel}>{label}</span>
    {nodes.length > 0 ? (
      <div className={styles.inspectorChips}>
        {nodes.map((node) => (
          <span key={node.id} className={styles.inspectorChip}>
            {node.data.address}
          </span>
        ))}
      </div>
    ) : (
      <span className={styles.inspectorEmpty}>none</span>
    )}
  </div>
);

const SelectedNodeInspector: React.FC<{
  details: NonNullable<ReturnType<typeof getSelectedNodeInspectorDetails>>;
}> = ({ details }) => {
  const { node, role, directInputs, directOutputs } = details;
  const { data } = node;
  const { setDistributionView } = useContext(SpreadsheetContext);
  const distributionOptions =
    data.valueKind === "confidence_interval" && data.confidenceIntervalBounds
      ? getAvailableDistributionViews(data.confidenceIntervalBounds)
      : [];

  return (
    <aside className={styles.nodeInspector} aria-label="Selected node inspector">
      <div className={styles.inspectorHeader}>
        <span className={styles.inspectorAddress}>{data.address}</span>
        <span className={styles.inspectorRole}>{role}</span>
      </div>
      <div className={styles.inspectorRows}>
        <div className={styles.inspectorRow}>
          <span className={styles.inspectorLabel}>Value</span>
          <span className={styles.inspectorValue}>{data.value}</span>
        </div>
        {data.formula && (
          <div className={styles.inspectorRow}>
            <span className={styles.inspectorLabel}>Formula</span>
            <span className={styles.inspectorFormula}>{data.formula}</span>
          </div>
        )}
        <div className={styles.inspectorMetaRow}>
          <span>{getValueKindLabel(data.valueKind)}</span>
          {data.interpretation && <span>{data.interpretation}</span>}
        </div>
        {data.valueKind === "confidence_interval" && data.interpretation && (
          <div className={styles.inspectorDistributionRow}>
            <span className={styles.inspectorLabel}>Distribution</span>
            <div
              className={styles.inspectorDistributionGroup}
              aria-label="Cell distribution"
            >
              {distributionOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`${styles.inspectorDistributionButton} ${
                    data.interpretation === option
                      ? styles.inspectorDistributionButtonActive
                      : ""
                  }`}
                  aria-pressed={data.interpretation === option}
                  onClick={() =>
                    setDistributionView(data.row, data.col, option)
                  }
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className={styles.inspectorRelations}>
        <RelationshipList label="Direct inputs" nodes={directInputs} />
        <RelationshipList label="Direct outputs" nodes={directOutputs} />
      </div>
    </aside>
  );
};

// ── Edge SVG component ──────────────────────────────────────────────────────

const EdgePath: React.FC<{
  edge: FocusedLayoutEdge;
  nodes: FlowNode[];
}> = ({ edge, nodes }) => {
  const source = nodes.find((n) => n.id === edge.source);
  const target = nodes.find((n) => n.id === edge.target);
  if (!source || !target) return null;

  // Source: right edge center. Target: left edge center.
  const x1 = source.position.x + NODE_WIDTH;
  const y1 = source.position.y + NODE_HEIGHT / 2;
  const x2 = target.position.x;
  const y2 = target.position.y + NODE_HEIGHT / 2;

  const dx = Math.abs(x2 - x1) * 0.5;

  const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  const focusClass =
    edge.focusState === "upstream"
      ? styles.edgeFocusUpstream
      : edge.focusState === "downstream"
        ? styles.edgeFocusDownstream
        : edge.focusState === "unrelated"
          ? styles.edgeFocusUnrelated
          : "";
  const className = [
    edge.animated ? styles.animatedEdge : "",
    focusClass,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeDasharray={edge.animated ? "6 4" : undefined}
      className={className || undefined}
    />
  );
};

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

// ── Canvas: pan + zoom ──────────────────────────────────────────────────────

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 2;
const TOP_CONTROL_CLEARANCE = 64;

interface ViewState {
  x: number;
  y: number;
  zoom: number;
}

// Large fixed canvas size — nodes live in a coordinate space starting at 0,0
const CANVAS_SIZE = 8000;

const focusModeOptions: Array<{ value: GraphFocusMode; label: string }> = [
  { value: "lineage", label: "Lineage" },
  { value: "impact", label: "Impact" },
  { value: "both", label: "Both" },
  { value: "full", label: "Full" },
];

const focusScopeOptions: Array<{ value: GraphFocusScope; label: string }> = [
  { value: "direct", label: "Direct" },
  { value: "all", label: "All" },
];

function fitToView(
  nodes: FlowNode[],
  containerWidth: number,
  containerHeight: number,
): ViewState {
  if (nodes.length === 0 || containerWidth === 0 || containerHeight === 0)
    return { x: 0, y: 0, zoom: 1 };

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of nodes) {
    if (n.position.x < minX) minX = n.position.x;
    if (n.position.y < minY) minY = n.position.y;
    if (n.position.x + NODE_WIDTH > maxX) maxX = n.position.x + NODE_WIDTH;
    if (n.position.y + NODE_HEIGHT > maxY) maxY = n.position.y + NODE_HEIGHT;
  }

  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const pad = 60;
  const zoom = Math.min(
    Math.max(
      Math.min(
        (containerWidth - pad * 2) / (contentW || 1),
        (containerHeight - pad * 2) / (contentH || 1),
      ),
      MIN_ZOOM,
    ),
    MAX_ZOOM,
  );

  const x = (containerWidth - contentW * zoom) / 2 - minX * zoom;
  const y =
    TOP_CONTROL_CLEARANCE +
    (containerHeight - TOP_CONTROL_CLEARANCE - contentH * zoom) / 2 -
    minY * zoom;

  return { x, y, zoom };
}

// ── Main component ──────────────────────────────────────────────────────────

export const FlowDiag: React.FC<FlowDiagProps> = ({
  selectedCell,
  onCellSelect,
}) => {
  const { formulaEngine, updateCell } = useContext(SpreadsheetContext);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FocusedLayoutEdge[]>([]);
  const [isEmpty, setIsEmpty] = useState(true);
  const [focusMode, setFocusMode] = useState<GraphFocusMode>("full");
  const [focusScope, setFocusScope] = useState<GraphFocusScope>("all");
  const [focusCounts, setFocusCounts] = useState({
    upstream: 0,
    downstream: 0,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, zoom: 1 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, viewX: 0, viewY: 0 });

  const plainNodesRef = useRef<PlainNode[]>([]);
  const plainEdgesRef = useRef<LayoutEdge[]>([]);
  const graphIndexRef = useRef<VisualGraphIndex | null>(null);
  const selectedCellRef = useRef(selectedCell);
  const onCellSelectRef = useRef(onCellSelect);
  const updateCellRef = useRef(updateCell);
  const focusModeRef = useRef<GraphFocusMode>(focusMode);
  const focusScopeRef = useRef<GraphFocusScope>(focusScope);
  const defaultedSelectedNodeRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    selectedCellRef.current = selectedCell;
  }, [selectedCell]);
  useEffect(() => {
    onCellSelectRef.current = onCellSelect;
  }, [onCellSelect]);
  useEffect(() => {
    updateCellRef.current = updateCell;
  }, [updateCell]);
  useEffect(() => {
    focusModeRef.current = focusMode;
  }, [focusMode]);
  useEffect(() => {
    focusScopeRef.current = focusScope;
  }, [focusScope]);

  const resolveFocusMode = useCallback(
    (graphIndex: VisualGraphIndex, selectedNodeId: string | undefined) => {
      if (defaultedSelectedNodeRef.current !== selectedNodeId) {
        defaultedSelectedNodeRef.current = selectedNodeId;
        const defaultMode = getDefaultFocusMode(graphIndex, selectedNodeId);
        focusModeRef.current = defaultMode;
        setFocusMode(defaultMode);
        return defaultMode;
      }

      return focusModeRef.current;
    },
    [],
  );

  // ── Refresh graph data ──────────────────────────────────────────────────

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
    const existingIds = new Set(graphNodes.map((n) => n.id));
    const orphans = collectOrphanNodes(formulaEngine, existingIds);
    const plain = [...graphNodes, ...orphans];

    if (plain.length === 0) {
      plainNodesRef.current = [];
      plainEdgesRef.current = [];
      graphIndexRef.current = null;
      setNodes([]);
      setEdges([]);
      setFocusCounts({ upstream: 0, downstream: 0 });
      setIsEmpty(true);
      return;
    }

    const previousNodeCount = plainNodesRef.current.length;
    const layouted = preserveExistingNodePositions(
      getLayoutedNodes(plain, newEdges),
      plainNodesRef.current,
    );
    const graphIndex = createGraphIndex(layouted, newEdges);
    const selectedNodeId = getSelectedNodeId(selectedCellRef.current);
    const nextFocusMode = resolveFocusMode(graphIndex, selectedNodeId);
    plainNodesRef.current = layouted;
    plainEdgesRef.current = newEdges;
    graphIndexRef.current = graphIndex;

    const enriched = enrichNodes(
      layouted,
      selectedCellRef.current,
      onCellSelectRef.current,
      (r, c, v) => updateCellRef.current(r, c, v),
      graphIndex,
      selectedNodeId,
      nextFocusMode,
      focusScopeRef.current,
    );

    setNodes(enriched);
    setEdges(
      enrichEdges(
        newEdges,
        graphIndex,
        selectedNodeId,
        nextFocusMode,
        focusScopeRef.current,
      ),
    );
    setFocusCounts(getFocusCounts(graphIndex, selectedNodeId, focusScopeRef.current));
    setIsEmpty(false);

    if (shouldAutoFitAfterGraphRefresh(previousNodeCount, enriched.length)) {
      requestAnimationFrame(() => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setView(fitToView(enriched, rect.width, rect.height));
        }
      });
    }
  }, [formulaEngine, resolveFocusMode]);

  // ── Subscribe to formula engine ─────────────────────────────────────────

  useEffect(() => {
    if (!formulaEngine) return;
    refreshGraph();
    formulaEngine.on("valuesUpdated", refreshGraph);
    return () => {
      formulaEngine.off("valuesUpdated", refreshGraph);
    };
  }, [formulaEngine, refreshGraph]);

  // ── Sync selection into nodes ───────────────────────────────────────────

  useEffect(() => {
    if (plainNodesRef.current.length === 0) return;
    const graphIndex = graphIndexRef.current;
    if (!graphIndex) return;

    const selectedNodeId = getSelectedNodeId(selectedCell);
    const nextFocusMode = resolveFocusMode(graphIndex, selectedNodeId);

    setNodes(
      enrichNodes(
        plainNodesRef.current,
        selectedCell,
        onCellSelect,
        (r, c, v) => updateCellRef.current(r, c, v),
        graphIndex,
        selectedNodeId,
        nextFocusMode,
        focusScopeRef.current,
      ),
    );
    setEdges(
      enrichEdges(
        plainEdgesRef.current,
        graphIndex,
        selectedNodeId,
        nextFocusMode,
        focusScopeRef.current,
      ),
    );
    setFocusCounts(getFocusCounts(graphIndex, selectedNodeId, focusScopeRef.current));
  }, [selectedCell, onCellSelect, resolveFocusMode]);

  useEffect(() => {
    if (plainNodesRef.current.length === 0) return;
    const graphIndex = graphIndexRef.current;
    if (!graphIndex) return;

    const selectedNodeId = getSelectedNodeId(selectedCellRef.current);
    setNodes(
      enrichNodes(
        plainNodesRef.current,
        selectedCellRef.current,
        onCellSelectRef.current,
        (r, c, v) => updateCellRef.current(r, c, v),
        graphIndex,
        selectedNodeId,
        focusMode,
        focusScopeRef.current,
      ),
    );
    setEdges(
      enrichEdges(
        plainEdgesRef.current,
        graphIndex,
        selectedNodeId,
        focusMode,
        focusScopeRef.current,
      ),
    );
  }, [focusMode]);

  useEffect(() => {
    if (plainNodesRef.current.length === 0) return;
    const graphIndex = graphIndexRef.current;
    if (!graphIndex) return;

    const selectedNodeId = getSelectedNodeId(selectedCellRef.current);
    setNodes(
      enrichNodes(
        plainNodesRef.current,
        selectedCellRef.current,
        onCellSelectRef.current,
        (r, c, v) => updateCellRef.current(r, c, v),
        graphIndex,
        selectedNodeId,
        focusModeRef.current,
        focusScope,
      ),
    );
    setEdges(
      enrichEdges(
        plainEdgesRef.current,
        graphIndex,
        selectedNodeId,
        focusModeRef.current,
        focusScope,
      ),
    );
    setFocusCounts(getFocusCounts(graphIndex, selectedNodeId, focusScope));
  }, [focusScope]);

  // ── Pan handlers ────────────────────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      isPanning.current = true;
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        viewX: view.x,
        viewY: view.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [view.x, view.y],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setView((v) => ({
      ...v,
      x: panStart.current.viewX + dx,
      y: panStart.current.viewY + dy,
    }));
  }, []);

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  // ── Zoom handler ────────────────────────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setView((prev) => {
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const newZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, prev.zoom * factor),
      );
      const ratio = newZoom / prev.zoom;

      return {
        zoom: newZoom,
        x: mouseX - (mouseX - prev.x) * ratio,
        y: mouseY - (mouseY - prev.y) * ratio,
      };
    });
  }, []);

  // ── Fit-to-view button ──────────────────────────────────────────────────

  const handleFitView = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setView(fitToView(nodes, rect.width, rect.height));
  }, [nodes]);

  const handleFocusModeChange = useCallback((mode: GraphFocusMode) => {
    focusModeRef.current = mode;
    setFocusMode(mode);
  }, []);

  const handleFocusScopeChange = useCallback((scope: GraphFocusScope) => {
    focusScopeRef.current = scope;
    setFocusScope(scope);
  }, []);

  // ── Zoom controls ─────────────────────────────────────────────────────

  const handleZoomIn = useCallback(() => {
    setView((v) => {
      const container = containerRef.current;
      if (!container) return v;
      const rect = container.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const newZoom = Math.min(MAX_ZOOM, v.zoom * 1.25);
      const ratio = newZoom / v.zoom;
      return {
        zoom: newZoom,
        x: cx - (cx - v.x) * ratio,
        y: cy - (cy - v.y) * ratio,
      };
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    setView((v) => {
      const container = containerRef.current;
      if (!container) return v;
      const rect = container.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const newZoom = Math.max(MIN_ZOOM, v.zoom * 0.8);
      const ratio = newZoom / v.zoom;
      return {
        zoom: newZoom,
        x: cx - (cx - v.x) * ratio,
        y: cy - (cy - v.y) * ratio,
      };
    });
  }, []);

  // ── Content bounds & SVG edges (memoized) ─────────────────────────────

  // ── Node move handler (drag to reposition) ────────────────────────────

  const handleNodeMove = useCallback((id: string, x: number, y: number) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, position: { x, y } } : n)),
    );
    // Also update plainNodesRef so selection sync preserves the position
    plainNodesRef.current = plainNodesRef.current.map((n) =>
      n.id === id ? { ...n, position: { x, y } } : n,
    );
  }, []);

  // ── Edges (memoized) ──────────────────────────────────────────────────

  const edgeSvg = useMemo(
    () =>
      edges.map((edge) => <EdgePath key={edge.id} edge={edge} nodes={nodes} />),
    [edges, nodes],
  );
  const inspectorDetails = useMemo(
    () =>
      getSelectedNodeInspectorDetails(
        nodes,
        edges,
        getSelectedNodeId(selectedCell),
      ),
    [edges, nodes, selectedCell],
  );

  // ── Render ────────────────────────────────────────────────────────────

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
      <div className={styles.focusToolbar} aria-label="Dependency focus mode">
        <div className={styles.focusModeGroup}>
          {focusModeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.focusModeButton} ${
                focusMode === option.value ? styles.focusModeButtonActive : ""
              }`}
              onClick={() => handleFocusModeChange(option.value)}
              aria-pressed={focusMode === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className={styles.focusScopeGroup} aria-label="Dependency scope">
          {focusScopeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.focusScopeButton} ${
                focusScope === option.value ? styles.focusScopeButtonActive : ""
              }`}
              onClick={() => handleFocusScopeChange(option.value)}
              aria-pressed={focusScope === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className={styles.focusCounts}>
          {focusCounts.upstream} upstream · {focusCounts.downstream} downstream
        </span>
      </div>
      {inspectorDetails && <SelectedNodeInspector details={inspectorDetails} />}
      <div
        ref={containerRef}
        className={styles.canvas}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        <div
          className={styles.canvasInner}
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
            width: CANVAS_SIZE,
            height: CANVAS_SIZE,
          }}
        >
          {/* Edges */}
          <svg
            className={styles.edgeSvg}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
          >
            {edgeSvg}
          </svg>

          {/* Nodes */}
          {nodes.map((node) => (
            <FlowNodeView
              key={node.id}
              node={node}
              zoom={view.zoom}
              onMove={handleNodeMove}
            />
          ))}
        </div>
      </div>

      {/* Zoom controls */}
      <div className={styles.zoomControls}>
        <button
          type="button"
          className={styles.zoomBtn}
          onClick={handleZoomIn}
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className={styles.zoomBtn}
          onClick={handleZoomOut}
          title="Zoom out"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          className={styles.zoomBtn}
          onClick={handleFitView}
          title="Fit to view"
          aria-label="Fit to view"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>
      </div>
    </div>
  );
};
