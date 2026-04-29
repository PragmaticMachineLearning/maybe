declare module "gaussformula" {
  export interface DistributionNumberOptions {
    source?: "parameters" | "ci";
    lower?: number;
    upper?: number;
    confidenceLevel?: number;
    samplingIdentity?: string;
  }

  export class DistributionNumber {
    readonly kind: "normal" | "lognormal" | "uniform";
    readonly source: "parameters" | "ci";
    readonly mean?: number;
    readonly variance?: number;
    readonly mu?: number;
    readonly sigma?: number;
    readonly min?: number;
    readonly max?: number;
    readonly lower?: number;
    readonly upper?: number;
    readonly confidenceLevel?: number;

    static normal(
      mean: number,
      variance: number,
      options?: DistributionNumberOptions
    ): DistributionNumber;
    static lognormal(
      mu: number,
      sigma: number,
      options?: DistributionNumberOptions
    ): DistributionNumber;
    static uniform(
      min: number,
      max: number,
      options?: DistributionNumberOptions
    ): DistributionNumber;
    static normalFromCI(
      lower: number,
      upper: number,
      confidenceLevel?: number,
      options?: DistributionNumberOptions
    ): DistributionNumber;
    static lognormalFromCI(
      lower: number,
      upper: number,
      confidenceLevel?: number,
      options?: DistributionNumberOptions
    ): DistributionNumber;

    toSamples(config?: { sampleSize?: number; simulationSeed?: string }): number[];
  }

  export type RawCellContent =
    | string
    | number
    | boolean
    | Date
    | null
    | undefined
    | DistributionNumber;

  export class GaussFormula {
    static buildEmpty(config?: Record<string, unknown>): GaussFormula;
    static DistributionNumber: typeof DistributionNumber;
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
    getCellSerialized(address: {
      sheet: number;
      row: number;
      col: number;
    }): RawCellContent;
    getCellFormula(address: {
      sheet: number;
      row: number;
      col: number;
    }): string | null;
    getSheetSerialized(sheetId: number): RawCellContent[][];
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
