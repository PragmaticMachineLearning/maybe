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

  export interface HyperFormulaConfig {
    licenseKey?: string;
    language?: string;
    useColumnIndex?: boolean;
    sampleSize?: number;
  }

  export class HyperFormula {
    static buildEmpty(config?: HyperFormulaConfig): HyperFormula;

    dependencyGraph: DependencyGraph;
    getCellValue(address: { sheet: number; row: number; col: number }): any;
    getCellFormula(address: {
      sheet: number;
      row: number;
      col: number;
    }): string;
    setCellContents(
      address: { sheet: number; row: number; col: number },
      value: string
    ): void;
    validateFormula(formula: string): any;
    addSheet(name: string): void;
    setSheetContent(sheetId: number, data: any[][]): void;
    destroy(): void;
    on(event: string, callback: () => void): void;
    off(event: string, callback: () => void): void;
  }
}
