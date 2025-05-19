import 'reactflow/dist/style.css'

import React, { useCallback, useContext, useEffect } from 'react'
import ReactFlow, {
  Background,
  Controls,
  Edge,
  MarkerType,
  Node,
  Position,
  useEdgesState,
  useNodesState,
} from 'reactflow'

import { SpreadsheetContext } from '../SpreadsheetContext'

const nodeTypes = {
  formula: ({ data }: { data: { address: string; value: any; type: string } }) => (
    <div style={{
      padding: '10px',
      borderRadius: '5px',
      backgroundColor: '#fff',
      border: '1px solid #ccc',
      minWidth: '150px',
    }}>
      <div style={{ fontWeight: '0.8em', color: '#222' }}>Address: {data.address}</div>
      <div style={{ fontSize: '0.8em', color: '#666' }}>Value: {data.value}</div>
      <div style={{ fontSize: '0.8em', color: '#888' }}>Type: {data.type}</div>
    </div>
  ),
  value: ({ data }: { data: { address: string; value: any; type: string } }) => (
    <div style={{
      padding: '10px',
      borderRadius: '5px',
      backgroundColor: '#f0f8ff',
      border: '1px solid #ccc',
      minWidth: '150px',
    }}>
      <div style={{ fontWeight: '0.8em', color: '#222' }}>Address: {data.address}</div>
      <div style={{ fontSize: '0.8em', color: '#666' }}>Value: {data.value}</div>
      <div style={{ fontSize: '0.8em', color: '#888' }}>Type: {data.type}</div>
    </div>
  ),
 
}

const getVertexAddress = (vertex: any, hfInstance: any): string => {
  // Get the address mapping from the HyperFormula instance
  const addressMapping = hfInstance.addressMapping
  
  // Find the address for this vertex by looking it up in the address mapping
  for (const [address, v] of addressMapping.entries()) {
    if (v === vertex) {
      return `${String.fromCharCode(65 + address.col)}${address.row + 1}`
    }
  }
  
  // If we can't find the address, this is an unknown vertex
  return 'Unknown'
}

const getVertexId = (vertex: any, hfInstance: any): string => {
  // Get the address mapping from the HyperFormula instance
  const addressMapping = hfInstance.addressMapping
  
  // Find the address for this vertex by looking it up in the address mapping
  for (const [address, v] of addressMapping.entries()) {
    if (v === vertex) {
      return `cell-${address.sheet}-${address.row}-${address.col}`
    }
  }
  
  // If we can't find the address, generate a unique ID for this unknown vertex
  return `unknown-${Math.random().toString(36).substr(2, 9)}`
}

const getVertexValue = (vertex: any): string => {
  if (vertex.cachedCellValue !== undefined) {
    return vertex.cachedCellValue.toString()
  }
  if (vertex.parsedValue !== undefined) {
    return vertex.parsedValue.toString()
  }
  if (vertex.rawValue !== undefined) {
    return vertex.rawValue
  }
  return 'N/A'
}

const getVertexType = (vertex: any): string => {
  if (vertex.formula) {
    return 'Formula'
  }
  if (vertex.parsedValue !== undefined) {
    return 'Value'
  }
  return 'Unknown'
}

export const FlowDiag: React.FC = () => {
  const { hfInstance } = useContext(SpreadsheetContext)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const updateGraphData = useCallback(() => {
    if (!hfInstance) return

    const graph = hfInstance.dependencyGraph.graph
    const graphNodes = graph.getNodes()
    console.log("graphNodes", graphNodes)
    
    // Create nodes
    const newNodes: Node[] = graphNodes.map((node: any, index: number) => ({
      id: getVertexId(node, hfInstance),
      type: getVertexType(node).toLowerCase(),
      position: { x: index * 200, y: index * 100 },
      data: { 
        address: getVertexAddress(node, hfInstance),
        value: getVertexValue(node),
        type: getVertexType(node)
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }))
    console.log("newNodes", newNodes)
    // Create edges
    const newEdges: Edge[] = []
    graphNodes.forEach((node: any) => {
      const adjacentNodes = graph.adjacentNodes(node)
      adjacentNodes.forEach((adjNode: any) => {
        const sourceId = getVertexId(node, hfInstance)
        const targetId = getVertexId(adjNode, hfInstance)
        if (sourceId && targetId) {
          newEdges.push({
            id: `${sourceId}-${targetId}`,
            source: sourceId,
            target: targetId,
            animated: true,           
          })
        }
      })
    })
    console.log("newEdges", newEdges)
    setNodes(newNodes)
    setEdges(newEdges)
  }, [hfInstance, setNodes, setEdges])

  useEffect(() => {
    if (!hfInstance) return

    // Initial update
    updateGraphData()

    // Subscribe to changes
    hfInstance.on('valuesUpdated', updateGraphData)

    return () => {
      hfInstance.off('valuesUpdated', updateGraphData)
    }
  }, [hfInstance, updateGraphData])

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <div style={{ height: '100vh', border: '1px solid #ccc' }}>
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
      </div>
    </div>
  )
}

