declare module "gaussformula" {
  export class HyperFormula {
    static buildEmpty(config?: any): HyperFormula;
    static version: string;
    static buildDate: string;
    static releaseDate: string;
    static name: string;

    addSheet(name: string): void;
    setSheetContent(sheetId: number, data: any[][]): void;
    destroy(): void;
    setCellContents(
      address: { sheet: number; row: number; col: number },
      content: string
    ): void;
    getCellValue(address: { sheet: number; row: number; col: number }): any;
    getCellFormula(address: {
      sheet: number;
      row: number;
      col: number;
    }): string | null;
    validateFormula(formula: string): { isValid: boolean; [key: string]: any };
    on(event: string, callback: () => void): void;
    off(event: string, callback: () => void): void;
    getVisualDependencyGraph(): import('./visualDependencyGraph').VisualDependencyGraph;

    // Dependency graph properties
    dependencyGraph: {
      graph: {
        getNodes(): any[];
        adjacentNodes(node: any): any[];
      };
    };

    // Address mapping for dependency visualization
    addressMapping: Map<any, any>;
  }
}
