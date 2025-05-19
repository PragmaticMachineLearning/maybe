declare module "hyperformula" {
  export interface Vertex {
    toString(): string;
  }

  export interface Graph<T> {
    getNodes(): T[];
    adjacentNodes(node: T): Set<T>;
    existsEdge(fromNode: T, toNode: T): boolean;
  }

  export interface DependencyGraph {
    graph: Graph<Vertex>;
  }

  export interface HyperFormula {
    dependencyGraph: DependencyGraph;
    getCellValue(address: { sheet: number; row: number; col: number }): any;
    on(event: string, callback: () => void): void;
    off(event: string, callback: () => void): void;
  }
}
