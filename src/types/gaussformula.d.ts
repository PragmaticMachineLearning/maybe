declare module "gaussformula" {
  export type CIInterpretation = "normal" | "uniform" | "lognormal" | "auto";

  export interface ConfidenceIntervalOptions {
    interpretation?: CIInterpretation;
    sourceFormat?: "ci" | "range" | "bracket";
    samplingIdentity?: string;
    format?: unknown;
  }

  export class ConfidenceIntervalNumber {
    readonly lower: number;
    readonly upper: number;
    readonly confidenceLevel: number;
    readonly interpretation: CIInterpretation;

    constructor(
      lower: number,
      upper: number,
      confidenceLevel?: number,
      options?: ConfidenceIntervalOptions
    );
  }

  export type RawCellContent =
    | string
    | number
    | boolean
    | Date
    | null
    | undefined
    | ConfidenceIntervalNumber;

  export class GaussFormula {
    static buildEmpty(config?: Record<string, unknown>): GaussFormula;
    static ConfidenceIntervalNumber: typeof ConfidenceIntervalNumber;
    static version: string;
    static buildDate: string;
    static releaseDate: string;
    static name: string;

    addSheet(name: string): void;
    setSheetContent(sheetId: number, data: unknown[][]): void;
    destroy(): void;
    setCellContents(
      address: { sheet: number; row: number; col: number },
      content: RawCellContent | RawCellContent[][]
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

  export const HyperFormula: typeof GaussFormula;
  export default GaussFormula;
}
