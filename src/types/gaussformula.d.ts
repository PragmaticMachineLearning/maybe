declare module "gaussformula" {
  export class HyperFormula {
    static buildEmpty(config?: Record<string, unknown>): HyperFormula;
    static version: string;
    static buildDate: string;
    static releaseDate: string;
    static name: string;

    addSheet(name: string): void;
    setSheetContent(sheetId: number, data: unknown[][]): void;
    destroy(): void;
    setCellContents(
      address: { sheet: number; row: number; col: number },
      content: string
    ): void;
    getCellValue(address: { sheet: number; row: number; col: number }): unknown;
    getCellFormula(address: {
      sheet: number;
      row: number;
      col: number;
    }): string | null;
    getSheetDimensions(sheetId: number): { width: number; height: number };
    validateFormula(formula: string): { isValid: boolean; [key: string]: unknown };
    on(event: string, callback: () => void): void;
    off(event: string, callback: () => void): void;
    getVisualDependencyGraph(): import('./visualDependencyGraph').VisualDependencyGraph;

    // Dependency graph properties
    dependencyGraph: {
      graph: {
        getNodes(): unknown[];
        adjacentNodes(node: unknown): unknown[];
      };
    };

    // Address mapping for dependency visualization
    addressMapping: Map<unknown, unknown>;
  }
}
