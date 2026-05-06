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

  export interface GaussFormulaConstructor {
    buildEmpty(config?: Record<string, unknown>): GaussFormula;
    DistributionNumber: typeof DistributionNumber;
    version: string;
    buildDate: string;
    releaseDate: string;
    name: string;
  }

  export const HyperFormula: GaussFormulaConstructor;
  const GaussFormula: GaussFormulaConstructor;
  export default GaussFormula;
}
