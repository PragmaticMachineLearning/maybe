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
import { getLayoutedNodes } from './useLayoutNodes'

const nodeTypes = {
  formula: ({ data }: { data: { address: string; value: any; type: string; formula: string } }) => {
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
        <Handle type="target" position={Position.Left}/>
        <div style={{ fontWeight: '0.8em', color: '#222' }}>Address: {data.address}</div>
        <div style={{ fontSize: '0.8em', color: '#666' }}>Value: {data.value}</div>
        <div style={{ fontSize: '0.8em', color: '#888' }}>Type: {data.type}</div>
        <div style={{ fontSize: '0.8em', color: '#888' }}>Formula: {data.formula}</div>
        <Handle type="source" position={Position.Right}/>
      </div>
    );
  },
  value: ({ data }: { data: { address: string; value: any; type: string } }) => {
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
        <Handle type="target" position={Position.Left}/>
        <div style={{ fontWeight: '0.8em', color: '#222' }}>Address: {data.address}</div>
        <div style={{ fontSize: '0.8em', color: '#666' }}>Value: {data.value}</div>
        <div style={{ fontSize: '0.8em', color: '#888' }}>Type: {data.type}</div>
        <Handle type="source" position={Position.Right}/>
      </div>
    );
  },
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

const getVertexRawAddress = (vertex: any, hfInstance: any): {sheet: number, row: number, col: number} | null => {
  // Get the address mapping from the HyperFormula instance
  const addressMapping = hfInstance.addressMapping
  for (const [address, v] of addressMapping.entries()){    
    if (v === vertex) {
      return address
    }
  }
  return null
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
    // Handle boolean values from comparison operations
    if (typeof vertex.cachedCellValue === 'boolean') {
      return vertex.cachedCellValue ? 'TRUE' : 'FALSE';
    }
    
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
      } else if ('lower' in vertex.cachedCellValue && 'upper' in vertex.cachedCellValue) {
        // Confidence interval
        return `CI[${vertex.cachedCellValue.lower.toFixed(2)}, ${vertex.cachedCellValue.upper.toFixed(2)}]`;
      } else if ('mu' in vertex.cachedCellValue && 'sigma2' in vertex.cachedCellValue) {
        // Log-normal distribution
        return `LN(μ=${vertex.cachedCellValue.mu.toFixed(2)}, σ²=${vertex.cachedCellValue.sigma2.toFixed(2)})`;
      } else if ('a' in vertex.cachedCellValue && 'b' in vertex.cachedCellValue) {
        // Uniform distribution
        return `U(${vertex.cachedCellValue.a.toFixed(2)}, ${vertex.cachedCellValue.b.toFixed(2)})`;
      }
    }
    return vertex.cachedCellValue.toString();
  }

  // Handle ValueCellVertex with parsedValue
  if (vertex.parsedValue !== undefined) {
    // Handle boolean values from comparison operations
    if (typeof vertex.parsedValue === 'boolean') {
      return vertex.parsedValue ? 'TRUE' : 'FALSE';
    }
    
    if (vertex.parsedValue && typeof vertex.parsedValue === 'object') {
      if ('mean' in vertex.parsedValue && 'variance' in vertex.parsedValue) {
        // Gaussian distribution
        return `N(μ=${vertex.parsedValue.mean.toFixed(2)}, σ²=${vertex.parsedValue.variance.toFixed(2)})`;
      } else if ('lower' in vertex.parsedValue && 'upper' in vertex.parsedValue) {
        // Confidence interval
        return `CI[${vertex.parsedValue.lower.toFixed(2)}, ${vertex.parsedValue.upper.toFixed(2)}]`;
      } else if ('mu' in vertex.parsedValue && 'sigma2' in vertex.parsedValue) {
        // Log-normal distribution
        return `LN(μ=${vertex.parsedValue.mu.toFixed(2)}, σ²=${vertex.parsedValue.sigma2.toFixed(2)})`;
      } else if ('a' in vertex.parsedValue && 'b' in vertex.parsedValue) {
        // Uniform distribution
        return `U(${vertex.parsedValue.a.toFixed(2)}, ${vertex.parsedValue.b.toFixed(2)})`;
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
    return "Formula"
  }
  if (vertex.parsedValue !== undefined) {
    return 'Value'
  }
  return 'Unknown'
}
const getFormula = (vertex: any, hfInstance: any): string => {
  const address = getVertexRawAddress(vertex, hfInstance)
  if (address) {
    return hfInstance.getCellFormula(address)
  }
  return ''
}


const getUnderlyingValue = (vertex: any) => {
  if (vertex.cachedCellValue !== undefined) {
    return vertex.cachedCellValue;
  }
  if (vertex.parsedValue !== undefined) {
    return vertex.parsedValue;
  }
  if (vertex.rawValue !== undefined) {
    return vertex.rawValue;
  }
  return null;
};

const isNumericOrDistributionValue = (value: any): boolean => {
  if (value === null || value === undefined) return false;

  if (typeof value === 'number' && !Number.isNaN(value)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length > 0 && value.every((v) => typeof v === 'number' && !Number.isNaN(v));
  }

  if (typeof value === 'object') {
    if ('samples' in value && Array.isArray(value.samples) && value.samples.length > 0) {
      return true;
    }
    if ('mean' in value && 'variance' in value) {
      return true;
    }
    if ('lower' in value && 'upper' in value) {
      return true;
    }
    if ('mu' in value && 'sigma2' in value) {
      return true;
    }
    if ('a' in value && 'b' in value) {
      return true;
    }
    if (typeof value.getSamples === 'function' || typeof value.toSamples === 'function') {
      try {
        const samples = typeof value.getSamples === 'function' ? value.getSamples() : value.toSamples();
        return Array.isArray(samples) && samples.length > 0;
      } catch (error) {
        console.error('Error sampling value for flow diagram filter', error);
      }
    }
  }

  return false;
};

export const FlowDiag: React.FC = () => {
  const { hfInstance } = useContext(SpreadsheetContext)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const updateGraphData = useCallback(async () => {
    if (!hfInstance) return

    const graph = hfInstance.dependencyGraph.graph
    const graphNodes = graph.getNodes()
   
    const numericVertices = graphNodes.filter((node: any) => {
      const value = getUnderlyingValue(node);
      return isNumericOrDistributionValue(value);
    })

    // Create nodes with temporary positions (will be overridden by ELK layout)
    const newNodes: Node[] = numericVertices.map((node: any) => ({
      id: getVertexId(node, hfInstance),
      type: getVertexType(node).toLowerCase(),
      position: { x: 0, y: 0 }, // Temporary position - ELK will set the actual position
      data: {
        address: getVertexAddress(node, hfInstance),
        value: getVertexValue(node),
        type: getVertexType(node),
        formula: getFormula(node, hfInstance)
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }))

    const nodeIdSet = new Set(newNodes.map((node) => node.id))

    // Create edges only between included vertices
    const newEdges: Edge[] = []
    numericVertices.forEach((node: any) => {
      const adjacentNodes = graph.adjacentNodes(node)
      adjacentNodes.forEach((adjNode: any) => {
        const targetId = getVertexId(adjNode, hfInstance)
        if (!nodeIdSet.has(targetId)) {
          return
        }

        const sourceId = getVertexId(node, hfInstance)
        if (!nodeIdSet.has(sourceId)) {
          return
        }

        const sourceAddress = getVertexAddress(node, hfInstance)
        const targetAddress = getVertexAddress(adjNode, hfInstance)

        const edgeId = `${sourceAddress}-${targetAddress}`
        if (!newEdges.some((edge) => edge.id === edgeId)) {
          newEdges.push({
            id: edgeId,
            source: sourceId,
            target: targetId,
            animated: true,
          })
        }
      })
    })

    const nodesInEdges = new Set<string>()
    newEdges.forEach((edge) => {
      nodesInEdges.add(edge.source)
      nodesInEdges.add(edge.target)
    })

    const filteredNodes = newNodes.filter((node) => nodesInEdges.has(node.id))

    if (filteredNodes.length === 0 || newEdges.length === 0) {
      setNodes([])
      setEdges([])
      return
    }

    // Apply ELK layout to nodes
    const layoutedNodes = await getLayoutedNodes(filteredNodes, newEdges)

    // Set nodes and edges with layout applied
    setNodes(layoutedNodes)
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
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ 
        padding: '16px 20px', 
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-surface)',
        flexShrink: 0
      }}>
        <h2 style={{ 
          margin: 0, 
          fontSize: '18px', 
          fontWeight: '600',
          color: 'var(--text-primary)',
          fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          Flow Diagram
        </h2>
        <p style={{ 
          margin: '4px 0 0 0', 
          fontSize: '13px', 
          color: 'var(--text-secondary)',
          fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          Dependency graph showing numeric cells and distributions
        </p>
      </div>
      
      {/* Flow diagram content */}
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
