import { FunctionPlugin, FunctionArgumentType, CellError, ErrorType } from 'hyperformula'

/**
 * A plugin class for custom distribution functions in HyperFormula.
 */
export class DistributionFunctionsPlugin extends FunctionPlugin {
  public static implementedFunctions = {
    G: {
      method: 'gaussian',
      parameters: [
        { argumentType: FunctionArgumentType.NUMBER }, // mean
        { argumentType: FunctionArgumentType.NUMBER }  // variance
      ],
    },
    GMEAN: {
      method: 'gaussianMean',
      parameters: [
        { argumentType: FunctionArgumentType.STRING }, // gaussian string representation
      ],
    },
    GVAR: {
      method: 'gaussianVariance',
      parameters: [
        { argumentType: FunctionArgumentType.STRING }, // gaussian string representation
      ],
    },
    GADD: {
      method: 'gaussianAdd',
      parameters: [
        { argumentType: FunctionArgumentType.ANY }, // first gaussian or scalar
        { argumentType: FunctionArgumentType.ANY }, // second gaussian or scalar
      ],
    },
    GMULT: {
      method: 'gaussianMultiply',
      parameters: [
        { argumentType: FunctionArgumentType.ANY }, // first gaussian or scalar
        { argumentType: FunctionArgumentType.ANY }, // second gaussian or scalar
      ],
    }
  }

  // Helper function to parse Gaussian string representation
  private parseGaussianString(str: string): { mean: number, variance: number } | null {
    const match = str.match(/^G\((-?\d+\.?\d*),\s*(-?\d+\.?\d*)\)$/)
    if (!match) return null
    return {
      mean: parseFloat(match[1]),
      variance: parseFloat(match[2])
    }
  }

  // Helper to create Gaussian string
  private formatGaussian(mean: number, variance: number): string {
    return `G(${mean}, ${variance})`
  }

  // Helper to convert any input to a Gaussian object
  private toGaussian(input: any): { mean: number, variance: number } | null {
    if (typeof input === 'string') {
      return this.parseGaussianString(input)
    } else if (typeof input === 'number') {
      return { mean: input, variance: 0 }
    }
    return null
  }

  gaussian(ast: any, state: any) {
    console.log('gaussian function called with:', { ast, state })
    return this.runFunction(
      ast.args,
      state,
      this.metadata('G'),
      (mean, variance) => {
        console.log('gaussian function processing args:', { mean, variance })
        if (typeof mean !== 'number' || typeof variance !== 'number') {
          console.log('gaussian function error: invalid arguments')
          return new CellError(ErrorType.VALUE, 'G function requires two numbers: mean and variance')
        }
        
        return this.formatGaussian(mean, variance)
      }
    )
  }

  gaussianMean(ast: any, state: any) {
    return this.runFunction(
      ast.args,
      state,
      this.metadata('GMEAN'),
      (gaussianStr) => {
        if (typeof gaussianStr !== 'string') {
          return new CellError(ErrorType.VALUE, 'GMEAN requires a Gaussian distribution string')
        }
        
        const parsed = this.parseGaussianString(gaussianStr)
        if (!parsed) {
          return new CellError(ErrorType.VALUE, 'Invalid Gaussian distribution format')
        }
        
        return parsed.mean
      }
    )
  }

  gaussianVariance(ast: any, state: any) {
    return this.runFunction(
      ast.args,
      state,
      this.metadata('GVAR'),
      (gaussianStr) => {
        if (typeof gaussianStr !== 'string') {
          return new CellError(ErrorType.VALUE, 'GVAR requires a Gaussian distribution string')
        }
        
        const parsed = this.parseGaussianString(gaussianStr)
        if (!parsed) {
          return new CellError(ErrorType.VALUE, 'Invalid Gaussian distribution format')
        }
        
        return parsed.variance
      }
    )
  }

  gaussianAdd(ast: any, state: any) {
    return this.runFunction(
      ast.args,
      state,
      this.metadata('GADD'),
      (v1, v2) => {
        const g1 = this.toGaussian(v1)
        const g2 = this.toGaussian(v2)
        
        if (!g1 || !g2) {
          return new CellError(ErrorType.VALUE, 'GADD requires two Gaussian distributions or numbers')
        }

        // For addition: means add, variances add
        const resultMean = g1.mean + g2.mean
        const resultVariance = g1.variance + g2.variance

        return this.formatGaussian(resultMean, resultVariance)
      }
    )
  }

  gaussianMultiply(ast: any, state: any) {
    return this.runFunction(
      ast.args,
      state,
      this.metadata('GMULT'),
      (v1, v2) => {
        const g1 = this.toGaussian(v1)
        const g2 = this.toGaussian(v2)
        
        if (!g1 || !g2) {
          return new CellError(ErrorType.VALUE, 'GMULT requires two Gaussian distributions or numbers')
        }

        // For multiplication:
        // mean = μ₁μ₂
        // variance = μ₁²σ₂² + μ₂²σ₁² + σ₁²σ₂²
        const resultMean = g1.mean * g2.mean
        const resultVariance = 
          Math.pow(g1.mean, 2) * g2.variance + 
          Math.pow(g2.mean, 2) * g1.variance + 
          g1.variance * g2.variance

        return this.formatGaussian(resultMean, resultVariance)
      }
    )
  }
}

// Define translations separately, exactly as shown in docs
export const DistributionFunctionsTranslations = {
  enGB: {
    G: 'G',
    GMEAN: 'GMEAN',
    GVAR: 'GVAR',
    GADD: 'GADD',
    GMULT: 'GMULT'
  },
  enUS: {
    G: 'G',
    GMEAN: 'GMEAN',
    GVAR: 'GVAR',
    GADD: 'GADD',
    GMULT: 'GMULT'
  },
  deDE: {
    G: 'G',
    GMEAN: 'GMEAN',
    GVAR: 'GVAR',
    GADD: 'GADD',
    GMULT: 'GMULT'
  }
}