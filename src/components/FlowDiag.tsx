import '@xyflow/react/dist/style.css';

import  {
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

const nodeTypes = {
  formula: ({ data }: { data: { address: string; value: any; type: string } }) => (
    <div style={{
      padding: '10px',
      borderRadius: '5px',
      backgroundColor: '#fff',
      border: '1px solid #ccc',
      minWidth: '150px',
    }}>
      <Handle type="target" position={Position.Left}/>
      <div style={{ fontWeight: '0.8em', color: '#222' }}>Address: {data.address}</div>
      <div style={{ fontSize: '0.8em', color: '#666' }}>Value: {data.value}</div>
      <div style={{ fontSize: '0.8em', color: '#888' }}>Type: {data.type}</div>
      <Handle type="source" position={Position.Right}/>
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
      <Handle type="target" position={Position.Left}/>
      <div style={{ fontWeight: '0.8em', color: '#222' }}>Address: {data.address}</div>
      <div style={{ fontSize: '0.8em', color: '#666' }}>Value: {data.value}</div>
      <div style={{ fontSize: '0.8em', color: '#888' }}>Type: {data.type}</div>
      <Handle type="source" position={Position.Right}/>
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
  // Handle FormulaCellVertex with cachedCellValue
  if (vertex.cachedCellValue !== undefined) {
    if (vertex.cachedCellValue && typeof vertex.cachedCellValue === 'object') {
      if ('mean' in vertex.cachedCellValue && 'variance' in vertex.cachedCellValue) {
        // Gaussian distribution
        return `N(μ=${vertex.cachedCellValue.mean.toFixed(2)}, σ²=${vertex.cachedCellValue.variance.toFixed(2)})`;
      } else if ('samples' in vertex.cachedCellValue && Array.isArray(vertex.cachedCellValue.samples)) {
        // Sampled distribution - only calculate mean and variance
        const samples = vertex.cachedCellValue.samples;
        const mean = samples.reduce((a: number, b: number) => a + b, 0) / samples.length;
        const variance = samples.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / samples.length;
        return `S(μ=${mean.toFixed(2)}, σ²=${variance.toFixed(2)})`;
      }
    }
    return vertex.cachedCellValue.toString();
  }

  // Handle ValueCellVertex with parsedValue
  if (vertex.parsedValue !== undefined) {
    if (vertex.parsedValue && typeof vertex.parsedValue === 'object') {
      if ('mean' in vertex.parsedValue && 'variance' in vertex.parsedValue) {
        // Gaussian distribution
        return `N(μ=${vertex.parsedValue.mean.toFixed(2)}, σ²=${vertex.parsedValue.variance.toFixed(2)})`;
      }
    }
    return vertex.parsedValue.toString();
  }

  if (vertex.rawValue !== undefined) {
    return vertex.rawValue;
  }
  return 'N/A';
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
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

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
        const sourceAddress = getVertexAddress(node, hfInstance)
        const targetAddress = getVertexAddress(adjNode, hfInstance)
        if (sourceId && targetId && sourceAddress && targetAddress) {
          newEdges.push({
            id: `${sourceAddress}-${targetAddress}`,
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

