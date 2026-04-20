import "@xyflow/react/dist/style.css";

import {
  Background,
  Controls,
  Edge,
  Handle,
  Node,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import React, { useCallback, useContext, useEffect } from "react";

import { SpreadsheetContext } from "../../context/SpreadsheetContext";
import {
  toFlowDiagramElements,
  type FlowDiagramNodeData,
} from "../../utils/visual-dependency-graph/visualDependencyGraphAdapter";
import { getLayoutedNodes } from "./useLayoutNodes";
import styles from "./FlowDiag.module.css";

const nodeTypes = {
  formula: ({ data }: { data: FlowDiagramNodeData }) => {
    return (
      <div className={styles.formulaNode}>
        <Handle type="target" position={Position.Left} />
        <div className={styles.nodeAddress}>Address: {data.address}</div>
        <div className={styles.nodeValue}>Value: {data.value}</div>
        <div className={styles.nodeMuted}>Type: {data.type}</div>
        <div className={styles.nodeMuted}>Formula: {data.formula}</div>
        <Handle type="source" position={Position.Right} />
      </div>
    );
  },
  value: ({ data }: { data: FlowDiagramNodeData }) => {
    return (
      <div className={styles.valueNode}>
        <Handle type="target" position={Position.Left} />
        <div className={styles.nodeAddress}>Address: {data.address}</div>
        <div className={styles.nodeValue}>Value: {data.value}</div>
        <div className={styles.nodeMuted}>Type: {data.type}</div>
        <Handle type="source" position={Position.Right} />
      </div>
    );
  },
};

export const FlowDiag: React.FC = () => {
  const { formulaEngine } = useContext(SpreadsheetContext);
  const [nodes, setNodes, onNodesChange] = useNodesState<
    Node<FlowDiagramNodeData>
  >([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const updateGraphData = useCallback(async () => {
    if (!formulaEngine) return;

    const visualGraph = formulaEngine.getVisualDependencyGraph();
    const flowElements = toFlowDiagramElements(visualGraph);

    if (flowElements.nodes.length === 0 || flowElements.edges.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const layoutedNodes = (await getLayoutedNodes(
      flowElements.nodes,
      flowElements.edges,
    )) as Node<FlowDiagramNodeData>[];
    setNodes(layoutedNodes);
    setEdges(flowElements.edges);
  }, [formulaEngine, setEdges, setNodes]);

  useEffect(() => {
    if (!formulaEngine) return;

    updateGraphData();

    formulaEngine.on("valuesUpdated", updateGraphData);

    return () => {
      formulaEngine.off("valuesUpdated", updateGraphData);
    };
  }, [formulaEngine, updateGraphData]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Flow Diagram</h2>
        <p className={styles.subtitle}>
          Dependency graph showing numeric cells and distributions
        </p>
      </div>

      <div className={styles.flowContent}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          style={{ width: "100%", height: "100%" }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
};
