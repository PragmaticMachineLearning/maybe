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
  const { formulaEngine } = useContext(SpreadsheetContext)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowDiagramNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const updateGraphData = useCallback(async () => {
    if (!formulaEngine) return

    const visualGraph = formulaEngine.getVisualDependencyGraph()
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
  }, [formulaEngine, setEdges, setNodes])

  useEffect(() => {
    if (!formulaEngine) return

    updateGraphData()

    formulaEngine.on('valuesUpdated', updateGraphData)

    return () => {
      formulaEngine.off('valuesUpdated', updateGraphData)
    }
  }, [formulaEngine, updateGraphData])

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-surface)',
          flexShrink: 0,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            fontFamily:
              '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          Flow Diagram
        </h2>
        <p
          style={{
            margin: '4px 0 0 0',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            fontFamily:
              '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          Dependency graph showing numeric cells and distributions
        </p>
      </div>

      <div style={{ flex: '1 1 auto', minHeight: 0, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          style={{ width: '100%', height: '100%' }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}
