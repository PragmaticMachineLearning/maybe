import '@xyflow/react/dist/style.css'

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
} from '@xyflow/react'
import React, { useCallback, useContext, useEffect } from 'react'

import { SpreadsheetContext } from '../SpreadsheetContext'
import { toFlowDiagramElements, type FlowDiagramNodeData } from '../utils/visualDependencyGraphAdapter'
import { getLayoutedNodes } from './useLayoutNodes'

const nodeTypes = {
  formula: ({ data }: { data: FlowDiagramNodeData }) => {
    return (
      <div
        style={{
          padding: '10px',
          borderRadius: '5px',
          backgroundColor: '#fff',
          border: '1px solid #ccc',
          minWidth: '150px',
        }}
      >
        <Handle type="target" position={Position.Left} />
        <div style={{ fontWeight: '0.8em', color: '#222' }}>Address: {data.address}</div>
        <div style={{ fontSize: '0.8em', color: '#666' }}>Value: {data.value}</div>
        <div style={{ fontSize: '0.8em', color: '#888' }}>Type: {data.type}</div>
        <div style={{ fontSize: '0.8em', color: '#888' }}>Formula: {data.formula}</div>
        <Handle type="source" position={Position.Right} />
      </div>
    )
  },
  value: ({ data }: { data: FlowDiagramNodeData }) => {
    return (
      <div
        style={{
          padding: '10px',
          borderRadius: '5px',
          backgroundColor: '#f0f8ff',
          border: '1px solid #ccc',
          minWidth: '150px',
        }}
      >
        <Handle type="target" position={Position.Left} />
        <div style={{ fontWeight: '0.8em', color: '#222' }}>Address: {data.address}</div>
        <div style={{ fontSize: '0.8em', color: '#666' }}>Value: {data.value}</div>
        <div style={{ fontSize: '0.8em', color: '#888' }}>Type: {data.type}</div>
        <Handle type="source" position={Position.Right} />
      </div>
    )
  },
}

export const FlowDiag: React.FC = () => {
  const { hfInstance } = useContext(SpreadsheetContext)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowDiagramNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const updateGraphData = useCallback(async () => {
    if (!hfInstance) return

    const visualGraph = hfInstance.getVisualDependencyGraph()
    const flowElements = toFlowDiagramElements(visualGraph)

    if (flowElements.nodes.length === 0 || flowElements.edges.length === 0) {
      setNodes([])
      setEdges([])
      return
    }

    const layoutedNodes = (await getLayoutedNodes(flowElements.nodes, flowElements.edges)) as Node<
      FlowDiagramNodeData
    >[]
    setNodes(layoutedNodes)
    setEdges(flowElements.edges)
  }, [hfInstance, setEdges, setNodes])

  useEffect(() => {
    updateGraphData()
  }, [updateGraphData])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
    >
      <Background />
      <Controls />
    </ReactFlow>
  )
}
